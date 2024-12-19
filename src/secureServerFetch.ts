// Custom error classes for better error handling
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

export interface SecureServerFetchOptions extends RequestInit {
  apiKey?: string;
  requireHttps?: boolean;
  timeout?: number;
}

function isServerSide(): boolean {
  return typeof window === 'undefined';
}

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
  } catch (e) {
    throw new ValidationError(`Invalid URL provided: ${url}`);
  }

  // Verify server-side execution
  if (!isServerSide()) {
    throw new ServerSideError('secureServerFetch can only run on the server.');
  }

  const { apiKey, requireHttps, timeout = 30000, ...fetchOptions } = options;
  const headers = new Headers(fetchOptions.headers || {});
  if (apiKey) {
    headers.set('x-api-key', apiKey);
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, { 
      ...fetchOptions, 
      headers,
      signal: controller.signal 
    });
    
    clearTimeout(timeoutId);

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
    } catch (error) {
      throw new NetworkError(
        'Failed to parse JSON response',
        response.status,
        response.statusText,
        await response.text()
      );
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