const NotificationSettings = require('../models/NotificationSettings');

class NotificationController {
  /**
   * Get notification settings for a user
   */
  async getNotificationSettings(req, res) {
    try {
      const { userId } = req.params;
      const logger = req.app.locals.logger;

      logger.info(`Fetching notification settings for user: ${userId}`);

      let settings = await NotificationSettings.findOne({ userId });

      // If no settings exist, create default settings
      if (!settings) {
        const defaultSettings = NotificationSettings.getDefaultSettings(userId);
        settings = new NotificationSettings(defaultSettings);
        await settings.save();
        logger.info(`Created default notification settings for user: ${userId}`);
      }

      res.status(200).json({
        success: true,
        data: settings.allSettings
      });
    } catch (error) {
      const logger = req.app.locals.logger;
      logger.error('Error fetching notification settings:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch notification settings',
        error: error.message
      });
    }
  }

  /**
   * Update notification settings for a user
   */
  async updateNotificationSettings(req, res) {
    try {
      const { userId } = req.params;
      const updates = req.body;
      const logger = req.app.locals.logger;

      logger.info(`Updating notification settings for user: ${userId}`);

      // Validate the update data
      const validationError = this.validateNotificationSettings(updates);
      if (validationError) {
        return res.status(400).json({
          success: false,
          message: 'Invalid notification settings',
          error: validationError
        });
      }

      let settings = await NotificationSettings.findOne({ userId });

      if (!settings) {
        // Create new settings if they don't exist
        const defaultSettings = NotificationSettings.getDefaultSettings(userId);
        settings = new NotificationSettings({ ...defaultSettings, ...updates });
      } else {
        // Update existing settings
        if (updates.channels) {
          settings.channels = { ...settings.channels, ...updates.channels };
        }
        if (updates.contentTypes) {
          settings.contentTypes = { ...settings.contentTypes, ...updates.contentTypes };
        }
        if (updates.quietHours) {
          settings.quietHours = { ...settings.quietHours, ...updates.quietHours };
        }
      }

      await settings.save();

      logger.info(`Updated notification settings for user: ${userId}`);

      res.status(200).json({
        success: true,
        message: 'Notification settings updated successfully',
        data: settings.allSettings
      });
    } catch (error) {
      const logger = req.app.locals.logger;
      logger.error('Error updating notification settings:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update notification settings',
        error: error.message
      });
    }
  }

  /**
   * Update specific channel settings
   */
  async updateChannelSettings(req, res) {
    try {
      const { userId, channel } = req.params;
      const updates = req.body;
      const logger = req.app.locals.logger;

      logger.info(`Updating ${channel} channel settings for user: ${userId}`);

      // Validate channel
      const validChannels = ['email', 'push', 'digest'];
      if (!validChannels.includes(channel)) {
        return res.status(400).json({
          success: false,
          message: `Invalid channel. Must be one of: ${validChannels.join(', ')}`
        });
      }

      let settings = await NotificationSettings.findOne({ userId });

      if (!settings) {
        const defaultSettings = NotificationSettings.getDefaultSettings(userId);
        settings = new NotificationSettings(defaultSettings);
      }

      // Update the specific channel
      settings.channels[channel] = { ...settings.channels[channel], ...updates };

      await settings.save();

      logger.info(`Updated ${channel} channel settings for user: ${userId}`);

      res.status(200).json({
        success: true,
        message: `${channel} channel settings updated successfully`,
        data: settings.channels[channel]
      });
    } catch (error) {
      const logger = req.app.locals.logger;
      logger.error('Error updating channel settings:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update channel settings',
        error: error.message
      });
    }
  }

  /**
   * Check if notifications are currently allowed for a user
   */
  async checkNotificationStatus(req, res) {
    try {
      const { userId } = req.params;
      const { channel, currentTime, timezone } = req.query;
      const logger = req.app.locals.logger;

      const settings = await NotificationSettings.findOne({ userId });

      if (!settings) {
        return res.status(404).json({
          success: false,
          message: 'Notification settings not found for user'
        });
      }

      const isAllowed = settings.isNotificationAllowed(currentTime, timezone);
      const channelFrequency = channel ? settings.getChannelFrequency(channel) : null;

      res.status(200).json({
        success: true,
        data: {
          notificationsAllowed: isAllowed,
          channelFrequency,
          quietHoursActive: settings.quietHours.enabled && !isAllowed
        }
      });
    } catch (error) {
      const logger = req.app.locals.logger;
      logger.error('Error checking notification status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to check notification status',
        error: error.message
      });
    }
  }

  /**
   * Reset notification settings to defaults
   */
  async resetNotificationSettings(req, res) {
    try {
      const { userId } = req.params;
      const logger = req.app.locals.logger;

      logger.info(`Resetting notification settings for user: ${userId}`);

      const defaultSettings = NotificationSettings.getDefaultSettings(userId);
      
      await NotificationSettings.findOneAndUpdate(
        { userId },
        defaultSettings,
        { upsert: true, new: true }
      );

      logger.info(`Reset notification settings for user: ${userId}`);

      res.status(200).json({
        success: true,
        message: 'Notification settings reset to defaults',
        data: defaultSettings
      });
    } catch (error) {
      const logger = req.app.locals.logger;
      logger.error('Error resetting notification settings:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reset notification settings',
        error: error.message
      });
    }
  }

  /**
   * Validate notification settings data
   */
  validateNotificationSettings(settings) {
    const validFrequencies = {
      email: ['immediate', 'hourly', 'daily', 'weekly', 'never'],
      push: ['immediate', 'hourly', 'daily', 'weekly', 'never'],
      digest: ['daily', 'weekly', 'monthly', 'never']
    };

    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;

    // Validate channels
    if (settings.channels) {
      for (const [channel, config] of Object.entries(settings.channels)) {
        if (!validFrequencies[channel]) {
          return `Invalid channel: ${channel}`;
        }

        if (config.frequency && !validFrequencies[channel].includes(config.frequency)) {
          return `Invalid frequency for ${channel}: ${config.frequency}`;
        }

        if (channel === 'digest' && config.time && !timeRegex.test(config.time)) {
          return 'Invalid time format for digest. Use HH:MM format';
        }
      }
    }

    // Validate quiet hours
    if (settings.quietHours) {
      if (settings.quietHours.start && !timeRegex.test(settings.quietHours.start)) {
        return 'Invalid start time format for quiet hours. Use HH:MM format';
      }
      if (settings.quietHours.end && !timeRegex.test(settings.quietHours.end)) {
        return 'Invalid end time format for quiet hours. Use HH:MM format';
      }
    }

    return null;
  }
}

module.exports = new NotificationController();