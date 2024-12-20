import { Redis } from '@upstash/redis';

/**
 * Custom error class for Redis connection issues
 * @class RedisConnectionError
 * @extends Error
 */
class RedisConnectionError extends Error {
  constructor(message: string, public details?: string) {
    super(message);
    this.name = 'RedisConnectionError';
  }
}

const isProd = !['development', 'test', 'preview'].includes(process.env.NODE_ENV ?? '');

/**
 * Validates required Redis environment variables and their format
 * @throws {RedisConnectionError} When environment variables are missing or invalid
 */
function validateEnvironmentVariables() {
  const errors: string[] = [];

  // Validate UPSTASH_REDIS_REST_URL
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    errors.push('UPSTASH_REDIS_REST_URL is not set');
  } else {
    try {
      const url = new URL(process.env.UPSTASH_REDIS_REST_URL);
      if (url.protocol !== 'https:') {
        errors.push('UPSTASH_REDIS_REST_URL must use HTTPS protocol');
      }
      if (!url.hostname.endsWith('.upstash.io')) {
        errors.push('UPSTASH_REDIS_REST_URL must be an Upstash Redis URL');
      }
    } catch {
      errors.push('UPSTASH_REDIS_REST_URL must be a valid URL');
    }
  }

  // Validate UPSTASH_REDIS_REST_TOKEN
  if (!process.env.UPSTASH_REDIS_REST_TOKEN) {
    errors.push('UPSTASH_REDIS_REST_TOKEN is not set');
  } else if (!/^[A-Za-z0-9=_-]+$/.test(process.env.UPSTASH_REDIS_REST_TOKEN)) {
    errors.push('UPSTASH_REDIS_REST_TOKEN contains invalid characters');
  } else if (process.env.UPSTASH_REDIS_REST_TOKEN.length < 32) {
    errors.push('UPSTASH_REDIS_REST_TOKEN is too short');
  }

  if (errors.length > 0) {
    const publicMessage = isProd 
      ? 'Invalid Redis configuration' 
      : `Redis configuration error: ${errors.join(', ')}`;
    
    throw new RedisConnectionError(
      publicMessage,
      isProd ? errors.join(', ') : undefined
    );
  }
}

/**
 * Tests the Redis connection by attempting to ping the server
 * @param client - The Redis client instance to test
 * @throws {RedisConnectionError} When the connection test fails
 * @returns {Promise<void>}
 */
async function testConnection(client: Redis): Promise<void> {
  try {
    await client.ping();
  } catch (error) {
    const publicMessage = isProd 
      ? 'Failed to connect to Redis' 
      : `Failed to connect to Redis: ${error instanceof Error ? error.message : 'Unknown error'}`;
    
    throw new RedisConnectionError(
      publicMessage,
      isProd ? `${error instanceof Error ? error.message : 'Unknown error'}` : undefined
    );
  }
}

validateEnvironmentVariables();

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Test the connection immediately
testConnection(redis).catch((error) => {  
  // Log the detailed error for debugging
  if (error instanceof RedisConnectionError && error.details) {
    console.error('Redis connection error details:', error.details);
  }
  
  // Log only the safe public message
  console.error('Redis connection test failed:', error.message);
  
  process.exit(1);
});