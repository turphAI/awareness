const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require('../index');
const ContentVolumeSettings = require('../models/ContentVolumeSettings');

describe('Content Volume Controller', () => {
  let server;
  const testUserId = new mongoose.Types.ObjectId();

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/test-ai-aggregator');
  });

  afterAll(async () => {
    await mongoose.connection.close();
    if (server) {
      server.close();
    }
  });

  beforeEach(async () => {
    await ContentVolumeSettings.deleteMany({});
  });

  describe('GET /api/content-volume/:userId', () => {
    test('should get settings for existing user', async () => {
      const settings = new ContentVolumeSettings({
        userId: testUserId,
        dailyLimit: 30,
        priorityThreshold: 0.8
      });
      await settings.save();

      const response = await request(app)
        .get(`/api/content-volume/${testUserId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.userId).toBe(testUserId.toString());
      expect(response.body.data.dailyLimit).toBe(30);
      expect(response.body.data.priorityThreshold).toBe(0.8);
    });

    test('should create default settings for new user', async () => {
      const newUserId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .get(`/api/content-volume/${newUserId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.userId).toBe(newUserId.toString());
      expect(response.body.data.dailyLimit).toBe(50); // Default value
      expect(response.body.data.priorityThreshold).toBe(0.7); // Default value
    });

    test('should return 400 for missing userId', async () => {
      const response = await request(app)
        .get('/api/content-volume/')
        .expect(404); // Route not found without userId
    });
  });

  describe('PUT /api/content-volume/:userId', () => {
    test('should update settings successfully', async () => {
      const updateData = {
        dailyLimit: 40,
        priorityThreshold: 0.9,
        adaptiveEnabled: false,
        contentTypeWeights: {
          article: 0.9,
          paper: 1.0,
          podcast: 0.8
        }
      };

      const response = await request(app)
        .put(`/api/content-volume/${testUserId}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.dailyLimit).toBe(40);
      expect(response.body.data.priorityThreshold).toBe(0.9);
      expect(response.body.data.adaptiveEnabled).toBe(false);
      expect(response.body.data.contentTypeWeights.article).toBe(0.9);
    });

    test('should create new settings if none exist', async () => {
      const newUserId = new mongoose.Types.ObjectId();
      const updateData = {
        dailyLimit: 25,
        priorityThreshold: 0.6
      };

      const response = await request(app)
        .put(`/api/content-volume/${newUserId}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.userId).toBe(newUserId.toString());
      expect(response.body.data.dailyLimit).toBe(25);
      expect(response.body.data.priorityThreshold).toBe(0.6);
    });

    test('should validate input data', async () => {
      const invalidData = {
        dailyLimit: 1500, // Exceeds maximum
        priorityThreshold: 2.0 // Exceeds maximum
      };

      const response = await request(app)
        .put(`/api/content-volume/${testUserId}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid settings data');
    });

    test('should filter out non-allowed fields', async () => {
      const updateData = {
        dailyLimit: 30,
        userId: new mongoose.Types.ObjectId(), // Should be filtered out
        created: new Date(), // Should be filtered out
        maliciousField: 'hack' // Should be filtered out
      };

      const response = await request(app)
        .put(`/api/content-volume/${testUserId}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.dailyLimit).toBe(30);
      expect(response.body.data.userId).toBe(testUserId.toString());
      expect(response.body.data.maliciousField).toBeUndefined();
    });
  });

  describe('PUT /api/content-volume/:userId/behavior', () => {
    test('should update behavior metrics successfully', async () => {
      const behaviorData = {
        averageReadTime: 150,
        completionRate: 0.85,
        engagementScore: 0.9
      };

      const response = await request(app)
        .put(`/api/content-volume/${testUserId}/behavior`)
        .send(behaviorData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.userBehaviorMetrics.averageReadTime).toBe(150);
      expect(response.body.data.userBehaviorMetrics.completionRate).toBe(0.85);
      expect(response.body.data.userBehaviorMetrics.engagementScore).toBe(0.9);
    });

    test('should create settings if none exist', async () => {
      const newUserId = new mongoose.Types.ObjectId();
      const behaviorData = {
        completionRate: 0.7
      };

      const response = await request(app)
        .put(`/api/content-volume/${newUserId}/behavior`)
        .send(behaviorData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.userBehaviorMetrics.completionRate).toBe(0.7);
    });
  });

  describe('GET /api/content-volume/:userId/adaptive-limit', () => {
    test('should return adaptive limit for user', async () => {
      const settings = new ContentVolumeSettings({
        userId: testUserId,
        dailyLimit: 50,
        adaptiveEnabled: true,
        userBehaviorMetrics: {
          completionRate: 0.9,
          engagementScore: 0.8
        }
      });
      await settings.save();

      const response = await request(app)
        .get(`/api/content-volume/${testUserId}/adaptive-limit`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.baseLimit).toBe(50);
      expect(response.body.data.adaptiveLimit).toBeGreaterThan(50);
      expect(response.body.data.adaptiveEnabled).toBe(true);
      expect(response.body.data.behaviorMetrics).toBeDefined();
    });

    test('should return base limit when adaptive is disabled', async () => {
      const settings = new ContentVolumeSettings({
        userId: testUserId,
        dailyLimit: 40,
        adaptiveEnabled: false
      });
      await settings.save();

      const response = await request(app)
        .get(`/api/content-volume/${testUserId}/adaptive-limit`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.baseLimit).toBe(40);
      expect(response.body.data.adaptiveLimit).toBe(40);
      expect(response.body.data.adaptiveEnabled).toBe(false);
    });
  });

  describe('POST /api/content-volume/:userId/prioritize', () => {
    test('should prioritize content successfully', async () => {
      const settings = new ContentVolumeSettings({
        userId: testUserId,
        dailyLimit: 3,
        priorityThreshold: 0.3 // Lower threshold to include more items
      });
      await settings.save();

      const contentList = [
        { id: 1, type: 'article', relevanceScore: 0.8 }, // 0.8 * 0.8 = 0.64
        { id: 2, type: 'paper', relevanceScore: 0.7 },   // 0.7 * 0.9 = 0.63
        { id: 3, type: 'social', relevanceScore: 0.9 },  // 0.9 * 0.4 = 0.36
        { id: 4, type: 'video', relevanceScore: 0.6 },   // 0.6 * 0.6 = 0.36
        { id: 5, type: 'article', relevanceScore: 0.3 }  // 0.3 * 0.8 = 0.24 (below threshold)
      ];

      const response = await request(app)
        .post(`/api/content-volume/${testUserId}/prioritize`)
        .send({ contentList })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.prioritizedContent).toHaveLength(3);
      expect(response.body.data.totalOriginal).toBe(5);
      expect(response.body.data.totalPrioritized).toBe(3);
      expect(response.body.data.adaptiveLimit).toBe(3);
      expect(response.body.data.priorityThreshold).toBe(0.3);

      // Check that content is properly prioritized
      const prioritized = response.body.data.prioritizedContent;
      expect(prioritized[0].priorityScore).toBeGreaterThanOrEqual(prioritized[1].priorityScore);
      expect(prioritized[1].priorityScore).toBeGreaterThanOrEqual(prioritized[2].priorityScore);
    });

    test('should return 400 for invalid content list', async () => {
      const response = await request(app)
        .post(`/api/content-volume/${testUserId}/prioritize`)
        .send({ contentList: 'not an array' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Content list must be an array');
    });

    test('should handle empty content list', async () => {
      const response = await request(app)
        .post(`/api/content-volume/${testUserId}/prioritize`)
        .send({ contentList: [] })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.prioritizedContent).toHaveLength(0);
      expect(response.body.data.totalOriginal).toBe(0);
      expect(response.body.data.totalPrioritized).toBe(0);
    });
  });

  describe('DELETE /api/content-volume/:userId', () => {
    test('should reset settings to defaults', async () => {
      // Create custom settings
      const settings = new ContentVolumeSettings({
        userId: testUserId,
        dailyLimit: 30,
        priorityThreshold: 0.9,
        adaptiveEnabled: false
      });
      await settings.save();

      const response = await request(app)
        .delete(`/api/content-volume/${testUserId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.dailyLimit).toBe(50); // Default value
      expect(response.body.data.priorityThreshold).toBe(0.7); // Default value
      expect(response.body.data.adaptiveEnabled).toBe(true); // Default value
    });

    test('should work even if no settings exist', async () => {
      const newUserId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .delete(`/api/content-volume/${newUserId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.userId).toBe(newUserId.toString());
      expect(response.body.data.dailyLimit).toBe(50); // Default value
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors gracefully', async () => {
      // Close the database connection to simulate an error
      await mongoose.connection.close();

      const response = await request(app)
        .get(`/api/content-volume/${testUserId}`)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Failed to get content volume settings');

      // Reconnect for other tests
      await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/test-ai-aggregator');
    });
  });
});