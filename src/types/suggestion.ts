/**
 * Type definitions for ML Suggestion Service
 * Defines interfaces and types for suggestion generation, privacy, and caching
 */

/**
 * Core suggestion service interface
 * Corrected based on reflection feedback to accept token arrays
 */
export interface ISuggestionService {
  /**
   * Generate code suggestions based on context
   * @param context - Code context for suggestion generation
   * @returns Promise resolving to array of code suggestions
   */
  suggestCode(context: string): Promise<string[]>;

  /**
   * Generate text suggestions based on token array
   * @param tokens - Array of tokenized text input
   * @returns Promise resolving to array of text suggestions
   */
  suggestText(tokens: string[]): Promise<string[]>;
}

/**
 * Configuration for suggestion service
 */
export interface SuggestionConfig {
  /** Maximum response latency in milliseconds */
  maxLatencyMs: number;
  /** Maximum acceptable error rate as percentage */
  maxErrorRatePercent: number;
  /** Cache TTL in seconds */
  cacheTtlSeconds: number;
  /** Enable/disable PII detection */
  piiDetectionEnabled: boolean;
  /** Model selection preference */
  preferredModel: 'distilgpt2' | 'gpt-neo-1.3b' | 'gpt-neo-2.7b' | 't5-small' | 't5-base';
}

/**
 * Privacy service interface for PII detection and anonymization
 */
export interface IPrivacyService {
  /**
   * Detect and anonymize PII in text
   * @param text - Input text to process
   * @returns Anonymized text with PII replaced
   */
  anonymizeText(text: string): Promise<string>;

  /**
   * Detect PII entities in text
   * @param text - Input text to analyze
   * @returns Array of detected PII entities
   */
  detectPII(text: string): Promise<PIIEntity[]>;

  /**
   * Encrypt data for storage
   * @param data - Data to encrypt
   * @returns Encrypted data string
   */
  encryptData(data: string): Promise<string>;

  /**
   * Decrypt stored data
   * @param encryptedData - Encrypted data to decrypt
   * @returns Original data string
   */
  decryptData(encryptedData: string): Promise<string>;
}

/**
 * PII entity detected in text
 */
export interface PIIEntity {
  /** Type of PII (email, name, phone, etc.) */
  type: 'email' | 'name' | 'phone' | 'address' | 'ssn' | 'other';
  /** Original text that was detected */
  text: string;
  /** Start position in original text */
  start: number;
  /** End position in original text */
  end: number;
  /** Confidence score (0-1) */
  confidence: number;
}

/**
 * Caching service interface for suggestion storage
 */
export interface ICachingService {
  /**
   * Retrieve cached suggestions
   * @param key - Cache key
   * @returns Cached suggestions or null if not found
   */
  get(key: string): Promise<string[] | null>;

  /**
   * Store suggestions in cache
   * @param key - Cache key
   * @param suggestions - Suggestions to cache
   * @param ttlSeconds - Time to live in seconds
   */
  set(key: string, suggestions: string[], ttlSeconds?: number): Promise<void>;

  /**
   * Invalidate cache entry
   * @param key - Cache key to invalidate
   */
  invalidate(key: string): Promise<void>;

  /**
   * Clear all cached entries
   */
  clear(): Promise<void>;

  /**
   * Get cache statistics
   * @returns Cache hit/miss statistics
   */
  getStats(): Promise<CacheStats>;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  /** Total cache hits */
  hits: number;
  /** Total cache misses */
  misses: number;
  /** Hit ratio (0-1) */
  hitRatio: number;
  /** Total entries in cache */
  entries: number;
  /** Cache memory usage in bytes */
  memoryUsage: number;
}

/**
 * Metrics collector interface for monitoring
 */
export interface IMetricsCollector {
  /**
   * Record suggestion request latency
   * @param latencyMs - Request latency in milliseconds
   */
  recordLatency(latencyMs: number): void;

  /**
   * Record suggestion request error
   * @param error - Error that occurred
   */
  recordError(error: Error): void;

  /**
   * Record successful suggestion request
   * @param suggestionCount - Number of suggestions returned
   */
  recordSuccess(suggestionCount: number): void;

  /**
   * Get current metrics
   * @returns Current performance metrics
   */
  getMetrics(): Promise<SuggestionMetrics>;
}

/**
 * Suggestion service metrics
 */
export interface SuggestionMetrics {
  /** Average response latency in milliseconds */
  averageLatencyMs: number;
  /** Current error rate as percentage */
  errorRatePercent: number;
  /** Total requests processed */
  totalRequests: number;
  /** Successful requests */
  successfulRequests: number;
  /** Failed requests */
  failedRequests: number;
  /** Cache hit ratio */
  cacheHitRatio: number;
  /** Timestamp of metrics */
  timestamp: Date;
}

/**
 * Suggestion request context
 */
export interface SuggestionContext {
  /** Input text or tokens */
  input: string | string[];
  /** Type of suggestion requested */
  type: 'code' | 'text';
  /** Language context (for code suggestions) */
  language?: string;
  /** Maximum number of suggestions to return */
  maxSuggestions?: number;
  /** Additional context metadata */
  metadata?: Record<string, any>;
}

/**
 * Suggestion response
 */
export interface SuggestionResponse {
  /** Generated suggestions */
  suggestions: string[];
  /** Response metadata */
  metadata: {
    /** Time taken to generate suggestions */
    latencyMs: number;
    /** Whether result was served from cache */
    fromCache: boolean;
    /** Model used for generation */
    model: string;
    /** Confidence scores for suggestions */
    confidenceScores?: number[];
  };
}

/**
 * Model configuration for different ML models
 */
export interface ModelConfig {
  /** Model identifier */
  id: string;
  /** Display name */
  name: string;
  /** Model size in parameters */
  parameters: string;
  /** Required GPU memory in GB */
  memoryRequirement: number;
  /** Expected accuracy score */
  accuracyScore: number;
  /** Expected latency in ms */
  expectedLatencyMs: number;
  /** Model type */
  type: 'generative' | 'discriminative' | 'encoder-decoder';
}

/**
 * Available ML models configuration
 */
export const AVAILABLE_MODELS: Record<string, ModelConfig> = {
  'distilgpt2': {
    id: 'distilgpt2',
    name: 'DistilGPT2 (0.8B)',
    parameters: '0.8B',
    memoryRequirement: 4,
    accuracyScore: 0.82,
    expectedLatencyMs: 150,
    type: 'generative'
  },
  'gpt-neo-1.3b': {
    id: 'gpt-neo-1.3b',
    name: 'GPT-Neo (1.3B)',
    parameters: '1.3B',
    memoryRequirement: 8,
    accuracyScore: 0.88,
    expectedLatencyMs: 200,
    type: 'generative'
  },
  'gpt-neo-2.7b': {
    id: 'gpt-neo-2.7b',
    name: 'GPT-Neo (2.7B)',
    parameters: '2.7B',
    memoryRequirement: 12,
    accuracyScore: 0.91,
    expectedLatencyMs: 250,
    type: 'generative'
  },
  't5-small': {
    id: 't5-small',
    name: 'T5 (Small)',
    parameters: '60M',
    memoryRequirement: 6,
    accuracyScore: 0.85,
    expectedLatencyMs: 180,
    type: 'encoder-decoder'
  },
  't5-base': {
    id: 't5-base',
    name: 'T5 (Base)',
    parameters: '220M',
    memoryRequirement: 10,
    accuracyScore: 0.89,
    expectedLatencyMs: 220,
    type: 'encoder-decoder'
  }
};