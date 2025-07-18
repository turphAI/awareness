const jwt = require('jsonwebtoken');
const { ApiError } = require('../../../common/utils/errorHandler');
const User = require('../models/User');

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
        role: user.role
      };
      
      next();
    } catch (error) {
      throw new ApiError(401, 'Not authorized to access this route');
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Authorize user by role
 * @param {string} role - Required role
 * @returns {Function} - Express middleware function
 */
exports.authorize = (role) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, 'Not authorized to access this route'));
    }
    
    if (req.user.role !== role) {
      return next(new ApiError(403, 'Not authorized to access this route'));
    }
    
    next();
  };
};