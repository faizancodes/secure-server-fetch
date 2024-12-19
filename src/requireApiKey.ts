export function sanitizeApiKey(key: string): string {
    return key.trim().replace(/\s+/g, '');
}

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

    // Check if API key matches
    if (sanitizedProvidedKey !== sanitizedExpectedKey) {
        return new Response(JSON.stringify({
            error: "Invalid API key",
            message: "The provided API key is not valid"
        }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}