import { Redis } from '@upstash/redis';

class RedisConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RedisConnectionError';
  }
}

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
    const isProd = process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test';
    const errorMessage = isProd 
      ? 'Redis configuration error occurred' 
      : `Redis configuration error: ${errors.join(', ')}`;
    throw new RedisConnectionError(errorMessage);
  }
}

async function testConnection(client: Redis): Promise<void> {
  try {
    await client.ping();
  } catch (error) {
    throw new RedisConnectionError(
      `Failed to connect to Redis: ${error instanceof Error ? error.message : 'Unknown error'}`
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
  console.error('Redis connection test failed:', error);
  process.exit(1);
});