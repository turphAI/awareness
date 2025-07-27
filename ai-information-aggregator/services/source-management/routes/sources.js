const express = require('express');
const router = express.Router();
const sourceController = require('../controllers/sourceController');
const { validateSource, validateUrl } = require('../middleware/validation');
const { authenticate } = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(authenticate);

// Get all sources for the authenticated user
router.get('/', sourceController.getAllSources);

// URL validation and metadata endpoints
router.post('/validate', validateUrl, sourceController.validateUrl);
router.post('/check-reachability', validateUrl, sourceController.checkUrlReachability);
router.post('/metadata', validateUrl, sourceController.getUrlMetadata);
router.post('/find-rss', validateUrl, sourceController.findRssFeed);
router.post('/bulk-import', sourceController.bulkImportSources);

// Get sources by type
router.get('/type/:type', sourceController.getSourcesByType);

// Get sources by category
router.get('/category/:category', sourceController.getSourcesByCategory);

// Get a specific source by ID
router.get('/:id', sourceController.getSourceById);

// Create a new source
router.post('/', validateSource, sourceController.createSource);

// Update a source
router.put('/:id', validateSource, sourceController.updateSource);

// Delete a source (set active to false)
router.delete('/:id', sourceController.deleteSource);

// Update source relevance score
router.patch('/:id/relevance', sourceController.updateRelevance);

module.exports = router;