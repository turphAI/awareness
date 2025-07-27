const express = require('express');
const router = express.Router();
const podcastController = require('../controllers/podcastController');
const authMiddleware = require('../../authentication/middleware/auth');

// Get all podcasts
router.get('/', 
  authMiddleware.authenticate,
  podcastController.getAllPodcasts
);

// Get podcast by ID
router.get('/:id', 
  authMiddleware.authenticate,
  podcastController.getPodcastById
);

// Create new podcast
router.post('/', 
  authMiddleware.authenticate,
  authMiddleware.authorize(['admin', 'editor']),
  podcastController.createPodcast
);

// Update podcast
router.put('/:id', 
  authMiddleware.authenticate,
  authMiddleware.authorize(['admin', 'editor']),
  podcastController.updatePodcast
);

// Delete podcast
router.delete('/:id', 
  authMiddleware.authenticate,
  authMiddleware.authorize(['admin']),
  podcastController.deletePodcast
);

// Get episodes for podcast
router.get('/:id/episodes', 
  authMiddleware.authenticate,
  podcastController.getPodcastEpisodes
);

// Check podcast feed for new episodes
router.post('/:id/check', 
  authMiddleware.authenticate,
  podcastController.checkPodcastFeed
);

// Schedule immediate check for podcast
router.post('/:id/schedule', 
  authMiddleware.authenticate,
  podcastController.scheduleImmediateCheck
);

// Get monitoring status
router.get('/monitoring/status', 
  authMiddleware.authenticate,
  podcastController.getMonitoringStatus
);

// Clean up monitoring jobs
router.post('/monitoring/cleanup', 
  authMiddleware.authenticate,
  authMiddleware.authorize(['admin']),
  podcastController.cleanupMonitoringJobs
);

// Get podcasts with errors
router.get('/monitoring/errors', 
  authMiddleware.authenticate,
  podcastController.getPodcastsWithErrors
);

// Reset errors for a podcast
router.post('/:id/reset-errors', 
  authMiddleware.authenticate,
  podcastController.resetPodcastErrors
);

module.exports = router;