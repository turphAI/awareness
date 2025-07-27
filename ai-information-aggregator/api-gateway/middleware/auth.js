/**
 * Authentication middleware for API Gateway
 * Handles JWT token validation and role-based access control
 */

const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

/**
 * JWT Authentication middleware
 */
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    logger.warn('Authentication attempt without authorization header', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path
    });
    
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Authorization header is missing'
    });
  }

  const token = authHeader.split(' ')[1];
  
  if (!token) {
    logger.warn('Authentication attempt with malformed authorization header', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path
    });
    
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Bearer token is missing'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Add user information to request
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      permissions: decoded.permissions || []
    };

    logger.info('User authenticated successfully', {
      userId: req.user.id,
      role: req.user.role,
      path: req.path
    });

    next();
  } catch (error) {
    logger.warn('JWT verification failed', {
      error: error.message,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path
    });

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired',
        message: 'Please log in again'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Token is malformed or invalid'
      });
    }

    return res.status(401).json({
      error: 'Authentication failed',
      message: 'Token verification failed'
    });
  }
};

/**
 * Role-based access control middleware
 */
const requireRole = (requiredRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      logger.error('Role check attempted without authentication', {
        path: req.path,
        method: req.method
      });
      
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User must be authenticated to access this resource'
      });
    }

    const userRole = req.user.role;
    const allowedRoles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];

    if (!allowedRoles.includes(userRole)) {
      logger.warn('Access denied due to insufficient role', {
        userId: req.user.id,
        userRole: userRole,
        requiredRoles: allowedRoles,
        path: req.path,
        method: req.method
      });

      return res.status(403).json({
        error: 'Access denied',
        message: 'Insufficient permissions to access this resource'
      });
    }

    logger.info('Role-based access granted', {
      userId: req.user.id,
      userRole: userRole,
      path: req.path
    });

    next();
  };
};

/**
 * Permission-based access control middleware
 */
const requirePermission = (requiredPermissions) => {
  return (req, res, next) => {
    if (!req.user) {
      logger.error('Permission check attempted without authentication', {
        path: req.path,
        method: req.method
      });
      
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User must be authenticated to access this resource'
      });
    }

    const userPermissions = req.user.permissions || [];
    const requiredPerms = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];

    const hasPermission = requiredPerms.every(permission => 
      userPermissions.includes(permission)
    );

    if (!hasPermission) {
      logger.warn('Access denied due to insufficient permissions', {
        userId: req.user.id,
        userPermissions: userPermissions,
        requiredPermissions: requiredPerms,
        path: req.path,
        method: req.method
      });

      return res.status(403).json({
        error: 'Access denied',
        message: 'Insufficient permissions to access this resource'
      });
    }

    logger.info('Permission-based access granted', {
      userId: req.user.id,
      permissions: requiredPerms,
      path: req.path
    });

    next();
  };
};

/**
 * Optional authentication middleware
 * Adds user info if token is present but doesn't require it
 */
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return next();
  }

  const token = authHeader.split(' ')[1];
  
  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      permissions: decoded.permissions || []
    };

    logger.info('Optional authentication successful', {
      userId: req.user.id,
      path: req.path
    });
  } catch (error) {
    logger.debug('Optional authentication failed, continuing without user', {
      error: error.message,
      path: req.path
    });
  }

  next();
};

/**
 * Admin-only access middleware
 */
const requireAdmin = requireRole(['admin', 'super_admin']);

/**
 * User or admin access middleware
 */
const requireUser = requireRole(['user', 'admin', 'super_admin']);

/**
 * Resource ownership check middleware
 * Ensures user can only access their own resources
 */
const requireOwnership = (resourceIdParam = 'id') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User must be authenticated to access this resource'
      });
    }

    // Admin users can access any resource
    if (req.user.role === 'admin' || req.user.role === 'super_admin') {
      return next();
    }

    const resourceId = req.params[resourceIdParam];
    const userId = req.user.id;

    // For user-specific resources, check if the resource belongs to the user
    if (resourceId && resourceId !== userId) {
      logger.warn('Access denied due to resource ownership', {
        userId: userId,
        resourceId: resourceId,
        path: req.path,
        method: req.method
      });

      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only access your own resources'
      });
    }

    next();
  };
};

/**
 * Rate limiting by user
 */
const rateLimitByUser = (maxRequests = 100, windowMs = 60000, storage = new Map()) => {
  return (req, res, next) => {
    if (!req.user) {
      return next();
    }

    const userId = req.user.id;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Get or create user's request history
    if (!storage.has(userId)) {
      storage.set(userId, []);
    }

    const userRequests = storage.get(userId);
    
    // Remove old requests outside the window
    const recentRequests = userRequests.filter(timestamp => timestamp > windowStart);
    storage.set(userId, recentRequests);

    // Check if user has exceeded the limit
    if (recentRequests.length >= maxRequests) {
      logger.warn('User rate limit exceeded', {
        userId: userId,
        requestCount: recentRequests.length,
        maxRequests: maxRequests,
        path: req.path
      });

      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: `Too many requests. Maximum ${maxRequests} requests per ${windowMs / 1000} seconds.`,
        retryAfter: Math.ceil((recentRequests[0] + windowMs - now) / 1000)
      });
    }

    // Add current request timestamp
    recentRequests.push(now);
    storage.set(userId, recentRequests);

    next();
  };
};

module.exports = {
  authenticateJWT,
  requireRole,
  requirePermission,
  optionalAuth,
  requireAdmin,
  requireUser,
  requireOwnership,
  rateLimitByUser
};