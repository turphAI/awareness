const express = require('express');
const { query, body } = require('express-validator');
const SearchController = require('../controllers/searchController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

/**
 * @route GET /api/search/content
 * @desc Search content with full-text search and advanced filtering
 * @access Private
 */
router.get('/content',
  authMiddleware,
  [
    query('query')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 500 })
      .withMessage('Query must be between 1 and 500 characters'),
    query('type')
      .optional()
      .custom((value) => {
        const validTypes = ['article', 'paper', 'podcast', 'video', 'social', 'newsletter', 'book', 'course'];
        const types = Array.isArray(value) ? value : [value];
        return types.every(type => validTypes.includes(type));
      })
      .withMessage('Invalid content type'),
    query('categories')
      .optional()
      .custom((value) => {
        const categories = Array.isArray(value) ? value : [value];
        return categories.every(cat => typeof cat === 'string' && cat.length > 0);
      })
      .withMessage('Categories must be non-empty strings'),
    query('topics')
      .optional()
      .custom((value) => {
        const topics = Array.isArray(value) ? value : [value];
        return topics.every(topic => typeof topic === 'string' && topic.length > 0);
      })
      .withMessage('Topics must be non-empty strings'),
    query('author')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 200 })
      .withMessage('Author must be between 1 and 200 characters'),
    query('dateFrom')
      .optional()
      .isISO8601()
      .withMessage('dateFrom must be a valid ISO 8601 date'),
    query('dateTo')
      .optional()
      .isISO8601()
      .withMessage('dateTo must be a valid ISO 8601 date'),
    query('relevanceMin')
      .optional()
      .isFloat({ min: 0, max: 1 })
      .withMessage('relevanceMin must be between 0 and 1'),
    query('relevanceMax')
      .optional()
      .isFloat({ min: 0, max: 1 })
      .withMessage('relevanceMax must be between 0 and 1'),
    query('sortBy')
      .optional()
      .isIn(['relevance', 'date', 'title', 'author', 'readCount', 'saveCount', 'quality'])
      .withMessage('Invalid sortBy value'),
    query('sortOrder')
      .optional()
      .isIn(['asc', 'desc'])
      .withMessage('sortOrder must be asc or desc'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('includeOutdated')
      .optional()
      .isBoolean()
      .withMessage('includeOutdated must be a boolean')
  ],
  SearchController.searchContent
);

/**
 * @route GET /api/search/suggestions
 * @desc Get search suggestions based on partial query
 * @access Private
 */
router.get('/suggestions',
  authMiddleware,
  [
    query('query')
      .notEmpty()
      .isString()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Query must be between 2 and 100 characters'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit must be between 1 and 50')
  ],
  SearchController.getSearchSuggestions
);

/**
 * @route GET /api/search/facets
 * @desc Get search facets for advanced filtering
 * @access Private
 */
router.get('/facets',
  authMiddleware,
  [
    query('query')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 500 })
      .withMessage('Query must be between 1 and 500 characters')
  ],
  SearchController.getSearchFacets
);

/**
 * @route GET /api/search/collections
 * @desc Search collections
 * @access Private
 */
router.get('/collections',
  authMiddleware,
  [
    query('query')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 200 })
      .withMessage('Query must be between 1 and 200 characters'),
    query('userId')
      .optional()
      .isMongoId()
      .withMessage('userId must be a valid MongoDB ObjectId'),
    query('public')
      .optional()
      .isBoolean()
      .withMessage('public must be a boolean'),
    query('sortBy')
      .optional()
      .isIn(['name', 'created', 'updated', 'contentCount'])
      .withMessage('Invalid sortBy value'),
    query('sortOrder')
      .optional()
      .isIn(['asc', 'desc'])
      .withMessage('sortOrder must be asc or desc'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
  ],
  SearchController.searchCollections
);

/**
 * @route POST /api/search/advanced
 * @desc Advanced search with multiple criteria and aggregations
 * @access Private
 */
router.post('/advanced',
  authMiddleware,
  [
    body('query')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 500 })
      .withMessage('Query must be between 1 and 500 characters'),
    body('filters')
      .optional()
      .isObject()
      .withMessage('Filters must be an object'),
    body('aggregations')
      .optional()
      .isArray()
      .withMessage('Aggregations must be an array'),
    body('sortBy')
      .optional()
      .isIn(['relevance', 'date', 'quality'])
      .withMessage('Invalid sortBy value'),
    body('sortOrder')
      .optional()
      .isIn(['asc', 'desc'])
      .withMessage('sortOrder must be asc or desc'),
    body('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    body('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
  ],
  SearchController.advancedSearch
);

module.exports = router;