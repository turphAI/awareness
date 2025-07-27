const RelatedContentIdentifier = require('../utils/relatedContentIdentifier');
const { validationResult } = require('express-validator');

/**
 * Related Content Controller
 * Handles API endpoints for related content identification and visualization
 */
class RelatedContentController {
  constructor() {
    this.identifier = new RelatedContentIdentifier();
  }

  /**
   * Find related content for a given content item
   * GET /api/related/:contentId
   */
  async findRelatedContent(req, res) {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { contentId } = req.params;
      const {
        limit = 10,
        threshold = 0.3,
        includeMetadata = true
      } = req.query;

      const options = {
        limit: parseInt(limit),
        threshold: parseFloat(threshold),
        includeMetadata: includeMetadata === 'true'
      };

      const relatedContent = await this.identifier.findRelatedContent(contentId, options);

      res.json({
        success: true,
        data: {
          contentId,
          relatedContent,
          count: relatedContent.length,
          options
        }
      });

    } catch (error) {
      req.app.locals.logger?.error('Error finding related content:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to find related content',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Generate connection visualization for content
   * GET /api/related/:contentId/visualization
   */
  async generateVisualization(req, res) {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { contentId } = req.params;
      const {
        maxDepth = 2,
        maxNodes = 50,
        includeMetrics = true
      } = req.query;

      const options = {
        maxDepth: parseInt(maxDepth),
        maxNodes: parseInt(maxNodes),
        includeMetrics: includeMetrics === 'true'
      };

      const visualization = await this.identifier.generateConnectionVisualization(contentId, options);

      res.json({
        success: true,
        data: visualization
      });

    } catch (error) {
      req.app.locals.logger?.error('Error generating visualization:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate visualization',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Update related content metadata for a content item
   * POST /api/related/:contentId/update
   */
  async updateRelatedContent(req, res) {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { contentId } = req.params;
      const { threshold = 0.3, limit = 10 } = req.body;

      // Find related content
      const relatedContent = await this.identifier.findRelatedContent(contentId, {
        threshold,
        limit
      });

      // Update metadata
      await this.identifier.updateRelatedContentMetadata(contentId, relatedContent);

      res.json({
        success: true,
        message: 'Related content metadata updated successfully',
        data: {
          contentId,
          relatedCount: relatedContent.length
        }
      });

    } catch (error) {
      req.app.locals.logger?.error('Error updating related content:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update related content',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Batch process related content identification
   * POST /api/related/batch-process
   */
  async batchProcess(req, res) {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const {
        contentIds,
        batchSize = 10,
        updateMetadata = true,
        threshold = 0.3
      } = req.body;

      if (!Array.isArray(contentIds) || contentIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'contentIds must be a non-empty array'
        });
      }

      const options = {
        batchSize: parseInt(batchSize),
        updateMetadata: updateMetadata === true,
        threshold: parseFloat(threshold)
      };

      const results = await this.identifier.batchProcessRelatedContent(contentIds, options);

      res.json({
        success: true,
        message: 'Batch processing completed',
        data: results
      });

    } catch (error) {
      req.app.locals.logger?.error('Error in batch processing:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process batch',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Get similarity score between two content items
   * GET /api/related/similarity/:contentId1/:contentId2
   */
  async getSimilarity(req, res) {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { contentId1, contentId2 } = req.params;

      // Get both content items
      const Content = require('../../content-discovery/models/Content');
      const ContentMetadata = require('../models/ContentMetadata');

      const [content1, content2] = await Promise.all([
        Content.findById(contentId1),
        Content.findById(contentId2)
      ]);

      if (!content1 || !content2) {
        return res.status(404).json({
          success: false,
          message: 'One or both content items not found'
        });
      }

      // Get metadata if available
      const [metadata1, metadata2] = await Promise.all([
        ContentMetadata.findOne({ contentId: contentId1 }),
        ContentMetadata.findOne({ contentId: contentId2 })
      ]);

      // Combine content with metadata
      const enrichedContent1 = this.identifier.combineContentWithMetadata(content1, metadata1);
      const enrichedContent2 = this.identifier.combineContentWithMetadata(content2, metadata2);

      // Calculate similarity
      const similarity = this.identifier.calculateSimilarity(enrichedContent1, enrichedContent2);
      const relationshipType = this.identifier.determineRelationshipType(
        enrichedContent1,
        enrichedContent2,
        similarity
      );

      res.json({
        success: true,
        data: {
          contentId1,
          contentId2,
          similarity,
          relationshipType,
          breakdown: {
            topicSimilarity: this.identifier.calculateTopicSimilarity(
              enrichedContent1.topics || [],
              enrichedContent2.topics || []
            ),
            categorySimilarity: this.identifier.calculateCategorySimilarity(
              enrichedContent1.categories || [],
              enrichedContent2.categories || []
            ),
            authorSimilarity: this.identifier.calculateAuthorSimilarity(
              enrichedContent1,
              enrichedContent2
            ),
            typeSimilarity: this.identifier.calculateTypeSimilarity(
              enrichedContent1,
              enrichedContent2
            ),
            temporalSimilarity: this.identifier.calculateTemporalSimilarity(
              enrichedContent1,
              enrichedContent2
            ),
            textSimilarity: this.identifier.calculateTextSimilarity(
              enrichedContent1,
              enrichedContent2
            )
          }
        }
      });

    } catch (error) {
      req.app.locals.logger?.error('Error calculating similarity:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to calculate similarity',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Get network statistics for content connections
   * GET /api/related/network-stats
   */
  async getNetworkStats(req, res) {
    try {
      const {
        contentIds,
        maxDepth = 2,
        maxNodes = 100
      } = req.query;

      let targetContentIds = [];
      
      if (contentIds) {
        targetContentIds = Array.isArray(contentIds) ? contentIds : [contentIds];
      } else {
        // Get all processed content IDs
        const Content = require('../../content-discovery/models/Content');
        const allContent = await Content.find({ processed: true }, '_id').limit(50);
        targetContentIds = allContent.map(c => c._id.toString());
      }

      // Generate visualizations for multiple content items
      const visualizations = await Promise.all(
        targetContentIds.slice(0, 10).map(async (contentId) => {
          try {
            return await this.identifier.generateConnectionVisualization(contentId, {
              maxDepth: parseInt(maxDepth),
              maxNodes: parseInt(maxNodes),
              includeMetrics: true
            });
          } catch (error) {
            return null;
          }
        })
      );

      // Filter out failed visualizations
      const validVisualizations = visualizations.filter(v => v !== null);

      // Aggregate network statistics
      const aggregatedStats = {
        totalNetworks: validVisualizations.length,
        totalNodes: validVisualizations.reduce((sum, v) => sum + v.metrics.nodeCount, 0),
        totalEdges: validVisualizations.reduce((sum, v) => sum + v.metrics.edgeCount, 0),
        avgDensity: validVisualizations.reduce((sum, v) => sum + v.metrics.density, 0) / validVisualizations.length,
        avgClusteringCoefficient: validVisualizations.reduce((sum, v) => sum + v.metrics.clusteringCoefficient, 0) / validVisualizations.length,
        networkSizes: validVisualizations.map(v => ({
          rootId: v.rootId,
          nodeCount: v.metrics.nodeCount,
          edgeCount: v.metrics.edgeCount,
          density: v.metrics.density
        }))
      };

      res.json({
        success: true,
        data: aggregatedStats
      });

    } catch (error) {
      req.app.locals.logger?.error('Error getting network stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get network statistics',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
}

module.exports = new RelatedContentController();