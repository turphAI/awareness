const express = require('express');
const AgingController = require('../controllers/agingController');
const auth = require('../middleware/auth');

const router = express.Router();
const agingController = new AgingController();

/**
 * @route GET /aging/outdated
 * @desc Identify outdated content
 * @access Private
 * @query {number} limit - Maximum number of items to return (default: 100)
 * @query {string} contentType - Filter by content type
 * @query {string} domain - Filter by source domain
 * @query {boolean} forceRecheck - Force recheck of already flagged content
 */
router.get('/outdated', auth, async (req, res) => {
  await agingController.identifyOutdatedContent(req, res);
});

/**
 * @route GET /aging/due-for-review
 * @desc Get content due for review
 * @access Private
 * @query {number} limit - Maximum number of items to return (default: 50)
 * @query {string} beforeDate - Find content due before this date (ISO string)
 */
router.get('/due-for-review', auth, async (req, res) => {
  await agingController.getContentDueForReview(req, res);
});

/**
 * @route GET /aging/assess/:contentId
 * @desc Assess specific content aging
 * @access Private
 * @param {string} contentId - Content ID to assess
 */
router.get('/assess/:contentId', auth, async (req, res) => {
  await agingController.assessContentAging(req, res);
});

/**
 * @route PUT /aging/review/:contentId
 * @desc Mark content as reviewed
 * @access Private
 * @param {string} contentId - Content ID to mark as reviewed
 * @body {boolean} isUpToDate - Whether content is up-to-date
 * @body {string[]} reasons - Reasons if content is outdated
 * @body {string[]} suggestions - Update suggestions
 * @body {string} nextReviewDate - Next review date (ISO string)
 */
router.put('/review/:contentId', auth, async (req, res) => {
  await agingController.markContentReviewed(req, res);
});

/**
 * @route GET /aging/suggestions/:contentId
 * @desc Generate update suggestions for content
 * @access Private
 * @param {string} contentId - Content ID to generate suggestions for
 */
router.get('/suggestions/:contentId', auth, async (req, res) => {
  await agingController.generateUpdateSuggestions(req, res);
});

/**
 * @route GET /aging/statistics
 * @desc Get aging statistics
 * @access Private
 */
router.get('/statistics', auth, async (req, res) => {
  await agingController.getAgingStatistics(req, res);
});

/**
 * @route POST /aging/analyze
 * @desc Run comprehensive aging analysis
 * @access Private
 * @body {number} limit - Maximum number of items to analyze
 * @body {string} contentType - Filter by content type
 * @body {string} domain - Filter by source domain
 * @body {boolean} forceRecheck - Force recheck of already flagged content
 */
router.post('/analyze', auth, async (req, res) => {
  await agingController.runAgingAnalysis(req, res);
});

module.exports = router;