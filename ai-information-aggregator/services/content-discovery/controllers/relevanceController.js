const createLogger = require('../../../common/utils/logger');
const Content = require('../models/Content');
const relevanceAssessor = require('../utils/relevanceAssessor');

// Initialize logger
const logger = createLogger('relevance-controller');

/**
 * Assess content relevance
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function assessContentRelevance(req, res, next) {
  try {
    const { contentId } = req.params;
    
    if (!contentId) {
      return res.status(400).json({
        success: false,
        message: 'Content ID is required'
      });
    }
    
    // Get content
    const content = await Content.findById(contentId);
    
    if (!content) {
      return res.status(404).json({
        success: false,
        message: 'Content not found'
      });
    }
    
    // Get assessment options from request body
    const options = req.body || {};
    
    // If user is authenticated, add user interests
    if (req.user && req.user.interests) {
      options.userInterests = req.user.interests;
    }
    
    // Assess content relevance
    const result = await relevanceAssessor.assessContentRelevance(content, options);
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: `Error assessing content relevance: ${result.error}`
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Content relevance assessed',
      contentId: result.contentId,
      relevanceScore: result.relevanceScore,
      factors: result.factors
    });
  } catch (error) {
    logger.error(`Error assessing content relevance: ${error.message}`, { error });
    next(error);
  }
}

/**
 * Batch assess content relevance
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function batchAssessContentRelevance(req, res, next) {
  try {
    const { contentIds } = req.body;
    
    if (!contentIds || !Array.isArray(contentIds) || contentIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Content IDs array is required'
      });
    }
    
    // Get assessment options from request body
    const options = req.body.options || {};
    
    // If user is authenticated, add user interests
    if (req.user && req.user.interests) {
      options.userInterests = req.user.interests;
    }
    
    // Batch assess content relevance
    const result = await relevanceAssessor.batchAssessContentRelevance(contentIds, options);
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: `Error batch assessing content relevance: ${result.error}`
      });
    }
    
    res.status(200).json({
      success: true,
      message: `Processed ${result.processed} content items, ${result.failed} failed`,
      processed: result.processed,
      failed: result.failed,
      results: result.results
    });
  } catch (error) {
    logger.error(`Error batch assessing content relevance: ${error.message}`, { error });
    next(error);
  }
}

/**
 * Filter content by relevance
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function filterContentByRelevance(req, res, next) {
  try {
    const { threshold = 0.5 } = req.query;
    const { contentIds } = req.body;
    
    if (!contentIds || !Array.isArray(contentIds) || contentIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Content IDs array is required'
      });
    }
    
    // Get content
    const contents = await Content.find({ _id: { $in: contentIds } });
    
    // Filter content by relevance
    const filteredContents = relevanceAssessor.filterContentByRelevance(contents, parseFloat(threshold));
    
    res.status(200).json({
      success: true,
      message: `Filtered ${contents.length} content items, ${filteredContents.length} passed threshold`,
      total: contents.length,
      filtered: filteredContents.length,
      threshold: parseFloat(threshold),
      contentIds: filteredContents.map(content => content._id)
    });
  } catch (error) {
    logger.error(`Error filtering content by relevance: ${error.message}`, { error });
    next(error);
  }
}

/**
 * Get relevant content
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function getRelevantContent(req, res, next) {
  try {
    const { threshold = 0.5, limit = 10, skip = 0 } = req.query;
    
    // Get content with relevance score above threshold
    const contents = await Content.find({ relevanceScore: { $gte: parseFloat(threshold) } })
      .sort({ relevanceScore: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .populate('sourceId', 'name url type');
    
    // Get total count
    const total = await Content.countDocuments({ relevanceScore: { $gte: parseFloat(threshold) } });
    
    res.status(200).json({
      success: true,
      count: contents.length,
      total,
      threshold: parseFloat(threshold),
      contents: contents.map(content => ({
        id: content._id,
        title: content.title,
        url: content.url,
        type: content.type,
        relevanceScore: content.relevanceScore,
        publishDate: content.publishDate,
        source: content.sourceId ? {
          id: content.sourceId._id,
          name: content.sourceId.name,
          url: content.sourceId.url,
          type: content.sourceId.type
        } : null
      }))
    });
  } catch (error) {
    logger.error(`Error getting relevant content: ${error.message}`, { error });
    next(error);
  }
}

/**
 * Update content quality factors
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function updateContentQuality(req, res, next) {
  try {
    const { contentId } = req.params;
    const { qualityFactors } = req.body;
    
    if (!contentId) {
      return res.status(400).json({
        success: false,
        message: 'Content ID is required'
      });
    }
    
    if (!qualityFactors) {
      return res.status(400).json({
        success: false,
        message: 'Quality factors are required'
      });
    }
    
    // Get content
    const content = await Content.findById(contentId);
    
    if (!content) {
      return res.status(404).json({
        success: false,
        message: 'Content not found'
      });
    }
    
    // Update quality factors
    await content.updateQualityAssessment(qualityFactors);
    
    // Reassess relevance
    const result = await relevanceAssessor.assessContentRelevance(content);
    
    res.status(200).json({
      success: true,
      message: 'Content quality updated and relevance reassessed',
      contentId: content._id,
      qualityScore: content.qualityScore,
      qualityFactors: content.qualityFactors,
      relevanceScore: result.relevanceScore
    });
  } catch (error) {
    logger.error(`Error updating content quality: ${error.message}`, { error });
    next(error);
  }
}

module.exports = {
  assessContentRelevance,
  batchAssessContentRelevance,
  filterContentByRelevance,
  getRelevantContent,
  updateContentQuality
};