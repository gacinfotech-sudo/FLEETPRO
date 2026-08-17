import { createClient, RedisClientType, RedisModules, RedisScripts } from 'redis';
import type { Cluster } from 'redis';

interface RedisConfig {
  host: string;
  port: number;
  db?: number;
  password?: string;
  maxRetriesPerRequest?: number | null;
  enableReadyCheck?: boolean;
  enableOfflineQueue?: boolean;
  clusterMode?: boolean;
  cluster?: {
    nodes: Array<{ host: string; port: number }>;
    options?: any;
  };
}

type RedisClient = RedisClientType<RedisModules, RedisScripts>;

class RedisService {
  private client: RedisClient | null = null;
  private cluster: Cluster | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 5000;
  private subscriptionClient: RedisClient | null = null;
  private pubSubChannels: Map<string, Set<(message: any) => void>> = new Map();
  private connectionPool: Map<string, RedisClient> = new Map();
  private config: RedisConfig;

  constructor(config: Partial<RedisConfig> = {}) {
    this.config = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      enableOfflineQueue: false,
      clusterMode: process.env.REDIS_CLUSTER_MODE === 'true',
      ...config,
    };
  }

  /**
   * Initialize Redis connection
   */
  async connect(): Promise<void> {
    try {
      if (this.config.clusterMode && this.config.cluster) {
        await this.connectCluster();
      } else {
        await this.connectStandalone();
      }

      this.isConnected = true;
      this.reconnectAttempts = 0;
    } catch (error) {
      console.error('❌ Redis connection failed:', error);
      this.scheduleReconnect();
      throw error;
    }
  }

  /**
   * Connect to standalone Redis instance
   */
  private async connectStandalone(): Promise<void> {
    if (this.client) return;

    this.client = createClient({
      host: this.config.host,
      port: this.config.port,
      password: this.config.password,
      db: this.config.db,
      maxRetriesPerRequest: this.config.maxRetriesPerRequest,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > this.maxReconnectAttempts) {
            return new Error('Max reconnection attempts reached');
          }
          return this.reconnectDelay;
        },
      },
    } as any);

    this.client.on('error', (err) => {
      console.error('Redis client error:', err);
      this.isConnected = false;
      this.scheduleReconnect();
    });

    this.client.on('connect', () => {
      this.isConnected = true;
    });

    await this.client.connect();
  }

  /**
   * Connect to Redis cluster
   */
  private async connectCluster(): Promise<void> {
    if (!this.config.cluster) {
      throw new Error('Cluster configuration is required for cluster mode');
    }

    try {
      const { default: RedisCluster } = await import('redis');

      this.cluster = new (RedisCluster as any)({
        rootNodes: this.config.cluster.nodes,
        defaults: {
          password: this.config.password,
          ...this.config.cluster.options,
        },
      });

      this.cluster.on('error', (err) => {
        console.error('Redis cluster error:', err);
        this.isConnected = false;
        this.scheduleReconnect();
      });

      this.cluster.on('connect', () => {
        this.isConnected = true;
      });

      await this.cluster.connect();
    } catch (error) {
      throw new Error(`Failed to initialize Redis cluster: ${error}`);
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;

    setTimeout(() => {
      this.connect().catch((err) => {
        console.error('Reconnection failed:', err);
      });
    }, this.reconnectDelay);
  }

  /**
   * Set a key-value pair with optional TTL
   */
  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    this.ensureConnected();
    const client = this.getClient();

    const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);

    if (ttlSeconds) {
      await client.setEx(key, ttlSeconds, serializedValue);
    } else {
      await client.set(key, serializedValue);
    }
  }

  /**
   * Get a value by key
   */
  async get(key: string): Promise<any> {
    this.ensureConnected();
    const client = this.getClient();

    const value = await client.get(key);

    if (value === null) return null;

    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  /**
   * Get multiple values
   */
  async mGet(keys: string[]): Promise<(any | null)[]> {
    this.ensureConnected();
    const client = this.getClient();

    const values = await client.mGet(keys);

    return values.map((value) => {
      if (value === null) return null;
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    });
  }

  /**
   * Delete a key
   */
  async delete(key: string): Promise<number> {
    this.ensureConnected();
    const client = this.getClient();

    return await client.del(key);
  }

  /**
   * Delete multiple keys
   */
  async mDelete(keys: string[]): Promise<number> {
    this.ensureConnected();
    if (keys.length === 0) return 0;

    const client = this.getClient();
    return await client.del(keys);
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    this.ensureConnected();
    const client = this.getClient();

    const result = await client.exists(key);
    return result === 1;
  }

  /**
   * Set TTL on existing key
   */
  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    this.ensureConnected();
    const client = this.getClient();

    const result = await client.expire(key, ttlSeconds);
    return result === 1;
  }

  /**
   * Get TTL of key
   */
  async ttl(key: string): Promise<number> {
    this.ensureConnected();
    const client = this.getClient();

    return await client.ttl(key);
  }

  /**
   * Clear all keys (use with caution!)
   */
  async flushDb(): Promise<void> {
    this.ensureConnected();
    const client = this.getClient();

    await client.flushDb();
  }

  /**
   * Increment a counter
   */
  async increment(key: string, amount: number = 1): Promise<number> {
    this.ensureConnected();
    const client = this.getClient();

    return await client.incrBy(key, amount);
  }

  /**
   * Decrement a counter
   */
  async decrement(key: string, amount: number = 1): Promise<number> {
    this.ensureConnected();
    const client = this.getClient();

    return await client.decrBy(key, amount);
  }

  /**
   * Get all keys matching pattern
   */
  async keys(pattern: string): Promise<string[]> {
    this.ensureConnected();
    const client = this.getClient();

    return await client.keys(pattern);
  }

  /**
   * Get database size
   */
  async dbSize(): Promise<number> {
    this.ensureConnected();
    const client = this.getClient();

    return await client.dbSize();
  }

  /**
   * Publish message to channel
   */
  async publish(channel: string, message: any): Promise<number> {
    this.ensureConnected();
    const client = this.getClient();

    const serializedMessage =
      typeof message === 'string' ? message : JSON.stringify(message);

    return await client.publish(channel, serializedMessage);
  }

  /**
   * Subscribe to channel
   */
  async subscribe(
    channel: string,
    callback: (message: any) => void
  ): Promise<void> {
    this.ensureConnected();

    if (!this.subscriptionClient) {
      this.subscriptionClient = createClient({
        host: this.config.host,
        port: this.config.port,
        password: this.config.password,
        db: this.config.db,
      } as any);

      await this.subscriptionClient.connect();
    }

    if (!this.pubSubChannels.has(channel)) {
      this.pubSubChannels.set(channel, new Set());

      await this.subscriptionClient.subscribe(channel, (message) => {
        let parsedMessage = message;
        try {
          parsedMessage = JSON.parse(message);
        } catch {
          // Keep original message if not valid JSON
        }

        const callbacks = this.pubSubChannels.get(channel);
        if (callbacks) {
          callbacks.forEach((cb) => cb(parsedMessage));
        }
      });
    }

    const callbacks = this.pubSubChannels.get(channel);
    if (callbacks) {
      callbacks.add(callback);
    }
  }

  /**
   * Unsubscribe from channel
   */
  async unsubscribe(
    channel: string,
    callback?: (message: any) => void
  ): Promise<void> {
    if (callback) {
      const callbacks = this.pubSubChannels.get(channel);
      if (callbacks) {
        callbacks.delete(callback);
      }
    } else {
      this.pubSubChannels.delete(channel);
    }

    if (!callback || this.pubSubChannels.get(channel)?.size === 0) {
      await this.subscriptionClient?.unsubscribe(channel);
    }
  }

  /**
   * Get Redis INFO
   */
  async info(): Promise<string> {
    this.ensureConnected();
    const client = this.getClient();

    return await client.info();
  }

  /**
   * Ping Redis server
   */
  async ping(): Promise<string> {
    this.ensureConnected();
    const client = this.getClient();

    return await client.ping();
  }

  /**
   * Get connection status
   */
  isHealthy(): boolean {
    return this.isConnected;
  }

  /**
   * Get client from pool or return primary client
   */
  private getClient(): RedisClient {
    if (this.cluster) {
      return this.cluster as any;
    }

    if (!this.client) {
      throw new Error('Redis client is not initialized');
    }

    return this.client;
  }

  /**
   * Ensure Redis is connected
   */
  private ensureConnected(): void {
    if (!this.isConnected) {
      throw new Error('Redis is not connected. Call connect() first.');
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }

    if (this.subscriptionClient) {
      await this.subscriptionClient.quit();
      this.subscriptionClient = null;
    }

    if (this.cluster) {
      await this.cluster.quit();
      this.cluster = null;
    }

    this.connectionPool.forEach((client) => {
      client.quit().catch((err) => console.error('Error closing pooled client:', err));
    });
    this.connectionPool.clear();

    this.isConnected = false;
  }

  /**
   * Get connection pool info
   */
  getPoolInfo(): {
    activeConnections: number;
    maxConnections: number;
    isHealthy: boolean;
  } {
    return {
      activeConnections: this.connectionPool.size,
      maxConnections: 10,
      isHealthy: this.isHealthy(),
    };
  }
}

// Singleton instance
let redisInstance: RedisService | null = null;

export function getRedisService(config?: Partial<RedisConfig>): RedisService {
  if (!redisInstance) {
    redisInstance = new RedisService(config);
  }
  return redisInstance;
}

export { RedisService };
export default RedisService;
