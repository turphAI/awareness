const mongoose = require('mongoose');
const DiscoverySettings = require('../models/DiscoverySettings');

describe('DiscoverySettings Model', () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/test-ai-aggregator');
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await DiscoverySettings.deleteMany({});
  });

  describe('Schema Validation', () => {
    test('should create discovery settings with default values', async () => {
      const userId = new mongoose.Types.ObjectId();
      const settings = new DiscoverySettings({ userId });
      
      await settings.save();
      
      expect(settings.aggressivenessLevel).toBe(0.5);
      expect(settings.autoInclusionThreshold).toBe(0.7);
      expect(settings.manualReviewThreshold).toBe(0.4);
      expect(settings.sourceDiscoverySettings.enableReferenceDiscovery).toBe(true);
      expect(settings.sourceDiscoverySettings.maxDiscoveryDepth).toBe(2);
      expect(settings.contentTypeThresholds.article).toBe(0.6);
      expect(settings.contentTypeThresholds.paper).toBe(0.8);
    });

    test('should validate aggressiveness level range', async () => {
      const userId = new mongoose.Types.ObjectId();
      
      // Test invalid values
      const invalidSettings1 = new DiscoverySettings({ 
        userId, 
        aggressivenessLevel: -0.1 
      });
      await expect(invalidSettings1.save()).rejects.toThrow();
      
      const invalidSettings2 = new DiscoverySettings({ 
        userId, 
        aggressivenessLevel: 1.1 
      });
      await expect(invalidSettings2.save()).rejects.toThrow();
      
      // Test valid values
      const validSettings = new DiscoverySettings({ 
        userId, 
        aggressivenessLevel: 0.8 
      });
      await expect(validSettings.save()).resolves.toBeDefined();
    });

    test('should validate threshold ranges', async () => {
      const userId = new mongoose.Types.ObjectId();
      
      const invalidSettings = new DiscoverySettings({ 
        userId,
        autoInclusionThreshold: 1.5,
        manualReviewThreshold: -0.1
      });
      
      await expect(invalidSettings.save()).rejects.toThrow();
    });

    test('should enforce unique userId constraint', async () => {
      const userId = new mongoose.Types.ObjectId();
      
      const settings1 = new DiscoverySettings({ userId });
      await settings1.save();
      
      const settings2 = new DiscoverySettings({ userId });
      await expect(settings2.save()).rejects.toThrow();
    });
  });

  describe('Instance Methods', () => {
    let settings;
    let userId;

    beforeEach(async () => {
      userId = new mongoose.Types.ObjectId();
      settings = new DiscoverySettings({ userId });
      await settings.save();
    });

    describe('calculateEffectiveThreshold', () => {
      test('should return base threshold for default aggressiveness', () => {
        const threshold = settings.calculateEffectiveThreshold('article');
        expect(threshold).toBe(0.6); // Default article threshold
      });

      test('should adjust threshold based on aggressiveness level', () => {
        settings.aggressivenessLevel = 0.8; // High aggressiveness
        const threshold = settings.calculateEffectiveThreshold('article');
        expect(threshold).toBeLessThan(0.6); // Should be lower than base
      });

      test('should apply preferred topic boost', () => {
        const context = { isPreferredTopic: true };
        const threshold = settings.calculateEffectiveThreshold('article', context);
        const baseThreshold = settings.calculateEffectiveThreshold('article');
        expect(threshold).toBeLessThan(baseThreshold);
      });

      test('should apply non-preferred topic penalty', () => {
        const context = { isNonPreferredTopic: true };
        const threshold = settings.calculateEffectiveThreshold('article', context);
        const baseThreshold = settings.calculateEffectiveThreshold('article');
        expect(threshold).toBeGreaterThan(baseThreshold);
      });

      test('should apply recent content boost', () => {
        const context = { isRecent: true };
        const threshold = settings.calculateEffectiveThreshold('article', context);
        const baseThreshold = settings.calculateEffectiveThreshold('article');
        expect(threshold).toBeLessThan(baseThreshold);
      });

      test('should apply old content penalty', () => {
        const context = { isOld: true };
        const threshold = settings.calculateEffectiveThreshold('article', context);
        const baseThreshold = settings.calculateEffectiveThreshold('article');
        expect(threshold).toBeGreaterThan(baseThreshold);
      });

      test('should handle unknown content type', () => {
        const threshold = settings.calculateEffectiveThreshold('unknown');
        expect(threshold).toBe(settings.autoInclusionThreshold);
      });

      test('should keep threshold within bounds', () => {
        settings.aggressivenessLevel = 1.0; // Maximum aggressiveness
        const context = { isPreferredTopic: true, isRecent: true };
        const threshold = settings.calculateEffectiveThreshold('article', context);
        expect(threshold).toBeGreaterThanOrEqual(0);
        expect(threshold).toBeLessThanOrEqual(1);
      });
    });

    describe('shouldAutoInclude', () => {
      test('should auto-include content above threshold', () => {
        const content = { type: 'article', sourceCredibility: 0.8, contentLength: 500 };
        const relevanceScore = 0.8;
        
        const result = settings.shouldAutoInclude(content, relevanceScore);
        expect(result).toBe(true);
      });

      test('should not auto-include content below threshold', () => {
        const content = { type: 'article', sourceCredibility: 0.8, contentLength: 500 };
        const relevanceScore = 0.3;
        
        const result = settings.shouldAutoInclude(content, relevanceScore);
        expect(result).toBe(false);
      });

      test('should reject content below minimum source credibility', () => {
        settings.qualityFilters.minSourceCredibility = 0.5;
        const content = { type: 'article', sourceCredibility: 0.3, contentLength: 500 };
        const relevanceScore = 0.9;
        
        const result = settings.shouldAutoInclude(content, relevanceScore);
        expect(result).toBe(false);
      });

      test('should reject content below minimum length', () => {
        settings.qualityFilters.minContentLength = 200;
        const content = { type: 'article', sourceCredibility: 0.8, contentLength: 100 };
        const relevanceScore = 0.9;
        
        const result = settings.shouldAutoInclude(content, relevanceScore);
        expect(result).toBe(false);
      });

      test('should lower threshold for breaking news', () => {
        const content = { type: 'article', sourceCredibility: 0.8, contentLength: 500 };
        const relevanceScore = 0.5; // Below normal threshold
        const context = { isBreakingNews: true };
        
        const result = settings.shouldAutoInclude(content, relevanceScore, context);
        expect(result).toBe(true);
      });
    });

    describe('shouldQueueForReview', () => {
      test('should not queue auto-included content', () => {
        const content = { type: 'article', sourceCredibility: 0.8, contentLength: 500 };
        const relevanceScore = 0.8; // Above auto-inclusion threshold
        
        const result = settings.shouldQueueForReview(content, relevanceScore);
        expect(result).toBe(false);
      });

      test('should queue content above review threshold', () => {
        const content = { type: 'article', sourceCredibility: 0.8, contentLength: 500 };
        const relevanceScore = 0.5; // Between review and auto-inclusion thresholds
        
        const result = settings.shouldQueueForReview(content, relevanceScore);
        expect(result).toBe(true);
      });

      test('should not queue content below review threshold', () => {
        const content = { type: 'article', sourceCredibility: 0.8, contentLength: 500 };
        const relevanceScore = 0.2; // Below review threshold
        
        const result = settings.shouldQueueForReview(content, relevanceScore);
        expect(result).toBe(false);
      });
    });

    describe('updateFromAggressivenessLevel', () => {
      test('should update thresholds based on aggressiveness level', () => {
        const originalAutoThreshold = settings.autoInclusionThreshold;
        const originalReviewThreshold = settings.manualReviewThreshold;
        
        settings.updateFromAggressivenessLevel(0.8);
        
        expect(settings.aggressivenessLevel).toBe(0.8);
        expect(settings.autoInclusionThreshold).toBeLessThan(originalAutoThreshold);
        expect(settings.manualReviewThreshold).toBeLessThan(originalReviewThreshold);
      });

      test('should adjust content type thresholds', () => {
        const originalArticleThreshold = settings.contentTypeThresholds.article;
        
        settings.updateFromAggressivenessLevel(0.2);
        
        expect(settings.contentTypeThresholds.article).toBeGreaterThan(originalArticleThreshold);
      });

      test('should adjust discovery depth', () => {
        settings.updateFromAggressivenessLevel(0.9);
        expect(settings.sourceDiscoverySettings.maxDiscoveryDepth).toBeGreaterThan(2);
        
        settings.updateFromAggressivenessLevel(0.1);
        expect(settings.sourceDiscoverySettings.maxDiscoveryDepth).toBeLessThan(2);
      });

      test('should clamp values to valid ranges', () => {
        settings.updateFromAggressivenessLevel(1.5); // Invalid high value
        expect(settings.aggressivenessLevel).toBe(1.0);
        
        settings.updateFromAggressivenessLevel(-0.5); // Invalid low value
        expect(settings.aggressivenessLevel).toBe(0.0);
      });
    });

    describe('getDiscoveryConfig', () => {
      test('should return complete configuration object', () => {
        const config = settings.getDiscoveryConfig();
        
        expect(config).toHaveProperty('aggressivenessLevel');
        expect(config).toHaveProperty('autoInclusionThreshold');
        expect(config).toHaveProperty('manualReviewThreshold');
        expect(config).toHaveProperty('sourceDiscoverySettings');
        expect(config).toHaveProperty('contentTypeThresholds');
        expect(config).toHaveProperty('topicSensitivity');
        expect(config).toHaveProperty('temporalSettings');
        expect(config).toHaveProperty('qualityFilters');
      });
    });
  });

  describe('Static Methods', () => {
    describe('getOrCreateForUser', () => {
      test('should create new settings for new user', async () => {
        const userId = new mongoose.Types.ObjectId();
        
        const settings = await DiscoverySettings.getOrCreateForUser(userId);
        
        expect(settings).toBeDefined();
        expect(settings.userId.toString()).toBe(userId.toString());
        expect(settings.aggressivenessLevel).toBe(0.5);
      });

      test('should return existing settings for existing user', async () => {
        const userId = new mongoose.Types.ObjectId();
        const originalSettings = new DiscoverySettings({ 
          userId, 
          aggressivenessLevel: 0.8 
        });
        await originalSettings.save();
        
        const retrievedSettings = await DiscoverySettings.getOrCreateForUser(userId);
        
        expect(retrievedSettings.aggressivenessLevel).toBe(0.8);
        expect(retrievedSettings._id.toString()).toBe(originalSettings._id.toString());
      });
    });
  });

  describe('Middleware', () => {
    test('should update timestamp on save', async () => {
      const userId = new mongoose.Types.ObjectId();
      const settings = new DiscoverySettings({ userId });
      
      const originalUpdated = settings.updated;
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
      
      settings.aggressivenessLevel = 0.8;
      await settings.save();
      
      expect(settings.updated.getTime()).toBeGreaterThan(originalUpdated.getTime());
    });
  });
});