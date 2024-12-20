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

/**
 * Sanitizes the identifier to prevent Redis injection attacks by removing special characters
 * and limiting the key length.
 * 
 * @param identifier - The raw identifier string to sanitize
 * @returns A sanitized string safe for use as a Redis key
 * @throws {RateLimitError} When the identifier becomes empty after sanitization
 * 
 * @example
 * ```ts
 * const safeKey = sanitizeIdentifier('user@123'); // Returns 'user_123'
 * ```
 */
function sanitizeIdentifier(identifier: string): string {
  // Remove any Redis special characters and command patterns
  const sanitized = identifier
    .replace(/[\@\{\}\(\)\[\]\/\\\"\'\`\~\,\.\;\:\<\>\*\&\^\%\$\#\@\!\?\=\+\|]/g, '_')
    // Prevent command injection patterns by removing spaces and newlines
    .replace(/[\s\n\r]+/g, '_')
    // Limit the length to prevent extremely long keys
    .slice(0, 100);
  
  if (!sanitized) {
    throw new RateLimitError('Identifier becomes empty after sanitization', 400, 0, 0);
  }
  
  return sanitized;
}

/**
 * Implements rate limiting using Upstash Redis. Tracks and limits requests based on a sliding window.
 * 
 * @param request - The incoming HTTP request
 * @param identifier - Unique identifier for the rate limit (e.g., IP address, user ID)
 * @param options - Configuration options for rate limiting
 * @param options.maxRequests - Maximum number of requests allowed within the timeframe
 * @param options.timeframeMs - Time window in milliseconds
 * @param options.prefix - Optional prefix for Redis keys (defaults to "@upstash/ratelimit")
 * 
 * @returns Promise resolving to a RateLimitResult containing success status and rate limit headers
 * 
 * @throws {RateLimitError} When rate limit is exceeded or other errors occur
 * - 400: Invalid parameters
 * - 429: Rate limit exceeded
 * - 500: Redis connection or internal errors
 * 
 * @example
 * ```ts
 * try {
 *   const result = await rateLimit(req, 'user-123', {
 *     maxRequests: 10,
 *     timeframeMs: 60000 // 1 minute
 *   });
 *   // Handle successful request
 * } catch (error) {
 *   if (error instanceof RateLimitError) {
 *     // Handle rate limit exceeded
 *   }
 * }
 * ```
 */
export async function rateLimit(
  request: Request,
  identifier: string,
  { maxRequests, timeframeMs, prefix = "@upstash/ratelimit" }: RateLimitOptions
): Promise<RateLimitResult> {
  // Input validation
  if (!identifier || typeof identifier !== 'string') {
    throw new RateLimitError('Invalid identifier parameter', 400, 0, 0);
  }

  // Sanitize the identifier before using it
  const sanitizedIdentifier = sanitizeIdentifier(identifier);

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

    const { success, reset, remaining, limit } = await ratelimit.limit(sanitizedIdentifier);

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