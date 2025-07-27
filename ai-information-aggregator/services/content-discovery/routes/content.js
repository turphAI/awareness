const express = require('express');
const router = express.Router();
const Content = require('../models/Content');
const Reference = require('../models/Reference');
const authMiddleware = require('../../authentication/middleware/auth');
const createLogger = require('../../../common/utils/logger');

// Initialize logger
const logger = createLogger('content-routes');

// Get all content
router.get('/', 
  authMiddleware.authenticate,
  async (req, res, next) => {
    try {
      const { 
        limit = 10, 
        skip = 0, 
        sort = '-publishDate',
        type,
        processed,
        sourceId,
        topic,
        category,
        search
      } = req.query;
      
      // Build query
      const query = {};
      
      if (type) {
        query.type = type;
      }
      
      if (processed !== undefined) {
        query.processed = processed === 'true';
      }
      
      if (sourceId) {
        query.sourceId = sourceId;
      }
      
      if (topic) {
        query.topics = topic;
      }
      
      if (category) {
        query.categories = category;
      }
      
      if (search) {
        query.$or = [
          { title: { $regex: search, $options: 'i' } },
          { summary: { $regex: search, $options: 'i' } }
        ];
      }
      
      // Execute query
      const content = await Content.find(query)
        .sort(sort)
        .skip(parseInt(skip))
        .limit(parseInt(limit))
        .populate('sourceId', 'name url type');
      
      // Get total count
      const total = await Content.countDocuments(query);
      
      res.status(200).json({
        success: true,
        count: content.length,
        total,
        data: content
      });
    } catch (error) {
      logger.error(`Error getting content: ${error.message}`, { error });
      next(error);
    }
  }
);

// Get content by ID
router.get('/:id', 
  authMiddleware.authenticate,
  async (req, res, next) => {
    try {
      const content = await Content.findById(req.params.id)
        .populate('sourceId', 'name url type')
        .populate('references');
      
      if (!content) {
        return res.status(404).json({
          success: false,
          message: 'Content not found'
        });
      }
      
      res.status(200).json({
        success: true,
        data: content
      });
    } catch (error) {
      logger.error(`Error getting content by ID: ${error.message}`, { error });
      next(error);
    }
  }
);

// Mark content as processed
router.patch('/:id/process', 
  authMiddleware.authenticate,
  async (req, res, next) => {
    try {
      const content = await Content.findById(req.params.id);
      
      if (!content) {
        return res.status(404).json({
          success: false,
          message: 'Content not found'
        });
      }
      
      const { stage, duration, success, metadata } = req.body;
      
      await content.markAsProcessed({
        stage,
        duration,
        success,
        metadata
      });
      
      res.status(200).json({
        success: true,
        message: 'Content marked as processed',
        data: content
      });
    } catch (error) {
      logger.error(`Error marking content as processed: ${error.message}`, { error });
      next(error);
    }
  }
);

// Mark content as outdated
router.patch('/:id/outdated', 
  authMiddleware.authenticate,
  async (req, res, next) => {
    try {
      const content = await Content.findById(req.params.id);
      
      if (!content) {
        return res.status(404).json({
          success: false,
          message: 'Content not found'
        });
      }
      
      await content.markAsOutdated();
      
      res.status(200).json({
        success: true,
        message: 'Content marked as outdated',
        data: content
      });
    } catch (error) {
      logger.error(`Error marking content as outdated: ${error.message}`, { error });
      next(error);
    }
  }
);

// Update content relevance
router.patch('/:id/relevance', 
  authMiddleware.authenticate,
  async (req, res, next) => {
    try {
      const content = await Content.findById(req.params.id);
      
      if (!content) {
        return res.status(404).json({
          success: false,
          message: 'Content not found'
        });
      }
      
      const { score } = req.body;
      
      if (score === undefined || score < 0 || score > 1) {
        return res.status(400).json({
          success: false,
          message: 'Score must be a number between 0 and 1'
        });
      }
      
      await content.updateRelevance(score);
      
      res.status(200).json({
        success: true,
        message: 'Content relevance updated',
        data: content
      });
    } catch (error) {
      logger.error(`Error updating content relevance: ${error.message}`, { error });
      next(error);
    }
  }
);

// Add user interaction
router.post('/:id/interaction', 
  authMiddleware.authenticate,
  async (req, res, next) => {
    try {
      const content = await Content.findById(req.params.id);
      
      if (!content) {
        return res.status(404).json({
          success: false,
          message: 'Content not found'
        });
      }
      
      const { interactionType, metadata } = req.body;
      
      if (!interactionType || !['view', 'save', 'share', 'dismiss'].includes(interactionType)) {
        return res.status(400).json({
          success: false,
          message: 'Valid interaction type is required (view, save, share, dismiss)'
        });
      }
      
      await content.addUserInteraction(req.user._id, interactionType, metadata);
      
      res.status(200).json({
        success: true,
        message: 'User interaction added',
        data: content
      });
    } catch (error) {
      logger.error(`Error adding user interaction: ${error.message}`, { error });
      next(error);
    }
  }
);

// Get references for content
router.get('/:id/references', 
  authMiddleware.authenticate,
  async (req, res, next) => {
    try {
      const references = await Reference.find({ sourceContentId: req.params.id });
      
      res.status(200).json({
        success: true,
        count: references.length,
        data: references
      });
    } catch (error) {
      logger.error(`Error getting content references: ${error.message}`, { error });
      next(error);
    }
  }
);

// Get related content
router.get('/:id/related', 
  authMiddleware.authenticate,
  async (req, res, next) => {
    try {
      const { limit = 5 } = req.query;
      
      const relatedContent = await Content.findRelatedContent(req.params.id, parseInt(limit));
      
      res.status(200).json({
        success: true,
        count: relatedContent.length,
        data: relatedContent
      });
    } catch (error) {
      logger.error(`Error getting related content: ${error.message}`, { error });
      next(error);
    }
  }
);

module.exports = router;