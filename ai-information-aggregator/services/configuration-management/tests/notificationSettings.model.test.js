const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const NotificationSettings = require('../models/NotificationSettings');

describe('NotificationSettings Model', () => {
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

  describe('Schema validation', () => {
    it('should create notification settings with valid data', async () => {
      const validSettings = {
        userId: 'test-user-123',
        channels: {
          email: { enabled: true, frequency: 'daily' },
          push: { enabled: false, frequency: 'immediate' },
          digest: { enabled: true, frequency: 'weekly', time: '09:00', timezone: 'UTC' }
        },
        contentTypes: {
          breakingNews: true,
          newContent: true,
          weeklyDigest: false,
          systemUpdates: true
        },
        quietHours: {
          enabled: true,
          start: '22:00',
          end: '08:00',
          timezone: 'UTC'
        }
      };

      const settings = new NotificationSettings(validSettings);
      const savedSettings = await settings.save();

      expect(savedSettings.userId).toBe('test-user-123');
      expect(savedSettings.channels.email.enabled).toBe(true);
      expect(savedSettings.channels.email.frequency).toBe('daily');
      expect(savedSettings.contentTypes.breakingNews).toBe(true);
      expect(savedSettings.quietHours.enabled).toBe(true);
    });

    it('should require userId', async () => {
      const settingsWithoutUserId = {
        channels: {
          email: { enabled: true, frequency: 'daily' }
        }
      };

      const settings = new NotificationSettings(settingsWithoutUserId);
      
      await expect(settings.save()).rejects.toThrow('Path `userId` is required');
    });

    it('should enforce unique userId constraint', async () => {
      const userId = 'duplicate-user';
      
      const settings1 = new NotificationSettings({ userId });
      await settings1.save();

      const settings2 = new NotificationSettings({ userId });
      
      await expect(settings2.save()).rejects.toThrow();
    });

    it('should validate email frequency enum', async () => {
      const settingsWithInvalidFrequency = {
        userId: 'test-user',
        channels: {
          email: { enabled: true, frequency: 'invalid-frequency' }
        }
      };

      const settings = new NotificationSettings(settingsWithInvalidFrequency);
      
      await expect(settings.save()).rejects.toThrow();
    });

    it('should validate time format for digest', async () => {
      const settingsWithInvalidTime = {
        userId: 'test-user',
        channels: {
          digest: { enabled: true, frequency: 'daily', time: '25:00' }
        }
      };

      const settings = new NotificationSettings(settingsWithInvalidTime);
      
      await expect(settings.save()).rejects.toThrow('Time must be in HH:MM format');
    });

    it('should validate quiet hours time format', async () => {
      const settingsWithInvalidQuietHours = {
        userId: 'test-user',
        quietHours: {
          enabled: true,
          start: '24:60',
          end: '08:00'
        }
      };

      const settings = new NotificationSettings(settingsWithInvalidQuietHours);
      
      await expect(settings.save()).rejects.toThrow('Time must be in HH:MM format');
    });
  });

  describe('Default values', () => {
    it('should apply default values correctly', async () => {
      const minimalSettings = {
        userId: 'test-user'
      };

      const settings = new NotificationSettings(minimalSettings);
      const savedSettings = await settings.save();

      expect(savedSettings.channels.email.enabled).toBe(true);
      expect(savedSettings.channels.email.frequency).toBe('daily');
      expect(savedSettings.channels.push.enabled).toBe(false);
      expect(savedSettings.channels.push.frequency).toBe('immediate');
      expect(savedSettings.channels.digest.enabled).toBe(true);
      expect(savedSettings.channels.digest.frequency).toBe('daily');
      expect(savedSettings.channels.digest.time).toBe('09:00');
      expect(savedSettings.channels.digest.timezone).toBe('UTC');
      expect(savedSettings.contentTypes.breakingNews).toBe(true);
      expect(savedSettings.contentTypes.newContent).toBe(true);
      expect(savedSettings.contentTypes.weeklyDigest).toBe(true);
      expect(savedSettings.contentTypes.systemUpdates).toBe(true);
      expect(savedSettings.quietHours.enabled).toBe(false);
      expect(savedSettings.quietHours.start).toBe('22:00');
      expect(savedSettings.quietHours.end).toBe('08:00');
      expect(savedSettings.quietHours.timezone).toBe('UTC');
    });
  });

  describe('Virtual properties', () => {
    it('should return allSettings virtual property', async () => {
      const settings = new NotificationSettings({
        userId: 'test-user',
        channels: {
          email: { enabled: true, frequency: 'daily' }
        }
      });
      await settings.save();

      const allSettings = settings.allSettings;
      
      expect(allSettings).toHaveProperty('channels');
      expect(allSettings).toHaveProperty('contentTypes');
      expect(allSettings).toHaveProperty('quietHours');
      expect(allSettings.channels.email.enabled).toBe(true);
    });
  });

  describe('Instance methods', () => {
    let settings;

    beforeEach(async () => {
      settings = new NotificationSettings({
        userId: 'test-user',
        quietHours: {
          enabled: true,
          start: '22:00',
          end: '08:00',
          timezone: 'UTC'
        }
      });
      await settings.save();
    });

    describe('isNotificationAllowed', () => {
      it('should allow notifications when quiet hours are disabled', async () => {
        settings.quietHours.enabled = false;
        await settings.save();

        const isAllowed = settings.isNotificationAllowed('23:00', 'UTC');
        expect(isAllowed).toBe(true);
      });

      it('should block notifications during overnight quiet hours', async () => {
        // Test during quiet hours (22:00 - 08:00)
        expect(settings.isNotificationAllowed('23:00', 'UTC')).toBe(false);
        expect(settings.isNotificationAllowed('02:00', 'UTC')).toBe(false);
        expect(settings.isNotificationAllowed('07:00', 'UTC')).toBe(false);
      });

      it('should allow notifications outside overnight quiet hours', async () => {
        // Test outside quiet hours
        expect(settings.isNotificationAllowed('10:00', 'UTC')).toBe(true);
        expect(settings.isNotificationAllowed('15:00', 'UTC')).toBe(true);
        expect(settings.isNotificationAllowed('21:00', 'UTC')).toBe(true);
      });

      it('should handle same-day quiet hours', async () => {
        settings.quietHours.start = '12:00';
        settings.quietHours.end = '14:00';
        await settings.save();

        expect(settings.isNotificationAllowed('11:00', 'UTC')).toBe(true);
        expect(settings.isNotificationAllowed('13:00', 'UTC')).toBe(false);
        expect(settings.isNotificationAllowed('15:00', 'UTC')).toBe(true);
      });

      it('should use current time when not provided', async () => {
        const isAllowed = settings.isNotificationAllowed();
        expect(typeof isAllowed).toBe('boolean');
      });
    });

    describe('getChannelFrequency', () => {
      it('should return frequency for enabled channel', async () => {
        const frequency = settings.getChannelFrequency('email');
        expect(frequency).toBe('daily');
      });

      it('should return "never" for disabled channel', async () => {
        settings.channels.push.enabled = false;
        await settings.save();

        const frequency = settings.getChannelFrequency('push');
        expect(frequency).toBe('never');
      });

      it('should return "never" for non-existent channel', async () => {
        const frequency = settings.getChannelFrequency('nonexistent');
        expect(frequency).toBe('never');
      });
    });
  });

  describe('Static methods', () => {
    describe('getDefaultSettings', () => {
      it('should return default settings for a user', () => {
        const userId = 'test-user-123';
        const defaultSettings = NotificationSettings.getDefaultSettings(userId);

        expect(defaultSettings.userId).toBe(userId);
        expect(defaultSettings.channels.email.enabled).toBe(true);
        expect(defaultSettings.channels.email.frequency).toBe('daily');
        expect(defaultSettings.channels.push.enabled).toBe(false);
        expect(defaultSettings.channels.push.frequency).toBe('immediate');
        expect(defaultSettings.channels.digest.enabled).toBe(true);
        expect(defaultSettings.channels.digest.frequency).toBe('daily');
        expect(defaultSettings.channels.digest.time).toBe('09:00');
        expect(defaultSettings.channels.digest.timezone).toBe('UTC');
        expect(defaultSettings.contentTypes.breakingNews).toBe(true);
        expect(defaultSettings.contentTypes.newContent).toBe(true);
        expect(defaultSettings.contentTypes.weeklyDigest).toBe(true);
        expect(defaultSettings.contentTypes.systemUpdates).toBe(true);
        expect(defaultSettings.quietHours.enabled).toBe(false);
        expect(defaultSettings.quietHours.start).toBe('22:00');
        expect(defaultSettings.quietHours.end).toBe('08:00');
        expect(defaultSettings.quietHours.timezone).toBe('UTC');
      });
    });
  });

  describe('Indexes', () => {
    it('should create index on userId', async () => {
      const indexes = await NotificationSettings.collection.getIndexes();
      
      expect(indexes).toHaveProperty('userId_1');
    });
  });

  describe('Timestamps', () => {
    it('should automatically add createdAt and updatedAt timestamps', async () => {
      const settings = new NotificationSettings({
        userId: 'test-user'
      });
      const savedSettings = await settings.save();

      expect(savedSettings.createdAt).toBeDefined();
      expect(savedSettings.updatedAt).toBeDefined();
      expect(savedSettings.createdAt).toBeInstanceOf(Date);
      expect(savedSettings.updatedAt).toBeInstanceOf(Date);
    });

    it('should update updatedAt timestamp on save', async () => {
      const settings = new NotificationSettings({
        userId: 'test-user'
      });
      const savedSettings = await settings.save();
      const originalUpdatedAt = savedSettings.updatedAt;

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      savedSettings.channels.email.enabled = false;
      const updatedSettings = await savedSettings.save();

      expect(updatedSettings.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });
});