const ContentVolumeSettings = require('../models/ContentVolumeSettings');
const createLogger = require('../../../common/utils/logger');
const logger = createLogger('content-volume-controller');

class ContentVolumeController {
  // Get content volume settings for a user
  async getSettings(req, res) {
    try {
      const { userId } = req.params;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      const settings = await ContentVolumeSettings.getOrCreateForUser(userId);
      
      res.json({
        success: true,
        data: settings
      });
    } catch (error) {
      logger.error('Error getting content volume settings:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get content volume settings'
      });
    }
  }

  // Update content volume settings
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
        'dailyLimit', 
        'priorityThreshold', 
        'adaptiveEnabled', 
        'contentTypeWeights'
      ];
      
      const filteredUpdates = {};
      for (const field of allowedFields) {
        if (updates[field] !== undefined) {
          filteredUpdates[field] = updates[field];
        }
      }

      const settings = await ContentVolumeSettings.findOneAndUpdate(
        { userId },
        filteredUpdates,
        { new: true, upsert: true, runValidators: true }
      );

      res.json({
        success: true,
        data: settings,
        message: 'Content volume settings updated successfully'
      });
    } catch (error) {
      logger.error('Error updating content volume settings:', error);
      
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid settings data',
          errors: Object.values(error.errors).map(err => err.message)
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to update content volume settings'
      });
    }
  }

  // Update user behavior metrics
  async updateBehaviorMetrics(req, res) {
    try {
      const { userId } = req.params;
      const { averageReadTime, completionRate, engagementScore } = req.body;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      const settings = await ContentVolumeSettings.getOrCreateForUser(userId);
      settings.updateBehaviorMetrics({
        averageReadTime,
        completionRate,
        engagementScore
      });
      
      await settings.save();

      res.json({
        success: true,
        data: settings,
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

  // Get adaptive daily limit for a user
  async getAdaptiveLimit(req, res) {
    try {
      const { userId } = req.params;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      const settings = await ContentVolumeSettings.getOrCreateForUser(userId);
      const adaptiveLimit = settings.calculateAdaptiveLimit();

      res.json({
        success: true,
        data: {
          baseLimit: settings.dailyLimit,
          adaptiveLimit,
          adaptiveEnabled: settings.adaptiveEnabled,
          behaviorMetrics: settings.userBehaviorMetrics
        }
      });
    } catch (error) {
      logger.error('Error getting adaptive limit:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get adaptive limit'
      });
    }
  }

  // Prioritize content based on volume settings
  async prioritizeContent(req, res) {
    try {
      const { userId } = req.params;
      const { contentList } = req.body;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      if (!Array.isArray(contentList)) {
        return res.status(400).json({
          success: false,
          message: 'Content list must be an array'
        });
      }

      const settings = await ContentVolumeSettings.getOrCreateForUser(userId);
      const prioritizedContent = settings.prioritizeContent(contentList);

      res.json({
        success: true,
        data: {
          prioritizedContent,
          totalOriginal: contentList.length,
          totalPrioritized: prioritizedContent.length,
          adaptiveLimit: settings.calculateAdaptiveLimit(),
          priorityThreshold: settings.priorityThreshold
        }
      });
    } catch (error) {
      logger.error('Error prioritizing content:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to prioritize content'
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

      await ContentVolumeSettings.findOneAndDelete({ userId });
      const newSettings = await ContentVolumeSettings.getOrCreateForUser(userId);

      res.json({
        success: true,
        data: newSettings,
        message: 'Content volume settings reset to defaults'
      });
    } catch (error) {
      logger.error('Error resetting content volume settings:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reset content volume settings'
      });
    }
  }
}

module.exports = new ContentVolumeController();