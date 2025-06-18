import React, { useState, useEffect, useCallback } from 'react';
import { ipcRenderer } from 'electron';
import { SettingsData, PluginConfig, LLMProvider, AppStats } from '../types/settings';
import { ModelDescriptor, CloudConfig } from '../synapseConnector';
import './SettingsWindow.css';

interface SettingsWindowProps {
  onClose?: () => void;
}

const SettingsWindow: React.FC<SettingsWindowProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'dictionary' | 'plugins' | 'synapse' | 'stats'>('dictionary');
  const [settings, setSettings] = useState<SettingsData>({
    plugins: [],
    synapse: { providers: [] },
    dictionary: { words: [], count: 0 },
    stats: { cpu: 0, memory: 0, activeOverlays: 0 }
  });
  const [loading, setLoading] = useState(true);
  const [newWord, setNewWord] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [apiKey, setApiKey] = useState('');
  const [localModels, setLocalModels] = useState<ModelDescriptor[]>([]);
  const [showPrivacyWarning, setShowPrivacyWarning] = useState(false);
  const [configError, setConfigError] = useState<string>('');
  const [isConfiguring, setIsConfiguring] = useState(false);

  // Load initial settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        const [plugins, synapseConfig, words, wordCount, stats] = await Promise.all([
          ipcRenderer.invoke('plugins:get-config'),
          ipcRenderer.invoke('synapse:get-config'),
          ipcRenderer.invoke('dictionary:list-words'),
          ipcRenderer.invoke('dictionary:get-count'),
          ipcRenderer.invoke('stats:get')
        ]);

        setSettings({
          plugins,
          synapse: synapseConfig,
          dictionary: { words, count: wordCount },
          stats
        });
      } catch (error) {
        console.error('Failed to load settings:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  // Subscribe to real-time stats updates
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    
    ipcRenderer.invoke('stats:subscribe', (newStats: AppStats) => {
      setSettings(prev => ({ ...prev, stats: newStats }));
    }).then((unsub) => {
      unsubscribe = unsub;
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  // Dictionary management
  const handleAddWord = useCallback(async () => {
    if (!newWord.trim()) return;
    
    try {
      await ipcRenderer.invoke('dictionary:add-word', newWord.trim());
      const [words, count] = await Promise.all([
        ipcRenderer.invoke('dictionary:list-words'),
        ipcRenderer.invoke('dictionary:get-count')
      ]);
      setSettings(prev => ({ ...prev, dictionary: { words, count } }));
      setNewWord('');
    } catch (error) {
      console.error('Failed to add word:', error);
    }
  }, [newWord]);

  const handleRemoveWord = useCallback(async (word: string) => {
    try {
      await ipcRenderer.invoke('dictionary:remove-word', word);
      const [words, count] = await Promise.all([
        ipcRenderer.invoke('dictionary:list-words'),
        ipcRenderer.invoke('dictionary:get-count')
      ]);
      setSettings(prev => ({ ...prev, dictionary: { words, count } }));
    } catch (error) {
      console.error('Failed to remove word:', error);
    }
  }, []);

  // Plugin management
  const handleTogglePlugin = useCallback(async (pluginId: string, enabled: boolean) => {
    try {
      await ipcRenderer.invoke('plugins:toggle', pluginId, enabled);
      const plugins = await ipcRenderer.invoke('plugins:get-config');
      setSettings(prev => ({ ...prev, plugins }));
    } catch (error) {
      console.error('Failed to toggle plugin:', error);
    }
  }, []);

  // Synapse LLM configuration
  const handleDiscoverModels = useCallback(async () => {
    try {
      const models = await ipcRenderer.invoke('synapse:discover-local-models');
      setLocalModels(models);
    } catch (error) {
      console.error('Failed to discover models:', error);
    }
  }, []);

  const handleSetProvider = useCallback(async () => {
    if (!selectedProvider) return;
    
    // Show privacy warning for cloud providers
    if (selectedProvider !== 'local' && !selectedProvider.startsWith('ollama:') && !selectedProvider.startsWith('hf:')) {
      if (!showPrivacyWarning) {
        setShowPrivacyWarning(true);
        return;
      }
    }

    setIsConfiguring(true);
    setConfigError('');

    try {
      // For cloud providers, use the new secure configuration
      if (selectedProvider !== 'local' && !selectedProvider.startsWith('ollama:') && !selectedProvider.startsWith('hf:')) {
        const cloudConfig: CloudConfig = {
          provider: selectedProvider,
          apiKey: apiKey
        };
        
        const result = await ipcRenderer.invoke('synapse:set-cloud-config', cloudConfig);
        if (!result.success) {
          setConfigError(result.error || 'Failed to configure provider');
          return;
        }
      }

      // Legacy provider setup for compatibility
      const provider: LLMProvider = {
        id: selectedProvider,
        name: selectedProvider,
        type: selectedProvider === 'local' || selectedProvider.startsWith('ollama:') || selectedProvider.startsWith('hf:') ? 'local' : 'cloud',
        apiKey: apiKey || undefined
      };

      await ipcRenderer.invoke('synapse:set-provider', selectedProvider, provider);
      const synapseConfig = await ipcRenderer.invoke('synapse:get-config');
      setSettings(prev => ({ ...prev, synapse: synapseConfig }));
      
      // Reset form
      setSelectedProvider('');
      setApiKey('');
      setShowPrivacyWarning(false);
    } catch (error) {
      console.error('Failed to set provider:', error);
      setConfigError('Failed to configure provider. Please check your settings.');
    } finally {
      setIsConfiguring(false);
    }
  }, [selectedProvider, apiKey, showPrivacyWarning]);

  if (loading) {
    return (
      <div className="settings-loading">
        <div className="loading-spinner"></div>
        <p>Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="settings-window">
      <div className="settings-header">
        <h1>⚙️ OpenGrammer Settings</h1>
        {onClose && (
          <button className="close-button" onClick={onClose}>
            ✕
          </button>
        )}
      </div>

      <div className="settings-tabs">
        <button
          className={`tab ${activeTab === 'dictionary' ? 'active' : ''}`}
          onClick={() => setActiveTab('dictionary')}
        >
          📚 Dictionary
        </button>
        <button
          className={`tab ${activeTab === 'plugins' ? 'active' : ''}`}
          onClick={() => setActiveTab('plugins')}
        >
          🔌 Plugins
        </button>
        <button
          className={`tab ${activeTab === 'synapse' ? 'active' : ''}`}
          onClick={() => setActiveTab('synapse')}
        >
          🧠 Synapse LLM
        </button>
        <button
          className={`tab ${activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          📊 Statistics
        </button>
      </div>

      <div className="settings-content">
        {activeTab === 'dictionary' && (
          <div className="dictionary-section">
            <h2>Custom Dictionary Management</h2>
            <p>Add words to your personal dictionary to prevent them from being flagged as misspellings.</p>
            
            <div className="add-word-section">
              <div className="input-group">
                <input
                  type="text"
                  value={newWord}
                  onChange={(e) => setNewWord(e.target.value)}
                  placeholder="Enter word to add..."
                  onKeyPress={(e) => e.key === 'Enter' && handleAddWord()}
                />
                <button onClick={handleAddWord} disabled={!newWord.trim()}>
                  Add Word
                </button>
              </div>
            </div>

            <div className="dictionary-stats">
              <p><strong>Total words:</strong> {settings.dictionary.count}</p>
            </div>

            <div className="word-list">
              <h3>Dictionary Words</h3>
              <div className="word-grid">
                {settings.dictionary.words.map((word) => (
                  <div key={word} className="word-item">
                    <span>{word}</span>
                    <button
                      className="remove-word"
                      onClick={() => handleRemoveWord(word)}
                      title="Remove word"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              {settings.dictionary.words.length === 0 && (
                <p className="empty-state">No custom words added yet.</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'plugins' && (
          <div className="plugins-section">
            <h2>Grammar & Style Plugins</h2>
            <p>Enable or disable individual grammar and style checking rules.</p>
            
            <div className="plugin-categories">
              <div className="plugin-category">
                <h3>Grammar Rules</h3>
                {settings.plugins
                  .filter(plugin => plugin.category === 'grammar')
                  .map((plugin) => (
                    <div key={plugin.id} className="plugin-item">
                      <div className="plugin-info">
                        <h4>{plugin.name}</h4>
                        <p>{plugin.description}</p>
                      </div>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={plugin.enabled}
                          onChange={(e) => handleTogglePlugin(plugin.id, e.target.checked)}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                  ))}
              </div>

              <div className="plugin-category">
                <h3>Style Rules</h3>
                {settings.plugins
                  .filter(plugin => plugin.category === 'style')
                  .map((plugin) => (
                    <div key={plugin.id} className="plugin-item">
                      <div className="plugin-info">
                        <h4>{plugin.name}</h4>
                        <p>{plugin.description}</p>
                      </div>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={plugin.enabled}
                          onChange={(e) => handleTogglePlugin(plugin.id, e.target.checked)}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'synapse' && (
          <div className="synapse-section">
            <h2>Synapse LLM Connector</h2>
            
            <div className="privacy-warning">
              <div className="warning-icon">⚠️</div>
              <div className="warning-content">
                <h3>Privacy Notice</h3>
                <p>
                  When using cloud-based LLM providers, your text may be sent to external servers.
                  For maximum privacy, use local models only. Local processing keeps all data on your device.
                </p>
              </div>
            </div>

            <div className="provider-config">
              <h3>LLM Provider Configuration</h3>
              
              <div className="local-models-section">
                <h4>Local Models</h4>
                <button onClick={handleDiscoverModels} className="discover-button">
                  🔍 Auto-discover Local Models
                </button>
                {localModels.length > 0 && (
                  <div className="model-list">
                    {localModels.map((model) => (
                      <div key={model.id} className="model-item">
                        <div className="model-info">
                          <span className="model-name">{model.name}</span>
                          <span className="model-provider">({model.provider})</span>
                          {model.metadata?.description && (
                            <p className="model-description">{model.metadata.description}</p>
                          )}
                        </div>
                        <button onClick={() => setSelectedProvider(model.id)}>
                          Select
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="cloud-providers-section">
                <h4>Cloud Providers</h4>
                {configError && (
                  <div className="error-message">
                    <span className="error-icon">⚠️</span>
                    {configError}
                  </div>
                )}
                <div className="provider-form">
                  <select
                    value={selectedProvider}
                    onChange={(e) => setSelectedProvider(e.target.value)}
                    disabled={isConfiguring}
                  >
                    <option value="">Select Provider...</option>
                    <option value="openai">OpenAI GPT</option>
                    <option value="anthropic">Anthropic Claude</option>
                    <option value="cohere">Cohere</option>
                    <option value="custom">Custom Provider</option>
                  </select>
                  
                  {selectedProvider && selectedProvider !== 'local' && !selectedProvider.startsWith('ollama:') && !selectedProvider.startsWith('hf:') && (
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="Enter API Key..."
                      disabled={isConfiguring}
                    />
                  )}
                  
                  <button
                    onClick={handleSetProvider}
                    disabled={isConfiguring || !selectedProvider || (selectedProvider !== 'local' && !selectedProvider.startsWith('ollama:') && !selectedProvider.startsWith('hf:') && !apiKey)}
                  >
                    {isConfiguring ? 'Configuring...' : 'Configure Provider'}
                  </button>
                </div>

                {showPrivacyWarning && (
                  <div className="privacy-confirmation">
                    <div className="warning-content">
                      <h4>⚠️ Privacy Confirmation Required</h4>
                      <p>
                        You are about to configure a cloud-based LLM provider. This means:
                      </p>
                      <ul>
                        <li>Your text will be sent to external servers for processing</li>
                        <li>The provider may store or analyze your data according to their terms</li>
                        <li>Network connectivity is required for all operations</li>
                      </ul>
                      <p>
                        <strong>For maximum privacy, consider using local models only.</strong>
                      </p>
                      <div className="confirmation-buttons">
                        <button
                          onClick={() => setShowPrivacyWarning(false)}
                          className="cancel-button"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSetProvider}
                          className="confirm-button"
                        >
                          I Understand - Continue
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="active-provider">
                <h4>Active Provider</h4>
                <p>
                  {settings.synapse.activeProvider || 'No provider configured'}
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="stats-section">
            <h2>Application Statistics</h2>
            <p>Real-time performance and usage statistics.</p>
            
            <div className="stats-grid">
              <div className="stat-card">
                <h3>CPU Usage</h3>
                <div className="stat-value">{settings.stats.cpu.toFixed(1)}%</div>
                <div className="stat-bar">
                  <div
                    className="stat-bar-fill"
                    style={{ width: `${Math.min(settings.stats.cpu, 100)}%` }}
                  ></div>
                </div>
              </div>

              <div className="stat-card">
                <h3>Memory Usage</h3>
                <div className="stat-value">{(settings.stats.memory / 1024 / 1024).toFixed(1)} MB</div>
                <div className="stat-bar">
                  <div
                    className="stat-bar-fill"
                    style={{ width: `${Math.min((settings.stats.memory / 1024 / 1024) / 1000 * 100, 100)}%` }}
                  ></div>
                </div>
              </div>

              <div className="stat-card">
                <h3>Active Overlays</h3>
                <div className="stat-value">{settings.stats.activeOverlays}</div>
                <div className="stat-description">
                  Grammar overlays currently displayed
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsWindow;