const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const NotificationSettings = require('../models/NotificationSettings');
const notificationController = require('../controllers/notificationController');

describe('Notification Settings - Task 10.2 Verification', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await NotificationSettings.deleteMany({});
  });

  const createMockReq = (params = {}, body = {}, query = {}) => ({
    params,
    body,
    query,
    app: {
      locals: {
        logger: {
          info: jest.fn(),
          error: jest.fn(),
          warn: jest.fn(),
          debug: jest.fn()
        }
      }
    }
  });

  const createMockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  describe('Task 10.2 Requirements Verification', () => {
    const testUserId = 'verification-user';

    it('should have configurable notification channels (email, push, digest)', async () => {
      const settings = new NotificationSettings({
        userId: testUserId,
        channels: {
          email: { enabled: true, frequency: 'daily' },
          push: { enabled: false, frequency: 'immediate' },
          digest: { enabled: true, frequency: 'weekly', time: '08:00', timezone: 'UTC' }
        }
      });
      await settings.save();

      expect(settings.channels.email).toBeDefined();
      expect(settings.channels.push).toBeDefined();
      expect(settings.channels.digest).toBeDefined();
      
      expect(settings.channels.email.enabled).toBe(true);
      expect(settings.channels.email.frequency).toBe('daily');
      expect(settings.channels.push.enabled).toBe(false);
      expect(settings.channels.push.frequency).toBe('immediate');
      expect(settings.channels.digest.enabled).toBe(true);
      expect(settings.channels.digest.frequency).toBe('weekly');
      expect(settings.channels.digest.time).toBe('08:00');
    });

    it('should have notification frequency controls for all channels', async () => {
      const settings = new NotificationSettings({ userId: testUserId });
      
      // Test email frequency options
      const emailFrequencies = ['immediate', 'hourly', 'daily', 'weekly', 'never'];
      for (const freq of emailFrequencies) {
        settings.channels.email.frequency = freq;
        await settings.validate(); // Should not throw
      }

      // Test push frequency options
      const pushFrequencies = ['immediate', 'hourly', 'daily', 'weekly', 'never'];
      for (const freq of pushFrequencies) {
        settings.channels.push.frequency = freq;
        await settings.validate(); // Should not throw
      }

      // Test digest frequency options
      const digestFrequencies = ['daily', 'weekly', 'monthly', 'never'];
      for (const freq of digestFrequencies) {
        settings.channels.digest.frequency = freq;
        await settings.validate(); // Should not throw
      }

      expect(true).toBe(true); // If we get here, all validations passed
    });

    it('should support quiet hours functionality', async () => {
      const settings = new NotificationSettings({
        userId: testUserId,
        quietHours: {
          enabled: true,
          start: '22:00',
          end: '08:00',
          timezone: 'UTC'
        }
      });
      await settings.save();

      expect(settings.quietHours.enabled).toBe(true);
      expect(settings.quietHours.start).toBe('22:00');
      expect(settings.quietHours.end).toBe('08:00');
      expect(settings.quietHours.timezone).toBe('UTC');

      // Test quiet hours logic
      expect(settings.isNotificationAllowed('10:00', 'UTC')).toBe(true);  // Outside quiet hours
      expect(settings.isNotificationAllowed('23:00', 'UTC')).toBe(false); // During quiet hours
      expect(settings.isNotificationAllowed('07:00', 'UTC')).toBe(false); // During quiet hours
    });

    it('should support content type preferences', async () => {
      const settings = new NotificationSettings({
        userId: testUserId,
        contentTypes: {
          breakingNews: true,
          newContent: false,
          weeklyDigest: true,
          systemUpdates: false
        }
      });
      await settings.save();

      expect(settings.contentTypes.breakingNews).toBe(true);
      expect(settings.contentTypes.newContent).toBe(false);
      expect(settings.contentTypes.weeklyDigest).toBe(true);
      expect(settings.contentTypes.systemUpdates).toBe(false);
    });

    it('should provide REST API endpoints for notification management', async () => {
      // Test getting notification settings
      const getReq = createMockReq({ userId: testUserId });
      const getRes = createMockRes();
      
      await notificationController.getNotificationSettings(getReq, getRes);
      
      expect(getRes.status).toHaveBeenCalledWith(200);
      expect(getRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          channels: expect.any(Object),
          contentTypes: expect.any(Object),
          quietHours: expect.any(Object)
        })
      });

      // Test updating notification settings
      const updateData = {
        channels: {
          email: { enabled: false, frequency: 'weekly' },
          push: { enabled: false, frequency: 'immediate' },
          digest: { enabled: true, frequency: 'daily', time: '09:00', timezone: 'UTC' }
        }
      };
      const updateReq = createMockReq({ userId: testUserId }, updateData);
      const updateRes = createMockRes();
      
      await notificationController.updateNotificationSettings(updateReq, updateRes);
      
      // Check if there was an error first
      if (updateRes.status.mock.calls[0][0] !== 200) {
        console.log('Update error:', updateRes.json.mock.calls[0][0]);
      }
      
      expect(updateRes.status).toHaveBeenCalledWith(200);
      expect(updateRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Notification settings updated successfully',
        data: expect.objectContaining({
          channels: expect.objectContaining({
            email: expect.objectContaining({
              enabled: false,
              frequency: 'weekly'
            })
          })
        })
      });
    });

    it('should validate notification settings data', () => {
      // Test valid settings
      const validSettings = {
        channels: {
          email: { enabled: true, frequency: 'daily' },
          push: { enabled: false, frequency: 'immediate' }
        },
        quietHours: {
          enabled: true,
          start: '22:00',
          end: '08:00'
        }
      };
      
      const validationError = notificationController.validateNotificationSettings(validSettings);
      expect(validationError).toBeNull();

      // Test invalid frequency
      const invalidFrequency = {
        channels: {
          email: { frequency: 'invalid-frequency' }
        }
      };
      
      const frequencyError = notificationController.validateNotificationSettings(invalidFrequency);
      expect(frequencyError).toContain('Invalid frequency');

      // Test invalid time format
      const invalidTime = {
        quietHours: {
          start: '25:00'
        }
      };
      
      const timeError = notificationController.validateNotificationSettings(invalidTime);
      expect(timeError).toContain('Invalid start time format');
    });

    it('should provide channel-specific frequency checking', async () => {
      const settings = new NotificationSettings({
        userId: testUserId,
        channels: {
          email: { enabled: true, frequency: 'daily' },
          push: { enabled: false, frequency: 'immediate' }
        }
      });
      await settings.save();

      expect(settings.getChannelFrequency('email')).toBe('daily');
      expect(settings.getChannelFrequency('push')).toBe('never'); // Disabled channel returns 'never'
      expect(settings.getChannelFrequency('nonexistent')).toBe('never');
    });

    it('should support resetting to default settings', async () => {
      // Create custom settings
      const customSettings = new NotificationSettings({
        userId: testUserId,
        channels: {
          email: { enabled: false, frequency: 'weekly' }
        }
      });
      await customSettings.save();

      // Reset to defaults
      const resetReq = createMockReq({ userId: testUserId });
      const resetRes = createMockRes();
      
      await notificationController.resetNotificationSettings(resetReq, resetRes);
      
      expect(resetRes.status).toHaveBeenCalledWith(200);
      expect(resetRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Notification settings reset to defaults',
        data: expect.objectContaining({
          channels: expect.objectContaining({
            email: expect.objectContaining({
              enabled: true,
              frequency: 'daily'
            })
          })
        })
      });
    });
  });

  describe('Task 10.2 - Requirement 7.2 Compliance', () => {
    it('should respect user notification preferences for alerts', async () => {
      const testUserId = 'compliance-user';
      
      // Create user with specific notification preferences
      const settings = new NotificationSettings({
        userId: testUserId,
        channels: {
          email: { enabled: true, frequency: 'daily' },
          push: { enabled: false, frequency: 'never' },
          digest: { enabled: true, frequency: 'weekly' }
        },
        contentTypes: {
          breakingNews: true,
          newContent: false,
          weeklyDigest: true,
          systemUpdates: false
        },
        quietHours: {
          enabled: true,
          start: '22:00',
          end: '08:00'
        }
      });
      await settings.save();

      // Verify the system respects these preferences
      expect(settings.channels.email.enabled).toBe(true);
      expect(settings.channels.push.enabled).toBe(false);
      expect(settings.contentTypes.breakingNews).toBe(true);
      expect(settings.contentTypes.newContent).toBe(false);
      
      // Verify quiet hours are respected
      expect(settings.isNotificationAllowed('10:00')).toBe(true);  // Allowed time
      expect(settings.isNotificationAllowed('23:00')).toBe(false); // Quiet hours
      
      // Verify channel frequency is respected
      expect(settings.getChannelFrequency('email')).toBe('daily');
      expect(settings.getChannelFrequency('push')).toBe('never');
    });
  });
});