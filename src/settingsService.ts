import { ipcMain } from 'electron';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { DictionaryStore } from './dictionaryStore';
import { PluginConfig, LLMProvider, SynapseConfig, AppStats } from './types/settings';
import { synapseConnector, ModelDescriptor, CloudConfig } from './synapseConnector';

export class SettingsService {
  private dictionaryStore: DictionaryStore;
  private pluginConfigs: PluginConfig[] = [];
  private synapseConfig: SynapseConfig = { providers: [] };
  private statsSubscribers: ((stats: AppStats) => void)[] = [];
  private statsInterval?: NodeJS.Timeout;

  constructor(dictionaryStore: DictionaryStore) {
    this.dictionaryStore = dictionaryStore;
    this.initializePluginConfigs();
    this.initializeSynapseConfig();
    this.setupIpcHandlers();
    this.startStatsCollection();
  }

  private initializePluginConfigs(): void {
    // Grammar plugins
    this.pluginConfigs = [
      {
        id: 'spelling',
        name: 'Spelling Checker',
        enabled: true,
        description: 'Detects and suggests corrections for misspelled words',
        category: 'grammar'
      },
      {
        id: 'punctuation',
        name: 'Punctuation Rules',
        enabled: true,
        description: 'Checks for proper punctuation usage and spacing',
        category: 'grammar'
      },
      {
        id: 'subject-verb-agreement',
        name: 'Subject-Verb Agreement',
        enabled: true,
        description: 'Ensures subjects and verbs agree in number',
        category: 'grammar'
      },
      {
        id: 'tense-consistency',
        name: 'Tense Consistency',
        enabled: true,
        description: 'Maintains consistent verb tenses throughout text',
        category: 'grammar'
      },
      // Style plugins
      {
        id: 'passive-voice',
        name: 'Passive Voice Detection',
        enabled: true,
        description: 'Identifies passive voice constructions and suggests active alternatives',
        category: 'style'
      },
      {
        id: 'wordiness',
        name: 'Wordiness Check',
        enabled: true,
        description: 'Detects wordy phrases and suggests concise alternatives',
        category: 'style'
      },
      {
        id: 'redundancy',
        name: 'Redundancy Detection',
        enabled: true,
        description: 'Identifies redundant words and phrases',
        category: 'style'
      },
      {
        id: 'sentence-length',
        name: 'Sentence Length Analysis',
        enabled: false,
        description: 'Flags overly long or complex sentences',
        category: 'style'
      }
    ];
  }

  private initializeSynapseConfig(): void {
    this.synapseConfig = {
      providers: [
        {
          id: 'local',
          name: 'Local Models',
          type: 'local',
          models: []
        }
      ],
      activeProvider: undefined,
      localModelsPath: path.join(os.homedir(), '.cache', 'huggingface', 'transformers')
    };
  }

  private setupIpcHandlers(): void {
    // Dictionary management
    ipcMain.handle('dictionary:add-word', async (_, word: string) => {
      await this.dictionaryStore.addWord(word);
    });

    ipcMain.handle('dictionary:remove-word', async (_, word: string) => {
      await this.dictionaryStore.removeWord(word);
    });

    ipcMain.handle('dictionary:list-words', async () => {
      return await this.dictionaryStore.listWords();
    });

    ipcMain.handle('dictionary:get-count', async () => {
      return await this.dictionaryStore.getWordCount();
    });

    // Plugin management
    ipcMain.handle('plugins:get-config', async () => {
      return this.pluginConfigs;
    });

    ipcMain.handle('plugins:toggle', async (_, pluginId: string, enabled: boolean) => {
      const plugin = this.pluginConfigs.find(p => p.id === pluginId);
      if (plugin) {
        plugin.enabled = enabled;
        await this.savePluginConfigs();
      }
    });

    // Synapse LLM configuration
    ipcMain.handle('synapse:get-config', async () => {
      return this.synapseConfig;
    });

    ipcMain.handle('synapse:set-provider', async (_, providerId: string, config: LLMProvider) => {
      const existingIndex = this.synapseConfig.providers.findIndex(p => p.id === providerId);
      if (existingIndex >= 0) {
        this.synapseConfig.providers[existingIndex] = config;
      } else {
        this.synapseConfig.providers.push(config);
      }
      this.synapseConfig.activeProvider = providerId;
      await this.saveSynapseConfig();
    });

    ipcMain.handle('synapse:discover-local-models', async () => {
      return await this.discoverLocalModels();
    });

    ipcMain.handle('synapse:set-cloud-config', async (_, config: CloudConfig) => {
      try {
        await synapseConnector.setCloudConfig(config);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    });

    ipcMain.handle('synapse:get-cloud-config', async (_, provider: string) => {
      return synapseConnector.getCloudConfig(provider);
    });

    ipcMain.handle('synapse:test-connection', async () => {
      return await synapseConnector.testConnection();
    });

    // Application stats
    ipcMain.handle('stats:get', async () => {
      return this.getCurrentStats();
    });

    ipcMain.handle('stats:subscribe', async (_, callback: (stats: AppStats) => void) => {
      this.statsSubscribers.push(callback);
      return () => {
        const index = this.statsSubscribers.indexOf(callback);
        if (index > -1) {
          this.statsSubscribers.splice(index, 1);
        }
      };
    });
  }

  private async savePluginConfigs(): Promise<void> {
    try {
      const configPath = path.join(os.homedir(), '.opengrammer', 'plugins.json');
      const configDir = path.dirname(configPath);
      
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      
      fs.writeFileSync(configPath, JSON.stringify(this.pluginConfigs, null, 2));
    } catch (error) {
      console.error('Failed to save plugin configuration:', error);
    }
  }

  private async saveSynapseConfig(): Promise<void> {
    try {
      const configPath = path.join(os.homedir(), '.opengrammer', 'synapse.json');
      const configDir = path.dirname(configPath);
      
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      
      fs.writeFileSync(configPath, JSON.stringify(this.synapseConfig, null, 2));
    } catch (error) {
      console.error('Failed to save Synapse configuration:', error);
    }
  }

  private async discoverLocalModels(): Promise<ModelDescriptor[]> {
    try {
      return await synapseConnector.discoverLocalModels();
    } catch (error) {
      console.error('Failed to discover local models:', error);
      return [];
    }
  }

  private getCurrentStats(): AppStats {
    const memUsage = process.memoryUsage();
    
    return {
      cpu: process.cpuUsage().user / 1000000, // Convert to percentage approximation
      memory: memUsage.heapUsed,
      activeOverlays: 0 // This would be updated by overlay service
    };
  }

  private startStatsCollection(): void {
    this.statsInterval = setInterval(() => {
      const stats = this.getCurrentStats();
      this.statsSubscribers.forEach(callback => {
        try {
          callback(stats);
        } catch (error) {
          console.error('Error in stats callback:', error);
        }
      });
    }, 2000); // Update every 2 seconds
  }

  public updateActiveOverlayCount(count: number): void {
    // This method can be called by the overlay service to update stats
    this.statsSubscribers.forEach(callback => {
      try {
        const stats = this.getCurrentStats();
        stats.activeOverlays = count;
        callback(stats);
      } catch (error) {
        console.error('Error in stats callback:', error);
      }
    });
  }

  public getPluginConfig(pluginId: string): PluginConfig | undefined {
    return this.pluginConfigs.find(p => p.id === pluginId);
  }

  public isPluginEnabled(pluginId: string): boolean {
    const plugin = this.getPluginConfig(pluginId);
    return plugin ? plugin.enabled : false;
  }

  public dispose(): void {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
    }
    this.statsSubscribers.length = 0;
  }
}