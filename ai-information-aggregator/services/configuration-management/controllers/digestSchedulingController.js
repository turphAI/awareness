const DigestScheduling = require('../models/DigestScheduling');
const DigestGenerator = require('../utils/digestGenerator');
const DigestDelivery = require('../utils/digestDelivery');
const createLogger = require('../../../common/utils/logger');
const logger = createLogger('digest-scheduling-controller');

class DigestSchedulingController {
  constructor() {
    this.digestGenerator = new DigestGenerator();
    this.digestDelivery = new DigestDelivery();
  }
  // Get digest scheduling settings for a user
  async getScheduling(req, res) {
    try {
      const { userId } = req.params;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      const scheduling = await DigestScheduling.getOrCreateForUser(userId);
      
      res.json({
        success: true,
        data: scheduling
      });
    } catch (error) {
      logger.error('Error getting digest scheduling:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get digest scheduling'
      });
    }
  }

  // Update digest scheduling settings
  async updateScheduling(req, res) {
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
        'enabled',
        'frequency',
        'deliveryTime',
        'weeklySettings',
        'monthlySettings',
        'contentSelection',
        'formatting',
        'deliveryMethod'
      ];
      
      const filteredUpdates = {};
      for (const field of allowedFields) {
        if (updates[field] !== undefined) {
          filteredUpdates[field] = updates[field];
        }
      }

      let scheduling = await DigestScheduling.getOrCreateForUser(userId);
      
      // Apply updates with proper handling of nested objects
      for (const field of allowedFields) {
        if (filteredUpdates[field] !== undefined) {
          if (field === 'deliveryTime') {
            Object.assign(scheduling.deliveryTime, filteredUpdates[field]);
          } else if (field === 'weeklySettings') {
            Object.assign(scheduling.weeklySettings, filteredUpdates[field]);
          } else if (field === 'monthlySettings') {
            Object.assign(scheduling.monthlySettings, filteredUpdates[field]);
          } else if (field === 'contentSelection') {
            Object.assign(scheduling.contentSelection, filteredUpdates[field]);
          } else if (field === 'formatting') {
            Object.assign(scheduling.formatting, filteredUpdates[field]);
          } else if (field === 'deliveryMethod') {
            Object.assign(scheduling.deliveryMethod, filteredUpdates[field]);
          } else {
            scheduling[field] = filteredUpdates[field];
          }
        }
      }

      // Update next delivery time after changes
      scheduling.updateNextDelivery();

      // Validate the configuration before saving
      const validationErrors = scheduling.validateConfiguration();
      if (validationErrors.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid configuration',
          errors: validationErrors
        });
      }

      await scheduling.save();

      res.json({
        success: true,
        data: scheduling,
        message: 'Digest scheduling updated successfully'
      });
    } catch (error) {
      logger.error('Error updating digest scheduling:', error);
      
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid scheduling data',
          errors: Object.values(error.errors).map(err => err.message)
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to update digest scheduling'
      });
    }
  }

  // Enable or disable digest scheduling
  async toggleScheduling(req, res) {
    try {
      const { userId } = req.params;
      const { enabled } = req.body;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      if (typeof enabled !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: 'Enabled must be a boolean value'
        });
      }

      const scheduling = await DigestScheduling.getOrCreateForUser(userId);
      scheduling.enabled = enabled;
      
      if (enabled) {
        scheduling.updateNextDelivery();
      } else {
        scheduling.nextDelivery = null;
      }
      
      await scheduling.save();

      res.json({
        success: true,
        data: scheduling,
        message: `Digest scheduling ${enabled ? 'enabled' : 'disabled'} successfully`
      });
    } catch (error) {
      logger.error('Error toggling digest scheduling:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to toggle digest scheduling'
      });
    }
  }

  // Update delivery frequency
  async updateFrequency(req, res) {
    try {
      const { userId } = req.params;
      const { frequency, weeklySettings, monthlySettings } = req.body;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      if (!frequency) {
        return res.status(400).json({
          success: false,
          message: 'Frequency is required'
        });
      }

      const validFrequencies = ['daily', 'weekly', 'bi-weekly', 'monthly'];
      if (!validFrequencies.includes(frequency)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid frequency'
        });
      }

      const scheduling = await DigestScheduling.getOrCreateForUser(userId);
      scheduling.frequency = frequency;
      
      if (weeklySettings && (frequency === 'weekly' || frequency === 'bi-weekly')) {
        Object.assign(scheduling.weeklySettings, weeklySettings);
      }
      
      if (monthlySettings && frequency === 'monthly') {
        Object.assign(scheduling.monthlySettings, monthlySettings);
      }
      
      // Update next delivery time after frequency change
      scheduling.updateNextDelivery();
      
      // Validate the configuration
      const validationErrors = scheduling.validateConfiguration();
      if (validationErrors.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid frequency configuration',
          errors: validationErrors
        });
      }
      
      await scheduling.save();

      res.json({
        success: true,
        data: scheduling,
        message: 'Delivery frequency updated successfully'
      });
    } catch (error) {
      logger.error('Error updating delivery frequency:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update delivery frequency'
      });
    }
  }

  // Update delivery time
  async updateDeliveryTime(req, res) {
    try {
      const { userId } = req.params;
      const { hour, minute, timezone } = req.body;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      const scheduling = await DigestScheduling.getOrCreateForUser(userId);
      
      if (hour !== undefined) {
        if (hour < 0 || hour > 23) {
          return res.status(400).json({
            success: false,
            message: 'Hour must be between 0 and 23'
          });
        }
        scheduling.deliveryTime.hour = hour;
      }
      
      if (minute !== undefined) {
        if (minute < 0 || minute > 59) {
          return res.status(400).json({
            success: false,
            message: 'Minute must be between 0 and 59'
          });
        }
        scheduling.deliveryTime.minute = minute;
      }
      
      if (timezone !== undefined) {
        scheduling.deliveryTime.timezone = timezone;
      }
      
      // Update next delivery time after time change
      scheduling.updateNextDelivery();
      await scheduling.save();

      res.json({
        success: true,
        data: scheduling,
        message: 'Delivery time updated successfully'
      });
    } catch (error) {
      logger.error('Error updating delivery time:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update delivery time'
      });
    }
  }

  // Update content selection criteria
  async updateContentSelection(req, res) {
    try {
      const { userId } = req.params;
      const updates = req.body;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      const scheduling = await DigestScheduling.getOrCreateForUser(userId);
      
      // Update content selection fields
      const allowedFields = [
        'maxItems',
        'prioritizeBreakingNews',
        'includePersonalizedContent',
        'contentTypes',
        'topicFilters',
        'sourceFilters'
      ];
      
      for (const field of allowedFields) {
        if (updates[field] !== undefined) {
          if (field === 'contentTypes') {
            Object.assign(scheduling.contentSelection.contentTypes, updates[field]);
          } else {
            scheduling.contentSelection[field] = updates[field];
          }
        }
      }
      
      scheduling.markModified('contentSelection');
      
      // Validate the configuration
      const validationErrors = scheduling.validateConfiguration();
      if (validationErrors.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid content selection configuration',
          errors: validationErrors
        });
      }
      
      await scheduling.save();

      res.json({
        success: true,
        data: scheduling,
        message: 'Content selection updated successfully'
      });
    } catch (error) {
      logger.error('Error updating content selection:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update content selection'
      });
    }
  }

  // Update formatting preferences
  async updateFormatting(req, res) {
    try {
      const { userId } = req.params;
      const updates = req.body;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      const scheduling = await DigestScheduling.getOrCreateForUser(userId);
      
      // Update formatting fields
      const allowedFields = [
        'includeFullSummaries',
        'includeThumbnails',
        'includeReadingTime',
        'groupByTopic',
        'sortBy'
      ];
      
      for (const field of allowedFields) {
        if (updates[field] !== undefined) {
          scheduling.formatting[field] = updates[field];
        }
      }
      
      scheduling.markModified('formatting');
      await scheduling.save();

      res.json({
        success: true,
        data: scheduling,
        message: 'Formatting preferences updated successfully'
      });
    } catch (error) {
      logger.error('Error updating formatting preferences:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update formatting preferences'
      });
    }
  }

  // Update delivery method settings
  async updateDeliveryMethod(req, res) {
    try {
      const { userId } = req.params;
      const { email, inApp } = req.body;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      const scheduling = await DigestScheduling.getOrCreateForUser(userId);
      
      if (email !== undefined) {
        scheduling.deliveryMethod.email = { ...scheduling.deliveryMethod.email, ...email };
      }
      
      if (inApp !== undefined) {
        scheduling.deliveryMethod.inApp = { ...scheduling.deliveryMethod.inApp, ...inApp };
      }
      
      scheduling.markModified('deliveryMethod');
      
      // Validate the configuration
      const validationErrors = scheduling.validateConfiguration();
      if (validationErrors.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid delivery method configuration',
          errors: validationErrors
        });
      }
      
      await scheduling.save();

      res.json({
        success: true,
        data: scheduling,
        message: 'Delivery method updated successfully'
      });
    } catch (error) {
      logger.error('Error updating delivery method:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update delivery method'
      });
    }
  }

  // Get next delivery time
  async getNextDelivery(req, res) {
    try {
      const { userId } = req.params;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      const scheduling = await DigestScheduling.getOrCreateForUser(userId);
      const nextDelivery = scheduling.calculateNextDelivery();

      res.json({
        success: true,
        data: {
          nextDelivery,
          enabled: scheduling.enabled,
          frequency: scheduling.frequency,
          deliveryTime: scheduling.deliveryTime
        }
      });
    } catch (error) {
      logger.error('Error getting next delivery time:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get next delivery time'
      });
    }
  }

  // Mark delivery as completed (internal use)
  async markDeliveryCompleted(req, res) {
    try {
      const { userId } = req.params;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      const scheduling = await DigestScheduling.getOrCreateForUser(userId);
      scheduling.markDeliveryCompleted();
      await scheduling.save();

      res.json({
        success: true,
        data: {
          lastDelivery: scheduling.lastDelivery,
          nextDelivery: scheduling.nextDelivery
        },
        message: 'Delivery marked as completed'
      });
    } catch (error) {
      logger.error('Error marking delivery as completed:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark delivery as completed'
      });
    }
  }

  // Get content selection criteria
  async getContentSelectionCriteria(req, res) {
    try {
      const { userId } = req.params;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      const scheduling = await DigestScheduling.getOrCreateForUser(userId);
      const criteria = scheduling.getContentSelectionCriteria();

      res.json({
        success: true,
        data: criteria
      });
    } catch (error) {
      logger.error('Error getting content selection criteria:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get content selection criteria'
      });
    }
  }

  // Get formatting preferences
  async getFormattingPreferences(req, res) {
    try {
      const { userId } = req.params;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      const scheduling = await DigestScheduling.getOrCreateForUser(userId);
      const preferences = scheduling.getFormattingPreferences();

      res.json({
        success: true,
        data: preferences
      });
    } catch (error) {
      logger.error('Error getting formatting preferences:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get formatting preferences'
      });
    }
  }

  // Reset scheduling to defaults
  async resetScheduling(req, res) {
    try {
      const { userId } = req.params;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      await DigestScheduling.findOneAndDelete({ userId });
      const newScheduling = await DigestScheduling.getOrCreateForUser(userId);

      res.json({
        success: true,
        data: newScheduling,
        message: 'Digest scheduling reset to defaults'
      });
    } catch (error) {
      logger.error('Error resetting digest scheduling:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reset digest scheduling'
      });
    }
  }

  // Get available frequency options
  async getFrequencyOptions(req, res) {
    try {
      const frequencyOptions = {
        daily: {
          name: 'Daily',
          description: 'Receive digest every day at specified time',
          settings: ['deliveryTime']
        },
        weekly: {
          name: 'Weekly',
          description: 'Receive digest once per week on specified day',
          settings: ['deliveryTime', 'dayOfWeek']
        },
        'bi-weekly': {
          name: 'Bi-weekly',
          description: 'Receive digest every two weeks on specified day',
          settings: ['deliveryTime', 'dayOfWeek']
        },
        monthly: {
          name: 'Monthly',
          description: 'Receive digest once per month on specified day',
          settings: ['deliveryTime', 'dayOfMonth']
        }
      };

      res.json({
        success: true,
        data: frequencyOptions
      });
    } catch (error) {
      logger.error('Error getting frequency options:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get frequency options'
      });
    }
  }

  // Get schedules ready for delivery (internal use)
  async getReadyForDelivery(req, res) {
    try {
      const schedules = await DigestScheduling.findReadyForDelivery();

      res.json({
        success: true,
        data: schedules,
        count: schedules.length
      });
    } catch (error) {
      logger.error('Error getting schedules ready for delivery:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get schedules ready for delivery'
      });
    }
  }

  // Generate digest for a user
  async generateDigest(req, res) {
    try {
      const { userId } = req.params;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      const scheduling = await DigestScheduling.getOrCreateForUser(userId);
      
      if (!scheduling.enabled) {
        return res.status(400).json({
          success: false,
          message: 'Digest scheduling is disabled for this user'
        });
      }

      const digest = await this.digestGenerator.generateDigest(scheduling);

      res.json({
        success: true,
        data: digest,
        message: 'Digest generated successfully'
      });
    } catch (error) {
      logger.error('Error generating digest:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate digest'
      });
    }
  }

  // Deliver digest to a user
  async deliverDigest(req, res) {
    try {
      const { userId } = req.params;
      const { digest } = req.body;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      if (!digest) {
        return res.status(400).json({
          success: false,
          message: 'Digest content is required'
        });
      }

      const scheduling = await DigestScheduling.getOrCreateForUser(userId);
      
      if (!scheduling.enabled) {
        return res.status(400).json({
          success: false,
          message: 'Digest scheduling is disabled for this user'
        });
      }

      const deliveryResult = await this.digestDelivery.deliverDigest(digest, scheduling);

      // Mark delivery as completed if successful
      if (deliveryResult.success) {
        scheduling.markDeliveryCompleted();
        await scheduling.save();
      }

      res.json({
        success: true,
        data: deliveryResult,
        message: 'Digest delivery completed'
      });
    } catch (error) {
      logger.error('Error delivering digest:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to deliver digest'
      });
    }
  }

  // Generate and deliver digest in one operation
  async generateAndDeliverDigest(req, res) {
    try {
      const { userId } = req.params;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      const scheduling = await DigestScheduling.getOrCreateForUser(userId);
      
      if (!scheduling.enabled) {
        return res.status(400).json({
          success: false,
          message: 'Digest scheduling is disabled for this user'
        });
      }

      // Generate digest
      const digest = await this.digestGenerator.generateDigest(scheduling);

      // Deliver digest
      const deliveryResult = await this.digestDelivery.deliverDigest(digest, scheduling);

      // Mark delivery as completed if successful
      if (deliveryResult.success) {
        scheduling.markDeliveryCompleted();
        await scheduling.save();
      }

      res.json({
        success: true,
        data: {
          digest,
          delivery: deliveryResult
        },
        message: 'Digest generated and delivered successfully'
      });
    } catch (error) {
      logger.error('Error generating and delivering digest:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate and deliver digest'
      });
    }
  }

  // Process all ready digests (batch operation for scheduler)
  async processReadyDigests(req, res) {
    try {
      const schedules = await DigestScheduling.findReadyForDelivery();
      const results = [];

      logger.info(`Processing ${schedules.length} ready digests`);

      for (const scheduling of schedules) {
        try {
          // Generate digest
          const digest = await this.digestGenerator.generateDigest(scheduling);

          // Deliver digest
          const deliveryResult = await this.digestDelivery.deliverDigest(digest, scheduling);

          // Mark delivery as completed if successful
          if (deliveryResult.success) {
            scheduling.markDeliveryCompleted();
            await scheduling.save();
          }

          results.push({
            userId: scheduling.userId,
            success: true,
            digest: {
              title: digest.title,
              itemCount: digest.totalItems,
              generatedAt: digest.generatedAt
            },
            delivery: deliveryResult
          });

        } catch (error) {
          logger.error(`Error processing digest for user ${scheduling.userId}:`, error);
          results.push({
            userId: scheduling.userId,
            success: false,
            error: error.message
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.length - successCount;

      res.json({
        success: true,
        data: {
          processed: results.length,
          successful: successCount,
          failed: failureCount,
          results
        },
        message: `Processed ${results.length} digests (${successCount} successful, ${failureCount} failed)`
      });
    } catch (error) {
      logger.error('Error processing ready digests:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process ready digests'
      });
    }
  }

  // Get delivery statistics for a user
  async getDeliveryStats(req, res) {
    try {
      const { userId } = req.params;
      const { period } = req.query;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      const stats = await this.digestDelivery.getDeliveryStats(userId, { period });

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Error getting delivery statistics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get delivery statistics'
      });
    }
  }
}

module.exports = new DigestSchedulingController();