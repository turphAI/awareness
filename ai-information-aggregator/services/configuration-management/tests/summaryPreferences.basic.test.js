const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require('../index');
const SummaryPreferences = require('../models/SummaryPreferences');

// Mock the auth middleware
jest.mock('../middleware/auth', () => (req, res, next) => {
  req.user = { id: 'test-user-id' };
  next();
});

describe('Summary Preferences Basic Integration', () => {
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

  test('should complete full workflow: create, update, get parameters, and reset', async () => {
    // 1. Get initial preferences (should create defaults)
    const getResponse = await request(app)
      .get(`/api/summary-preferences/${testUserId}`)
      .expect(200);

    expect(getResponse.body.success).toBe(true);
    expect(getResponse.body.data.defaultLength).toBe('standard');

    // 2. Update preferences
    const updateResponse = await request(app)
      .put(`/api/summary-preferences/${testUserId}`)
      .send({
        defaultLength: 'detailed',
        contentTypePreferences: {
          article: {
            length: 'comprehensive',
            includeKeyInsights: true,
            includeReferences: true
          }
        }
      })
      .expect(200);

    expect(updateResponse.body.success).toBe(true);
    expect(updateResponse.body.data.defaultLength).toBe('detailed');
    expect(updateResponse.body.data.contentTypePreferences.article.length).toBe('comprehensive');

    // 3. Get summary parameters for article
    const parametersResponse = await request(app)
      .get(`/api/summary-preferences/${testUserId}/parameters`)
      .query({ contentType: 'article' })
      .expect(200);

    expect(parametersResponse.body.success).toBe(true);
    expect(parametersResponse.body.data.parameters.length).toBe('comprehensive');
    expect(parametersResponse.body.data.parameters.maxWords).toBe(500);
    expect(parametersResponse.body.data.parameters.includeKeyInsights).toBe(true);

    // 4. Update behavior metrics
    const metricsResponse = await request(app)
      .put(`/api/summary-preferences/${testUserId}/behavior-metrics`)
      .send({
        averageReadingSpeed: 300,
        engagementWithSummaries: 0.9
      })
      .expect(200);

    expect(metricsResponse.body.success).toBe(true);
    expect(metricsResponse.body.data.userBehaviorMetrics.averageReadingSpeed).toBe(300);
    expect(metricsResponse.body.data.userBehaviorMetrics.engagementWithSummaries).toBe(0.9);

    // 5. Calculate adaptive length
    const adaptiveResponse = await request(app)
      .post(`/api/summary-preferences/${testUserId}/adaptive-length`)
      .send({
        contentType: 'article',
        userContext: { availableTimeMinutes: 15 }
      })
      .expect(200);

    expect(adaptiveResponse.body.success).toBe(true);
    expect(adaptiveResponse.body.data.adaptiveLength).toBeDefined();
    expect(adaptiveResponse.body.data.parameters).toBeDefined();

    // 6. Reset preferences
    const resetResponse = await request(app)
      .delete(`/api/summary-preferences/${testUserId}`)
      .expect(200);

    expect(resetResponse.body.success).toBe(true);
    expect(resetResponse.body.data.defaultLength).toBe('standard'); // Back to default
  });

  test('should handle different content types correctly', async () => {
    // Test parameters for different content types
    const contentTypes = ['article', 'paper', 'podcast', 'video', 'social'];
    
    for (const contentType of contentTypes) {
      const response = await request(app)
        .get(`/api/summary-preferences/${testUserId}/parameters`)
        .query({ contentType })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.contentType).toBe(contentType);
      expect(response.body.data.parameters.length).toBeDefined();
      expect(response.body.data.parameters.maxWords).toBeGreaterThan(0);
      expect(response.body.data.parameters.maxSentences).toBeGreaterThan(0);
    }
  });

  test('should provide length types information', async () => {
    const response = await request(app)
      .get('/api/summary-preferences/length-types/info')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
    
    const lengthTypes = ['brief', 'standard', 'detailed', 'comprehensive'];
    for (const lengthType of lengthTypes) {
      expect(response.body.data[lengthType]).toBeDefined();
      expect(response.body.data[lengthType].name).toBeDefined();
      expect(response.body.data[lengthType].description).toBeDefined();
      expect(response.body.data[lengthType].defaultMaxWords).toBeGreaterThan(0);
      expect(response.body.data[lengthType].defaultMaxSentences).toBeGreaterThan(0);
    }
  });

  test('should handle adaptive length calculation with different user contexts', async () => {
    // Update user metrics to test adaptive behavior
    await request(app)
      .put(`/api/summary-preferences/${testUserId}/behavior-metrics`)
      .send({
        averageReadingSpeed: 400, // Fast reader
        engagementWithSummaries: 0.9 // High engagement
      })
      .expect(200);

    // Test with short time constraint
    const shortTimeResponse = await request(app)
      .post(`/api/summary-preferences/${testUserId}/adaptive-length`)
      .send({
        contentType: 'article',
        userContext: { availableTimeMinutes: 1 }
      })
      .expect(200);

    expect(shortTimeResponse.body.data.adaptiveLength).toBe('brief');

    // Test with long time available
    const longTimeResponse = await request(app)
      .post(`/api/summary-preferences/${testUserId}/adaptive-length`)
      .send({
        contentType: 'article',
        userContext: { availableTimeMinutes: 30 }
      })
      .expect(200);

    // Should be longer than brief due to fast reading speed and high engagement
    expect(['standard', 'detailed', 'comprehensive']).toContain(longTimeResponse.body.data.adaptiveLength);
  });

  test('should update content type preferences correctly', async () => {
    const contentTypes = [
      {
        type: 'paper',
        preferences: {
          length: 'comprehensive',
          includeMethodology: true,
          includeResults: true,
          includeKeyInsights: true
        }
      },
      {
        type: 'podcast',
        preferences: {
          length: 'detailed',
          includeTimestamps: true,
          includeKeyInsights: false
        }
      }
    ];

    for (const { type, preferences } of contentTypes) {
      const response = await request(app)
        .put(`/api/summary-preferences/${testUserId}/content-type`)
        .send({
          contentType: type,
          preferences
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.contentTypePreferences[type].length).toBe(preferences.length);
      
      // Verify the preferences were applied
      const parametersResponse = await request(app)
        .get(`/api/summary-preferences/${testUserId}/parameters`)
        .query({ contentType: type })
        .expect(200);

      expect(parametersResponse.body.data.parameters.length).toBe(preferences.length);
    }
  });

  test('should update length parameters and validate them', async () => {
    // Update valid length parameters
    const validUpdate = await request(app)
      .put(`/api/summary-preferences/${testUserId}/length-parameters`)
      .send({
        lengthType: 'standard',
        parameters: {
          maxWords: 200,
          maxSentences: 10
        }
      })
      .expect(200);

    expect(validUpdate.body.success).toBe(true);
    expect(validUpdate.body.data.lengthParameters.standard.maxWords).toBe(200);
    expect(validUpdate.body.data.lengthParameters.standard.maxSentences).toBe(10);

    // Verify the updated parameters are used
    const parametersResponse = await request(app)
      .get(`/api/summary-preferences/${testUserId}/parameters`)
      .query({ contentType: 'article' }) // article uses 'standard' by default
      .expect(200);

    expect(parametersResponse.body.data.parameters.maxWords).toBe(200);
    expect(parametersResponse.body.data.parameters.maxSentences).toBe(10);
  });
});