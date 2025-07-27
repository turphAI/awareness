const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require('../index');
const SummaryPreferences = require('../models/SummaryPreferences');

// Mock the auth middleware
jest.mock('../middleware/auth', () => (req, res, next) => {
  req.user = { id: 'test-user-id' };
  next();
});

describe('Summary Preferences Controller', () => {
  let testUserId;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ai-aggregator-test');
    testUserId = new mongoose.Types.ObjectId().toString();
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await SummaryPreferences.deleteMany({});
  });

  describe('GET /api/summary-preferences/:userId', () => {
    test('should get summary preferences for user', async () => {
      const response = await request(app)
        .get(`/api/summary-preferences/${testUserId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.userId).toBe(testUserId);
      expect(response.body.data.defaultLength).toBe('standard');
    });

    test('should return 400 for missing userId', async () => {
      const response = await request(app)
        .get('/api/summary-preferences/')
        .expect(404);
    });
  });

  describe('PUT /api/summary-preferences/:userId', () => {
    test('should update summary preferences', async () => {
      const updates = {
        defaultLength: 'detailed',
        adaptiveSettings: {
          enabled: false,
          basedOnReadingSpeed: false
        }
      };

      const response = await request(app)
        .put(`/api/summary-preferences/${testUserId}`)
        .send(updates)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.defaultLength).toBe('detailed');
      expect(response.body.data.adaptiveSettings.enabled).toBe(false);
      expect(response.body.message).toBe('Summary preferences updated successfully');
    });

    test('should validate length enum values', async () => {
      const updates = {
        defaultLength: 'invalid'
      };

      const response = await request(app)
        .put(`/api/summary-preferences/${testUserId}`)
        .send(updates)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid preferences data');
    });

    test('should validate configuration after update', async () => {
      const updates = {
        lengthParameters: {
          brief: {
            maxWords: 10, // Below minimum
            maxSentences: 1
          }
        }
      };

      const response = await request(app)
        .put(`/api/summary-preferences/${testUserId}`)
        .send(updates)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid preferences data');
      expect(response.body.errors).toBeDefined();
    });

    test('should filter allowed fields', async () => {
      const updates = {
        defaultLength: 'detailed',
        unauthorizedField: 'should be ignored',
        userId: 'should not change'
      };

      const response = await request(app)
        .put(`/api/summary-preferences/${testUserId}`)
        .send(updates)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.defaultLength).toBe('detailed');
      expect(response.body.data.userId).toBe(testUserId);
      expect(response.body.data.unauthorizedField).toBeUndefined();
    });
  });

  describe('GET /api/summary-preferences/:userId/parameters', () => {
    test('should get summary parameters for content type', async () => {
      const response = await request(app)
        .get(`/api/summary-preferences/${testUserId}/parameters`)
        .query({ contentType: 'article' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.contentType).toBe('article');
      expect(response.body.data.parameters.length).toBe('standard');
      expect(response.body.data.parameters.maxWords).toBe(150);
      expect(response.body.data.parameters.includeKeyInsights).toBe(true);
    });

    test('should use override length when provided', async () => {
      const response = await request(app)
        .get(`/api/summary-preferences/${testUserId}/parameters`)
        .query({ contentType: 'article', overrideLength: 'comprehensive' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.parameters.length).toBe('comprehensive');
      expect(response.body.data.parameters.maxWords).toBe(500);
      expect(response.body.data.overrideLength).toBe('comprehensive');
    });

    test('should return 400 for missing content type', async () => {
      const response = await request(app)
        .get(`/api/summary-preferences/${testUserId}/parameters`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Content type is required');
    });

    test('should return 400 for invalid content type', async () => {
      const response = await request(app)
        .get(`/api/summary-preferences/${testUserId}/parameters`)
        .query({ contentType: 'invalid' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid content type');
    });
  });

  describe('POST /api/summary-preferences/:userId/adaptive-length', () => {
    test('should calculate adaptive length', async () => {
      const requestBody = {
        contentType: 'article',
        userContext: {
          availableTimeMinutes: 10
        }
      };

      const response = await request(app)
        .post(`/api/summary-preferences/${testUserId}/adaptive-length`)
        .send(requestBody)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.contentType).toBe('article');
      expect(response.body.data.adaptiveLength).toBeDefined();
      expect(response.body.data.parameters).toBeDefined();
      expect(response.body.data.adaptiveSettings).toBeDefined();
      expect(response.body.data.userBehaviorMetrics).toBeDefined();
    });

    test('should return 400 for missing content type', async () => {
      const response = await request(app)
        .post(`/api/summary-preferences/${testUserId}/adaptive-length`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Content type is required');
    });
  });

  describe('PUT /api/summary-preferences/:userId/behavior-metrics', () => {
    test('should update behavior metrics', async () => {
      const metrics = {
        averageReadingSpeed: 250,
        preferredSummaryLength: 'detailed',
        engagementWithSummaries: 0.8
      };

      const response = await request(app)
        .put(`/api/summary-preferences/${testUserId}/behavior-metrics`)
        .send(metrics)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.userBehaviorMetrics.averageReadingSpeed).toBe(250);
      expect(response.body.data.userBehaviorMetrics.preferredSummaryLength).toBe('detailed');
      expect(response.body.data.userBehaviorMetrics.engagementWithSummaries).toBe(0.8);
      expect(response.body.message).toBe('User behavior metrics updated successfully');
    });

    test('should handle partial metric updates', async () => {
      const metrics = {
        averageReadingSpeed: 300
      };

      const response = await request(app)
        .put(`/api/summary-preferences/${testUserId}/behavior-metrics`)
        .send(metrics)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.userBehaviorMetrics.averageReadingSpeed).toBe(300);
      // Other metrics should remain at defaults
      expect(response.body.data.userBehaviorMetrics.preferredSummaryLength).toBe('standard');
    });
  });

  describe('PUT /api/summary-preferences/:userId/content-type', () => {
    test('should update content type preferences', async () => {
      const requestBody = {
        contentType: 'article',
        preferences: {
          length: 'detailed',
          includeKeyInsights: false,
          includeReferences: false
        }
      };

      const response = await request(app)
        .put(`/api/summary-preferences/${testUserId}/content-type`)
        .send(requestBody)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.contentTypePreferences.article.length).toBe('detailed');
      expect(response.body.data.contentTypePreferences.article.includeKeyInsights).toBe(false);
      expect(response.body.data.contentTypePreferences.article.includeReferences).toBe(false);
      expect(response.body.message).toBe('article preferences updated successfully');
    });

    test('should return 400 for invalid content type', async () => {
      const requestBody = {
        contentType: 'invalid',
        preferences: { length: 'detailed' }
      };

      const response = await request(app)
        .put(`/api/summary-preferences/${testUserId}/content-type`)
        .send(requestBody)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid content type');
    });
  });

  describe('PUT /api/summary-preferences/:userId/length-parameters', () => {
    test('should update length parameters', async () => {
      const requestBody = {
        lengthType: 'brief',
        parameters: {
          maxWords: 75,
          maxSentences: 4
        }
      };

      const response = await request(app)
        .put(`/api/summary-preferences/${testUserId}/length-parameters`)
        .send(requestBody)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.lengthParameters.brief.maxWords).toBe(75);
      expect(response.body.data.lengthParameters.brief.maxSentences).toBe(4);
      expect(response.body.message).toBe('brief length parameters updated successfully');
    });

    test('should validate length parameters', async () => {
      // First create valid preferences, then try to update with invalid parameters
      await SummaryPreferences.create({ userId: testUserId });
      
      const requestBody = {
        lengthType: 'brief',
        parameters: {
          maxWords: 10, // Below minimum
          maxSentences: 1
        }
      };

      const response = await request(app)
        .put(`/api/summary-preferences/${testUserId}/length-parameters`)
        .send(requestBody)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid length parameters');
      expect(response.body.errors).toContain('Invalid maxWords for brief: must be between 20 and 1000');
    });

    test('should return 400 for invalid length type', async () => {
      const requestBody = {
        lengthType: 'invalid',
        parameters: { maxWords: 100 }
      };

      const response = await request(app)
        .put(`/api/summary-preferences/${testUserId}/length-parameters`)
        .send(requestBody)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid length type');
    });
  });

  describe('DELETE /api/summary-preferences/:userId', () => {
    test('should reset preferences to defaults', async () => {
      // First create custom preferences
      await SummaryPreferences.create({
        userId: testUserId,
        defaultLength: 'comprehensive'
      });

      const response = await request(app)
        .delete(`/api/summary-preferences/${testUserId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.defaultLength).toBe('standard'); // Back to default
      expect(response.body.message).toBe('Summary preferences reset to defaults');
    });
  });

  describe('GET /api/summary-preferences/length-types/info', () => {
    test('should get length types information', async () => {
      const response = await request(app)
        .get('/api/summary-preferences/length-types/info')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.brief).toBeDefined();
      expect(response.body.data.standard).toBeDefined();
      expect(response.body.data.detailed).toBeDefined();
      expect(response.body.data.comprehensive).toBeDefined();
      
      expect(response.body.data.brief.name).toBe('Brief');
      expect(response.body.data.brief.defaultMaxWords).toBe(50);
      expect(response.body.data.standard.defaultMaxWords).toBe(150);
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors gracefully', async () => {
      // Mock a database error
      jest.spyOn(SummaryPreferences, 'getOrCreateForUser').mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .get(`/api/summary-preferences/${testUserId}`)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Failed to get summary preferences');

      // Restore the mock
      SummaryPreferences.getOrCreateForUser.mockRestore();
    });

    test('should handle validation errors in updates', async () => {
      const updates = {
        defaultLength: 'invalid-length'
      };

      const response = await request(app)
        .put(`/api/summary-preferences/${testUserId}`)
        .send(updates)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid preferences data');
      expect(response.body.errors).toBeDefined();
    });
  });
});