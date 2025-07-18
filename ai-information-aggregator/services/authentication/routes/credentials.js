const express = require('express');
const router = express.Router();
const credentialController = require('../controllers/credentialController');
const { authenticate } = require('../middleware/auth');
const { validateCredential } = require('../middleware/validation');

// All routes require authentication
router.use(authenticate);

// Get all credentials for the authenticated user
router.get('/', credentialController.getCredentials);

// Get credential by ID
router.get('/:id', credentialController.getCredentialById);

// Create a new credential
router.post('/', validateCredential, credentialController.createCredential);

// Update credential
router.put('/:id', validateCredential, credentialController.updateCredential);

// Delete credential
router.delete('/:id', credentialController.deleteCredential);

// Get decrypted credential
router.get('/:id/decrypt', credentialController.getDecryptedCredential);

// Verify credential
router.post('/:id/verify', credentialController.verifyCredential);

module.exports = router;