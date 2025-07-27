/**
 * Reference Identification Controller
 * 
 * Handles the identification and processing of references from podcast transcripts.
 */

const mongoose = require('mongoose');
const logger = require('../../../common/utils/logger');
const Transcript = require('../models/Transcript');
const Episode = require('../models/Episode');
const Reference = require('../../content-discovery/models/Reference');
const referenceIdentifier = require('../utils/referenceIdentifier');
const sourceLocator = require('../utils/sourceLocator');
const timestampLinker = require('../utils/timestampLinker');

/**
 * Process a transcript to identify references
 * @param {string} transcriptId - The ID of the transcript to process
 * @returns {Promise<Object>} - The processing result
 */
exports.processTranscript = async (req, res) => {
  try {
    const { transcriptId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(transcriptId)) {
      return res.status(400).json({ error: 'Invalid transcript ID' });
    }
    
    const transcript = await Transcript.findById(transcriptId)
      .populate('episodeId');
    
    if (!transcript) {
      return res.status(404).json({ error: 'Transcript not found' });
    }
    
    // Extract references from the transcript
    const extractedReferences = await referenceIdentifier.identifyReferences(transcript.content);
    
    // Process and save each reference
    const savedReferences = [];
    for (const ref of extractedReferences) {
      const reference = new Reference({
        sourceContentId: transcript.episodeId._id,
        referenceType: ref.type,
        title: ref.title,
        url: ref.url,
        authors: ref.authors,
        publishDate: ref.publishDate,
        context: ref.context,
        timestamp: ref.timestamp,
        resolved: false
      });
      
      await reference.save();
      savedReferences.push(reference);
    }
    
    // Update the transcript to mark it as processed
    transcript.processed = true;
    transcript.referenceCount = savedReferences.length;
    await transcript.save();
    
    // Automatically link references to timestamps
    let timestampLinkingResult = null;
    if (savedReferences.length > 0) {
      try {
        timestampLinkingResult = await timestampLinker.batchLinkReferences(
          transcript.episodeId._id.toString(),
          savedReferences
        );
        logger.info(`Timestamp linking completed: ${timestampLinkingResult.results?.linked || 0} linked, ${timestampLinkingResult.results?.estimated || 0} estimated`);
      } catch (error) {
        logger.error(`Error linking timestamps: ${error.message}`, { error });
        // Don't fail the entire operation if timestamp linking fails
      }
    }
    
    return res.status(200).json({
      message: 'Transcript processed successfully',
      referencesFound: savedReferences.length,
      references: savedReferences,
      timestampLinking: timestampLinkingResult
    });
  } catch (error) {
    logger.error(`Error processing transcript: ${error.message}`, { error });
    return res.status(500).json({ error: 'Failed to process transcript' });
  }
};

/**
 * Locate sources for identified references
 * @param {string} referenceId - The ID of the reference to locate source for
 * @returns {Promise<Object>} - The location result
 */
exports.locateSource = async (req, res) => {
  try {
    const { referenceId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(referenceId)) {
      return res.status(400).json({ error: 'Invalid reference ID' });
    }
    
    const reference = await Reference.findById(referenceId);
    
    if (!reference) {
      return res.status(404).json({ error: 'Reference not found' });
    }
    
    // Attempt to locate the source
    const locationResult = await sourceLocator.locateSource(reference);
    
    // Update the reference with the location result
    if (locationResult.found) {
      reference.resolved = true;
      
      if (locationResult.sourceType === 'existing') {
        reference.targetContentId = locationResult.source._id;
      } else {
        // Create a new source or content entry if needed
        // This would typically be handled by the source management service
        // For now, we'll just update the reference
        reference.url = locationResult.source.url || reference.url;
      }
      
      await reference.save();
      
      return res.status(200).json({
        message: 'Source located successfully',
        reference,
        locationResult
      });
    } else {
      // Source not found automatically
      reference.needsManualResolution = true;
      reference.resolutionAttempts = (reference.resolutionAttempts || 0) + 1;
      await reference.save();
      
      return res.status(200).json({
        message: 'Source not found automatically, queued for manual resolution',
        reference,
        locationResult
      });
    }
  } catch (error) {
    logger.error(`Error locating source: ${error.message}`, { error });
    return res.status(500).json({ error: 'Failed to locate source' });
  }
};

/**
 * Batch process references to locate sources
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Promise<Object>} - The batch processing result
 */
exports.batchLocateSources = async (req, res) => {
  try {
    const { episodeId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(episodeId)) {
      return res.status(400).json({ error: 'Invalid episode ID' });
    }
    
    // Find all references for this episode
    const references = await Reference.find({ 
      sourceContentId: episodeId,
      resolved: false,
      // Don't retry references that have been attempted too many times
      $or: [
        { resolutionAttempts: { $exists: false } },
        { resolutionAttempts: { $lt: 3 } }
      ]
    });
    
    if (references.length === 0) {
      return res.status(200).json({
        message: 'No unresolved references found for this episode',
        resolved: 0,
        total: 0
      });
    }
    
    // Process each reference
    const results = {
      resolved: 0,
      manualResolution: 0,
      failed: 0,
      total: references.length
    };
    
    for (const reference of references) {
      try {
        const locationResult = await sourceLocator.locateSource(reference);
        
        if (locationResult.found) {
          reference.resolved = true;
          
          if (locationResult.sourceType === 'existing') {
            reference.targetContentId = locationResult.source._id;
          } else {
            reference.url = locationResult.source.url || reference.url;
          }
          
          await reference.save();
          results.resolved++;
        } else {
          // Source not found automatically
          reference.needsManualResolution = true;
          reference.resolutionAttempts = (reference.resolutionAttempts || 0) + 1;
          await reference.save();
          results.manualResolution++;
        }
      } catch (error) {
        logger.error(`Error processing reference ${reference._id}: ${error.message}`);
        results.failed++;
      }
    }
    
    // Update the episode with resolution statistics
    const episode = await Episode.findById(episodeId);
    if (episode) {
      episode.referencesResolved = await Reference.countDocuments({
        sourceContentId: episodeId,
        resolved: true
      });
      
      episode.referencesNeedingManualResolution = await Reference.countDocuments({
        sourceContentId: episodeId,
        needsManualResolution: true
      });
      
      await episode.save();
    }
    
    return res.status(200).json({
      message: 'Batch source location completed',
      results
    });
  } catch (error) {
    logger.error(`Error in batch source location: ${error.message}`, { error });
    return res.status(500).json({ error: 'Failed to process batch source location' });
  }
};

/**
 * Manually resolve a reference
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Promise<Object>} - The manual resolution result
 */
exports.manuallyResolveReference = async (req, res) => {
  try {
    const { referenceId } = req.params;
    const { url, title, authors, publishDate, targetContentId } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(referenceId)) {
      return res.status(400).json({ error: 'Invalid reference ID' });
    }
    
    const reference = await Reference.findById(referenceId);
    
    if (!reference) {
      return res.status(404).json({ error: 'Reference not found' });
    }
    
    // Update the reference with the manually provided information
    if (url) reference.url = url;
    if (title) reference.title = title;
    if (authors) reference.authors = authors;
    if (publishDate) reference.publishDate = new Date(publishDate);
    
    // If a target content ID is provided, validate and use it
    if (targetContentId) {
      if (!mongoose.Types.ObjectId.isValid(targetContentId)) {
        return res.status(400).json({ error: 'Invalid target content ID' });
      }
      reference.targetContentId = targetContentId;
    }
    
    // Mark as resolved and no longer needing manual resolution
    reference.resolved = true;
    reference.needsManualResolution = false;
    reference.manuallyResolved = true;
    reference.manualResolutionDate = new Date();
    
    await reference.save();
    
    return res.status(200).json({
      message: 'Reference manually resolved successfully',
      reference
    });
  } catch (error) {
    logger.error(`Error manually resolving reference: ${error.message}`, { error });
    return res.status(500).json({ error: 'Failed to manually resolve reference' });
  }
};

/**
 * Get references needing manual resolution
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Promise<Object>} - The references needing manual resolution
 */
exports.getReferencesNeedingResolution = async (req, res) => {
  try {
    const { limit = 10, skip = 0 } = req.query;
    
    const references = await Reference.find({
      needsManualResolution: true,
      manuallyResolved: { $ne: true }
    })
    .sort({ resolutionAttempts: -1, createdAt: -1 })
    .skip(parseInt(skip))
    .limit(parseInt(limit))
    .populate('sourceContentId');
    
    const total = await Reference.countDocuments({
      needsManualResolution: true,
      manuallyResolved: { $ne: true }
    });
    
    return res.status(200).json({
      references,
      total,
      limit: parseInt(limit),
      skip: parseInt(skip)
    });
  } catch (error) {
    logger.error(`Error getting references needing resolution: ${error.message}`, { error });
    return res.status(500).json({ error: 'Failed to get references needing resolution' });
  }
};