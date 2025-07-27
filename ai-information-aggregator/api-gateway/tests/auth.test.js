/**
 * Unit tests for authentication middleware
 */

const jwt = require('jsonwebtoken');
const {
  authenticateJWT,
  requireRole,
  requirePermission,
  optionalAuth,
  requireAdmin,
  requireUser,
  requireOwnership,
  rateLimitByUser
} = require('../middleware/auth');

// Mock dependencies
jest.mock('jsonwebtoken');
jest.mock('../utils/logger');

describe('Authentication Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {},
      ip: '127.0.0.1',
      path: '/test',
      method: 'GET',
      params: {},
      get: jest.fn().mockReturnValue('test-user-agent')
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    
    next = jest.fn();
    
    process.env.JWT_SECRET = 'test-secret';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('authenticateJWT', () => {
    test('should authenticate valid JWT token', () => {
      const mockUser = {
        id: 'user123',
        email: 'test@example.com',
        role: 'user',
        permissions: ['read']
      };

      req.headers.authorization = 'Bearer valid-token';
      jwt.verify.mockReturnValue(mockUser);

      authenticateJWT(req, res, next);

      expect(jwt.verify).toHaveBeenCalledWith('valid-token', 'test-secret');
      expect(req.user).toEqual(mockUser);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should reject request without authorization header', () => {
      authenticateJWT(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Authentication required',
        message: 'Authorization header is missing'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should reject request with malformed authorization header', () => {
      req.headers.authorization = 'InvalidFormat';

      authenticateJWT(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Authentication required',
        message: 'Bearer token is missing'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should handle expired token', () => {
      req.headers.authorization = 'Bearer expired-token';
      const error = new Error('Token expired');
      error.name = 'TokenExpiredError';
      jwt.verify.mockImplementation(() => {
        throw error;
      });

      authenticateJWT(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Token expired',
        message: 'Please log in again'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should handle invalid token', () => {
      req.headers.authorization = 'Bearer invalid-token';
      const error = new Error('Invalid token');
      error.name = 'JsonWebTokenError';
      jwt.verify.mockImplementation(() => {
        throw error;
      });

      authenticateJWT(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid token',
        message: 'Token is malformed or invalid'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should handle generic JWT error', () => {
      req.headers.authorization = 'Bearer error-token';
      jwt.verify.mockImplementation(() => {
        throw new Error('Generic error');
      });

      authenticateJWT(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Authentication failed',
        message: 'Token verification failed'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('requireRole', () => {
    beforeEach(() => {
      req.user = {
        id: 'user123',
        email: 'test@example.com',
        role: 'user',
        permissions: []
      };
    });

    test('should allow access with correct role', () => {
      const middleware = requireRole('user');
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should allow access with one of multiple roles', () => {
      const middleware = requireRole(['user', 'admin']);
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should deny access with incorrect role', () => {
      const middleware = requireRole('admin');
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Access denied',
        message: 'Insufficient permissions to access this resource'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should deny access without authentication', () => {
      delete req.user;
      const middleware = requireRole('user');
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Authentication required',
        message: 'User must be authenticated to access this resource'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('requirePermission', () => {
    beforeEach(() => {
      req.user = {
        id: 'user123',
        email: 'test@example.com',
        role: 'user',
        permissions: ['read', 'write']
      };
    });

    test('should allow access with correct permission', () => {
      const middleware = requirePermission('read');
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should allow access with all required permissions', () => {
      const middleware = requirePermission(['read', 'write']);
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should deny access without required permission', () => {
      const middleware = requirePermission('admin');
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Access denied',
        message: 'Insufficient permissions to access this resource'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should deny access without authentication', () => {
      delete req.user;
      const middleware = requirePermission('read');
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('optionalAuth', () => {
    test('should continue without authentication when no header present', () => {
      optionalAuth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeUndefined();
    });

    test('should authenticate when valid token present', () => {
      const mockUser = {
        id: 'user123',
        email: 'test@example.com',
        role: 'user',
        permissions: []
      };

      req.headers.authorization = 'Bearer valid-token';
      jwt.verify.mockReturnValue(mockUser);

      optionalAuth(req, res, next);

      expect(req.user).toEqual(mockUser);
      expect(next).toHaveBeenCalled();
    });

    test('should continue without authentication when token is invalid', () => {
      req.headers.authorization = 'Bearer invalid-token';
      jwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      optionalAuth(req, res, next);

      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('requireOwnership', () => {
    beforeEach(() => {
      req.user = {
        id: 'user123',
        email: 'test@example.com',
        role: 'user',
        permissions: []
      };
      req.params = { id: 'user123' };
    });

    test('should allow access to own resource', () => {
      const middleware = requireOwnership();
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should allow admin access to any resource', () => {
      req.user.role = 'admin';
      req.params.id = 'other-user';
      
      const middleware = requireOwnership();
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should deny access to other user resource', () => {
      req.params.id = 'other-user';
      
      const middleware = requireOwnership();
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Access denied',
        message: 'You can only access your own resources'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should use custom resource ID parameter', () => {
      req.params = { userId: 'user123' };
      
      const middleware = requireOwnership('userId');
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('rateLimitByUser', () => {
    beforeEach(() => {
      req.user = {
        id: 'user123',
        email: 'test@example.com',
        role: 'user',
        permissions: []
      };
    });

    test('should allow requests within limit', () => {
      const storage = new Map();
      const middleware = rateLimitByUser(5, 60000, storage);
      
      // Make 3 requests
      for (let i = 0; i < 3; i++) {
        middleware(req, res, next);
      }

      expect(next).toHaveBeenCalledTimes(3);
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should block requests exceeding limit', () => {
      const storage = new Map();
      const middleware = rateLimitByUser(2, 60000, storage);
      
      // Reset mocks for this test
      jest.clearAllMocks();
      
      // Make 3 requests (exceeding limit of 2)
      middleware(req, res, next);
      middleware(req, res, next);
      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(2);
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Rate limit exceeded'
        })
      );
    });

    test('should continue without user authentication', () => {
      delete req.user;
      const storage = new Map();
      const middleware = rateLimitByUser(5, 60000, storage);
      
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('Convenience middlewares', () => {
    test('requireAdmin should require admin role', () => {
      req.user = { role: 'user' };
      requireAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    test('requireUser should allow user role', () => {
      req.user = { role: 'user' };
      requireUser(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});