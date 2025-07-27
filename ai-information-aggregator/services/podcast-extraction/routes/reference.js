/**
 * Reference Identification Routes
 */

const express = require('express');
const router = express.Router();
const referenceIdentificationController = require('../controllers/referenceIdentificationController');

// Process a transcript to identify references
router.post('/process-transcript/:transcriptId', referenceIdentificationController.processTranscript);

// Locate source for a specific reference
router.post('/locate-source/:referenceId', referenceIdentificationController.locateSource);

// Batch process references to locate sources for an episode
router.post('/batch-locate-sources/:episodeId', referenceIdentificationController.batchLocateSources);

// Manually resolve a reference
router.put('/manual-resolve/:referenceId', referenceIdentificationController.manuallyResolveReference);

// Get references needing manual resolution
router.get('/needing-resolution', referenceIdentificationController.getReferencesNeedingResolution);

module.exports = router;