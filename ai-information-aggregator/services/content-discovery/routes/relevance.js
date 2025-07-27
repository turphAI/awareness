const express = require('express');
const router = express.Router();
const relevanceController = require('../controllers/relevanceController');
const authMiddleware = require('../../authentication/middleware/auth');

// Assess content relevance
router.post('/assess/:contentId', 
  authMiddleware.authenticate,
  relevanceController.assessContentRelevance
);

// Batch assess content relevance
router.post('/assess-batch', 
  authMiddleware.authenticate,
  relevanceController.batchAssessContentRelevance
);

// Filter content by relevance
router.post('/filter', 
  authMiddleware.authenticate,
  relevanceController.filterContentByRelevance
);

// Get relevant content
router.get('/relevant', 
  authMiddleware.authenticate,
  relevanceController.getRelevantContent
);

// Update content quality
router.patch('/quality/:contentId', 
  authMiddleware.authenticate,
  authMiddleware.authorize(['admin', 'editor']),
  relevanceController.updateContentQuality
);

module.exports = router;