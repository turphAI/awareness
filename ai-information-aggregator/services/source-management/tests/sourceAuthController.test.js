const sourceAuthController = require('../controllers/sourceAuthController');
const Source = require('../models/Source');
const sourceAuthManager = require('../utils/sourceAuthManager');

// Mock dependencies
jest.mock('../models/Source');
jest.mock('../utils/sourceAuthManager');

// Create a mock axios object
const mockAxios = {
  get: jest.fn(),
  post: jest.fn()
};

// Replace the axios in sourceAuthController with our mock
sourceAuthController._setAxiosForTesting(mockAxios);

describe('Source Authentication Controller', () => {
  let req, res, next;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock request, response, and next function
    req = {
      params: {},
      body: {},
      query: {},
      user: { id: 'user123', isAdmin: false }
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    next = jest.fn();
  });

  describe('createAuthSession', () => {
    it('should create an authentication session successfully', async () => {
      // Mock source
      const mockSource = {
        _id: 'source123',
        name: 'Test Source',
        requiresAuthentication: true
      };
      
      Source.findOne.mockResolvedValueOnce(mockSource);
      
      // Mock successful session creation
      sourceAuthManager.createSession.mockResolvedValueOnce({
        success: true,
        sessionId: 'session123',
        expiresAt: new Date(),
        authType: 'basic'
      });
      
      // Set up request
      req.params.id = 'source123';
      req.body.credentials = { username: 'testuser', password: 'testpass' };
      
      // Call controller
      await sourceAuthController.createAuthSession(req, res, next);
      
      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        sessionId: 'session123'
      }));
      
      // Verify source was fetched correctly
      expect(Source.findOne).toHaveBeenCalledWith({
        _id: 'source123',
        createdBy: 'user123',
        active: true
      });
      
      // Verify session was created with correct parameters
      expect(sourceAuthManager.createSession).toHaveBeenCalledWith(
        mockSource,
        { username: 'testuser', password: 'testpass' }
      );
    });

    it('should handle source not found', async () => {
      // Mock source not found
      Source.findOne.mockResolvedValueOnce(null);
      
      // Set up request
      req.params.id = 'nonexistent';
      
      // Call controller
      await sourceAuthController.createAuthSession(req, res, next);
      
      // Verify error was passed to next
      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0][0].statusCode).toBe(404);
    });

    it('should handle source not requiring authentication', async () => {
      // Mock source that doesn't require authentication
      const mockSource = {
        _id: 'source123',
        name: 'Test Source',
        requiresAuthentication: false
      };
      
      Source.findOne.mockResolvedValueOnce(mockSource);
      
      // Set up request
      req.params.id = 'source123';
      
      // Call controller
      await sourceAuthController.createAuthSession(req, res, next);
      
      // Verify error was passed to next
      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0][0].statusCode).toBe(400);
    });

    it('should handle session creation failure', async () => {
      // Mock source
      const mockSource = {
        _id: 'source123',
        name: 'Test Source',
        requiresAuthentication: true
      };
      
      Source.findOne.mockResolvedValueOnce(mockSource);
      
      // Mock failed session creation
      sourceAuthManager.createSession.mockResolvedValueOnce({
        success: false,
        error: 'Authentication failed'
      });
      
      // Set up request
      req.params.id = 'source123';
      
      // Call controller
      await sourceAuthController.createAuthSession(req, res, next);
      
      // Verify error was passed to next
      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0][0].statusCode).toBe(400);
      expect(next.mock.calls[0][0].message).toBe('Authentication failed');
    });
  });

  describe('getAuthSession', () => {
    it('should get session information successfully', async () => {
      // Mock session
      const mockSession = {
        sourceId: 'source123',
        authType: 'basic',
        expiresAt: Date.now() + 3600000,
        data: { token: 'abc123' }
      };
      
      sourceAuthManager.getSession.mockReturnValueOnce(mockSession);
      
      // Mock source
      const mockSource = {
        _id: 'source123',
        name: 'Test Source'
      };
      
      Source.findOne.mockResolvedValueOnce(mockSource);
      
      // Set up request
      req.params.sessionId = 'session123';
      
      // Call controller
      await sourceAuthController.getAuthSession(req, res, next);
      
      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        sessionId: 'session123',
        sourceId: 'source123'
      }));
    });

    it('should handle session not found', async () => {
      // Mock session not found
      sourceAuthManager.getSession.mockReturnValueOnce(null);
      
      // Set up request
      req.params.sessionId = 'nonexistent';
      
      // Call controller
      await sourceAuthController.getAuthSession(req, res, next);
      
      // Verify error was passed to next
      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0][0].statusCode).toBe(404);
    });

    it('should handle unauthorized access to session', async () => {
      // Mock session
      const mockSession = {
        sourceId: 'source123',
        authType: 'basic',
        expiresAt: Date.now() + 3600000
      };
      
      sourceAuthManager.getSession.mockReturnValueOnce(mockSession);
      
      // Mock source not found (unauthorized)
      Source.findOne.mockResolvedValueOnce(null);
      
      // Set up request
      req.params.sessionId = 'session123';
      
      // Call controller
      await sourceAuthController.getAuthSession(req, res, next);
      
      // Verify error was passed to next
      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0][0].statusCode).toBe(403);
    });
  });

  describe('refreshAuthSession', () => {
    it('should refresh session successfully', async () => {
      // Mock session
      const mockSession = {
        sourceId: 'source123',
        authType: 'bearer',
        expiresAt: Date.now() + 3600000,
        data: { token: 'old-token' }
      };
      
      sourceAuthManager.getSession.mockReturnValueOnce(mockSession);
      
      // Mock source
      const mockSource = {
        _id: 'source123',
        name: 'Test Source'
      };
      
      Source.findOne.mockResolvedValueOnce(mockSource);
      
      // Mock successful refresh
      sourceAuthManager.refreshSession.mockResolvedValueOnce({
        success: true,
        sessionId: 'session123',
        expiresAt: new Date(),
        authType: 'bearer'
      });
      
      // Set up request
      req.params.sessionId = 'session123';
      
      // Call controller
      await sourceAuthController.refreshAuthSession(req, res, next);
      
      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        sessionId: 'session123'
      }));
      
      // Verify refresh was called with correct parameters
      expect(sourceAuthManager.refreshSession).toHaveBeenCalledWith(
        'session123',
        mockSource
      );
    });

    it('should handle refresh failure', async () => {
      // Mock session
      const mockSession = {
        sourceId: 'source123',
        authType: 'bearer',
        expiresAt: Date.now() + 3600000
      };
      
      sourceAuthManager.getSession.mockReturnValueOnce(mockSession);
      
      // Mock source
      const mockSource = {
        _id: 'source123',
        name: 'Test Source'
      };
      
      Source.findOne.mockResolvedValueOnce(mockSource);
      
      // Mock failed refresh
      sourceAuthManager.refreshSession.mockResolvedValueOnce({
        success: false,
        error: 'Refresh failed'
      });
      
      // Set up request
      req.params.sessionId = 'session123';
      
      // Call controller
      await sourceAuthController.refreshAuthSession(req, res, next);
      
      // Verify error was passed to next
      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0][0].statusCode).toBe(400);
      expect(next.mock.calls[0][0].message).toBe('Refresh failed');
    });
  });

  describe('deleteAuthSession', () => {
    it('should delete session successfully', async () => {
      // Mock session
      const mockSession = {
        sourceId: 'source123',
        authType: 'basic',
        expiresAt: Date.now() + 3600000
      };
      
      sourceAuthManager.getSession.mockReturnValueOnce(mockSession);
      
      // Mock source
      const mockSource = {
        _id: 'source123',
        name: 'Test Source'
      };
      
      Source.findOne.mockResolvedValueOnce(mockSource);
      
      // Mock successful deletion
      sourceAuthManager.deleteSession.mockReturnValueOnce(true);
      
      // Set up request
      req.params.sessionId = 'session123';
      
      // Call controller
      await sourceAuthController.deleteAuthSession(req, res, next);
      
      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        message: 'Session deleted successfully'
      }));
      
      // Verify delete was called with correct parameters
      expect(sourceAuthManager.deleteSession).toHaveBeenCalledWith('session123');
    });

    it('should handle already deleted session gracefully', async () => {
      // Mock session not found
      sourceAuthManager.getSession.mockReturnValueOnce(null);
      
      // Set up request
      req.params.sessionId = 'nonexistent';
      
      // Call controller
      await sourceAuthController.deleteAuthSession(req, res, next);
      
      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        message: 'Session already deleted or expired'
      }));
    });
  });

  describe('storeSourceCredentials', () => {
    it('should store credentials successfully', async () => {
      // Mock source
      const mockSource = {
        _id: 'source123',
        name: 'Test Source',
        requiresAuthentication: false,
        encryptCredentials: jest.fn().mockResolvedValueOnce({})
      };
      
      Source.findOne.mockResolvedValueOnce(mockSource);
      
      // Set up request
      req.params.id = 'source123';
      req.body.credentials = {
        username: 'testuser',
        password: 'testpass'
      };
      
      // Call controller
      await sourceAuthController.storeSourceCredentials(req, res, next);
      
      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        message: 'Credentials stored successfully'
      }));
      
      // Verify source was updated
      expect(mockSource.requiresAuthentication).toBe(true);
      expect(mockSource.encryptCredentials).toHaveBeenCalledWith({
        username: 'testuser',
        password: 'testpass'
      });
    });

    it('should handle invalid credentials', async () => {
      // Mock source
      const mockSource = {
        _id: 'source123',
        name: 'Test Source'
      };
      
      Source.findOne.mockResolvedValueOnce(mockSource);
      
      // Set up request with invalid credentials
      req.params.id = 'source123';
      req.body.credentials = null;
      
      // Call controller
      await sourceAuthController.storeSourceCredentials(req, res, next);
      
      // Verify error was passed to next
      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0][0].statusCode).toBe(400);
    });
  });

  describe('testSourceAuthentication', () => {
    it('should test authentication successfully', async () => {
      // Mock source
      const mockSource = {
        _id: 'source123',
        name: 'Test Source',
        url: 'https://example.com',
        requiresAuthentication: true
      };
      
      Source.findOne.mockResolvedValueOnce(mockSource);
      
      // Mock successful session creation
      sourceAuthManager.createSession.mockResolvedValueOnce({
        success: true,
        sessionId: 'session123'
      });
      
      // Mock auth headers
      sourceAuthManager.getAuthHeaders.mockReturnValueOnce({
        Authorization: 'Bearer test-token'
      });
      
      // Mock successful request
      mockAxios.get.mockResolvedValueOnce({
        status: 200
      });
      
      // Set up request
      req.params.id = 'source123';
      
      // Call controller
      await sourceAuthController.testSourceAuthentication(req, res, next);
      
      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        message: 'Authentication successful'
      }));
      
      // Verify session was deleted after test
      expect(sourceAuthManager.deleteSession).toHaveBeenCalledWith('session123');
    });

    it('should handle authentication test failure', async () => {
      // Mock source
      const mockSource = {
        _id: 'source123',
        name: 'Test Source',
        url: 'https://example.com',
        requiresAuthentication: true
      };
      
      Source.findOne.mockResolvedValueOnce(mockSource);
      
      // Mock successful session creation
      sourceAuthManager.createSession.mockResolvedValueOnce({
        success: true,
        sessionId: 'session123'
      });
      
      // Mock auth headers
      sourceAuthManager.getAuthHeaders.mockReturnValueOnce({
        Authorization: 'Bearer test-token'
      });
      
      // Mock failed request
      mockAxios.get.mockRejectedValueOnce(new Error('Connection refused'));
      
      // Set up request
      req.params.id = 'source123';
      
      // Call controller
      await sourceAuthController.testSourceAuthentication(req, res, next);
      
      // Verify error was passed to next
      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0][0].statusCode).toBe(400);
      
      // Verify session was deleted after test
      expect(sourceAuthManager.deleteSession).toHaveBeenCalledWith('session123');
    });
  });

  describe('updateAuthMetadata', () => {
    it('should update auth metadata successfully', async () => {
      // Mock source with existing metadata
      const mockSource = {
        _id: 'source123',
        name: 'Test Source',
        metadata: new Map([
          ['existingKey', 'existingValue'],
          ['authType', 'basic']
        ]),
        save: jest.fn().mockResolvedValueOnce({})
      };
      
      Source.findOne.mockResolvedValueOnce(mockSource);
      
      // Set up request
      req.params.id = 'source123';
      req.body.metadata = {
        authType: 'bearer',
        tokenUrl: 'https://example.com/token',
        nonAuthKey: 'should-not-be-included'
      };
      
      // Call controller
      await sourceAuthController.updateAuthMetadata(req, res, next);
      
      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        message: 'Authentication metadata updated successfully'
      }));
      
      // Verify metadata was updated correctly
      expect(mockSource.metadata.get('authType')).toBe('bearer');
      expect(mockSource.metadata.get('tokenUrl')).toBe('https://example.com/token');
      expect(mockSource.metadata.get('existingKey')).toBe('existingValue');
      expect(mockSource.metadata.has('nonAuthKey')).toBe(false);
      
      // Verify source was saved
      expect(mockSource.save).toHaveBeenCalled();
    });
  });
});