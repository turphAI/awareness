const ContentMetadata = require('../models/ContentMetadata');
const MetadataExtractor = require('../utils/metadataExtractor');
const { validationResult } = require('express-validator');

class MetadataController {
  constructor() {
    this.metadataExtractor = new MetadataExtractor();
  }

  /**
   * Extract and store metadata for content
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async extractMetadata(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { contentId, content, options = {} } = req.body;

      // Check if metadata already exists
      const existingMetadata = await ContentMetadata.findOne({ contentId });
      if (existingMetadata && !options.forceUpdate) {
        return res.status(409).json({
          success: false,
          message: 'Metadata already exists for this content',
          data: existingMetadata
        });
      }

      // Extract metadata
      const extractedMetadata = await this.metadataExtractor.extractMetadata(content, options);
      extractedMetadata.contentId = contentId;

      let metadata;
      if (existingMetadata) {
        // Update existing metadata
        Object.assign(existingMetadata, extractedMetadata);
        metadata = await existingMetadata.save();
      } else {
        // Create new metadata
        metadata = new ContentMetadata(extractedMetadata);
        metadata = await metadata.save();
      }

      res.status(201).json({
        success: true,
        message: 'Metadata extracted and stored successfully',
        data: metadata
      });
    } catch (error) {
      console.error('Error extracting metadata:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to extract metadata',
        error: error.message
      });
    }
  }

  /**
   * Get metadata by content ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getMetadata(req, res) {
    try {
      const { contentId } = req.params;

      const metadata = await ContentMetadata.findOne({ contentId })
        .populate('relatedContent.contentId', 'title url');

      if (!metadata) {
        return res.status(404).json({
          success: false,
          message: 'Metadata not found for this content'
        });
      }

      res.json({
        success: true,
        data: metadata
      });
    } catch (error) {
      console.error('Error retrieving metadata:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve metadata',
        error: error.message
      });
    }
  }

  /**
   * Update metadata
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async updateMetadata(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { contentId } = req.params;
      const updates = req.body;

      const metadata = await ContentMetadata.findOne({ contentId });
      if (!metadata) {
        return res.status(404).json({
          success: false,
          message: 'Metadata not found for this content'
        });
      }

      // Apply updates
      Object.keys(updates).forEach(key => {
        if (key !== 'contentId' && key !== '_id') {
          metadata[key] = updates[key];
        }
      });

      const updatedMetadata = await metadata.save();

      res.json({
        success: true,
        message: 'Metadata updated successfully',
        data: updatedMetadata
      });
    } catch (error) {
      console.error('Error updating metadata:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update metadata',
        error: error.message
      });
    }
  }

  /**
   * Delete metadata
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async deleteMetadata(req, res) {
    try {
      const { contentId } = req.params;

      const result = await ContentMetadata.deleteOne({ contentId });
      if (result.deletedCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'Metadata not found for this content'
        });
      }

      res.json({
        success: true,
        message: 'Metadata deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting metadata:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete metadata',
        error: error.message
      });
    }
  }

  /**
   * Search metadata
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async searchMetadata(req, res) {
    try {
      const { 
        query, 
        contentType, 
        domain, 
        categories, 
        topics,
        minQualityScore,
        maxAge,
        limit = 20,
        offset = 0,
        sortBy = 'relevanceScore',
        sortOrder = 'desc'
      } = req.query;

      let searchQuery = {};
      let sortOptions = {};

      // Build search query
      if (query) {
        searchQuery.$text = { $search: query };
      }

      if (contentType) {
        searchQuery.contentType = contentType;
      }

      if (domain) {
        searchQuery['source.domain'] = domain;
      }

      if (categories) {
        const categoryArray = Array.isArray(categories) ? categories : [categories];
        searchQuery.categories = { $in: categoryArray };
      }

      if (topics) {
        const topicArray = Array.isArray(topics) ? topics : [topics];
        searchQuery.topics = { $in: topicArray };
      }

      if (minQualityScore) {
        searchQuery.qualityScore = { $gte: parseFloat(minQualityScore) };
      }

      if (maxAge) {
        const maxAgeDate = new Date();
        maxAgeDate.setDate(maxAgeDate.getDate() - parseInt(maxAge));
        searchQuery.publishedAt = { $gte: maxAgeDate };
      }

      // Build sort options
      if (query && !sortBy) {
        sortOptions = { score: { $meta: 'textScore' } };
      } else {
        sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
      }

      // Execute search
      let queryBuilder = ContentMetadata.find(searchQuery);

      if (query) {
        queryBuilder = queryBuilder.select({ score: { $meta: 'textScore' } });
      }

      const results = await queryBuilder
        .sort(sortOptions)
        .skip(parseInt(offset))
        .limit(parseInt(limit))
        .populate('relatedContent.contentId', 'title url');

      // Get total count for pagination
      const totalCount = await ContentMetadata.countDocuments(searchQuery);

      res.json({
        success: true,
        data: {
          results,
          pagination: {
            total: totalCount,
            limit: parseInt(limit),
            offset: parseInt(offset),
            hasMore: totalCount > parseInt(offset) + parseInt(limit)
          }
        }
      });
    } catch (error) {
      console.error('Error searching metadata:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to search metadata',
        error: error.message
      });
    }
  }

  /**
   * Get content statistics
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getStatistics(req, res) {
    try {
      const statistics = await ContentMetadata.getContentStatistics();

      res.json({
        success: true,
        data: statistics
      });
    } catch (error) {
      console.error('Error retrieving statistics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve statistics',
        error: error.message
      });
    }
  }

  /**
   * Update engagement metrics
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async updateEngagement(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { contentId } = req.params;
      const { metrics } = req.body;

      const metadata = await ContentMetadata.findOne({ contentId });
      if (!metadata) {
        return res.status(404).json({
          success: false,
          message: 'Metadata not found for this content'
        });
      }

      await metadata.updateEngagement(metrics);

      res.json({
        success: true,
        message: 'Engagement metrics updated successfully',
        data: metadata
      });
    } catch (error) {
      console.error('Error updating engagement:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update engagement metrics',
        error: error.message
      });
    }
  }

  /**
   * Add related content
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async addRelatedContent(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { contentId } = req.params;
      const { relatedContentId, relationshipType, strength = 0.5 } = req.body;

      const metadata = await ContentMetadata.findOne({ contentId });
      if (!metadata) {
        return res.status(404).json({
          success: false,
          message: 'Metadata not found for this content'
        });
      }

      await metadata.addRelatedContent(relatedContentId, relationshipType, strength);

      res.json({
        success: true,
        message: 'Related content added successfully',
        data: metadata
      });
    } catch (error) {
      console.error('Error adding related content:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add related content',
        error: error.message
      });
    }
  }

  /**
   * Remove related content
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async removeRelatedContent(req, res) {
    try {
      const { contentId, relatedContentId } = req.params;

      const metadata = await ContentMetadata.findOne({ contentId });
      if (!metadata) {
        return res.status(404).json({
          success: false,
          message: 'Metadata not found for this content'
        });
      }

      await metadata.removeRelatedContent(relatedContentId);

      res.json({
        success: true,
        message: 'Related content removed successfully',
        data: metadata
      });
    } catch (error) {
      console.error('Error removing related content:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to remove related content',
        error: error.message
      });
    }
  }

  /**
   * Mark content as outdated
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async markOutdated(req, res) {
    try {
      const { contentId } = req.params;
      const { reasons = [], suggestions = [] } = req.body;

      const metadata = await ContentMetadata.findOne({ contentId });
      if (!metadata) {
        return res.status(404).json({
          success: false,
          message: 'Metadata not found for this content'
        });
      }

      await metadata.markOutdated(reasons, suggestions);

      res.json({
        success: true,
        message: 'Content marked as outdated successfully',
        data: metadata
      });
    } catch (error) {
      console.error('Error marking content as outdated:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark content as outdated',
        error: error.message
      });
    }
  }

  /**
   * Mark content as up-to-date
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async markUpToDate(req, res) {
    try {
      const { contentId } = req.params;
      const { nextReviewDate } = req.body;

      const metadata = await ContentMetadata.findOne({ contentId });
      if (!metadata) {
        return res.status(404).json({
          success: false,
          message: 'Metadata not found for this content'
        });
      }

      const reviewDate = nextReviewDate ? new Date(nextReviewDate) : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days from now
      await metadata.markUpToDate(reviewDate);

      res.json({
        success: true,
        message: 'Content marked as up-to-date successfully',
        data: metadata
      });
    } catch (error) {
      console.error('Error marking content as up-to-date:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark content as up-to-date',
        error: error.message
      });
    }
  }

  /**
   * Get outdated content
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getOutdatedContent(req, res) {
    try {
      const { limit = 20, offset = 0 } = req.query;

      const outdatedContent = await ContentMetadata.findOutdatedContent({
        limit: parseInt(limit),
        sort: { 'aging.lastReviewedAt': 1 }
      }).skip(parseInt(offset));

      const totalCount = await ContentMetadata.countDocuments({ 'aging.isOutdated': true });

      res.json({
        success: true,
        data: {
          results: outdatedContent,
          pagination: {
            total: totalCount,
            limit: parseInt(limit),
            offset: parseInt(offset),
            hasMore: totalCount > parseInt(offset) + parseInt(limit)
          }
        }
      });
    } catch (error) {
      console.error('Error retrieving outdated content:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve outdated content',
        error: error.message
      });
    }
  }

  /**
   * Get content due for review
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getContentDueForReview(req, res) {
    try {
      const { beforeDate } = req.query;
      const reviewDate = beforeDate ? new Date(beforeDate) : new Date();

      const dueContent = await ContentMetadata.findDueForReview(reviewDate);

      res.json({
        success: true,
        data: dueContent
      });
    } catch (error) {
      console.error('Error retrieving content due for review:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve content due for review',
        error: error.message
      });
    }
  }

  /**
   * Update quality scores
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async updateQualityScores(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { contentId } = req.params;
      const { scores } = req.body;

      const metadata = await ContentMetadata.findOne({ contentId });
      if (!metadata) {
        return res.status(404).json({
          success: false,
          message: 'Metadata not found for this content'
        });
      }

      await metadata.updateQualityScores(scores);

      res.json({
        success: true,
        message: 'Quality scores updated successfully',
        data: metadata
      });
    } catch (error) {
      console.error('Error updating quality scores:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update quality scores',
        error: error.message
      });
    }
  }

  /**
   * Update custom fields
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async updateCustomFields(req, res) {
    try {
      const { contentId } = req.params;
      const { fields } = req.body;

      const metadata = await ContentMetadata.findOne({ contentId });
      if (!metadata) {
        return res.status(404).json({
          success: false,
          message: 'Metadata not found for this content'
        });
      }

      await metadata.updateCustomFields(fields);

      res.json({
        success: true,
        message: 'Custom fields updated successfully',
        data: metadata
      });
    } catch (error) {
      console.error('Error updating custom fields:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update custom fields',
        error: error.message
      });
    }
  }
}

module.exports = new MetadataController();