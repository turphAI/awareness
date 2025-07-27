const express = require('express');
const SummarizationController = require('../controllers/summarizationController');

const router = express.Router();
const controller = new SummarizationController();

/**
 * @route POST /visual/analyze
 * @desc Analyze single visual content and generate description
 * @access Public
 */
router.post('/analyze', async (req, res) => {
  await controller.analyzeVisualContent(req, res);
});

/**
 * @route POST /visual/batch
 * @desc Batch analyze multiple visual contents
 * @access Public
 */
router.post('/batch', async (req, res) => {
  await controller.batchAnalyzeVisualContent(req, res);
});

/**
 * @route GET /visual/config
 * @desc Get visual content analysis configuration options
 * @access Public
 */
router.get('/config', async (req, res) => {
  await controller.getVisualConfig(req, res);
});

/**
 * @route PUT /visual/threshold
 * @desc Update visual content relevance threshold
 * @access Public
 */
router.put('/threshold', async (req, res) => {
  await controller.updateVisualRelevanceThreshold(req, res);
});

/**
 * @route GET /visual/health
 * @desc Health check for visual content analysis
 * @access Public
 */
router.get('/health', async (req, res) => {
  try {
    const testImageData = {
      base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
      mimeType: 'image/png'
    };
    
    const result = await controller.visualContentDescriptor.analyzeVisualContent(testImageData, {
      detailLevel: 'brief',
      includeRelevanceAssessment: true
    });

    res.json({
      success: true,
      status: 'healthy',
      data: {
        working: !result.error,
        confidence: result.confidence,
        relevanceMethod: result.relevanceAssessment?.method,
        aiAvailable: controller.visualContentDescriptor.getConfig().aiAvailable
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message
    });
  }
});

module.exports = router;