const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { authenticate, authorize, hasPermission, isOwnerOrHasRole } = require('../middleware/auth');
const User = require('../models/User');
const { ApiError } = require('../../../common/utils/errorHandler');
const { PERMISSIONS } = require('../utils/roles');

// Mock User model
jest.mock('../models/User');

// Mock logger
jest.mock('../../../common/utils/logger', () => {
  return () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  });
});

describe('Authentication Middleware', () => {
  let req, res, next;
  
  beforeEach(() => {
    req = {
      headers: {},
      cookies: {}
    };
    res = {};
    next = jest.fn();
    
    // Reset mocks
    User.findOne.mockReset();
    jwt.verify = jest.fn();
  });
  
  describe('authenticate', () => {
    it('should authenticate user with valid token in header', async () => {
      // Setup
      const userId = new mongoose.Types.ObjectId();
      const user = {
        _id: userId,
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        emailVerified: true,
        active: true
      };
      
      req.headers.authorization = 'Bearer valid-token';
      jwt.verify.mockReturnValue({ id: userId, role: 'user' });
      User.findOne.mockResolvedValue(user);
      
      // Execute
      await authenticate(req, res, next);
      
      // Assert
      expect(jwt.verify).toHaveBeenCalledWith('valid-token', expect.any(String));
      expect(User.findOne).toHaveBeenCalledWith({ _id: userId, active: true });
      expect(req.user).toBeDefined();
      expect(req.user.id).toEqual(userId);
      expect(req.user.role).toBe('user');
      expect(next).toHaveBeenCalled();
    });
    
    it('should authenticate user with valid token in cookie', async () => {
      // Setup
      const userId = new mongoose.Types.ObjectId();
      const user = {
        _id: userId,
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        emailVerified: true,
        active: true
      };
      
      req.cookies.token = 'valid-token';
      jwt.verify.mockReturnValue({ id: userId, role: 'user' });
      User.findOne.mockResolvedValue(user);
      
      // Execute
      await authenticate(req, res, next);
      
      // Assert
      expect(jwt.verify).toHaveBeenCalledWith('valid-token', expect.any(String));
      expect(User.findOne).toHaveBeenCalledWith({ _id: userId, active: true });
      expect(req.user).toBeDefined();
      expect(req.user.id).toEqual(userId);
      expect(req.user.role).toBe('user');
      expect(next).toHaveBeenCalled();
    });
    
    it('should return error if no token provided', async () => {
      // Execute
      await authenticate(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(ApiError));
      expect(next.mock.calls[0][0].statusCode).toBe(401);
      expect(next.mock.calls[0][0].message).toBe('Not authorized to access this route');
    });
    
    it('should return error if token is invalid', async () => {
      // Setup
      req.headers.authorization = 'Bearer invalid-token';
      jwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });
      
      // Execute
      await authenticate(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(ApiError));
      expect(next.mock.calls[0][0].statusCode).toBe(401);
      expect(next.mock.calls[0][0].message).toBe('Not authorized to access this route');
    });
    
    it('should return error if user not found', async () => {
      // Setup
      const userId = new mongoose.Types.ObjectId();
      req.headers.authorization = 'Bearer valid-token';
      jwt.verify.mockReturnValue({ id: userId, role: 'user' });
      User.findOne.mockResolvedValue(null);
      
      // Execute
      await authenticate(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(ApiError));
      expect(next.mock.calls[0][0].statusCode).toBe(401);
      expect(next.mock.calls[0][0].message).toBe('Not authorized to access this route');
    });
  });
  
  describe('authorize', () => {
    beforeEach(() => {
      req.user = {
        id: new mongoose.Types.ObjectId(),
        email: 'test@example.com',
        role: 'user'
      };
    });
    
    it('should authorize user with correct role', () => {
      // Setup
      const authMiddleware = authorize('user');
      
      // Execute
      authMiddleware(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0][0]).toBeUndefined();
    });
    
    it('should authorize user with any of the specified roles', () => {
      // Setup
      const authMiddleware = authorize('editor', 'user', 'moderator');
      
      // Execute
      authMiddleware(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0][0]).toBeUndefined();
    });
    
    it('should authorize admin regardless of specified roles', () => {
      // Setup
      req.user.role = 'admin';
      const authMiddleware = authorize('editor', 'moderator');
      
      // Execute
      authMiddleware(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0][0]).toBeUndefined();
    });
    
    it('should return error if user does not have required role', () => {
      // Setup
      const authMiddleware = authorize('editor', 'moderator');
      
      // Execute
      authMiddleware(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(ApiError));
      expect(next.mock.calls[0][0].statusCode).toBe(403);
      expect(next.mock.calls[0][0].message).toBe('You do not have permission to access this resource');
    });
    
    it('should return error if user is not authenticated', () => {
      // Setup
      req.user = undefined;
      const authMiddleware = authorize('user');
      
      // Execute
      authMiddleware(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(ApiError));
      expect(next.mock.calls[0][0].statusCode).toBe(401);
      expect(next.mock.calls[0][0].message).toBe('Not authorized to access this route');
    });
  });
  
  describe('hasPermission', () => {
    beforeEach(() => {
      req.user = {
        id: new mongoose.Types.ObjectId(),
        email: 'test@example.com',
        role: 'user'
      };
    });
    
    it('should authorize user with correct permission', () => {
      // Setup
      const permissionMiddleware = hasPermission(PERMISSIONS.READ_CONTENT);
      
      // Execute
      permissionMiddleware(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0][0]).toBeUndefined();
    });
    
    it('should authorize admin regardless of permission', () => {
      // Setup
      req.user.role = 'admin';
      const permissionMiddleware = hasPermission(PERMISSIONS.MANAGE_SYSTEM);
      
      // Execute
      permissionMiddleware(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0][0]).toBeUndefined();
    });
    
    it('should return error if user does not have required permission', () => {
      // Setup
      const permissionMiddleware = hasPermission(PERMISSIONS.MANAGE_SYSTEM);
      
      // Execute
      permissionMiddleware(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(ApiError));
      expect(next.mock.calls[0][0].statusCode).toBe(403);
      expect(next.mock.calls[0][0].message).toBe('You do not have permission to perform this action');
    });
    
    it('should return error if user is not authenticated', () => {
      // Setup
      req.user = undefined;
      const permissionMiddleware = hasPermission(PERMISSIONS.READ_CONTENT);
      
      // Execute
      permissionMiddleware(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(ApiError));
      expect(next.mock.calls[0][0].statusCode).toBe(401);
      expect(next.mock.calls[0][0].message).toBe('Not authorized to access this route');
    });
  });
  
  describe('isOwnerOrHasRole', () => {
    const resourceUserId = new mongoose.Types.ObjectId();
    const getResourceUserId = jest.fn().mockResolvedValue(resourceUserId);
    
    beforeEach(() => {
      req.user = {
        id: new mongoose.Types.ObjectId(), // Different from resourceUserId
        email: 'test@example.com',
        role: 'user'
      };
      getResourceUserId.mockClear();
    });
    
    it('should authorize if user is the owner', async () => {
      // Setup
      req.user.id = resourceUserId; // Same as resourceUserId
      const ownerMiddleware = isOwnerOrHasRole(getResourceUserId);
      
      // Execute
      await ownerMiddleware(req, res, next);
      
      // Assert
      expect(getResourceUserId).toHaveBeenCalledWith(req);
      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0][0]).toBeUndefined();
    });
    
    it('should authorize if user has specified role', async () => {
      // Setup
      req.user.role = 'editor';
      const ownerMiddleware = isOwnerOrHasRole(getResourceUserId, 'editor', 'moderator');
      
      // Execute
      await ownerMiddleware(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0][0]).toBeUndefined();
      expect(getResourceUserId).not.toHaveBeenCalled(); // Should not check ownership
    });
    
    it('should authorize admin regardless of ownership or roles', async () => {
      // Setup
      req.user.role = 'admin';
      const ownerMiddleware = isOwnerOrHasRole(getResourceUserId);
      
      // Execute
      await ownerMiddleware(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0][0]).toBeUndefined();
      expect(getResourceUserId).not.toHaveBeenCalled(); // Should not check ownership
    });
    
    it('should return error if user is not owner and does not have required role', async () => {
      // Setup
      const ownerMiddleware = isOwnerOrHasRole(getResourceUserId, 'editor', 'moderator');
      
      // Execute
      await ownerMiddleware(req, res, next);
      
      // Assert
      expect(getResourceUserId).toHaveBeenCalledWith(req);
      expect(next).toHaveBeenCalledWith(expect.any(ApiError));
      expect(next.mock.calls[0][0].statusCode).toBe(403);
      expect(next.mock.calls[0][0].message).toBe('You do not have permission to access this resource');
    });
    
    it('should return error if user is not authenticated', async () => {
      // Setup
      req.user = undefined;
      const ownerMiddleware = isOwnerOrHasRole(getResourceUserId);
      
      // Execute
      await ownerMiddleware(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(ApiError));
      expect(next.mock.calls[0][0].statusCode).toBe(401);
      expect(next.mock.calls[0][0].message).toBe('Not authorized to access this route');
      expect(getResourceUserId).not.toHaveBeenCalled();
    });
  });
});