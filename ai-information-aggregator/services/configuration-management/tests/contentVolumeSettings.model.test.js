const mongoose = require('mongoose');
const ContentVolumeSettings = require('../models/ContentVolumeSettings');

describe('ContentVolumeSettings Model', () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/test-ai-aggregator');
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await ContentVolumeSettings.deleteMany({});
  });

  describe('Schema Validation', () => {
    test('should create settings with valid data', async () => {
      const userId = new mongoose.Types.ObjectId();
      const settings = new ContentVolumeSettings({
        userId,
        dailyLimit: 30,
        priorityThreshold: 0.8,
        adaptiveEnabled: true
      });

      const savedSettings = await settings.save();
      expect(savedSettings.userId).toEqual(userId);
      expect(savedSettings.dailyLimit).toBe(30);
      expect(savedSettings.priorityThreshold).toBe(0.8);
      expect(savedSettings.adaptiveEnabled).toBe(true);
    });

    test('should use default values when not provided', async () => {
      const userId = new mongoose.Types.ObjectId();
      const settings = new ContentVolumeSettings({ userId });

      const savedSettings = await settings.save();
      expect(savedSettings.dailyLimit).toBe(50);
      expect(savedSettings.priorityThreshold).toBe(0.7);
      expect(savedSettings.adaptiveEnabled).toBe(true);
      expect(savedSettings.userBehaviorMetrics.completionRate).toBe(0.5);
      expect(savedSettings.contentTypeWeights.article).toBe(0.8);
    });

    test('should validate dailyLimit range', async () => {
      const userId = new mongoose.Types.ObjectId();
      
      // Test minimum
      const settingsMin = new ContentVolumeSettings({
        userId,
        dailyLimit: 0
      });
      await expect(settingsMin.save()).rejects.toThrow();

      // Test maximum
      const settingsMax = new ContentVolumeSettings({
        userId,
        dailyLimit: 1001
      });
      await expect(settingsMax.save()).rejects.toThrow();
    });

    test('should validate priorityThreshold range', async () => {
      const userId = new mongoose.Types.ObjectId();
      
      const settingsInvalid = new ContentVolumeSettings({
        userId,
        priorityThreshold: 1.5
      });
      await expect(settingsInvalid.save()).rejects.toThrow();
    });

    test('should enforce unique userId', async () => {
      const userId = new mongoose.Types.ObjectId();
      
      const settings1 = new ContentVolumeSettings({ userId });
      await settings1.save();

      const settings2 = new ContentVolumeSettings({ userId });
      await expect(settings2.save()).rejects.toThrow();
    });
  });

  describe('calculateAdaptiveLimit method', () => {
    test('should return base limit when adaptive is disabled', async () => {
      const userId = new mongoose.Types.ObjectId();
      const settings = new ContentVolumeSettings({
        userId,
        dailyLimit: 40,
        adaptiveEnabled: false
      });

      const adaptiveLimit = settings.calculateAdaptiveLimit();
      expect(adaptiveLimit).toBe(40);
    });

    test('should increase limit for high engagement users', async () => {
      const userId = new mongoose.Types.ObjectId();
      const settings = new ContentVolumeSettings({
        userId,
        dailyLimit: 50,
        adaptiveEnabled: true,
        userBehaviorMetrics: {
          completionRate: 0.9,
          engagementScore: 0.8
        }
      });

      const adaptiveLimit = settings.calculateAdaptiveLimit();
      expect(adaptiveLimit).toBeGreaterThan(50);
      expect(adaptiveLimit).toBeLessThanOrEqual(75); // Max 50% increase
    });

    test('should decrease limit for low engagement users', async () => {
      const userId = new mongoose.Types.ObjectId();
      const settings = new ContentVolumeSettings({
        userId,
        dailyLimit: 50,
        adaptiveEnabled: true,
        userBehaviorMetrics: {
          completionRate: 0.2,
          engagementScore: 0.1
        }
      });

      const adaptiveLimit = settings.calculateAdaptiveLimit();
      expect(adaptiveLimit).toBeLessThan(50);
      expect(adaptiveLimit).toBeGreaterThanOrEqual(35); // Max 30% decrease
    });

    test('should maintain base limit for average engagement', async () => {
      const userId = new mongoose.Types.ObjectId();
      const settings = new ContentVolumeSettings({
        userId,
        dailyLimit: 50,
        adaptiveEnabled: true,
        userBehaviorMetrics: {
          completionRate: 0.5,
          engagementScore: 0.5
        }
      });

      const adaptiveLimit = settings.calculateAdaptiveLimit();
      expect(adaptiveLimit).toBe(50);
    });
  });

  describe('updateBehaviorMetrics method', () => {
    test('should update behavior metrics correctly', async () => {
      const userId = new mongoose.Types.ObjectId();
      const settings = new ContentVolumeSettings({ userId });

      settings.updateBehaviorMetrics({
        averageReadTime: 120,
        completionRate: 0.8,
        engagementScore: 0.9
      });

      expect(settings.userBehaviorMetrics.averageReadTime).toBe(120);
      expect(settings.userBehaviorMetrics.completionRate).toBe(0.8);
      expect(settings.userBehaviorMetrics.engagementScore).toBe(0.9);
      expect(settings.userBehaviorMetrics.lastUpdated).toBeInstanceOf(Date);
    });

    test('should clamp values to valid ranges', async () => {
      const userId = new mongoose.Types.ObjectId();
      const settings = new ContentVolumeSettings({ userId });

      settings.updateBehaviorMetrics({
        completionRate: 1.5,
        engagementScore: -0.5
      });

      expect(settings.userBehaviorMetrics.completionRate).toBe(1);
      expect(settings.userBehaviorMetrics.engagementScore).toBe(0);
    });

    test('should only update provided metrics', async () => {
      const userId = new mongoose.Types.ObjectId();
      const settings = new ContentVolumeSettings({ userId });
      const originalEngagement = settings.userBehaviorMetrics.engagementScore;

      settings.updateBehaviorMetrics({
        completionRate: 0.8
      });

      expect(settings.userBehaviorMetrics.completionRate).toBe(0.8);
      expect(settings.userBehaviorMetrics.engagementScore).toBe(originalEngagement);
    });
  });

  describe('prioritizeContent method', () => {
    test('should prioritize content by relevance and type weight', async () => {
      const userId = new mongoose.Types.ObjectId();
      const settings = new ContentVolumeSettings({
        userId,
        dailyLimit: 3,
        priorityThreshold: 0.3 // Lower threshold to include more items
      });

      const contentList = [
        { id: 1, type: 'article', relevanceScore: 0.8 }, // 0.8 * 0.8 = 0.64
        { id: 2, type: 'paper', relevanceScore: 0.7 },   // 0.7 * 0.9 = 0.63
        { id: 3, type: 'social', relevanceScore: 0.9 },  // 0.9 * 0.4 = 0.36
        { id: 4, type: 'video', relevanceScore: 0.6 }    // 0.6 * 0.6 = 0.36
      ];

      const prioritized = settings.prioritizeContent(contentList);

      expect(prioritized).toHaveLength(3);
      expect(prioritized[0].priorityScore).toBeGreaterThan(prioritized[1].priorityScore);
      expect(prioritized[1].priorityScore).toBeGreaterThan(prioritized[2].priorityScore);
    });

    test('should filter by priority threshold', async () => {
      const userId = new mongoose.Types.ObjectId();
      const settings = new ContentVolumeSettings({
        userId,
        dailyLimit: 10,
        priorityThreshold: 0.6
      });

      const contentList = [
        { id: 1, type: 'article', relevanceScore: 0.8 }, // 0.8 * 0.8 = 0.64 (passes)
        { id: 2, type: 'article', relevanceScore: 0.4 }, // 0.4 * 0.8 = 0.32 (fails)
        { id: 3, type: 'article', relevanceScore: 0.7 }  // 0.7 * 0.8 = 0.56 (fails)
      ];

      const prioritized = settings.prioritizeContent(contentList);

      expect(prioritized).toHaveLength(1);
      expect(prioritized.every(item => item.priorityScore >= 0.6)).toBe(true);
    });

    test('should respect adaptive daily limit', async () => {
      const userId = new mongoose.Types.ObjectId();
      const settings = new ContentVolumeSettings({
        userId,
        dailyLimit: 50,
        priorityThreshold: 0.1,
        adaptiveEnabled: true,
        userBehaviorMetrics: {
          completionRate: 0.2,
          engagementScore: 0.1
        }
      });

      const contentList = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        type: 'article',
        relevanceScore: 0.8
      }));

      const prioritized = settings.prioritizeContent(contentList);
      const adaptiveLimit = settings.calculateAdaptiveLimit();

      expect(prioritized).toHaveLength(adaptiveLimit);
      expect(adaptiveLimit).toBeLessThan(50);
    });
  });

  describe('getOrCreateForUser static method', () => {
    test('should create new settings if none exist', async () => {
      const userId = new mongoose.Types.ObjectId();
      
      const settings = await ContentVolumeSettings.getOrCreateForUser(userId);
      
      expect(settings.userId).toEqual(userId);
      expect(settings.dailyLimit).toBe(50); // Default value
      
      const count = await ContentVolumeSettings.countDocuments({ userId });
      expect(count).toBe(1);
    });

    test('should return existing settings if they exist', async () => {
      const userId = new mongoose.Types.ObjectId();
      const existingSettings = new ContentVolumeSettings({
        userId,
        dailyLimit: 30
      });
      await existingSettings.save();
      
      const settings = await ContentVolumeSettings.getOrCreateForUser(userId);
      
      expect(settings.userId).toEqual(userId);
      expect(settings.dailyLimit).toBe(30);
      
      const count = await ContentVolumeSettings.countDocuments({ userId });
      expect(count).toBe(1);
    });
  });

  describe('Pre-save middleware', () => {
    test('should update the updated field on save', async () => {
      const userId = new mongoose.Types.ObjectId();
      const settings = new ContentVolumeSettings({ userId });
      
      const originalUpdated = settings.updated;
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
      
      await settings.save();
      
      expect(settings.updated.getTime()).toBeGreaterThan(originalUpdated.getTime());
    });
  });
});