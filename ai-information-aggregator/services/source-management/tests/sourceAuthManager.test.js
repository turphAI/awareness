const sourceAuthManager = require('../utils/sourceAuthManager');

// Create a mock axios object
const mockAxios = {
  get: jest.fn(),
  post: jest.fn()
};

// Replace the axios in sourceAuthManager with our mock
sourceAuthManager._setAxiosForTesting(mockAxios);

// Mock environment variables
process.env.CREDENTIAL_ENCRYPTION_KEY = 'test-master-key-that-is-at-least-32-characters';

describe('Source Authentication Manager', () => {
  // Mock source object
  const mockSource = {
    _id: '5f7d8a9b9d3e2c1a3b5d7e9f',
    name: 'Test Source',
    url: 'https://example.com',
    requiresAuthentication: true,
    credentials: {
      encrypted: 'encrypted-data',
      iv: 'iv-data'
    },
    decryptCredentials: jest.fn(),
    metadata: new Map()
  };

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Reset sessions
    sourceAuthManager.sessions = new Map();
    
    // Mock decryptCredentials
    mockSource.decryptCredentials.mockReturnValue({
      username: 'testuser',
      password: 'testpassword'
    });
  });

  describe('Basic Authentication', () => {
    it('should create a basic auth session successfully', async () => {
      // Set auth type in metadata
      mockSource.metadata.set('authType', 'basic');
      
      // Mock mockAxios response for login test
      mockSource.metadata.set('loginUrl', 'https://example.com/login');
      mockAxios.get.mockResolvedValueOnce({ status: 200 });
      
      const session = await sourceAuthManager.createSession(mockSource);
      
      expect(session.success).toBe(true);
      expect(session.sessionId).toBeDefined();
      expect(session.expiresAt).toBeDefined();
      expect(session.authType).toBe('basic');
      
      // Verify mockAxios was called correctly
      expect(mockAxios.get).toHaveBeenCalledWith(
        'https://example.com/login',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.stringContaining('Basic ')
          })
        })
      );
    });

    it('should fail to create session with invalid credentials', async () => {
      // Set auth type in metadata
      mockSource.metadata.set('authType', 'basic');
      
      // Mock login failure
      mockSource.metadata.set('loginUrl', 'https://example.com/login');
      mockAxios.get.mockRejectedValueOnce(new Error('Authentication failed'));
      
      const session = await sourceAuthManager.createSession(mockSource);
      
      expect(session.success).toBe(false);
      expect(session.error).toBeDefined();
    });
  });

  describe('API Key Authentication', () => {
    it('should create an API key auth session successfully', async () => {
      // Set auth type in metadata
      mockSource.metadata.set('authType', 'api_key');
      mockSource.metadata.set('apiKeyHeader', 'X-Custom-API-Key');
      
      // Mock credentials
      mockSource.decryptCredentials.mockReturnValue({
        apiKey: 'test-api-key'
      });
      
      // Mock API test
      mockSource.metadata.set('apiTestUrl', 'https://example.com/api/test');
      mockAxios.get.mockResolvedValueOnce({ status: 200 });
      
      const session = await sourceAuthManager.createSession(mockSource);
      
      expect(session.success).toBe(true);
      expect(session.sessionId).toBeDefined();
      expect(session.authType).toBe('api_key');
      
      // Verify mockAxios was called correctly
      expect(mockAxios.get).toHaveBeenCalledWith(
        'https://example.com/api/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Custom-API-Key': 'test-api-key'
          })
        })
      );
      
      // Check auth headers
      const headers = sourceAuthManager.getAuthHeaders(session.sessionId);
      expect(headers).toHaveProperty('X-Custom-API-Key', 'test-api-key');
    });
  });

  describe('Bearer Token Authentication', () => {
    it('should use existing token if provided', async () => {
      // Set auth type in metadata
      mockSource.metadata.set('authType', 'bearer');
      
      // Mock credentials with existing token
      mockSource.decryptCredentials.mockReturnValue({
        token: 'existing-token',
        expiresAt: Date.now() + 3600000 // 1 hour from now
      });
      
      const session = await sourceAuthManager.createSession(mockSource);
      
      expect(session.success).toBe(true);
      expect(session.authType).toBe('bearer');
      
      // Check auth headers
      const headers = sourceAuthManager.getAuthHeaders(session.sessionId);
      expect(headers).toHaveProperty('Authorization', 'Bearer existing-token');
    });

    it('should request new token if needed', async () => {
      // Set auth type in metadata
      mockSource.metadata.set('authType', 'bearer');
      mockSource.metadata.set('tokenUrl', 'https://example.com/oauth/token');
      
      // Mock credentials without token
      mockSource.decryptCredentials.mockReturnValue({
        clientId: 'client-id',
        clientSecret: 'client-secret'
      });
      
      // Mock token response
      mockAxios.post.mockResolvedValueOnce({
        data: {
          access_token: 'new-token',
          expires_in: 3600,
          refresh_token: 'refresh-token'
        }
      });
      
      const session = await sourceAuthManager.createSession(mockSource);
      
      expect(session.success).toBe(true);
      expect(session.authType).toBe('bearer');
      
      // Verify mockAxios was called correctly
      expect(mockAxios.post).toHaveBeenCalledWith(
        'https://example.com/oauth/token',
        expect.objectContaining({
          grant_type: 'client_credentials',
          client_id: 'client-id',
          client_secret: 'client-secret'
        })
      );
      
      // Check auth headers
      const headers = sourceAuthManager.getAuthHeaders(session.sessionId);
      expect(headers).toHaveProperty('Authorization', 'Bearer new-token');
    });
  });

  describe('Cookie Authentication', () => {
    it('should create a cookie auth session successfully', async () => {
      // Set auth type in metadata
      mockSource.metadata.set('authType', 'cookie');
      mockSource.metadata.set('loginUrl', 'https://example.com/login');
      mockSource.metadata.set('usernameField', 'email');
      mockSource.metadata.set('passwordField', 'pass');
      
      // Mock login response with cookies
      mockAxios.post.mockResolvedValueOnce({
        status: 200,
        headers: {
          'set-cookie': [
            'session=abc123; Path=/; HttpOnly',
            'user=testuser; Path=/; HttpOnly'
          ]
        }
      });
      
      const session = await sourceAuthManager.createSession(mockSource);
      
      expect(session.success).toBe(true);
      expect(session.authType).toBe('cookie');
      
      // Verify mockAxios was called correctly with form data
      expect(mockAxios.post).toHaveBeenCalledWith(
        'https://example.com/login',
        expect.any(URLSearchParams),
        expect.anything()
      );
      
      // Check auth headers
      const headers = sourceAuthManager.getAuthHeaders(session.sessionId);
      expect(headers).toHaveProperty('Cookie');
      expect(headers.Cookie).toContain('session=abc123');
      expect(headers.Cookie).toContain('user=testuser');
    });
  });

  describe('Session Management', () => {
    it('should retrieve an existing session', async () => {
      // Create a session
      mockSource.metadata.set('authType', 'basic');
      const session = await sourceAuthManager.createSession(mockSource);
      
      // Get the session
      const retrievedSession = sourceAuthManager.getSession(session.sessionId);
      
      expect(retrievedSession).toBeDefined();
      expect(retrievedSession.sourceId).toBe(mockSource._id.toString());
      expect(retrievedSession.authType).toBe('basic');
    });

    it('should return null for non-existent session', () => {
      const retrievedSession = sourceAuthManager.getSession('non-existent-id');
      expect(retrievedSession).toBeNull();
    });

    it('should delete a session', async () => {
      // Create a session
      mockSource.metadata.set('authType', 'basic');
      const session = await sourceAuthManager.createSession(mockSource);
      
      // Delete the session
      const deleted = sourceAuthManager.deleteSession(session.sessionId);
      
      expect(deleted).toBe(true);
      
      // Try to get the deleted session
      const retrievedSession = sourceAuthManager.getSession(session.sessionId);
      expect(retrievedSession).toBeNull();
    });

    it('should clean up expired sessions', async () => {
      // Create a session with manual expiration
      mockSource.metadata.set('authType', 'basic');
      const session = await sourceAuthManager.createSession(mockSource);
      
      // Manually expire the session
      sourceAuthManager.sessions.set(session.sessionId, {
        ...sourceAuthManager.sessions.get(session.sessionId),
        expiresAt: Date.now() - 1000 // Expired 1 second ago
      });
      
      // Clean up expired sessions
      const expiredCount = sourceAuthManager.cleanupExpiredSessions();
      
      expect(expiredCount).toBe(1);
      
      // Try to get the expired session
      const retrievedSession = sourceAuthManager.getSession(session.sessionId);
      expect(retrievedSession).toBeNull();
    });
  });

  describe('Session Refresh', () => {
    it('should refresh a bearer token session', async () => {
      // Set auth type in metadata
      mockSource.metadata.set('authType', 'bearer');
      mockSource.metadata.set('tokenUrl', 'https://example.com/oauth/token');
      
      // Create initial session with expiring token
      const initialSession = {
        sourceId: mockSource._id.toString(),
        authType: 'bearer',
        data: {
          token: 'expiring-token',
          refreshToken: 'refresh-token',
          expiresAt: Date.now() - 1000 // Already expired
        },
        expiresAt: Date.now() + 3600000 // Session itself not expired
      };
      
      const sessionId = 'test-session-id';
      sourceAuthManager.sessions.set(sessionId, initialSession);
      
      // Mock token refresh response
      mockAxios.post.mockResolvedValueOnce({
        data: {
          access_token: 'new-refreshed-token',
          expires_in: 3600,
          refresh_token: 'new-refresh-token'
        }
      });
      
      // Refresh the session
      const refreshed = await sourceAuthManager.refreshSession(sessionId, mockSource);
      
      expect(refreshed.success).toBe(true);
      
      // Verify mockAxios was called correctly
      expect(mockAxios.post).toHaveBeenCalledWith(
        'https://example.com/oauth/token',
        expect.objectContaining({
          grant_type: 'refresh_token',
          refresh_token: 'refresh-token'
        })
      );
      
      // Check updated session
      const updatedSession = sourceAuthManager.getSession(sessionId);
      expect(updatedSession.data.token).toBe('new-refreshed-token');
      expect(updatedSession.data.refreshToken).toBe('new-refresh-token');
    });

    it('should refresh a cookie session when needed', async () => {
      // Set auth type in metadata
      mockSource.metadata.set('authType', 'cookie');
      mockSource.metadata.set('sessionCheckUrl', 'https://example.com/check-session');
      mockSource.metadata.set('loginUrl', 'https://example.com/login');
      
      // Create initial session
      const initialSession = {
        sourceId: mockSource._id.toString(),
        authType: 'cookie',
        data: {
          cookies: 'session=abc123; user=testuser'
        },
        expiresAt: Date.now() + 3600000 // Session not expired
      };
      
      const sessionId = 'test-session-id';
      sourceAuthManager.sessions.set(sessionId, initialSession);
      
      // Mock session check response (session expired)
      mockAxios.get.mockResolvedValueOnce({
        status: 401 // Unauthorized, session expired
      });
      
      // Mock login response for new session
      mockAxios.post.mockResolvedValueOnce({
        status: 200,
        headers: {
          'set-cookie': [
            'session=new123; Path=/; HttpOnly',
            'user=testuser; Path=/; HttpOnly'
          ]
        }
      });
      
      // Refresh the session
      const refreshed = await sourceAuthManager.refreshSession(sessionId, mockSource);
      
      expect(refreshed.success).toBe(true);
      
      // Check updated session
      const updatedSession = sourceAuthManager.getSession(sessionId);
      expect(updatedSession.data.cookies).toContain('session=new123');
    });
  });
  
  // Clean up interval to prevent memory leaks in tests
  afterAll(() => {
    sourceAuthManager._clearCleanupInterval();
  });
});