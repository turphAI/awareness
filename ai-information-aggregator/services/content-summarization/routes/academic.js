const express = require('express');
const SummarizationController = require('../controllers/summarizationController');

const router = express.Router();
const controller = new SummarizationController();

/**
 * @route POST /academic/analyze
 * @desc Analyze single academic paper with structure-aware parsing
 * @access Public
 */
router.post('/analyze', async (req, res) => {
  await controller.analyzeAcademicPaper(req, res);
});

/**
 * @route POST /academic/batch-analyze
 * @desc Batch analyze multiple academic papers
 * @access Public
 */
router.post('/batch-analyze', async (req, res) => {
  await controller.batchAnalyzeAcademicPapers(req, res);
});

/**
 * @route GET /academic/config
 * @desc Get academic analysis configuration options
 * @access Public
 */
router.get('/config', async (req, res) => {
  await controller.getAcademicConfig(req, res);
});

/**
 * @route GET /academic/health
 * @desc Health check for academic analysis functionality
 * @access Public
 */
router.get('/health', async (req, res) => {
  await controller.healthCheck(req, res);
});

module.exports = router;