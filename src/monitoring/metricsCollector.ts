import { IMetricsCollector, SuggestionMetrics } from '../types/suggestion';
import { logger } from '../logger';

/**
 * Metrics Collector Implementation
 * Collects and tracks performance metrics for suggestion services
 * Based on responses_LS11.md monitoring requirements
 */
export class MetricsCollector implements IMetricsCollector {
  private context: string = 'MetricsCollector';
  private metrics: InternalMetrics;
  private alertThresholds: AlertThresholds;
  private latencyWindow: number[] = [];
  private maxWindowSize: number = 1000;

  constructor(alertThresholds?: Partial<AlertThresholds>) {
    this.metrics = this.initializeMetrics();
    this.alertThresholds = {
      maxLatencyMs: 200,
      maxErrorRatePercent: 5,
      ...alertThresholds
    };
    
    logger.info(`Metrics collector initialized - latency threshold: ${this.alertThresholds.maxLatencyMs}ms, error rate threshold: ${this.alertThresholds.maxErrorRatePercent}%`, this.context);
  }

  /**
   * Record suggestion request latency
   * @param latencyMs - Request latency in milliseconds
   */
  recordLatency(latencyMs: number): void {
    if (latencyMs < 0) {
      logger.warn(`Invalid latency value: ${latencyMs}ms`, this.context);
      return;
    }

    this.metrics.latencies.push(latencyMs);
    this.latencyWindow.push(latencyMs);
    
    // Maintain sliding window
    if (this.latencyWindow.length > this.maxWindowSize) {
      this.latencyWindow.shift();
    }

    // Update min/max
    this.metrics.minLatencyMs = Math.min(this.metrics.minLatencyMs, latencyMs);
    this.metrics.maxLatencyMs = Math.max(this.metrics.maxLatencyMs, latencyMs);

    // Check alert threshold
    if (latencyMs > this.alertThresholds.maxLatencyMs) {
      this.triggerLatencyAlert(latencyMs);
    }

    logger.debug(`Recorded latency: ${latencyMs.toFixed(2)}ms`, this.context);
  }

  /**
   * Record suggestion request error
   * @param error - Error that occurred
   */
  recordError(error: Error): void {
    this.metrics.totalRequests++;
    this.metrics.failedRequests++;
    this.metrics.errors.push({
      message: error.message,
      timestamp: Date.now(),
      stack: error.stack
    });

    const currentErrorRate = this.calculateErrorRate();
    
    // Check alert threshold
    if (currentErrorRate > this.alertThresholds.maxErrorRatePercent) {
      this.triggerErrorRateAlert(currentErrorRate);
    }

    logger.error(`Recorded error: ${error.message}`, this.context, error);
  }

  /**
   * Record successful suggestion request
   * @param suggestionCount - Number of suggestions returned
   */
  recordSuccess(suggestionCount: number): void {
    this.metrics.totalRequests++;
    this.metrics.successfulRequests++;
    this.metrics.totalSuggestions += suggestionCount;

    logger.debug(`Recorded success: ${suggestionCount} suggestions`, this.context);
  }

  /**
   * Get current metrics
   * @returns Current performance metrics
   */
  async getMetrics(): Promise<SuggestionMetrics> {
    const averageLatency = this.calculateAverageLatency();
    const errorRate = this.calculateErrorRate();
    const cacheHitRatio = this.metrics.cacheHits / Math.max(this.metrics.cacheRequests, 1);

    return {
      averageLatencyMs: averageLatency,
      errorRatePercent: errorRate,
      totalRequests: this.metrics.totalRequests,
      successfulRequests: this.metrics.successfulRequests,
      failedRequests: this.metrics.failedRequests,
      cacheHitRatio: cacheHitRatio,
      timestamp: new Date()
    };
  }

  /**
   * Record cache hit
   */
  recordCacheHit(): void {
    this.metrics.cacheRequests++;
    this.metrics.cacheHits++;
    logger.debug('Cache hit recorded', this.context);
  }

  /**
   * Record cache miss
   */
  recordCacheMiss(): void {
    this.metrics.cacheRequests++;
    this.metrics.cacheMisses++;
    logger.debug('Cache miss recorded', this.context);
  }

  /**
   * Get detailed performance statistics
   * @returns Detailed metrics including percentiles
   */
  getDetailedMetrics(): DetailedMetrics {
    const latencies = [...this.latencyWindow].sort((a, b) => a - b);
    
    return {
      latency: {
        average: this.calculateAverageLatency(),
        min: this.metrics.minLatencyMs,
        max: this.metrics.maxLatencyMs,
        p50: this.calculatePercentile(latencies, 50),
        p90: this.calculatePercentile(latencies, 90),
        p95: this.calculatePercentile(latencies, 95),
        p99: this.calculatePercentile(latencies, 99)
      },
      errors: {
        rate: this.calculateErrorRate(),
        total: this.metrics.failedRequests,
        recent: this.getRecentErrors(300000) // Last 5 minutes
      },
      cache: {
        hitRatio: this.metrics.cacheHits / Math.max(this.metrics.cacheRequests, 1),
        hits: this.metrics.cacheHits,
        misses: this.metrics.cacheMisses
      },
      suggestions: {
        total: this.metrics.totalSuggestions,
        averagePerRequest: this.metrics.totalSuggestions / Math.max(this.metrics.successfulRequests, 1)
      },
      requests: {
        total: this.metrics.totalRequests,
        successful: this.metrics.successfulRequests,
        failed: this.metrics.failedRequests,
        successRate: (this.metrics.successfulRequests / Math.max(this.metrics.totalRequests, 1)) * 100
      }
    };
  }

  /**
   * Reset all metrics
   */
  resetMetrics(): void {
    this.metrics = this.initializeMetrics();
    this.latencyWindow = [];
    logger.info('Metrics reset', this.context);
  }

  /**
   * Update alert thresholds
   * @param thresholds - New alert thresholds
   */
  updateAlertThresholds(thresholds: Partial<AlertThresholds>): void {
    this.alertThresholds = { ...this.alertThresholds, ...thresholds };
    logger.info(`Alert thresholds updated - latency: ${this.alertThresholds.maxLatencyMs}ms, error rate: ${this.alertThresholds.maxErrorRatePercent}%`, this.context);
  }

  /**
   * Export metrics for external monitoring systems
   * @param format - Export format
   * @returns Formatted metrics string
   */
  exportMetrics(format: 'json' | 'prometheus' = 'json'): string {
    const metrics = this.getDetailedMetrics();
    
    if (format === 'prometheus') {
      return this.formatPrometheusMetrics(metrics);
    }
    
    return JSON.stringify(metrics, null, 2);
  }

  /**
   * Calculate average latency from recorded latencies
   */
  private calculateAverageLatency(): number {
    if (this.latencyWindow.length === 0) {
      return 0;
    }
    
    const sum = this.latencyWindow.reduce((acc, latency) => acc + latency, 0);
    return sum / this.latencyWindow.length;
  }

  /**
   * Calculate current error rate as percentage
   */
  private calculateErrorRate(): number {
    if (this.metrics.totalRequests === 0) {
      return 0;
    }
    
    return (this.metrics.failedRequests / this.metrics.totalRequests) * 100;
  }

  /**
   * Calculate percentile from sorted array
   */
  private calculatePercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) {
      return 0;
    }
    
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)];
  }

  /**
   * Get recent errors within time window
   */
  private getRecentErrors(timeWindowMs: number): ErrorEntry[] {
    const cutoff = Date.now() - timeWindowMs;
    return this.metrics.errors.filter(error => error.timestamp > cutoff);
  }

  /**
   * Trigger latency alert
   */
  private triggerLatencyAlert(latencyMs: number): void {
    logger.warn(`Latency alert triggered - ${latencyMs.toFixed(2)}ms exceeds threshold of ${this.alertThresholds.maxLatencyMs}ms`, this.context);
    
    // In a production system, this would integrate with alerting systems
    // such as PagerDuty, Slack, or email notifications
  }

  /**
   * Trigger error rate alert
   */
  private triggerErrorRateAlert(errorRate: number): void {
    logger.warn(`Error rate alert triggered - ${errorRate.toFixed(2)}% exceeds threshold of ${this.alertThresholds.maxErrorRatePercent}%`, this.context);
    
    // In a production system, this would integrate with alerting systems
  }

  /**
   * Initialize metrics structure
   */
  private initializeMetrics(): InternalMetrics {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalSuggestions: 0,
      latencies: [],
      minLatencyMs: Infinity,
      maxLatencyMs: 0,
      cacheRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: []
    };
  }

  /**
   * Format metrics for Prometheus monitoring
   */
  private formatPrometheusMetrics(metrics: DetailedMetrics): string {
    return `
# HELP suggestion_latency_ms Request latency in milliseconds
# TYPE suggestion_latency_ms histogram
suggestion_latency_average_ms ${metrics.latency.average}
suggestion_latency_p50_ms ${metrics.latency.p50}
suggestion_latency_p90_ms ${metrics.latency.p90}
suggestion_latency_p95_ms ${metrics.latency.p95}
suggestion_latency_p99_ms ${metrics.latency.p99}

# HELP suggestion_requests_total Total number of requests
# TYPE suggestion_requests_total counter
suggestion_requests_total ${metrics.requests.total}

# HELP suggestion_requests_successful_total Successful requests
# TYPE suggestion_requests_successful_total counter
suggestion_requests_successful_total ${metrics.requests.successful}

# HELP suggestion_requests_failed_total Failed requests
# TYPE suggestion_requests_failed_total counter
suggestion_requests_failed_total ${metrics.requests.failed}

# HELP suggestion_error_rate_percent Error rate percentage
# TYPE suggestion_error_rate_percent gauge
suggestion_error_rate_percent ${metrics.errors.rate}

# HELP suggestion_cache_hit_ratio Cache hit ratio
# TYPE suggestion_cache_hit_ratio gauge
suggestion_cache_hit_ratio ${metrics.cache.hitRatio}
`.trim();
  }
}

/**
 * Internal metrics structure
 */
interface InternalMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalSuggestions: number;
  latencies: number[];
  minLatencyMs: number;
  maxLatencyMs: number;
  cacheRequests: number;
  cacheHits: number;
  cacheMisses: number;
  errors: ErrorEntry[];
}

/**
 * Error entry structure
 */
interface ErrorEntry {
  message: string;
  timestamp: number;
  stack?: string;
}

/**
 * Alert thresholds configuration
 */
interface AlertThresholds {
  maxLatencyMs: number;
  maxErrorRatePercent: number;
}

/**
 * Detailed metrics structure
 */
interface DetailedMetrics {
  latency: {
    average: number;
    min: number;
    max: number;
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  };
  errors: {
    rate: number;
    total: number;
    recent: ErrorEntry[];
  };
  cache: {
    hitRatio: number;
    hits: number;
    misses: number;
  };
  suggestions: {
    total: number;
    averagePerRequest: number;
  };
  requests: {
    total: number;
    successful: number;
    failed: number;
    successRate: number;
  };
}

/**
 * Factory function to create metrics collector
 * @param alertThresholds - Alert threshold configuration
 * @returns MetricsCollector instance
 */
export function createMetricsCollector(alertThresholds?: Partial<AlertThresholds>): MetricsCollector {
  return new MetricsCollector(alertThresholds);
}