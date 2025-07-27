const express = require('express');
const auth = require('../middleware/auth');
const notificationController = require('../controllers/notificationController');

const router = express.Router();

/**
 * @route GET /api/notifications/:userId
 * @desc Get notification settings for a user
 * @access Private
 */
router.get('/:userId', auth, notificationController.getNotificationSettings);

/**
 * @route PUT /api/notifications/:userId
 * @desc Update notification settings for a user
 * @access Private
 */
router.put('/:userId', auth, notificationController.updateNotificationSettings);

/**
 * @route PUT /api/notifications/:userId/channels/:channel
 * @desc Update specific channel settings for a user
 * @access Private
 */
router.put('/:userId/channels/:channel', auth, notificationController.updateChannelSettings);

/**
 * @route GET /api/notifications/:userId/status
 * @desc Check if notifications are currently allowed for a user
 * @access Private
 */
router.get('/:userId/status', auth, notificationController.checkNotificationStatus);

/**
 * @route POST /api/notifications/:userId/reset
 * @desc Reset notification settings to defaults
 * @access Private
 */
router.post('/:userId/reset', auth, notificationController.resetNotificationSettings);

module.exports = router;