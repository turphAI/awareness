const express = require('express');
const { body, param, query } = require('express-validator');
const topicPreferenceController = require('../controllers/topicPreferenceController');
const auth = require('../middleware/auth');

const router = express.Router();

/**
 * Validation middleware for topic preference requests
 */
const validateTopicPreference = [
  body('topic')
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Topic must be a string between 1 and 100 characters'),
  body('category')
    .isIn(['ai-research', 'machine-learning', 'nlp', 'computer-vision', 'robotics', 'ethics', 'industry-news', 'tools', 'frameworks', 'other'])
    .withMessage('Category must be one of: ai-research, machine-learning, nlp, computer-vision, robotics, ethics, industry-news, tools, frameworks, other'),
  body('priority')
    .optional()
    .isIn(['high', 'medium', 'low'])
    .withMessage('Priority must be high, medium, or low'),
  body('weight')
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage('Weight must be a number between 0 and 1'),
  body('keywords')
    .optional()
    .isArray()
    .withMessage('Keywords must be an array'),
  body('keywords.*')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Each keyword must be a string between 1 and 50 characters'),
  body('excludeKeywords')
    .optional()
    .isArray()
    .withMessage('Exclude keywords must be an array'),
  body('excludeKeywords.*')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Each exclude keyword must be a string between 1 and 50 characters'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean')
];

const validateTopicPreferenceUpdate = [
  body('topic')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Topic must be a string between 1 and 100 characters'),
  body('category')
    .optional()
    .isIn(['ai-research', 'machine-learning', 'nlp', 'computer-vision', 'robotics', 'ethics', 'industry-news', 'tools', 'frameworks', 'other'])
    .withMessage('Category must be one of: ai-research, machine-learning, nlp, computer-vision, robotics, ethics, industry-news, tools, frameworks, other'),
  body('priority')
    .optional()
    .isIn(['high', 'medium', 'low'])
    .withMessage('Priority must be high, medium, or low'),
  body('weight')
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage('Weight must be a number between 0 and 1'),
  body('keywords')
    .optional()
    .isArray()
    .withMessage('Keywords must be an array'),
  body('keywords.*')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Each keyword must be a string between 1 and 50 characters'),
  body('excludeKeywords')
    .optional()
    .isArray()
    .withMessage('Exclude keywords must be an array'),
  body('excludeKeywords.*')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Each exclude keyword must be a string between 1 and 50 characters'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean')
];

const validateKeyword = [
  body('keyword')
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Keyword must be a string between 1 and 50 characters')
];

const validateFeedback = [
  body('feedback')
    .isIn(['positive', 'negative'])
    .withMessage('Feedback must be either "positive" or "negative"')
];

const validateBulkUpdate = [
  body('updates')
    .isArray({ min: 1 })
    .withMessage('Updates must be a non-empty array'),
  body('updates.*.id')
    .isMongoId()
    .withMessage('Each update must have a valid MongoDB ObjectId'),
  body('updates.*.updates')
    .isObject()
    .withMessage('Each update must have an updates object')
];

const validateMongoId = [
  param('id')
    .isMongoId()
    .withMessage('ID must be a valid MongoDB ObjectId')
];

const validateQueryParams = [
  query('category')
    .optional()
    .isIn(['ai-research', 'machine-learning', 'nlp', 'computer-vision', 'robotics', 'ethics', 'industry-news', 'tools', 'frameworks', 'other'])
    .withMessage('Category must be one of: ai-research, machine-learning, nlp, computer-vision, robotics, ethics, industry-news, tools, frameworks, other'),
  query('priority')
    .optional()
    .isIn(['high', 'medium', 'low'])
    .withMessage('Priority must be high, medium, or low'),
  query('isActive')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('isActive must be true or false'),
  query('sortBy')
    .optional()
    .isIn(['topic', 'category', 'priority', 'weight', 'createdAt', 'updatedAt', 'usageCount'])
    .withMessage('sortBy must be one of: topic, category, priority, weight, createdAt, updatedAt, usageCount'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('sortOrder must be asc or desc'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be an integer between 1 and 100'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
];

const validateSearchQuery = [
  query('keyword')
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search keyword must be a string between 1 and 100 characters')
];

/**
 * @route   GET /api/topic-preferences
 * @desc    Get all topic preferences for authenticated user
 * @access  Private
 */
router.get('/', 
  auth, 
  validateQueryParams,
  topicPreferenceController.getUserTopicPreferences
);

/**
 * @route   GET /api/topic-preferences/search
 * @desc    Search topic preferences by keyword
 * @access  Private
 */
router.get('/search',
  auth,
  validateSearchQuery,
  topicPreferenceController.searchTopicPreferences
);

/**
 * @route   GET /api/topic-preferences/statistics
 * @desc    Get topic preference statistics for user
 * @access  Private
 */
router.get('/statistics',
  auth,
  topicPreferenceController.getUserStatistics
);

/**
 * @route   GET /api/topic-preferences/suggestions
 * @desc    Get topic suggestions for user
 * @access  Private
 */
router.get('/suggestions',
  auth,
  topicPreferenceController.getTopicSuggestions
);

/**
 * @route   GET /api/topic-preferences/:id
 * @desc    Get a specific topic preference
 * @access  Private
 */
router.get('/:id',
  auth,
  validateMongoId,
  topicPreferenceController.getTopicPreference
);

/**
 * @route   POST /api/topic-preferences
 * @desc    Create a new topic preference
 * @access  Private
 */
router.post('/',
  auth,
  validateTopicPreference,
  topicPreferenceController.createTopicPreference
);

/**
 * @route   PUT /api/topic-preferences/:id
 * @desc    Update a topic preference
 * @access  Private
 */
router.put('/:id',
  auth,
  validateMongoId,
  validateTopicPreferenceUpdate,
  topicPreferenceController.updateTopicPreference
);

/**
 * @route   DELETE /api/topic-preferences/:id
 * @desc    Delete a topic preference
 * @access  Private
 */
router.delete('/:id',
  auth,
  validateMongoId,
  topicPreferenceController.deleteTopicPreference
);

/**
 * @route   PATCH /api/topic-preferences/:id/toggle
 * @desc    Toggle topic preference active status
 * @access  Private
 */
router.patch('/:id/toggle',
  auth,
  validateMongoId,
  topicPreferenceController.toggleTopicPreference
);

/**
 * @route   POST /api/topic-preferences/:id/keywords
 * @desc    Add keyword to topic preference
 * @access  Private
 */
router.post('/:id/keywords',
  auth,
  validateMongoId,
  validateKeyword,
  topicPreferenceController.addKeyword
);

/**
 * @route   DELETE /api/topic-preferences/:id/keywords
 * @desc    Remove keyword from topic preference
 * @access  Private
 */
router.delete('/:id/keywords',
  auth,
  validateMongoId,
  validateKeyword,
  topicPreferenceController.removeKeyword
);

/**
 * @route   POST /api/topic-preferences/:id/feedback
 * @desc    Record feedback for topic preference
 * @access  Private
 */
router.post('/:id/feedback',
  auth,
  validateMongoId,
  validateFeedback,
  topicPreferenceController.recordFeedback
);

/**
 * @route   PATCH /api/topic-preferences/bulk
 * @desc    Bulk update topic preferences
 * @access  Private
 */
router.patch('/bulk',
  auth,
  validateBulkUpdate,
  topicPreferenceController.bulkUpdateTopicPreferences
);

module.exports = router;