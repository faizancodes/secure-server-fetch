import { requireApiKey, sanitizeApiKey, validateApiKey } from '../src/requireApiKey';

describe('API Key Validation', () => {
  const validApiKey = 'Test123456789ABCDEF123456789abcdef';

  describe('sanitizeApiKey', () => {
    it('should remove whitespace', () => {
      expect(sanitizeApiKey(' abc123 ')).toBe('abc123');
      expect(sanitizeApiKey('abc 123')).toBe('abc123');
    });
  });

  describe('validateApiKey', () => {
    it('should validate correct API keys', () => {
      expect(validateApiKey(validApiKey)).toEqual({ isValid: true });
    });

    it('should reject short API keys', () => {
      expect(validateApiKey('Test123')).toEqual({
        isValid: false,
        error: "API key must be at least 32 characters long"
      });
    });

    it('should reject keys without mixed case', () => {
      expect(validateApiKey('test123456789abcdef123456789abcdef')).toEqual({
        isValid: false,
        error: "API key must contain at least one uppercase letter, one lowercase letter, and one number"
      });
      expect(validateApiKey('TEST123456789ABCDEF123456789ABCDEF')).toEqual({
        isValid: false,
        error: "API key must contain at least one uppercase letter, one lowercase letter, and one number"
      });
    });

    it('should reject keys without numbers', () => {
      expect(validateApiKey('TestABCDEFGHIJKLMNOPQRSTUVWXYZabcd')).toEqual({
        isValid: false,
        error: "API key must contain at least one uppercase letter, one lowercase letter, and one number"
      });
    });
  });

  describe('requireApiKey', () => {
    it('should pass with correct API key', () => {
      const request = new Request('https://api.example.com', {
        headers: { 'x-api-key': validApiKey }
      });
      const result = requireApiKey(request, validApiKey);
      expect(result).toBeUndefined();
    });

    it('should reject missing API key', () => {
      const request = new Request('https://api.example.com');
      const result = requireApiKey(request, validApiKey);
      expect(result).toBeInstanceOf(Response);
      expect(result?.status).toBe(401);
    });

    it('should reject invalid API key', () => {
      const request = new Request('https://api.example.com', {
        headers: { 'x-api-key': 'wrongkey' }
      });
      const result = requireApiKey(request, validApiKey);
      expect(result).toBeInstanceOf(Response);
      expect(result?.status).toBe(401);
    });

    it('should throw error with empty expected key', () => {
      const request = new Request('https://api.example.com');
      expect(() => requireApiKey(request, '')).toThrow('Expected API key cannot be empty');
    });

    it('should throw error with invalid expected key format', () => {
      const request = new Request('https://api.example.com');
      expect(() => requireApiKey(request, 'invalid-key')).toThrow('Expected API key does not meet security requirements');
    });
  });
}); 