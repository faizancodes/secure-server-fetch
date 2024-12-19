import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from '@upstash/redis';
import { redis } from './redisClient';

export interface RateLimitOptions {
  maxRequests: number;
  timeframeMs: number;
  prefix?: string;
}

export interface RateLimitResult {
  success: boolean;
  headers: Record<string, string>;
}

export class RateLimitError extends Error {
  constructor(
    public readonly message: string,
    public readonly status: number,
    public readonly remainingRequests: number = 0,
    public readonly resetTime: number = 0
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export async function rateLimit(
  request: Request,
  identifier: string,
  { maxRequests, timeframeMs, prefix = "@upstash/ratelimit" }: RateLimitOptions
): Promise<RateLimitResult> {
  // Input validation
  if (!identifier || typeof identifier !== 'string') {
    throw new RateLimitError('Invalid identifier parameter', 400, 0, 0);
  }
  if (!Number.isInteger(maxRequests) || maxRequests <= 0) {
    throw new RateLimitError('maxRequests must be a positive integer', 400, 0, 0);
  }
  if (!Number.isInteger(timeframeMs) || timeframeMs <= 0) {
    throw new RateLimitError('timeframeMs must be a positive integer', 400, 0, 0);
  }

  if (!redis || !(redis instanceof Redis)) {
    throw new RateLimitError('Redis client not properly initialized', 500, 0, 0);
  }

  try {
    const timeframeSeconds = Math.round(timeframeMs / 1000);
    const ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(maxRequests, `${timeframeSeconds} s`),
      analytics: true,
      prefix,
    });

    const { success, reset, remaining, limit } = await ratelimit.limit(identifier);

    const headers: Record<string, string> = {
      'X-RateLimit-Limit': limit.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': reset.toString(),
    };

    if (!success) {
      headers['Retry-After'] = timeframeSeconds.toString();
      throw new RateLimitError(
        'Rate limit exceeded',
        429,
        remaining,
        reset
      );
    }

    return {
      success: true,
      headers
    };
  } catch (error) {
    if (error instanceof RateLimitError) {
      throw error;
    }
    // Handle Redis connection errors
    throw new RateLimitError(
      error instanceof Error ? error.message : 'Internal Server Error',
      500,
      0,
      0
    );
  }
}