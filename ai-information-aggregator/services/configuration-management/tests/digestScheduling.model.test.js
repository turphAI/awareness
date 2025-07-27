const mongoose = require('mongoose');
const DigestScheduling = require('../models/DigestScheduling');

describe('DigestScheduling Model', () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/test-ai-aggregator');
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await DigestScheduling.deleteMany({});
  });

  describe('Schema Validation', () => {
    test('should create digest scheduling with default values', async () => {
      const userId = new mongoose.Types.ObjectId();
      const scheduling = new DigestScheduling({ userId });
      
      expect(scheduling.enabled).toBe(true);
      expect(scheduling.frequency).toBe('daily');
      expect(scheduling.deliveryTime.hour).toBe(8);
      expect(scheduling.deliveryTime.minute).toBe(0);
      expect(scheduling.deliveryTime.timezone).toBe('UTC');
      expect(scheduling.contentSelection.maxItems).toBe(20);
      expect(scheduling.contentSelection.prioritizeBreakingNews).toBe(true);
      expect(scheduling.formatting.includeFullSummaries).toBe(true);
      expect(scheduling.deliveryMethod.email.enabled).toBe(false);
      expect(scheduling.deliveryMethod.inApp.enabled).toBe(true);
    });

    test('should validate frequency enum values', async () => {
      const userId = new mongoose.Types.ObjectId();
      const scheduling = new DigestScheduling({ 
        userId,
        frequency: 'invalid'
      });
      
      await expect(scheduling.save()).rejects.toThrow();
    });

    test('should validate delivery time hour range', async () => {
      const userId = new mongoose.Types.ObjectId();
      const scheduling = new DigestScheduling({ 
        userId,
        deliveryTime: { hour: 25 }
      });
      
      await expect(scheduling.save()).rejects.toThrow();
    });

    test('should validate delivery time minute range', async () => {
      const userId = new mongoose.Types.ObjectId();
      const scheduling = new DigestScheduling({ 
        userId,
        deliveryTime: { minute: 60 }
      });
      
      await expect(scheduling.save()).rejects.toThrow();
    });

    test('should validate content selection maxItems range', async () => {
      const userId = new mongoose.Types.ObjectId();
      const scheduling = new DigestScheduling({ 
        userId,
        contentSelection: { maxItems: 100 }
      });
      
      await expect(scheduling.save()).rejects.toThrow();
    });

    test('should validate weekly day of week range', async () => {
      const userId = new mongoose.Types.ObjectId();
      const scheduling = new DigestScheduling({ 
        userId,
        weeklySettings: { dayOfWeek: 7 }
      });
      
      await expect(scheduling.save()).rejects.toThrow();
    });

    test('should validate monthly day of month range', async () => {
      const userId = new mongoose.Types.ObjectId();
      const scheduling = new DigestScheduling({ 
        userId,
        monthlySettings: { dayOfMonth: 32 }
      });
      
      await expect(scheduling.save()).rejects.toThrow();
    });
  });

  describe('calculateNextDelivery Method', () => {
    test('should return null when disabled', () => {
      const userId = new mongoose.Types.ObjectId();
      const scheduling = new DigestScheduling({ 
        userId,
        enabled: false
      });
      
      const nextDelivery = scheduling.calculateNextDelivery();
      expect(nextDelivery).toBeNull();
    });

    test('should calculate next daily delivery', () => {
      const userId = new mongoose.Types.ObjectId();
      const scheduling = new DigestScheduling({ 
        userId,
        frequency: 'daily',
        deliveryTime: { hour: 9, minute: 30 }
      });
      
      const nextDelivery = scheduling.calculateNextDelivery();
      expect(nextDelivery).toBeInstanceOf(Date);
      expect(nextDelivery.getHours()).toBe(9);
      expect(nextDelivery.getMinutes()).toBe(30);
    });

    test('should calculate next weekly delivery', () => {
      const userId = new mongoose.Types.ObjectId();
      const scheduling = new DigestScheduling({ 
        userId,
        frequency: 'weekly',
        deliveryTime: { hour: 10, minute: 0 },
        weeklySettings: { dayOfWeek: 1 } // Monday
      });
      
      const nextDelivery = scheduling.calculateNextDelivery();
      expect(nextDelivery).toBeInstanceOf(Date);
      expect(nextDelivery.getDay()).toBe(1); // Monday
      expect(nextDelivery.getHours()).toBe(10);
      expect(nextDelivery.getMinutes()).toBe(0);
    });

    test('should calculate next monthly delivery', () => {
      const userId = new mongoose.Types.ObjectId();
      const scheduling = new DigestScheduling({ 
        userId,
        frequency: 'monthly',
        deliveryTime: { hour: 8, minute: 0 },
        monthlySettings: { dayOfMonth: 15 }
      });
      
      const nextDelivery = scheduling.calculateNextDelivery();
      expect(nextDelivery).toBeInstanceOf(Date);
      expect(nextDelivery.getDate()).toBe(15);
      expect(nextDelivery.getHours()).toBe(8);
      expect(nextDelivery.getMinutes()).toBe(0);
    });

    test('should handle bi-weekly delivery calculation', () => {
      const userId = new mongoose.Types.ObjectId();
      const scheduling = new DigestScheduling({ 
        userId,
        frequency: 'bi-weekly',
        deliveryTime: { hour: 9, minute: 0 },
        weeklySettings: { dayOfWeek: 3 } // Wednesday
      });
      
      const nextDelivery = scheduling.calculateNextDelivery();
      expect(nextDelivery).toBeInstanceOf(Date);
      expect(nextDelivery.getDay()).toBe(3); // Wednesday
    });
  });

  describe('updateNextDelivery Method', () => {
    test('should update nextDelivery field', () => {
      const userId = new mongoose.Types.ObjectId();
      const scheduling = new DigestScheduling({ userId });
      
      const originalNextDelivery = scheduling.nextDelivery;
      const updatedNextDelivery = scheduling.updateNextDelivery();
      
      expect(updatedNextDelivery).toBeInstanceOf(Date);
      expect(scheduling.nextDelivery).toBe(updatedNextDelivery);
    });
  });

  describe('markDeliveryCompleted Method', () => {
    test('should update lastDelivery and nextDelivery', () => {
      const userId = new mongoose.Types.ObjectId();
      const scheduling = new DigestScheduling({ userId });
      
      const beforeLastDelivery = scheduling.lastDelivery;
      scheduling.markDeliveryCompleted();
      
      expect(scheduling.lastDelivery).toBeInstanceOf(Date);
      expect(scheduling.lastDelivery).not.toBe(beforeLastDelivery);
      expect(scheduling.nextDelivery).toBeInstanceOf(Date);
    });
  });

  describe('validateConfiguration Method', () => {
    test('should return no errors for valid configuration', () => {
      const userId = new mongoose.Types.ObjectId();
      const scheduling = new DigestScheduling({ 
        userId,
        deliveryMethod: {
          email: { enabled: true, address: 'test@example.com' },
          inApp: { enabled: true }
        }
      });
      
      const errors = scheduling.validateConfiguration();
      expect(errors).toHaveLength(0);
    });

    test('should return error for invalid delivery hour', () => {
      const userId = new mongoose.Types.ObjectId();
      const scheduling = new DigestScheduling({ userId });
      scheduling.deliveryTime.hour = 25;
      
      const errors = scheduling.validateConfiguration();
      expect(errors).toContain('Invalid delivery hour: must be between 0 and 23');
    });

    test('should return error for invalid delivery minute', () => {
      const userId = new mongoose.Types.ObjectId();
      const scheduling = new DigestScheduling({ userId });
      scheduling.deliveryTime.minute = 60;
      
      const errors = scheduling.validateConfiguration();
      expect(errors).toContain('Invalid delivery minute: must be between 0 and 59');
    });

    test('should return error for invalid day of week', () => {
      const userId = new mongoose.Types.ObjectId();
      const scheduling = new DigestScheduling({ 
        userId,
        frequency: 'weekly'
      });
      scheduling.weeklySettings.dayOfWeek = 7;
      
      const errors = scheduling.validateConfiguration();
      expect(errors).toContain('Invalid day of week: must be between 0 (Sunday) and 6 (Saturday)');
    });

    test('should return error for invalid day of month', () => {
      const userId = new mongoose.Types.ObjectId();
      const scheduling = new DigestScheduling({ 
        userId,
        frequency: 'monthly'
      });
      scheduling.monthlySettings.dayOfMonth = 32;
      
      const errors = scheduling.validateConfiguration();
      expect(errors).toContain('Invalid day of month: must be between 1 and 31');
    });

    test('should return error for invalid max items', () => {
      const userId = new mongoose.Types.ObjectId();
      const scheduling = new DigestScheduling({ userId });
      scheduling.contentSelection.maxItems = 100;
      
      const errors = scheduling.validateConfiguration();
      expect(errors).toContain('Invalid max items: must be between 5 and 50');
    });

    test('should return error when no delivery method is enabled', () => {
      const userId = new mongoose.Types.ObjectId();
      const scheduling = new DigestScheduling({ 
        userId,
        deliveryMethod: {
          email: { enabled: false },
          inApp: { enabled: false }
        }
      });
      
      const errors = scheduling.validateConfiguration();
      expect(errors).toContain('At least one delivery method must be enabled');
    });

    test('should return error when email enabled but no address', () => {
      const userId = new mongoose.Types.ObjectId();
      const scheduling = new DigestScheduling({ 
        userId,
        deliveryMethod: {
          email: { enabled: true, address: '' },
          inApp: { enabled: false }
        }
      });
      
      const errors = scheduling.validateConfiguration();
      expect(errors).toContain('Email address is required when email delivery is enabled');
    });
  });

  describe('getContentSelectionCriteria Method', () => {
    test('should return content selection criteria', () => {
      const userId = new mongoose.Types.ObjectId();
      const scheduling = new DigestScheduling({ 
        userId,
        contentSelection: {
          maxItems: 15,
          prioritizeBreakingNews: false,
          includePersonalizedContent: true,
          contentTypes: {
            articles: true,
            papers: false,
            podcasts: true,
            videos: false,
            social: false
          },
          topicFilters: ['AI', 'ML'],
          sourceFilters: [new mongoose.Types.ObjectId()]
        },
        formatting: {
          sortBy: 'recency'
        }
      });
      
      const criteria = scheduling.getContentSelectionCriteria();
      
      expect(criteria.maxItems).toBe(15);
      expect(criteria.prioritizeBreakingNews).toBe(false);
      expect(criteria.includePersonalizedContent).toBe(true);
      expect(criteria.contentTypes).toEqual(['articles', 'podcasts']);
      expect(criteria.topicFilters).toEqual(['AI', 'ML']);
      expect(criteria.sourceFilters).toHaveLength(1);
      expect(criteria.sortBy).toBe('recency');
    });
  });

  describe('getFormattingPreferences Method', () => {
    test('should return formatting preferences', () => {
      const userId = new mongoose.Types.ObjectId();
      const scheduling = new DigestScheduling({ 
        userId,
        formatting: {
          includeFullSummaries: false,
          includeThumbnails: true,
          includeReadingTime: false,
          groupByTopic: true,
          sortBy: 'popularity'
        }
      });
      
      const preferences = scheduling.getFormattingPreferences();
      
      expect(preferences.includeFullSummaries).toBe(false);
      expect(preferences.includeThumbnails).toBe(true);
      expect(preferences.includeReadingTime).toBe(false);
      expect(preferences.groupByTopic).toBe(true);
      expect(preferences.sortBy).toBe('popularity');
    });
  });

  describe('Static Methods', () => {
    describe('getOrCreateForUser', () => {
      test('should create new scheduling if none exists', async () => {
        const userId = new mongoose.Types.ObjectId();
        
        const scheduling = await DigestScheduling.getOrCreateForUser(userId);
        
        expect(scheduling).toBeInstanceOf(DigestScheduling);
        expect(scheduling.userId.toString()).toBe(userId.toString());
        expect(scheduling.nextDelivery).toBeInstanceOf(Date);
      });

      test('should return existing scheduling if it exists', async () => {
        const userId = new mongoose.Types.ObjectId();
        const existingScheduling = new DigestScheduling({ 
          userId,
          frequency: 'weekly'
        });
        await existingScheduling.save();
        
        const scheduling = await DigestScheduling.getOrCreateForUser(userId);
        
        expect(scheduling._id.toString()).toBe(existingScheduling._id.toString());
        expect(scheduling.frequency).toBe('weekly');
      });
    });

    describe('findReadyForDelivery', () => {
      test('should find schedules ready for delivery', async () => {
        const userId1 = new mongoose.Types.ObjectId();
        const userId2 = new mongoose.Types.ObjectId();
        const userId3 = new mongoose.Types.ObjectId();
        
        // Create scheduling ready for delivery
        const readyScheduling = new DigestScheduling({ 
          userId: userId1,
          enabled: true,
          nextDelivery: new Date(Date.now() - 1000) // 1 second ago
        });
        await readyScheduling.save();
        
        // Create scheduling not ready for delivery
        const notReadyScheduling = new DigestScheduling({ 
          userId: userId2,
          enabled: true,
          nextDelivery: new Date(Date.now() + 60000) // 1 minute from now
        });
        await notReadyScheduling.save();
        
        // Create disabled scheduling
        const disabledScheduling = new DigestScheduling({ 
          userId: userId3,
          enabled: false,
          nextDelivery: new Date(Date.now() - 1000)
        });
        await disabledScheduling.save();
        
        const readySchedules = await DigestScheduling.findReadyForDelivery();
        
        expect(readySchedules).toHaveLength(1);
        expect(readySchedules[0].userId.toString()).toBe(userId1.toString());
      });
    });
  });

  describe('Pre-save Middleware', () => {
    test('should update the updated field on save', async () => {
      const userId = new mongoose.Types.ObjectId();
      const scheduling = new DigestScheduling({ userId });
      
      const originalUpdated = scheduling.updated;
      
      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await scheduling.save();
      
      expect(scheduling.updated.getTime()).toBeGreaterThan(originalUpdated.getTime());
    });
  });
});