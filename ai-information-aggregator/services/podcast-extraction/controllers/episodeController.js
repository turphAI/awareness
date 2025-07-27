const createLogger = require('../../../common/utils/logger');
const Episode = require('../models/Episode');
const Podcast = require('../models/Podcast');
const Transcript = require('../models/Transcript');

// Initialize logger
const logger = createLogger('episode-controller');

/**
 * Get all episodes
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function getAllEpisodes(req, res, next) {
  try {
    const { 
      limit = 10, 
      skip = 0, 
      sort = '-publishDate',
      podcastId,
      processingStatus,
      transcriptAvailable,
      search
    } = req.query;
    
    // Build query
    const query = {};
    
    if (podcastId) {
      query.podcastId = podcastId;
    }
    
    if (processingStatus) {
      query.processingStatus = processingStatus;
    }
    
    if (transcriptAvailable !== undefined) {
      query.transcriptAvailable = transcriptAvailable === 'true';
    }
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Execute query
    const episodes = await Episode.find(query)
      .sort(sort)
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .populate('podcastId', 'title feedUrl');
    
    // Get total count
    const total = await Episode.countDocuments(query);
    
    res.status(200).json({
      success: true,
      count: episodes.length,
      total,
      data: episodes
    });
  } catch (error) {
    logger.error(`Error getting episodes: ${error.message}`, { error });
    next(error);
  }
}

/**
 * Get episode by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function getEpisodeById(req, res, next) {
  try {
    const { id } = req.params;
    
    const episode = await Episode.findById(id)
      .populate('podcastId', 'title feedUrl');
    
    if (!episode) {
      return res.status(404).json({
        success: false,
        message: 'Episode not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: episode
    });
  } catch (error) {
    logger.error(`Error getting episode: ${error.message}`, { error });
    next(error);
  }
}

/**
 * Update episode
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function updateEpisode(req, res, next) {
  try {
    const { id } = req.params;
    const { title, description, processingStatus } = req.body;
    
    const episode = await Episode.findById(id);
    
    if (!episode) {
      return res.status(404).json({
        success: false,
        message: 'Episode not found'
      });
    }
    
    // Update fields
    if (title) episode.title = title;
    if (description) episode.description = description;
    if (processingStatus) {
      await episode.updateProcessingStatus(processingStatus);
    } else {
      await episode.save();
    }
    
    res.status(200).json({
      success: true,
      message: 'Episode updated successfully',
      data: episode
    });
  } catch (error) {
    logger.error(`Error updating episode: ${error.message}`, { error });
    next(error);
  }
}

/**
 * Get pending episodes
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function getPendingEpisodes(req, res, next) {
  try {
    const { limit = 10 } = req.query;
    
    const episodes = await Episode.findPendingProcessing(parseInt(limit))
      .populate('podcastId', 'title feedUrl');
    
    res.status(200).json({
      success: true,
      count: episodes.length,
      data: episodes
    });
  } catch (error) {
    logger.error(`Error getting pending episodes: ${error.message}`, { error });
    next(error);
  }
}

/**
 * Get failed episodes
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function getFailedEpisodes(req, res, next) {
  try {
    const { limit = 10 } = req.query;
    
    const episodes = await Episode.findFailedProcessing(parseInt(limit))
      .populate('podcastId', 'title feedUrl');
    
    res.status(200).json({
      success: true,
      count: episodes.length,
      data: episodes
    });
  } catch (error) {
    logger.error(`Error getting failed episodes: ${error.message}`, { error });
    next(error);
  }
}

/**
 * Get episodes without transcripts
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function getEpisodesWithoutTranscripts(req, res, next) {
  try {
    const { limit = 10 } = req.query;
    
    const episodes = await Episode.findWithoutTranscripts(parseInt(limit))
      .populate('podcastId', 'title feedUrl');
    
    res.status(200).json({
      success: true,
      count: episodes.length,
      data: episodes
    });
  } catch (error) {
    logger.error(`Error getting episodes without transcripts: ${error.message}`, { error });
    next(error);
  }
}

/**
 * Get episodes with unprocessed transcripts
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function getEpisodesWithUnprocessedTranscripts(req, res, next) {
  try {
    const { limit = 10 } = req.query;
    
    const episodes = await Episode.findWithUnprocessedTranscripts(parseInt(limit))
      .populate('podcastId', 'title feedUrl');
    
    res.status(200).json({
      success: true,
      count: episodes.length,
      data: episodes
    });
  } catch (error) {
    logger.error(`Error getting episodes with unprocessed transcripts: ${error.message}`, { error });
    next(error);
  }
}

/**
 * Reset episode processing status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function resetProcessingStatus(req, res, next) {
  try {
    const { id } = req.params;
    
    const episode = await Episode.findById(id);
    
    if (!episode) {
      return res.status(404).json({
        success: false,
        message: 'Episode not found'
      });
    }
    
    // Reset processing status
    await episode.updateProcessingStatus('pending', null);
    
    res.status(200).json({
      success: true,
      message: 'Episode processing status reset to pending',
      data: episode
    });
  } catch (error) {
    logger.error(`Error resetting episode processing status: ${error.message}`, { error });
    next(error);
  }
}

/**
 * Get episode transcript
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function getEpisodeTranscript(req, res, next) {
  try {
    const { id } = req.params;
    
    const episode = await Episode.findById(id);
    
    if (!episode) {
      return res.status(404).json({
        success: false,
        message: 'Episode not found'
      });
    }
    
    if (!episode.transcriptAvailable) {
      return res.status(404).json({
        success: false,
        message: 'Transcript not available for this episode'
      });
    }
    
    const transcript = await Transcript.findOne({ episodeId: id });
    
    if (!transcript) {
      return res.status(404).json({
        success: false,
        message: 'Transcript not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: transcript
    });
  } catch (error) {
    logger.error(`Error getting episode transcript: ${error.message}`, { error });
    next(error);
  }
}

module.exports = {
  getAllEpisodes,
  getEpisodeById,
  updateEpisode,
  getPendingEpisodes,
  getFailedEpisodes,
  getEpisodesWithoutTranscripts,
  getEpisodesWithUnprocessedTranscripts,
  resetProcessingStatus,
  getEpisodeTranscript
};