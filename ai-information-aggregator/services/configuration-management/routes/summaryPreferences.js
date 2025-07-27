const express = require('express');
const auth = require('../middleware/auth');
const summaryPreferencesController = require('../controllers/summaryPreferencesController');

const router = express.Router();

// Get summary preferences for a user
router.get('/:userId', auth, summaryPreferencesController.getPreferences);

// Update summary preferences
router.put('/:userId', auth, summaryPreferencesController.updatePreferences);

// Get summary parameters for specific content type
router.get('/:userId/parameters', auth, summaryPreferencesController.getSummaryParameters);

// Calculate adaptive summary length
router.post('/:userId/adaptive-length', auth, summaryPreferencesController.getAdaptiveLength);

// Update user behavior metrics
router.put('/:userId/behavior-metrics', auth, summaryPreferencesController.updateBehaviorMetrics);

// Update content type preferences
router.put('/:userId/content-type', auth, summaryPreferencesController.updateContentTypePreferences);

// Update length parameters
router.put('/:userId/length-parameters', auth, summaryPreferencesController.updateLengthParameters);

// Reset preferences to defaults
router.delete('/:userId', auth, summaryPreferencesController.resetPreferences);

// Get available length types and their descriptions
router.get('/length-types/info', summaryPreferencesController.getLengthTypes);

module.exports = router;