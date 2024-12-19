export function sanitizeApiKey(key: string): string {
    return key.trim().replace(/\s+/g, '');
}

export function validateApiKey(key: string): boolean {
    // Ensure key is at least 32 characters long and contains a mix of characters
    const sanitizedKey = sanitizeApiKey(key);
    const hasMinLength = sanitizedKey.length >= 32;
    const hasValidChars = /^[A-Za-z0-9_\-]+$/.test(sanitizedKey);
    const hasMixedChars = /[A-Z]/.test(sanitizedKey) && 
                         /[a-z]/.test(sanitizedKey) && 
                         /[0-9]/.test(sanitizedKey);
    
    return hasMinLength && hasValidChars && hasMixedChars;
}

export function requireApiKey(request: Request, expectedKey: string): void | Response {
    // Validate expectedKey parameter
    if (!expectedKey || expectedKey.trim() === '') {
        throw new Error('Expected API key cannot be empty');
    }

    const sanitizedExpectedKey = sanitizeApiKey(expectedKey);
    if (!validateApiKey(sanitizedExpectedKey)) {
        throw new Error('Expected API key does not meet security requirements');
    }

    const providedKey = request.headers.get("x-api-key");
    
    // Check if API key header is present
    if (!providedKey) {
        return new Response("API key is missing. Please provide 'x-api-key' header", {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const sanitizedProvidedKey = sanitizeApiKey(providedKey);

    // Check if API key is empty
    if (sanitizedProvidedKey === '') {
        return new Response("API key cannot be empty", {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // Check if API key matches
    if (sanitizedProvidedKey !== sanitizedExpectedKey) {
        return new Response("Invalid API key", {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}