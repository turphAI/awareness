const express = require('express');
const { param, query, body } = require('express-validator');
const relatedContentController = require('../controllers/relatedContentController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Validation middleware
const validateContentId = [
  param('contentId')
    .isMongoId()
    .withMessage('Content ID must be a valid MongoDB ObjectId')
];

const validateTwoContentIds = [
  param('contentId1')
    .isMongoId()
    .withMessage('Content ID 1 must be a valid MongoDB ObjectId'),
  param('contentId2')
    .isMongoId()
    .withMessage('Content ID 2 must be a valid MongoDB ObjectId')
];

const validateRelatedContentQuery = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be an integer between 1 and 100'),
  query('threshold')
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage('Threshold must be a float between 0 and 1'),
  query('includeMetadata')
    .optional()
    .isBoolean()
    .withMessage('includeMetadata must be a boolean')
];

const validateVisualizationQuery = [
  query('maxDepth')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('maxDepth must be an integer between 1 and 5'),
  query('maxNodes')
    .optional()
    .isInt({ min: 1, max: 200 })
    .withMessage('maxNodes must be an integer between 1 and 200'),
  query('includeMetrics')
    .optional()
    .isBoolean()
    .withMessage('includeMetrics must be a boolean')
];

const validateBatchProcessBody = [
  body('contentIds')
    .isArray({ min: 1, max: 100 })
    .withMessage('contentIds must be an array with 1-100 items'),
  body('contentIds.*')
    .isMongoId()
    .withMessage('Each content ID must be a valid MongoDB ObjectId'),
  body('batchSize')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('batchSize must be an integer between 1 and 50'),
  body('updateMetadata')
    .optional()
    .isBoolean()
    .withMessage('updateMetadata must be a boolean'),
  body('threshold')
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage('threshold must be a float between 0 and 1')
];

const validateUpdateBody = [
  body('threshold')
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage('threshold must be a float between 0 and 1'),
  body('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit must be an integer between 1 and 100')
];

const validateNetworkStatsQuery = [
  query('contentIds')
    .optional(),
  query('maxDepth')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('maxDepth must be an integer between 1 and 5'),
  query('maxNodes')
    .optional()
    .isInt({ min: 1, max: 200 })
    .withMessage('maxNodes must be an integer between 1 and 200')
];

/**
 * @route GET /api/related/:contentId
 * @desc Find related content for a given content item
 * @access Private
 */
router.get(
  '/:contentId',
  authMiddleware,
  validateContentId,
  validateRelatedContentQuery,
  relatedContentController.findRelatedContent
);

/**
 * @route GET /api/related/:contentId/visualization
 * @desc Generate connection visualization for content
 * @access Private
 */
router.get(
  '/:contentId/visualization',
  authMiddleware,
  validateContentId,
  validateVisualizationQuery,
  relatedContentController.generateVisualization
);

/**
 * @route POST /api/related/:contentId/update
 * @desc Update related content metadata for a content item
 * @access Private
 */
router.post(
  '/:contentId/update',
  authMiddleware,
  validateContentId,
  validateUpdateBody,
  relatedContentController.updateRelatedContent
);

/**
 * @route POST /api/related/batch-process
 * @desc Batch process related content identification
 * @access Private
 */
router.post(
  '/batch-process',
  authMiddleware,
  validateBatchProcessBody,
  relatedContentController.batchProcess
);

/**
 * @route GET /api/related/similarity/:contentId1/:contentId2
 * @desc Get similarity score between two content items
 * @access Private
 */
router.get(
  '/similarity/:contentId1/:contentId2',
  authMiddleware,
  validateTwoContentIds,
  relatedContentController.getSimilarity
);

/**
 * @route GET /api/related/network-stats
 * @desc Get network statistics for content connections
 * @access Private
 */
router.get(
  '/network-stats',
  authMiddleware,
  validateNetworkStatsQuery,
  relatedContentController.getNetworkStats
);

module.exports = router;