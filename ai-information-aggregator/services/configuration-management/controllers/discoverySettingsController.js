const DiscoverySettings = require('../models/DiscoverySettings');
const createLogger = require('../../../common/utils/logger');
const logger = createLogger('discovery-settings-controller');

class DiscoverySettingsController {
  // Get discovery settings for a user
  async getSettings(req, res) {
    try {
      const { userId } = req.params;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      const settings = await DiscoverySettings.getOrCreateForUser(userId);
      
      res.json({
        success: true,
        data: settings
      });
    } catch (error) {
      logger.error('Error getting discovery settings:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get discovery settings'
      });
    }
  }

  // Update discovery settings
  async updateSettings(req, res) {
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
        'aggressivenessLevel',
        'autoInclusionThreshold',
        'manualReviewThreshold',
        'sourceDiscoverySettings',
        'contentTypeThresholds',
        'topicSensitivity',
        'temporalSettings',
        'qualityFilters'
      ];
      
      const filteredUpdates = {};
      for (const field of allowedFields) {
        if (updates[field] !== undefined) {
          filteredUpdates[field] = updates[field];
        }
      }

      const settings = await DiscoverySettings.findOneAndUpdate(
        { userId },
        filteredUpdates,
        { new: true, upsert: true, runValidators: true }
      );

      res.json({
        success: true,
        data: settings,
        message: 'Discovery settings updated successfully'
      });
    } catch (error) {
      logger.error('Error updating discovery settings:', error);
      
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid settings data',
          errors: Object.values(error.errors).map(err => err.message)
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to update discovery settings'
      });
    }
  }

  // Update aggressiveness level and auto-adjust other settings
  async updateAggressivenessLevel(req, res) {
    try {
      const { userId } = req.params;
      const { aggressivenessLevel } = req.body;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      if (typeof aggressivenessLevel !== 'number' || aggressivenessLevel < 0 || aggressivenessLevel > 1) {
        return res.status(400).json({
          success: false,
          message: 'Aggressiveness level must be a number between 0 and 1'
        });
      }

      const settings = await DiscoverySettings.getOrCreateForUser(userId);
      settings.updateFromAggressivenessLevel(aggressivenessLevel);
      await settings.save();

      res.json({
        success: true,
        data: settings,
        message: 'Aggressiveness level updated successfully'
      });
    } catch (error) {
      logger.error('Error updating aggressiveness level:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update aggressiveness level'
      });
    }
  }

  // Get discovery configuration for external services
  async getDiscoveryConfig(req, res) {
    try {
      const { userId } = req.params;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      const settings = await DiscoverySettings.getOrCreateForUser(userId);
      const config = settings.getDiscoveryConfig();

      res.json({
        success: true,
        data: config
      });
    } catch (error) {
      logger.error('Error getting discovery config:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get discovery config'
      });
    }
  }

  // Calculate effective threshold for specific content
  async calculateThreshold(req, res) {
    try {
      const { userId } = req.params;
      const { contentType, context = {} } = req.body;
      
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

      const settings = await DiscoverySettings.getOrCreateForUser(userId);
      const effectiveThreshold = settings.calculateEffectiveThreshold(contentType, context);

      res.json({
        success: true,
        data: {
          contentType,
          context,
          effectiveThreshold,
          baseThreshold: settings.contentTypeThresholds[contentType] || settings.autoInclusionThreshold,
          aggressivenessLevel: settings.aggressivenessLevel
        }
      });
    } catch (error) {
      logger.error('Error calculating threshold:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to calculate threshold'
      });
    }
  }

  // Evaluate content for auto-inclusion
  async evaluateContent(req, res) {
    try {
      const { userId } = req.params;
      const { content, relevanceScore, context = {} } = req.body;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      if (!content || typeof relevanceScore !== 'number') {
        return res.status(400).json({
          success: false,
          message: 'Content object and relevance score are required'
        });
      }

      const settings = await DiscoverySettings.getOrCreateForUser(userId);
      const shouldAutoInclude = settings.shouldAutoInclude(content, relevanceScore, context);
      const shouldQueueForReview = settings.shouldQueueForReview(content, relevanceScore, context);
      const effectiveThreshold = settings.calculateEffectiveThreshold(content.type, context);

      res.json({
        success: true,
        data: {
          shouldAutoInclude,
          shouldQueueForReview,
          shouldReject: !shouldAutoInclude && !shouldQueueForReview,
          effectiveThreshold,
          relevanceScore,
          content: {
            type: content.type,
            title: content.title || 'Unknown'
          },
          context
        }
      });
    } catch (error) {
      logger.error('Error evaluating content:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to evaluate content'
      });
    }
  }

  // Reset settings to defaults
  async resetSettings(req, res) {
    try {
      const { userId } = req.params;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      await DiscoverySettings.findOneAndDelete({ userId });
      const newSettings = await DiscoverySettings.getOrCreateForUser(userId);

      res.json({
        success: true,
        data: newSettings,
        message: 'Discovery settings reset to defaults'
      });
    } catch (error) {
      logger.error('Error resetting discovery settings:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reset discovery settings'
      });
    }
  }

  // Get preset configurations for different aggressiveness levels
  async getPresets(req, res) {
    try {
      const presets = {
        conservative: {
          aggressivenessLevel: 0.2,
          description: 'Only include highly relevant content with strong confidence',
          autoInclusionThreshold: 0.8,
          manualReviewThreshold: 0.6,
          maxDiscoveryDepth: 1
        },
        moderate: {
          aggressivenessLevel: 0.5,
          description: 'Balanced approach with moderate content discovery',
          autoInclusionThreshold: 0.7,
          manualReviewThreshold: 0.4,
          maxDiscoveryDepth: 2
        },
        aggressive: {
          aggressivenessLevel: 0.8,
          description: 'Discover more content with lower confidence thresholds',
          autoInclusionThreshold: 0.5,
          manualReviewThreshold: 0.2,
          maxDiscoveryDepth: 3
        }
      };

      res.json({
        success: true,
        data: presets
      });
    } catch (error) {
      logger.error('Error getting presets:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get presets'
      });
    }
  }

  // Apply a preset configuration
  async applyPreset(req, res) {
    try {
      const { userId } = req.params;
      const { preset } = req.body;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      const validPresets = ['conservative', 'moderate', 'aggressive'];
      if (!validPresets.includes(preset)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid preset. Must be one of: ' + validPresets.join(', ')
        });
      }

      const settings = await DiscoverySettings.getOrCreateForUser(userId);
      
      // Apply preset values
      switch (preset) {
        case 'conservative':
          settings.updateFromAggressivenessLevel(0.2);
          break;
        case 'moderate':
          settings.updateFromAggressivenessLevel(0.5);
          break;
        case 'aggressive':
          settings.updateFromAggressivenessLevel(0.8);
          break;
      }
      
      await settings.save();

      res.json({
        success: true,
        data: settings,
        message: `${preset.charAt(0).toUpperCase() + preset.slice(1)} preset applied successfully`
      });
    } catch (error) {
      logger.error('Error applying preset:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to apply preset'
      });
    }
  }
}

module.exports = new DiscoverySettingsController();