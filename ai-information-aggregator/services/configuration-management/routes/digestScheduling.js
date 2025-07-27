const express = require('express');
const auth = require('../middleware/auth');
const digestSchedulingController = require('../controllers/digestSchedulingController');

const router = express.Router();

// Get digest scheduling settings for a user
router.get('/:userId', auth, digestSchedulingController.getScheduling);

// Update digest scheduling settings
router.put('/:userId', auth, digestSchedulingController.updateScheduling);

// Enable or disable digest scheduling
router.put('/:userId/toggle', auth, digestSchedulingController.toggleScheduling);

// Update delivery frequency
router.put('/:userId/frequency', auth, digestSchedulingController.updateFrequency);

// Update delivery time
router.put('/:userId/delivery-time', auth, digestSchedulingController.updateDeliveryTime);

// Update content selection criteria
router.put('/:userId/content-selection', auth, digestSchedulingController.updateContentSelection);

// Update formatting preferences
router.put('/:userId/formatting', auth, digestSchedulingController.updateFormatting);

// Update delivery method settings
router.put('/:userId/delivery-method', auth, digestSchedulingController.updateDeliveryMethod);

// Get next delivery time
router.get('/:userId/next-delivery', auth, digestSchedulingController.getNextDelivery);

// Mark delivery as completed (internal use)
router.post('/:userId/mark-completed', auth, digestSchedulingController.markDeliveryCompleted);

// Get content selection criteria
router.get('/:userId/content-criteria', auth, digestSchedulingController.getContentSelectionCriteria);

// Get formatting preferences
router.get('/:userId/formatting-preferences', auth, digestSchedulingController.getFormattingPreferences);

// Reset scheduling to defaults
router.delete('/:userId', auth, digestSchedulingController.resetScheduling);

// Get available frequency options
router.get('/frequency-options/info', digestSchedulingController.getFrequencyOptions);

// Get schedules ready for delivery (internal use)
router.get('/ready-for-delivery/list', auth, digestSchedulingController.getReadyForDelivery);

// Generate digest for a user
router.post('/:userId/generate', auth, digestSchedulingController.generateDigest);

// Deliver digest to a user
router.post('/:userId/deliver', auth, digestSchedulingController.deliverDigest);

// Generate and deliver digest in one operation
router.post('/:userId/generate-and-deliver', auth, digestSchedulingController.generateAndDeliverDigest);

// Process all ready digests (batch operation for scheduler)
router.post('/process-ready/batch', auth, digestSchedulingController.processReadyDigests);

// Get delivery statistics for a user
router.get('/:userId/delivery-stats', auth, digestSchedulingController.getDeliveryStats);

module.exports = router;