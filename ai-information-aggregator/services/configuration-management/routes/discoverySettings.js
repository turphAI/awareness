const express = require('express');
const auth = require('../middleware/auth');
const discoverySettingsController = require('../controllers/discoverySettingsController');

const router = express.Router();

// Get preset configurations (must be before /:userId routes)
router.get('/presets', auth, discoverySettingsController.getPresets);

// Get discovery settings for a user
router.get('/:userId', auth, discoverySettingsController.getSettings);

// Update discovery settings
router.put('/:userId', auth, discoverySettingsController.updateSettings);

// Update aggressiveness level (convenience endpoint)
router.put('/:userId/aggressiveness', auth, discoverySettingsController.updateAggressivenessLevel);

// Get discovery configuration for external services
router.get('/:userId/config', auth, discoverySettingsController.getDiscoveryConfig);

// Calculate effective threshold for specific content
router.post('/:userId/threshold', auth, discoverySettingsController.calculateThreshold);

// Evaluate content for auto-inclusion
router.post('/:userId/evaluate', auth, discoverySettingsController.evaluateContent);

// Apply a preset configuration
router.post('/:userId/preset', auth, discoverySettingsController.applyPreset);

// Reset settings to defaults
router.delete('/:userId', auth, discoverySettingsController.resetSettings);

module.exports = router;