const express = require('express');
const SummarizationController = require('../controllers/summarizationController');

const router = express.Router();
const controller = new SummarizationController();

/**
 * @route POST /categorize
 * @desc Categorize single text content
 * @access Public
 */
router.post('/categorize', async (req, res) => {
  await controller.categorizeText(req, res);
});

/**
 * @route POST /batch-categorize
 * @desc Batch categorize multiple texts
 * @access Public
 */
router.post('/batch-categorize', async (req, res) => {
  await controller.batchCategorize(req, res);
});

/**
 * @route GET /categories
 * @desc Get available categories
 * @access Public
 */
router.get('/categories', async (req, res) => {
  await controller.getCategories(req, res);
});

/**
 * @route POST /categories
 * @desc Add custom category
 * @access Public
 */
router.post('/categories', async (req, res) => {
  await controller.addCategory(req, res);
});

/**
 * @route DELETE /categories/:name
 * @desc Remove category
 * @access Public
 */
router.delete('/categories/:name', async (req, res) => {
  await controller.removeCategory(req, res);
});

/**
 * @route GET /health
 * @desc Health check for categorization service
 * @access Public
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    message: 'Content categorization service is operational',
    features: [
      'Single text categorization',
      'Batch categorization',
      'Multi-label classification',
      'Custom category management',
      'Topic modeling',
      'AI/LLM specialized categories'
    ]
  });
});

module.exports = router;