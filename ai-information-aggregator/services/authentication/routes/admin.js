const express = require('express');
const router = express.Router();
const { authenticate, authorize, hasPermission } = require('../middleware/auth');
const { ROLES, PERMISSIONS } = require('../utils/roles');
const adminController = require('../controllers/adminController');

// All routes require authentication
router.use(authenticate);

// User management routes (admin only)
router.get('/users', authorize(ROLES.ADMIN), adminController.getAllUsers);
router.get('/users/:id', authorize(ROLES.ADMIN), adminController.getUserById);
router.put('/users/:id', authorize(ROLES.ADMIN), adminController.updateUser);
router.delete('/users/:id', authorize(ROLES.ADMIN), adminController.deleteUser);

// Role management routes (admin only)
router.get('/roles', authorize(ROLES.ADMIN), adminController.getAllRoles);
router.put('/users/:id/role', authorize(ROLES.ADMIN), adminController.updateUserRole);

// System management routes (admin only)
router.get('/system/metrics', hasPermission(PERMISSIONS.VIEW_METRICS), adminController.getSystemMetrics);
router.get('/system/logs', authorize(ROLES.ADMIN), adminController.getSystemLogs);
router.post('/system/settings', hasPermission(PERMISSIONS.MANAGE_SETTINGS), adminController.updateSystemSettings);

// Content moderation routes (admin and moderator)
router.get('/content/pending', authorize(ROLES.ADMIN, ROLES.MODERATOR), adminController.getPendingContent);
router.put('/content/:id/approve', authorize(ROLES.ADMIN, ROLES.MODERATOR), adminController.approveContent);
router.put('/content/:id/reject', authorize(ROLES.ADMIN, ROLES.MODERATOR), adminController.rejectContent);

module.exports = router;