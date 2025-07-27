const express = require('express');
const router = express.Router();
const referenceIdentificationController = require('../controllers/referenceIdentificationController');
const { protect } = require('../../authentication/middleware/auth');

// Process transcript references
router.post('/transcripts/:id/references', protect, referenceIdentificationController.processTranscriptReferences);

// Process unprocessed transcripts
router.post('/transcripts/process-unprocessed', protect, referenceIdentificationController.processUnprocessedTranscripts);

// Get transcript references
router.get('/transcripts/:id/references', protect, referenceIdentificationController.getTranscriptReferences);

// Get episode references
router.get('/episodes/:id/references', protect, referenceIdentificationController.getEpisodeReferences);

module.exports = router;