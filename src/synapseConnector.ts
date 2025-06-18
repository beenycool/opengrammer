/**
 * Synapse LLM Connector
 * Provides local model discovery, secure cloud configuration, and advanced text transformations
 */

import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

// Type definitions
export interface ModelDescriptor {
  id: string;
  name: string;
  type: 'local' | 'cloud';
  provider: string;
  status: 'available' | 'loading' | 'error';
  metadata?: {
    size?: string;
    parameters?: string;
    description?: string;
    capabilities?: string[];
  };
}

export interface CloudConfig {
  provider: string;
  apiKey: string;
}

export interface SummaryOptions {
  maxLength?: number;
  style?: 'bullet' | 'paragraph' | 'executive';
  focus?: 'key-points' | 'conclusions' | 'overview';
}

export interface TransformationResult {
  originalText: string;
  transformedText: string;
  confidence: number;
  metadata?: {
    model: string;
    processingTime: number;
    transformationType: string;
  };
}

// API Client interface for dependency injection
export interface APIClient {
  discoverModels(): Promise<ModelDescriptor[]>;
  callModel(modelId: string, prompt: string, options?: any): Promise<string>;
  validateApiKey(provider: string, apiKey: string): Promise<boolean>;
}

// Default API client implementation
class DefaultAPIClient implements APIClient {
  async discoverModels(): Promise<ModelDescriptor[]> {
    const models: ModelDescriptor[] = [];
    
    // Discover Ollama models
    try {
      const { stdout } = await execAsync('ollama list', { timeout: 5000 });
      const lines = stdout.split('\n').slice(1); // Skip header
      
      for (const line of lines) {
        if (line.trim()) {
          const parts = line.trim().split(/\s+/);
          const modelName = parts[0];
          const size = parts[1] || 'Unknown';
          
          if (modelName && !modelName.startsWith('NAME')) {
            models.push({
              id: `ollama:${modelName}`,
              name: modelName,
              type: 'local',
              provider: 'ollama',
              status: 'available',
              metadata: {
                size,
                parameters: this.extractParameters(modelName),
                description: `Ollama local model: ${modelName}`,
                capabilities: ['text-generation', 'completion', 'conversation']
              }
            });
          }
        }
      }
    } catch (error) {
      // Ollama not available - continue with other discovery methods
    }

    // Discover HuggingFace models
    const hfPath = path.join(os.homedir(), '.cache', 'huggingface', 'transformers');
    if (fs.existsSync(hfPath)) {
      try {
        const entries = fs.readdirSync(hfPath, { withFileTypes: true });
        const modelDirs = entries
          .filter(entry => entry.isDirectory())
          .map(entry => entry.name)
          .filter(name => this.isValidModelName(name));

        for (const modelDir of modelDirs) {
          models.push({
            id: `hf:${modelDir}`,
            name: modelDir,
            type: 'local',
            provider: 'huggingface',
            status: 'available',
            metadata: {
              description: `HuggingFace local model: ${modelDir}`,
              capabilities: ['text-generation', 'completion']
            }
          });
        }
      } catch (error) {
        // Continue if HF cache is not accessible
      }
    }

    return models;
  }

  async callModel(modelId: string, prompt: string, options: any = {}): Promise<string> {
    const [provider, modelName] = modelId.split(':', 2);
    
    if (provider === 'ollama') {
      return this.callOllamaModel(modelName, prompt, options);
    } else if (provider === 'openai') {
      return this.callOpenAIModel(modelName, prompt, options);
    } else if (provider === 'anthropic') {
      return this.callAnthropicModel(modelName, prompt, options);
    }
    
    throw new Error(`Unsupported model provider: ${provider}`);
  }

  async validateApiKey(provider: string, apiKey: string): Promise<boolean> {
    if (!apiKey || apiKey.length < 10) {
      return false;
    }

    try {
      switch (provider) {
        case 'openai':
          return this.validateOpenAIKey(apiKey);
        case 'anthropic':
          return this.validateAnthropicKey(apiKey);
        case 'cohere':
          return this.validateCohereKey(apiKey);
        default:
          return true; // Allow custom providers
      }
    } catch (error) {
      return false;
    }
  }

  private async callOllamaModel(modelName: string, prompt: string, options: any): Promise<string> {
    try {
      const requestData = {
        model: modelName,
        prompt: prompt,
        stream: false,
        ...options
      };

      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.response || '';
    } catch (error) {
      throw new Error(`Failed to call Ollama model: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async callOpenAIModel(modelName: string, prompt: string, options: any): Promise<string> {
    const apiKey = options.apiKey;
    if (!apiKey) {
      throw new Error('OpenAI API key required');
    }

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: modelName || 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: options.maxTokens || 1000,
          temperature: options.temperature || 0.7
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || '';
    } catch (error) {
      throw new Error(`Failed to call OpenAI model: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async callAnthropicModel(modelName: string, prompt: string, options: any): Promise<string> {
    const apiKey = options.apiKey;
    if (!apiKey) {
      throw new Error('Anthropic API key required');
    }

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: modelName || 'claude-3-sonnet-20240229',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: options.maxTokens || 1000
        })
      });

      if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.content?.[0]?.text || '';
    } catch (error) {
      throw new Error(`Failed to call Anthropic model: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async validateOpenAIKey(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async validateAnthropicKey(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-sonnet-20240229',
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 1
        })
      });
      return response.status !== 401;
    } catch {
      return false;
    }
  }

  private async validateCohereKey(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch('https://api.cohere.ai/v1/generate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'command',
          prompt: 'test',
          max_tokens: 1
        })
      });
      return response.status !== 401;
    } catch {
      return false;
    }
  }

  private extractParameters(modelName: string): string {
    const paramMatch = modelName.match(/(\d+[bm])/i);
    return paramMatch ? paramMatch[1].toUpperCase() : 'Unknown';
  }

  private isValidModelName(name: string): boolean {
    const validPatterns = [
      /gpt/i, /llama/i, /mistral/i, /phi/i, /gemma/i,
      /bert/i, /roberta/i, /t5/i, /flan/i, /opt/i
    ];
    return validPatterns.some(pattern => pattern.test(name));
  }
}

export class SynapseConnector {
  private apiClient: APIClient;
  private encryptionKey: string;
  private cloudConfigs: Map<string, CloudConfig> = new Map();
  private activeModel?: ModelDescriptor;

  constructor(apiClient?: APIClient) {
    this.apiClient = apiClient || new DefaultAPIClient();
    this.encryptionKey = this.getOrCreateEncryptionKey();
    this.loadCloudConfigs();
  }

  /**
   * Auto-discover available local LLM models
   * @returns Promise<ModelDescriptor[]> Array of discovered models
   */
  async discoverLocalModels(): Promise<ModelDescriptor[]> {
    try {
      const models = await this.apiClient.discoverModels();
      return models.filter(model => model.type === 'local');
    } catch (error) {
      console.warn('Failed to discover local models:', error instanceof Error ? error.message : String(error));
      return [];
    }
  }

  /**
   * Securely store cloud provider configuration
   * @param config CloudConfig with provider and API key
   */
  async setCloudConfig(config: CloudConfig): Promise<void> {
    if (!config.provider || !config.apiKey) {
      throw new Error('Provider and API key are required');
    }

    // Validate API key
    const isValid = await this.apiClient.validateApiKey(config.provider, config.apiKey);
    if (!isValid) {
      throw new Error('Invalid API key for provider');
    }

    // Encrypt and store
    const encryptedKey = this.encryptApiKey(config.apiKey);
    this.cloudConfigs.set(config.provider, {
      provider: config.provider,
      apiKey: encryptedKey
    });

    await this.saveCloudConfigs();
  }

  /**
   * Get decrypted cloud configuration
   * @param provider Provider name
   * @returns CloudConfig or undefined
   */
  getCloudConfig(provider: string): CloudConfig | undefined {
    const config = this.cloudConfigs.get(provider);
    if (!config) return undefined;

    return {
      provider: config.provider,
      apiKey: this.decryptApiKey(config.apiKey)
    };
  }

  /**
   * Rephrase text with specified style
   * @param text Input text to rephrase
   * @param style Target style (formal, casual, professional, creative)
   * @returns Promise<string> Rephrased text
   */
  async rephrase(text: string, style: string): Promise<string> {
    if (!text || !text.trim()) {
      throw new Error('Input text is required');
    }

    if (!style || !['formal', 'casual', 'professional', 'creative', 'academic', 'conversational'].includes(style)) {
      throw new Error('Invalid style. Must be one of: formal, casual, professional, creative, academic, conversational');
    }

    const prompt = `Please rephrase the following text in a ${style} style, maintaining the original meaning:

"${text}"

Rephrased text:`;

    try {
      const result = await this.callActiveModel(prompt);
      return result.trim();
    } catch (error) {
      throw new Error(`Failed to rephrase text: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Transform text tone
   * @param text Input text
   * @param tone Target tone (positive, negative, neutral, enthusiastic, cautious)
   * @returns Promise<string> Tone-transformed text
   */
  async transformTone(text: string, tone: string): Promise<string> {
    if (!text || !text.trim()) {
      throw new Error('Input text is required');
    }

    if (!tone || !['positive', 'negative', 'neutral', 'enthusiastic', 'cautious', 'confident', 'empathetic'].includes(tone)) {
      throw new Error('Invalid tone. Must be one of: positive, negative, neutral, enthusiastic, cautious, confident, empathetic');
    }

    const prompt = `Please rewrite the following text with a ${tone} tone, keeping the core message intact:

"${text}"

Rewritten text:`;

    try {
      const result = await this.callActiveModel(prompt);
      return result.trim();
    } catch (error) {
      throw new Error(`Failed to transform tone: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generate summary of text
   * @param text Input text to summarize
   * @param options Summary options
   * @returns Promise<string> Generated summary
   */
  async generateSummary(text: string, options: SummaryOptions = {}): Promise<string> {
    if (!text || !text.trim()) {
      throw new Error('Input text is required');
    }

    const {
      maxLength = 200,
      style = 'paragraph',
      focus = 'key-points'
    } = options;

    if (maxLength < 10 || maxLength > 1000) {
      throw new Error('maxLength must be between 10 and 1000 characters');
    }

    if (!['bullet', 'paragraph', 'executive'].includes(style)) {
      throw new Error('Invalid style. Must be one of: bullet, paragraph, executive');
    }

    if (!['key-points', 'conclusions', 'overview'].includes(focus)) {
      throw new Error('Invalid focus. Must be one of: key-points, conclusions, overview');
    }

    let prompt = `Please create a ${style}-style summary focusing on ${focus} of the following text. `;
    prompt += `Keep the summary under ${maxLength} characters:\n\n"${text}"\n\n`;
    
    if (style === 'bullet') {
      prompt += 'Summary (bullet points):';
    } else if (style === 'executive') {
      prompt += 'Executive Summary:';
    } else {
      prompt += 'Summary:';
    }

    try {
      const result = await this.callActiveModel(prompt);
      const summary = result.trim();
      
      // Ensure summary length constraint
      if (summary.length > maxLength) {
        return summary.substring(0, maxLength - 3) + '...';
      }
      
      return summary;
    } catch (error) {
      throw new Error(`Failed to generate summary: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Set the active model for transformations
   * @param model ModelDescriptor to set as active
   */
  setActiveModel(model: ModelDescriptor): void {
    this.activeModel = model;
  }

  /**
   * Get currently active model
   * @returns ModelDescriptor or undefined
   */
  getActiveModel(): ModelDescriptor | undefined {
    return this.activeModel;
  }

  /**
   * Test connection to active model
   * @returns Promise<boolean> Connection status
   */
  async testConnection(): Promise<boolean> {
    if (!this.activeModel) {
      return false;
    }

    try {
      await this.callActiveModel('Hello');
      return true;
    } catch {
      return false;
    }
  }

  // Private helper methods
  private async callActiveModel(prompt: string): Promise<string> {
    if (!this.activeModel) {
      throw new Error('No active model set. Please configure a model first.');
    }

    const options: any = {};
    
    if (this.activeModel.type === 'cloud') {
      const config = this.getCloudConfig(this.activeModel.provider);
      if (!config) {
        throw new Error(`No configuration found for provider: ${this.activeModel.provider}`);
      }
      options.apiKey = config.apiKey;
    }

    return await this.apiClient.callModel(this.activeModel.id, prompt, options);
  }

  private getOrCreateEncryptionKey(): string {
    const keyPath = path.join(os.homedir(), '.opengrammer', 'encryption.key');
    
    try {
      if (fs.existsSync(keyPath)) {
        return fs.readFileSync(keyPath, 'utf8');
      }
    } catch (error) {
      // Continue to create new key
    }

    // Create new encryption key
    const key = crypto.randomBytes(32).toString('hex');
    
    try {
      const keyDir = path.dirname(keyPath);
      if (!fs.existsSync(keyDir)) {
        fs.mkdirSync(keyDir, { recursive: true });
      }
      fs.writeFileSync(keyPath, key, { mode: 0o600 }); // Restricted permissions
    } catch (error) {
      console.error('Failed to save encryption key:', error);
    }

    return key;
  }

  private encryptApiKey(apiKey: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(this.encryptionKey.slice(0, 32)), iv);
    let encrypted = cipher.update(apiKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  private decryptApiKey(encryptedKey: string): string {
    const [ivHex, encrypted] = encryptedKey.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(this.encryptionKey.slice(0, 32)), iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  private async loadCloudConfigs(): Promise<void> {
    try {
      const configPath = path.join(os.homedir(), '.opengrammer', 'cloud-configs.json');
      if (fs.existsSync(configPath)) {
        const data = fs.readFileSync(configPath, 'utf8');
        const configs = JSON.parse(data);
        this.cloudConfigs = new Map(Object.entries(configs));
      }
    } catch (error) {
      console.error('Failed to load cloud configurations:', error);
    }
  }

  private async saveCloudConfigs(): Promise<void> {
    try {
      const configPath = path.join(os.homedir(), '.opengrammer', 'cloud-configs.json');
      const configDir = path.dirname(configPath);
      
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      const configs = Object.fromEntries(this.cloudConfigs);
      fs.writeFileSync(configPath, JSON.stringify(configs, null, 2), { mode: 0o600 });
    } catch (error) {
      console.error('Failed to save cloud configurations:', error);
    }
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.cloudConfigs.clear();
    this.activeModel = undefined;
  }
}

// Export default instance
export const synapseConnector = new SynapseConnector();