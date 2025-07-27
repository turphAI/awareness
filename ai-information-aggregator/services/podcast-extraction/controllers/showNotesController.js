/**
 * Show Notes Controller
 * 
 * Handles show notes analysis and cross-referencing operations.
 */

const mongoose = require('mongoose');
const logger = require('../../../common/utils/logger');
const showNotesAnalyzer = require('../utils/showNotesAnalyzer');
const Episode = require('../models/Episode');

/**
 * Analyze show notes for an episode
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Promise<Object>} - Analysis result
 */
exports.analyzeEpisodeShowNotes = async (req, res) => {
  try {
    const { episodeId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(episodeId)) {
      return res.status(400).json({ error: 'Invalid episode ID' });
    }
    
    const result = await showNotesAnalyzer.analyzeEpisodeShowNotes(episodeId);
    
    if (!result.success) {
      return res.status(200).json({
        message: result.message,
        hasShowNotes: result.hasShowNotes
      });
    }
    
    return res.status(200).json({
      message: 'Show notes analysis completed successfully',
      result
    });
  } catch (error) {
    logger.error(`Error analyzing show notes: ${error.message}`, { error });
    return res.status(500).json({ error: 'Failed to analyze show notes' });
  }
};

/**
 * Parse show notes text and extract references
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Promise<Object>} - Parsed references
 */
exports.parseShowNotes = async (req, res) => {
  try {
    const { showNotes } = req.body;
    
    if (!showNotes || typeof showNotes !== 'string') {
      return res.status(400).json({ error: 'Show notes text is required' });
    }
    
    const references = showNotesAnalyzer.parseShowNotes(showNotes);
    
    return res.status(200).json({
      message: 'Show notes parsed successfully',
      references,
      count: references.length
    });
  } catch (error) {
    logger.error(`Error parsing show notes: ${error.message}`, { error });
    return res.status(500).json({ error: 'Failed to parse show notes' });
  }
};

/**
 * Cross-reference show notes with transcript references
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Promise<Object>} - Cross-reference results
 */
exports.crossReferenceWithTranscript = async (req, res) => {
  try {
    const { episodeId } = req.params;
    const { showNotesReferences } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(episodeId)) {
      return res.status(400).json({ error: 'Invalid episode ID' });
    }
    
    if (!showNotesReferences || !Array.isArray(showNotesReferences)) {
      return res.status(400).json({ error: 'Show notes references array is required' });
    }
    
    const result = await showNotesAnalyzer.crossReferenceWithTranscript(
      episodeId, 
      showNotesReferences
    );
    
    return res.status(200).json({
      message: 'Cross-reference completed successfully',
      result
    });
  } catch (error) {
    logger.error(`Error cross-referencing show notes: ${error.message}`, { error });
    return res.status(500).json({ error: 'Failed to cross-reference show notes' });
  }
};

/**
 * Update episode show notes
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Promise<Object>} - Update result
 */
exports.updateEpisodeShowNotes = async (req, res) => {
  try {
    const { episodeId } = req.params;
    const { showNotes } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(episodeId)) {
      return res.status(400).json({ error: 'Invalid episode ID' });
    }
    
    if (typeof showNotes !== 'string') {
      return res.status(400).json({ error: 'Show notes must be a string' });
    }
    
    const episode = await Episode.findById(episodeId);
    if (!episode) {
      return res.status(404).json({ error: 'Episode not found' });
    }
    
    // Update show notes
    episode.showNotes = showNotes;
    await episode.save();
    
    // Optionally trigger analysis
    const { analyze = false } = req.query;
    let analysisResult = null;
    
    if (analyze === 'true' && showNotes.trim() !== '') {
      try {
        analysisResult = await showNotesAnalyzer.analyzeEpisodeShowNotes(episodeId);
      } catch (error) {
        logger.error(`Error analyzing updated show notes: ${error.message}`);
        // Don't fail the update if analysis fails
      }
    }
    
    return res.status(200).json({
      message: 'Episode show notes updated successfully',
      episode: {
        id: episode._id,
        title: episode.title,
        showNotesLength: showNotes.length
      },
      analysisResult
    });
  } catch (error) {
    logger.error(`Error updating episode show notes: ${error.message}`, { error });
    return res.status(500).json({ error: 'Failed to update episode show notes' });
  }
};

/**
 * Get show notes analysis summary for an episode
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Promise<Object>} - Analysis summary
 */
exports.getShowNotesAnalysisSummary = async (req, res) => {
  try {
    const { episodeId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(episodeId)) {
      return res.status(400).json({ error: 'Invalid episode ID' });
    }
    
    const episode = await Episode.findById(episodeId);
    if (!episode) {
      return res.status(404).json({ error: 'Episode not found' });
    }
    
    // Get references with show notes metadata
    const Reference = require('../../content-discovery/models/Reference');
    const allReferences = await Reference.find({ sourceContentId: episodeId });
    
    const showNotesMatched = allReferences.filter(ref => 
      ref.metadata && ref.metadata.showNotesMatch
    );
    
    const showNotesOnly = allReferences.filter(ref => 
      ref.metadata && ref.metadata.extractedFrom === 'show_notes'
    );
    
    const transcriptOnly = allReferences.filter(ref => 
      !ref.metadata || (
        ref.metadata.extractedFrom !== 'show_notes' && 
        !ref.metadata.showNotesMatch
      )
    );
    
    return res.status(200).json({
      episode: {
        id: episode._id,
        title: episode.title,
        hasShowNotes: !!episode.showNotes,
        showNotesLength: episode.showNotes ? episode.showNotes.length : 0
      },
      summary: {
        totalReferences: allReferences.length,
        showNotesMatched: showNotesMatched.length,
        showNotesOnly: showNotesOnly.length,
        transcriptOnly: transcriptOnly.length
      },
      references: {
        matched: showNotesMatched.map(ref => ({
          id: ref._id,
          title: ref.title,
          type: ref.referenceType,
          confidence: ref.metadata?.showNotesConfidence,
          matchType: ref.metadata?.showNotesMatchType
        })),
        showNotesOnly: showNotesOnly.map(ref => ({
          id: ref._id,
          title: ref.title,
          type: ref.referenceType,
          url: ref.url
        })),
        transcriptOnly: transcriptOnly.map(ref => ({
          id: ref._id,
          title: ref.title,
          type: ref.referenceType,
          timestamp: ref.timestamp
        }))
      }
    });
  } catch (error) {
    logger.error(`Error getting show notes analysis summary: ${error.message}`, { error });
    return res.status(500).json({ error: 'Failed to get show notes analysis summary' });
  }
};

/**
 * Batch analyze show notes for multiple episodes
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Promise<Object>} - Batch analysis results
 */
exports.batchAnalyzeShowNotes = async (req, res) => {
  try {
    const { episodeIds, limit = 10 } = req.body;
    
    let episodes;
    
    if (episodeIds && Array.isArray(episodeIds)) {
      // Validate episode IDs
      const invalidIds = episodeIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
      if (invalidIds.length > 0) {
        return res.status(400).json({ 
          error: 'Invalid episode IDs', 
          invalidIds 
        });
      }
      
      episodes = await Episode.find({ 
        _id: { $in: episodeIds },
        showNotes: { $exists: true, $ne: null, $ne: '' }
      });
    } else {
      // Find episodes with show notes that haven't been analyzed
      episodes = await Episode.find({
        showNotes: { $exists: true, $ne: null, $ne: '' }
      })
      .limit(parseInt(limit))
      .sort({ publishDate: -1 });
    }
    
    if (episodes.length === 0) {
      return res.status(200).json({
        message: 'No episodes with show notes found',
        results: {
          processed: 0,
          successful: 0,
          failed: 0,
          total: 0
        }
      });
    }
    
    const results = {
      processed: 0,
      successful: 0,
      failed: 0,
      total: episodes.length,
      details: []
    };
    
    // Process each episode
    for (const episode of episodes) {
      try {
        results.processed++;
        
        const analysisResult = await showNotesAnalyzer.analyzeEpisodeShowNotes(
          episode._id.toString()
        );
        
        if (analysisResult.success) {
          results.successful++;
          results.details.push({
            episodeId: episode._id,
            episodeTitle: episode.title,
            status: 'success',
            summary: analysisResult.summary
          });
        } else {
          results.failed++;
          results.details.push({
            episodeId: episode._id,
            episodeTitle: episode.title,
            status: 'failed',
            message: analysisResult.message
          });
        }
      } catch (error) {
        results.failed++;
        results.details.push({
          episodeId: episode._id,
          episodeTitle: episode.title,
          status: 'error',
          error: error.message
        });
        
        logger.error(`Error analyzing show notes for episode ${episode._id}: ${error.message}`);
      }
    }
    
    return res.status(200).json({
      message: 'Batch show notes analysis completed',
      results
    });
  } catch (error) {
    logger.error(`Error in batch show notes analysis: ${error.message}`, { error });
    return res.status(500).json({ error: 'Failed to batch analyze show notes' });
  }
};