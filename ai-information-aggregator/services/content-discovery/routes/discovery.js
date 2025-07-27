const express = require('express');
const router = express.Router();
const discoveryController = require('../controllers/discoveryController');
const authMiddleware = require('../../authentication/middleware/auth');

// Initialize discovery system
router.post('/initialize', 
  authMiddleware.authenticate,
  authMiddleware.authorize(['admin']),
  discoveryController.initializeDiscovery
);

// Get discovery system status
router.get('/status', 
  authMiddleware.authenticate,
  discoveryController.getDiscoveryStatus
);

// Schedule a source check
router.post('/sources/:sourceId/schedule', 
  authMiddleware.authenticate,
  discoveryController.scheduleSourceCheck
);

// Check a source immediately
router.post('/sources/:sourceId/check', 
  authMiddleware.authenticate,
  discoveryController.checkSourceNow
);

// Clean up discovery jobs
router.post('/cleanup', 
  authMiddleware.authenticate,
  authMiddleware.authorize(['admin']),
  discoveryController.cleanupDiscoveryJobs
);

// Get sources with errors
router.get('/sources/errors', 
  authMiddleware.authenticate,
  discoveryController.getSourcesWithErrors
);

// Reset errors for a source
router.post('/sources/:sourceId/reset-errors', 
  authMiddleware.authenticate,
  discoveryController.resetSourceErrors
);

// Process new content
router.post('/content/:contentId/process', 
  authMiddleware.authenticate,
  discoveryController.processNewContent
);

// Process unprocessed content
router.post('/content/process-unprocessed', 
  authMiddleware.authenticate,
  authMiddleware.authorize(['admin', 'editor']),
  discoveryController.processUnprocessedContent
);

// Queue reference extraction
router.post('/content/:contentId/extract-references', 
  authMiddleware.authenticate,
  discoveryController.queueReferenceExtraction
);

// Queue reference resolution
router.post('/references/resolve', 
  authMiddleware.authenticate,
  authMiddleware.authorize(['admin', 'editor']),
  discoveryController.queueReferenceResolution
);

// Queue relevance assessment
router.post('/content/:contentId/assess-relevance', 
  authMiddleware.authenticate,
  discoveryController.queueRelevanceAssessment
);

module.exports = router;