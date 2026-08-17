import { getRedisService } from '../services/RedisService';

/**
 * Initialize Redis connection on server startup
 */
export async function initializeRedis(): Promise<void> {
  const redis = getRedisService({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
    clusterMode: process.env.REDIS_CLUSTER_MODE === 'true',
  });

  try {
    await redis.connect();

    // Test basic operations
    const ping = await redis.ping();

    // Test SET/GET
    await redis.set('health_check', { timestamp: new Date().toISOString() }, 3600);
    const healthCheck = await redis.get('health_check');

    // Log connection pool info
    const poolInfo = redis.getPoolInfo();

    // Get Redis info
    const info = await redis.info();
    const lines = info.split('\r\n');
    const serverInfo = lines.find((line) => line.includes('redis_version'));
    const memoryInfo = lines.find((line) => line.includes('used_memory_human'));
    const clientsInfo = lines.find((line) => line.includes('connected_clients'));


    return;
  } catch (error: any) {
    if (
      error.code === 'ECONNREFUSED' ||
      error.message.includes('connect ECONNREFUSED')
    ) {
      console.warn(
        '⚠️ Redis not available - will use fallback caching strategy'
      );
      return;
    }

    console.error('❌ Redis initialization error:', error.message);
    throw error;
  }
}

/**
 * Health check Redis connection
 */
export async function checkRedisHealth(): Promise<boolean> {
  try {
    const redis = getRedisService();

    if (!redis.isHealthy()) {
      return false;
    }

    const ping = await redis.ping();
    return ping === 'PONG';
  } catch (error) {
    return false;
  }
}

/**
 * Get Redis status
 */
export async function getRedisStatus(): Promise<{
  isConnected: boolean;
  ping?: string;
  version?: string;
  memory?: string;
  clients?: number;
  uptime?: number;
  error?: string;
}> {
  try {
    const redis = getRedisService();

    if (!redis.isHealthy()) {
      return { isConnected: false };
    }

    const ping = await redis.ping();
    const info = await redis.info();

    const lines = info.split('\r\n');
    const versionLine = lines.find((line) => line.includes('redis_version'));
    const memoryLine = lines.find((line) => line.includes('used_memory_human'));
    const clientsLine = lines.find((line) => line.includes('connected_clients'));
    const uptimeLine = lines.find((line) => line.includes('uptime_in_seconds'));

    const version = versionLine?.split(':')[1]?.trim();
    const memory = memoryLine?.split(':')[1]?.trim();
    const clients = clientsLine ? parseInt(clientsLine.split(':')[1] || '0') : 0;
    const uptime = uptimeLine ? parseInt(uptimeLine.split(':')[1] || '0') : 0;

    return {
      isConnected: true,
      ping,
      version,
      memory,
      clients,
      uptime,
    };
  } catch (error: any) {
    return {
      isConnected: false,
      error: error.message,
    };
  }
}
