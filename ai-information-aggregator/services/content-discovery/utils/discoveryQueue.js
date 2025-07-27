const Bull = require('bull');
const createLogger = require('../../../common/utils/logger');
const Content = require('../models/Content');
const Reference = require('../models/Reference');
const referenceExtractor = require('./referenceExtractor');
const relevanceAssessor = require('./relevanceAssessor');

// Initialize logger
const logger = createLogger('discovery-queue');

// Create Redis connection options
const redisOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined
};

// Create queues for different discovery tasks
const contentProcessingQueue = new Bull('content-processing', { redis: redisOptions });
const referenceExtractionQueue = new Bull('reference-extraction', { redis: redisOptions });
const referenceResolutionQueue = new Bull('reference-resolution', { redis: redisOptions });
const relevanceAssessmentQueue = new Bull('relevance-assessment', { redis: redisOptions });

/**
 * Initialize all discovery queues
 */
function initializeQueues() {
  // Process content processing queue
  contentProcessingQueue.process(async (job) => {
    logger.info(`Processing content: ${job.data.contentId}`);
    return processContent(job.data.contentId, job.data.options);
  });

  // Process reference extraction queue
  referenceExtractionQueue.process(async (job) => {
    logger.info(`Extracting references for content: ${job.data.contentId}`);
    return extractReferences(job.data.contentId);
  });

  // Process reference resolution queue
  referenceResolutionQueue.process(async (job) => {
    logger.info(`Resolving references: ${job.data.limit || 'all'}`);
    return resolveReferences(job.data.limit);
  });

  // Process relevance assessment queue
  relevanceAssessmentQueue.process(async (job) => {
    logger.info(`Assessing relevance for content: ${job.data.contentId}`);
    return assessRelevance(job.data.contentId, job.data.options);
  });

  // Set up error handlers for all queues
  [contentProcessingQueue, referenceExtractionQueue, referenceResolutionQueue, relevanceAssessmentQueue].forEach(queue => {
    queue.on('error', (error) => {
      logger.error(`Queue error: ${error.message}`, { error });
    });

    queue.on('failed', (job, error) => {
      logger.error(`Job ${job.id} failed: ${error.message}`, { 
        jobId: job.id, 
        data: job.data,
        error 
      });
    });

    queue.on('completed', (job, result) => {
      logger.info(`Job ${job.id} completed`, { 
        jobId: job.id, 
        data: job.data,
        success: result.success 
      });
    });
  });

  logger.info('All discovery queues initialized');
}

/**
 * Process content
 * @param {string} contentId - Content ID
 * @param {Object} options - Processing options
 * @returns {Promise<Object>} - Processing result
 */
async function processContent(contentId, options = {}) {
  try {
    // Get content
    const content = await Content.findById(contentId);
    
    if (!content) {
      logger.warn(`Content not found: ${contentId}`);
      return { success: false, error: 'Content not found' };
    }
    
    // Extract references
    const extractionResult = await referenceExtractor.extractReferences(content);
    
    // Assess relevance
    const relevanceResult = await relevanceAssessor.assessContentRelevance(content, options);
    
    // Mark content as processed
    await content.markAsProcessed({
      stage: 'discovery',
      duration: Date.now() - new Date(content.discoveryDate).getTime(),
      success: true,
      metadata: {
        extractedReferences: extractionResult.extractedCount,
        relevanceScore: relevanceResult.relevanceScore
      }
    });
    
    return {
      success: true,
      contentId,
      extractedReferences: extractionResult.extractedCount,
      relevanceScore: relevanceResult.relevanceScore
    };
  } catch (error) {
    logger.error(`Error processing content ${contentId}: ${error.message}`, { error });
    
    return { 
      success: false, 
      contentId,
      error: error.message 
    };
  }
}

/**
 * Extract references from content
 * @param {string} contentId - Content ID
 * @returns {Promise<Object>} - Extraction result
 */
async function extractReferences(contentId) {
  try {
    // Get content
    const content = await Content.findById(contentId);
    
    if (!content) {
      logger.warn(`Content not found: ${contentId}`);
      return { success: false, error: 'Content not found' };
    }
    
    // Extract references
    const result = await referenceExtractor.extractReferences(content);
    
    // Update content processing history
    content.processingHistory.push({
      stage: 'extraction',
      timestamp: new Date(),
      duration: 0,
      success: result.success,
      metadata: new Map([
        ['extractedCount', result.extractedCount.toString()],
        ['savedCount', result.savedCount.toString()]
      ])
    });
    
    await content.save();
    
    return {
      success: true,
      contentId,
      extractedCount: result.extractedCount,
      savedCount: result.savedCount
    };
  } catch (error) {
    logger.error(`Error extracting references for content ${contentId}: ${error.message}`, { error });
    
    return { 
      success: false, 
      contentId,
      error: error.message 
    };
  }
}

/**
 * Resolve references
 * @param {number} limit - Maximum number of references to resolve
 * @returns {Promise<Object>} - Resolution result
 */
async function resolveReferences(limit = 100) {
  try {
    // Process unresolved references
    const result = await referenceExtractor.processUnresolvedReferences(limit);
    
    return {
      success: true,
      processed: result.processed,
      resolved: result.resolved
    };
  } catch (error) {
    logger.error(`Error resolving references: ${error.message}`, { error });
    
    return { 
      success: false, 
      error: error.message 
    };
  }
}

/**
 * Assess content relevance
 * @param {string} contentId - Content ID
 * @param {Object} options - Assessment options
 * @returns {Promise<Object>} - Assessment result
 */
async function assessRelevance(contentId, options = {}) {
  try {
    // Get content
    const content = await Content.findById(contentId);
    
    if (!content) {
      logger.warn(`Content not found: ${contentId}`);
      return { success: false, error: 'Content not found' };
    }
    
    // Assess relevance
    const result = await relevanceAssessor.assessContentRelevance(content, options);
    
    // Update content processing history
    content.processingHistory.push({
      stage: 'relevance',
      timestamp: new Date(),
      duration: 0,
      success: result.success,
      metadata: new Map([
        ['relevanceScore', result.relevanceScore.toString()]
      ])
    });
    
    await content.save();
    
    return {
      success: true,
      contentId,
      relevanceScore: result.relevanceScore
    };
  } catch (error) {
    logger.error(`Error assessing relevance for content ${contentId}: ${error.message}`, { error });
    
    return { 
      success: false, 
      contentId,
      error: error.message 
    };
  }
}

/**
 * Add content to processing queue
 * @param {string} contentId - Content ID
 * @param {Object} options - Processing options
 * @returns {Promise<Object>} - Queue result
 */
async function queueContentProcessing(contentId, options = {}) {
  try {
    const job = await contentProcessingQueue.add(
      { contentId, options },
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
    
    logger.info(`Queued content processing for ${contentId}, job ID: ${job.id}`);
    
    return {
      success: true,
      jobId: job.id,
      contentId
    };
  } catch (error) {
    logger.error(`Error queuing content processing for ${contentId}: ${error.message}`, { error });
    
    return { 
      success: false, 
      contentId,
      error: error.message 
    };
  }
}

/**
 * Add content to reference extraction queue
 * @param {string} contentId - Content ID
 * @returns {Promise<Object>} - Queue result
 */
async function queueReferenceExtraction(contentId) {
  try {
    const job = await referenceExtractionQueue.add(
      { contentId },
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
    
    logger.info(`Queued reference extraction for ${contentId}, job ID: ${job.id}`);
    
    return {
      success: true,
      jobId: job.id,
      contentId
    };
  } catch (error) {
    logger.error(`Error queuing reference extraction for ${contentId}: ${error.message}`, { error });
    
    return { 
      success: false, 
      contentId,
      error: error.message 
    };
  }
}

/**
 * Add reference resolution to queue
 * @param {number} limit - Maximum number of references to resolve
 * @returns {Promise<Object>} - Queue result
 */
async function queueReferenceResolution(limit = 100) {
  try {
    const job = await referenceResolutionQueue.add(
      { limit },
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
    
    logger.info(`Queued reference resolution for up to ${limit} references, job ID: ${job.id}`);
    
    return {
      success: true,
      jobId: job.id,
      limit
    };
  } catch (error) {
    logger.error(`Error queuing reference resolution: ${error.message}`, { error });
    
    return { 
      success: false, 
      error: error.message 
    };
  }
}

/**
 * Add content to relevance assessment queue
 * @param {string} contentId - Content ID
 * @param {Object} options - Assessment options
 * @returns {Promise<Object>} - Queue result
 */
async function queueRelevanceAssessment(contentId, options = {}) {
  try {
    const job = await relevanceAssessmentQueue.add(
      { contentId, options },
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
    
    logger.info(`Queued relevance assessment for ${contentId}, job ID: ${job.id}`);
    
    return {
      success: true,
      jobId: job.id,
      contentId
    };
  } catch (error) {
    logger.error(`Error queuing relevance assessment for ${contentId}: ${error.message}`, { error });
    
    return { 
      success: false, 
      contentId,
      error: error.message 
    };
  }
}

/**
 * Process new content
 * @param {string} contentId - Content ID
 * @returns {Promise<Object>} - Processing result
 */
async function processNewContent(contentId) {
  try {
    // Queue all processing steps
    const processingResult = await queueContentProcessing(contentId);
    
    if (!processingResult.success) {
      return processingResult;
    }
    
    return {
      success: true,
      contentId,
      message: 'Content queued for processing',
      jobId: processingResult.jobId
    };
  } catch (error) {
    logger.error(`Error processing new content ${contentId}: ${error.message}`, { error });
    
    return { 
      success: false, 
      contentId,
      error: error.message 
    };
  }
}

/**
 * Process unprocessed content
 * @param {number} limit - Maximum number of content items to process
 * @returns {Promise<Object>} - Processing result
 */
async function processUnprocessedContent(limit = 50) {
  try {
    // Find unprocessed content
    const unprocessedContent = await Content.find({ processed: false })
      .limit(limit);
    
    logger.info(`Found ${unprocessedContent.length} unprocessed content items`);
    
    // Queue each content item for processing
    const results = [];
    for (const content of unprocessedContent) {
      const result = await queueContentProcessing(content._id);
      results.push(result);
    }
    
    const successCount = results.filter(r => r.success).length;
    
    return {
      success: true,
      total: unprocessedContent.length,
      queued: successCount,
      failed: unprocessedContent.length - successCount
    };
  } catch (error) {
    logger.error(`Error processing unprocessed content: ${error.message}`, { error });
    
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
    const [
      contentProcessingStats,
      referenceExtractionStats,
      referenceResolutionStats,
      relevanceAssessmentStats
    ] = await Promise.all([
      getQueueStatistics(contentProcessingQueue),
      getQueueStatistics(referenceExtractionQueue),
      getQueueStatistics(referenceResolutionQueue),
      getQueueStatistics(relevanceAssessmentQueue)
    ]);
    
    return {
      success: true,
      stats: {
        contentProcessing: contentProcessingStats,
        referenceExtraction: referenceExtractionStats,
        referenceResolution: referenceResolutionStats,
        relevanceAssessment: relevanceAssessmentStats,
        total: {
          waiting: contentProcessingStats.waiting + referenceExtractionStats.waiting + 
                  referenceResolutionStats.waiting + relevanceAssessmentStats.waiting,
          active: contentProcessingStats.active + referenceExtractionStats.active + 
                 referenceResolutionStats.active + relevanceAssessmentStats.active,
          completed: contentProcessingStats.completed + referenceExtractionStats.completed + 
                    referenceResolutionStats.completed + relevanceAssessmentStats.completed,
          failed: contentProcessingStats.failed + referenceExtractionStats.failed + 
                 referenceResolutionStats.failed + relevanceAssessmentStats.failed,
          delayed: contentProcessingStats.delayed + referenceExtractionStats.delayed + 
                  referenceResolutionStats.delayed + relevanceAssessmentStats.delayed
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
      contentProcessingQueue.clean(24 * 60 * 60 * 1000, 'completed'), // 1 day
      referenceExtractionQueue.clean(24 * 60 * 60 * 1000, 'completed'), // 1 day
      referenceResolutionQueue.clean(24 * 60 * 60 * 1000, 'completed'), // 1 day
      relevanceAssessmentQueue.clean(24 * 60 * 60 * 1000, 'completed'), // 1 day
      contentProcessingQueue.clean(7 * 24 * 60 * 60 * 1000, 'failed'), // 7 days
      referenceExtractionQueue.clean(7 * 24 * 60 * 60 * 1000, 'failed'), // 7 days
      referenceResolutionQueue.clean(7 * 24 * 60 * 60 * 1000, 'failed'), // 7 days
      relevanceAssessmentQueue.clean(7 * 24 * 60 * 60 * 1000, 'failed') // 7 days
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
  logger.info('Shutting down discovery queues');
  
  await Promise.all([
    contentProcessingQueue.close(),
    referenceExtractionQueue.close(),
    referenceResolutionQueue.close(),
    relevanceAssessmentQueue.close()
  ]);
  
  logger.info('All discovery queues shut down');
}

module.exports = {
  initializeQueues,
  queueContentProcessing,
  queueReferenceExtraction,
  queueReferenceResolution,
  queueRelevanceAssessment,
  processNewContent,
  processUnprocessedContent,
  getQueueStats,
  cleanupJobs,
  shutdown
};