const express = require('express');
const router = express.Router();
const academicController = require('../controllers/academicController');
const authMiddleware = require('../../authentication/middleware/auth');

// Extract citations from academic paper
router.post('/papers/:contentId/extract-citations', 
  authMiddleware.authenticate,
  academicController.extractPaperCitations
);

// Process academic papers for citation extraction
router.post('/papers/process', 
  authMiddleware.authenticate,
  authMiddleware.authorize(['admin', 'editor']),
  academicController.processAcademicPapers
);

module.exports = router;