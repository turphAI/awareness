const TopicPreference = require('../models/TopicPreference');
const { validationResult } = require('express-validator');

/**
 * Topic Preference Controller
 * Handles CRUD operations for user topic preferences
 */
class TopicPreferenceController {
  /**
   * Get all topic preferences for a user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getUserTopicPreferences(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const {
        category,
        priority,
        isActive,
        sortBy = 'weight',
        sortOrder = 'desc',
        limit,
        page = 1
      } = req.query;

      const options = {
        category,
        priority,
        isActive: isActive !== undefined ? isActive === 'true' : null,
        sortBy,
        sortOrder: sortOrder === 'desc' ? -1 : 1,
        limit: limit ? parseInt(limit) : null
      };

      let preferences = await TopicPreference.findByUser(userId, options);

      // Apply pagination if limit is specified
      if (limit) {
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const total = await TopicPreference.countDocuments({
          userId,
          ...(category && { category }),
          ...(priority && { priority }),
          ...(isActive !== undefined && { isActive: isActive === 'true' })
        });

        preferences = await TopicPreference.findByUser(userId, options)
          .skip(skip)
          .limit(parseInt(limit));

        return res.status(200).json({
          success: true,
          data: preferences,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
          }
        });
      }

      res.status(200).json({
        success: true,
        data: preferences
      });

    } catch (error) {
      req.app.locals.logger.error('Error fetching user topic preferences:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch topic preferences',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Get a specific topic preference
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getTopicPreference(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      const preference = await TopicPreference.findOne({ _id: id, userId });
      
      if (!preference) {
        return res.status(404).json({
          success: false,
          message: 'Topic preference not found'
        });
      }

      res.status(200).json({
        success: true,
        data: preference
      });

    } catch (error) {
      req.app.locals.logger.error('Error fetching topic preference:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch topic preference',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Create a new topic preference
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async createTopicPreference(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const {
        topic,
        category,
        priority = 'medium',
        weight = 0.5,
        keywords = [],
        excludeKeywords = [],
        isActive = true
      } = req.body;

      // Check if topic preference already exists for this user
      const existingPreference = await TopicPreference.findOne({ userId, topic });
      if (existingPreference) {
        return res.status(409).json({
          success: false,
          message: 'Topic preference already exists for this user'
        });
      }

      const preference = new TopicPreference({
        userId,
        topic,
        category,
        priority,
        weight,
        keywords: keywords.map(k => k.toLowerCase().trim()),
        excludeKeywords: excludeKeywords.map(k => k.toLowerCase().trim()),
        isActive,
        source: 'user-defined'
      });

      await preference.save();

      res.status(201).json({
        success: true,
        message: 'Topic preference created successfully',
        data: preference
      });

    } catch (error) {
      req.app.locals.logger.error('Error creating topic preference:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create topic preference',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Update a topic preference
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async updateTopicPreference(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { id } = req.params;
      const userId = req.user?.id;

      const preference = await TopicPreference.findOne({ _id: id, userId });
      if (!preference) {
        return res.status(404).json({
          success: false,
          message: 'Topic preference not found'
        });
      }

      const {
        topic,
        category,
        priority,
        weight,
        keywords,
        excludeKeywords,
        isActive
      } = req.body;

      // Update fields if provided
      if (topic !== undefined) preference.topic = topic;
      if (category !== undefined) preference.category = category;
      if (priority !== undefined) preference.priority = priority;
      if (weight !== undefined) preference.weight = weight;
      if (keywords !== undefined) preference.keywords = keywords.map(k => k.toLowerCase().trim());
      if (excludeKeywords !== undefined) preference.excludeKeywords = excludeKeywords.map(k => k.toLowerCase().trim());
      if (isActive !== undefined) preference.isActive = isActive;

      await preference.save();

      res.status(200).json({
        success: true,
        message: 'Topic preference updated successfully',
        data: preference
      });

    } catch (error) {
      req.app.locals.logger.error('Error updating topic preference:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update topic preference',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Delete a topic preference
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async deleteTopicPreference(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      const preference = await TopicPreference.findOneAndDelete({ _id: id, userId });
      if (!preference) {
        return res.status(404).json({
          success: false,
          message: 'Topic preference not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Topic preference deleted successfully'
      });

    } catch (error) {
      req.app.locals.logger.error('Error deleting topic preference:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete topic preference',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Toggle topic preference active status
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async toggleTopicPreference(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      const preference = await TopicPreference.findOne({ _id: id, userId });
      if (!preference) {
        return res.status(404).json({
          success: false,
          message: 'Topic preference not found'
        });
      }

      await preference.toggleActive();

      res.status(200).json({
        success: true,
        message: `Topic preference ${preference.isActive ? 'activated' : 'deactivated'} successfully`,
        data: preference
      });

    } catch (error) {
      req.app.locals.logger.error('Error toggling topic preference:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to toggle topic preference',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Add keyword to topic preference
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async addKeyword(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { id } = req.params;
      const { keyword } = req.body;
      const userId = req.user?.id;

      const preference = await TopicPreference.findOne({ _id: id, userId });
      if (!preference) {
        return res.status(404).json({
          success: false,
          message: 'Topic preference not found'
        });
      }

      await preference.addKeyword(keyword);

      res.status(200).json({
        success: true,
        message: 'Keyword added successfully',
        data: preference
      });

    } catch (error) {
      req.app.locals.logger.error('Error adding keyword:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add keyword',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Remove keyword from topic preference
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async removeKeyword(req, res) {
    try {
      const { id } = req.params;
      const { keyword } = req.body;
      const userId = req.user?.id;

      const preference = await TopicPreference.findOne({ _id: id, userId });
      if (!preference) {
        return res.status(404).json({
          success: false,
          message: 'Topic preference not found'
        });
      }

      await preference.removeKeyword(keyword);

      res.status(200).json({
        success: true,
        message: 'Keyword removed successfully',
        data: preference
      });

    } catch (error) {
      req.app.locals.logger.error('Error removing keyword:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to remove keyword',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Record feedback for topic preference
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async recordFeedback(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { id } = req.params;
      const { feedback } = req.body; // 'positive' or 'negative'
      const userId = req.user?.id;

      const preference = await TopicPreference.findOne({ _id: id, userId });
      if (!preference) {
        return res.status(404).json({
          success: false,
          message: 'Topic preference not found'
        });
      }

      if (feedback === 'positive') {
        await preference.addPositiveFeedback();
      } else if (feedback === 'negative') {
        await preference.addNegativeFeedback();
      } else {
        return res.status(400).json({
          success: false,
          message: 'Feedback must be either "positive" or "negative"'
        });
      }

      // Update weight based on new feedback
      await preference.updateWeight();

      res.status(200).json({
        success: true,
        message: 'Feedback recorded successfully',
        data: preference
      });

    } catch (error) {
      req.app.locals.logger.error('Error recording feedback:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to record feedback',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Get topic preference statistics for user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getUserStatistics(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const statistics = await TopicPreference.getUserStatistics(userId);

      res.status(200).json({
        success: true,
        data: statistics
      });

    } catch (error) {
      req.app.locals.logger.error('Error fetching user statistics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch statistics',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Get topic suggestions for user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getTopicSuggestions(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // For now, we'll use empty recent content array
      // In a real implementation, this would fetch recent user interactions
      const recentContent = [];
      
      const suggestions = await TopicPreference.suggestTopics(userId, recentContent);

      res.status(200).json({
        success: true,
        data: suggestions
      });

    } catch (error) {
      req.app.locals.logger.error('Error fetching topic suggestions:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch topic suggestions',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Search topic preferences
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async searchTopicPreferences(req, res) {
    try {
      const { keyword } = req.query;
      const userId = req.user?.id;

      if (!keyword) {
        return res.status(400).json({
          success: false,
          message: 'Search keyword is required'
        });
      }

      const preferences = await TopicPreference.searchByKeyword(userId, keyword);

      res.status(200).json({
        success: true,
        data: preferences
      });

    } catch (error) {
      req.app.locals.logger.error('Error searching topic preferences:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to search topic preferences',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Bulk update topic preferences
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async bulkUpdateTopicPreferences(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { updates } = req.body; // Array of { id, updates }
      const userId = req.user?.id;

      const results = [];
      const updateErrors = [];

      for (const update of updates) {
        try {
          const preference = await TopicPreference.findOne({ 
            _id: update.id, 
            userId 
          });

          if (!preference) {
            updateErrors.push({
              id: update.id,
              error: 'Topic preference not found'
            });
            continue;
          }

          // Apply updates
          Object.keys(update.updates).forEach(key => {
            if (key === 'keywords' || key === 'excludeKeywords') {
              preference[key] = update.updates[key].map(k => k.toLowerCase().trim());
            } else {
              preference[key] = update.updates[key];
            }
          });

          await preference.save();
          results.push(preference);

        } catch (error) {
          updateErrors.push({
            id: update.id,
            error: error.message
          });
        }
      }

      res.status(200).json({
        success: true,
        message: 'Bulk update completed',
        data: {
          updated: results,
          errors: updateErrors
        }
      });

    } catch (error) {
      req.app.locals.logger.error('Error in bulk update:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to perform bulk update',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
}

module.exports = new TopicPreferenceController();