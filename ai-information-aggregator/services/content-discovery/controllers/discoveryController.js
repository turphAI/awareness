const createLogger = require('../../../common/utils/logger');
const scheduler = require('../utils/scheduler');
const contentChecker = require('../utils/contentChecker');
const discoveryQueue = require('../utils/discoveryQueue');
const Source = require('../../source-management/models/Source');
const Content = require('../models/Content');
const Reference = require('../models/Reference');

// Initialize logger
const logger = createLogger('discovery-controller');

/**
 * Initialize content discovery system
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function initializeDiscovery(req, res, next) {
  try {
    // Initialize scheduler queues
    scheduler.initializeQueues();
    
    // Initialize discovery queues
    discoveryQueue.initializeQueues();
    
    // Schedule all sources
    const result = await scheduler.scheduleAllSources();
    
    res.status(200).json({
      success: true,
      message: 'Content discovery system initialized',
      scheduledSources: result.scheduled
    });
  } catch (error) {
    logger.error(`Error initializing discovery system: ${error.message}`, { error });
    next(error);
  }
}

/**
 * Get discovery system status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function getDiscoveryStatus(req, res, next) {
  try {
    // Get queue stats
    const schedulerStats = await scheduler.getQueueStats();
    const discoveryStats = await discoveryQueue.getQueueStats();
    
    // Get source counts
    const [
      totalSources,
      activeSources,
      sourcesWithErrors,
      hourlySources,
      dailySources,
      weeklySources,
      monthlySources
    ] = await Promise.all([
      Source.countDocuments({}),
      Source.countDocuments({ active: true }),
      Source.countDocuments({ errorCount: { $gt: 0 } }),
      Source.countDocuments({ checkFrequency: 'hourly', active: true }),
      Source.countDocuments({ checkFrequency: 'daily', active: true }),
      Source.countDocuments({ checkFrequency: 'weekly', active: true }),
      Source.countDocuments({ checkFrequency: 'monthly', active: true })
    ]);
    
    // Get content counts
    const [
      totalContent,
      processedContent,
      unprocessedContent,
      lastDayContent
    ] = await Promise.all([
      Content.countDocuments({}),
      Content.countDocuments({ processed: true }),
      Content.countDocuments({ processed: false }),
      Content.countDocuments({ 
        discoveryDate: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      })
    ]);
    
    // Get reference counts
    const [
      totalReferences,
      resolvedReferences,
      unresolvedReferences
    ] = await Promise.all([
      Reference.countDocuments({}),
      Reference.countDocuments({ resolved: true }),
      Reference.countDocuments({ resolved: false })
    ]);
    
    res.status(200).json({
      success: true,
      queueStats: {
        scheduler: schedulerStats.stats,
        discovery: discoveryStats.stats
      },
      sources: {
        total: totalSources,
        active: activeSources,
        withErrors: sourcesWithErrors,
        byFrequency: {
          hourly: hourlySources,
          daily: dailySources,
          weekly: weeklySources,
          monthly: monthlySources
        }
      },
      content: {
        total: totalContent,
        processed: processedContent,
        unprocessed: unprocessedContent,
        lastDay: lastDayContent
      },
      references: {
        total: totalReferences,
        resolved: resolvedReferences,
        unresolved: unresolvedReferences
      }
    });
  } catch (error) {
    logger.error(`Error getting discovery status: ${error.message}`, { error });
    next(error);
  }
}

/**
 * Schedule an immediate check for a source
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function scheduleSourceCheck(req, res, next) {
  try {
    const { sourceId } = req.params;
    
    if (!sourceId) {
      return res.status(400).json({
        success: false,
        message: 'Source ID is required'
      });
    }
    
    const result = await scheduler.scheduleImmediateCheck(sourceId);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error
      });
    }
    
    res.status(200).json({
      success: true,
      message: `Check scheduled for source: ${result.sourceName}`,
      jobId: result.jobId,
      sourceId: result.sourceId
    });
  } catch (error) {
    logger.error(`Error scheduling source check: ${error.message}`, { error });
    next(error);
  }
}

/**
 * Check a source immediately (synchronously)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function checkSourceNow(req, res, next) {
  try {
    const { sourceId } = req.params;
    
    if (!sourceId) {
      return res.status(400).json({
        success: false,
        message: 'Source ID is required'
      });
    }
    
    // Get source
    const source = await Source.findById(sourceId);
    
    if (!source) {
      return res.status(404).json({
        success: false,
        message: 'Source not found'
      });
    }
    
    if (!source.active) {
      return res.status(400).json({
        success: false,
        message: 'Source is inactive'
      });
    }
    
    // Check source
    const result = await contentChecker.checkSource(source);
    
    res.status(200).json({
      success: true,
      message: result.message,
      contentFound: result.contentFound,
      newContentCount: result.newContent.length,
      newContent: result.newContent.map(content => ({
        id: content._id,
        title: content.title,
        url: content.url,
        type: content.type,
        publishDate: content.publishDate
      }))
    });
  } catch (error) {
    logger.error(`Error checking source: ${error.message}`, { error });
    next(error);
  }
}

/**
 * Clean up discovery system jobs
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function cleanupDiscoveryJobs(req, res, next) {
  try {
    const result = await scheduler.cleanupJobs();
    
    res.status(200).json({
      success: true,
      message: 'Discovery jobs cleaned up'
    });
  } catch (error) {
    logger.error(`Error cleaning up discovery jobs: ${error.message}`, { error });
    next(error);
  }
}

/**
 * Get sources with errors
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function getSourcesWithErrors(req, res, next) {
  try {
    const { minErrors = 1 } = req.query;
    
    const sources = await Source.findSourcesWithErrors(parseInt(minErrors));
    
    res.status(200).json({
      success: true,
      count: sources.length,
      sources: sources.map(source => ({
        id: source._id,
        name: source.name,
        url: source.url,
        type: source.type,
        errorCount: source.errorCount,
        lastError: source.lastError
      }))
    });
  } catch (error) {
    logger.error(`Error getting sources with errors: ${error.message}`, { error });
    next(error);
  }
}

/**
 * Reset errors for a source
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function resetSourceErrors(req, res, next) {
  try {
    const { sourceId } = req.params;
    
    if (!sourceId) {
      return res.status(400).json({
        success: false,
        message: 'Source ID is required'
      });
    }
    
    // Get source
    const source = await Source.findById(sourceId);
    
    if (!source) {
      return res.status(404).json({
        success: false,
        message: 'Source not found'
      });
    }
    
    // Reset errors
    await source.resetErrors();
    
    res.status(200).json({
      success: true,
      message: `Errors reset for source: ${source.name}`,
      sourceId: source._id
    });
  } catch (error) {
    logger.error(`Error resetting source errors: ${error.message}`, { error });
    next(error);
  }
}

module.exports = {
  initializeDiscovery,
  getDiscoveryStatus,
  scheduleSourceCheck,
  checkSourceNow,
  cleanupDiscoveryJobs,
  getSourcesWithErrors,
  resetSourceErrors,
  processNewContent,
  processUnprocessedContent,
  queueReferenceExtraction,
  queueReferenceResolution,
  queueRelevanceAssessment
};
/**

 * Process new content
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function processNewContent(req, res, next) {
  try {
    const { contentId } = req.params;
    
    if (!contentId) {
      return res.status(400).json({
        success: false,
        message: 'Content ID is required'
      });
    }
    
    // Check if content exists
    const content = await Content.findById(contentId);
    
    if (!content) {
      return res.status(404).json({
        success: false,
        message: 'Content not found'
      });
    }
    
    // Process content
    const result = await discoveryQueue.processNewContent(contentId);
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: `Error processing content: ${result.error}`
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Content queued for processing',
      contentId,
      jobId: result.jobId
    });
  } catch (error) {
    logger.error(`Error processing new content: ${error.message}`, { error });
    next(error);
  }
}

/**
 * Process unprocessed content
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function processUnprocessedContent(req, res, next) {
  try {
    const { limit = 50 } = req.query;
    
    // Process unprocessed content
    const result = await discoveryQueue.processUnprocessedContent(parseInt(limit));
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: `Error processing unprocessed content: ${result.error}`
      });
    }
    
    res.status(200).json({
      success: true,
      message: `Queued ${result.queued} out of ${result.total} unprocessed content items`,
      total: result.total,
      queued: result.queued,
      failed: result.failed
    });
  } catch (error) {
    logger.error(`Error processing unprocessed content: ${error.message}`, { error });
    next(error);
  }
}

/**
 * Queue reference extraction
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function queueReferenceExtraction(req, res, next) {
  try {
    const { contentId } = req.params;
    
    if (!contentId) {
      return res.status(400).json({
        success: false,
        message: 'Content ID is required'
      });
    }
    
    // Check if content exists
    const content = await Content.findById(contentId);
    
    if (!content) {
      return res.status(404).json({
        success: false,
        message: 'Content not found'
      });
    }
    
    // Queue reference extraction
    const result = await discoveryQueue.queueReferenceExtraction(contentId);
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: `Error queuing reference extraction: ${result.error}`
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Reference extraction queued',
      contentId,
      jobId: result.jobId
    });
  } catch (error) {
    logger.error(`Error queuing reference extraction: ${error.message}`, { error });
    next(error);
  }
}

/**
 * Queue reference resolution
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function queueReferenceResolution(req, res, next) {
  try {
    const { limit = 100 } = req.query;
    
    // Queue reference resolution
    const result = await discoveryQueue.queueReferenceResolution(parseInt(limit));
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: `Error queuing reference resolution: ${result.error}`
      });
    }
    
    res.status(200).json({
      success: true,
      message: `Reference resolution queued for up to ${limit} references`,
      limit: parseInt(limit),
      jobId: result.jobId
    });
  } catch (error) {
    logger.error(`Error queuing reference resolution: ${error.message}`, { error });
    next(error);
  }
}

/**
 * Queue relevance assessment
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function queueRelevanceAssessment(req, res, next) {
  try {
    const { contentId } = req.params;
    
    if (!contentId) {
      return res.status(400).json({
        success: false,
        message: 'Content ID is required'
      });
    }
    
    // Check if content exists
    const content = await Content.findById(contentId);
    
    if (!content) {
      return res.status(404).json({
        success: false,
        message: 'Content not found'
      });
    }
    
    // Get assessment options from request body
    const options = req.body || {};
    
    // Queue relevance assessment
    const result = await discoveryQueue.queueRelevanceAssessment(contentId, options);
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: `Error queuing relevance assessment: ${result.error}`
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Relevance assessment queued',
      contentId,
      jobId: result.jobId
    });
  } catch (error) {
    logger.error(`Error queuing relevance assessment: ${error.message}`, { error });
    next(error);
  }
}

/**
 * Clean up discovery jobs
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function cleanupDiscoveryJobs(req, res, next) {
  try {
    // Clean up scheduler jobs
    await scheduler.cleanupJobs();
    
    // Clean up discovery jobs
    await discoveryQueue.cleanupJobs();
    
    res.status(200).json({
      success: true,
      message: 'All discovery jobs cleaned up'
    });
  } catch (error) {
    logger.error(`Error cleaning up discovery jobs: ${error.message}`, { error });
    next(error);
  }
}