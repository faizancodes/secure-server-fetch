import { secureServerFetch, ValidationError, NetworkError, ServerSideError } from '../src/secureServerFetch';

// Mock fetch globally
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
(global as any).fetch = mockFetch;

describe('secureServerFetch', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    // Mock successful response by default
    mockFetch.mockImplementation(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: 'test' }),
        status: 200,
        statusText: 'OK',
        text: () => Promise.resolve('test')
      } as Response)
    );
  });

  it('should make successful requests', async () => {
    const result = await secureServerFetch('https://api.example.com');
    expect(result).toEqual({ data: 'test' });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.example.com',
      expect.objectContaining({
        headers: expect.any(Headers),
        signal: expect.any(AbortSignal)
      })
    );
  });

  it('should enforce HTTPS by default', async () => {
    await expect(
      secureServerFetch('http://api.example.com')
    ).rejects.toThrow(ValidationError);
  });

  it('should allow HTTP when requireHttps is false', async () => {
    await secureServerFetch('http://api.example.com', { requireHttps: false });
    expect(mockFetch).toHaveBeenCalled();
  });

  it('should handle API key in options', async () => {
    await secureServerFetch('https://api.example.com', {
      apiKey: 'test-key'
    });
    
    const fetchCall = mockFetch.mock.calls[0][1] as RequestInit;
    expect((fetchCall.headers as Headers).get('x-api-key')).toBe('test-key');
  });

  it('should handle network errors', async () => {
    mockFetch.mockImplementation(() => Promise.reject(new Error('Network error')));
    
    await expect(
      secureServerFetch('https://api.example.com')
    ).rejects.toThrow(NetworkError);
  });

  it('should handle non-200 responses', async () => {
    mockFetch.mockImplementation(() => 
      Promise.resolve({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: 'Not found' }),
        text: () => Promise.resolve('Not found')
      } as Response)
    );

    await expect(
      secureServerFetch('https://api.example.com')
    ).rejects.toThrow(NetworkError);
  });

  it('should handle JSON parse errors', async () => {
    mockFetch.mockImplementation(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON')),
        text: () => Promise.resolve('Invalid JSON'),
        status: 200,
        statusText: 'OK'
      } as Response)
    );

    await expect(
      secureServerFetch('https://api.example.com')
    ).rejects.toThrow(NetworkError);
  });

  // Mock window to test server-side check
  it('should throw error if run in browser environment', async () => {
    Object.defineProperty(global, 'window', {
      value: {},
      writable: true
    });

    await expect(
      secureServerFetch('https://api.example.com')
    ).rejects.toThrow(ServerSideError);

    delete (global as any).window;
  });
}); 