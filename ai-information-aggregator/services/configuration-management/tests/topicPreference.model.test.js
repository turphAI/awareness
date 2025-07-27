const mongoose = require('mongoose');
const TopicPreference = require('../models/TopicPreference');

describe('TopicPreference Model', () => {
  let mockUserId;

  beforeEach(() => {
    mockUserId = new mongoose.Types.ObjectId();
  });

  describe('Schema Validation', () => {
    test('should create a valid topic preference', () => {
      const topicPreference = new TopicPreference({
        userId: mockUserId,
        topic: 'Machine Learning',
        category: 'machine-learning',
        priority: 'high',
        weight: 0.8,
        keywords: ['ml', 'algorithm', 'neural network'],
        excludeKeywords: ['basic', 'introduction']
      });

      const validationError = topicPreference.validateSync();
      expect(validationError).toBeUndefined();
    });

    test('should require userId', () => {
      const topicPreference = new TopicPreference({
        topic: 'Machine Learning',
        category: 'machine-learning'
      });

      const validationError = topicPreference.validateSync();
      expect(validationError.errors.userId).toBeDefined();
    });

    test('should require topic', () => {
      const topicPreference = new TopicPreference({
        userId: mockUserId,
        category: 'machine-learning'
      });

      const validationError = topicPreference.validateSync();
      expect(validationError.errors.topic).toBeDefined();
    });

    test('should require category', () => {
      const topicPreference = new TopicPreference({
        userId: mockUserId,
        topic: 'Machine Learning'
      });

      const validationError = topicPreference.validateSync();
      expect(validationError.errors.category).toBeDefined();
    });

    test('should validate category enum', () => {
      const topicPreference = new TopicPreference({
        userId: mockUserId,
        topic: 'Machine Learning',
        category: 'invalid-category'
      });

      const validationError = topicPreference.validateSync();
      expect(validationError.errors.category).toBeDefined();
    });

    test('should validate priority enum', () => {
      const topicPreference = new TopicPreference({
        userId: mockUserId,
        topic: 'Machine Learning',
        category: 'machine-learning',
        priority: 'invalid-priority'
      });

      const validationError = topicPreference.validateSync();
      expect(validationError.errors.priority).toBeDefined();
    });

    test('should validate weight range', () => {
      const topicPreference = new TopicPreference({
        userId: mockUserId,
        topic: 'Machine Learning',
        category: 'machine-learning',
        weight: 1.5
      });

      const validationError = topicPreference.validateSync();
      expect(validationError.errors.weight).toBeDefined();
    });

    test('should set default values', () => {
      const topicPreference = new TopicPreference({
        userId: mockUserId,
        topic: 'Machine Learning',
        category: 'machine-learning'
      });

      expect(topicPreference.priority).toBe('medium');
      expect(topicPreference.weight).toBe(0.5);
      expect(topicPreference.isActive).toBe(true);
      expect(topicPreference.source).toBe('user-defined');
      expect(topicPreference.confidence).toBe(1.0);
      expect(topicPreference.usageCount).toBe(0);
      expect(topicPreference.feedback.positive).toBe(0);
      expect(topicPreference.feedback.negative).toBe(0);
    });
  });

  describe('Instance Methods', () => {
    let topicPreference;

    beforeEach(() => {
      topicPreference = new TopicPreference({
        userId: mockUserId,
        topic: 'Machine Learning',
        category: 'machine-learning',
        priority: 'high',
        weight: 0.8,
        keywords: ['ml', 'algorithm'],
        excludeKeywords: ['basic'],
        usageCount: 5,
        feedback: { positive: 3, negative: 1 }
      });
    });

    describe('recordUsage', () => {
      test('should increment usage count and update lastUsed', async () => {
        const originalUsageCount = topicPreference.usageCount;
        const originalLastUsed = topicPreference.lastUsed;

        // Mock save method
        topicPreference.save = jest.fn().mockResolvedValue(topicPreference);

        await topicPreference.recordUsage();

        expect(topicPreference.usageCount).toBe(originalUsageCount + 1);
        expect(topicPreference.lastUsed).toBeInstanceOf(Date);
        expect(topicPreference.lastUsed).not.toBe(originalLastUsed);
        expect(topicPreference.save).toHaveBeenCalled();
      });
    });

    describe('addPositiveFeedback', () => {
      test('should increment positive feedback and increase confidence', async () => {
        const originalPositive = topicPreference.feedback.positive;
        const originalConfidence = topicPreference.confidence;

        topicPreference.save = jest.fn().mockResolvedValue(topicPreference);

        await topicPreference.addPositiveFeedback();

        expect(topicPreference.feedback.positive).toBe(originalPositive + 1);
        expect(topicPreference.confidence).toBe(Math.min(1.0, originalConfidence + 0.1));
        expect(topicPreference.save).toHaveBeenCalled();
      });

      test('should not exceed maximum confidence of 1.0', async () => {
        topicPreference.confidence = 0.95;
        topicPreference.save = jest.fn().mockResolvedValue(topicPreference);

        await topicPreference.addPositiveFeedback();

        expect(topicPreference.confidence).toBe(1.0);
      });
    });

    describe('addNegativeFeedback', () => {
      test('should increment negative feedback and decrease confidence', async () => {
        const originalNegative = topicPreference.feedback.negative;
        const originalConfidence = topicPreference.confidence;

        topicPreference.save = jest.fn().mockResolvedValue(topicPreference);

        await topicPreference.addNegativeFeedback();

        expect(topicPreference.feedback.negative).toBe(originalNegative + 1);
        expect(topicPreference.confidence).toBe(Math.max(0.0, originalConfidence - 0.1));
        expect(topicPreference.save).toHaveBeenCalled();
      });

      test('should not go below minimum confidence of 0.0', async () => {
        topicPreference.confidence = 0.05;
        topicPreference.save = jest.fn().mockResolvedValue(topicPreference);

        await topicPreference.addNegativeFeedback();

        expect(topicPreference.confidence).toBe(0.0);
      });
    });

    describe('updateWeight', () => {
      test('should calculate weight based on feedback ratio and usage', async () => {
        topicPreference.feedback.positive = 8;
        topicPreference.feedback.negative = 2;
        topicPreference.usageCount = 50;
        topicPreference.save = jest.fn().mockResolvedValue(topicPreference);

        await topicPreference.updateWeight();

        const totalFeedback = 10;
        const positiveRatio = 8 / totalFeedback; // 0.8
        const usageFactor = Math.min(1.0, 50 / 100); // 0.5
        const expectedWeight = (positiveRatio * 0.7) + (usageFactor * 0.3); // 0.71

        expect(topicPreference.weight).toBeCloseTo(expectedWeight, 2);
        expect(topicPreference.save).toHaveBeenCalled();
      });

      test('should not update weight if no feedback exists', async () => {
        topicPreference.feedback.positive = 0;
        topicPreference.feedback.negative = 0;
        const originalWeight = topicPreference.weight;
        topicPreference.save = jest.fn().mockResolvedValue(topicPreference);

        await topicPreference.updateWeight();

        expect(topicPreference.weight).toBe(originalWeight);
        expect(topicPreference.save).toHaveBeenCalled();
      });
    });

    describe('addKeyword', () => {
      test('should add new keyword in lowercase', async () => {
        topicPreference.save = jest.fn().mockResolvedValue(topicPreference);

        await topicPreference.addKeyword('Neural Network');

        expect(topicPreference.keywords).toContain('neural network');
        expect(topicPreference.save).toHaveBeenCalled();
      });

      test('should not add duplicate keywords', async () => {
        const originalLength = topicPreference.keywords.length;
        topicPreference.save = jest.fn().mockResolvedValue(topicPreference);

        await topicPreference.addKeyword('ml'); // Already exists

        expect(topicPreference.keywords.length).toBe(originalLength);
        expect(topicPreference.save).toHaveBeenCalled();
      });
    });

    describe('removeKeyword', () => {
      test('should remove existing keyword', async () => {
        topicPreference.save = jest.fn().mockResolvedValue(topicPreference);

        await topicPreference.removeKeyword('ml');

        expect(topicPreference.keywords).not.toContain('ml');
        expect(topicPreference.save).toHaveBeenCalled();
      });

      test('should handle non-existing keyword gracefully', async () => {
        const originalLength = topicPreference.keywords.length;
        topicPreference.save = jest.fn().mockResolvedValue(topicPreference);

        await topicPreference.removeKeyword('nonexistent');

        expect(topicPreference.keywords.length).toBe(originalLength);
        expect(topicPreference.save).toHaveBeenCalled();
      });
    });

    describe('addExcludeKeyword', () => {
      test('should add new exclude keyword in lowercase', async () => {
        topicPreference.save = jest.fn().mockResolvedValue(topicPreference);

        await topicPreference.addExcludeKeyword('Advanced');

        expect(topicPreference.excludeKeywords).toContain('advanced');
        expect(topicPreference.save).toHaveBeenCalled();
      });

      test('should not add duplicate exclude keywords', async () => {
        const originalLength = topicPreference.excludeKeywords.length;
        topicPreference.save = jest.fn().mockResolvedValue(topicPreference);

        await topicPreference.addExcludeKeyword('basic'); // Already exists

        expect(topicPreference.excludeKeywords.length).toBe(originalLength);
        expect(topicPreference.save).toHaveBeenCalled();
      });
    });

    describe('toggleActive', () => {
      test('should toggle isActive status', async () => {
        const originalStatus = topicPreference.isActive;
        topicPreference.save = jest.fn().mockResolvedValue(topicPreference);

        await topicPreference.toggleActive();

        expect(topicPreference.isActive).toBe(!originalStatus);
        expect(topicPreference.save).toHaveBeenCalled();
      });
    });
  });

  describe('Static Methods', () => {
    describe('categorizeTopicSuggestion', () => {
      test('should categorize research topics', () => {
        expect(TopicPreference.categorizeTopicSuggestion('research paper')).toBe('ai-research');
        expect(TopicPreference.categorizeTopicSuggestion('study results')).toBe('ai-research');
      });

      test('should categorize machine learning topics', () => {
        expect(TopicPreference.categorizeTopicSuggestion('machine learning')).toBe('machine-learning');
        expect(TopicPreference.categorizeTopicSuggestion('ml algorithm')).toBe('machine-learning');
      });

      test('should categorize NLP topics', () => {
        expect(TopicPreference.categorizeTopicSuggestion('natural language processing')).toBe('nlp');
        expect(TopicPreference.categorizeTopicSuggestion('text analysis')).toBe('nlp');
      });

      test('should categorize computer vision topics', () => {
        expect(TopicPreference.categorizeTopicSuggestion('computer vision')).toBe('computer-vision');
        expect(TopicPreference.categorizeTopicSuggestion('image recognition')).toBe('computer-vision');
      });

      test('should categorize robotics topics', () => {
        expect(TopicPreference.categorizeTopicSuggestion('robotics')).toBe('robotics');
        expect(TopicPreference.categorizeTopicSuggestion('automation')).toBe('robotics');
      });

      test('should categorize ethics topics', () => {
        expect(TopicPreference.categorizeTopicSuggestion('ai ethics')).toBe('ethics');
        expect(TopicPreference.categorizeTopicSuggestion('bias detection')).toBe('ethics');
      });

      test('should categorize tools topics', () => {
        expect(TopicPreference.categorizeTopicSuggestion('ai tools')).toBe('tools');
        expect(TopicPreference.categorizeTopicSuggestion('software platform')).toBe('tools');
      });

      test('should categorize frameworks topics', () => {
        expect(TopicPreference.categorizeTopicSuggestion('tensorflow framework')).toBe('frameworks');
        expect(TopicPreference.categorizeTopicSuggestion('api library')).toBe('frameworks');
      });

      test('should categorize industry news topics', () => {
        expect(TopicPreference.categorizeTopicSuggestion('industry news')).toBe('industry-news');
        expect(TopicPreference.categorizeTopicSuggestion('market trends')).toBe('industry-news');
      });

      test('should default to other category', () => {
        expect(TopicPreference.categorizeTopicSuggestion('random topic')).toBe('other');
      });
    });

    describe('suggestTopics', () => {
      test('should suggest topics based on content frequency', async () => {
        const mockUserId = new mongoose.Types.ObjectId();
        const recentContent = [
          { topics: ['deep learning', 'neural networks'], categories: ['ai-research'] },
          { topics: ['deep learning', 'computer vision'], categories: ['machine-learning'] },
          { topics: ['reinforcement learning'], categories: ['ai-research'] }
        ];

        // Mock existing preferences
        TopicPreference.find = jest.fn().mockResolvedValue([
          { topic: 'machine learning' }
        ]);

        const suggestions = await TopicPreference.suggestTopics(mockUserId, recentContent);

        expect(suggestions).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              topic: 'deep learning',
              frequency: 2,
              suggestedCategory: expect.any(String),
              suggestedPriority: expect.any(String)
            })
          ])
        );
      });

      test('should exclude existing user preferences', async () => {
        const mockUserId = new mongoose.Types.ObjectId();
        const recentContent = [
          { topics: ['machine learning'], categories: ['ai-research'] }
        ];

        // Mock existing preferences
        TopicPreference.find = jest.fn().mockResolvedValue([
          { topic: 'machine learning' }
        ]);

        const suggestions = await TopicPreference.suggestTopics(mockUserId, recentContent);

        expect(suggestions).not.toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              topic: 'machine learning'
            })
          ])
        );
      });

      test('should suggest appropriate priority based on frequency', async () => {
        const mockUserId = new mongoose.Types.ObjectId();
        const recentContent = Array(6).fill().map(() => ({
          topics: ['high frequency topic'],
          categories: ['ai-research']
        }));

        TopicPreference.find = jest.fn().mockResolvedValue([]);

        const suggestions = await TopicPreference.suggestTopics(mockUserId, recentContent);

        expect(suggestions[0]).toEqual(
          expect.objectContaining({
            topic: 'high frequency topic',
            frequency: 6,
            suggestedPriority: 'high'
          })
        );
      });
    });
  });
});