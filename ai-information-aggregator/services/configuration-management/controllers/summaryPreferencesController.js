const SummaryPreferences = require('../models/SummaryPreferences');
const createLogger = require('../../../common/utils/logger');
const logger = createLogger('summary-preferences-controller');

class SummaryPreferencesController {
  // Get summary preferences for a user
  async getPreferences(req, res) {
    try {
      const { userId } = req.params;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      const preferences = await SummaryPreferences.getOrCreateForUser(userId);
      
      res.json({
        success: true,
        data: preferences
      });
    } catch (error) {
      logger.error('Error getting summary preferences:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get summary preferences'
      });
    }
  }

  // Update summary preferences
  async updatePreferences(req, res) {
    try {
      const { userId } = req.params;
      const updates = req.body;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      // Validate updates
      const allowedFields = [
        'defaultLength',
        'contentTypePreferences',
        'lengthParameters',
        'adaptiveSettings'
      ];
      
      const filteredUpdates = {};
      for (const field of allowedFields) {
        if (updates[field] !== undefined) {
          filteredUpdates[field] = updates[field];
        }
      }

      const preferences = await SummaryPreferences.findOneAndUpdate(
        { userId },
        filteredUpdates,
        { new: true, upsert: true, runValidators: true }
      );

      // Validate the configuration
      const validationErrors = preferences.validateConfiguration();
      if (validationErrors.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid configuration',
          errors: validationErrors
        });
      }

      res.json({
        success: true,
        data: preferences,
        message: 'Summary preferences updated successfully'
      });
    } catch (error) {
      logger.error('Error updating summary preferences:', error);
      
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid preferences data',
          errors: Object.values(error.errors).map(err => err.message)
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to update summary preferences'
      });
    }
  }

  // Get summary parameters for specific content type
  async getSummaryParameters(req, res) {
    try {
      const { userId } = req.params;
      const { contentType, overrideLength } = req.query;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      if (!contentType) {
        return res.status(400).json({
          success: false,
          message: 'Content type is required'
        });
      }

      const validContentTypes = ['article', 'paper', 'podcast', 'video', 'social'];
      if (!validContentTypes.includes(contentType)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid content type'
        });
      }

      const preferences = await SummaryPreferences.getOrCreateForUser(userId);
      const parameters = preferences.getSummaryParameters(contentType, overrideLength);

      res.json({
        success: true,
        data: {
          contentType,
          parameters,
          overrideLength: overrideLength || null
        }
      });
    } catch (error) {
      logger.error('Error getting summary parameters:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get summary parameters'
      });
    }
  }

  // Calculate adaptive summary length
  async getAdaptiveLength(req, res) {
    try {
      const { userId } = req.params;
      const { contentType, userContext } = req.body;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      if (!contentType) {
        return res.status(400).json({
          success: false,
          message: 'Content type is required'
        });
      }

      const validContentTypes = ['article', 'paper', 'podcast', 'video', 'social'];
      if (!validContentTypes.includes(contentType)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid content type'
        });
      }

      const preferences = await SummaryPreferences.getOrCreateForUser(userId);
      const adaptiveLength = preferences.calculateAdaptiveLength(contentType, userContext || {});
      const parameters = preferences.getSummaryParameters(contentType, adaptiveLength);

      res.json({
        success: true,
        data: {
          contentType,
          adaptiveLength,
          parameters,
          adaptiveSettings: preferences.adaptiveSettings,
          userBehaviorMetrics: preferences.userBehaviorMetrics,
          userContext: userContext || {}
        }
      });
    } catch (error) {
      logger.error('Error calculating adaptive length:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to calculate adaptive length'
      });
    }
  }

  // Update user behavior metrics
  async updateBehaviorMetrics(req, res) {
    try {
      const { userId } = req.params;
      const { averageReadingSpeed, preferredSummaryLength, engagementWithSummaries } = req.body;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      const preferences = await SummaryPreferences.getOrCreateForUser(userId);
      preferences.updateBehaviorMetrics({
        averageReadingSpeed,
        preferredSummaryLength,
        engagementWithSummaries
      });
      
      await preferences.save();

      res.json({
        success: true,
        data: preferences,
        message: 'User behavior metrics updated successfully'
      });
    } catch (error) {
      logger.error('Error updating behavior metrics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update behavior metrics'
      });
    }
  }

  // Update content type preferences
  async updateContentTypePreferences(req, res) {
    try {
      const { userId } = req.params;
      const { contentType, preferences: contentPrefs } = req.body;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      if (!contentType) {
        return res.status(400).json({
          success: false,
          message: 'Content type is required'
        });
      }

      const validContentTypes = ['article', 'paper', 'podcast', 'video', 'social'];
      if (!validContentTypes.includes(contentType)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid content type'
        });
      }

      const preferences = await SummaryPreferences.getOrCreateForUser(userId);
      
      // Update the specific content type preferences
      if (!preferences.contentTypePreferences) {
        preferences.contentTypePreferences = {};
      }
      if (!preferences.contentTypePreferences[contentType]) {
        preferences.contentTypePreferences[contentType] = {};
      }
      
      Object.assign(preferences.contentTypePreferences[contentType], contentPrefs);
      preferences.markModified('contentTypePreferences');
      
      await preferences.save();

      res.json({
        success: true,
        data: preferences,
        message: `${contentType} preferences updated successfully`
      });
    } catch (error) {
      logger.error('Error updating content type preferences:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update content type preferences'
      });
    }
  }

  // Update length parameters
  async updateLengthParameters(req, res) {
    try {
      const { userId } = req.params;
      const { lengthType, parameters } = req.body;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      if (!lengthType) {
        return res.status(400).json({
          success: false,
          message: 'Length type is required'
        });
      }

      const validLengthTypes = ['brief', 'standard', 'detailed', 'comprehensive'];
      if (!validLengthTypes.includes(lengthType)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid length type'
        });
      }

      const preferences = await SummaryPreferences.getOrCreateForUser(userId);
      
      // Update the specific length parameters
      if (!preferences.lengthParameters[lengthType]) {
        preferences.lengthParameters[lengthType] = {};
      }
      
      Object.assign(preferences.lengthParameters[lengthType], parameters);
      preferences.markModified('lengthParameters');
      
      // Validate the configuration
      const validationErrors = preferences.validateConfiguration();
      if (validationErrors.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid length parameters',
          errors: validationErrors
        });
      }
      
      await preferences.save();

      res.json({
        success: true,
        data: preferences,
        message: `${lengthType} length parameters updated successfully`
      });
    } catch (error) {
      logger.error('Error updating length parameters:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update length parameters'
      });
    }
  }

  // Reset preferences to defaults
  async resetPreferences(req, res) {
    try {
      const { userId } = req.params;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      await SummaryPreferences.findOneAndDelete({ userId });
      const newPreferences = await SummaryPreferences.getOrCreateForUser(userId);

      res.json({
        success: true,
        data: newPreferences,
        message: 'Summary preferences reset to defaults'
      });
    } catch (error) {
      logger.error('Error resetting summary preferences:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reset summary preferences'
      });
    }
  }

  // Get available length types and their descriptions
  async getLengthTypes(req, res) {
    try {
      const lengthTypes = {
        brief: {
          name: 'Brief',
          description: 'Quick overview with key points only',
          defaultMaxWords: 50,
          defaultMaxSentences: 3,
          recommendedFor: ['social', 'quick updates']
        },
        standard: {
          name: 'Standard',
          description: 'Balanced summary with main points and context',
          defaultMaxWords: 150,
          defaultMaxSentences: 8,
          recommendedFor: ['article', 'general content']
        },
        detailed: {
          name: 'Detailed',
          description: 'Comprehensive summary with analysis and insights',
          defaultMaxWords: 300,
          defaultMaxSentences: 15,
          recommendedFor: ['paper', 'research content']
        },
        comprehensive: {
          name: 'Comprehensive',
          description: 'Full analysis with methodology, results, and implications',
          defaultMaxWords: 500,
          defaultMaxSentences: 25,
          recommendedFor: ['academic papers', 'in-depth analysis']
        }
      };

      res.json({
        success: true,
        data: lengthTypes
      });
    } catch (error) {
      logger.error('Error getting length types:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get length types'
      });
    }
  }
}

module.exports = new SummaryPreferencesController();