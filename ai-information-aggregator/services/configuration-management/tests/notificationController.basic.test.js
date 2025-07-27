const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const NotificationSettings = require('../models/NotificationSettings');
const notificationController = require('../controllers/notificationController');

describe('Notification Controller - Basic Tests', () => {
  let mongoServer;
  const testUserId = 'test-user-123';

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

  // Mock request and response objects
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

  describe('getNotificationSettings', () => {
    it('should return default settings for new user', async () => {
      const req = createMockReq({ userId: testUserId });
      const res = createMockRes();

      await notificationController.getNotificationSettings(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          channels: expect.any(Object),
          contentTypes: expect.any(Object),
          quietHours: expect.any(Object)
        })
      });
    });

    it('should return existing settings', async () => {
      // Create existing settings
      const existingSettings = new NotificationSettings({
        userId: testUserId,
        channels: {
          email: { enabled: false, frequency: 'weekly' }
        }
      });
      await existingSettings.save();

      const req = createMockReq({ userId: testUserId });
      const res = createMockRes();

      await notificationController.getNotificationSettings(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
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
  });

  describe('updateNotificationSettings', () => {
    it('should update notification settings successfully', async () => {
      const updateData = {
        channels: {
          email: { enabled: false, frequency: 'weekly' }
        },
        contentTypes: {
          breakingNews: false
        }
      };

      const req = createMockReq({ userId: testUserId }, updateData);
      const res = createMockRes();

      await notificationController.updateNotificationSettings(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Notification settings updated successfully',
        data: expect.objectContaining({
          channels: expect.objectContaining({
            email: expect.objectContaining({
              enabled: false,
              frequency: 'weekly'
            })
          }),
          contentTypes: expect.objectContaining({
            breakingNews: false
          })
        })
      });
    });

    it('should return validation error for invalid data', async () => {
      const updateData = {
        channels: {
          email: { frequency: 'invalid-frequency' }
        }
      };

      const req = createMockReq({ userId: testUserId }, updateData);
      const res = createMockRes();

      await notificationController.updateNotificationSettings(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid notification settings',
        error: expect.stringContaining('Invalid frequency')
      });
    });
  });

  describe('updateChannelSettings', () => {
    it('should update specific channel settings', async () => {
      const updateData = {
        enabled: true,
        frequency: 'immediate'
      };

      const req = createMockReq({ userId: testUserId, channel: 'push' }, updateData);
      const res = createMockRes();

      await notificationController.updateChannelSettings(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'push channel settings updated successfully',
        data: expect.objectContaining({
          enabled: true,
          frequency: 'immediate'
        })
      });
    });

    it('should return error for invalid channel', async () => {
      const updateData = { enabled: true };
      const req = createMockReq({ userId: testUserId, channel: 'invalid' }, updateData);
      const res = createMockRes();

      await notificationController.updateChannelSettings(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: expect.stringContaining('Invalid channel')
      });
    });
  });

  describe('checkNotificationStatus', () => {
    beforeEach(async () => {
      const settings = new NotificationSettings({
        userId: testUserId,
        quietHours: {
          enabled: true,
          start: '22:00',
          end: '08:00'
        }
      });
      await settings.save();
    });

    it('should return notification status', async () => {
      const req = createMockReq(
        { userId: testUserId },
        {},
        { currentTime: '10:00', timezone: 'UTC' }
      );
      const res = createMockRes();

      await notificationController.checkNotificationStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          notificationsAllowed: true,
          quietHoursActive: false
        })
      });
    });

    it('should return 404 for non-existent user', async () => {
      const req = createMockReq({ userId: 'non-existent' });
      const res = createMockRes();

      await notificationController.checkNotificationStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Notification settings not found for user'
      });
    });
  });

  describe('resetNotificationSettings', () => {
    it('should reset settings to defaults', async () => {
      // Create custom settings first
      const customSettings = new NotificationSettings({
        userId: testUserId,
        channels: {
          email: { enabled: false, frequency: 'weekly' }
        }
      });
      await customSettings.save();

      const req = createMockReq({ userId: testUserId });
      const res = createMockRes();

      await notificationController.resetNotificationSettings(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
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

  describe('validateNotificationSettings', () => {
    it('should return null for valid settings', () => {
      const validSettings = {
        channels: {
          email: { enabled: true, frequency: 'daily' }
        },
        quietHours: {
          start: '22:00',
          end: '08:00'
        }
      };

      const error = notificationController.validateNotificationSettings(validSettings);
      expect(error).toBeNull();
    });

    it('should return error for invalid frequency', () => {
      const invalidSettings = {
        channels: {
          email: { frequency: 'invalid' }
        }
      };

      const error = notificationController.validateNotificationSettings(invalidSettings);
      expect(error).toContain('Invalid frequency');
    });

    it('should return error for invalid time format', () => {
      const invalidSettings = {
        quietHours: {
          start: '25:00'
        }
      };

      const error = notificationController.validateNotificationSettings(invalidSettings);
      expect(error).toContain('Invalid start time format');
    });
  });
});