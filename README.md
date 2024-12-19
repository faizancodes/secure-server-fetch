# Secure Server Fetch

A secure, server-side HTTP client with built-in API key validation, rate limiting, and security features.

## Features

- 🔒 Server-side only execution
- 🔑 API key validation and requirement
- ⏱️ Rate limiting with Redis
- 🔐 HTTPS enforcement
- ⚡ Request timeout handling
- 🛡️ Comprehensive error handling

## Installation

```bash
npm install secure-server-fetch
# or
yarn add secure-server-fetch
```

## Environment Variables Setup

Create a `.env` file in your project root:

```env
UPSTASH_REDIS_REST_URL=your_redis_url
UPSTASH_REDIS_REST_TOKEN=your_redis_token
```

Both variables are required for rate limiting functionality. The Redis URL must be a valid HTTPS URL.

## Usage Examples

### Basic Fetch with API Key

```typescript
import { secureServerFetch } from 'secure-server-fetch';

async function fetchData() {
  try {
    const data = await secureServerFetch('https://api.example.com/data', {
      apiKey: 'your-api-key',
      timeout: 5000, // 5 seconds
    });
    return data;
  } catch (error) {
    console.error('Fetch failed:', error);
  }
}
```

### API Key Validation

```typescript
import { requireApiKey } from 'secure-server-fetch';

// In your API route handler
export async function handler(request: Request) {
  const apiKeyCheck = requireApiKey(request, 'your-expected-api-key');
  if (apiKeyCheck) {
    return apiKeyCheck; // Returns 401 response if validation fails
  }
  
  // Continue with your API logic
}
```

#### API Key Requirements

The API key validation enforces the following requirements:

- **Length**: Must be at least 32 characters long
- **Character Set**: Can only contain:
  - Uppercase letters (A-Z)
  - Lowercase letters (a-z)
  - Numbers (0-9)
  - Underscores (_)
  - Hyphens (-)
- **Character Mix**: Must contain at least:
  - One uppercase letter
  - One lowercase letter
  - One number

#### Error Responses

All error responses are returned in JSON format with appropriate HTTP status codes:

1. **Missing API Key** (Status: 401)
```json
{
  "error": "API key is missing",
  "message": "Please provide 'x-api-key' header with a valid API key",
  "requirements": {
    "format": "Must be at least 32 characters long",
    "characters": "Can only contain letters, numbers, underscores, and hyphens",
    "complexity": "Must contain at least one uppercase letter, one lowercase letter, and one number"
  }
}
```

2. **Empty API Key** (Status: 401)
```json
{
  "error": "Empty API key",
  "message": "API key cannot be empty",
  "requirements": {
    "format": "Must be at least 32 characters long",
    "characters": "Can only contain letters, numbers, underscores, and hyphens",
    "complexity": "Must contain at least one uppercase letter, one lowercase letter, and one number"
  }
}
```

3. **Invalid Format** (Status: 401)
```json
{
  "error": "Invalid API key format",
  "message": "[Specific validation error message]",
  "requirements": {
    "format": "Must be at least 32 characters long",
    "characters": "Can only contain letters, numbers, underscores, and hyphens",
    "complexity": "Must contain at least one uppercase letter, one lowercase letter, and one number"
  }
}
```

4. **Invalid API Key** (Status: 401)
```json
{
  "error": "Invalid API key",
  "message": "The provided API key is not valid"
}
```

### Rate Limiting

```typescript
import { rateLimit } from 'secure-server-fetch';

async function handleRequest(request: Request) {
  try {
    const rateLimitResult = await rateLimit(request, 'unique-identifier', {
      maxRequests: 100,
      timeframeMs: 60000, // 1 minute
    });

    // Rate limit headers will be automatically included in rateLimitResult.headers
    
    // Your API logic here
    
  } catch (error) {
    if (error.name === 'RateLimitError') {
      return new Response('Rate limit exceeded', { status: 429 });
    }
  }
}
```

## API Reference

### secureServerFetch(url, options)

Makes a secure server-side HTTP request.

#### Options

- `apiKey?: string` - API key for authentication
- `requireHttps?: boolean` - Enforce HTTPS (default: true)
- `timeout?: number` - Request timeout in ms (default: 30000)
- `...RequestInit` - All standard fetch options

### requireApiKey(request, expectedKey)

Validates API key from request headers.

- `request: Request` - Incoming request object
- `expectedKey: string` - The API key to validate against

### rateLimit(request, identifier, options)

Implements rate limiting for requests.

#### Options

- `maxRequests: number` - Maximum requests allowed
- `timeframeMs: number` - Time window in milliseconds
- `prefix?: string` - Redis key prefix

## Security Best Practices

1. **API Keys**
   - Use keys at least 32 characters long
   - Include mix of uppercase, lowercase, and numbers
   - Rotate keys periodically
   - Store keys securely in environment variables

2. **Rate Limiting**
   - Implement rate limiting on all public endpoints
   - Use unique identifiers (e.g., IP, user ID)
   - Set appropriate limits based on endpoint sensitivity

3. **HTTPS**
   - Always use HTTPS in production
   - Only disable HTTPS requirement in development

4. **Error Handling**
   - Never expose internal errors to clients
   - Use provided error classes for consistent handling
   - Log errors securely

## Error Handling

The library provides specific error classes:

- `ServerSideError`: For client-side execution attempts
- `NetworkError`: For network and HTTP errors
- `ValidationError`: For input validation failures
- `RateLimitError`: For rate limit violations

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests.

## License

MIT 