const Bull = require('bull');
const createLogger = require('../../../common/utils/logger');
const Source = require('../../source-management/models/Source');
const contentChecker = require('./contentChecker');

// Initialize logger
const logger = createLogger('content-discovery-scheduler');

// Create Redis connection options
const redisOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined
};

// Create queues for different check frequencies
const hourlyQueue = new Bull('hourly-content-check', { redis: redisOptions });
const dailyQueue = new Bull('daily-content-check', { redis: redisOptions });
const weeklyQueue = new Bull('weekly-content-check', { redis: redisOptions });
const monthlyQueue = new Bull('monthly-content-check', { redis: redisOptions });

/**
 * Initialize all content checking queues
 */
function initializeQueues() {
  // Process hourly queue
  hourlyQueue.process(async (job) => {
    logger.info(`Processing hourly check for source: ${job.data.sourceId}`);
    return processSourceCheck(job.data.sourceId);
  });

  // Process daily queue
  dailyQueue.process(async (job) => {
    logger.info(`Processing daily check for source: ${job.data.sourceId}`);
    return processSourceCheck(job.data.sourceId);
  });

  // Process weekly queue
  weeklyQueue.process(async (job) => {
    logger.info(`Processing weekly check for source: ${job.data.sourceId}`);
    return processSourceCheck(job.data.sourceId);
  });

  // Process monthly queue
  monthlyQueue.process(async (job) => {
    logger.info(`Processing monthly check for source: ${job.data.sourceId}`);
    return processSourceCheck(job.data.sourceId);
  });

  // Set up error handlers for all queues
  [hourlyQueue, dailyQueue, weeklyQueue, monthlyQueue].forEach(queue => {
    queue.on('error', (error) => {
      logger.error(`Queue error: ${error.message}`, { error });
    });

    queue.on('failed', (job, error) => {
      logger.error(`Job ${job.id} failed: ${error.message}`, { 
        jobId: job.id, 
        sourceId: job.data.sourceId,
        error 
      });
    });

    queue.on('completed', (job, result) => {
      logger.info(`Job ${job.id} completed`, { 
        jobId: job.id, 
        sourceId: job.data.sourceId,
        contentFound: result.contentFound 
      });
    });
  });

  logger.info('All content checking queues initialized');
}

/**
 * Process a source check job
 * @param {string} sourceId - ID of the source to check
 * @returns {Promise<Object>} - Result of the check
 */
async function processSourceCheck(sourceId) {
  try {
    // Get source from database
    const source = await Source.findById(sourceId);
    
    if (!source) {
      logger.warn(`Source not found: ${sourceId}`);
      return { success: false, error: 'Source not found' };
    }

    if (!source.active) {
      logger.info(`Skipping inactive source: ${sourceId}`);
      return { success: true, contentFound: false, message: 'Source is inactive' };
    }

    // Record that we checked this source
    await source.recordCheck();

    // Check for new content
    const result = await contentChecker.checkSource(source);
    
    // Return the result
    return {
      success: true,
      contentFound: result.contentFound,
      newContent: result.newContent,
      message: result.message
    };
  } catch (error) {
    logger.error(`Error checking source ${sourceId}: ${error.message}`, { error });
    
    // Try to record the error on the source
    try {
      const source = await Source.findById(sourceId);
      if (source) {
        await source.recordError(error.message);
      }
    } catch (recordError) {
      logger.error(`Failed to record error for source ${sourceId}: ${recordError.message}`);
    }
    
    return { 
      success: false, 
      error: error.message 
    };
  }
}

/**
 * Schedule content checks for all sources
 * @returns {Promise<Object>} - Result of scheduling
 */
async function scheduleAllSources() {
  try {
    logger.info('Scheduling content checks for all sources');
    
    // Clear existing jobs
    await Promise.all([
      hourlyQueue.empty(),
      dailyQueue.empty(),
      weeklyQueue.empty(),
      monthlyQueue.empty()
    ]);
    
    // Schedule hourly checks
    const hourlySources = await Source.findSourcesForChecking('hourly');
    for (const source of hourlySources) {
      await hourlyQueue.add(
        { sourceId: source._id.toString() },
        { 
          repeat: { cron: '0 * * * *' }, // Every hour
          removeOnComplete: true,
          removeOnFail: false
        }
      );
    }
    logger.info(`Scheduled ${hourlySources.length} hourly sources`);
    
    // Schedule daily checks
    const dailySources = await Source.findSourcesForChecking('daily');
    for (const source of dailySources) {
      await dailyQueue.add(
        { sourceId: source._id.toString() },
        { 
          repeat: { cron: '0 0 * * *' }, // Every day at midnight
          removeOnComplete: true,
          removeOnFail: false
        }
      );
    }
    logger.info(`Scheduled ${dailySources.length} daily sources`);
    
    // Schedule weekly checks
    const weeklySources = await Source.findSourcesForChecking('weekly');
    for (const source of weeklySources) {
      await weeklyQueue.add(
        { sourceId: source._id.toString() },
        { 
          repeat: { cron: '0 0 * * 0' }, // Every Sunday at midnight
          removeOnComplete: true,
          removeOnFail: false
        }
      );
    }
    logger.info(`Scheduled ${weeklySources.length} weekly sources`);
    
    // Schedule monthly checks
    const monthlySources = await Source.findSourcesForChecking('monthly');
    for (const source of monthlySources) {
      await monthlyQueue.add(
        { sourceId: source._id.toString() },
        { 
          repeat: { cron: '0 0 1 * *' }, // 1st of each month at midnight
          removeOnComplete: true,
          removeOnFail: false
        }
      );
    }
    logger.info(`Scheduled ${monthlySources.length} monthly sources`);
    
    return {
      success: true,
      scheduled: {
        hourly: hourlySources.length,
        daily: dailySources.length,
        weekly: weeklySources.length,
        monthly: monthlySources.length,
        total: hourlySources.length + dailySources.length + weeklySources.length + monthlySources.length
      }
    };
  } catch (error) {
    logger.error(`Error scheduling sources: ${error.message}`, { error });
    return { 
      success: false, 
      error: error.message 
    };
  }
}

/**
 * Schedule an immediate check for a specific source
 * @param {string} sourceId - ID of the source to check
 * @returns {Promise<Object>} - Result of scheduling
 */
async function scheduleImmediateCheck(sourceId) {
  try {
    const source = await Source.findById(sourceId);
    
    if (!source) {
      return { success: false, error: 'Source not found' };
    }
    
    if (!source.active) {
      return { success: false, error: 'Source is inactive' };
    }
    
    // Add to appropriate queue based on source frequency
    let queue;
    switch (source.checkFrequency) {
      case 'hourly':
        queue = hourlyQueue;
        break;
      case 'daily':
        queue = dailyQueue;
        break;
      case 'weekly':
        queue = weeklyQueue;
        break;
      case 'monthly':
        queue = monthlyQueue;
        break;
      default:
        queue = dailyQueue;
    }
    
    const job = await queue.add(
      { sourceId: source._id.toString() },
      { 
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000
        }
      }
    );
    
    logger.info(`Scheduled immediate check for source ${sourceId}, job ID: ${job.id}`);
    
    return {
      success: true,
      jobId: job.id,
      sourceId: source._id.toString(),
      sourceName: source.name
    };
  } catch (error) {
    logger.error(`Error scheduling immediate check for source ${sourceId}: ${error.message}`, { error });
    return { 
      success: false, 
      error: error.message 
    };
  }
}

/**
 * Get queue statistics
 * @returns {Promise<Object>} - Queue statistics
 */
async function getQueueStats() {
  try {
    const [hourlyStats, dailyStats, weeklyStats, monthlyStats] = await Promise.all([
      getQueueStatistics(hourlyQueue),
      getQueueStatistics(dailyQueue),
      getQueueStatistics(weeklyQueue),
      getQueueStatistics(monthlyQueue)
    ]);
    
    return {
      success: true,
      stats: {
        hourly: hourlyStats,
        daily: dailyStats,
        weekly: weeklyStats,
        monthly: monthlyStats,
        total: {
          waiting: hourlyStats.waiting + dailyStats.waiting + weeklyStats.waiting + monthlyStats.waiting,
          active: hourlyStats.active + dailyStats.active + weeklyStats.active + monthlyStats.active,
          completed: hourlyStats.completed + dailyStats.completed + weeklyStats.completed + monthlyStats.completed,
          failed: hourlyStats.failed + dailyStats.failed + weeklyStats.failed + monthlyStats.failed,
          delayed: hourlyStats.delayed + dailyStats.delayed + weeklyStats.delayed + monthlyStats.delayed
        }
      }
    };
  } catch (error) {
    logger.error(`Error getting queue stats: ${error.message}`, { error });
    return { 
      success: false, 
      error: error.message 
    };
  }
}

/**
 * Get statistics for a specific queue
 * @param {Bull.Queue} queue - Bull queue
 * @returns {Promise<Object>} - Queue statistics
 */
async function getQueueStatistics(queue) {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount()
  ]);
  
  return {
    waiting,
    active,
    completed,
    failed,
    delayed
  };
}

/**
 * Clean up completed and failed jobs
 * @returns {Promise<Object>} - Result of cleanup
 */
async function cleanupJobs() {
  try {
    const results = await Promise.all([
      hourlyQueue.clean(24 * 60 * 60 * 1000, 'completed'), // 1 day
      dailyQueue.clean(7 * 24 * 60 * 60 * 1000, 'completed'), // 7 days
      weeklyQueue.clean(30 * 24 * 60 * 60 * 1000, 'completed'), // 30 days
      monthlyQueue.clean(90 * 24 * 60 * 60 * 1000, 'completed'), // 90 days
      hourlyQueue.clean(7 * 24 * 60 * 60 * 1000, 'failed'), // 7 days
      dailyQueue.clean(14 * 24 * 60 * 60 * 1000, 'failed'), // 14 days
      weeklyQueue.clean(30 * 24 * 60 * 60 * 1000, 'failed'), // 30 days
      monthlyQueue.clean(90 * 24 * 60 * 60 * 1000, 'failed') // 90 days
    ]);
    
    logger.info('Cleaned up completed and failed jobs');
    
    return {
      success: true,
      message: 'Cleaned up completed and failed jobs'
    };
  } catch (error) {
    logger.error(`Error cleaning up jobs: ${error.message}`, { error });
    return { 
      success: false, 
      error: error.message 
    };
  }
}

/**
 * Shutdown all queues gracefully
 * @returns {Promise<void>}
 */
async function shutdown() {
  logger.info('Shutting down content checking queues');
  
  await Promise.all([
    hourlyQueue.close(),
    dailyQueue.close(),
    weeklyQueue.close(),
    monthlyQueue.close()
  ]);
  
  logger.info('All content checking queues shut down');
}

module.exports = {
  initializeQueues,
  scheduleAllSources,
  scheduleImmediateCheck,
  getQueueStats,
  cleanupJobs,
  shutdown
};