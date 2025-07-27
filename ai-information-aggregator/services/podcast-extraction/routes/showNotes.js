/**
 * Show Notes Routes
 */

const express = require('express');
const router = express.Router();
const showNotesController = require('../controllers/showNotesController');

// Analyze show notes for an episode
router.post('/analyze/:episodeId', showNotesController.analyzeEpisodeShowNotes);

// Parse show notes text and extract references
router.post('/parse', showNotesController.parseShowNotes);

// Cross-reference show notes with transcript references
router.post('/cross-reference/:episodeId', showNotesController.crossReferenceWithTranscript);

// Update episode show notes
router.put('/update/:episodeId', showNotesController.updateEpisodeShowNotes);

// Get show notes analysis summary for an episode
router.get('/summary/:episodeId', showNotesController.getShowNotesAnalysisSummary);

// Batch analyze show notes for multiple episodes
router.post('/batch-analyze', showNotesController.batchAnalyzeShowNotes);

module.exports = router;