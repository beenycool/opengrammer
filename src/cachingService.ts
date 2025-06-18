import { ICachingService, CacheStats } from './types/suggestion';
import { logger } from './logger';

/**
 * Caching Service Implementation
 * Provides in-memory caching with TTL support for ML suggestions
 */
export class CachingService implements ICachingService {
  private context: string = 'CachingService';
  private cache: Map<string, CacheEntry> = new Map();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    hitRatio: 0,
    entries: 0,
    memoryUsage: 0
  };
  private defaultTtlSeconds: number;
  private maxCacheSize: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(defaultTtlSeconds: number = 300, maxCacheSize: number = 1000) {
    this.defaultTtlSeconds = defaultTtlSeconds;
    this.maxCacheSize = maxCacheSize;
    
    // Start cleanup interval to remove expired entries
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, 60000); // Run every minute
    
    logger.info(`Caching service initialized - TTL: ${defaultTtlSeconds}s, maxSize: ${maxCacheSize}`, this.context);
  }

  /**
   * Retrieve cached suggestions
   * @param key - Cache key
   * @returns Cached suggestions or null if not found
   */
  async get(key: string): Promise<string[] | null> {
    if (!key || key.trim().length === 0) {
      return null;
    }

    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      this.updateHitRatio();
      logger.debug(`Cache miss for key: ${key}`, this.context);
      return null;
    }

    // Check if entry has expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      this.updateHitRatio();
      logger.debug(`Cache expired for key: ${key}`, this.context);
      return null;
    }

    // Update access time for LRU-like behavior
    entry.lastAccessedAt = Date.now();
    this.stats.hits++;
    this.updateHitRatio();
    
    logger.debug(`Cache hit for key: ${key}, suggestions: ${entry.suggestions.length}`, this.context);
    return [...entry.suggestions]; // Return a copy to prevent modification
  }

  /**
   * Store suggestions in cache
   * @param key - Cache key
   * @param suggestions - Suggestions to cache
   * @param ttlSeconds - Time to live in seconds
   */
  async set(key: string, suggestions: string[], ttlSeconds?: number): Promise<void> {
    if (!key || key.trim().length === 0) {
      throw new Error('Cache key cannot be empty');
    }

    if (!suggestions || suggestions.length === 0) {
      logger.debug(`Not caching empty suggestions for key: ${key}`, this.context);
      return;
    }

    const ttl = ttlSeconds || this.defaultTtlSeconds;
    const now = Date.now();
    
    const entry: CacheEntry = {
      key,
      suggestions: [...suggestions], // Store a copy
      createdAt: now,
      lastAccessedAt: now,
      expiresAt: now + (ttl * 1000),
      ttlSeconds: ttl
    };

    // Check if we need to evict entries to make room
    if (this.cache.size >= this.maxCacheSize && !this.cache.has(key)) {
      await this.evictLeastRecentlyUsed();
    }

    this.cache.set(key, entry);
    this.updateStats();
    
    logger.debug(`Cached ${suggestions.length} suggestions for key: ${key}, TTL: ${ttl}s`, this.context);
  }

  /**
   * Invalidate cache entry
   * @param key - Cache key to invalidate
   */
  async invalidate(key: string): Promise<void> {
    if (!key || key.trim().length === 0) {
      return;
    }

    const existed = this.cache.delete(key);
    if (existed) {
      this.updateStats();
      logger.debug(`Invalidated cache entry for key: ${key}`, this.context);
    }
  }

  /**
   * Clear all cached entries
   */
  async clear(): Promise<void> {
    const entriesCleared = this.cache.size;
    this.cache.clear();
    this.resetStats();
    
    logger.info(`Cache cleared - ${entriesCleared} entries removed`, this.context);
  }

  /**
   * Get cache statistics
   * @returns Cache hit/miss statistics
   */
  async getStats(): Promise<CacheStats> {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * Update cache configuration
   * @param config - New cache configuration
   */
  updateConfig(config: {
    defaultTtlSeconds?: number;
    maxCacheSize?: number;
  }): void {
    if (config.defaultTtlSeconds !== undefined) {
      this.defaultTtlSeconds = config.defaultTtlSeconds;
    }
    
    if (config.maxCacheSize !== undefined) {
      this.maxCacheSize = config.maxCacheSize;
      
      // Evict entries if current size exceeds new limit
      while (this.cache.size > this.maxCacheSize) {
        this.evictLeastRecentlyUsed();
      }
    }
    
    logger.info(`Cache configuration updated - TTL: ${this.defaultTtlSeconds}s, maxSize: ${this.maxCacheSize}`, this.context);
  }

  /**
   * Get cache keys matching a pattern
   * @param pattern - Regular expression pattern
   * @returns Array of matching keys
   */
  getKeysMatching(pattern: RegExp): string[] {
    const matchingKeys: string[] = [];
    
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        matchingKeys.push(key);
      }
    }
    
    return matchingKeys;
  }

  /**
   * Cleanup expired entries
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now();
    let expiredCount = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        expiredCount++;
      }
    }
    
    if (expiredCount > 0) {
      this.updateStats();
      logger.debug(`Cleaned up ${expiredCount} expired cache entries`, this.context);
    }
  }

  /**
   * Evict least recently used entry
   */
  private async evictLeastRecentlyUsed(): Promise<void> {
    if (this.cache.size === 0) {
      return;
    }

    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessedAt < oldestTime) {
        oldestTime = entry.lastAccessedAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      logger.debug(`Evicted LRU cache entry: ${oldestKey}`, this.context);
    }
  }

  /**
   * Update cache statistics
   */
  private updateStats(): void {
    this.stats.entries = this.cache.size;
    this.updateHitRatio();
    this.updateMemoryUsage();
  }

  /**
   * Update hit ratio calculation
   */
  private updateHitRatio(): void {
    const totalRequests = this.stats.hits + this.stats.misses;
    this.stats.hitRatio = totalRequests > 0 ? this.stats.hits / totalRequests : 0;
  }

  /**
   * Estimate memory usage of cache
   */
  private updateMemoryUsage(): void {
    let totalSize = 0;
    
    for (const entry of this.cache.values()) {
      // Rough estimation of memory usage
      totalSize += entry.key.length * 2; // String characters (UTF-16)
      totalSize += entry.suggestions.reduce((sum, suggestion) => sum + suggestion.length * 2, 0);
      totalSize += 64; // Overhead for entry object
    }
    
    this.stats.memoryUsage = totalSize;
  }

  /**
   * Reset statistics
   */
  private resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      hitRatio: 0,
      entries: 0,
      memoryUsage: 0
    };
  }

  /**
   * Cleanup resources when service is destroyed
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    this.cache.clear();
    logger.info('Caching service destroyed', this.context);
  }

  /**
   * Generate cache key from input parameters
   * @param type - Suggestion type
   * @param input - Input text or tokens
   * @param model - Model identifier
   * @returns Generated cache key
   */
  static generateKey(type: 'code' | 'text', input: string | string[], model: string): string {
    const inputStr = Array.isArray(input) ? input.join(' ') : input;
    const hash = require('crypto').createHash('md5').update(inputStr).digest('hex').substring(0, 8);
    return `${type}:${model}:${hash}`;
  }
}

/**
 * Cache entry interface
 */
interface CacheEntry {
  key: string;
  suggestions: string[];
  createdAt: number;
  lastAccessedAt: number;
  expiresAt: number;
  ttlSeconds: number;
}

/**
 * Factory function to create caching service
 * @param defaultTtlSeconds - Default TTL in seconds
 * @param maxCacheSize - Maximum number of cache entries
 * @returns CachingService instance
 */
export function createCachingService(defaultTtlSeconds?: number, maxCacheSize?: number): CachingService {
  return new CachingService(defaultTtlSeconds, maxCacheSize);
}