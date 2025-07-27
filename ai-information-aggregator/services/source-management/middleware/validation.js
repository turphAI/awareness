const Joi = require('joi');
const { ApiError } = require('../../../common/utils/errorHandler');
const createLogger = require('../../../common/utils/logger');

// Configure logger
const logger = createLogger('source-validation');

/**
 * Validate source data
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.validateSource = (req, res, next) => {
  // Different schema for create and update
  const isCreate = !req.params.id;
  
  const schema = Joi.object({
    url: isCreate 
      ? Joi.string().uri().required().messages({
          'string.empty': 'URL is required',
          'string.uri': 'Please provide a valid URL'
        })
      : Joi.string().uri().messages({
          'string.uri': 'Please provide a valid URL'
        }),
    
    name: isCreate
      ? Joi.string().required().trim().max(100).messages({
          'string.empty': 'Name is required',
          'string.max': 'Name cannot exceed 100 characters'
        })
      : Joi.string().trim().max(100).messages({
          'string.max': 'Name cannot exceed 100 characters'
        }),
    
    description: Joi.string().trim().max(500).allow('').messages({
      'string.max': 'Description cannot exceed 500 characters'
    }),
    
    type: isCreate
      ? Joi.string().required().valid('website', 'blog', 'academic', 'podcast', 'social', 'newsletter', 'rss').messages({
          'string.empty': 'Type is required',
          'any.only': 'Type must be website, blog, academic, podcast, social, newsletter, or rss'
        })
      : Joi.string().valid('website', 'blog', 'academic', 'podcast', 'social', 'newsletter', 'rss').messages({
          'any.only': 'Type must be website, blog, academic, podcast, social, newsletter, or rss'
        }),
    
    categories: Joi.array().items(Joi.string().trim()),
    
    tags: Joi.array().items(Joi.string().trim()),
    
    relevanceScore: Joi.number().min(0).max(1).messages({
      'number.min': 'Relevance score must be at least 0',
      'number.max': 'Relevance score cannot exceed 1'
    }),
    
    checkFrequency: Joi.string().valid('hourly', 'daily', 'weekly', 'monthly').messages({
      'any.only': 'Check frequency must be hourly, daily, weekly, or monthly'
    }),
    
    requiresAuthentication: Joi.boolean(),
    
    credentials: Joi.object({
      username: Joi.string(),
      password: Joi.string(),
      apiKey: Joi.string(),
      token: Joi.string()
    }).allow(null),
    
    discoveredFrom: Joi.string().allow(null),
    
    active: Joi.boolean(),
    
    // RSS-specific fields
    rssUrl: Joi.string().uri().allow('').messages({
      'string.uri': 'Please provide a valid RSS URL'
    }),
    
    // Podcast-specific fields
    podcastAuthor: Joi.string().trim().allow(''),
    podcastLanguage: Joi.string().trim().allow(''),
    
    // Academic-specific fields
    academicPublisher: Joi.string().trim().allow(''),
    academicDomain: Joi.string().trim().allow(''),
    
    // Social-specific fields
    socialPlatform: Joi.string().trim().allow(''),
    socialUsername: Joi.string().trim().allow(''),
    
    // Metadata
    metadata: Joi.object().pattern(
      Joi.string(),
      Joi.string()
    ).allow(null)
  });
  
  // Conditional validation based on source type
  if (req.body.type === 'rss' && req.body.rssUrl === '') {
    return next(new ApiError(400, 'RSS URL is required for RSS sources'));
  }
  
  if (req.body.type === 'podcast' && !req.body.podcastAuthor) {
    return next(new ApiError(400, 'Podcast author is required for podcast sources'));
  }
  
  if (req.body.type === 'social' && (!req.body.socialPlatform || !req.body.socialUsername)) {
    return next(new ApiError(400, 'Social platform and username are required for social sources'));
  }
  
  const { error } = schema.validate(req.body);
  
  if (error) {
    logger.warn(`Source validation error: ${error.details[0].message}`);
    return next(new ApiError(400, error.details[0].message));
  }
  
  next();
};

/**
 * Validate URL
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.validateUrl = (req, res, next) => {
  const schema = Joi.object({
    url: Joi.string().uri().required().messages({
      'string.empty': 'URL is required',
      'string.uri': 'Please provide a valid URL'
    })
  });
  
  const { error } = schema.validate(req.body);
  
  if (error) {
    logger.warn(`URL validation error: ${error.details[0].message}`);
    return next(new ApiError(400, error.details[0].message));
  }
  
  next();
};

/**
 * Validate source credentials
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.validateCredentials = (req, res, next) => {
  const schema = Joi.object({
    username: Joi.string().allow(''),
    password: Joi.string().allow(''),
    apiKey: Joi.string().allow(''),
    token: Joi.string().allow(''),
    oauth: Joi.object({
      clientId: Joi.string(),
      clientSecret: Joi.string(),
      redirectUri: Joi.string(),
      accessToken: Joi.string(),
      refreshToken: Joi.string(),
      tokenType: Joi.string(),
      expiresAt: Joi.date()
    }).allow(null)
  }).min(1).messages({
    'object.min': 'At least one credential field is required'
  });
  
  const { error } = schema.validate(req.body);
  
  if (error) {
    logger.warn(`Credentials validation error: ${error.details[0].message}`);
    return next(new ApiError(400, error.details[0].message));
  }
  
  next();
};

/**
 * Validate source metadata
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.validateMetadata = (req, res, next) => {
  const schema = Joi.object().pattern(
    Joi.string(),
    Joi.string()
  ).min(1).messages({
    'object.min': 'At least one metadata field is required'
  });
  
  const { error } = schema.validate(req.body);
  
  if (error) {
    logger.warn(`Metadata validation error: ${error.details[0].message}`);
    return next(new ApiError(400, error.details[0].message));
  }
  
  next();
};

/**
 * Validate category data
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.validateCategory = (req, res, next) => {
  // Different schema for create and update
  const isCreate = !req.params.id;
  
  const schema = Joi.object({
    name: isCreate
      ? Joi.string().required().trim().max(50).messages({
          'string.empty': 'Category name is required',
          'string.max': 'Category name cannot exceed 50 characters'
        })
      : Joi.string().trim().max(50).messages({
          'string.max': 'Category name cannot exceed 50 characters'
        }),
    
    description: Joi.string().trim().max(200).allow('').messages({
      'string.max': 'Description cannot exceed 200 characters'
    }),
    
    color: Joi.string().pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).messages({
      'string.pattern.base': 'Please provide a valid hex color'
    }),
    
    parentCategory: Joi.string().allow(null),
    
    keywords: Joi.array().items(Joi.string().trim())
  });
  
  const { error } = schema.validate(req.body);
  
  if (error) {
    logger.warn(`Category validation error: ${error.details[0].message}`);
    return next(new ApiError(400, error.details[0].message));
  }
  
  next();
};

/**
 * Validate category suggestion request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.validateCategorySuggestion = (req, res, next) => {
  const schema = Joi.object({
    sourceId: Joi.string(),
    url: Joi.string().uri(),
    title: Joi.string(),
    description: Joi.string(),
    content: Joi.string()
  }).or('sourceId', 'url', 'title', 'description', 'content').messages({
    'object.missing': 'At least one source parameter is required'
  });
  
  const { error } = schema.validate(req.body);
  
  if (error) {
    logger.warn(`Category suggestion validation error: ${error.details[0].message}`);
    return next(new ApiError(400, error.details[0].message));
  }
  
  next();
};