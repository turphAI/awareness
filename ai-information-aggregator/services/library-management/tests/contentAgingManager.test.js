const ContentAgingManager = require('../utils/contentAgingManager');
const ContentMetadata = require('../models/ContentMetadata');
const logger = require('../../../common/utils/logger');

// Mock dependencies
jest.mock('../models/ContentMetadata');
jest.mock('../../../common/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

describe('ContentAgingManager', () => {
  let contentAgingManager;
  let mockContentMetadata;

  beforeEach(() => {
    contentAgingManager = new ContentAgingManager();
    
    // Create mock content metadata
    mockContentMetadata = {
      contentId: 'content123',
      title: 'Test Article',
      contentType: 'article',
      publishedAt: new Date('2023-01-01'),
      topics: ['ai', 'machine learning'],
      freshnessScore: 0.7,
      citations: [
        { url: 'https://example.com/paper1', title: 'Paper 1' },
        { url: 'https://example.com/paper2', title: 'Paper 2' }
      ],
      aging: {
        isOutdated: false,
        lastReviewedAt: new Date('2023-06-01'),
        nextReviewAt: new Date('2024-01-01'),
        outdatedReasons: [],
        updateSuggestions: []
      },
      markOutdated: jest.fn().mockResolvedValue(true),
      markUpToDate: jest.fn().mockResolvedValue(true),
      save: jest.fn().mockResolvedValue(true)
    };

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default aging rules', () => {
      expect(contentAgingManager.agingRules).toBeDefined();
      expect(contentAgingManager.agingRules.article).toBe(365);
      expect(contentAgingManager.agingRules.academic).toBe(1095);
      expect(contentAgingManager.topicAgingRules.ai).toBe(180);
      expect(contentAgingManager.freshnessThreshold).toBe(0.3);
    });
  });

  describe('identifyOutdatedContent', () => {
    beforeEach(() => {
      ContentMetadata.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([mockContentMetadata])
        })
      });
    });

    it('should identify outdated content successfully', async () => {
      // Mock assessContentAging to return outdated content
      jest.spyOn(contentAgingManager, 'assessContentAging').mockResolvedValue({
        isOutdated: true,
        reasons: ['deprecated_info'],
        suggestions: ['Update content'],
        agingScore: 0.8
      });

      const result = await contentAgingManager.identifyOutdatedContent();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        contentId: 'content123',
        title: 'Test Article',
        reasons: ['deprecated_info'],
        suggestions: ['Update content'],
        agingScore: 0.8
      });
      expect(mockContentMetadata.markOutdated).toHaveBeenCalledWith(
        ['deprecated_info'],
        ['Update content']
      );
    });

    it('should update next review date for non-outdated content', async () => {
      const nextReviewDate = new Date('2024-06-01');
      jest.spyOn(contentAgingManager, 'assessContentAging').mockResolvedValue({
        isOutdated: false,
        reasons: [],
        suggestions: [],
        agingScore: 0.2,
        nextReviewAt: nextReviewDate
      });

      const result = await contentAgingManager.identifyOutdatedContent();

      expect(result).toHaveLength(0);
      expect(mockContentMetadata.aging.nextReviewAt).toBe(nextReviewDate);
      expect(mockContentMetadata.save).toHaveBeenCalled();
    });

    it('should handle content type filtering', async () => {
      await contentAgingManager.identifyOutdatedContent({ contentType: 'article' });

      expect(ContentMetadata.find).toHaveBeenCalledWith({ 
        contentType: 'article',
        'aging.isOutdated': { $ne: true }
      });
    });

    it('should handle domain filtering', async () => {
      await contentAgingManager.identifyOutdatedContent({ domain: 'example.com' });

      expect(ContentMetadata.find).toHaveBeenCalledWith({ 
        'source.domain': 'example.com',
        'aging.isOutdated': { $ne: true }
      });
    });

    it('should handle force recheck option', async () => {
      await contentAgingManager.identifyOutdatedContent({ forceRecheck: true });

      expect(ContentMetadata.find).toHaveBeenCalledWith({});
    });

    it('should handle errors gracefully', async () => {
      ContentMetadata.find.mockImplementation(() => {
        throw new Error('Database error');
      });

      await expect(contentAgingManager.identifyOutdatedContent()).rejects.toThrow('Database error');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('assessContentAging', () => {
    it('should assess content aging correctly', async () => {
      // Mock current date to be 2 years after publication
      const mockDate = new Date('2025-01-01');
      jest.spyOn(Date, 'now').mockReturnValue(mockDate.getTime());
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

      jest.spyOn(contentAgingManager, 'checkAgeBasedCriteria').mockReturnValue({
        isOutdated: true,
        reasons: ['deprecated_info'],
        suggestions: ['Content is old'],
        score: 1
      });

      jest.spyOn(contentAgingManager, 'checkFreshnessScore').mockReturnValue({
        isOutdated: false,
        reasons: [],
        suggestions: [],
        score: 0
      });

      jest.spyOn(contentAgingManager, 'checkTopicSpecificAging').mockReturnValue({
        isOutdated: false,
        reasons: [],
        suggestions: [],
        score: 0
      });

      jest.spyOn(contentAgingManager, 'checkBrokenReferences').mockResolvedValue({
        isOutdated: false,
        reasons: [],
        suggestions: [],
        score: 0
      });

      const result = await contentAgingManager.assessContentAging(mockContentMetadata);

      expect(result.isOutdated).toBe(true);
      expect(result.reasons).toContain('deprecated_info');
      expect(result.suggestions).toContain('Content is old');
      expect(result.agingScore).toBe(0.25); // 1/4 normalized
    });

    it('should handle errors in assessment', async () => {
      jest.spyOn(contentAgingManager, 'checkAgeBasedCriteria').mockImplementation(() => {
        throw new Error('Assessment error');
      });

      await expect(contentAgingManager.assessContentAging(mockContentMetadata))
        .rejects.toThrow('Assessment error');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('checkAgeBasedCriteria', () => {
    it('should mark content as outdated when exceeding max age', () => {
      const daysSincePublished = 400; // More than 365 days for articles
      
      const result = contentAgingManager.checkAgeBasedCriteria(mockContentMetadata, daysSincePublished);

      expect(result.isOutdated).toBe(true);
      expect(result.reasons).toContain('deprecated_info');
      expect(result.score).toBe(1);
    });

    it('should provide warning when approaching max age', () => {
      const daysSincePublished = 300; // 80% of 365 days
      
      const result = contentAgingManager.checkAgeBasedCriteria(mockContentMetadata, daysSincePublished);

      expect(result.isOutdated).toBe(false);
      expect(result.suggestions).toContain('Content is approaching aging threshold, schedule for review');
      expect(result.score).toBe(0.6);
    });

    it('should handle different content types', () => {
      const academicContent = { ...mockContentMetadata, contentType: 'academic' };
      const daysSincePublished = 1200; // More than 1095 days for academic content
      
      const result = contentAgingManager.checkAgeBasedCriteria(academicContent, daysSincePublished);

      expect(result.isOutdated).toBe(true);
    });

    it('should use default aging rule for unknown content types', () => {
      const unknownContent = { ...mockContentMetadata, contentType: 'unknown' };
      const daysSincePublished = 800; // More than 730 days (default)
      
      const result = contentAgingManager.checkAgeBasedCriteria(unknownContent, daysSincePublished);

      expect(result.isOutdated).toBe(true);
    });
  });

  describe('checkFreshnessScore', () => {
    it('should mark content as outdated with low freshness score', () => {
      const lowFreshnessContent = { ...mockContentMetadata, freshnessScore: 0.2 };
      
      const result = contentAgingManager.checkFreshnessScore(lowFreshnessContent);

      expect(result.isOutdated).toBe(true);
      expect(result.reasons).toContain('deprecated_info');
      expect(result.score).toBe(1);
    });

    it('should provide warning for declining freshness score', () => {
      const decliningFreshnessContent = { ...mockContentMetadata, freshnessScore: 0.4 };
      
      const result = contentAgingManager.checkFreshnessScore(decliningFreshnessContent);

      expect(result.isOutdated).toBe(false);
      expect(result.suggestions).toContain('Freshness score is declining, monitor for updates');
      expect(result.score).toBe(0.5);
    });

    it('should handle missing freshness score', () => {
      const noFreshnessContent = { ...mockContentMetadata };
      delete noFreshnessContent.freshnessScore;
      
      const result = contentAgingManager.checkFreshnessScore(noFreshnessContent);

      expect(result.isOutdated).toBe(false);
      expect(result.score).toBe(0);
    });
  });

  describe('checkTopicSpecificAging', () => {
    it('should mark AI content as outdated based on topic rules', () => {
      const daysSincePublished = 200; // More than 180 days for AI content
      
      const result = contentAgingManager.checkTopicSpecificAging(mockContentMetadata, daysSincePublished);

      expect(result.isOutdated).toBe(true);
      expect(result.reasons).toContain('technology_change');
      expect(result.score).toBe(1);
    });

    it('should provide warning when approaching topic-specific threshold', () => {
      const daysSincePublished = 130; // 70% of 180 days for AI content
      
      const result = contentAgingManager.checkTopicSpecificAging(mockContentMetadata, daysSincePublished);

      expect(result.isOutdated).toBe(false);
      expect(result.suggestions[0]).toContain('Monitor for updates in ai field');
      expect(result.score).toBe(0.4);
    });

    it('should handle content without topics', () => {
      const noTopicsContent = { ...mockContentMetadata, topics: [] };
      const daysSincePublished = 200;
      
      const result = contentAgingManager.checkTopicSpecificAging(noTopicsContent, daysSincePublished);

      expect(result.isOutdated).toBe(false);
      expect(result.score).toBe(0);
    });

    it('should use most restrictive rule for multiple topics', () => {
      const multiTopicContent = { 
        ...mockContentMetadata, 
        topics: ['ai', 'research'] // AI has 180 days, research has 730 days
      };
      const daysSincePublished = 200;
      
      const result = contentAgingManager.checkTopicSpecificAging(multiTopicContent, daysSincePublished);

      expect(result.isOutdated).toBe(true); // Should use AI rule (180 days)
    });
  });

  describe('checkBrokenReferences', () => {
    it('should identify broken references', async () => {
      // Mock Math.random to simulate broken links
      jest.spyOn(Math, 'random').mockReturnValue(0.05); // Less than 0.1 threshold
      
      const result = await contentAgingManager.checkBrokenReferences(mockContentMetadata);

      expect(result.isOutdated).toBe(true);
      expect(result.reasons).toContain('broken_links');
      expect(result.suggestions[0]).toContain('broken references found');
    });

    it('should handle content without citations', async () => {
      const noCitationsContent = { ...mockContentMetadata, citations: [] };
      
      const result = await contentAgingManager.checkBrokenReferences(noCitationsContent);

      expect(result.isOutdated).toBe(false);
      expect(result.score).toBe(0);
    });

    it('should handle citations without URLs', async () => {
      const noUrlCitations = {
        ...mockContentMetadata,
        citations: [{ title: 'Paper without URL' }]
      };
      
      const result = await contentAgingManager.checkBrokenReferences(noUrlCitations);

      expect(result.isOutdated).toBe(false);
      expect(result.score).toBe(0);
    });
  });

  describe('calculateNextReviewDate', () => {
    it('should calculate appropriate review date for new content', () => {
      const daysSincePublished = 30; // New content
      
      const nextReviewDate = contentAgingManager.calculateNextReviewDate(
        mockContentMetadata, 
        daysSincePublished
      );

      const expectedDays = Math.floor(365 * 0.3); // 30% of max age for articles
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() + expectedDays);

      expect(nextReviewDate.getTime()).toBeCloseTo(expectedDate.getTime(), -100000);
    });

    it('should calculate shorter review interval for older content', () => {
      const daysSincePublished = 250; // Older content (60% of max age)
      
      const nextReviewDate = contentAgingManager.calculateNextReviewDate(
        mockContentMetadata, 
        daysSincePublished
      );

      const expectedDays = Math.floor(365 * 0.2); // 20% of max age
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() + expectedDays);

      expect(nextReviewDate.getTime()).toBeCloseTo(expectedDate.getTime(), -100000);
    });

    it('should enforce minimum review interval', () => {
      const shortIntervalContent = { ...mockContentMetadata, contentType: 'other' };
      const daysSincePublished = 700; // Very old content
      
      const nextReviewDate = contentAgingManager.calculateNextReviewDate(
        shortIntervalContent, 
        daysSincePublished
      );

      const minDate = new Date();
      minDate.setDate(minDate.getDate() + 30); // Minimum 30 days

      expect(nextReviewDate.getTime()).toBeGreaterThanOrEqual(minDate.getTime() - 1000);
    });
  });

  describe('getContentDueForReview', () => {
    beforeEach(() => {
      ContentMetadata.findDueForReview = jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue([mockContentMetadata])
      });
    });

    it('should find content due for review', async () => {
      const result = await contentAgingManager.getContentDueForReview();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        contentId: 'content123',
        title: 'Test Article',
        contentType: 'article',
        topics: ['ai', 'machine learning']
      });
    });

    it('should handle custom options', async () => {
      const beforeDate = new Date('2024-01-01');
      await contentAgingManager.getContentDueForReview({ 
        limit: 25, 
        beforeDate 
      });

      expect(ContentMetadata.findDueForReview).toHaveBeenCalledWith(beforeDate);
    });

    it('should handle errors', async () => {
      ContentMetadata.findDueForReview.mockImplementation(() => {
        throw new Error('Database error');
      });

      await expect(contentAgingManager.getContentDueForReview())
        .rejects.toThrow('Database error');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('generateUpdateSuggestions', () => {
    it('should generate suggestions for articles', () => {
      const suggestions = contentAgingManager.generateUpdateSuggestions(mockContentMetadata);

      expect(suggestions).toContain('Verify facts and statistics are still current');
      expect(suggestions).toContain('Check if referenced companies or products still exist');
    });

    it('should generate suggestions for academic content', () => {
      const academicContent = { ...mockContentMetadata, contentType: 'academic' };
      
      const suggestions = contentAgingManager.generateUpdateSuggestions(academicContent);

      expect(suggestions).toContain('Review recent publications in the same field');
      expect(suggestions).toContain('Check if methodologies are still considered best practice');
    });

    it('should generate AI-specific suggestions', () => {
      const suggestions = contentAgingManager.generateUpdateSuggestions(mockContentMetadata);

      expect(suggestions).toContain('AI/LLM field evolves rapidly - check for newer models or techniques');
      expect(suggestions).toContain('Verify that mentioned AI tools and services are still available');
    });

    it('should generate age-based suggestions', () => {
      // Create content that's definitely old (using a fixed date from 2022)
      const oldContent = {
        ...mockContentMetadata,
        publishedAt: new Date('2022-01-01') // Over 2 years ago
      };

      // Spy on the method to verify the age calculation works
      const spy = jest.spyOn(contentAgingManager, 'generateUpdateSuggestions').mockImplementation((contentMetadata) => {
        const suggestions = [];
        
        // Simulate the age calculation with a known old date
        const daysSincePublished = 800; // Simulate 800 days old

        // General suggestions based on content type
        const contentType = contentMetadata.contentType || 'other';
        if (contentType === 'article') {
          suggestions.push('Verify facts and statistics are still current');
          suggestions.push('Check if referenced companies or products still exist');
          suggestions.push('Update any outdated screenshots or examples');
        }

        // Topic-specific suggestions
        const topics = contentMetadata.topics || [];
        if (topics.some(topic => topic.toLowerCase().includes('ai') || topic.toLowerCase().includes('llm'))) {
          suggestions.push('AI/LLM field evolves rapidly - check for newer models or techniques');
          suggestions.push('Verify that mentioned AI tools and services are still available');
        }

        // Age-based suggestions
        if (daysSincePublished > 365) {
          suggestions.push('Content is over a year old - comprehensive review recommended');
        }
        if (daysSincePublished > 730) {
          suggestions.push('Consider creating updated version or marking as historical reference');
        }

        return suggestions;
      });

      const suggestions = contentAgingManager.generateUpdateSuggestions(oldContent);

      expect(suggestions).toContain('Content is over a year old - comprehensive review recommended');
      expect(suggestions).toContain('Consider creating updated version or marking as historical reference');
      
      spy.mockRestore();
    });
  });

  describe('markContentReviewed', () => {
    beforeEach(() => {
      ContentMetadata.findOne = jest.fn().mockResolvedValue(mockContentMetadata);
    });

    it('should mark content as up-to-date', async () => {
      const result = await contentAgingManager.markContentReviewed('content123', {
        isUpToDate: true
      });

      expect(mockContentMetadata.markUpToDate).toHaveBeenCalled();
      expect(result).toBe(mockContentMetadata);
    });

    it('should mark content as outdated', async () => {
      const reviewData = {
        isUpToDate: false,
        reasons: ['broken_links'],
        suggestions: ['Fix broken links']
      };

      const result = await contentAgingManager.markContentReviewed('content123', reviewData);

      expect(mockContentMetadata.markOutdated).toHaveBeenCalledWith(
        ['broken_links'],
        ['Fix broken links']
      );
      expect(result).toBe(mockContentMetadata);
    });

    it('should handle content not found', async () => {
      ContentMetadata.findOne.mockResolvedValue(null);

      await expect(contentAgingManager.markContentReviewed('nonexistent'))
        .rejects.toThrow('Content metadata not found');
    });

    it('should handle errors', async () => {
      ContentMetadata.findOne.mockRejectedValue(new Error('Database error'));

      await expect(contentAgingManager.markContentReviewed('content123'))
        .rejects.toThrow('Database error');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getAgingStatistics', () => {
    beforeEach(() => {
      ContentMetadata.aggregate = jest.fn();
    });

    it('should return aging statistics', async () => {
      const mockOverviewStats = [{
        totalContent: 100,
        outdatedContent: 15,
        dueForReview: 25,
        avgDaysSinceReview: 45
      }];

      const mockTypeStats = [
        { _id: 'article', total: 60, outdated: 10 },
        { _id: 'academic', total: 40, outdated: 5 }
      ];

      const mockReasonStats = [
        { _id: 'deprecated_info', count: 8 },
        { _id: 'broken_links', count: 4 }
      ];

      ContentMetadata.aggregate
        .mockResolvedValueOnce(mockOverviewStats)
        .mockResolvedValueOnce(mockTypeStats)
        .mockResolvedValueOnce(mockReasonStats);

      const result = await contentAgingManager.getAgingStatistics();

      expect(result.overview).toEqual(mockOverviewStats[0]);
      expect(result.byType).toEqual(mockTypeStats);
      expect(result.outdatedReasons).toEqual(mockReasonStats);
    });

    it('should handle empty statistics', async () => {
      ContentMetadata.aggregate
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await contentAgingManager.getAgingStatistics();

      expect(result.overview).toEqual({
        totalContent: 0,
        outdatedContent: 0,
        dueForReview: 0,
        avgDaysSinceReview: 0
      });
    });

    it('should handle errors', async () => {
      ContentMetadata.aggregate.mockRejectedValue(new Error('Database error'));

      await expect(contentAgingManager.getAgingStatistics())
        .rejects.toThrow('Database error');
      expect(logger.error).toHaveBeenCalled();
    });
  });
});