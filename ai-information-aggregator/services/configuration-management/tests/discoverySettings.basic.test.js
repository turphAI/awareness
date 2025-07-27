const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require('../index');
const DiscoverySettings = require('../models/DiscoverySettings');

// Mock auth middleware
jest.mock('../middleware/auth', () => (req, res, next) => {
  req.user = { id: 'test-user-id' };
  next();
});

describe('Discovery Settings Basic Integration', () => {
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

  describe('Basic Discovery Settings Workflow', () => {
    test('should create, update, and evaluate content with discovery settings', async () => {
      // 1. Get initial settings (should create defaults)
      const initialResponse = await request(app)
        .get(`/api/discovery-settings/${userId}`)
        .expect(200);

      expect(initialResponse.body.data.aggressivenessLevel).toBe(0.5);
      expect(initialResponse.body.data.autoInclusionThreshold).toBe(0.7);

      // 2. Update aggressiveness to be more aggressive
      const updateResponse = await request(app)
        .put(`/api/discovery-settings/${userId}/aggressiveness`)
        .send({ aggressivenessLevel: 0.8 })
        .expect(200);

      expect(updateResponse.body.data.aggressivenessLevel).toBe(0.8);
      expect(updateResponse.body.data.autoInclusionThreshold).toBeLessThan(0.7);

      // 3. Evaluate content with the new settings
      const content = {
        type: 'article',
        title: 'AI Breakthrough in Natural Language Processing',
        sourceCredibility: 0.8,
        contentLength: 1500
      };

      const evaluateResponse = await request(app)
        .post(`/api/discovery-settings/${userId}/evaluate`)
        .send({
          content,
          relevanceScore: 0.6,
          context: { isRecent: true }
        })
        .expect(200);

      // With aggressive settings and recent content boost, this should be auto-included
      expect(evaluateResponse.body.data.shouldAutoInclude).toBe(true);

      // 4. Test with conservative settings
      await request(app)
        .post(`/api/discovery-settings/${userId}/preset`)
        .send({ preset: 'conservative' })
        .expect(200);

      const conservativeEvaluateResponse = await request(app)
        .post(`/api/discovery-settings/${userId}/evaluate`)
        .send({
          content,
          relevanceScore: 0.6,
          context: {}
        })
        .expect(200);

      // With conservative settings, this should be queued for review or rejected
      expect(conservativeEvaluateResponse.body.data.shouldAutoInclude).toBe(false);
    });

    test('should handle different content types with appropriate thresholds', async () => {
      // Set moderate aggressiveness
      await request(app)
        .put(`/api/discovery-settings/${userId}/aggressiveness`)
        .send({ aggressivenessLevel: 0.5 });

      const contentTypes = [
        { type: 'paper', expectedHigherThreshold: true },
        { type: 'article', expectedHigherThreshold: false },
        { type: 'social', expectedHigherThreshold: false }
      ];

      for (const { type, expectedHigherThreshold } of contentTypes) {
        const thresholdResponse = await request(app)
          .post(`/api/discovery-settings/${userId}/threshold`)
          .send({ contentType: type })
          .expect(200);

        if (expectedHigherThreshold) {
          expect(thresholdResponse.body.data.effectiveThreshold).toBeGreaterThan(0.6);
        } else {
          expect(thresholdResponse.body.data.effectiveThreshold).toBeLessThanOrEqual(0.6);
        }
      }
    });

    test('should apply context-based adjustments correctly', async () => {
      const content = {
        type: 'article',
        title: 'Test Article',
        sourceCredibility: 0.7,
        contentLength: 800
      };

      const contexts = [
        { context: { isPreferredTopic: true }, shouldBoost: true },
        { context: { isNonPreferredTopic: true }, shouldPenalize: true },
        { context: { isRecent: true }, shouldBoost: true },
        { context: { isOld: true }, shouldPenalize: true },
        { context: { isBreakingNews: true }, shouldBoost: true }
      ];

      for (const { context, shouldBoost, shouldPenalize } of contexts) {
        const evaluateResponse = await request(app)
          .post(`/api/discovery-settings/${userId}/evaluate`)
          .send({
            content,
            relevanceScore: 0.55, // Borderline score
            context
          })
          .expect(200);

        if (shouldBoost) {
          // Boosted content is more likely to be auto-included
          expect(
            evaluateResponse.body.data.shouldAutoInclude || 
            evaluateResponse.body.data.shouldQueueForReview
          ).toBe(true);
        }

        if (shouldPenalize) {
          // Penalized content is less likely to be auto-included
          expect(evaluateResponse.body.data.shouldAutoInclude).toBe(false);
        }
      }
    });

    test('should respect quality filters', async () => {
      // Update settings to have strict quality filters
      await request(app)
        .put(`/api/discovery-settings/${userId}`)
        .send({
          qualityFilters: {
            minSourceCredibility: 0.8,
            minContentLength: 1000,
            enableDuplicateFiltering: true
          }
        })
        .expect(200);

      // Test content that fails quality filters
      const lowQualityContent = {
        type: 'article',
        title: 'Short Article',
        sourceCredibility: 0.5, // Below minimum
        contentLength: 500 // Below minimum
      };

      const evaluateResponse = await request(app)
        .post(`/api/discovery-settings/${userId}/evaluate`)
        .send({
          content: lowQualityContent,
          relevanceScore: 0.9, // High relevance but low quality
          context: {}
        })
        .expect(200);

      expect(evaluateResponse.body.data.shouldAutoInclude).toBe(false);
      expect(evaluateResponse.body.data.shouldReject).toBe(true);
    });

    test('should provide discovery configuration for external services', async () => {
      const configResponse = await request(app)
        .get(`/api/discovery-settings/${userId}/config`)
        .expect(200);

      const config = configResponse.body.data;
      
      expect(config).toHaveProperty('aggressivenessLevel');
      expect(config).toHaveProperty('autoInclusionThreshold');
      expect(config).toHaveProperty('sourceDiscoverySettings');
      expect(config.sourceDiscoverySettings).toHaveProperty('enableReferenceDiscovery');
      expect(config.sourceDiscoverySettings).toHaveProperty('maxDiscoveryDepth');
      expect(config).toHaveProperty('contentTypeThresholds');
      expect(config).toHaveProperty('qualityFilters');
    });
  });

  describe('Preset Configurations', () => {
    test('should apply and work with all preset configurations', async () => {
      const presets = ['conservative', 'moderate', 'aggressive'];
      const testContent = {
        type: 'article',
        title: 'Test Article',
        sourceCredibility: 0.7,
        contentLength: 800
      };

      for (const preset of presets) {
        // Apply preset
        await request(app)
          .post(`/api/discovery-settings/${userId}/preset`)
          .send({ preset })
          .expect(200);

        // Test with borderline content
        const evaluateResponse = await request(app)
          .post(`/api/discovery-settings/${userId}/evaluate`)
          .send({
            content: testContent,
            relevanceScore: 0.55,
            context: {}
          })
          .expect(200);

        // Conservative should be most restrictive, aggressive should be most permissive
        if (preset === 'conservative') {
          expect(evaluateResponse.body.data.shouldAutoInclude).toBe(false);
        } else if (preset === 'aggressive') {
          expect(
            evaluateResponse.body.data.shouldAutoInclude || 
            evaluateResponse.body.data.shouldQueueForReview
          ).toBe(true);
        }
      }
    });
  });
});