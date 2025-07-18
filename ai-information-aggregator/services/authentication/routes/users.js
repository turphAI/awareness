const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');
const { validateUserUpdate, validatePreferences, validateNotifications } = require('../middleware/validation');

// All routes require authentication
router.use(authenticate);

// User profile routes
router.get('/profile', userController.getProfile);
router.put('/profile', validateUserUpdate, userController.updateProfile);

// User preferences routes
router.get('/preferences', userController.getPreferences);
router.put('/preferences', validatePreferences, userController.updatePreferences);

// User notification settings routes
router.get('/notifications', userController.getNotificationSettings);
router.put('/notifications', validateNotifications, userController.updateNotificationSettings);

// Admin-only routes
router.get('/', authorize('admin'), userController.getAllUsers);
router.get('/:id', authorize('admin'), userController.getUserById);
router.put('/:id', authorize('admin'), validateUserUpdate, userController.updateUser);
router.delete('/:id', authorize('admin'), userController.deleteUser);

module.exports = router;