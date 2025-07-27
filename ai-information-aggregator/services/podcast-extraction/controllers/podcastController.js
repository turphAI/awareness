const createLogger = require('../../../common/utils/logger');
const Podcast = require('../models/Podcast');
const Episode = require('../models/Episode');
const Source = require('../../source-management/models/Source');
const podcastMonitor = require('../utils/podcastMonitor');

// Initialize logger
const logger = createLogger('podcast-controller');

/**
 * Get all podcasts
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function getAllPodcasts(req, res, next) {
  try {
    const { limit = 10, skip = 0, sort = 'title', category } = req.query;
    
    // Build query
    const query = { active: true };
    
    if (category) {
      query.categories = category;
    }
    
    // Execute query
    const podcasts = await Podcast.find(query)
      .sort(sort)
      .skip(parseInt(skip))
      .limit(parseInt(limit));
    
    // Get total count
    const total = await Podcast.countDocuments(query);
    
    res.status(200).json({
      success: true,
      count: podcasts.length,
      total,
      data: podcasts
    });
  } catch (error) {
    logger.error(`Error getting podcasts: ${error.message}`, { error });
    next(error);
  }
}

/**
 * Get podcast by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function getPodcastById(req, res, next) {
  try {
    const { id } = req.params;
    
    const podcast = await Podcast.findById(id);
    
    if (!podcast) {
      return res.status(404).json({
        success: false,
        message: 'Podcast not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: podcast
    });
  } catch (error) {
    logger.error(`Error getting podcast: ${error.message}`, { error });
    next(error);
  }
}

/**
 * Create new podcast
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function createPodcast(req, res, next) {
  try {
    const { sourceId, feedUrl, title, description, categories, checkFrequency } = req.body;
    
    // Check if source exists
    if (sourceId) {
      const source = await Source.findById(sourceId);
      
      if (!source) {
        return res.status(404).json({
          success: false,
          message: 'Source not found'
        });
      }
    }
    
    // Check if podcast with this feed URL already exists
    const existingPodcast = await Podcast.findOne({ feedUrl });
    
    if (existingPodcast) {
      return res.status(400).json({
        success: false,
        message: 'Podcast with this feed URL already exists'
      });
    }
    
    // Create new podcast
    const podcast = new Podcast({
      sourceId,
      feedUrl,
      title,
      description,
      categories: categories || [],
      checkFrequency: checkFrequency || 'daily'
    });
    
    await podcast.save();
    
    // Schedule podcast for checking
    await podcastMonitor.schedulePodcastCheck(podcast);
    
    res.status(201).json({
      success: true,
      message: 'Podcast created successfully',
      data: podcast
    });
  } catch (error) {
    logger.error(`Error creating podcast: ${error.message}`, { error });
    next(error);
  }
}

/**
 * Update podcast
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function updatePodcast(req, res, next) {
  try {
    const { id } = req.params;
    const { title, description, categories, checkFrequency, active } = req.body;
    
    const podcast = await Podcast.findById(id);
    
    if (!podcast) {
      return res.status(404).json({
        success: false,
        message: 'Podcast not found'
      });
    }
    
    // Update fields
    if (title) podcast.title = title;
    if (description) podcast.description = description;
    if (categories) podcast.categories = categories;
    if (checkFrequency) podcast.checkFrequency = checkFrequency;
    if (active !== undefined) podcast.active = active;
    
    await podcast.save();
    
    // If check frequency changed, reschedule podcast
    if (checkFrequency && checkFrequency !== podcast.checkFrequency) {
      await podcastMonitor.schedulePodcastCheck(podcast);
    }
    
    res.status(200).json({
      success: true,
      message: 'Podcast updated successfully',
      data: podcast
    });
  } catch (error) {
    logger.error(`Error updating podcast: ${error.message}`, { error });
    next(error);
  }
}

/**
 * Delete podcast
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function deletePodcast(req, res, next) {
  try {
    const { id } = req.params;
    
    const podcast = await Podcast.findById(id);
    
    if (!podcast) {
      return res.status(404).json({
        success: false,
        message: 'Podcast not found'
      });
    }
    
    // Instead of deleting, mark as inactive
    podcast.active = false;
    await podcast.save();
    
    res.status(200).json({
      success: true,
      message: 'Podcast marked as inactive'
    });
  } catch (error) {
    logger.error(`Error deleting podcast: ${error.message}`, { error });
    next(error);
  }
}

/**
 * Get episodes for podcast
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function getPodcastEpisodes(req, res, next) {
  try {
    const { id } = req.params;
    const { limit = 10, skip = 0, sort = '-publishDate' } = req.query;
    
    const podcast = await Podcast.findById(id);
    
    if (!podcast) {
      return res.status(404).json({
        success: false,
        message: 'Podcast not found'
      });
    }
    
    // Get episodes
    const episodes = await Episode.findByPodcast(id, {
      limit: parseInt(limit),
      skip: parseInt(skip),
      sort
    });
    
    // Get total count
    const total = await Episode.countDocuments({ podcastId: id });
    
    res.status(200).json({
      success: true,
      count: episodes.length,
      total,
      data: episodes
    });
  } catch (error) {
    logger.error(`Error getting podcast episodes: ${error.message}`, { error });
    next(error);
  }
}

/**
 * Check podcast feed for new episodes
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function checkPodcastFeed(req, res, next) {
  try {
    const { id } = req.params;
    
    const podcast = await Podcast.findById(id);
    
    if (!podcast) {
      return res.status(404).json({
        success: false,
        message: 'Podcast not found'
      });
    }
    
    // Check feed
    const result = await podcastMonitor.checkPodcastFeed(podcast);
    
    res.status(200).json({
      success: true,
      message: result.message,
      newEpisodesCount: result.newEpisodes.length,
      newEpisodes: result.newEpisodes.map(episode => ({
        id: episode._id,
        title: episode.title,
        publishDate: episode.publishDate
      }))
    });
  } catch (error) {
    logger.error(`Error checking podcast feed: ${error.message}`, { error });
    next(error);
  }
}

/**
 * Schedule immediate check for podcast
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function scheduleImmediateCheck(req, res, next) {
  try {
    const { id } = req.params;
    
    const result = await podcastMonitor.scheduleImmediateCheck(id);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error
      });
    }
    
    res.status(200).json({
      success: true,
      message: `Check scheduled for podcast: ${result.podcastTitle}`,
      jobId: result.jobId,
      podcastId: result.podcastId
    });
  } catch (error) {
    logger.error(`Error scheduling podcast check: ${error.message}`, { error });
    next(error);
  }
}

/**
 * Get podcast monitoring status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function getMonitoringStatus(req, res, next) {
  try {
    // Get queue stats
    const stats = await podcastMonitor.getQueueStats();
    
    // Get podcast counts
    const [
      totalPodcasts,
      activePodcasts,
      podcastsWithErrors,
      hourlyPodcasts,
      dailyPodcasts,
      weeklyPodcasts
    ] = await Promise.all([
      Podcast.countDocuments({}),
      Podcast.countDocuments({ active: true }),
      Podcast.countDocuments({ errorCount: { $gt: 0 } }),
      Podcast.countDocuments({ checkFrequency: 'hourly', active: true }),
      Podcast.countDocuments({ checkFrequency: 'daily', active: true }),
      Podcast.countDocuments({ checkFrequency: 'weekly', active: true })
    ]);
    
    // Get episode counts
    const [
      totalEpisodes,
      processedEpisodes,
      pendingEpisodes,
      failedEpisodes
    ] = await Promise.all([
      Episode.countDocuments({}),
      Episode.countDocuments({ processingStatus: 'completed' }),
      Episode.countDocuments({ processingStatus: 'pending' }),
      Episode.countDocuments({ processingStatus: 'failed' })
    ]);
    
    res.status(200).json({
      success: true,
      queueStats: stats.stats,
      podcasts: {
        total: totalPodcasts,
        active: activePodcasts,
        withErrors: podcastsWithErrors,
        byFrequency: {
          hourly: hourlyPodcasts,
          daily: dailyPodcasts,
          weekly: weeklyPodcasts
        }
      },
      episodes: {
        total: totalEpisodes,
        processed: processedEpisodes,
        pending: pendingEpisodes,
        failed: failedEpisodes
      }
    });
  } catch (error) {
    logger.error(`Error getting monitoring status: ${error.message}`, { error });
    next(error);
  }
}

/**
 * Clean up monitoring jobs
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function cleanupMonitoringJobs(req, res, next) {
  try {
    const result = await podcastMonitor.cleanupJobs();
    
    res.status(200).json({
      success: true,
      message: 'Monitoring jobs cleaned up'
    });
  } catch (error) {
    logger.error(`Error cleaning up monitoring jobs: ${error.message}`, { error });
    next(error);
  }
}

/**
 * Get podcasts with errors
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function getPodcastsWithErrors(req, res, next) {
  try {
    const { minErrors = 1 } = req.query;
    
    const podcasts = await Podcast.findPodcastsWithErrors(parseInt(minErrors));
    
    res.status(200).json({
      success: true,
      count: podcasts.length,
      podcasts: podcasts.map(podcast => ({
        id: podcast._id,
        title: podcast.title,
        feedUrl: podcast.feedUrl,
        errorCount: podcast.errorCount,
        lastError: podcast.lastError
      }))
    });
  } catch (error) {
    logger.error(`Error getting podcasts with errors: ${error.message}`, { error });
    next(error);
  }
}

/**
 * Reset errors for a podcast
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function resetPodcastErrors(req, res, next) {
  try {
    const { id } = req.params;
    
    const podcast = await Podcast.findById(id);
    
    if (!podcast) {
      return res.status(404).json({
        success: false,
        message: 'Podcast not found'
      });
    }
    
    // Reset errors
    await podcast.resetErrors();
    
    res.status(200).json({
      success: true,
      message: `Errors reset for podcast: ${podcast.title}`,
      podcastId: podcast._id
    });
  } catch (error) {
    logger.error(`Error resetting podcast errors: ${error.message}`, { error });
    next(error);
  }
}

module.exports = {
  getAllPodcasts,
  getPodcastById,
  createPodcast,
  updatePodcast,
  deletePodcast,
  getPodcastEpisodes,
  checkPodcastFeed,
  scheduleImmediateCheck,
  getMonitoringStatus,
  cleanupMonitoringJobs,
  getPodcastsWithErrors,
  resetPodcastErrors
};