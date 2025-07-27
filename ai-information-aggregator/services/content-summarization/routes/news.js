const express = require('express');
const SummarizationController = require('../controllers/summarizationController');

const router = express.Router();
const controller = new SummarizationController();

/**
 * @route POST /news/analyze
 * @desc Analyze single news article for fact vs opinion and credibility
 * @body {text: string, options: object}
 */
router.post('/analyze', controller.analyzeNewsArticle.bind(controller));

/**
 * @route POST /news/batch-analyze
 * @desc Batch analyze multiple news articles
 * @body {texts: string[], options: object}
 */
router.post('/batch-analyze', controller.batchAnalyzeNewsArticles.bind(controller));

/**
 * @route GET /news/config
 * @desc Get news analysis configuration options
 */
router.get('/config', controller.getNewsConfig.bind(controller));

/**
 * @route GET /news/health
 * @desc Health check for news analysis functionality
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'implemented',
    message: 'News article analysis service is operational',
    features: [
      'fact_vs_opinion_classification',
      'source_credibility_assessment',
      'bias_detection',
      'content_quality_assessment'
    ]
  });
});

module.exports = router;