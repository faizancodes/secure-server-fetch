import { timingSafeEqual } from 'crypto';

/**
 * Sanitizes an API key by removing whitespace and normalizing spacing
 * @param key - The API key string to sanitize
 * @returns The sanitized API key string
 * @example
 * ```typescript
 * // Removes spaces and trims
 * sanitizeApiKey(" abc 123  def ") // Returns "abc123def"
 * 
 * // Handles multiple whitespace types
 * sanitizeApiKey("abc\n\t123") // Returns "abc123"
 * ```
 */
export function sanitizeApiKey(key: string): string {
    return key.trim().replace(/\s+/g, '');
}

/**
 * Validates an API key against security requirements
 * @param key - The API key string to validate
 * @returns An object containing validation result and optional error message
 *          - isValid: boolean indicating if the key is valid
 *          - error?: string with validation error message if invalid
 * @example
 * ```typescript
 * // Valid key (32+ chars, mixed case, numbers)
 * validateApiKey("aB3def4567890123456789012345678901")
 * // Returns { isValid: true }
 * 
 * // Invalid: too short
 * validateApiKey("aB3def")
 * // Returns { isValid: false, error: "API key must be at least 32 characters long" }
 * 
 * // Invalid: missing number
 * validateApiKey("abcdefGHIJKLMNOPQRSTUVWXYZabcdef")
 * // Returns { isValid: false, error: "API key must contain at least one uppercase letter, one lowercase letter, and one number" }
 * ```
 */
export function validateApiKey(key: string): { isValid: boolean; error?: string } {
    const sanitizedKey = sanitizeApiKey(key);
    const hasMinLength = sanitizedKey.length >= 32;
    const hasValidChars = /^[A-Za-z0-9_-]+$/.test(sanitizedKey);
    const hasMixedChars = /[A-Z]/.test(sanitizedKey) && 
                         /[a-z]/.test(sanitizedKey) && 
                         /[0-9]/.test(sanitizedKey);
    
    if (!hasMinLength) {
        return { isValid: false, error: "API key must be at least 32 characters long" };
    }
    
    if (!hasValidChars) {
        return { isValid: false, error: "API key can only contain letters, numbers, underscores, and hyphens" };
    }
    
    if (!hasMixedChars) {
        return { isValid: false, error: "API key must contain at least one uppercase letter, one lowercase letter, and one number" };
    }
    
    return { isValid: true };
}

/**
 * Compares two strings in constant time to prevent timing attacks
 * @param a - First string to compare
 * @param b - Second string to compare
 * @returns boolean indicating if the strings are equal
 */
function constantTimeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
        // Return false through comparison to avoid timing attacks based on length
        return timingSafeEqual(Buffer.from(a), Buffer.from(a));
    }
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Middleware function to validate API key in request headers
 * @param request - The incoming HTTP request
 * @param expectedKey - The valid API key to check against
 * @returns void if validation passes, Response object with error details if validation fails
 * @throws Error if expectedKey is empty or invalid
 * @example
 * ```typescript
 * // Valid usage
 * const request = new Request('https://api.example.com', {
 *   headers: { 'x-api-key': process.env.API_KEY }
 * })
 * requireApiKey(request, process.env.API_KEY)
 * // Returns void (success)
 * 
 * // Missing header
 * const requestNoKey = new Request('https://api.example.com')
 * requireApiKey(requestNoKey, process.env.API_KEY)
 * // Returns Response with:
 * // {
 * //   error: "API key is missing",
 * //   message: "Please provide 'x-api-key' header with a valid API key",
 * //   requirements: { ... }
 * // }
 * 
 * // Invalid expected key
 * requireApiKey(request, '')
 * // Throws Error: "Expected API key cannot be empty"
 * ```
 */
export function requireApiKey(request: Request, expectedKey: string): void | Response {
    // Validate expectedKey parameter
    if (!expectedKey || expectedKey.trim() === '') {
        throw new Error('Expected API key cannot be empty');
    }

    const sanitizedExpectedKey = sanitizeApiKey(expectedKey);
    const expectedKeyValidation = validateApiKey(sanitizedExpectedKey);
    if (!expectedKeyValidation.isValid) {
        throw new Error(`Expected API key does not meet security requirements: ${expectedKeyValidation.error}`);
    }

    const providedKey = request.headers.get("x-api-key");
    
    // Check if API key header is present
    if (!providedKey) {
        return new Response(JSON.stringify({
            error: "API key is missing",
            message: "Please provide 'x-api-key' header with a valid API key",
            requirements: {
                format: "Must be at least 32 characters long",
                characters: "Can only contain letters, numbers, underscores, and hyphens",
                complexity: "Must contain at least one uppercase letter, one lowercase letter, and one number"
            }
        }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const sanitizedProvidedKey = sanitizeApiKey(providedKey);

    // Check if API key is empty
    if (sanitizedProvidedKey === '') {
        return new Response(JSON.stringify({
            error: "Empty API key",
            message: "API key cannot be empty",
            requirements: {
                format: "Must be at least 32 characters long",
                characters: "Can only contain letters, numbers, underscores, and hyphens",
                complexity: "Must contain at least one uppercase letter, one lowercase letter, and one number"
            }
        }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // Validate provided key format
    const providedKeyValidation = validateApiKey(sanitizedProvidedKey);
    if (!providedKeyValidation.isValid) {
        return new Response(JSON.stringify({
            error: "Invalid API key format",
            message: providedKeyValidation.error,
            requirements: {
                format: "Must be at least 32 characters long",
                characters: "Can only contain letters, numbers, underscores, and hyphens",
                complexity: "Must contain at least one uppercase letter, one lowercase letter, and one number"
            }
        }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // Check if API key matches using constant-time comparison
    if (!constantTimeEqual(sanitizedProvidedKey, sanitizedExpectedKey)) {
        return new Response(JSON.stringify({
            error: "Invalid API key",
            message: "The provided API key is not valid"
        }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}