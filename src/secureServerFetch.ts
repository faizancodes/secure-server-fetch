export class ServerSideError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ServerSideError';
  }
}

export class NetworkError extends Error {
  constructor(
    message: string,
    public status?: number,
    public statusText?: string,
    public responseBody?: unknown
  ) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Configuration options for secureServerFetch extending the standard fetch RequestInit.
 * @interface
 * @property {string} [apiKey] - Optional API key to be included in the x-api-key header
 * @property {boolean} [requireHttps=true] - Whether to enforce HTTPS (defaults to true)
 * @property {number} [timeout=30000] - Request timeout in milliseconds (defaults to 30000)
 * @example
 * ```typescript
 * const options: SecureServerFetchOptions = {
 *   apiKey: 'your-api-key',
 *   requireHttps: true,
 *   timeout: 5000,
 *   headers: {
 *     'Content-Type': 'application/json'
 *   }
 * }
 * ```
 */
export interface SecureServerFetchOptions extends RequestInit {
  apiKey?: string;
  requireHttps?: boolean;
  timeout?: number;
}

/**
 * Determines if the code is running in a server-side environment.
 * @returns {boolean} True if running on the server, false if running in a browser
 * @internal
 */
function isServerSide(): boolean {
  return typeof window === 'undefined';
}

/**
 * Performs a secure HTTP request that can only be executed server-side with built-in
 * safety features like HTTPS enforcement, timeouts, and proper error handling.
 * 
 * @template T - The expected type of the JSON response
 * @param {string} url - The URL to send the request to
 * @param {SecureServerFetchOptions} [options={}] - Configuration options for the request
 * @returns {Promise<T>} A promise that resolves to the parsed JSON response
 * @throws {ServerSideError} If called from client-side code
 * @throws {ValidationError} If the URL is invalid or HTTPS is required but not used
 * @throws {NetworkError} If the request fails, times out, or response parsing fails
 * 
 * @example
 * ```typescript
 * // Basic usage
 * const data = await secureServerFetch<{ id: string }>(
 *   'https://api.example.com/data'
 * )
 * 
 * // With options
 * const data = await secureServerFetch<{ users: string[] }>(
 *   'https://api.example.com/users',
 *   {
 *     apiKey: 'your-api-key',
 *     method: 'POST',
 *     timeout: 5000,
 *     headers: {
 *       'Content-Type': 'application/json'
 *     },
 *     body: JSON.stringify({ query: 'test' })
 *   }
 * )
 * 
 * // Error handling
 * try {
 *   const data = await secureServerFetch<T>(url, options)
 *   // Handle success
 * } catch (error) {
 *   if (error instanceof ServerSideError) {
 *     // Handle client-side execution error
 *   } else if (error instanceof ValidationError) {
 *     // Handle URL or HTTPS validation error
 *   } else if (error instanceof NetworkError) {
 *     // Handle network, timeout, or parsing error
 *     console.error(error.status, error.statusText, error.responseBody)
 *   }
 * }
 * ```
 */
export async function secureServerFetch<T>(
  url: string,
  options: SecureServerFetchOptions = {}
): Promise<T> {
  // Validate URL and enforce HTTPS
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
    if (options.requireHttps !== false && parsedUrl.protocol !== 'https:') {
      throw new ValidationError('HTTPS is required. Use requireHttps: false to override.');
    }
  } catch {
    throw new ValidationError(`Invalid URL provided: ${url}`);
  }

  // Verify server-side execution
  if (!isServerSide()) {
    throw new ServerSideError('secureServerFetch can only run on the server.');
  }

  const { apiKey, timeout = 30000, ...fetchOptions } = options;
  const headers = new Headers(fetchOptions.headers || {});
  if (apiKey) {
    headers.set('x-api-key', apiKey);
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, { 
        ...fetchOptions, 
        headers,
        signal: controller.signal 
      });

      if (!response.ok) {
        let errorBody: unknown;
        try {
          errorBody = await response.json();
        } catch {
          // If JSON parsing fails, use text content
          errorBody = await response.text();
        }
        
        throw new NetworkError(
          `Request failed with status ${response.status}`,
          response.status,
          response.statusText,
          errorBody
        );
      }

      try {
        return await response.json() as T;
      } catch {
        throw new NetworkError(
          'Failed to parse JSON response',
          response.status,
          response.statusText,
          await response.text()
        );
      }
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error: unknown) {
    if (error instanceof NetworkError) {
      throw error;
    }
    if (error instanceof Error && error.name === 'AbortError') {
      throw new NetworkError(`Request timeout after ${timeout}ms`, undefined, 'timeout');
    }
    // Handle fetch failures (network issues, etc.)
    throw new NetworkError(
      `Network request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      undefined,
      undefined,
      error
    );
  }
}