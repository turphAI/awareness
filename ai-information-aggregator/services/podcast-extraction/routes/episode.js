const express = require('express');
const router = express.Router();
const episodeController = require('../controllers/episodeController');
const authMiddleware = require('../../authentication/middleware/auth');

// Get all episodes
router.get('/', 
  authMiddleware.authenticate,
  episodeController.getAllEpisodes
);

// Get episode by ID
router.get('/:id', 
  authMiddleware.authenticate,
  episodeController.getEpisodeById
);

// Update episode
router.put('/:id', 
  authMiddleware.authenticate,
  authMiddleware.authorize(['admin', 'editor']),
  episodeController.updateEpisode
);

// Get pending episodes
router.get('/processing/pending', 
  authMiddleware.authenticate,
  episodeController.getPendingEpisodes
);

// Get failed episodes
router.get('/processing/failed', 
  authMiddleware.authenticate,
  episodeController.getFailedEpisodes
);

// Get episodes without transcripts
router.get('/transcripts/missing', 
  authMiddleware.authenticate,
  episodeController.getEpisodesWithoutTranscripts
);

// Get episodes with unprocessed transcripts
router.get('/transcripts/unprocessed', 
  authMiddleware.authenticate,
  episodeController.getEpisodesWithUnprocessedTranscripts
);

// Reset episode processing status
router.post('/:id/reset-processing', 
  authMiddleware.authenticate,
  authMiddleware.authorize(['admin', 'editor']),
  episodeController.resetProcessingStatus
);

// Get episode transcript
router.get('/:id/transcript', 
  authMiddleware.authenticate,
  episodeController.getEpisodeTranscript
);

module.exports = router;