/**
 * Timestamp Routes
 */

const express = require('express');
const router = express.Router();
const timestampController = require('../controllers/timestampController');

// Link a reference to a specific timestamp
router.post('/link/:referenceId', timestampController.linkReferenceToTimestamp);

// Batch link references to timestamps for an episode
router.post('/batch-link/:episodeId', timestampController.batchLinkReferences);

// Get timestamped references for an episode
router.get('/episode/:episodeId/references', timestampController.getTimestampedReferences);

// Create a reference timeline for an episode
router.get('/episode/:episodeId/timeline', timestampController.createReferenceTimeline);

// Extract timestamp from transcript context
router.post('/extract-timestamp', timestampController.extractTimestampFromContext);

// Generate playback URL for a reference
router.get('/playback/:referenceId', timestampController.generatePlaybackUrl);

// Update reference timestamp
router.put('/update/:referenceId', timestampController.updateReferenceTimestamp);

// Remove timestamp link from reference
router.delete('/unlink/:referenceId', timestampController.removeTimestampLink);

module.exports = router;