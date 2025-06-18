import { ISuggestionService, SuggestionConfig, AVAILABLE_MODELS } from './types/suggestion';
import { logger } from './logger';

/**
 * Core ML Suggestion Service Implementation
 * Provides code and text suggestions using configurable ML models
 */
export class SuggestionService implements ISuggestionService {
  private config: SuggestionConfig;
  private context: string;
  private isInitialized: boolean = false;

  constructor(config: SuggestionConfig) {
    this.config = this.validateConfig(config);
    this.context = 'SuggestionService';
  }

  /**
   * Initialize the suggestion service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      logger.info(`Initializing suggestion service - model: ${this.config.preferredModel}, maxLatency: ${this.config.maxLatencyMs}ms`, this.context);

      // Validate model availability
      await this.validateModel(this.config.preferredModel);
      
      this.isInitialized = true;
      logger.info('Suggestion service initialized successfully', this.context);
    } catch (error) {
      logger.error('Failed to initialize suggestion service', this.context, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Generate code suggestions based on context
   * @param context - Code context for suggestion generation
   * @returns Promise resolving to array of code suggestions
   */
  async suggestCode(context: string): Promise<string[]> {
    const startTime = performance.now();
    
    try {
      await this.ensureInitialized();
      
      if (!context || context.trim().length === 0) {
        logger.debug('Empty context provided for code suggestions');
        return [];
      }

      logger.debug(`Generating code suggestions - contextLength: ${context.length}`, this.context);

      // Mock implementation for demonstration
      // In a real implementation, this would call the ML model
      const suggestions = await this.generateCodeSuggestions(context);
      
      const latency = performance.now() - startTime;
      this.validateLatency(latency);
      
      logger.info(`Code suggestions generated - count: ${suggestions.length}, latency: ${latency.toFixed(2)}ms`, this.context);

      return suggestions;
    } catch (error) {
      const latency = performance.now() - startTime;
      logger.error(`Failed to generate code suggestions - error: ${error instanceof Error ? error.message : String(error)}, latency: ${latency.toFixed(2)}ms`, this.context);
      throw error;
    }
  }

  /**
   * Generate text suggestions based on token array
   * @param tokens - Array of tokenized text input
   * @returns Promise resolving to array of text suggestions
   */
  async suggestText(tokens: string[]): Promise<string[]> {
    const startTime = performance.now();
    
    try {
      await this.ensureInitialized();
      
      if (!tokens || tokens.length === 0) {
        logger.debug('Empty tokens provided for text suggestions');
        return [];
      }

      // Filter out invalid tokens
      const validTokens = tokens.filter(token => 
        token !== null && token !== undefined && typeof token === 'string' && token.trim().length > 0
      );

      if (validTokens.length === 0) {
        logger.debug('No valid tokens after filtering');
        return [];
      }

      logger.debug(`Generating text suggestions - tokenCount: ${validTokens.length}`, this.context);

      // Mock implementation for demonstration
      // In a real implementation, this would call the ML model
      const suggestions = await this.generateTextSuggestions(validTokens);
      
      const latency = performance.now() - startTime;
      this.validateLatency(latency);
      
      logger.info(`Text suggestions generated - count: ${suggestions.length}, latency: ${latency.toFixed(2)}ms`, this.context);

      return suggestions;
    } catch (error) {
      const latency = performance.now() - startTime;
      logger.error(`Failed to generate text suggestions - error: ${error instanceof Error ? error.message : String(error)}, latency: ${latency.toFixed(2)}ms`, this.context);
      throw error;
    }
  }

  /**
   * Update service configuration
   * @param newConfig - New configuration to apply
   */
  async updateConfig(newConfig: Partial<SuggestionConfig>): Promise<void> {
    const updatedConfig = { ...this.config, ...newConfig };
    this.config = this.validateConfig(updatedConfig);
    
    logger.info(`Configuration updated - model: ${this.config.preferredModel}, maxLatency: ${this.config.maxLatencyMs}ms`, this.context);
    
    // Reinitialize if model changed
    if (newConfig.preferredModel && newConfig.preferredModel !== this.config.preferredModel) {
      this.isInitialized = false;
      await this.initialize();
    }
  }

  /**
   * Get current service metrics
   */
  getMetrics(): { config: SuggestionConfig; isInitialized: boolean } {
    return {
      config: { ...this.config },
      isInitialized: this.isInitialized
    };
  }

  /**
   * Validate configuration parameters
   */
  private validateConfig(config: SuggestionConfig): SuggestionConfig {
    if (config.maxLatencyMs <= 0) {
      throw new Error('maxLatencyMs must be greater than 0');
    }
    
    if (config.maxErrorRatePercent <= 0 || config.maxErrorRatePercent >= 100) {
      throw new Error('maxErrorRatePercent must be between 0 and 100');
    }
    
    if (config.cacheTtlSeconds <= 0) {
      throw new Error('cacheTtlSeconds must be greater than 0');
    }
    
    if (!AVAILABLE_MODELS[config.preferredModel]) {
      throw new Error(`Invalid model: ${config.preferredModel}. Available models: ${Object.keys(AVAILABLE_MODELS).join(', ')}`);
    }

    return config;
  }

  /**
   * Validate model availability and requirements
   */
  private async validateModel(modelId: string): Promise<void> {
    const model = AVAILABLE_MODELS[modelId];
    if (!model) {
      throw new Error(`Model ${modelId} not available`);
    }

    // In a real implementation, would check GPU memory, model loading, etc.
    logger.debug(`Model validated - ${model.name}, memory: ${model.memoryRequirement}GB, latency: ${model.expectedLatencyMs}ms`, this.context);
  }

  /**
   * Ensure service is initialized before operations
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  /**
   * Validate response latency against configured threshold
   */
  private validateLatency(latencyMs: number): void {
    if (latencyMs > this.config.maxLatencyMs) {
      logger.warn(`Latency threshold exceeded - actual: ${latencyMs.toFixed(2)}ms, threshold: ${this.config.maxLatencyMs}ms`, this.context);
    }
  }

  /**
   * Generate code suggestions (mock implementation)
   * In production, this would interface with the actual ML model
   */
  private async generateCodeSuggestions(context: string): Promise<string[]> {
    // Simulate processing time based on model configuration
    const model = AVAILABLE_MODELS[this.config.preferredModel];
    const processingTime = Math.min(model.expectedLatencyMs * 0.8, this.config.maxLatencyMs * 0.8);
    
    await new Promise(resolve => setTimeout(resolve, processingTime));

    const suggestions: string[] = [];
    const contextWords = context.toLowerCase().split(/\s+/);
    const lastWord = contextWords[contextWords.length - 1];

    // Generate function-based suggestions
    if (context.includes('function') || context.includes('def') || context.includes('const')) {
      suggestions.push(
        `function ${lastWord}Handler() {\n  // Implementation here\n  return true;\n}`,
        `const ${lastWord}Async = async () => {\n  try {\n    // Async implementation\n  } catch (error) {\n    console.error(error);\n  }\n};`,
        `function validate${capitalize(lastWord)}(input) {\n  return input && typeof input === 'string';\n}`
      );
    }

    // Generate class-based suggestions
    if (context.includes('class') || context.includes('interface')) {
      suggestions.push(
        `class ${capitalize(lastWord)} {\n  constructor() {\n    this.initialized = false;\n  }\n\n  init() {\n    this.initialized = true;\n  }\n}`,
        `interface I${capitalize(lastWord)} {\n  id: string;\n  name: string;\n  isActive: boolean;\n}`,
        `class ${capitalize(lastWord)}Manager {\n  private items: ${capitalize(lastWord)}[] = [];\n\n  add(item: ${capitalize(lastWord)}) {\n    this.items.push(item);\n  }\n}`
      );
    }

    // Generate variable/constant suggestions
    if (context.includes('let') || context.includes('var') || context.includes('const')) {
      suggestions.push(
        `const ${lastWord}Config = {\n  enabled: true,\n  timeout: 5000\n};`,
        `let ${lastWord}State = {\n  loading: false,\n  error: null,\n  data: null\n};`,
        `const ${lastWord}Utils = {\n  validate: (input) => Boolean(input),\n  format: (input) => String(input).trim()\n};`
      );
    }

    // Ensure we have at least some suggestions
    if (suggestions.length === 0) {
      suggestions.push(
        `// ${lastWord} implementation`,
        `const ${lastWord} = null;`,
        `function process${capitalize(lastWord)}() { /* TODO */ }`
      );
    }

    return suggestions.slice(0, 5); // Limit to 5 suggestions
  }

  /**
   * Generate text suggestions (mock implementation)
   * In production, this would interface with the actual ML model
   */
  private async generateTextSuggestions(tokens: string[]): Promise<string[]> {
    // Simulate processing time based on model configuration
    const model = AVAILABLE_MODELS[this.config.preferredModel];
    const processingTime = Math.min(model.expectedLatencyMs * 0.6, this.config.maxLatencyMs * 0.6);
    
    await new Promise(resolve => setTimeout(resolve, processingTime));

    const suggestions: string[] = [];
    const lastToken = tokens[tokens.length - 1];
    const context = tokens.join(' ');

    // Context-aware suggestions
    if (tokens.length >= 2) {
      const secondLastToken = tokens[tokens.length - 2];
      
      // Common word combinations
      const commonCombinations: Record<string, string[]> = {
        'the': ['quick', 'best', 'most', 'only', 'first'],
        'in': ['order', 'case', 'time', 'fact', 'summary'],
        'to': ['be', 'do', 'make', 'get', 'have'],
        'of': ['the', 'this', 'that', 'course', 'all'],
        'and': ['then', 'also', 'finally', 'therefore', 'thus']
      };

      if (commonCombinations[secondLastToken]) {
        commonCombinations[secondLastToken].forEach(suggestion => {
          suggestions.push(`${context} ${suggestion}`);
        });
      }
    }

    // Generate contextual completions
    suggestions.push(
      `${lastToken} completion`,
      `${lastToken} example`,
      `${lastToken} implementation`,
      `${lastToken} solution`,
      `${lastToken} approach`
    );

    // Add sentence completions if context suggests it
    if (context.length > 10 && !context.endsWith('.')) {
      suggestions.push(
        `${context} and continue processing.`,
        `${context} for better results.`,
        `${context} as needed.`
      );
    }

    return suggestions.slice(0, 5); // Limit to 5 suggestions
  }
}

/**
 * Utility function to capitalize first letter
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Factory function to create suggestion service with default configuration
 */
export function createSuggestionService(overrides?: Partial<SuggestionConfig>): SuggestionService {
  const defaultConfig: SuggestionConfig = {
    maxLatencyMs: 200,
    maxErrorRatePercent: 5,
    cacheTtlSeconds: 300,
    piiDetectionEnabled: true,
    preferredModel: 'distilgpt2'
  };

  const config = { ...defaultConfig, ...overrides };
  return new SuggestionService(config);
}