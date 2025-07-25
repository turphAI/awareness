// Mock dependencies
const mockUpdateFromInteraction = jest.fn();
const mockCalculateRelevanceScore = jest.fn();
const mockGetScoringConfig = jest.fn();
const mockUpdateScoringConfig = jest.fn();

jest.mock('../utils/interestModeler', () => {
  return jest.fn().mockImplementation(() => ({
    updateFromInteraction: mockUpdateFromInteraction
  }));
});

jest.mock('../utils/relevanceScorer', () => {
  return jest.fn().mockImplementation(() => ({
    calculateRelevanceScore: mockCalculateRelevanceScore,
    getScoringConfig: mockGetScoringConfig,
    updateScoringConfig: mockUpdateScoringConfig
  }));
});

const InteractionLearner = require('../utils/interactionLearner');

describe('InteractionLearner', () => {
  let interactionLearner;
  let mockInteraction;
  let mockContent;

  beforeEach(() => {
    interactionLearner = new InteractionLearner();
    
    mockInteraction = {
      type: 'save',
      duration: 120,
      scrollDepth: 0.8,
      engagement: 0.7
    };

    mockContent = {
      id: 'content1',
      title: 'Test Content',
      topics: ['AI', 'Machine Learning'],
      categories: ['Technology'],
      sourceType: 'blog',
      publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
    };

    // Reset mocks
    mockUpdateFromInteraction.mockReset();
    mockCalculateRelevanceScore.mockReset();
    mockGetScoringConfig.mockReset();
    mockUpdateScoringConfig.mockReset();

    // Setup default mock responses
    mockCalculateRelevanceScore.mockResolvedValue({
      totalScore: 85,
      confidence: 0.8,
      breakdown: {
        topicScore: 0.9,
        categoryScore: 0.8,
        sourceTypeScore: 0.7,
        recencyScore: 0.9,
        qualityScore: 0.6
      }
    });

    mockGetScoringConfig.mockReturnValue({
      weights: {
        topicMatch: 0.4,
        categoryMatch: 0.3,
        sourceTypeMatch: 0.15,
        recency: 0.1,
        quality: 0.05
      }
    });
  });

  describe('processInteraction', () => {
    it('should process interaction and update profile', async () => {
      mockUpdateFromInteraction.mockResolvedValue({});

      const result = await interactionLearner.processInteraction('user123', mockInteraction, mockContent);

      expect(result).toHaveProperty('interactionProcessed', true);
      expect(result).toHaveProperty('profileUpdated', true);
      expect(result).toHaveProperty('learningTriggered');
      expect(result).toHaveProperty('metrics');

      expect(mockUpdateFromInteraction).toHaveBeenCalledWith('user123', mockInteraction, mockContent);
      expect(mockCalculateRelevanceScore).toHaveBeenCalledWith('user123', mockContent);
    });

    it('should trigger learning when conditions are met', async () => {
      mockUpdateFromInteraction.mockResolvedValue({});

      // Mock high prediction error scenario
      mockCalculateRelevanceScore.mockResolvedValue({
        totalScore: 90, // High prediction
        confidence: 0.8,
        breakdown: {
          topicScore: 0.9,
          categoryScore: 0.8,
          sourceTypeScore: 0.7,
          recencyScore: 0.9,
          qualityScore: 0.6
        }
      });

      // Add interactions with low actual engagement to create high error
      const lowEngagementInteraction = { type: 'dismiss', duration: 5 };
      
      // Add enough interactions to trigger learning
      for (let i = 0; i < 15; i++) {
        await interactionLearner.recordInteraction('user123', lowEngagementInteraction, mockContent);
      }

      const result = await interactionLearner.processInteraction('user123', lowEngagementInteraction, mockContent);

      expect(result.learningTriggered).toBe(true);
      expect(result.learningResult).toBeDefined();
    });

    it('should handle processing errors', async () => {
      mockUpdateFromInteraction.mockRejectedValue(new Error('Update failed'));

      await expect(interactionLearner.processInteraction('user123', mockInteraction, mockContent))
        .rejects.toThrow('Failed to process interaction: Update failed');
    });
  });

  describe('recordInteraction', () => {
    it('should record interaction with prediction and actual data', async () => {
      await interactionLearner.recordInteraction('user123', mockInteraction, mockContent);

      const interactions = interactionLearner.interactionBuffer.get('user123');
      expect(interactions).toHaveLength(1);
      
      const recorded = interactions[0];
      expect(recorded).toHaveProperty('timestamp');
      expect(recorded).toHaveProperty('interaction');
      expect(recorded).toHaveProperty('content');
      expect(recorded).toHaveProperty('prediction');
      expect(recorded).toHaveProperty('actual');

      expect(recorded.prediction.relevanceScore).toBe(85);
      expect(recorded.actual.userEngagement).toBeGreaterThan(0);
    });

    it('should limit interaction buffer size', async () => {
      // Record more interactions than the evaluation window
      for (let i = 0; i < 150; i++) {
        await interactionLearner.recordInteraction('user123', mockInteraction, mockContent);
      }

      const interactions = interactionLearner.interactionBuffer.get('user123');
      expect(interactions.length).toBeLessThanOrEqual(100); // Should be limited to evaluation window
    });
  });

  describe('shouldTriggerLearning', () => {
    it('should not trigger learning with insufficient interactions', async () => {
      const shouldLearn = await interactionLearner.shouldTriggerLearning('user123', mockInteraction, mockContent);
      expect(shouldLearn).toBe(false);
    });

    it('should trigger learning with sufficient interactions and high error', async () => {
      // Add interactions with high prediction error
      const highErrorInteractions = Array(15).fill(null).map((_, i) => ({
        timestamp: new Date(),
        interaction: { type: 'save' },
        content: mockContent,
        prediction: { relevanceScore: 90, confidence: 0.8 },
        actual: { userEngagement: 0.2, satisfaction: 0.2 } // Low actual engagement
      }));

      interactionLearner.interactionBuffer.set('user123', highErrorInteractions);

      const shouldLearn = await interactionLearner.shouldTriggerLearning('user123', mockInteraction, mockContent);
      expect(shouldLearn).toBe(true);
    });

    it('should trigger periodic learning', async () => {
      // Set up old learning time
      const oldMetrics = {
        lastLearningUpdate: new Date(Date.now() - 25 * 60 * 60 * 1000) // 25 hours ago
      };
      interactionLearner.learningMetrics.set('user123', oldMetrics);

      // Add sufficient interactions
      const interactions = Array(25).fill(null).map(() => ({
        timestamp: new Date(),
        interaction: { type: 'view' },
        content: mockContent,
        prediction: { relevanceScore: 70, confidence: 0.7 },
        actual: { userEngagement: 0.6, satisfaction: 0.6 }
      }));

      interactionLearner.interactionBuffer.set('user123', interactions);

      const shouldLearn = await interactionLearner.shouldTriggerLearning('user123', mockInteraction, mockContent);
      expect(shouldLearn).toBe(true);
    });
  });

  describe('performLearning', () => {
    it('should perform learning and return results', async () => {
      // Setup interactions for learning
      const interactions = Array(20).fill(null).map((_, i) => ({
        timestamp: new Date(),
        interaction: { type: i % 2 === 0 ? 'save' : 'view' },
        content: { ...mockContent, id: `content${i}` },
        prediction: { 
          relevanceScore: 70 + (i % 10), 
          confidence: 0.7,
          breakdown: {
            topicScore: 0.8,
            categoryScore: 0.7,
            sourceTypeScore: 0.6,
            recencyScore: 0.9,
            qualityScore: 0.5
          }
        },
        actual: { 
          userEngagement: 0.6 + (i % 5) * 0.1, 
          satisfaction: 0.7 
        }
      }));

      interactionLearner.interactionBuffer.set('user123', interactions);

      const result = await interactionLearner.performLearning('user123');

      expect(result.success).toBe(true);
      expect(result).toHaveProperty('analysis');
      expect(result).toHaveProperty('adjustments');
      expect(result).toHaveProperty('improvementPotential');
      expect(result).toHaveProperty('confidence');

      expect(mockUpdateScoringConfig).toHaveBeenCalled();
    });

    it('should fail learning with insufficient data', async () => {
      const result = await interactionLearner.performLearning('user123');

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Insufficient data');
    });
  });

  describe('analyzePredictionAccuracy', () => {
    it('should analyze prediction accuracy comprehensively', () => {
      const interactions = [
        {
          content: { topics: ['AI'], categories: ['Tech'], sourceType: 'blog' },
          prediction: { relevanceScore: 80, breakdown: { topicScore: 0.8 } },
          actual: { userEngagement: 0.7 }
        },
        {
          content: { topics: ['ML'], categories: ['Tech'], sourceType: 'academic' },
          prediction: { relevanceScore: 70, breakdown: { topicScore: 0.7 } },
          actual: { userEngagement: 0.8 }
        }
      ];

      const analysis = interactionLearner.analyzePredictionAccuracy(interactions);

      expect(analysis).toHaveProperty('totalInteractions', 2);
      expect(analysis).toHaveProperty('accuracyByType');
      expect(analysis).toHaveProperty('overallAccuracy');
      expect(analysis).toHaveProperty('biases');
      expect(analysis).toHaveProperty('patterns');
      expect(analysis).toHaveProperty('improvementPotential');
      expect(analysis).toHaveProperty('confidence');

      expect(analysis.accuracyByType).toHaveProperty('topic');
      expect(analysis.accuracyByType).toHaveProperty('category');
      expect(analysis.accuracyByType).toHaveProperty('sourceType');
    });
  });

  describe('calculateWeightAdjustments', () => {
    it('should calculate appropriate weight adjustments', () => {
      const analysis = {
        accuracyByType: {
          topic: { accuracy: 0.6 }, // Low accuracy - should decrease weight
          category: { accuracy: 0.95 }, // High accuracy - should increase weight
          sourceType: { accuracy: 0.8 } // Good accuracy - no change
        },
        biases: {
          recencyBias: 0.3, // High positive bias - should decrease weight
          qualityBias: -0.3 // High negative bias - should increase weight
        }
      };

      const adjustments = interactionLearner.calculateWeightAdjustments(analysis);

      expect(adjustments.topicMatch).toBeLessThan(0); // Should decrease
      expect(adjustments.categoryMatch).toBeGreaterThan(0); // Should increase
      expect(adjustments.recency).toBeLessThan(0); // Should decrease due to bias
      expect(adjustments.quality).toBeGreaterThan(0); // Should increase due to negative bias
    });
  });

  describe('calculateEngagement', () => {
    it('should calculate engagement based on interaction type', () => {
      const saveInteraction = { type: 'save' };
      const viewInteraction = { type: 'view' };
      const dismissInteraction = { type: 'dismiss' };

      expect(interactionLearner.calculateEngagement(saveInteraction)).toBeGreaterThan(0.7);
      expect(interactionLearner.calculateEngagement(viewInteraction)).toBeLessThan(0.3);
      expect(interactionLearner.calculateEngagement(dismissInteraction)).toBe(0.0); // Dismiss has 0 engagement
    });

    it('should factor in duration and scroll depth', () => {
      const baseInteraction = { type: 'view' };
      const enhancedInteraction = { 
        type: 'view', 
        duration: 300, 
        scrollDepth: 0.8 
      };

      const baseEngagement = interactionLearner.calculateEngagement(baseInteraction);
      const enhancedEngagement = interactionLearner.calculateEngagement(enhancedInteraction);

      expect(enhancedEngagement).toBeGreaterThan(baseEngagement);
    });
  });

  describe('mapInteractionToEngagement', () => {
    it('should map different interaction types to appropriate engagement levels', () => {
      expect(interactionLearner.mapInteractionToEngagement({ type: 'dismiss' })).toBe(0.0);
      expect(interactionLearner.mapInteractionToEngagement({ type: 'view' })).toBe(0.2);
      expect(interactionLearner.mapInteractionToEngagement({ type: 'save' })).toBe(0.8);
      expect(interactionLearner.mapInteractionToEngagement({ type: 'share' })).toBe(0.9);
    });
  });

  describe('inferSatisfaction', () => {
    it('should infer satisfaction from interaction type', () => {
      expect(interactionLearner.inferSatisfaction({ type: 'save' })).toBeGreaterThan(0.7);
      expect(interactionLearner.inferSatisfaction({ type: 'dismiss' })).toBeLessThan(0.3);
      expect(interactionLearner.inferSatisfaction({ type: 'view' })).toBe(0.5);
    });

    it('should factor in duration', () => {
      const shortInteraction = { type: 'view', duration: 5 };
      const longInteraction = { type: 'view', duration: 120 };

      const shortSatisfaction = interactionLearner.inferSatisfaction(shortInteraction);
      const longSatisfaction = interactionLearner.inferSatisfaction(longInteraction);

      expect(longSatisfaction).toBeGreaterThan(shortSatisfaction);
    });
  });

  describe('calculatePredictionError', () => {
    it('should calculate average prediction error', () => {
      const interactions = [
        {
          prediction: { relevanceScore: 80 },
          actual: { userEngagement: 0.7 }
        },
        {
          prediction: { relevanceScore: 60 },
          actual: { userEngagement: 0.8 }
        }
      ];

      const error = interactionLearner.calculatePredictionError(interactions);
      expect(error).toBeGreaterThan(0);
      expect(error).toBeLessThan(1);
    });
  });

  describe('identifyPredictionBiases', () => {
    it('should identify recency and quality biases', () => {
      const interactions = [
        {
          content: { publishedAt: new Date(Date.now() - 1000 * 60 * 60) }, // 1 hour ago
          prediction: { relevanceScore: 90, breakdown: { qualityScore: 0.8 } },
          actual: { userEngagement: 0.5 },
          timestamp: new Date()
        },
        {
          content: { publishedAt: new Date(Date.now() - 1000 * 60 * 60) },
          prediction: { relevanceScore: 85, breakdown: { qualityScore: 0.9 } },
          actual: { userEngagement: 0.4 },
          timestamp: new Date()
        }
      ];

      const biases = interactionLearner.identifyPredictionBiases(interactions);

      expect(biases).toHaveProperty('recencyBias');
      expect(biases).toHaveProperty('qualityBias');
      expect(biases.recencyBias).toBeGreaterThan(0); // Over-predicting for recent content
    });
  });

  describe('identifyLearningPatterns', () => {
    it('should identify time-based and content-type patterns', () => {
      const interactions = [
        {
          timestamp: new Date(2023, 0, 1, 9, 0), // 9 AM
          content: { sourceType: 'blog' },
          actual: { userEngagement: 0.8 }
        },
        {
          timestamp: new Date(2023, 0, 1, 14, 0), // 2 PM
          content: { sourceType: 'academic' },
          actual: { userEngagement: 0.6 }
        }
      ];

      const patterns = interactionLearner.identifyLearningPatterns(interactions);

      expect(patterns).toHaveProperty('timeOfDay');
      expect(patterns).toHaveProperty('sourceTypePreference');
      expect(patterns.timeOfDay).toBeInstanceOf(Array);
      expect(patterns.sourceTypePreference).toBeInstanceOf(Array);
    });
  });

  describe('getUserLearningMetrics', () => {
    it('should return comprehensive learning metrics', async () => {
      // Add some interactions with proper structure
      const interactions = Array(5).fill(null).map(() => ({
        timestamp: new Date(),
        prediction: { relevanceScore: 75 },
        actual: { userEngagement: 0.7 }
      }));

      interactionLearner.interactionBuffer.set('user123', interactions);

      const metrics = await interactionLearner.getUserLearningMetrics('user123');

      expect(metrics).toHaveProperty('totalInteractions', 5);
      expect(metrics).toHaveProperty('recentInteractions');
      expect(metrics).toHaveProperty('averageEngagement');
      expect(metrics).toHaveProperty('predictionAccuracy');
      expect(metrics).toHaveProperty('lastLearningUpdate');
      expect(metrics).toHaveProperty('learningCycles');
      expect(metrics).toHaveProperty('improvementTrend');
    });
  });

  describe('configuration management', () => {
    it('should get and update learning configuration', () => {
      const originalConfig = interactionLearner.getLearningConfig();
      expect(originalConfig).toHaveProperty('feedbackThreshold');
      expect(originalConfig).toHaveProperty('adaptationRate');

      const newConfig = { feedbackThreshold: 0.2 };
      interactionLearner.updateLearningConfig(newConfig);

      const updatedConfig = interactionLearner.getLearningConfig();
      expect(updatedConfig.feedbackThreshold).toBe(0.2);
    });
  });

  describe('resetLearningData', () => {
    it('should reset all learning data for user', async () => {
      // Add some data
      await interactionLearner.recordInteraction('user123', mockInteraction, mockContent);
      interactionLearner.learningMetrics.set('user123', { learningCycles: 5 });

      // Reset
      interactionLearner.resetLearningData('user123');

      // Verify reset
      expect(interactionLearner.interactionBuffer.has('user123')).toBe(false);
      expect(interactionLearner.learningMetrics.has('user123')).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle interactions without duration or scroll depth', () => {
      const basicInteraction = { type: 'view' };
      const engagement = interactionLearner.calculateEngagement(basicInteraction);
      
      expect(engagement).toBeGreaterThanOrEqual(0);
      expect(engagement).toBeLessThanOrEqual(1);
    });

    it('should handle content without published date', () => {
      const contentWithoutDate = { ...mockContent, publishedAt: undefined };
      const satisfaction = interactionLearner.inferSatisfaction({ type: 'view' });
      
      expect(satisfaction).toBe(0.5); // Should default to neutral
    });

    it('should handle empty interaction buffer gracefully', async () => {
      const shouldLearn = await interactionLearner.shouldTriggerLearning('newuser', mockInteraction, mockContent);
      expect(shouldLearn).toBe(false);

      const metrics = await interactionLearner.getUserLearningMetrics('newuser');
      expect(metrics.totalInteractions).toBe(0);
    });
  });
});