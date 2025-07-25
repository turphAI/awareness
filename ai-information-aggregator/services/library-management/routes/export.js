const express = require('express');
const { body, param } = require('express-validator');
const exportController = require('../controllers/exportController');
const auth = require('../middleware/auth');

const router = express.Router();

/**
 * Validation middleware for export requests
 */
const validateExportRequest = [
  body('format')
    .optional()
    .isIn(['json', 'csv', 'bibtex', 'ris', 'markdown', 'html'])
    .withMessage('Format must be one of: json, csv, bibtex, ris, markdown, html'),
  body('citationStyle')
    .optional()
    .isIn(['apa', 'mla', 'chicago', 'ieee', 'harvard'])
    .withMessage('Citation style must be one of: apa, mla, chicago, ieee, harvard'),
  body('includeMetadata')
    .optional()
    .isBoolean()
    .withMessage('includeMetadata must be a boolean'),
  body('includeFullText')
    .optional()
    .isBoolean()
    .withMessage('includeFullText must be a boolean'),
  body('includeReferences')
    .optional()
    .isBoolean()
    .withMessage('includeReferences must be a boolean'),
  body('filename')
    .optional()
    .isString()
    .isLength({ min: 1, max: 255 })
    .withMessage('Filename must be a string between 1 and 255 characters')
];

const validateContentIds = [
  body('contentIds')
    .isArray({ min: 1 })
    .withMessage('contentIds must be a non-empty array'),
  body('contentIds.*')
    .isMongoId()
    .withMessage('Each content ID must be a valid MongoDB ObjectId')
];

const validateSearchExport = [
  body('query')
    .optional()
    .isString()
    .isLength({ min: 1, max: 500 })
    .withMessage('Query must be a string between 1 and 500 characters'),
  body('filters')
    .optional()
    .isObject()
    .withMessage('Filters must be an object'),
  body('limit')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Limit must be an integer between 1 and 1000')
];

const validateCollectionId = [
  param('collectionId')
    .isMongoId()
    .withMessage('Collection ID must be a valid MongoDB ObjectId')
];

/**
 * @route   GET /api/export/options
 * @desc    Get available export options
 * @access  Public
 */
router.get('/options', exportController.getExportOptions);

/**
 * @route   POST /api/export/content
 * @desc    Export content by IDs
 * @access  Private
 */
router.post('/content', 
  auth, 
  validateExportRequest,
  validateContentIds,
  exportController.exportContentByIds
);

/**
 * @route   POST /api/export/collection/:collectionId
 * @desc    Export collection content
 * @access  Private
 */
router.post('/collection/:collectionId',
  auth,
  validateCollectionId,
  validateExportRequest,
  exportController.exportCollection
);

/**
 * @route   POST /api/export/search
 * @desc    Export search results
 * @access  Private
 */
router.post('/search',
  auth,
  validateExportRequest,
  validateSearchExport,
  exportController.exportSearchResults
);

/**
 * @route   POST /api/export/saved
 * @desc    Export user's saved content
 * @access  Private
 */
router.post('/saved',
  auth,
  validateExportRequest,
  [
    body('limit')
      .optional()
      .isInt({ min: 1, max: 1000 })
      .withMessage('Limit must be an integer between 1 and 1000')
  ],
  exportController.exportUserSavedContent
);

/**
 * @route   POST /api/export/preview
 * @desc    Preview export format
 * @access  Private
 */
router.post('/preview',
  auth,
  validateExportRequest,
  validateContentIds,
  [
    body('previewLimit')
      .optional()
      .isInt({ min: 1, max: 10 })
      .withMessage('Preview limit must be an integer between 1 and 10')
  ],
  exportController.previewExport
);

module.exports = router;