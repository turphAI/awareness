const Joi = require('joi');
const { ApiError } = require('../../../common/utils/errorHandler');

/**
 * Validate user registration data
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.validateRegistration = (req, res, next) => {
  const schema = Joi.object({
    name: Joi.string().required().max(50).messages({
      'string.empty': 'Name is required',
      'string.max': 'Name cannot exceed 50 characters'
    }),
    email: Joi.string().required().email().messages({
      'string.empty': 'Email is required',
      'string.email': 'Please provide a valid email address'
    }),
    password: Joi.string().required().min(8).pattern(
      new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])')
    ).messages({
      'string.empty': 'Password is required',
      'string.min': 'Password must be at least 8 characters long',
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    }),
    confirmPassword: Joi.string().required().valid(Joi.ref('password')).messages({
      'string.empty': 'Confirm password is required',
      'any.only': 'Passwords do not match'
    })
  });
  
  const { error } = schema.validate(req.body);
  
  if (error) {
    return next(new ApiError(400, error.details[0].message));
  }
  
  next();
};

/**
 * Validate user login data
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.validateLogin = (req, res, next) => {
  const schema = Joi.object({
    email: Joi.string().required().email().messages({
      'string.empty': 'Email is required',
      'string.email': 'Please provide a valid email address'
    }),
    password: Joi.string().required().messages({
      'string.empty': 'Password is required'
    })
  });
  
  const { error } = schema.validate(req.body);
  
  if (error) {
    return next(new ApiError(400, error.details[0].message));
  }
  
  next();
};

/**
 * Validate password reset data
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.validatePasswordReset = (req, res, next) => {
  const schema = Joi.object({
    password: Joi.string().required().min(8).pattern(
      new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])')
    ).messages({
      'string.empty': 'Password is required',
      'string.min': 'Password must be at least 8 characters long',
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    }),
    confirmPassword: Joi.string().required().valid(Joi.ref('password')).messages({
      'string.empty': 'Confirm password is required',
      'any.only': 'Passwords do not match'
    }),
    currentPassword: Joi.string().messages({
      'string.empty': 'Current password is required'
    })
  });
  
  // If changing password (not resetting), currentPassword is required
  if (req.path === '/change-password') {
    schema.append({
      currentPassword: Joi.string().required()
    });
  }
  
  const { error } = schema.validate(req.body);
  
  if (error) {
    return next(new ApiError(400, error.details[0].message));
  }
  
  next();
};

/**
 * Validate user update data
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.validateUserUpdate = (req, res, next) => {
  const schema = Joi.object({
    name: Joi.string().max(50).messages({
      'string.max': 'Name cannot exceed 50 characters'
    }),
    bio: Joi.string().max(500).allow('').messages({
      'string.max': 'Bio cannot exceed 500 characters'
    }),
    avatar: Joi.string().allow(''),
    organization: Joi.string().allow(''),
    jobTitle: Joi.string().allow(''),
    location: Joi.string().allow(''),
    website: Joi.string().allow('').pattern(
      new RegExp('^(https?:\\/\\/)?([\\da-z.-]+)\\.([a-z.]{2,6})([/\\w .-]*)*\\/?$')
    ).messages({
      'string.pattern.base': 'Please provide a valid URL'
    }),
    role: Joi.string().valid('user', 'admin'),
    emailVerified: Joi.boolean()
  });
  
  const { error } = schema.validate(req.body);
  
  if (error) {
    return next(new ApiError(400, error.details[0].message));
  }
  
  next();
};

/**
 * Validate user preferences data
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.validatePreferences = (req, res, next) => {
  const schema = Joi.object({
    topics: Joi.array().items(Joi.string()),
    contentVolume: Joi.number().min(1).max(100),
    discoveryAggressiveness: Joi.number().min(0).max(1),
    summaryLength: Joi.string().valid('short', 'medium', 'long'),
    digestFrequency: Joi.string().valid('daily', 'weekly', 'never')
  });
  
  const { error } = schema.validate(req.body);
  
  if (error) {
    return next(new ApiError(400, error.details[0].message));
  }
  
  next();
};

/**
 * Validate notification settings data
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.validateNotifications = (req, res, next) => {
  const schema = Joi.object({
    email: Joi.boolean(),
    push: Joi.boolean(),
    digest: Joi.boolean()
  });
  
  const { error } = schema.validate(req.body);
  
  if (error) {
    return next(new ApiError(400, error.details[0].message));
  }
  
  next();
};

/**
 * Validate credential data
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.validateCredential = (req, res, next) => {
  // Different schema for create and update
  const isCreate = !req.params.id;
  
  const schema = Joi.object({
    service: isCreate ? Joi.string().required().trim().messages({
      'string.empty': 'Service name is required'
    }) : Joi.string().trim(),
    
    name: isCreate ? Joi.string().required().trim().max(100).messages({
      'string.empty': 'Credential name is required',
      'string.max': 'Credential name cannot exceed 100 characters'
    }) : Joi.string().trim().max(100).messages({
      'string.max': 'Credential name cannot exceed 100 characters'
    }),
    
    description: Joi.string().trim().max(500).allow('').messages({
      'string.max': 'Description cannot exceed 500 characters'
    }),
    
    credentials: isCreate ? Joi.object().required().messages({
      'object.base': 'Credentials must be an object'
    }) : Joi.object().messages({
      'object.base': 'Credentials must be an object'
    }),
    
    expiresAt: Joi.date().allow(null),
    
    metadata: Joi.object().pattern(
      Joi.string(),
      Joi.string()
    ).allow(null)
  });
  
  const { error } = schema.validate(req.body);
  
  if (error) {
    return next(new ApiError(400, error.details[0].message));
  }
  
  next();
};