const express = require('express');
const router = express.Router();
const privacyController = require('../controllers/privacyController');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES } = require('../utils/roles');

// Public routes
router.get('/policy', privacyController.getPrivacyPolicy);
router.get('/terms', privacyController.getTermsOfService);

// Protected routes
router.get('/export', authenticate, privacyController.exportUserData);
router.post('/delete-account', authenticate, privacyController.requestAccountDeletion);
router.post('/cancel-deletion', authenticate, privacyController.cancelAccountDeletion);

// Admin routes
router.delete('/execute-deletion/:id', authenticate, authorize(ROLES.ADMIN), privacyController.executeAccountDeletion);

module.exports = router;