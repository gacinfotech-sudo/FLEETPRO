/**
 * In-Memory Cache Service (Redis Fallback)
 * Used when Redis is not available for development/testing
 */

interface CacheEntry {
  value: any;
  expireAt?: number;
}

type SubscriberCallback = (message: any) => void;

class InMemoryCacheService {
  private cache: Map<string, CacheEntry> = new Map();
  private subscribers: Map<string, Set<SubscriberCallback>> = new Map();
  private cleanupInterval: NodeJS.Timer | null = null;
  private isConnected = true;

  constructor() {
    // Start cleanup interval for expired keys (every 10 seconds)
    this.startCleanupInterval();
  }

  /**
   * Start periodic cleanup of expired keys
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const expiredKeys: string[] = [];

      for (const [key, entry] of this.cache.entries()) {
        if (entry.expireAt && entry.expireAt <= now) {
          expiredKeys.push(key);
        }
      }

      expiredKeys.forEach((key) => {
        this.cache.delete(key);
      });

      if (expiredKeys.length > 0) {
      }
    }, 10000);
  }

  /**
   * Connect (no-op for in-memory)
   */
  async connect(): Promise<void> {
    this.isConnected = true;
  }

  /**
   * Set a key-value pair with optional TTL
   */
  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    const serializedValue = typeof value === 'string' ? value : value;
    const entry: CacheEntry = { value: serializedValue };

    if (ttlSeconds) {
      entry.expireAt = Date.now() + ttlSeconds * 1000;
    }

    this.cache.set(key, entry);
  }

  /**
   * Get a value by key
   */
  async get(key: string): Promise<any> {
    const entry = this.cache.get(key);

    if (!entry) return null;

    // Check if expired
    if (entry.expireAt && entry.expireAt <= Date.now()) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  /**
   * Get multiple values
   */
  async mGet(keys: string[]): Promise<(any | null)[]> {
    return Promise.all(keys.map((key) => this.get(key)));
  }

  /**
   * Delete a key
   */
  async delete(key: string): Promise<number> {
    return this.cache.delete(key) ? 1 : 0;
  }

  /**
   * Delete multiple keys
   */
  async mDelete(keys: string[]): Promise<number> {
    let deleted = 0;
    for (const key of keys) {
      if (this.cache.delete(key)) {
        deleted++;
      }
    }
    return deleted;
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Check if expired
    if (entry.expireAt && entry.expireAt <= Date.now()) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Set TTL on existing key
   */
  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;

    entry.expireAt = Date.now() + ttlSeconds * 1000;
    return true;
  }

  /**
   * Get TTL of key
   */
  async ttl(key: string): Promise<number> {
    const entry = this.cache.get(key);

    if (!entry) return -2; // Key does not exist
    if (!entry.expireAt) return -1; // Key exists but has no expiry

    const remaining = Math.ceil((entry.expireAt - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  }

  /**
   * Clear all keys
   */
  async flushDb(): Promise<void> {
    const size = this.cache.size;
    this.cache.clear();
  }

  /**
   * Increment a counter
   */
  async increment(key: string, amount: number = 1): Promise<number> {
    const entry = this.cache.get(key);
    let current = 0;

    if (entry) {
      const value = entry.value;
      current = typeof value === 'number' ? value : parseInt(value) || 0;
    }

    const newValue = current + amount;
    await this.set(key, newValue);
    return newValue;
  }

  /**
   * Decrement a counter
   */
  async decrement(key: string, amount: number = 1): Promise<number> {
    return this.increment(key, -amount);
  }

  /**
   * Get all keys matching pattern
   */
  async keys(pattern: string): Promise<string[]> {
    const regex = this.patternToRegex(pattern);
    const result: string[] = [];

    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      // Skip expired keys
      if (entry.expireAt && entry.expireAt <= now) {
        continue;
      }

      if (regex.test(key)) {
        result.push(key);
      }
    }

    return result;
  }

  /**
   * Get database size (number of keys)
   */
  async dbSize(): Promise<number> {
    return this.cache.size;
  }

  /**
   * Publish message to channel
   */
  async publish(channel: string, message: any): Promise<number> {
    const callbacks = this.subscribers.get(channel);
    if (!callbacks) return 0;

    const serializedMessage =
      typeof message === 'string' ? message : JSON.stringify(message);

    // Simulate async message delivery
    setImmediate(() => {
      callbacks.forEach((callback) => {
        try {
          callback(JSON.parse(serializedMessage));
        } catch {
          callback(serializedMessage);
        }
      });
    });

    return callbacks.size;
  }

  /**
   * Subscribe to channel
   */
  async subscribe(
    channel: string,
    callback: (message: any) => void
  ): Promise<void> {
    if (!this.subscribers.has(channel)) {
      this.subscribers.set(channel, new Set());
    }

    this.subscribers.get(channel)!.add(callback);
  }

  /**
   * Unsubscribe from channel
   */
  async unsubscribe(
    channel: string,
    callback?: (message: any) => void
  ): Promise<void> {
    if (callback) {
      const callbacks = this.subscribers.get(channel);
      if (callbacks) {
        callbacks.delete(callback);
      }
    } else {
      this.subscribers.delete(channel);
    }
  }

  /**
   * Get Redis-like INFO string
   */
  async info(): Promise<string> {
    const size = this.cache.size;
    let memoryUsage = 0;

    for (const [key, entry] of this.cache.entries()) {
      memoryUsage +=
        key.length +
        (typeof entry.value === 'string'
          ? entry.value.length
          : JSON.stringify(entry.value).length);
    }

    const memoryMB = (memoryUsage / 1024 / 1024).toFixed(2);

    return `
# Server
redis_version:7.0.0 (In-Memory)
process_id:${process.pid}
uptime_in_seconds:${Math.floor(process.uptime())}

# Memory
used_memory:${memoryUsage}
used_memory_human:${memoryMB}M
maxmemory:536870912
maxmemory_policy:allkeys-lru

# Clients
connected_clients:1

# Keyspace
db0:keys=${size},expires=0,avg_ttl=0
    `.trim();
  }

  /**
   * Ping (always returns PONG)
   */
  async ping(): Promise<string> {
    return 'PONG';
  }

  /**
   * Check health
   */
  isHealthy(): boolean {
    return this.isConnected;
  }

  /**
   * Get pool info
   */
  getPoolInfo(): {
    activeConnections: number;
    maxConnections: number;
    isHealthy: boolean;
  } {
    return {
      activeConnections: 1,
      maxConnections: 1,
      isHealthy: true,
    };
  }

  /**
   * Disconnect
   */
  async disconnect(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cache.clear();
    this.subscribers.clear();
    this.isConnected = false;
  }

  /**
   * Convert Redis pattern to RegExp
   */
  private patternToRegex(pattern: string): RegExp {
    // Convert Redis glob pattern to regex
    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
      .replace(/\*/g, '.*') // * -> .*
      .replace(/\?/g, '.'); // ? -> .

    return new RegExp(`^${regexPattern}$`);
  }
}

// Singleton instance
let inMemoryInstance: InMemoryCacheService | null = null;

export function getInMemoryCacheService(): InMemoryCacheService {
  if (!inMemoryInstance) {
    inMemoryInstance = new InMemoryCacheService();
  }
  return inMemoryInstance;
}

export default InMemoryCacheService;
