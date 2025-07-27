const express = require('express');
const SummarizationController = require('../controllers/summarizationController');

const router = express.Router();
const controller = new SummarizationController();

/**
 * Extract key insights from single text
 * POST /insights/extract
 * Body: { text: string, options?: { maxInsights?: number, minConfidence?: number, includeContext?: boolean, contentType?: string } }
 */
router.post('/extract', async (req, res) => {
  await controller.extractInsights(req, res);
});

/**
 * Batch extract insights from multiple texts
 * POST /insights/batch
 * Body: { texts: string[], options?: { maxInsights?: number, minConfidence?: number, includeContext?: boolean, contentType?: string } }
 */
router.post('/batch', async (req, res) => {
  await controller.batchExtractInsights(req, res);
});

/**
 * Get insight extraction configuration options
 * GET /insights/config
 */
router.get('/config', (req, res) => {
  const config = {
    maxInsightsOptions: [3, 5, 8, 10],
    minConfidenceOptions: [0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
    contentTypeOptions: ['general', 'academic', 'news', 'technical'],
    insightTypes: ['fact', 'conclusion', 'implication', 'recommendation'],
    defaultOptions: {
      maxInsights: 5,
      minConfidence: 0.6,
      includeContext: true,
      contentType: 'general'
    },
    limits: {
      maxTextLength: 50000, // characters
      maxBatchSize: 20
    }
  };

  res.json({
    success: true,
    data: config
  });
});

/**
 * Health check for insight extraction service
 * GET /insights/health
 */
router.get('/health', async (req, res) => {
  try {
    const testText = "Artificial intelligence has shown significant improvements in natural language processing. Recent studies demonstrate that transformer models achieve 95% accuracy on comprehension tasks. This breakthrough suggests that AI systems will become more capable of understanding human communication. The implications for customer service and content analysis are substantial.";
    
    const controller = new SummarizationController();
    const result = await controller.keyInsightExtractor.extractInsights(testText, { maxInsights: 3 });

    res.json({
      success: true,
      status: 'healthy',
      data: {
        aiAvailable: !!process.env.ANTHROPIC_API_KEY,
        testInsights: result.insights.length,
        confidence: result.confidence,
        method: result.method
      }
    });

  } catch (error) {
    console.error('Error in insight extraction health check:', error);
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message
    });
  }
});

module.exports = router;