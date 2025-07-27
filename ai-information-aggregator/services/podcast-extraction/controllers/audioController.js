const createLogger = require('../../../common/utils/logger');
const Episode = require('../models/Episode');
const audioProcessor = require('../utils/audioProcessor');

// Initialize logger
const logger = createLogger('audio-controller');

/**
 * Process episode audio
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function processEpisodeAudio(req, res, next) {
  try {
    const { episodeId } = req.params;
    
    if (!episodeId) {
      return res.status(400).json({
        success: false,
        message: 'Episode ID is required'
      });
    }
    
    // Queue episode for processing
    const result = await audioProcessor.queueEpisodeProcessing(episodeId);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Episode queued for audio processing',
      jobId: result.jobId,
      episodeId: result.episodeId
    });
  } catch (error) {
    logger.error(`Error processing episode audio: ${error.message}`, { error });
    next(error);
  }
}

/**
 * Process pending episodes
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function processPendingEpisodes(req, res, next) {
  try {
    const { limit = 10 } = req.query;
    
    // Process pending episodes
    const result = await audioProcessor.processPendingEpisodes(parseInt(limit));
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: `Error processing pending episodes: ${result.error}`
      });
    }
    
    res.status(200).json({
      success: true,
      message: `Queued ${result.queued} out of ${result.total} pending episodes`,
      total: result.total,
      queued: result.queued,
      failed: result.failed
    });
  } catch (error) {
    logger.error(`Error processing pending episodes: ${error.message}`, { error });
    next(error);
  }
}

/**
 * Get audio processing status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function getProcessingStatus(req, res, next) {
  try {
    // Get queue stats
    const stats = await audioProcessor.getQueueStats();
    
    // Get episode counts
    const [
      totalEpisodes,
      processedEpisodes,
      pendingEpisodes,
      failedEpisodes,
      withTranscripts
    ] = await Promise.all([
      Episode.countDocuments({}),
      Episode.countDocuments({ audioProcessed: true }),
      Episode.countDocuments({ processingStatus: 'pending' }),
      Episode.countDocuments({ processingStatus: 'failed' }),
      Episode.countDocuments({ transcriptAvailable: true })
    ]);
    
    res.status(200).json({
      success: true,
      queueStats: stats.stats,
      episodes: {
        total: totalEpisodes,
        processed: processedEpisodes,
        pending: pendingEpisodes,
        failed: failedEpisodes,
        withTranscripts
      }
    });
  } catch (error) {
    logger.error(`Error getting processing status: ${error.message}`, { error });
    next(error);
  }
}

/**
 * Clean up processing jobs
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function cleanupProcessingJobs(req, res, next) {
  try {
    const result = await audioProcessor.cleanupJobs();
    
    res.status(200).json({
      success: true,
      message: 'Processing jobs cleaned up'
    });
  } catch (error) {
    logger.error(`Error cleaning up processing jobs: ${error.message}`, { error });
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
    const { episodeId } = req.params;
    
    if (!episodeId) {
      return res.status(400).json({
        success: false,
        message: 'Episode ID is required'
      });
    }
    
    // Get episode
    const episode = await Episode.findById(episodeId);
    
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
      episodeId
    });
  } catch (error) {
    logger.error(`Error resetting episode processing status: ${error.message}`, { error });
    next(error);
  }
}

module.exports = {
  processEpisodeAudio,
  processPendingEpisodes,
  getProcessingStatus,
  cleanupProcessingJobs,
  resetProcessingStatus
};