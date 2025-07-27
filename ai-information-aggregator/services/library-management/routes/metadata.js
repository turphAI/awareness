const express = require('express');
const { body, param, query } = require('express-validator');
const metadataController = require('../controllers/metadataController');
const auth = require('../middleware/auth');

const router = express.Router();

// Validation middleware
const validateContentId = [
  param('contentId').isMongoId().withMessage('Invalid content ID format')
];

const validateMetadataExtraction = [
  body('contentId').isMongoId().withMessage('Invalid content ID format'),
  body('content').isObject().withMessage('Content object is required'),
  body('content.title').optional().isString().trim().isLength({ min: 1, max: 500 }).withMessage('Title must be 1-500 characters'),
  body('content.url').optional().isURL().withMessage('Invalid URL format'),
  body('options').optional().isObject().withMessage('Options must be an object')
];

const validateMetadataUpdate = [
  body('title').optional().isString().trim().isLength({ min: 1, max: 500 }).withMessage('Title must be 1-500 characters'),
  body('description').optional().isString().trim().isLength({ max: 2000 }).withMessage('Description must be max 2000 characters'),
  body('keywords').optional().isArray().withMessage('Keywords must be an array'),
  body('keywords.*').optional().isString().trim().isLength({ min: 1, max: 100 }).withMessage('Each keyword must be 1-100 characters'),
  body('tags').optional().isArray().withMessage('Tags must be an array'),
  body('tags.*').optional().isString().trim().isLength({ min: 1, max: 50 }).withMessage('Each tag must be 1-50 characters'),
  body('categories').optional().isArray().withMessage('Categories must be an array'),
  body('categories.*').optional().isString().trim().isLength({ min: 1, max: 50 }).withMessage('Each category must be 1-50 characters'),
  body('topics').optional().isArray().withMessage('Topics must be an array'),
  body('topics.*').optional().isString().trim().isLength({ min: 1, max: 100 }).withMessage('Each topic must be 1-100 characters'),
  body('contentType').optional().isIn(['article', 'video', 'podcast', 'document', 'image', 'webpage', 'academic', 'book', 'other']).withMessage('Invalid content type'),
  body('language').optional().isString().isLength({ min: 2, max: 5 }).withMessage('Language must be 2-5 characters'),
  body('difficulty').optional().isIn(['beginner', 'intermediate', 'advanced', 'expert']).withMessage('Invalid difficulty level')
];

const validateEngagementUpdate = [
  body('metrics').isObject().withMessage('Metrics object is required'),
  body('metrics.views').optional().isInt({ min: 0 }).withMessage('Views must be a non-negative integer'),
  body('metrics.likes').optional().isInt({ min: 0 }).withMessage('Likes must be a non-negative integer'),
  body('metrics.shares').optional().isInt({ min: 0 }).withMessage('Shares must be a non-negative integer'),
  body('metrics.comments').optional().isInt({ min: 0 }).withMessage('Comments must be a non-negative integer'),
  body('metrics.saves').optional().isInt({ min: 0 }).withMessage('Saves must be a non-negative integer'),
  body('metrics.avgRating').optional().isFloat({ min: 0, max: 5 }).withMessage('Average rating must be between 0 and 5'),
  body('metrics.ratingCount').optional().isInt({ min: 0 }).withMessage('Rating count must be a non-negative integer')
];

const validateRelatedContent = [
  body('relatedContentId').isMongoId().withMessage('Invalid related content ID format'),
  body('relationshipType').isIn(['similar', 'sequel', 'prequel', 'reference', 'citation', 'update', 'translation']).withMessage('Invalid relationship type'),
  body('strength').optional().isFloat({ min: 0, max: 1 }).withMessage('Strength must be between 0 and 1')
];

const validateQualityScores = [
  body('scores').isObject().withMessage('Scores object is required'),
  body('scores.qualityScore').optional().isFloat({ min: 0, max: 1 }).withMessage('Quality score must be between 0 and 1'),
  body('scores.relevanceScore').optional().isFloat({ min: 0, max: 1 }).withMessage('Relevance score must be between 0 and 1'),
  body('scores.popularityScore').optional().isFloat({ min: 0, max: 1 }).withMessage('Popularity score must be between 0 and 1'),
  body('scores.freshnessScore').optional().isFloat({ min: 0, max: 1 }).withMessage('Freshness score must be between 0 and 1')
];

const validateOutdatedContent = [
  body('reasons').optional().isArray().withMessage('Reasons must be an array'),
  body('reasons.*').optional().isIn(['factual_error', 'deprecated_info', 'broken_links', 'policy_change', 'technology_change', 'other']).withMessage('Invalid outdated reason'),
  body('suggestions').optional().isArray().withMessage('Suggestions must be an array'),
  body('suggestions.*').optional().isString().trim().isLength({ min: 1, max: 500 }).withMessage('Each suggestion must be 1-500 characters')
];

const validateSearchQuery = [
  query('query').optional().isString().trim().isLength({ min: 1, max: 200 }).withMessage('Search query must be 1-200 characters'),
  query('contentType').optional().isIn(['article', 'video', 'podcast', 'document', 'image', 'webpage', 'academic', 'book', 'other']).withMessage('Invalid content type'),
  query('domain').optional().isString().trim().isLength({ min: 1, max: 100 }).withMessage('Domain must be 1-100 characters'),
  query('minQualityScore').optional().isFloat({ min: 0, max: 1 }).withMessage('Minimum quality score must be between 0 and 1'),
  query('maxAge').optional().isInt({ min: 1 }).withMessage('Max age must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative'),
  query('sortBy').optional().isIn(['relevanceScore', 'qualityScore', 'popularityScore', 'freshnessScore', 'publishedAt', 'updatedAt']).withMessage('Invalid sort field'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc')
];

// Routes

/**
 * @route POST /api/metadata/extract
 * @desc Extract and store metadata for content
 * @access Private
 */
router.post('/extract', auth, validateMetadataExtraction, metadataController.extractMetadata);

/**
 * @route GET /api/metadata/:contentId
 * @desc Get metadata by content ID
 * @access Private
 */
router.get('/:contentId', auth, validateContentId, metadataController.getMetadata);

/**
 * @route PUT /api/metadata/:contentId
 * @desc Update metadata
 * @access Private
 */
router.put('/:contentId', auth, validateContentId, validateMetadataUpdate, metadataController.updateMetadata);

/**
 * @route DELETE /api/metadata/:contentId
 * @desc Delete metadata
 * @access Private
 */
router.delete('/:contentId', auth, validateContentId, metadataController.deleteMetadata);

/**
 * @route GET /api/metadata
 * @desc Search metadata
 * @access Private
 */
router.get('/', auth, validateSearchQuery, metadataController.searchMetadata);

/**
 * @route GET /api/metadata/stats/overview
 * @desc Get content statistics
 * @access Private
 */
router.get('/stats/overview', auth, metadataController.getStatistics);

/**
 * @route PUT /api/metadata/:contentId/engagement
 * @desc Update engagement metrics
 * @access Private
 */
router.put('/:contentId/engagement', auth, validateContentId, validateEngagementUpdate, metadataController.updateEngagement);

/**
 * @route POST /api/metadata/:contentId/related
 * @desc Add related content
 * @access Private
 */
router.post('/:contentId/related', auth, validateContentId, validateRelatedContent, metadataController.addRelatedContent);

/**
 * @route DELETE /api/metadata/:contentId/related/:relatedContentId
 * @desc Remove related content
 * @access Private
 */
router.delete('/:contentId/related/:relatedContentId', auth, 
  param('contentId').isMongoId().withMessage('Invalid content ID format'),
  param('relatedContentId').isMongoId().withMessage('Invalid related content ID format'),
  metadataController.removeRelatedContent
);

/**
 * @route PUT /api/metadata/:contentId/outdated
 * @desc Mark content as outdated
 * @access Private
 */
router.put('/:contentId/outdated', auth, validateContentId, validateOutdatedContent, metadataController.markOutdated);

/**
 * @route PUT /api/metadata/:contentId/up-to-date
 * @desc Mark content as up-to-date
 * @access Private
 */
router.put('/:contentId/up-to-date', auth, validateContentId, 
  body('nextReviewDate').optional().isISO8601().withMessage('Next review date must be a valid ISO 8601 date'),
  metadataController.markUpToDate
);

/**
 * @route GET /api/metadata/outdated/list
 * @desc Get outdated content
 * @access Private
 */
router.get('/outdated/list', auth, 
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative'),
  metadataController.getOutdatedContent
);

/**
 * @route GET /api/metadata/review/due
 * @desc Get content due for review
 * @access Private
 */
router.get('/review/due', auth, 
  query('beforeDate').optional().isISO8601().withMessage('Before date must be a valid ISO 8601 date'),
  metadataController.getContentDueForReview
);

/**
 * @route PUT /api/metadata/:contentId/quality-scores
 * @desc Update quality scores
 * @access Private
 */
router.put('/:contentId/quality-scores', auth, validateContentId, validateQualityScores, metadataController.updateQualityScores);

/**
 * @route PUT /api/metadata/:contentId/custom-fields
 * @desc Update custom fields
 * @access Private
 */
router.put('/:contentId/custom-fields', auth, validateContentId, 
  body('fields').isObject().withMessage('Fields object is required'),
  metadataController.updateCustomFields
);

module.exports = router;