/**
 * Timestamp Controller
 * 
 * Handles timestamp linking operations for podcast references.
 */

const mongoose = require('mongoose');
const logger = require('../../../common/utils/logger');
const timestampLinker = require('../utils/timestampLinker');
const Reference = require('../../content-discovery/models/Reference');
const Episode = require('../models/Episode');

/**
 * Link a reference to a specific timestamp
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Promise<Object>} - The linking result
 */
exports.linkReferenceToTimestamp = async (req, res) => {
  try {
    const { referenceId } = req.params;
    const { episodeId, timestamp, context } = req.body;
    
    // Validate input
    if (!mongoose.Types.ObjectId.isValid(referenceId)) {
      return res.status(400).json({ error: 'Invalid reference ID' });
    }
    
    if (!mongoose.Types.ObjectId.isValid(episodeId)) {
      return res.status(400).json({ error: 'Invalid episode ID' });
    }
    
    if (!timestamp) {
      return res.status(400).json({ error: 'Timestamp is required' });
    }
    
    // Get the reference
    const reference = await Reference.findById(referenceId);
    if (!reference) {
      return res.status(404).json({ error: 'Reference not found' });
    }
    
    // Link the reference to the timestamp
    const result = await timestampLinker.linkReferenceToTimestamp(
      reference,
      episodeId,
      timestamp,
      context
    );
    
    return res.status(200).json({
      message: 'Reference linked to timestamp successfully',
      result
    });
  } catch (error) {
    logger.error(`Error linking reference to timestamp: ${error.message}`, { error });
    return res.status(500).json({ error: 'Failed to link reference to timestamp' });
  }
};

/**
 * Batch link references to timestamps for an episode
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Promise<Object>} - The batch linking result
 */
exports.batchLinkReferences = async (req, res) => {
  try {
    const { episodeId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(episodeId)) {
      return res.status(400).json({ error: 'Invalid episode ID' });
    }
    
    // Get all references for this episode that don't have timestamps yet
    const references = await Reference.find({
      sourceContentId: episodeId,
      'contextLocation.type': { $ne: 'timestamp' }
    });
    
    if (references.length === 0) {
      return res.status(200).json({
        message: 'No references found that need timestamp linking',
        results: {
          linked: 0,
          estimated: 0,
          failed: 0,
          total: 0,
          details: []
        }
      });
    }
    
    // Batch link the references
    const result = await timestampLinker.batchLinkReferences(episodeId, references);
    
    return res.status(200).json({
      message: 'Batch timestamp linking completed',
      result
    });
  } catch (error) {
    logger.error(`Error in batch timestamp linking: ${error.message}`, { error });
    return res.status(500).json({ error: 'Failed to batch link references to timestamps' });
  }
};

/**
 * Get timestamped references for an episode
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Promise<Object>} - The timestamped references
 */
exports.getTimestampedReferences = async (req, res) => {
  try {
    const { episodeId } = req.params;
    const { sortBy = 'timestamp', order = 'asc', limit = 100 } = req.query;
    
    if (!mongoose.Types.ObjectId.isValid(episodeId)) {
      return res.status(400).json({ error: 'Invalid episode ID' });
    }
    
    const references = await timestampLinker.getTimestampedReferences(episodeId, {
      sortBy,
      order,
      limit: parseInt(limit)
    });
    
    return res.status(200).json({
      episodeId,
      references,
      total: references.length
    });
  } catch (error) {
    logger.error(`Error getting timestamped references: ${error.message}`, { error });
    return res.status(500).json({ error: 'Failed to get timestamped references' });
  }
};

/**
 * Create a reference timeline for an episode
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Promise<Object>} - The reference timeline
 */
exports.createReferenceTimeline = async (req, res) => {
  try {
    const { episodeId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(episodeId)) {
      return res.status(400).json({ error: 'Invalid episode ID' });
    }
    
    const timeline = await timestampLinker.createReferenceTimeline(episodeId);
    
    return res.status(200).json(timeline);
  } catch (error) {
    logger.error(`Error creating reference timeline: ${error.message}`, { error });
    return res.status(500).json({ error: 'Failed to create reference timeline' });
  }
};

/**
 * Extract timestamp from transcript context
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Promise<Object>} - The timestamp extraction result
 */
exports.extractTimestampFromContext = async (req, res) => {
  try {
    const { transcriptText, referenceContext } = req.body;
    
    if (!transcriptText || !referenceContext) {
      return res.status(400).json({ 
        error: 'Both transcriptText and referenceContext are required' 
      });
    }
    
    const result = await timestampLinker.extractTimestampFromContext(
      transcriptText,
      referenceContext
    );
    
    return res.status(200).json(result);
  } catch (error) {
    logger.error(`Error extracting timestamp from context: ${error.message}`, { error });
    return res.status(500).json({ error: 'Failed to extract timestamp from context' });
  }
};

/**
 * Generate playback URL for a reference
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Promise<Object>} - The playback URL
 */
exports.generatePlaybackUrl = async (req, res) => {
  try {
    const { referenceId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(referenceId)) {
      return res.status(400).json({ error: 'Invalid reference ID' });
    }
    
    // Get the reference with timestamp information
    const reference = await Reference.findById(referenceId);
    if (!reference) {
      return res.status(404).json({ error: 'Reference not found' });
    }
    
    if (!reference.metadata || !reference.metadata.episodeId) {
      return res.status(400).json({ error: 'Reference is not linked to an episode' });
    }
    
    if (!reference.metadata.timestampSeconds) {
      return res.status(400).json({ error: 'Reference does not have timestamp information' });
    }
    
    // Get the episode
    const episode = await Episode.findById(reference.metadata.episodeId);
    if (!episode) {
      return res.status(404).json({ error: 'Episode not found' });
    }
    
    // Generate playback URL
    const playbackUrl = timestampLinker._generatePlaybackUrl(
      episode,
      reference.metadata.timestampSeconds
    );
    
    if (!playbackUrl) {
      return res.status(400).json({ error: 'Episode does not have audio URL' });
    }
    
    return res.status(200).json({
      referenceId,
      episodeId: episode._id,
      episodeTitle: episode.title,
      timestamp: reference.contextLocation.value,
      timestampSeconds: reference.metadata.timestampSeconds,
      playbackUrl,
      audioUrl: episode.audioUrl
    });
  } catch (error) {
    logger.error(`Error generating playback URL: ${error.message}`, { error });
    return res.status(500).json({ error: 'Failed to generate playback URL' });
  }
};

/**
 * Update reference timestamp
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Promise<Object>} - The update result
 */
exports.updateReferenceTimestamp = async (req, res) => {
  try {
    const { referenceId } = req.params;
    const { timestamp, context } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(referenceId)) {
      return res.status(400).json({ error: 'Invalid reference ID' });
    }
    
    if (!timestamp) {
      return res.status(400).json({ error: 'Timestamp is required' });
    }
    
    // Get the reference
    const reference = await Reference.findById(referenceId);
    if (!reference) {
      return res.status(404).json({ error: 'Reference not found' });
    }
    
    if (!reference.metadata || !reference.metadata.episodeId) {
      return res.status(400).json({ error: 'Reference is not linked to an episode' });
    }
    
    // Normalize timestamp
    const timestampSeconds = timestampLinker._normalizeTimestamp(timestamp);
    
    // Update the reference
    const updatedReference = await Reference.findByIdAndUpdate(
      referenceId,
      {
        $set: {
          'contextLocation.value': timestamp,
          'contextLocation.type': 'timestamp',
          context: context || reference.context,
          'metadata.timestampSeconds': timestampSeconds,
          'metadata.updatedAt': new Date()
        }
      },
      { new: true }
    );
    
    // Get episode for playback URL
    const episode = await Episode.findById(reference.metadata.episodeId);
    const playbackUrl = timestampLinker._generatePlaybackUrl(episode, timestampSeconds);
    
    return res.status(200).json({
      message: 'Reference timestamp updated successfully',
      reference: updatedReference,
      playbackUrl
    });
  } catch (error) {
    logger.error(`Error updating reference timestamp: ${error.message}`, { error });
    return res.status(500).json({ error: 'Failed to update reference timestamp' });
  }
};

/**
 * Remove timestamp link from reference
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Promise<Object>} - The removal result
 */
exports.removeTimestampLink = async (req, res) => {
  try {
    const { referenceId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(referenceId)) {
      return res.status(400).json({ error: 'Invalid reference ID' });
    }
    
    // Update the reference to remove timestamp information
    const updatedReference = await Reference.findByIdAndUpdate(
      referenceId,
      {
        $unset: {
          'contextLocation.value': '',
          'contextLocation.type': '',
          'metadata.timestampSeconds': '',
          'metadata.episodeId': ''
        },
        $set: {
          'metadata.updatedAt': new Date()
        }
      },
      { new: true }
    );
    
    if (!updatedReference) {
      return res.status(404).json({ error: 'Reference not found' });
    }
    
    return res.status(200).json({
      message: 'Timestamp link removed successfully',
      reference: updatedReference
    });
  } catch (error) {
    logger.error(`Error removing timestamp link: ${error.message}`, { error });
    return res.status(500).json({ error: 'Failed to remove timestamp link' });
  }
};