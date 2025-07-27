const express = require('express');
const router = express.Router();
const audioController = require('../controllers/audioController');
const authMiddleware = require('../../authentication/middleware/auth');

// Process episode audio
router.post('/process/:episodeId', 
  authMiddleware.authenticate,
  authMiddleware.authorize(['admin', 'editor']),
  audioController.processEpisodeAudio
);

// Process pending episodes
router.post('/process-pending', 
  authMiddleware.authenticate,
  authMiddleware.authorize(['admin', 'editor']),
  audioController.processPendingEpisodes
);

// Get audio processing status
router.get('/status', 
  authMiddleware.authenticate,
  audioController.getProcessingStatus
);

// Clean up processing jobs
router.post('/cleanup', 
  authMiddleware.authenticate,
  authMiddleware.authorize(['admin']),
  audioController.cleanupProcessingJobs
);

// Reset episode processing status
router.post('/reset/:episodeId', 
  authMiddleware.authenticate,
  authMiddleware.authorize(['admin', 'editor']),
  audioController.resetProcessingStatus
);

module.exports = router;