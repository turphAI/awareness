const express = require('express');
const router = express.Router();
const referenceController = require('../controllers/referenceController');
const authMiddleware = require('../../authentication/middleware/auth');

// Extract references from content
router.post('/extract/:contentId', 
  authMiddleware.authenticate,
  referenceController.extractContentReferences
);

// Process unresolved references
router.post('/process-unresolved', 
  authMiddleware.authenticate,
  authMiddleware.authorize(['admin', 'editor']),
  referenceController.processUnresolvedReferences
);

// Resolve a reference
router.post('/:referenceId/resolve', 
  authMiddleware.authenticate,
  referenceController.resolveReference
);

// Verify a reference
router.post('/:referenceId/verify', 
  authMiddleware.authenticate,
  authMiddleware.authorize(['admin', 'editor']),
  referenceController.verifyReference
);

// Normalize a reference
router.post('/:referenceId/normalize', 
  authMiddleware.authenticate,
  referenceController.normalizeReference
);

// Get references by source content
router.get('/source/:contentId', 
  authMiddleware.authenticate,
  referenceController.getReferencesBySourceContent
);

// Get references by target content
router.get('/target/:contentId', 
  authMiddleware.authenticate,
  referenceController.getReferencesByTargetContent
);

// Get unresolved references
router.get('/unresolved', 
  authMiddleware.authenticate,
  referenceController.getUnresolvedReferences
);

// Get references by type
router.get('/type/:type', 
  authMiddleware.authenticate,
  referenceController.getReferencesByType
);

// Get references by verification status
router.get('/verification/:status', 
  authMiddleware.authenticate,
  referenceController.getReferencesByVerificationStatus
);

module.exports = router;