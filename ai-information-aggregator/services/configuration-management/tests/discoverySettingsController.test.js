const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require('../index');
const DiscoverySettings = require('../models/DiscoverySettings');

// Mock auth middleware
jest.mock('../middleware/auth', () => (req, res, next) => {
  req.user = { id: 'test-user-id' };
  next();
});

describe('Discovery Settings Controller', () => {
  let userId;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/test-ai-aggregator');
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await DiscoverySettings.deleteMany({});
    userId = new mongoose.Types.ObjectId().toString();
  });

  describe('GET /api/discovery-settings/:userId', () => {
    test('should get discovery settings for user', async () => {
      const response = await request(app)
        .get(`/api/discovery-settings/${userId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.userId).toBe(userId);
      expect(response.body.data.aggressivenessLevel).toBe(0.5);
    });

    test('should return 400 for missing userId', async () => {
      const response = await request(app)
        .get('/api/discovery-settings/')
        .expect(404); // Route not found without userId
    });

    test('should create default settings for new user', async () => {
      const newUserId = new mongoose.Types.ObjectId().toString();
      
      const response = await request(app)
        .get(`/api/discovery-settings/${newUserId}`)
        .expect(200);

      expect(response.body.data.aggressivenessLevel).toBe(0.5);
      expect(response.body.data.autoInclusionThreshold).toBe(0.7);
    });
  });

  describe('PUT /api/discovery-settings/:userId', () => {
    test('should update discovery settings', async () => {
      const updates = {
        aggressivenessLevel: 0.8,
        autoInclusionThreshold: 0.6,
        sourceDiscoverySettings: {
          enableReferenceDiscovery: false,
          maxDiscoveryDepth: 3
        }
      };

      const response = await request(app)
        .put(`/api/discovery-settings/${userId}`)
        .send(updates)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.aggressivenessLevel).toBe(0.8);
      expect(response.body.data.autoInclusionThreshold).toBe(0.6);
      expect(response.body.data.sourceDiscoverySettings.enableReferenceDiscovery).toBe(false);
      expect(response.body.data.sourceDiscoverySettings.maxDiscoveryDepth).toBe(3);
    });

    test('should validate update data', async () => {
      const invalidUpdates = {
        aggressivenessLevel: 1.5, // Invalid range
        autoInclusionThreshold: -0.1 // Invalid range
      };

      const response = await request(app)
        .put(`/api/discovery-settings/${userId}`)
        .send(invalidUpdates)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid settings data');
    });

    test('should filter out disallowed fields', async () => {
      const updates = {
        aggressivenessLevel: 0.8,
        invalidField: 'should be ignored',
        _id: 'should be ignored'
      };

      const response = await request(app)
        .put(`/api/discovery-settings/${userId}`)
        .send(updates)
        .expect(200);

      expect(response.body.data.aggressivenessLevel).toBe(0.8);
      expect(response.body.data.invalidField).toBeUndefined();
    });
  });

  describe('PUT /api/discovery-settings/:userId/aggressiveness', () => {
    test('should update aggressiveness level and auto-adjust settings', async () => {
      const response = await request(app)
        .put(`/api/discovery-settings/${userId}/aggressiveness`)
        .send({ aggressivenessLevel: 0.8 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.aggressivenessLevel).toBe(0.8);
      expect(response.body.data.autoInclusionThreshold).toBeLessThan(0.7); // Should be adjusted
    });

    test('should validate aggressiveness level range', async () => {
      const response = await request(app)
        .put(`/api/discovery-settings/${userId}/aggressiveness`)
        .send({ aggressivenessLevel: 1.5 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('between 0 and 1');
    });

    test('should require aggressiveness level', async () => {
      const response = await request(app)
        .put(`/api/discovery-settings/${userId}/aggressiveness`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/discovery-settings/:userId/config', () => {
    test('should get discovery configuration', async () => {
      const response = await request(app)
        .get(`/api/discovery-settings/${userId}/config`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('aggressivenessLevel');
      expect(response.body.data).toHaveProperty('autoInclusionThreshold');
      expect(response.body.data).toHaveProperty('sourceDiscoverySettings');
      expect(response.body.data).toHaveProperty('contentTypeThresholds');
    });
  });

  describe('POST /api/discovery-settings/:userId/threshold', () => {
    test('should calculate effective threshold', async () => {
      const requestBody = {
        contentType: 'article',
        context: { isPreferredTopic: true }
      };

      const response = await request(app)
        .post(`/api/discovery-settings/${userId}/threshold`)
        .send(requestBody)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.contentType).toBe('article');
      expect(response.body.data.effectiveThreshold).toBeDefined();
      expect(response.body.data.baseThreshold).toBeDefined();
      expect(response.body.data.effectiveThreshold).toBeLessThan(response.body.data.baseThreshold);
    });

    test('should require content type', async () => {
      const response = await request(app)
        .post(`/api/discovery-settings/${userId}/threshold`)
        .send({ context: {} })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Content type is required');
    });
  });

  describe('POST /api/discovery-settings/:userId/evaluate', () => {
    test('should evaluate content for auto-inclusion', async () => {
      const requestBody = {
        content: {
          type: 'article',
          title: 'Test Article',
          sourceCredibility: 0.8,
          contentLength: 500
        },
        relevanceScore: 0.8,
        context: { isRecent: true }
      };

      const response = await request(app)
        .post(`/api/discovery-settings/${userId}/evaluate`)
        .send(requestBody)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.shouldAutoInclude).toBe(true);
      expect(response.body.data.shouldQueueForReview).toBe(false);
      expect(response.body.data.shouldReject).toBe(false);
    });

    test('should evaluate content for manual review', async () => {
      const requestBody = {
        content: {
          type: 'article',
          title: 'Test Article',
          sourceCredibility: 0.8,
          contentLength: 500
        },
        relevanceScore: 0.5, // Between thresholds
        context: {}
      };

      const response = await request(app)
        .post(`/api/discovery-settings/${userId}/evaluate`)
        .send(requestBody)
        .expect(200);

      expect(response.body.data.shouldAutoInclude).toBe(false);
      expect(response.body.data.shouldQueueForReview).toBe(true);
      expect(response.body.data.shouldReject).toBe(false);
    });

    test('should evaluate content for rejection', async () => {
      const requestBody = {
        content: {
          type: 'article',
          title: 'Test Article',
          sourceCredibility: 0.8,
          contentLength: 500
        },
        relevanceScore: 0.2, // Below all thresholds
        context: {}
      };

      const response = await request(app)
        .post(`/api/discovery-settings/${userId}/evaluate`)
        .send(requestBody)
        .expect(200);

      expect(response.body.data.shouldAutoInclude).toBe(false);
      expect(response.body.data.shouldQueueForReview).toBe(false);
      expect(response.body.data.shouldReject).toBe(true);
    });

    test('should require content and relevance score', async () => {
      const response = await request(app)
        .post(`/api/discovery-settings/${userId}/evaluate`)
        .send({ content: { type: 'article' } })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('relevance score are required');
    });
  });

  describe('DELETE /api/discovery-settings/:userId', () => {
    test('should reset settings to defaults', async () => {
      // First create custom settings
      await request(app)
        .put(`/api/discovery-settings/${userId}`)
        .send({ aggressivenessLevel: 0.8 });

      // Then reset
      const response = await request(app)
        .delete(`/api/discovery-settings/${userId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.aggressivenessLevel).toBe(0.5); // Back to default
    });
  });

  describe('GET /api/discovery-settings/presets', () => {
    test('should get preset configurations', async () => {
      const response = await request(app)
        .get('/api/discovery-settings/presets')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('conservative');
      expect(response.body.data).toHaveProperty('moderate');
      expect(response.body.data).toHaveProperty('aggressive');
      
      expect(response.body.data.conservative.aggressivenessLevel).toBe(0.2);
      expect(response.body.data.moderate.aggressivenessLevel).toBe(0.5);
      expect(response.body.data.aggressive.aggressivenessLevel).toBe(0.8);
    });
  });

  describe('POST /api/discovery-settings/:userId/preset', () => {
    test('should apply conservative preset', async () => {
      const response = await request(app)
        .post(`/api/discovery-settings/${userId}/preset`)
        .send({ preset: 'conservative' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.aggressivenessLevel).toBe(0.2);
      expect(response.body.message).toContain('Conservative preset applied');
    });

    test('should apply moderate preset', async () => {
      const response = await request(app)
        .post(`/api/discovery-settings/${userId}/preset`)
        .send({ preset: 'moderate' })
        .expect(200);

      expect(response.body.data.aggressivenessLevel).toBe(0.5);
    });

    test('should apply aggressive preset', async () => {
      const response = await request(app)
        .post(`/api/discovery-settings/${userId}/preset`)
        .send({ preset: 'aggressive' })
        .expect(200);

      expect(response.body.data.aggressivenessLevel).toBe(0.8);
    });

    test('should validate preset name', async () => {
      const response = await request(app)
        .post(`/api/discovery-settings/${userId}/preset`)
        .send({ preset: 'invalid' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid preset');
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors gracefully', async () => {
      // Mock a database error
      jest.spyOn(DiscoverySettings, 'findOne').mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .get(`/api/discovery-settings/${userId}`)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Failed to get discovery settings');

      // Restore the mock
      DiscoverySettings.findOne.mockRestore();
    });
  });
});