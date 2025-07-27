const Source = require('../models/Source');
const UrlValidator = require('../utils/urlValidator');
const createLogger = require('../../../common/utils/logger');
const { ApiError } = require('../../../common/utils/errorHandler');

// Configure logger
const logger = createLogger('source-controller');

// Get all sources for the authenticated user
exports.getAllSources = async (req, res) => {
  try {
    const sources = await Source.findActiveByUser(req.user.id);
    res.status(200).json(sources);
  } catch (error) {
    logger.error('Error fetching sources:', error);
    res.status(500).json({ message: 'Error fetching sources' });
  }
};

// Get a specific source by ID
exports.getSourceById = async (req, res) => {
  try {
    const source = await Source.findOne({ 
      _id: req.params.id, 
      createdBy: req.user.id,
      active: true 
    });
    
    if (!source) {
      return res.status(404).json({ message: 'Source not found' });
    }
    
    res.status(200).json(source);
  } catch (error) {
    logger.error('Error fetching source:', error);
    res.status(500).json({ message: 'Error fetching source' });
  }
};

// Create a new source
exports.createSource = async (req, res) => {
  try {
    // Check if source with the same URL already exists
    const existingSource = await Source.findOne({ 
      url: req.body.url,
      createdBy: req.user.id,
      active: true
    });
    
    if (existingSource) {
      return res.status(400).json({ message: 'Source with this URL already exists' });
    }
    
    const source = new Source({
      ...req.body,
      createdBy: req.user.id
    });
    
    await source.save();
    res.status(201).json(source);
  } catch (error) {
    logger.error('Error creating source:', error);
    res.status(500).json({ message: 'Error creating source' });
  }
};

// Update a source
exports.updateSource = async (req, res) => {
  try {
    const source = await Source.findOne({ 
      _id: req.params.id, 
      createdBy: req.user.id,
      active: true 
    });
    
    if (!source) {
      return res.status(404).json({ message: 'Source not found' });
    }
    
    // Update source properties
    Object.keys(req.body).forEach(key => {
      source[key] = req.body[key];
    });
    
    await source.save();
    res.status(200).json(source);
  } catch (error) {
    logger.error('Error updating source:', error);
    res.status(500).json({ message: 'Error updating source' });
  }
};

// Delete a source (set active to false)
exports.deleteSource = async (req, res) => {
  try {
    const source = await Source.findOne({ 
      _id: req.params.id, 
      createdBy: req.user.id,
      active: true 
    });
    
    if (!source) {
      return res.status(404).json({ message: 'Source not found' });
    }
    
    source.active = false;
    await source.save();
    
    res.status(200).json({ message: 'Source deleted successfully' });
  } catch (error) {
    logger.error('Error deleting source:', error);
    res.status(500).json({ message: 'Error deleting source' });
  }
};

// Update source relevance score
exports.updateRelevance = async (req, res) => {
  try {
    const { score, reason } = req.body;
    
    if (score === undefined || score < 0 || score > 1) {
      return res.status(400).json({ message: 'Invalid relevance score' });
    }
    
    const source = await Source.findOne({ 
      _id: req.params.id, 
      createdBy: req.user.id,
      active: true 
    });
    
    if (!source) {
      return res.status(404).json({ message: 'Source not found' });
    }
    
    await source.updateRelevance(score, {
      reason: reason || 'manual_update',
      userId: req.user.id
    });
    
    res.status(200).json(source);
  } catch (error) {
    logger.error('Error updating source relevance:', error);
    res.status(500).json({ message: 'Error updating source relevance' });
  }
};

// Adjust source relevance based on user interaction
exports.adjustRelevanceByInteraction = async (req, res) => {
  try {
    const { interactionType, weight } = req.body;
    
    if (!interactionType || !['view', 'save', 'share', 'dismiss', 'dislike'].includes(interactionType)) {
      return res.status(400).json({ message: 'Invalid interaction type' });
    }
    
    const source = await Source.findOne({ 
      _id: req.params.id, 
      active: true 
    });
    
    if (!source) {
      return res.status(404).json({ message: 'Source not found' });
    }
    
    await source.adjustRelevanceByInteraction(interactionType, req.user.id, weight);
    
    res.status(200).json(source);
  } catch (error) {
    logger.error('Error adjusting source relevance:', error);
    res.status(500).json({ message: 'Error adjusting source relevance' });
  }
};

// Get relevance history for a source
exports.getRelevanceHistory = async (req, res) => {
  try {
    const source = await Source.findOne({ 
      _id: req.params.id, 
      createdBy: req.user.id,
      active: true 
    });
    
    if (!source) {
      return res.status(404).json({ message: 'Source not found' });
    }
    
    const history = JSON.parse(source.metadata.get('relevanceHistory') || '[]');
    
    res.status(200).json({
      sourceId: source._id,
      currentScore: source.relevanceScore,
      priorityLevel: source.metadata.get('priorityLevel') || 'medium',
      history
    });
  } catch (error) {
    logger.error('Error fetching relevance history:', error);
    res.status(500).json({ message: 'Error fetching relevance history' });
  }
};

// Calculate recommended relevance score based on multiple factors
exports.calculateRecommendedScore = async (req, res) => {
  try {
    const { factors } = req.body;
    
    if (!factors || typeof factors !== 'object') {
      return res.status(400).json({ message: 'Invalid factors object' });
    }
    
    const relevanceRating = require('../utils/relevanceRating');
    const recommendedScore = relevanceRating.calculateRelevanceScore(factors);
    
    res.status(200).json({
      recommendedScore,
      priorityLevel: relevanceRating.calculatePriorityLevel(recommendedScore),
      recommendedCheckFrequency: relevanceRating.getRecommendedCheckFrequency(recommendedScore)
    });
  } catch (error) {
    logger.error('Error calculating recommended score:', error);
    res.status(500).json({ message: 'Error calculating recommended score' });
  }
};

// Decay relevance scores for sources without recent updates
exports.decayRelevanceScores = async (req, res) => {
  try {
    // This endpoint should be restricted to admins or system processes
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    const { decayRate, sourceIds } = req.body;
    
    let sources;
    if (sourceIds && Array.isArray(sourceIds)) {
      // Decay specific sources
      sources = await Source.find({
        _id: { $in: sourceIds },
        active: true
      });
    } else {
      // Decay all sources that haven't been updated in the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      sources = await Source.find({
        active: true,
        lastUpdated: { $lt: thirtyDaysAgo }
      });
    }
    
    const results = {
      processed: 0,
      updated: 0,
      details: []
    };
    
    for (const source of sources) {
      results.processed++;
      const oldScore = source.relevanceScore;
      await source.decayRelevanceScore(decayRate);
      
      if (oldScore !== source.relevanceScore) {
        results.updated++;
        results.details.push({
          sourceId: source._id,
          name: source.name,
          oldScore,
          newScore: source.relevanceScore
        });
      }
    }
    
    res.status(200).json(results);
  } catch (error) {
    logger.error('Error decaying relevance scores:', error);
    res.status(500).json({ message: 'Error decaying relevance scores' });
  }
};

// Get sources by type
exports.getSourcesByType = async (req, res) => {
  try {
    const sources = await Source.find({ 
      type: req.params.type,
      createdBy: req.user.id,
      active: true 
    });
    
    res.status(200).json(sources);
  } catch (error) {
    logger.error('Error fetching sources by type:', error);
    res.status(500).json({ message: 'Error fetching sources by type' });
  }
};

// Get sources by category
exports.getSourcesByCategory = async (req, res) => {
  try {
    const sources = await Source.find({ 
      categories: req.params.category,
      createdBy: req.user.id,
      active: true 
    });
    
    res.status(200).json(sources);
  } catch (error) {
    logger.error('Error fetching sources by category:', error);
    res.status(500).json({ message: 'Error fetching sources by category' });
  }
};

// Validate URL and extract source information
exports.validateUrl = async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ message: 'URL is required' });
    }
    
    // Check if source with the same URL already exists
    const existingSource = await Source.findOne({ 
      url,
      createdBy: req.user.id,
      active: true
    });
    
    if (existingSource) {
      return res.status(400).json({ 
        message: 'Source with this URL already exists',
        sourceId: existingSource._id
      });
    }
    
    // Validate and extract source information
    const sourceInfo = await UrlValidator.validateAndExtractSourceInfo(url);
    
    if (!sourceInfo.valid) {
      return res.status(400).json({ 
        message: 'Invalid URL',
        error: sourceInfo.error
      });
    }
    
    res.status(200).json(sourceInfo);
  } catch (error) {
    logger.error('Error validating URL:', error);
    res.status(500).json({ message: 'Error validating URL' });
  }
};

// Check URL reachability
exports.checkUrlReachability = async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ message: 'URL is required' });
    }
    
    const isReachable = await UrlValidator.isReachable(url);
    
    res.status(200).json({ 
      url,
      reachable: isReachable
    });
  } catch (error) {
    logger.error('Error checking URL reachability:', error);
    res.status(500).json({ message: 'Error checking URL reachability' });
  }
};

// Get URL metadata
exports.getUrlMetadata = async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ message: 'URL is required' });
    }
    
    const metadata = await UrlValidator.getMetadata(url);
    
    if (metadata.error) {
      return res.status(400).json({ 
        message: 'Error fetching metadata',
        error: metadata.error
      });
    }
    
    res.status(200).json(metadata);
  } catch (error) {
    logger.error('Error getting URL metadata:', error);
    res.status(500).json({ message: 'Error getting URL metadata' });
  }
};

// Find RSS feed for a website
exports.findRssFeed = async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ message: 'URL is required' });
    }
    
    const rssUrl = await UrlValidator.findRssFeed(url);
    
    res.status(200).json({ 
      url,
      rssUrl
    });
  } catch (error) {
    logger.error('Error finding RSS feed:', error);
    res.status(500).json({ message: 'Error finding RSS feed' });
  }
};

// Bulk import sources
exports.bulkImportSources = async (req, res) => {
  try {
    const { sources } = req.body;
    
    if (!Array.isArray(sources) || sources.length === 0) {
      return res.status(400).json({ message: 'Sources array is required' });
    }
    
    const results = {
      successful: [],
      failed: []
    };
    
    for (const sourceData of sources) {
      try {
        // Check if source already exists
        const existingSource = await Source.findOne({ 
          url: sourceData.url,
          createdBy: req.user.id,
          active: true
        });
        
        if (existingSource) {
          results.failed.push({
            url: sourceData.url,
            error: 'Source with this URL already exists'
          });
          continue;
        }
        
        // Create new source
        const source = new Source({
          ...sourceData,
          createdBy: req.user.id
        });
        
        await source.save();
        results.successful.push({
          url: sourceData.url,
          id: source._id
        });
      } catch (error) {
        results.failed.push({
          url: sourceData.url,
          error: error.message
        });
      }
    }
    
    res.status(200).json(results);
  } catch (error) {
    logger.error('Error bulk importing sources:', error);
    res.status(500).json({ message: 'Error bulk importing sources' });
  }
};