/**
 * TypeScript type definitions for Settings UI
 */

export interface AppStats {
  cpu: number;
  memory: number;
  activeOverlays: number;
}

export interface PluginConfig {
  id: string;
  name: string;
  enabled: boolean;
  description: string;
  category: 'grammar' | 'style';
}

export interface LLMProvider {
  id: string;
  name: string;
  type: 'local' | 'cloud';
  apiKey?: string;
  endpoint?: string;
  models?: string[];
}

export interface SynapseConfig {
  providers: LLMProvider[];
  activeProvider?: string;
  localModelsPath?: string;
}

export interface SettingsData {
  plugins: PluginConfig[];
  synapse: SynapseConfig;
  dictionary: {
    words: string[];
    count: number;
  };
  stats: AppStats;
}

export interface SettingsIPC {
  // Dictionary management
  'dictionary:add-word': (word: string) => Promise<void>;
  'dictionary:remove-word': (word: string) => Promise<void>;
  'dictionary:list-words': () => Promise<string[]>;
  'dictionary:get-count': () => Promise<number>;
  
  // Plugin management
  'plugins:get-config': () => Promise<PluginConfig[]>;
  'plugins:toggle': (pluginId: string, enabled: boolean) => Promise<void>;
  
  // Synapse LLM configuration
  'synapse:get-config': () => Promise<SynapseConfig>;
  'synapse:set-provider': (providerId: string, config: LLMProvider) => Promise<void>;
  'synapse:discover-local-models': () => Promise<string[]>;
  
  // Application stats
  'stats:get': () => Promise<AppStats>;
  'stats:subscribe': (callback: (stats: AppStats) => void) => () => void;
}