const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require('../index');
const ContentVolumeSettings = require('../models/ContentVolumeSettings');

describe('Content Volume Control - Basic Integration', () => {
  const testUserId = new mongoose.Types.ObjectId();

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/test-ai-aggregator');
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await ContentVolumeSettings.deleteMany({});
  });

  test('should complete full volume control workflow', async () => {
    // Step 1: Get initial settings (should create defaults)
    const initialResponse = await request(app)
      .get(`/api/content-volume/${testUserId}`)
      .expect(200);

    expect(initialResponse.body.success).toBe(true);
    expect(initialResponse.body.data.dailyLimit).toBe(50);
    expect(initialResponse.body.data.adaptiveEnabled).toBe(true);

    // Step 2: Update settings
    const updateResponse = await request(app)
      .put(`/api/content-volume/${testUserId}`)
      .send({
        dailyLimit: 30,
        priorityThreshold: 0.8,
        contentTypeWeights: {
          article: 0.9,
          paper: 1.0,
          podcast: 0.7
        }
      })
      .expect(200);

    expect(updateResponse.body.success).toBe(true);
    expect(updateResponse.body.data.dailyLimit).toBe(30);
    expect(updateResponse.body.data.priorityThreshold).toBe(0.8);

    // Step 3: Update behavior metrics to simulate high engagement
    const behaviorResponse = await request(app)
      .put(`/api/content-volume/${testUserId}/behavior`)
      .send({
        averageReadTime: 180,
        completionRate: 0.9,
        engagementScore: 0.85
      })
      .expect(200);

    expect(behaviorResponse.body.success).toBe(true);
    expect(behaviorResponse.body.data.userBehaviorMetrics.completionRate).toBe(0.9);

    // Step 4: Get adaptive limit (should be higher due to high engagement)
    const adaptiveResponse = await request(app)
      .get(`/api/content-volume/${testUserId}/adaptive-limit`)
      .expect(200);

    expect(adaptiveResponse.body.success).toBe(true);
    expect(adaptiveResponse.body.data.baseLimit).toBe(30);
    expect(adaptiveResponse.body.data.adaptiveLimit).toBeGreaterThan(30);

    // Step 5: Prioritize content
    const contentList = [
      { id: 1, type: 'article', relevanceScore: 0.9 },  // 0.9 * 0.9 = 0.81
      { id: 2, type: 'paper', relevanceScore: 0.8 },    // 0.8 * 1.0 = 0.80
      { id: 3, type: 'podcast', relevanceScore: 0.85 }, // 0.85 * 0.7 = 0.595 (below threshold)
      { id: 4, type: 'video', relevanceScore: 0.6 },    // 0.6 * 0.6 = 0.36 (below threshold)
      { id: 5, type: 'social', relevanceScore: 0.7 },   // 0.7 * 0.4 = 0.28 (below threshold)
      { id: 6, type: 'article', relevanceScore: 0.75 }  // 0.75 * 0.9 = 0.675 (below threshold)
    ];

    const prioritizeResponse = await request(app)
      .post(`/api/content-volume/${testUserId}/prioritize`)
      .send({ contentList })
      .expect(200);

    expect(prioritizeResponse.body.success).toBe(true);
    expect(prioritizeResponse.body.data.totalOriginal).toBe(6);
    
    const prioritized = prioritizeResponse.body.data.prioritizedContent;
    expect(prioritized.length).toBeGreaterThan(0);
    expect(prioritized.length).toBeLessThanOrEqual(adaptiveResponse.body.data.adaptiveLimit);

    // Verify content is properly prioritized by score
    for (let i = 0; i < prioritized.length - 1; i++) {
      expect(prioritized[i].priorityScore).toBeGreaterThanOrEqual(prioritized[i + 1].priorityScore);
    }

    // Verify all prioritized content meets threshold (0.8)
    prioritized.forEach(item => {
      expect(item.priorityScore).toBeGreaterThanOrEqual(0.8);
    });

    // Step 6: Reset settings
    const resetResponse = await request(app)
      .delete(`/api/content-volume/${testUserId}`)
      .expect(200);

    expect(resetResponse.body.success).toBe(true);
    expect(resetResponse.body.data.dailyLimit).toBe(50); // Back to default
    expect(resetResponse.body.data.priorityThreshold).toBe(0.7); // Back to default
  });

  test('should handle low engagement user scenario', async () => {
    // Create settings for low engagement user
    await request(app)
      .put(`/api/content-volume/${testUserId}`)
      .send({
        dailyLimit: 40,
        priorityThreshold: 0.6,
        adaptiveEnabled: true
      })
      .expect(200);

    // Update with low engagement metrics
    await request(app)
      .put(`/api/content-volume/${testUserId}/behavior`)
      .send({
        completionRate: 0.2,
        engagementScore: 0.1
      })
      .expect(200);

    // Get adaptive limit (should be lower)
    const adaptiveResponse = await request(app)
      .get(`/api/content-volume/${testUserId}/adaptive-limit`)
      .expect(200);

    expect(adaptiveResponse.body.data.baseLimit).toBe(40);
    expect(adaptiveResponse.body.data.adaptiveLimit).toBeLessThan(40);

    // Test prioritization with reduced limit
    const contentList = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      type: 'article',
      relevanceScore: 0.8
    }));

    const prioritizeResponse = await request(app)
      .post(`/api/content-volume/${testUserId}/prioritize`)
      .send({ contentList })
      .expect(200);

    expect(prioritizeResponse.body.data.prioritizedContent.length)
      .toBe(adaptiveResponse.body.data.adaptiveLimit);
  });

  test('should handle disabled adaptive mode', async () => {
    // Create settings with adaptive disabled
    await request(app)
      .put(`/api/content-volume/${testUserId}`)
      .send({
        dailyLimit: 25,
        adaptiveEnabled: false
      })
      .expect(200);

    // Update behavior metrics (should not affect limit)
    await request(app)
      .put(`/api/content-volume/${testUserId}/behavior`)
      .send({
        completionRate: 0.95,
        engagementScore: 0.9
      })
      .expect(200);

    // Get adaptive limit (should equal base limit)
    const adaptiveResponse = await request(app)
      .get(`/api/content-volume/${testUserId}/adaptive-limit`)
      .expect(200);

    expect(adaptiveResponse.body.data.baseLimit).toBe(25);
    expect(adaptiveResponse.body.data.adaptiveLimit).toBe(25);
    expect(adaptiveResponse.body.data.adaptiveEnabled).toBe(false);
  });

  test('should properly weight different content types', async () => {
    // Set custom content type weights
    await request(app)
      .put(`/api/content-volume/${testUserId}`)
      .send({
        dailyLimit: 5,
        priorityThreshold: 0.3,
        contentTypeWeights: {
          paper: 1.0,
          article: 0.8,
          podcast: 0.6,
          video: 0.4,
          social: 0.2
        }
      })
      .expect(200);

    // Create content with same relevance but different types
    const contentList = [
      { id: 1, type: 'social', relevanceScore: 0.8 },
      { id: 2, type: 'paper', relevanceScore: 0.8 },
      { id: 3, type: 'video', relevanceScore: 0.8 },
      { id: 4, type: 'article', relevanceScore: 0.8 },
      { id: 5, type: 'podcast', relevanceScore: 0.8 }
    ];

    const prioritizeResponse = await request(app)
      .post(`/api/content-volume/${testUserId}/prioritize`)
      .send({ contentList })
      .expect(200);

    const prioritized = prioritizeResponse.body.data.prioritizedContent;
    
    // Paper should be first (highest weight)
    expect(prioritized[0].type).toBe('paper');
    // Social should be last or not included (lowest weight)
    const socialItem = prioritized.find(item => item.type === 'social');
    if (socialItem) {
      expect(prioritized.indexOf(socialItem)).toBeGreaterThan(0);
    }
  });
});