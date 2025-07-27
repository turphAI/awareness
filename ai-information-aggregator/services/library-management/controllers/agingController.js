const ContentAgingManager = require('../utils/contentAgingManager');
const logger = require('../../../common/utils/logger');

/**
 * Content Aging Controller
 * Handles HTTP requests for content aging management
 */
class AgingController {
  constructor() {
    this.contentAgingManager = new ContentAgingManager();
  }

  /**
   * Identify outdated content
   * GET /aging/outdated
   */
  async identifyOutdatedContent(req, res) {
    try {
      const {
        limit = 100,
        contentType,
        domain,
        forceRecheck = false
      } = req.query;

      logger.info('Identifying outdated content', {
        limit: parseInt(limit),
        contentType,
        domain,
        forceRecheck: forceRecheck === 'true'
      });

      const options = {
        limit: parseInt(limit),
        forceRecheck: forceRecheck === 'true'
      };

      if (contentType) {
        options.contentType = contentType;
      }

      if (domain) {
        options.domain = domain;
      }

      const outdatedContent = await this.contentAgingManager.identifyOutdatedContent(options);

      res.status(200).json({
        success: true,
        data: {
          outdatedContent,
          count: outdatedContent.length,
          options
        }
      });
    } catch (error) {
      logger.error('Error identifying outdated content', {
        error: error.message,
        stack: error.stack
      });

      res.status(500).json({
        success: false,
        error: 'Failed to identify outdated content',
        message: error.message
      });
    }
  }

  /**
   * Get content due for review
   * GET /aging/due-for-review
   */
  async getContentDueForReview(req, res) {
    try {
      const {
        limit = 50,
        beforeDate
      } = req.query;

      logger.info('Getting content due for review', {
        limit: parseInt(limit),
        beforeDate
      });

      const options = {
        limit: parseInt(limit)
      };

      if (beforeDate) {
        options.beforeDate = new Date(beforeDate);
      }

      const contentDueForReview = await this.contentAgingManager.getContentDueForReview(options);

      res.status(200).json({
        success: true,
        data: {
          contentDueForReview,
          count: contentDueForReview.length,
          options
        }
      });
    } catch (error) {
      logger.error('Error getting content due for review', {
        error: error.message,
        stack: error.stack
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get content due for review',
        message: error.message
      });
    }
  }

  /**
   * Assess specific content aging
   * GET /aging/assess/:contentId
   */
  async assessContentAging(req, res) {
    try {
      const { contentId } = req.params;

      logger.info('Assessing content aging', { contentId });

      // First get the content metadata
      const ContentMetadata = require('../models/ContentMetadata');
      const contentMetadata = await ContentMetadata.findOne({ contentId });

      if (!contentMetadata) {
        return res.status(404).json({
          success: false,
          error: 'Content metadata not found'
        });
      }

      const assessment = await this.contentAgingManager.assessContentAging(contentMetadata);

      res.status(200).json({
        success: true,
        data: {
          contentId,
          assessment
        }
      });
    } catch (error) {
      logger.error('Error assessing content aging', {
        contentId: req.params.contentId,
        error: error.message,
        stack: error.stack
      });

      res.status(500).json({
        success: false,
        error: 'Failed to assess content aging',
        message: error.message
      });
    }
  }

  /**
   * Mark content as reviewed
   * PUT /aging/review/:contentId
   */
  async markContentReviewed(req, res) {
    try {
      const { contentId } = req.params;
      const {
        isUpToDate = true,
        reasons = [],
        suggestions = [],
        nextReviewDate
      } = req.body;

      logger.info('Marking content as reviewed', {
        contentId,
        isUpToDate,
        reasons,
        suggestions
      });

      const reviewData = {
        isUpToDate,
        reasons,
        suggestions
      };

      if (nextReviewDate) {
        reviewData.nextReviewDate = new Date(nextReviewDate);
      }

      const updatedContent = await this.contentAgingManager.markContentReviewed(
        contentId,
        reviewData
      );

      res.status(200).json({
        success: true,
        data: {
          contentId,
          aging: updatedContent.aging,
          message: isUpToDate ? 'Content marked as up-to-date' : 'Content marked as outdated'
        }
      });
    } catch (error) {
      logger.error('Error marking content as reviewed', {
        contentId: req.params.contentId,
        error: error.message,
        stack: error.stack
      });

      if (error.message === 'Content metadata not found') {
        return res.status(404).json({
          success: false,
          error: 'Content metadata not found'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to mark content as reviewed',
        message: error.message
      });
    }
  }

  /**
   * Generate update suggestions for content
   * GET /aging/suggestions/:contentId
   */
  async generateUpdateSuggestions(req, res) {
    try {
      const { contentId } = req.params;

      logger.info('Generating update suggestions', { contentId });

      // First get the content metadata
      const ContentMetadata = require('../models/ContentMetadata');
      const contentMetadata = await ContentMetadata.findOne({ contentId });

      if (!contentMetadata) {
        return res.status(404).json({
          success: false,
          error: 'Content metadata not found'
        });
      }

      const suggestions = this.contentAgingManager.generateUpdateSuggestions(contentMetadata);

      res.status(200).json({
        success: true,
        data: {
          contentId,
          title: contentMetadata.title,
          contentType: contentMetadata.contentType,
          publishedAt: contentMetadata.publishedAt,
          suggestions
        }
      });
    } catch (error) {
      logger.error('Error generating update suggestions', {
        contentId: req.params.contentId,
        error: error.message,
        stack: error.stack
      });

      res.status(500).json({
        success: false,
        error: 'Failed to generate update suggestions',
        message: error.message
      });
    }
  }

  /**
   * Get aging statistics
   * GET /aging/statistics
   */
  async getAgingStatistics(req, res) {
    try {
      logger.info('Getting aging statistics');

      const statistics = await this.contentAgingManager.getAgingStatistics();

      res.status(200).json({
        success: true,
        data: statistics
      });
    } catch (error) {
      logger.error('Error getting aging statistics', {
        error: error.message,
        stack: error.stack
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get aging statistics',
        message: error.message
      });
    }
  }

  /**
   * Run aging analysis (batch operation)
   * POST /aging/analyze
   */
  async runAgingAnalysis(req, res) {
    try {
      const {
        limit = 100,
        contentType,
        domain,
        forceRecheck = false
      } = req.body;

      logger.info('Running aging analysis', {
        limit,
        contentType,
        domain,
        forceRecheck
      });

      const options = {
        limit,
        forceRecheck
      };

      if (contentType) {
        options.contentType = contentType;
      }

      if (domain) {
        options.domain = domain;
      }

      // Run the analysis
      const outdatedContent = await this.contentAgingManager.identifyOutdatedContent(options);
      const contentDueForReview = await this.contentAgingManager.getContentDueForReview({
        limit: 50
      });
      const statistics = await this.contentAgingManager.getAgingStatistics();

      res.status(200).json({
        success: true,
        data: {
          analysis: {
            outdatedContent: {
              items: outdatedContent,
              count: outdatedContent.length
            },
            dueForReview: {
              items: contentDueForReview,
              count: contentDueForReview.length
            },
            statistics
          },
          message: 'Aging analysis completed successfully'
        }
      });
    } catch (error) {
      logger.error('Error running aging analysis', {
        error: error.message,
        stack: error.stack
      });

      res.status(500).json({
        success: false,
        error: 'Failed to run aging analysis',
        message: error.message
      });
    }
  }
}

module.exports = AgingController;