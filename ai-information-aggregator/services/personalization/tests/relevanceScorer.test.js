// Mock the InterestModeler
const mockGetProfile = jest.fn();
jest.mock('../utils/interestModeler', () => {
  return jest.fn().mockImplementation(() => ({
    getProfile: mockGetProfile
  }));
});

const RelevanceScorer = require('../utils/relevanceScorer');

describe('RelevanceScorer', () => {
  let relevanceScorer;
  let mockProfile;
  let mockContent;

  beforeEach(() => {
    relevanceScorer = new RelevanceScorer();
    
    mockProfile = {
      topics: [
        { topic: 'AI', weight: 0.8, interactionCount: 10 },
        { topic: 'Machine Learning', weight: 0.7, interactionCount: 8 },
        { topic: 'JavaScript', weight: 0.6, interactionCount: 5 }
      ],
      categories: [
        { category: 'Technology', weight: 0.9, interactionCount: 15 },
        { category: 'Programming', weight: 0.7, interactionCount: 12 }
      ],
      sourceTypes: [
        { sourceType: 'blog', weight: 0.8, interactionCount: 20 },
        { sourceType: 'academic', weight: 0.6, interactionCount: 8 }
      ]
    };

    mockContent = {
      id: 'content1',
      title: 'Introduction to AI',
      topics: ['AI', 'Machine Learning'],
      categories: ['Technology'],
      sourceType: 'blog',
      publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      wordCount: 1500,
      metrics: {
        views: 1000,
        likes: 50,
        shares: 10,
        comments: 5
      },
      source: {
        name: 'Tech Blog',
        credibilityScore: 0.8
      }
    };

    mockGetProfile.mockReset();
  });

  describe('calculateRelevanceScore', () => {
    it('should calculate comprehensive relevance score', async () => {
      mockGetProfile.mockResolvedValue(mockProfile);

      const result = await relevanceScorer.calculateRelevanceScore('user123', mockContent);

      expect(result).toHaveProperty('totalScore');
      expect(result).toHaveProperty('breakdown');
      expect(result).toHaveProperty('factors');
      expect(result).toHaveProperty('confidence');
      
      expect(result.totalScore).toBeGreaterThan(0);
      expect(result.totalScore).toBeLessThanOrEqual(100);
      
      expect(result.breakdown).toHaveProperty('topicScore');
      expect(result.breakdown).toHaveProperty('categoryScore');
      expect(result.breakdown).toHaveProperty('sourceTypeScore');
      expect(result.breakdown).toHaveProperty('recencyScore');
      expect(result.breakdown).toHaveProperty('qualityScore');
    });

    it('should handle content with no matching interests', async () => {
      mockGetProfile.mockResolvedValue(mockProfile);
      
      const unmatchedContent = {
        ...mockContent,
        topics: ['Cooking', 'Recipes'],
        categories: ['Food'],
        sourceType: 'video'
      };

      const result = await relevanceScorer.calculateRelevanceScore('user123', unmatchedContent);

      expect(result.totalScore).toBeLessThan(50); // Should be low score
      expect(result.breakdown.topicScore).toBe(0);
      expect(result.breakdown.categoryScore).toBe(0);
    });

    it('should apply custom weights', async () => {
      mockGetProfile.mockResolvedValue(mockProfile);
      
      const customWeights = {
        topicMatch: 0.8,
        categoryMatch: 0.1,
        sourceTypeMatch: 0.05,
        recency: 0.03,
        quality: 0.02
      };

      const result = await relevanceScorer.calculateRelevanceScore('user123', mockContent, { weights: customWeights });

      expect(result).toHaveProperty('totalScore');
      // Topic score should have more influence with higher weight
    });

    it('should handle errors gracefully', async () => {
      mockGetProfile.mockRejectedValue(new Error('Profile not found'));

      await expect(relevanceScorer.calculateRelevanceScore('user123', mockContent))
        .rejects.toThrow('Failed to calculate relevance score: Profile not found');
    });
  });

  describe('scoreAndRankContent', () => {
    it('should score and rank multiple content items', async () => {
      mockGetProfile.mockResolvedValue(mockProfile);

      const contentItems = [
        {
          ...mockContent,
          id: 'content1',
          topics: ['AI'],
          categories: ['Technology']
        },
        {
          ...mockContent,
          id: 'content2',
          topics: ['Cooking'],
          categories: ['Food']
        },
        {
          ...mockContent,
          id: 'content3',
          topics: ['Machine Learning'],
          categories: ['Technology']
        }
      ];

      const result = await relevanceScorer.scoreAndRankContent('user123', contentItems);

      expect(result).toHaveLength(3);
      expect(result[0]).toHaveProperty('relevanceScore');
      expect(result[0]).toHaveProperty('scoreBreakdown');
      expect(result[0]).toHaveProperty('scoreFactors');
      expect(result[0]).toHaveProperty('confidence');

      // Should be ranked by relevance score (descending)
      expect(result[0].relevanceScore).toBeGreaterThanOrEqual(result[1].relevanceScore);
      expect(result[1].relevanceScore).toBeGreaterThanOrEqual(result[2].relevanceScore);
    });

    it('should apply diversification when requested', async () => {
      mockGetProfile.mockResolvedValue(mockProfile);

      const contentItems = Array(10).fill(null).map((_, index) => ({
        ...mockContent,
        id: `content${index}`,
        categories: ['Technology'],
        source: { name: 'Same Source' }
      }));

      const result = await relevanceScorer.scoreAndRankContent('user123', contentItems, {
        diversify: { maxPerCategory: 2, maxPerSource: 1 }
      });

      expect(result.length).toBeLessThan(contentItems.length);
      expect(result.length).toBeLessThanOrEqual(2); // Max per category
    });

    it('should handle scoring errors', async () => {
      mockGetProfile.mockRejectedValue(new Error('Database error'));

      await expect(relevanceScorer.scoreAndRankContent('user123', [mockContent]))
        .rejects.toThrow('Failed to score and rank content: Failed to calculate relevance score: Database error');
    });
  });

  describe('calculateTopicScore', () => {
    it('should calculate topic score based on user interests', () => {
      const score = relevanceScorer.calculateTopicScore(mockContent, mockProfile);

      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
      // Should be high since content has AI and ML topics that user is interested in
      expect(score).toBeGreaterThan(0.7);
    });

    it('should return 0 for content with no topics', () => {
      const contentWithoutTopics = { ...mockContent, topics: [] };
      const score = relevanceScorer.calculateTopicScore(contentWithoutTopics, mockProfile);

      expect(score).toBe(0);
    });

    it('should return 0 for unmatched topics', () => {
      const contentWithUnmatchedTopics = {
        ...mockContent,
        topics: ['Cooking', 'Gardening']
      };
      const score = relevanceScorer.calculateTopicScore(contentWithUnmatchedTopics, mockProfile);

      expect(score).toBe(0);
    });

    it('should apply match bonus for multiple topic matches', () => {
      const multiTopicContent = {
        ...mockContent,
        topics: ['AI', 'Machine Learning', 'JavaScript']
      };
      const score = relevanceScorer.calculateTopicScore(multiTopicContent, mockProfile);

      expect(score).toBeGreaterThan(0.7); // Should get bonus for multiple matches
    });
  });

  describe('calculateCategoryScore', () => {
    it('should calculate category score based on user interests', () => {
      const score = relevanceScorer.calculateCategoryScore(mockContent, mockProfile);

      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
      // Should be high since content is in Technology category
      expect(score).toBe(0.9); // Exact match with Technology category weight
    });

    it('should return 0 for content with no categories', () => {
      const contentWithoutCategories = { ...mockContent, categories: [] };
      const score = relevanceScorer.calculateCategoryScore(contentWithoutCategories, mockProfile);

      expect(score).toBe(0);
    });

    it('should handle multiple categories', () => {
      const multiCategoryContent = {
        ...mockContent,
        categories: ['Technology', 'Programming']
      };
      const score = relevanceScorer.calculateCategoryScore(multiCategoryContent, mockProfile);

      expect(score).toBe(0.8); // Average of Technology (0.9) and Programming (0.7)
    });
  });

  describe('calculateSourceTypeScore', () => {
    it('should calculate source type score based on user preferences', () => {
      const score = relevanceScorer.calculateSourceTypeScore(mockContent, mockProfile);

      expect(score).toBe(0.8); // Blog source type weight
    });

    it('should return neutral score for unknown source type', () => {
      const contentWithoutSourceType = { ...mockContent, sourceType: undefined };
      const score = relevanceScorer.calculateSourceTypeScore(contentWithoutSourceType, mockProfile);

      expect(score).toBe(0.5);
    });

    it('should return default low score for unmatched source type', () => {
      const contentWithUnmatchedSource = { ...mockContent, sourceType: 'podcast' };
      const score = relevanceScorer.calculateSourceTypeScore(contentWithUnmatchedSource, mockProfile);

      expect(score).toBe(0.3);
    });
  });

  describe('calculateRecencyScore', () => {
    it('should give high score for recent content', () => {
      const recentContent = {
        ...mockContent,
        publishedAt: new Date(Date.now() - 30 * 60 * 1000) // 30 minutes ago
      };
      const score = relevanceScorer.calculateRecencyScore(recentContent);

      expect(score).toBe(1.0); // Should get hourly decay rate
    });

    it('should give lower score for older content', () => {
      const oldContent = {
        ...mockContent,
        publishedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) // 60 days ago
      };
      const score = relevanceScorer.calculateRecencyScore(oldContent);

      expect(score).toBe(0.5); // Should get monthly decay rate
    });

    it('should return neutral score for content without date', () => {
      const contentWithoutDate = { ...mockContent, publishedAt: undefined, createdAt: undefined };
      const score = relevanceScorer.calculateRecencyScore(contentWithoutDate);

      expect(score).toBe(0.5);
    });

    it('should use createdAt if publishedAt is not available', () => {
      const contentWithCreatedAt = {
        ...mockContent,
        publishedAt: undefined,
        createdAt: new Date(Date.now() - 60 * 60 * 1000) // 1 hour ago
      };
      const score = relevanceScorer.calculateRecencyScore(contentWithCreatedAt);

      expect(score).toBe(1.0);
    });
  });

  describe('calculateQualityScore', () => {
    it('should calculate quality score based on multiple factors', () => {
      const score = relevanceScorer.calculateQualityScore(mockContent);

      expect(score).toBeGreaterThan(0.5); // Should be above base score
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should factor in engagement metrics', () => {
      const highEngagementContent = {
        ...mockContent,
        metrics: {
          views: 1000,
          likes: 200,
          shares: 100,
          comments: 50
        }
      };
      const score = relevanceScorer.calculateQualityScore(highEngagementContent);

      expect(score).toBeGreaterThan(0.7);
    });

    it('should factor in source credibility', () => {
      const highCredibilityContent = {
        ...mockContent,
        source: {
          name: 'Credible Source',
          credibilityScore: 0.95
        }
      };
      const score = relevanceScorer.calculateQualityScore(highCredibilityContent);

      expect(score).toBeGreaterThan(0.6);
    });

    it('should handle content without metrics', () => {
      const contentWithoutMetrics = { ...mockContent, metrics: undefined };
      const score = relevanceScorer.calculateQualityScore(contentWithoutMetrics);

      expect(score).toBeGreaterThanOrEqual(0.5);
    });
  });

  describe('calculateLengthScore', () => {
    it('should prefer moderate length content', () => {
      const score1000 = relevanceScorer.calculateLengthScore(1000);
      const score100 = relevanceScorer.calculateLengthScore(100);
      const score5000 = relevanceScorer.calculateLengthScore(5000);

      expect(score1000).toBe(1); // Optimal length
      expect(score100).toBeLessThan(1); // Too short
      expect(score5000).toBeLessThan(1); // Too long
    });

    it('should handle edge cases', () => {
      const scoreZero = relevanceScorer.calculateLengthScore(0);
      const scoreVeryLong = relevanceScorer.calculateLengthScore(10000);

      expect(scoreZero).toBe(0);
      expect(scoreVeryLong).toBeGreaterThanOrEqual(0.3); // Minimum score
    });
  });

  describe('calculateWeightedScore', () => {
    it('should calculate weighted score using default weights', () => {
      const scores = {
        topicScore: 0.8,
        categoryScore: 0.7,
        sourceTypeScore: 0.6,
        recencyScore: 0.9,
        qualityScore: 0.5
      };

      const weightedScore = relevanceScorer.calculateWeightedScore(scores);

      expect(weightedScore).toBeGreaterThan(0);
      expect(weightedScore).toBeLessThanOrEqual(1);
    });

    it('should apply custom weights', () => {
      const scores = {
        topicScore: 0.8,
        categoryScore: 0.7,
        sourceTypeScore: 0.6,
        recencyScore: 0.9,
        qualityScore: 0.5
      };

      const customWeights = {
        topicMatch: 1.0,
        categoryMatch: 0,
        sourceTypeMatch: 0,
        recency: 0,
        quality: 0
      };

      const weightedScore = relevanceScorer.calculateWeightedScore(scores, customWeights);

      expect(weightedScore).toBe(0.8); // Should equal topic score only
    });
  });

  describe('normalizeScore', () => {
    it('should normalize score to 0-100 range', () => {
      expect(relevanceScorer.normalizeScore(0.5)).toBe(50);
      expect(relevanceScorer.normalizeScore(0.75)).toBe(75);
      expect(relevanceScorer.normalizeScore(1.0)).toBe(100);
      expect(relevanceScorer.normalizeScore(0)).toBe(0);
    });

    it('should clamp scores outside valid range', () => {
      expect(relevanceScorer.normalizeScore(-0.1)).toBe(0);
      expect(relevanceScorer.normalizeScore(1.1)).toBe(100);
    });
  });

  describe('getScoreFactors', () => {
    it('should return human-readable score factors', () => {
      const scores = {
        topicScore: 0.8,
        categoryScore: 0.9,
        sourceTypeScore: 0.8,
        recencyScore: 0.9,
        qualityScore: 0.8
      };

      const factors = relevanceScorer.getScoreFactors(mockContent, mockProfile, scores);

      expect(factors).toHaveProperty('positive');
      expect(factors).toHaveProperty('topMatches');
      expect(factors).toHaveProperty('scoreDistribution');
      
      expect(factors.positive).toContain('Strong topic match');
      expect(factors.positive).toContain('Strong category match');
      expect(factors.positive).toContain('Very recent content');
    });
  });

  describe('calculateConfidence', () => {
    it('should calculate confidence based on user data and matches', () => {
      const scores = {
        topicScore: 0.8,
        categoryScore: 0.7,
        sourceTypeScore: 0.6,
        recencyScore: 0.9,
        qualityScore: 0.5
      };

      const confidence = relevanceScorer.calculateConfidence(mockProfile, scores);

      expect(confidence).toBeGreaterThan(0.5);
      expect(confidence).toBeLessThanOrEqual(1);
    });

    it('should have higher confidence with more user interactions', () => {
      const highInteractionProfile = {
        ...mockProfile,
        topics: mockProfile.topics.map(t => ({ ...t, interactionCount: 50 })),
        categories: mockProfile.categories.map(c => ({ ...c, interactionCount: 50 }))
      };

      const scores = {
        topicScore: 0.8,
        categoryScore: 0.7,
        sourceTypeScore: 0.6,
        recencyScore: 0.9,
        qualityScore: 0.5
      };

      const confidence = relevanceScorer.calculateConfidence(highInteractionProfile, scores);

      expect(confidence).toBeGreaterThan(0.8);
    });
  });

  describe('applyDiversification', () => {
    it('should limit content per category and source', () => {
      const rankedContent = Array(10).fill(null).map((_, index) => ({
        id: `content${index}`,
        categories: ['Technology'],
        source: { name: 'Same Source' },
        relevanceScore: 90 - index
      }));

      const diversified = relevanceScorer.applyDiversification(rankedContent, {
        maxPerCategory: 2,
        maxPerSource: 1
      });

      expect(diversified.length).toBe(1); // Limited by maxPerSource
    });

    it('should maintain ranking order within limits', () => {
      const rankedContent = [
        { id: 'content1', categories: ['Tech'], source: { name: 'Source1' }, relevanceScore: 90 },
        { id: 'content2', categories: ['Tech'], source: { name: 'Source2' }, relevanceScore: 85 },
        { id: 'content3', categories: ['Tech'], source: { name: 'Source3' }, relevanceScore: 80 }
      ];

      const diversified = relevanceScorer.applyDiversification(rankedContent, {
        maxPerCategory: 2,
        maxPerSource: 1
      });

      expect(diversified).toHaveLength(2);
      expect(diversified[0].id).toBe('content1');
      expect(diversified[1].id).toBe('content2');
    });
  });

  describe('configuration management', () => {
    it('should return current scoring configuration', () => {
      const config = relevanceScorer.getScoringConfig();

      expect(config).toHaveProperty('weights');
      expect(config).toHaveProperty('recencyDecay');
      expect(config.weights).toHaveProperty('topicMatch');
      expect(config.recencyDecay).toHaveProperty('hourly');
    });

    it('should update scoring configuration', () => {
      const newConfig = {
        weights: { topicMatch: 0.5 },
        recencyDecay: { hourly: 0.95 }
      };

      relevanceScorer.updateScoringConfig(newConfig);
      const config = relevanceScorer.getScoringConfig();

      expect(config.weights.topicMatch).toBe(0.5);
      expect(config.recencyDecay.hourly).toBe(0.95);
    });
  });
});