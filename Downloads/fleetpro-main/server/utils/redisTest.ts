import { getRedisService } from '../services/RedisService';
import RedisService from '../services/RedisService';

/**
 * Comprehensive Redis Testing Suite
 */
export async function runRedisTests(): Promise<{
  passed: number;
  failed: number;
  tests: Array<{
    name: string;
    status: 'PASS' | 'FAIL';
    message: string;
    duration: number;
  }>;
}> {
  const results: Array<{
    name: string;
    status: 'PASS' | 'FAIL';
    message: string;
    duration: number;
  }> = [];

  const redis = getRedisService();

  // Test 1: PING
  await testPing(redis, results);

  // Test 2: SET/GET
  await testSetGet(redis, results);

  // Test 3: Multiple operations
  await testMultipleOperations(redis, results);

  // Test 4: TTL/Expiration
  await testExpiration(redis, results);

  // Test 5: Counters
  await testCounters(redis, results);

  // Test 6: Pub/Sub
  await testPubSub(redis, results);

  // Test 7: Cluster Configuration
  await testClusterConfiguration(redis, results);

  // Test 8: Memory Management
  await testMemoryManagement(redis, results);

  // Test 9: Connection Pool
  await testConnectionPool(redis, results);

  // Test 10: Error Handling
  await testErrorHandling(redis, results);

  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;

  return { passed, failed, tests: results };
}

/**
 * Test 1: PING
 */
async function testPing(
  redis: RedisService,
  results: Array<{
    name: string;
    status: 'PASS' | 'FAIL';
    message: string;
    duration: number;
  }>
): Promise<void> {
  const startTime = Date.now();

  try {
    const response = await redis.ping();
    const duration = Date.now() - startTime;

    if (response === 'PONG') {
      results.push({
        name: 'PING',
        status: 'PASS',
        message: `Redis returned PONG in ${duration}ms`,
        duration,
      });
    } else {
      results.push({
        name: 'PING',
        status: 'FAIL',
        message: `Expected PONG, got ${response}`,
        duration,
      });
    }
  } catch (error: any) {
    const duration = Date.now() - startTime;
    results.push({
      name: 'PING',
      status: 'FAIL',
      message: error.message,
      duration,
    });
  }
}

/**
 * Test 2: SET/GET Operations
 */
async function testSetGet(
  redis: RedisService,
  results: Array<{
    name: string;
    status: 'PASS' | 'FAIL';
    message: string;
    duration: number;
  }>
): Promise<void> {
  const startTime = Date.now();

  try {
    // Test string value
    await redis.set('test_key', 'test_value');
    const stringValue = await redis.get('test_key');

    if (stringValue !== 'test_value') {
      throw new Error(`SET/GET string failed: expected 'test_value', got ${stringValue}`);
    }

    // Test JSON value
    const jsonData = { name: 'FleetPro', version: '1.0', active: true };
    await redis.set('test_json', jsonData);
    const jsonValue = await redis.get('test_json');

    if (JSON.stringify(jsonValue) !== JSON.stringify(jsonData)) {
      throw new Error(`SET/GET JSON failed`);
    }

    // Test non-existent key
    const nonExistent = await redis.get('non_existent_key_xyz');
    if (nonExistent !== null) {
      throw new Error(`GET non-existent key should return null`);
    }

    const duration = Date.now() - startTime;
    results.push({
      name: 'SET/GET Operations',
      status: 'PASS',
      message: 'Successfully SET/GET string, JSON, and null values',
      duration,
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    results.push({
      name: 'SET/GET Operations',
      status: 'FAIL',
      message: error.message,
      duration,
    });
  }
}

/**
 * Test 3: Multiple Operations (mGet, mDelete)
 */
async function testMultipleOperations(
  redis: RedisService,
  results: Array<{
    name: string;
    status: 'PASS' | 'FAIL';
    message: string;
    duration: number;
  }>
): Promise<void> {
  const startTime = Date.now();

  try {
    // Set multiple keys
    await redis.set('key1', 'value1');
    await redis.set('key2', { data: 'value2' });
    await redis.set('key3', 'value3');

    // Get multiple keys
    const values = await redis.mGet(['key1', 'key2', 'key3', 'nonexistent']);

    if (
      values[0] !== 'value1' ||
      JSON.stringify(values[1]) !== JSON.stringify({ data: 'value2' }) ||
      values[2] !== 'value3' ||
      values[3] !== null
    ) {
      throw new Error('mGet returned unexpected values');
    }

    // Delete multiple keys
    const deleted = await redis.mDelete(['key1', 'key2', 'key3']);

    if (deleted !== 3) {
      throw new Error(`Expected to delete 3 keys, deleted ${deleted}`);
    }

    const duration = Date.now() - startTime;
    results.push({
      name: 'Multiple Operations (mGet/mDelete)',
      status: 'PASS',
      message: `Successfully performed batch GET (4 keys) and DELETE (3 keys)`,
      duration,
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    results.push({
      name: 'Multiple Operations (mGet/mDelete)',
      status: 'FAIL',
      message: error.message,
      duration,
    });
  }
}

/**
 * Test 4: TTL and Expiration
 */
async function testExpiration(
  redis: RedisService,
  results: Array<{
    name: string;
    status: 'PASS' | 'FAIL';
    message: string;
    duration: number;
  }>
): Promise<void> {
  const startTime = Date.now();

  try {
    // Set with TTL
    await redis.set('ttl_key', 'ttl_value', 2);

    // Check TTL
    const ttlBefore = await redis.ttl('ttl_key');
    if (ttlBefore <= 0 || ttlBefore > 2) {
      throw new Error(`TTL check failed: expected 1-2, got ${ttlBefore}`);
    }

    // Check key exists
    const exists = await redis.exists('ttl_key');
    if (!exists) {
      throw new Error('Key should exist');
    }

    // Wait and verify expiration
    await new Promise((resolve) => setTimeout(resolve, 2100));

    const afterExpiry = await redis.get('ttl_key');
    if (afterExpiry !== null) {
      throw new Error('Key should have expired');
    }

    // Test explicit expire
    await redis.set('expire_key', 'expire_value');
    const expireResult = await redis.expire('expire_key', 1);
    if (!expireResult) {
      throw new Error('expire() should return true for existing key');
    }

    const duration = Date.now() - startTime;
    results.push({
      name: 'TTL and Expiration',
      status: 'PASS',
      message: 'Successfully tested SET with TTL, TTL check, and automatic expiration',
      duration,
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    results.push({
      name: 'TTL and Expiration',
      status: 'FAIL',
      message: error.message,
      duration,
    });
  }
}

/**
 * Test 5: Counters (increment/decrement)
 */
async function testCounters(
  redis: RedisService,
  results: Array<{
    name: string;
    status: 'PASS' | 'FAIL';
    message: string;
    duration: number;
  }>
): Promise<void> {
  const startTime = Date.now();

  try {
    // Delete counter if exists
    await redis.delete('counter');

    // Increment
    let count = await redis.increment('counter', 1);
    if (count !== 1) throw new Error(`First increment should be 1, got ${count}`);

    count = await redis.increment('counter', 5);
    if (count !== 6) throw new Error(`Second increment should be 6, got ${count}`);

    // Decrement
    count = await redis.decrement('counter', 2);
    if (count !== 4) throw new Error(`Decrement should be 4, got ${count}`);

    const duration = Date.now() - startTime;
    results.push({
      name: 'Counters (increment/decrement)',
      status: 'PASS',
      message: 'Successfully tested increment (+1, +5) and decrement (-2)',
      duration,
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    results.push({
      name: 'Counters (increment/decrement)',
      status: 'FAIL',
      message: error.message,
      duration,
    });
  }
}

/**
 * Test 6: Pub/Sub Functionality
 */
async function testPubSub(
  redis: RedisService,
  results: Array<{
    name: string;
    status: 'PASS' | 'FAIL';
    message: string;
    duration: number;
  }>
): Promise<void> {
  const startTime = Date.now();

  try {
    let receivedMessage: any = null;

    // Subscribe to channel
    await redis.subscribe('test_channel', (message: any) => {
      receivedMessage = message;
    });

    // Wait a bit for subscription to settle
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Publish message
    const subscribers = await redis.publish('test_channel', {
      event: 'test_event',
      data: 'test_data',
    });

    // Wait for message to be received
    await new Promise((resolve) => setTimeout(resolve, 100));

    if (!receivedMessage || receivedMessage.event !== 'test_event') {
      throw new Error('Message not received or incorrect');
    }

    if (subscribers < 1) {
      console.warn('Warning: Expected at least 1 subscriber');
    }

    // Unsubscribe
    await redis.unsubscribe('test_channel');

    const duration = Date.now() - startTime;
    results.push({
      name: 'Pub/Sub Functionality',
      status: 'PASS',
      message: `Successfully published and received message to ${subscribers} subscriber(s)`,
      duration,
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    results.push({
      name: 'Pub/Sub Functionality',
      status: 'FAIL',
      message: error.message,
      duration,
    });
  }
}

/**
 * Test 7: Cluster Configuration
 */
async function testClusterConfiguration(
  redis: RedisService,
  results: Array<{
    name: string;
    status: 'PASS' | 'FAIL';
    message: string;
    duration: number;
  }>
): Promise<void> {
  const startTime = Date.now();

  try {
    const info = await redis.info();

    // Check for cluster info
    const isClusterEnabled = info.includes('cluster_enabled:1');

    if (!isClusterEnabled) {
      results.push({
        name: 'Cluster Configuration',
        status: 'PASS',
        message: 'Running in standalone mode (cluster disabled)',
        duration: Date.now() - startTime,
      });
      return;
    }

    // Parse cluster info if available
    const clusterInfo = info.split('\r\n').find((line) => line.includes('cluster_state'));

    results.push({
      name: 'Cluster Configuration',
      status: 'PASS',
      message: `Cluster enabled: ${clusterInfo || 'cluster_state detected'}`,
      duration: Date.now() - startTime,
    });
  } catch (error: any) {
    results.push({
      name: 'Cluster Configuration',
      status: 'FAIL',
      message: error.message,
      duration: Date.now() - startTime,
    });
  }
}

/**
 * Test 8: Memory Management
 */
async function testMemoryManagement(
  redis: RedisService,
  results: Array<{
    name: string;
    status: 'PASS' | 'FAIL';
    message: string;
    duration: number;
  }>
): Promise<void> {
  const startTime = Date.now();

  try {
    const info = await redis.info();

    // Extract memory info
    const usedMemory = info
      .split('\r\n')
      .find((line) => line.includes('used_memory_human'));
    const maxMemory = info
      .split('\r\n')
      .find((line) => line.includes('maxmemory_human'));
    const evictionPolicy = info
      .split('\r\n')
      .find((line) => line.includes('maxmemory_policy'));

    const memoryStats = [usedMemory, maxMemory, evictionPolicy]
      .filter((stat) => stat)
      .join(' | ');

    const dbSize = await redis.dbSize();

    results.push({
      name: 'Memory Management',
      status: 'PASS',
      message: `DB Size: ${dbSize} keys | ${memoryStats}`,
      duration: Date.now() - startTime,
    });
  } catch (error: any) {
    results.push({
      name: 'Memory Management',
      status: 'FAIL',
      message: error.message,
      duration: Date.now() - startTime,
    });
  }
}

/**
 * Test 9: Connection Pool
 */
async function testConnectionPool(
  redis: RedisService,
  results: Array<{
    name: string;
    status: 'PASS' | 'FAIL';
    message: string;
    duration: number;
  }>
): Promise<void> {
  const startTime = Date.now();

  try {
    const poolInfo = redis.getPoolInfo();

    if (!poolInfo.isHealthy) {
      throw new Error('Connection pool is not healthy');
    }

    results.push({
      name: 'Connection Pool',
      status: 'PASS',
      message: `Active: ${poolInfo.activeConnections}/${poolInfo.maxConnections} | Healthy: ${poolInfo.isHealthy}`,
      duration: Date.now() - startTime,
    });
  } catch (error: any) {
    results.push({
      name: 'Connection Pool',
      status: 'FAIL',
      message: error.message,
      duration: Date.now() - startTime,
    });
  }
}

/**
 * Test 10: Error Handling
 */
async function testErrorHandling(
  redis: RedisService,
  results: Array<{
    name: string;
    status: 'PASS' | 'FAIL';
    message: string;
    duration: number;
  }>
): Promise<void> {
  const startTime = Date.now();

  try {
    // Test deleting non-existent key
    const deleted = await redis.delete('nonexistent_error_test_key');
    if (deleted !== 0) {
      throw new Error('Expected 0 deletions for non-existent key');
    }

    // Test exists on non-existent key
    const exists = await redis.exists('nonexistent_error_test_key');
    if (exists) {
      throw new Error('Non-existent key should not exist');
    }

    // Test TTL on non-existent key
    const ttl = await redis.ttl('nonexistent_error_test_key');
    if (ttl !== -2) {
      throw new Error(`TTL for non-existent key should be -2, got ${ttl}`);
    }

    results.push({
      name: 'Error Handling',
      status: 'PASS',
      message: 'Successfully handled edge cases (non-existent keys, negative TTLs)',
      duration: Date.now() - startTime,
    });
  } catch (error: any) {
    results.push({
      name: 'Error Handling',
      status: 'FAIL',
      message: error.message,
      duration: Date.now() - startTime,
    });
  }
}
