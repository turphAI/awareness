const jwt = require('jsonwebtoken');
const { ApiError } = require('../../../common/utils/errorHandler');
const User = require('../models/User');
const { hasPermission, ROLES } = require('../utils/roles');
const createLogger = require('../../../common/utils/logger');

// Configure logger
const logger = createLogger('auth-middleware');

/**
 * Authenticate user from JWT token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.authenticate = async (req, res, next) => {
  try {
    let token;
    
    // Get token from Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    // Get token from cookie
    else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }
    
    // Check if token exists
    if (!token) {
      throw new ApiError(401, 'Not authorized to access this route');
    }
    
    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-jwt-secret-do-not-use-in-production');
      
      // Check if user exists
      const user = await User.findOne({ _id: decoded.id, active: true });
      
      if (!user) {
        throw new ApiError(401, 'User not found');
      }
      
      // Add user to request object
      req.user = {
        id: user._id,
        role: user.role,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified
      };
      
      logger.debug(`User authenticated: ${user.email} (${user.role})`);
      
      next();
    } catch (error) {
      logger.error('Authentication error:', error);
      throw new ApiError(401, 'Not authorized to access this route');
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Authorize user by role
 * @param {...string} roles - Required roles (any of these roles will be authorized)
 * @returns {Function} - Express middleware function
 */
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, 'Not authorized to access this route'));
    }
    
    // Admin always has access
    if (req.user.role === ROLES.ADMIN) {
      return next();
    }
    
    // Check if user has any of the required roles
    const hasRole = roles.includes(req.user.role);
    
    if (!hasRole) {
      logger.warn(`Access denied: User ${req.user.email} (${req.user.role}) attempted to access route requiring roles: ${roles.join(', ')}`);
      return next(new ApiError(403, 'You do not have permission to access this resource'));
    }
    
    logger.debug(`Access granted: User ${req.user.email} (${req.user.role}) authorized for route requiring roles: ${roles.join(', ')}`);
    next();
  };
};

/**
 * Check if user has required permission
 * @param {string} permission - Required permission
 * @returns {Function} - Express middleware function
 */
exports.hasPermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, 'Not authorized to access this route'));
    }
    
    // Admin always has all permissions
    if (req.user.role === ROLES.ADMIN) {
      return next();
    }
    
    // Check if user's role has the required permission
    if (!hasPermission(req.user.role, permission)) {
      logger.warn(`Permission denied: User ${req.user.email} (${req.user.role}) attempted to use permission: ${permission}`);
      return next(new ApiError(403, 'You do not have permission to perform this action'));
    }
    
    logger.debug(`Permission granted: User ${req.user.email} (${req.user.role}) authorized for permission: ${permission}`);
    next();
  };
};

/**
 * Check if user is the owner of a resource or has a specific role
 * @param {Function} getResourceUserId - Function to get the user ID from the resource
 * @param {...string} roles - Roles that can access the resource regardless of ownership
 * @returns {Function} - Express middleware function
 */
exports.isOwnerOrHasRole = (getResourceUserId, ...roles) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return next(new ApiError(401, 'Not authorized to access this route'));
      }
      
      // Admin always has access
      if (req.user.role === ROLES.ADMIN) {
        return next();
      }
      
      // Check if user has any of the specified roles
      const hasRole = roles.length > 0 && roles.includes(req.user.role);
      
      if (hasRole) {
        return next();
      }
      
      // Get the resource owner's user ID
      const resourceUserId = await getResourceUserId(req);
      
      // Check if user is the owner
      if (resourceUserId && resourceUserId.toString() === req.user.id.toString()) {
        return next();
      }
      
      logger.warn(`Ownership check failed: User ${req.user.email} (${req.user.role}) attempted to access resource owned by ${resourceUserId}`);
      return next(new ApiError(403, 'You do not have permission to access this resource'));
    } catch (error) {
      next(error);
    }
  };
};