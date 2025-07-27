const express = require('express');
const SummarizationController = require('../controllers/summarizationController');

const router = express.Router();
const summarizationController = new SummarizationController();

// Summarize single text
router.post('/text', (req, res) => {
  summarizationController.summarizeText(req, res);
});

// Batch summarize multiple texts
router.post('/batch', (req, res) => {
  summarizationController.batchSummarize(req, res);
});

// Get configuration options
router.get('/config', (req, res) => {
  summarizationController.getConfig(req, res);
});

// Health check
router.get('/health', (req, res) => {
  summarizationController.healthCheck(req, res);
});

module.exports = router;