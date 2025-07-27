// Mock the logger
jest.mock('../../../common/utils/logger', () => {
  return jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }));
});

const relevanceRating = require('../utils/relevanceRating');

describe('Relevance Rating System', () => {
  describe('calculateRelevanceScore', () => {
    it('should calculate weighted relevance score correctly', () => {
      const factors = {
        values: {
          userRating: 0.8,
          contentQuality: 0.7,
          updateFrequency: 0.6,
          contentRelevance: 0.9
        }
      };
      
      const score = relevanceRating.calculateRelevanceScore(factors);
      
      // Expected calculation:
      // (0.8 * 0.5) + (0.7 * 0.2) + (0.6 * 0.1) + (0.9 * 0.2) = 0.4 + 0.14 + 0.06 + 0.18 = 0.78
      expect(score).toBeCloseTo(0.78, 2);
    });
    
    it('should use custom weights when provided', () => {
      const factors = {
        weights: {
          userRating: 0.7,
          contentQuality: 0.1,
          updateFrequency: 0.1,
          contentRelevance: 0.1
        },
        values: {
          userRating: 0.9,
          contentQuality: 0.5,
          updateFrequency: 0.5,
          contentRelevance: 0.5
        }
      };
      
      const score = relevanceRating.calculateRelevanceScore(factors);
      
      // Expected calculation:
      // (0.9 * 0.7) + (0.5 * 0.1) + (0.5 * 0.1) + (0.5 * 0.1) = 0.63 + 0.05 + 0.05 + 0.05 = 0.78
      expect(score).toBeCloseTo(0.78, 2);
    });
    
    it('should handle missing values', () => {
      const factors = {
        values: {
          userRating: 0.8,
          // contentQuality missing
          updateFrequency: 0.6,
          contentRelevance: 0.9
        }
      };
      
      const score = relevanceRating.calculateRelevanceScore(factors);
      
      // Expected calculation with default contentQuality of 0.5:
      // (0.8 * 0.5) + (0.5 * 0.2) + (0.6 * 0.1) + (0.9 * 0.2) = 0.4 + 0.1 + 0.06 + 0.18 = 0.74
      expect(score).toBeCloseTo(0.74, 2);
    });
    
    it('should ensure score is between 0 and 1', () => {
      const tooHigh = {
        values: {
          userRating: 1.5,
          contentQuality: 1.2
        }
      };
      
      const tooLow = {
        values: {
          userRating: -0.5,
          contentQuality: -0.2
        }
      };
      
      expect(relevanceRating.calculateRelevanceScore(tooHigh)).toBeLessThanOrEqual(1);
      expect(relevanceRating.calculateRelevanceScore(tooLow)).toBeGreaterThanOrEqual(0);
    });
    
    it('should return default score on error', () => {
      const invalidFactors = null;
      expect(relevanceRating.calculateRelevanceScore(invalidFactors)).toBe(0.5);
    });
  });
  
  describe('adjustScoreByInteraction', () => {
    it('should increase score for positive interactions', () => {
      expect(relevanceRating.adjustScoreByInteraction(0.5, 'view')).toBeGreaterThan(0.5);
      expect(relevanceRating.adjustScoreByInteraction(0.5, 'save')).toBeGreaterThan(0.5);
      expect(relevanceRating.adjustScoreByInteraction(0.5, 'share')).toBeGreaterThan(0.5);
    });
    
    it('should decrease score for negative interactions', () => {
      expect(relevanceRating.adjustScoreByInteraction(0.5, 'dismiss')).toBeLessThan(0.5);
      expect(relevanceRating.adjustScoreByInteraction(0.5, 'dislike')).toBeLessThan(0.5);
    });
    
    it('should apply weight correctly', () => {
      const baseScore = 0.5;
      const normalWeight = relevanceRating.adjustScoreByInteraction(baseScore, 'share', 0.1);
      const doubleWeight = relevanceRating.adjustScoreByInteraction(baseScore, 'share', 0.2);
      
      expect(doubleWeight - baseScore).toBeCloseTo(2 * (normalWeight - baseScore), 5);
    });
    
    it('should ensure score is between 0 and 1', () => {
      expect(relevanceRating.adjustScoreByInteraction(0.95, 'share')).toBeLessThanOrEqual(1);
      expect(relevanceRating.adjustScoreByInteraction(0.05, 'dismiss')).toBeGreaterThanOrEqual(0);
    });
    
    it('should return unchanged score for unknown interaction types', () => {
      expect(relevanceRating.adjustScoreByInteraction(0.5, 'unknown')).toBe(0.5);
    });
    
    it('should return unchanged score on error', () => {
      const score = 0.5;
      expect(relevanceRating.adjustScoreByInteraction(score, null)).toBe(score);
    });
  });
  
  describe('calculatePriorityLevel', () => {
    it('should return correct priority levels', () => {
      expect(relevanceRating.calculatePriorityLevel(0.9)).toBe('critical');
      expect(relevanceRating.calculatePriorityLevel(0.7)).toBe('high');
      expect(relevanceRating.calculatePriorityLevel(0.5)).toBe('medium');
      expect(relevanceRating.calculatePriorityLevel(0.3)).toBe('low');
    });
    
    it('should handle edge cases', () => {
      expect(relevanceRating.calculatePriorityLevel(0.8)).toBe('critical');
      expect(relevanceRating.calculatePriorityLevel(0.6)).toBe('high');
      expect(relevanceRating.calculatePriorityLevel(0.4)).toBe('medium');
      expect(relevanceRating.calculatePriorityLevel(0)).toBe('low');
      expect(relevanceRating.calculatePriorityLevel(1)).toBe('critical');
    });
  });
  
  describe('getRecommendedCheckFrequency', () => {
    it('should return correct check frequencies', () => {
      expect(relevanceRating.getRecommendedCheckFrequency(0.9)).toBe('hourly');
      expect(relevanceRating.getRecommendedCheckFrequency(0.7)).toBe('daily');
      expect(relevanceRating.getRecommendedCheckFrequency(0.5)).toBe('weekly');
      expect(relevanceRating.getRecommendedCheckFrequency(0.2)).toBe('monthly');
    });
    
    it('should handle edge cases', () => {
      expect(relevanceRating.getRecommendedCheckFrequency(0.8)).toBe('hourly');
      expect(relevanceRating.getRecommendedCheckFrequency(0.6)).toBe('daily');
      expect(relevanceRating.getRecommendedCheckFrequency(0.3)).toBe('weekly');
      expect(relevanceRating.getRecommendedCheckFrequency(0)).toBe('monthly');
      expect(relevanceRating.getRecommendedCheckFrequency(1)).toBe('hourly');
    });
  });
  
  describe('decayScoreOverTime', () => {
    it('should decay score based on days since update', () => {
      const now = new Date();
      const tenDaysAgo = new Date(now);
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
      
      const decayedScore = relevanceRating.decayScoreOverTime(0.8, tenDaysAgo, 0.01);
      
      // Expected: 0.8 * (1 - (10 * 0.01)) = 0.8 * 0.9 = 0.72
      expect(decayedScore).toBeCloseTo(0.72, 2);
    });
    
    it('should limit maximum decay', () => {
      const now = new Date();
      const hundredDaysAgo = new Date(now);
      hundredDaysAgo.setDate(hundredDaysAgo.getDate() - 100);
      
      const decayedScore = relevanceRating.decayScoreOverTime(0.8, hundredDaysAgo, 0.01);
      
      // Expected with cap: 0.8 * (1 - 0.5) = 0.4
      // Without cap would be: 0.8 * (1 - (100 * 0.01)) = 0.8 * 0 = 0
      expect(decayedScore).toBeCloseTo(0.4, 2);
    });
    
    it('should return unchanged score if lastUpdated is null', () => {
      const score = 0.8;
      expect(relevanceRating.decayScoreOverTime(score, null)).toBe(score);
    });
    
    it('should ensure score is between 0 and 1', () => {
      const now = new Date();
      const tenDaysAgo = new Date(now);
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
      
      expect(relevanceRating.decayScoreOverTime(0.05, tenDaysAgo, 0.01)).toBeGreaterThanOrEqual(0);
    });
    
    it('should return unchanged score on error', () => {
      const score = 0.8;
      expect(relevanceRating.decayScoreOverTime(score, 'invalid-date')).toBe(score);
    });
  });
});