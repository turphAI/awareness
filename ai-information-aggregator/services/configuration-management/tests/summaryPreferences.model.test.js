const mongoose = require('mongoose');
const SummaryPreferences = require('../models/SummaryPreferences');

describe('SummaryPreferences Model', () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ai-aggregator-test');
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await SummaryPreferences.deleteMany({});
  });

  describe('Schema Validation', () => {
    test('should create summary preferences with default values', async () => {
      const userId = new mongoose.Types.ObjectId();
      const preferences = new SummaryPreferences({ userId });
      
      await preferences.save();
      
      expect(preferences.defaultLength).toBe('standard');
      expect(preferences.contentTypePreferences.article.length).toBe('standard');
      expect(preferences.contentTypePreferences.paper.length).toBe('detailed');
      expect(preferences.contentTypePreferences.social.length).toBe('brief');
      expect(preferences.lengthParameters.brief.maxWords).toBe(50);
      expect(preferences.lengthParameters.standard.maxWords).toBe(150);
      expect(preferences.adaptiveSettings.enabled).toBe(true);
      expect(preferences.userBehaviorMetrics.averageReadingSpeed).toBe(200);
    });

    test('should validate length enum values', async () => {
      const userId = new mongoose.Types.ObjectId();
      const preferences = new SummaryPreferences({
        userId,
        defaultLength: 'invalid'
      });
      
      await expect(preferences.save()).rejects.toThrow();
    });

    test('should validate length parameters ranges', async () => {
      const userId = new mongoose.Types.ObjectId();
      const preferences = new SummaryPreferences({
        userId,
        lengthParameters: {
          brief: {
            maxWords: 10, // Below minimum
            maxSentences: 1
          }
        }
      });
      
      await expect(preferences.save()).rejects.toThrow();
    });

    test('should require userId', async () => {
      const preferences = new SummaryPreferences({});
      
      await expect(preferences.save()).rejects.toThrow();
    });

    test('should enforce unique userId', async () => {
      const userId = new mongoose.Types.ObjectId();
      
      const preferences1 = new SummaryPreferences({ userId });
      await preferences1.save();
      
      const preferences2 = new SummaryPreferences({ userId });
      await expect(preferences2.save()).rejects.toThrow();
    });
  });

  describe('getSummaryParameters Method', () => {
    let preferences;
    
    beforeEach(async () => {
      const userId = new mongoose.Types.ObjectId();
      preferences = new SummaryPreferences({ userId });
      await preferences.save();
    });

    test('should return parameters for article content type', () => {
      const params = preferences.getSummaryParameters('article');
      
      expect(params.length).toBe('standard');
      expect(params.maxWords).toBe(150);
      expect(params.maxSentences).toBe(8);
      expect(params.includeKeyInsights).toBe(true);
      expect(params.includeReferences).toBe(true);
      expect(params.includeMethodology).toBe(false);
    });

    test('should return parameters for paper content type', () => {
      const params = preferences.getSummaryParameters('paper');
      
      expect(params.length).toBe('detailed');
      expect(params.maxWords).toBe(300);
      expect(params.maxSentences).toBe(15);
      expect(params.includeKeyInsights).toBe(true);
      expect(params.includeReferences).toBe(true);
      expect(params.includeMethodology).toBe(true);
      expect(params.includeResults).toBe(true);
    });

    test('should return parameters for podcast content type', () => {
      const params = preferences.getSummaryParameters('podcast');
      
      expect(params.length).toBe('standard');
      expect(params.includeTimestamps).toBe(true);
      expect(params.includeKeyInsights).toBe(true);
      expect(params.includeReferences).toBe(true);
    });

    test('should return parameters for social content type', () => {
      const params = preferences.getSummaryParameters('social');
      
      expect(params.length).toBe('brief');
      expect(params.maxWords).toBe(50);
      expect(params.maxSentences).toBe(3);
      expect(params.includeContext).toBe(true);
      expect(params.includeReferences).toBe(false);
    });

    test('should use override length when provided', () => {
      const params = preferences.getSummaryParameters('article', 'comprehensive');
      
      expect(params.length).toBe('comprehensive');
      expect(params.maxWords).toBe(500);
      expect(params.maxSentences).toBe(25);
    });

    test('should fall back to default length for unknown content type', () => {
      const params = preferences.getSummaryParameters('unknown');
      
      expect(params.length).toBe('standard');
      expect(params.maxWords).toBe(150);
      expect(params.includeKeyInsights).toBe(true);
    });
  });

  describe('calculateAdaptiveLength Method', () => {
    let preferences;
    
    beforeEach(async () => {
      const userId = new mongoose.Types.ObjectId();
      preferences = new SummaryPreferences({ userId });
      await preferences.save();
    });

    test('should return base length when adaptive is disabled', () => {
      preferences.adaptiveSettings.enabled = false;
      
      const adaptiveLength = preferences.calculateAdaptiveLength('article');
      
      expect(adaptiveLength).toBe('standard');
    });

    test('should increase length for fast readers', () => {
      preferences.userBehaviorMetrics.averageReadingSpeed = 300;
      preferences.adaptiveSettings.basedOnReadingSpeed = true;
      
      const adaptiveLength = preferences.calculateAdaptiveLength('article');
      
      expect(adaptiveLength).toBe('detailed');
    });

    test('should decrease length for slow readers', () => {
      preferences.userBehaviorMetrics.averageReadingSpeed = 100;
      preferences.adaptiveSettings.basedOnReadingSpeed = true;
      
      const adaptiveLength = preferences.calculateAdaptiveLength('article');
      
      expect(adaptiveLength).toBe('brief');
    });

    test('should increase length for high engagement users', () => {
      preferences.userBehaviorMetrics.engagementWithSummaries = 0.8;
      preferences.adaptiveSettings.basedOnEngagement = true;
      
      const adaptiveLength = preferences.calculateAdaptiveLength('article');
      
      expect(adaptiveLength).toBe('detailed');
    });

    test('should decrease length for low engagement users', () => {
      preferences.userBehaviorMetrics.engagementWithSummaries = 0.2;
      preferences.adaptiveSettings.basedOnEngagement = true;
      
      const adaptiveLength = preferences.calculateAdaptiveLength('article');
      
      expect(adaptiveLength).toBe('brief');
    });

    test('should adjust based on available time', () => {
      preferences.adaptiveSettings.basedOnTimeAvailable = true;
      
      const shortTimeLength = preferences.calculateAdaptiveLength('article', { availableTimeMinutes: 1 });
      expect(shortTimeLength).toBe('brief');
      
      const longTimeLength = preferences.calculateAdaptiveLength('article', { availableTimeMinutes: 20 });
      expect(longTimeLength).toBe('detailed');
    });

    test('should not exceed length boundaries', () => {
      preferences.userBehaviorMetrics.averageReadingSpeed = 500;
      preferences.userBehaviorMetrics.engagementWithSummaries = 1.0;
      preferences.adaptiveSettings.basedOnReadingSpeed = true;
      preferences.adaptiveSettings.basedOnEngagement = true;
      
      // Start with comprehensive (highest level)
      preferences.contentTypePreferences.article.length = 'comprehensive';
      
      const adaptiveLength = preferences.calculateAdaptiveLength('article');
      
      expect(adaptiveLength).toBe('comprehensive'); // Should not exceed maximum
    });

    test('should not go below minimum length', () => {
      preferences.userBehaviorMetrics.averageReadingSpeed = 50;
      preferences.userBehaviorMetrics.engagementWithSummaries = 0.0;
      preferences.adaptiveSettings.basedOnReadingSpeed = true;
      preferences.adaptiveSettings.basedOnEngagement = true;
      
      // Start with brief (lowest level)
      preferences.contentTypePreferences.article.length = 'brief';
      
      const adaptiveLength = preferences.calculateAdaptiveLength('article');
      
      expect(adaptiveLength).toBe('brief'); // Should not go below minimum
    });
  });

  describe('updateBehaviorMetrics Method', () => {
    let preferences;
    
    beforeEach(async () => {
      const userId = new mongoose.Types.ObjectId();
      preferences = new SummaryPreferences({ userId });
      await preferences.save();
    });

    test('should update reading speed within valid range', () => {
      preferences.updateBehaviorMetrics({ averageReadingSpeed: 250 });
      
      expect(preferences.userBehaviorMetrics.averageReadingSpeed).toBe(250);
      expect(preferences.userBehaviorMetrics.lastUpdated).toBeInstanceOf(Date);
    });

    test('should clamp reading speed to minimum', () => {
      preferences.updateBehaviorMetrics({ averageReadingSpeed: 10 });
      
      expect(preferences.userBehaviorMetrics.averageReadingSpeed).toBe(50);
    });

    test('should clamp reading speed to maximum', () => {
      preferences.updateBehaviorMetrics({ averageReadingSpeed: 2000 });
      
      expect(preferences.userBehaviorMetrics.averageReadingSpeed).toBe(1000);
    });

    test('should update preferred summary length', () => {
      preferences.updateBehaviorMetrics({ preferredSummaryLength: 'detailed' });
      
      expect(preferences.userBehaviorMetrics.preferredSummaryLength).toBe('detailed');
    });

    test('should update engagement score within valid range', () => {
      preferences.updateBehaviorMetrics({ engagementWithSummaries: 0.7 });
      
      expect(preferences.userBehaviorMetrics.engagementWithSummaries).toBe(0.7);
    });

    test('should clamp engagement score to valid range', () => {
      preferences.updateBehaviorMetrics({ engagementWithSummaries: 1.5 });
      expect(preferences.userBehaviorMetrics.engagementWithSummaries).toBe(1.0);
      
      preferences.updateBehaviorMetrics({ engagementWithSummaries: -0.5 });
      expect(preferences.userBehaviorMetrics.engagementWithSummaries).toBe(0.0);
    });

    test('should update multiple metrics at once', async () => {
      const originalTime = preferences.userBehaviorMetrics.lastUpdated;
      
      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));
      
      preferences.updateBehaviorMetrics({
        averageReadingSpeed: 300,
        preferredSummaryLength: 'comprehensive',
        engagementWithSummaries: 0.9
      });
      
      expect(preferences.userBehaviorMetrics.averageReadingSpeed).toBe(300);
      expect(preferences.userBehaviorMetrics.preferredSummaryLength).toBe('comprehensive');
      expect(preferences.userBehaviorMetrics.engagementWithSummaries).toBe(0.9);
      expect(preferences.userBehaviorMetrics.lastUpdated.getTime()).toBeGreaterThan(originalTime.getTime());
    });
  });

  describe('validateConfiguration Method', () => {
    let preferences;
    
    beforeEach(async () => {
      const userId = new mongoose.Types.ObjectId();
      preferences = new SummaryPreferences({ userId });
      await preferences.save();
    });

    test('should return no errors for valid configuration', () => {
      const errors = preferences.validateConfiguration();
      
      expect(errors).toEqual([]);
    });

    test('should return errors for invalid maxWords', () => {
      preferences.lengthParameters.brief.maxWords = 10; // Below minimum
      
      const errors = preferences.validateConfiguration();
      
      expect(errors).toContain('Invalid maxWords for brief: must be between 20 and 1000');
    });

    test('should return errors for invalid maxSentences', () => {
      preferences.lengthParameters.standard.maxSentences = 0; // Below minimum
      
      const errors = preferences.validateConfiguration();
      
      expect(errors).toContain('Invalid maxSentences for standard: must be between 1 and 50');
    });

    test('should return multiple errors for multiple invalid parameters', () => {
      preferences.lengthParameters.brief.maxWords = 1500; // Above maximum
      preferences.lengthParameters.detailed.maxSentences = 100; // Above maximum
      
      const errors = preferences.validateConfiguration();
      
      expect(errors).toHaveLength(2);
      expect(errors).toContain('Invalid maxWords for brief: must be between 20 and 1000');
      expect(errors).toContain('Invalid maxSentences for detailed: must be between 1 and 50');
    });
  });

  describe('getOrCreateForUser Static Method', () => {
    test('should create new preferences for new user', async () => {
      const userId = new mongoose.Types.ObjectId();
      
      const preferences = await SummaryPreferences.getOrCreateForUser(userId);
      
      expect(preferences).toBeDefined();
      expect(preferences.userId.toString()).toBe(userId.toString());
      expect(preferences.defaultLength).toBe('standard');
    });

    test('should return existing preferences for existing user', async () => {
      const userId = new mongoose.Types.ObjectId();
      
      // Create initial preferences
      const initialPreferences = new SummaryPreferences({
        userId,
        defaultLength: 'detailed'
      });
      await initialPreferences.save();
      
      // Get preferences using static method
      const retrievedPreferences = await SummaryPreferences.getOrCreateForUser(userId);
      
      expect(retrievedPreferences.userId.toString()).toBe(userId.toString());
      expect(retrievedPreferences.defaultLength).toBe('detailed');
      expect(retrievedPreferences._id.toString()).toBe(initialPreferences._id.toString());
    });
  });

  describe('Pre-save Middleware', () => {
    test('should update the updated field on save', async () => {
      const userId = new mongoose.Types.ObjectId();
      const preferences = new SummaryPreferences({ userId });
      
      const originalUpdated = preferences.updated;
      
      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await preferences.save();
      
      expect(preferences.updated.getTime()).toBeGreaterThan(originalUpdated.getTime());
    });
  });
});