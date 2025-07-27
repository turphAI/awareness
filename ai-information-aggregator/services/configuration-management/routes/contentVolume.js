const express = require('express');
const contentVolumeController = require('../controllers/contentVolumeController');
const router = express.Router();

// Get content volume settings for a user
router.get('/:userId', contentVolumeController.getSettings);

// Update content volume settings
router.put('/:userId', contentVolumeController.updateSettings);

// Update user behavior metrics
router.put('/:userId/behavior', contentVolumeController.updateBehaviorMetrics);

// Get adaptive daily limit for a user
router.get('/:userId/adaptive-limit', contentVolumeController.getAdaptiveLimit);

// Prioritize content based on volume settings
router.post('/:userId/prioritize', contentVolumeController.prioritizeContent);

// Reset settings to defaults
router.delete('/:userId', contentVolumeController.resetSettings);

module.exports = router;