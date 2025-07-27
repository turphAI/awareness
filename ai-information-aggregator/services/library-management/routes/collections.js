const express = require('express');
const { body, param, query } = require('express-validator');
const collectionController = require('../controllers/collectionController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Validation middleware
const validateCreateCollection = [
  body('name')
    .notEmpty()
    .withMessage('Collection name is required')
    .isLength({ max: 100 })
    .withMessage('Collection name cannot exceed 100 characters'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Collection description cannot exceed 500 characters'),
  body('public')
    .optional()
    .isBoolean()
    .withMessage('Public must be a boolean value'),
  body('color')
    .optional()
    .matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
    .withMessage('Color must be a valid hex color'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('parent')
    .optional()
    .isMongoId()
    .withMessage('Parent must be a valid MongoDB ObjectId')
];

const validateUpdateCollection = [
  param('collectionId')
    .isMongoId()
    .withMessage('Collection ID must be a valid MongoDB ObjectId'),
  body('name')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Collection name cannot exceed 100 characters'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Collection description cannot exceed 500 characters'),
  body('public')
    .optional()
    .isBoolean()
    .withMessage('Public must be a boolean value'),
  body('color')
    .optional()
    .matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
    .withMessage('Color must be a valid hex color'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array')
];

const validateCollectionId = [
  param('collectionId')
    .isMongoId()
    .withMessage('Collection ID must be a valid MongoDB ObjectId')
];

const validateContentOperation = [
  param('collectionId')
    .isMongoId()
    .withMessage('Collection ID must be a valid MongoDB ObjectId'),
  body('contentIds')
    .isArray({ min: 1 })
    .withMessage('Content IDs must be a non-empty array'),
  body('contentIds.*')
    .isMongoId()
    .withMessage('Each content ID must be a valid MongoDB ObjectId')
];

const validateCollaborator = [
  param('collectionId')
    .isMongoId()
    .withMessage('Collection ID must be a valid MongoDB ObjectId'),
  body('collaboratorUserId')
    .isMongoId()
    .withMessage('Collaborator user ID must be a valid MongoDB ObjectId'),
  body('role')
    .optional()
    .isIn(['viewer', 'editor', 'admin'])
    .withMessage('Role must be one of: viewer, editor, admin')
];

const validateSearch = [
  query('query')
    .notEmpty()
    .withMessage('Search query is required'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be a non-negative integer')
];

// Apply auth middleware to all routes
router.use(authMiddleware);

// Collection CRUD routes
router.post('/', validateCreateCollection, collectionController.createCollection);
router.get('/', collectionController.getUserCollections);
router.get('/public', collectionController.getPublicCollections);
router.get('/search', validateSearch, collectionController.searchCollections);
router.get('/:collectionId', validateCollectionId, collectionController.getCollection);
router.put('/:collectionId', validateUpdateCollection, collectionController.updateCollection);
router.delete('/:collectionId', validateCollectionId, collectionController.deleteCollection);

// Content management routes
router.post('/:collectionId/content', validateContentOperation, collectionController.addContent);
router.delete('/:collectionId/content', validateContentOperation, collectionController.removeContent);

// Collaborator management routes
router.post('/:collectionId/collaborators', validateCollaborator, collectionController.addCollaborator);
router.delete('/:collectionId/collaborators/:collaboratorUserId', 
  param('collectionId').isMongoId(),
  param('collaboratorUserId').isMongoId(),
  collectionController.removeCollaborator
);

// Utility routes
router.get('/content/:contentId', 
  param('contentId').isMongoId(),
  collectionController.getCollectionsByContent
);
router.put('/:collectionId/metadata', 
  validateCollectionId,
  body('metadata').isObject(),
  collectionController.updateMetadata
);

module.exports = router;