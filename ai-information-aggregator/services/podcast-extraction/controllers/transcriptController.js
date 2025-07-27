const createLogger = require('../../../common/utils/logger');
const Transcript = require('../models/Transcript');
const Episode = require('../models/Episode');

// Initialize logger
const logger = createLogger('transcript-controller');

/**
 * Get all transcripts
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function getAllTranscripts(req, res, next) {
  try {
    const { 
      limit = 10, 
      skip = 0, 
      sort = '-createdAt',
      processed,
      search
    } = req.query;
    
    // Build query
    const query = {};
    
    if (processed !== undefined) {
      query.processed = processed === 'true';
    }
    
    if (search) {
      query.$text = { $search: search };
    }
    
    // Execute query
    const transcripts = await Transcript.find(query)
      .sort(search ? { score: { $meta: 'textScore' } } : sort)
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .populate('episodeId', 'title publishDate');
    
    // Get total count
    const total = await Transcript.countDocuments(query);
    
    res.status(200).json({
      success: true,
      count: transcripts.length,
      total,
      data: transcripts.map(transcript => ({
        id: transcript._id,
        episodeId: transcript.episodeId,
        language: transcript.language,
        processed: transcript.processed,
        topics: transcript.topics,
        keywords: transcript.keywords,
        summary: transcript.summary,
        createdAt: transcript.createdAt,
        updatedAt: transcript.updatedAt
      }))
    });
  } catch (error) {
    logger.error(`Error getting transcripts: ${error.message}`, { error });
    next(error);
  }
}

/**
 * Get transcript by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function getTranscriptById(req, res, next) {
  try {
    const { id } = req.params;
    
    const transcript = await Transcript.findById(id)
      .populate('episodeId', 'title publishDate podcastId');
    
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
    logger.error(`Error getting transcript: ${error.message}`, { error });
    next(error);
  }
}

/**
 * Create transcript
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function createTranscript(req, res, next) {
  try {
    const { episodeId, fullText, segments, language } = req.body;
    
    // Check if episode exists
    const episode = await Episode.findById(episodeId);
    
    if (!episode) {
      return res.status(404).json({
        success: false,
        message: 'Episode not found'
      });
    }
    
    // Check if transcript already exists
    const existingTranscript = await Transcript.findOne({ episodeId });
    
    if (existingTranscript) {
      return res.status(400).json({
        success: false,
        message: 'Transcript already exists for this episode'
      });
    }
    
    // Create transcript
    const transcript = new Transcript({
      episodeId,
      fullText,
      segments: segments || [],
      language: language || 'en'
    });
    
    await transcript.save();
    
    // Update episode
    episode.transcriptAvailable = true;
    await episode.save();
    
    res.status(201).json({
      success: true,
      message: 'Transcript created successfully',
      data: transcript
    });
  } catch (error) {
    logger.error(`Error creating transcript: ${error.message}`, { error });
    next(error);
  }
}

/**
 * Update transcript
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function updateTranscript(req, res, next) {
  try {
    const { id } = req.params;
    const { fullText, segments, topics, keywords, summary, processed } = req.body;
    
    const transcript = await Transcript.findById(id);
    
    if (!transcript) {
      return res.status(404).json({
        success: false,
        message: 'Transcript not found'
      });
    }
    
    // Update fields
    if (fullText) transcript.fullText = fullText;
    if (segments) transcript.segments = segments;
    if (topics) transcript.topics = topics;
    if (keywords) transcript.keywords = keywords;
    if (summary) transcript.summary = summary;
    if (processed !== undefined) transcript.processed = processed;
    
    await transcript.save();
    
    // If processed was set to true, update episode
    if (processed === true) {
      const episode = await Episode.findById(transcript.episodeId);
      if (episode) {
        episode.transcriptProcessed = true;
        await episode.save();
      }
    }
    
    res.status(200).json({
      success: true,
      message: 'Transcript updated successfully',
      data: transcript
    });
  } catch (error) {
    logger.error(`Error updating transcript: ${error.message}`, { error });
    next(error);
  }
}

/**
 * Mark transcript as processed
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function markTranscriptProcessed(req, res, next) {
  try {
    const { id } = req.params;
    const { stage, duration, success, error, metadata } = req.body;
    
    const transcript = await Transcript.findById(id);
    
    if (!transcript) {
      return res.status(404).json({
        success: false,
        message: 'Transcript not found'
      });
    }
    
    // Mark as processed
    await transcript.markAsProcessed({
      stage,
      duration,
      success,
      error,
      metadata
    });
    
    // Update episode
    const episode = await Episode.findById(transcript.episodeId);
    if (episode) {
      episode.transcriptProcessed = true;
      await episode.save();
    }
    
    res.status(200).json({
      success: true,
      message: 'Transcript marked as processed',
      data: transcript
    });
  } catch (error) {
    logger.error(`Error marking transcript as processed: ${error.message}`, { error });
    next(error);
  }
}

/**
 * Search transcripts
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function searchTranscripts(req, res, next) {
  try {
    const { query, limit = 10 } = req.query;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }
    
    const transcripts = await Transcript.searchByText(query, parseInt(limit))
      .populate('episodeId', 'title publishDate podcastId');
    
    res.status(200).json({
      success: true,
      count: transcripts.length,
      data: transcripts.map(transcript => ({
        id: transcript._id,
        episodeId: transcript.episodeId,
        fullText: transcript.fullText.substring(0, 200) + '...',
        language: transcript.language,
        processed: transcript.processed,
        topics: transcript.topics,
        keywords: transcript.keywords,
        summary: transcript.summary,
        createdAt: transcript.createdAt
      }))
    });
  } catch (error) {
    logger.error(`Error searching transcripts: ${error.message}`, { error });
    next(error);
  }
}

/**
 * Get transcripts by topic
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function getTranscriptsByTopic(req, res, next) {
  try {
    const { topic } = req.params;
    const { limit = 10 } = req.query;
    
    const transcripts = await Transcript.findByTopic(topic, parseInt(limit))
      .populate('episodeId', 'title publishDate podcastId');
    
    res.status(200).json({
      success: true,
      count: transcripts.length,
      data: transcripts.map(transcript => ({
        id: transcript._id,
        episodeId: transcript.episodeId,
        language: transcript.language,
        processed: transcript.processed,
        topics: transcript.topics,
        keywords: transcript.keywords,
        summary: transcript.summary,
        createdAt: transcript.createdAt
      }))
    });
  } catch (error) {
    logger.error(`Error getting transcripts by topic: ${error.message}`, { error });
    next(error);
  }
}

/**
 * Get unprocessed transcripts
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function getUnprocessedTranscripts(req, res, next) {
  try {
    const { limit = 10 } = req.query;
    
    const transcripts = await Transcript.findUnprocessed(parseInt(limit))
      .populate('episodeId', 'title publishDate podcastId');
    
    res.status(200).json({
      success: true,
      count: transcripts.length,
      data: transcripts
    });
  } catch (error) {
    logger.error(`Error getting unprocessed transcripts: ${error.message}`, { error });
    next(error);
  }
}

module.exports = {
  getAllTranscripts,
  getTranscriptById,
  createTranscript,
  updateTranscript,
  markTranscriptProcessed,
  searchTranscripts,
  getTranscriptsByTopic,
  getUnprocessedTranscripts
};