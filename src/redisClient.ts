import { Redis } from '@upstash/redis';

class RedisConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RedisConnectionError';
  }
}

function validateEnvironmentVariables() {
  const errors: string[] = [];

  if (!process.env.UPSTASH_REDIS_REST_URL) {
    errors.push('UPSTASH_REDIS_REST_URL is not set');
  } else if (!process.env.UPSTASH_REDIS_REST_URL.startsWith('https://')) {
    errors.push('UPSTASH_REDIS_REST_URL must be a valid HTTPS URL');
  }

  if (!process.env.UPSTASH_REDIS_REST_TOKEN) {
    errors.push('UPSTASH_REDIS_REST_TOKEN is not set');
  }

  if (errors.length > 0) {
    throw new RedisConnectionError(`Redis configuration error: ${errors.join(', ')}`);
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