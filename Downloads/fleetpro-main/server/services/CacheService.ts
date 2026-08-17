import RedisService, { getRedisService } from './RedisService';
import InMemoryCacheService, {
  getInMemoryCacheService,
} from './InMemoryCacheService';

type CacheServiceType = RedisService | InMemoryCacheService;

/**
 * Unified Cache Service - Automatically selects Redis or In-Memory cache
 * Provides a single interface for both implementations
 */
class CacheService {
  private cache: CacheServiceType | null = null;
  private cacheType: 'redis' | 'memory' | null = null;

  /**
   * Initialize cache service
   * Tries Redis first, falls back to In-Memory if Redis unavailable
   */
  async initialize(): Promise<void> {
    // Try Redis first
    try {
      const redis = getRedisService({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0'),
        clusterMode: process.env.REDIS_CLUSTER_MODE === 'true',
      });

      await redis.connect();
      this.cache = redis;
      this.cacheType = 'redis';

      return;
    } catch (error: any) {
      console.warn('⚠️ Redis unavailable, falling back to In-Memory Cache');
      console.warn(`   Error: ${error.message}`);
    }

    // Fallback to In-Memory
    const memory = getInMemoryCacheService();
    await memory.connect();
    this.cache = memory;
    this.cacheType = 'memory';

  }

  /**
   * Get current cache type
   */
  getCacheType(): 'redis' | 'memory' | null {
    return this.cacheType;
  }

  /**
   * Check if using Redis
   */
  isRedis(): boolean {
    return this.cacheType === 'redis';
  }

  /**
   * Check if using In-Memory cache
   */
  isMemory(): boolean {
    return this.cacheType === 'memory';
  }

  /**
   * Ensure cache is initialized
   */
  private ensureInitialized(): void {
    if (!this.cache) {
      throw new Error('Cache service not initialized. Call initialize() first.');
    }
  }

  // ===== Core Operations =====

  /**
   * Set a key-value pair with optional TTL (seconds)
   */
  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    this.ensureInitialized();
    return this.cache!.set(key, value, ttlSeconds);
  }

  /**
   * Get a value by key
   */
  async get(key: string): Promise<any> {
    this.ensureInitialized();
    return this.cache!.get(key);
  }

  /**
   * Get multiple values
   */
  async mGet(keys: string[]): Promise<(any | null)[]> {
    this.ensureInitialized();
    return this.cache!.mGet(keys);
  }

  /**
   * Delete a key
   */
  async delete(key: string): Promise<number> {
    this.ensureInitialized();
    return this.cache!.delete(key);
  }

  /**
   * Delete multiple keys
   */
  async mDelete(keys: string[]): Promise<number> {
    this.ensureInitialized();
    return this.cache!.mDelete(keys);
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    this.ensureInitialized();
    return this.cache!.exists(key);
  }

  /**
   * Set TTL on existing key
   */
  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    this.ensureInitialized();
    return this.cache!.expire(key, ttlSeconds);
  }

  /**
   * Get TTL of key
   */
  async ttl(key: string): Promise<number> {
    this.ensureInitialized();
    return this.cache!.ttl(key);
  }

  /**
   * Clear all keys
   */
  async flushDb(): Promise<void> {
    this.ensureInitialized();
    return this.cache!.flushDb();
  }

  // ===== Counter Operations =====

  /**
   * Increment a counter
   */
  async increment(key: string, amount: number = 1): Promise<number> {
    this.ensureInitialized();
    return this.cache!.increment(key, amount);
  }

  /**
   * Decrement a counter
   */
  async decrement(key: string, amount: number = 1): Promise<number> {
    this.ensureInitialized();
    return this.cache!.decrement(key, amount);
  }

  // ===== Pub/Sub Operations =====

  /**
   * Publish message to channel
   */
  async publish(channel: string, message: any): Promise<number> {
    this.ensureInitialized();
    return this.cache!.publish(channel, message);
  }

  /**
   * Subscribe to channel
   */
  async subscribe(
    channel: string,
    callback: (message: any) => void
  ): Promise<void> {
    this.ensureInitialized();
    return this.cache!.subscribe(channel, callback);
  }

  /**
   * Unsubscribe from channel
   */
  async unsubscribe(
    channel: string,
    callback?: (message: any) => void
  ): Promise<void> {
    this.ensureInitialized();
    return this.cache!.unsubscribe(channel, callback);
  }

  // ===== Utility Operations =====

  /**
   * Get all keys matching pattern
   */
  async keys(pattern: string): Promise<string[]> {
    this.ensureInitialized();
    return this.cache!.keys(pattern);
  }

  /**
   * Get database size
   */
  async dbSize(): Promise<number> {
    this.ensureInitialized();
    return this.cache!.dbSize();
  }

  /**
   * Get Redis/Cache info
   */
  async info(): Promise<string> {
    this.ensureInitialized();
    return this.cache!.info();
  }

  /**
   * Ping cache server
   */
  async ping(): Promise<string> {
    this.ensureInitialized();
    return this.cache!.ping();
  }

  /**
   * Check health
   */
  isHealthy(): boolean {
    if (!this.cache) return false;
    return this.cache.isHealthy();
  }

  /**
   * Get connection pool info
   */
  getPoolInfo(): {
    activeConnections: number;
    maxConnections: number;
    isHealthy: boolean;
  } {
    this.ensureInitialized();
    return this.cache!.getPoolInfo();
  }

  /**
   * Disconnect cache service
   */
  async disconnect(): Promise<void> {
    if (this.cache) {
      await this.cache.disconnect();
      this.cache = null;
      this.cacheType = null;
    }
  }

  // ===== Helper Methods =====

  /**
   * Set with automatic JSON serialization
   */
  async setJson(key: string, obj: any, ttlSeconds?: number): Promise<void> {
    await this.set(key, JSON.stringify(obj), ttlSeconds);
  }

  /**
   * Get with automatic JSON parsing
   */
  async getJson(key: string): Promise<any> {
    const value = await this.get(key);
    if (!value) return null;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  /**
   * Cache-aside pattern implementation
   */
  async getOrSet<T>(
    key: string,
    ttlSeconds: number,
    fetchFn: () => Promise<T>
  ): Promise<T> {
    // Try to get from cache
    const cached = await this.get(key);
    if (cached !== null) {
      return cached as T;
    }

    // Fetch from function
    const value = await fetchFn();

    // Store in cache
    await this.set(key, value, ttlSeconds);

    return value;
  }

  /**
   * Set multiple key-value pairs
   */
  async mSet(pairs: Array<[string, any, number?]>): Promise<void> {
    const promises = pairs.map(([key, value, ttl]) =>
      this.set(key, value, ttl)
    );
    await Promise.all(promises);
  }

  /**
   * Increment multiple counters
   */
  async mIncrement(
    counters: Array<[string, number]>
  ): Promise<Map<string, number>> {
    const results = new Map<string, number>();

    for (const [key, amount] of counters) {
      const newValue = await this.increment(key, amount);
      results.set(key, newValue);
    }

    return results;
  }

  /**
   * Create a namespace for keys (prefix)
   */
  namespace(prefix: string): NamespacedCache {
    return new NamespacedCache(this, prefix);
  }
}

/**
 * Namespaced cache wrapper for organizing related keys
 */
class NamespacedCache {
  private cache: CacheService;
  private prefix: string;

  constructor(cache: CacheService, prefix: string) {
    this.cache = cache;
    this.prefix = prefix.endsWith(':') ? prefix : `${prefix}:`;
  }

  private createKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    return this.cache.set(this.createKey(key), value, ttlSeconds);
  }

  async get(key: string): Promise<any> {
    return this.cache.get(this.createKey(key));
  }

  async delete(key: string): Promise<number> {
    return this.cache.delete(this.createKey(key));
  }

  async exists(key: string): Promise<boolean> {
    return this.cache.exists(this.createKey(key));
  }

  async increment(key: string, amount: number = 1): Promise<number> {
    return this.cache.increment(this.createKey(key), amount);
  }

  async decrement(key: string, amount: number = 1): Promise<number> {
    return this.cache.decrement(this.createKey(key), amount);
  }

  async keys(pattern: string = '*'): Promise<string[]> {
    const allKeys = await this.cache.keys(`${this.prefix}${pattern}`);
    return allKeys.map((k) => k.substring(this.prefix.length));
  }

  async flush(): Promise<void> {
    const keys = await this.keys('*');
    if (keys.length > 0) {
      await this.cache.mDelete(keys.map((k) => this.createKey(k)));
    }
  }
}

// Singleton instance
let cacheInstance: CacheService | null = null;

/**
 * Get or create cache service instance
 */
export function getCacheService(): CacheService {
  if (!cacheInstance) {
    cacheInstance = new CacheService();
  }
  return cacheInstance;
}

export { CacheService, NamespacedCache };
export default CacheService;
