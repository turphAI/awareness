const Bull = require('bull');
const RssParser = require('rss-parser');
const createLogger = require('../../../common/utils/logger');
const Podcast = require('../models/Podcast');
const Episode = require('../models/Episode');
const Source = require('../../source-management/models/Source');

// Initialize logger
const logger = createLogger('podcast-monitor');

// Initialize RSS parser with custom fields
const rssParser = new RssParser({
  customFields: {
    feed: [
      ['itunes:author', 'itunesAuthor'],
      ['itunes:category', 'itunesCategory'],
      ['itunes:explicit', 'itunesExplicit'],
      ['itunes:image', 'itunesImage'],
      ['itunes:owner', 'itunesOwner'],
      ['itunes:subtitle', 'itunesSubtitle'],
      ['itunes:summary', 'itunesSummary']
    ],
    item: [
      ['itunes:author', 'itunesAuthor'],
      ['itunes:duration', 'itunesDuration'],
      ['itunes:episode', 'itunesEpisode'],
      ['itunes:episodeType', 'itunesEpisodeType'],
      ['itunes:explicit', 'itunesExplicit'],
      ['itunes:image', 'itunesImage'],
      ['itunes:season', 'itunesSeason'],
      ['itunes:subtitle', 'itunesSubtitle'],
      ['itunes:summary', 'itunesSummary'],
      ['enclosure', 'enclosure'],
      ['content:encoded', 'contentEncoded']
    ]
  }
});

// Create Redis connection options
const redisOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined
};

// Create queues for different check frequencies
const hourlyQueue = new Bull('hourly-podcast-check', { redis: redisOptions });
const dailyQueue = new Bull('daily-podcast-check', { redis: redisOptions });
const weeklyQueue = new Bull('weekly-podcast-check', { redis: redisOptions });

/**
 * Initialize podcast monitoring system
 */
function initialize() {
  // Process hourly queue
  hourlyQueue.process(async (job) => {
    logger.info(`Processing hourly check for podcast: ${job.data.podcastId}`);
    return processPodcastCheck(job.data.podcastId);
  });

  // Process daily queue
  dailyQueue.process(async (job) => {
    logger.info(`Processing daily check for podcast: ${job.data.podcastId}`);
    return processPodcastCheck(job.data.podcastId);
  });

  // Process weekly queue
  weeklyQueue.process(async (job) => {
    logger.info(`Processing weekly check for podcast: ${job.data.podcastId}`);
    return processPodcastCheck(job.data.podcastId);
  });

  // Set up error handlers for all queues
  [hourlyQueue, dailyQueue, weeklyQueue].forEach(queue => {
    queue.on('error', (error) => {
      logger.error(`Queue error: ${error.message}`, { error });
    });

    queue.on('failed', (job, error) => {
      logger.error(`Job ${job.id} failed: ${error.message}`, { 
        jobId: job.id, 
        podcastId: job.data.podcastId,
        error 
      });
    });

    queue.on('completed', (job, result) => {
      logger.info(`Job ${job.id} completed`, { 
        jobId: job.id, 
        podcastId: job.data.podcastId,
        episodesFound: result.episodesFound 
      });
    });
  });

  logger.info('All podcast monitoring queues initialized');
}

/**
 * Process a podcast check job
 * @param {string} podcastId - ID of the podcast to check
 * @returns {Promise<Object>} - Result of the check
 */
async function processPodcastCheck(podcastId) {
  try {
    // Get podcast from database
    const podcast = await Podcast.findById(podcastId);
    
    if (!podcast) {
      logger.warn(`Podcast not found: ${podcastId}`);
      return { success: false, error: 'Podcast not found' };
    }

    if (!podcast.active) {
      logger.info(`Skipping inactive podcast: ${podcastId}`);
      return { success: true, episodesFound: 0, message: 'Podcast is inactive' };
    }

    // Record that we checked this podcast
    await podcast.recordCheck();

    // Check for new episodes
    const result = await checkPodcastFeed(podcast);
    
    // Return the result
    return {
      success: true,
      episodesFound: result.newEpisodes.length,
      newEpisodes: result.newEpisodes,
      message: result.message
    };
  } catch (error) {
    logger.error(`Error checking podcast ${podcastId}: ${error.message}`, { error });
    
    // Try to record the error on the podcast
    try {
      const podcast = await Podcast.findById(podcastId);
      if (podcast) {
        await podcast.recordError(error.message);
      }
    } catch (recordError) {
      logger.error(`Failed to record error for podcast ${podcastId}: ${recordError.message}`);
    }
    
    return { 
      success: false, 
      error: error.message 
    };
  }
}

/**
 * Check podcast feed for new episodes
 * @param {Object} podcast - Podcast document
 * @returns {Promise<Object>} - Result of the check
 */
async function checkPodcastFeed(podcast) {
  try {
    logger.info(`Checking podcast feed: ${podcast.feedUrl}`);
    
    // Fetch RSS feed
    const feed = await rssParser.parseURL(podcast.feedUrl);
    
    // Process feed items
    const newEpisodes = [];
    
    for (const item of feed.items) {
      // Check if episode already exists
      const existingEpisode = await Episode.findOne({
        podcastId: podcast._id,
        guid: item.guid || item.id || item.link
      });
      
      if (!existingEpisode) {
        // Extract audio URL from enclosure
        let audioUrl = null;
        if (item.enclosure && item.enclosure.url) {
          audioUrl = item.enclosure.url;
        }
        
        // Skip if no audio URL
        if (!audioUrl) {
          logger.warn(`Skipping episode without audio URL: ${item.title}`);
          continue;
        }
        
        // Parse duration
        let duration = 0;
        if (item.itunesDuration) {
          duration = parseDuration(item.itunesDuration);
        }
        
        // Create new episode
        const episode = new Episode({
          podcastId: podcast._id,
          title: item.title,
          description: item.contentEncoded || item.content || item.description || '',
          guid: item.guid || item.id || item.link,
          url: item.link,
          audioUrl: audioUrl,
          imageUrl: item.itunesImage ? item.itunesImage.href : (feed.itunesImage ? feed.itunesImage.href : null),
          publishDate: item.pubDate ? new Date(item.pubDate) : new Date(),
          duration: duration,
          episodeNumber: item.itunesEpisode ? parseInt(item.itunesEpisode) : null,
          season: item.itunesSeason ? parseInt(item.itunesSeason) : null,
          explicit: item.itunesExplicit === 'yes',
          showNotes: item.contentEncoded || item.content || item.description || ''
        });
        
        // Save episode
        await episode.save();
        
        // Add to new episodes array
        newEpisodes.push(episode);
        
        logger.info(`Created new episode: ${episode.title} (${episode._id})`);
      }
    }
    
    // Update podcast if new episodes were found
    if (newEpisodes.length > 0) {
      await podcast.recordUpdate();
      logger.info(`Found ${newEpisodes.length} new episodes for podcast ${podcast._id}`);
      
      return {
        newEpisodes,
        message: `Found ${newEpisodes.length} new episodes`
      };
    } else {
      logger.info(`No new episodes found for podcast ${podcast._id}`);
      return {
        newEpisodes: [],
        message: 'No new episodes found'
      };
    }
  } catch (error) {
    logger.error(`Error checking podcast feed ${podcast.feedUrl}: ${error.message}`, { error });
    
    // Record error on podcast
    await podcast.recordError(error.message);
    
    throw error;
  }
}

/**
 * Parse duration string to seconds
 * @param {string} durationStr - Duration string (e.g., "1:30:45" or "5400")
 * @returns {number} - Duration in seconds
 */
function parseDuration(durationStr) {
  if (!durationStr) return 0;
  
  // If duration is just a number, assume it's seconds
  if (/^\d+$/.test(durationStr)) {
    return parseInt(durationStr);
  }
  
  // Parse HH:MM:SS or MM:SS format
  const parts = durationStr.split(':').map(part => parseInt(part));
  
  if (parts.length === 3) {
    // HH:MM:SS
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    // MM:SS
    return parts[0] * 60 + parts[1];
  }
  
  return 0;
}

/**
 * Start monitoring podcasts
 * @returns {Promise<Object>} - Result of starting monitoring
 */
async function startMonitoring() {
  try {
    logger.info('Starting podcast monitoring');
    
    // Clear existing jobs
    await Promise.all([
      hourlyQueue.empty(),
      dailyQueue.empty(),
      weeklyQueue.empty()
    ]);
    
    // Find all podcast sources
    const podcastSources = await Source.find({
      type: 'podcast',
      active: true
    });
    
    logger.info(`Found ${podcastSources.length} podcast sources`);
    
    // Process each podcast source
    let podcastCount = 0;
    
    for (const source of podcastSources) {
      // Check if podcast already exists for this source
      let podcast = await Podcast.findOne({ sourceId: source._id });
      
      if (!podcast) {
        // Create new podcast
        podcast = new Podcast({
          sourceId: source._id,
          title: source.name,
          description: source.description,
          feedUrl: source.rssUrl || source.url,
          websiteUrl: source.url,
          categories: source.categories,
          checkFrequency: source.checkFrequency,
          active: source.active
        });
        
        await podcast.save();
        logger.info(`Created new podcast for source ${source._id}: ${podcast._id}`);
      }
      
      // Schedule podcast for checking
      await schedulePodcastCheck(podcast);
      podcastCount++;
    }
    
    return {
      success: true,
      podcastCount
    };
  } catch (error) {
    logger.error(`Error starting podcast monitoring: ${error.message}`, { error });
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Schedule podcast for checking
 * @param {Object} podcast - Podcast document
 * @returns {Promise<Object>} - Result of scheduling
 */
async function schedulePodcastCheck(podcast) {
  try {
    // Determine which queue to use
    let queue;
    let cronPattern;
    
    switch (podcast.checkFrequency) {
      case 'hourly':
        queue = hourlyQueue;
        cronPattern = '0 * * * *'; // Every hour
        break;
      case 'weekly':
        queue = weeklyQueue;
        cronPattern = '0 0 * * 0'; // Every Sunday at midnight
        break;
      case 'daily':
      default:
        queue = dailyQueue;
        cronPattern = '0 0 * * *'; // Every day at midnight
    }
    
    // Add to queue
    await queue.add(
      { podcastId: podcast._id.toString() },
      { 
        repeat: { cron: cronPattern },
        removeOnComplete: true,
        removeOnFail: false
      }
    );
    
    logger.info(`Scheduled podcast ${podcast._id} for ${podcast.checkFrequency} checking`);
    
    return {
      success: true,
      podcastId: podcast._id.toString()
    };
  } catch (error) {
    logger.error(`Error scheduling podcast ${podcast._id}: ${error.message}`, { error });
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Schedule immediate check for a podcast
 * @param {string} podcastId - ID of the podcast to check
 * @returns {Promise<Object>} - Result of scheduling
 */
async function scheduleImmediateCheck(podcastId) {
  try {
    const podcast = await Podcast.findById(podcastId);
    
    if (!podcast) {
      return { success: false, error: 'Podcast not found' };
    }
    
    if (!podcast.active) {
      return { success: false, error: 'Podcast is inactive' };
    }
    
    // Add to appropriate queue based on podcast frequency
    let queue;
    switch (podcast.checkFrequency) {
      case 'hourly':
        queue = hourlyQueue;
        break;
      case 'weekly':
        queue = weeklyQueue;
        break;
      case 'daily':
      default:
        queue = dailyQueue;
    }
    
    const job = await queue.add(
      { podcastId: podcast._id.toString() },
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
    
    logger.info(`Scheduled immediate check for podcast ${podcastId}, job ID: ${job.id}`);
    
    return {
      success: true,
      jobId: job.id,
      podcastId: podcast._id.toString(),
      podcastTitle: podcast.title
    };
  } catch (error) {
    logger.error(`Error scheduling immediate check for podcast ${podcastId}: ${error.message}`, { error });
    
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
    const [hourlyStats, dailyStats, weeklyStats] = await Promise.all([
      getQueueStatistics(hourlyQueue),
      getQueueStatistics(dailyQueue),
      getQueueStatistics(weeklyQueue)
    ]);
    
    return {
      success: true,
      stats: {
        hourly: hourlyStats,
        daily: dailyStats,
        weekly: weeklyStats,
        total: {
          waiting: hourlyStats.waiting + dailyStats.waiting + weeklyStats.waiting,
          active: hourlyStats.active + dailyStats.active + weeklyStats.active,
          completed: hourlyStats.completed + dailyStats.completed + weeklyStats.completed,
          failed: hourlyStats.failed + dailyStats.failed + weeklyStats.failed,
          delayed: hourlyStats.delayed + dailyStats.delayed + weeklyStats.delayed
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
    await Promise.all([
      hourlyQueue.clean(24 * 60 * 60 * 1000, 'completed'), // 1 day
      dailyQueue.clean(7 * 24 * 60 * 60 * 1000, 'completed'), // 7 days
      weeklyQueue.clean(30 * 24 * 60 * 60 * 1000, 'completed'), // 30 days
      hourlyQueue.clean(7 * 24 * 60 * 60 * 1000, 'failed'), // 7 days
      dailyQueue.clean(14 * 24 * 60 * 60 * 1000, 'failed'), // 14 days
      weeklyQueue.clean(30 * 24 * 60 * 60 * 1000, 'failed') // 30 days
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
  logger.info('Shutting down podcast monitoring queues');
  
  await Promise.all([
    hourlyQueue.close(),
    dailyQueue.close(),
    weeklyQueue.close()
  ]);
  
  logger.info('All podcast monitoring queues shut down');
}

module.exports = {
  initialize,
  startMonitoring,
  schedulePodcastCheck,
  scheduleImmediateCheck,
  getQueueStats,
  cleanupJobs,
  shutdown,
  checkPodcastFeed
};