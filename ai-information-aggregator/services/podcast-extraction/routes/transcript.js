const express = require('express');
const router = express.Router();
const transcriptController = require('../controllers/transcriptController');
const authMiddleware = require('../../authentication/middleware/auth');

// Get all transcripts
router.get('/', 
  authMiddleware.authenticate,
  transcriptController.getAllTranscripts
);

// Get transcript by ID
router.get('/:id', 
  authMiddleware.authenticate,
  transcriptController.getTranscriptById
);

// Create transcript
router.post('/', 
  authMiddleware.authenticate,
  authMiddleware.authorize(['admin', 'editor']),
  transcriptController.createTranscript
);

// Update transcript
router.put('/:id', 
  authMiddleware.authenticate,
  authMiddleware.authorize(['admin', 'editor']),
  transcriptController.updateTranscript
);

// Mark transcript as processed
router.post('/:id/process', 
  authMiddleware.authenticate,
  authMiddleware.authorize(['admin', 'editor']),
  transcriptController.markTranscriptProcessed
);

// Search transcripts
router.get('/search', 
  authMiddleware.authenticate,
  transcriptController.searchTranscripts
);

// Get transcripts by topic
router.get('/topic/:topic', 
  authMiddleware.authenticate,
  transcriptController.getTranscriptsByTopic
);

// Get unprocessed transcripts
router.get('/processing/unprocessed', 
  authMiddleware.authenticate,
  transcriptController.getUnprocessedTranscripts
);

module.exports = router;