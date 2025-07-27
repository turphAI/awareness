const DigestGenerator = require('../utils/digestGenerator');
const DigestScheduling = require('../models/DigestScheduling');
const mongoose = require('mongoose');

describe('DigestGenerator', () => {
  let digestGenerator;
  let mockScheduling;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/test-ai-aggregator');
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await DigestScheduling.deleteMany({});
    digestGenerator = new DigestGenerator();
    
    // Create mock scheduling
    const userId = new mongoose.Types.ObjectId();
    mockScheduling = new DigestScheduling({
      userId,
      enabled: true,
      frequency: 'daily',
      contentSelection: {
        maxItems: 10,
        prioritizeBreakingNews: true,
        includePersonalizedContent: true,
        contentTypes: {
          articles: true,
          papers: true,
          podcasts: false,
          videos: false,
          social: false
        },
        topicFilters: ['AI', 'Machine Learning'],
        sourceFilters: []
      },
      formatting: {
        includeFullSummaries: true,
        includeThumbnails: true,
        includeReadingTime: true,
        groupByTopic: false,
        sortBy: 'relevance'
      }
    });
  });

  describe('generateDigest', () => {
    test('should generate digest with correct structure', async () => {
      const digest = await digestGenerator.generateDigest(mockScheduling);

      expect(digest).toHaveProperty('title');
      expect(digest).toHaveProperty('summary');
      expect(digest).toHaveProperty('content');
      expect(digest).toHaveProperty('totalItems');
      expect(digest).toHaveProperty('generatedAt');
      expect(digest).toHaveProperty('metadata');

      expect(digest.metadata).toHaveProperty('userId');
      expect(digest.metadata).toHaveProperty('generatedAt');
      expect(digest.metadata).toHaveProperty('frequency');
      expect(digest.metadata).toHaveProperty('contentCount');
      expect(digest.metadata).toHaveProperty('criteria');
      expect(digest.metadata).toHaveProperty('formatting');

      expect(digest.metadata.userId).toBe(mockScheduling.userId);
      expect(digest.metadata.frequency).toBe('daily');
      expect(Array.isArray(digest.content)).toBe(true);
    });

    test('should respect maxItems limit', async () => {
      mockScheduling.contentSelection.maxItems = 3;
      
      const digest = await digestGenerator.generateDigest(mockScheduling);

      expect(digest.content.length).toBeLessThanOrEqual(3);
      expect(digest.totalItems).toBeLessThanOrEqual(3);
      expect(digest.metadata.contentCount).toBeLessThanOrEqual(3);
    });

    test('should filter by content types', async () => {
      mockScheduling.contentSelection.contentTypes = {
        articles: true,
        papers: false,
        podcasts: false,
        videos: false,
        social: false
      };

      const digest = await digestGenerator.generateDigest(mockScheduling);

      digest.content.forEach(item => {
        expect(item.type).toBe('articles');
      });
    });

    test('should filter by topic filters', async () => {
      mockScheduling.contentSelection.topicFilters = ['AI'];

      const digest = await digestGenerator.generateDigest(mockScheduling);

      digest.content.forEach(item => {
        expect(item.topics.some(topic => 
          topic.toLowerCase().includes('ai')
        )).toBe(true);
      });
    });

    test('should prioritize breaking news when enabled', async () => {
      mockScheduling.contentSelection.prioritizeBreakingNews = true;

      const digest = await digestGenerator.generateDigest(mockScheduling);

      // Check if breaking news items appear first (if any exist)
      const breakingNewsItems = digest.content.filter(item => item.isBreakingNews);
      if (breakingNewsItems.length > 0) {
        expect(digest.content[0].isBreakingNews).toBe(true);
      }
    });

    test('should group by topic when enabled', async () => {
      mockScheduling.formatting.groupByTopic = true;

      const digest = await digestGenerator.generateDigest(mockScheduling);

      expect(typeof digest.content).toBe('object');
      expect(Array.isArray(digest.content)).toBe(false);
      
      // Check that content is grouped by topics
      for (const [topic, items] of Object.entries(digest.content)) {
        expect(typeof topic).toBe('string');
        expect(Array.isArray(items)).toBe(true);
      }
    });

    test('should sort content by relevance', async () => {
      mockScheduling.formatting.sortBy = 'relevance';

      const digest = await digestGenerator.generateDigest(mockScheduling);

      // Check that items are sorted by relevance score (descending)
      for (let i = 0; i < digest.content.length - 1; i++) {
        const currentScore = digest.content[i].relevanceScore || 0;
        const nextScore = digest.content[i + 1].relevanceScore || 0;
        expect(currentScore).toBeGreaterThanOrEqual(nextScore);
      }
    });

    test('should sort content by recency', async () => {
      mockScheduling.formatting.sortBy = 'recency';

      const digest = await digestGenerator.generateDigest(mockScheduling);

      // Check that items are sorted by publish date (descending)
      for (let i = 0; i < digest.content.length - 1; i++) {
        const currentDate = new Date(digest.content[i].publishDate);
        const nextDate = new Date(digest.content[i + 1].publishDate);
        expect(currentDate.getTime()).toBeGreaterThanOrEqual(nextDate.getTime());
      }
    });

    test('should include full summaries when enabled', async () => {
      mockScheduling.formatting.includeFullSummaries = true;

      const digest = await digestGenerator.generateDigest(mockScheduling);

      digest.content.forEach(item => {
        if (item.summary) {
          // Should not be truncated
          expect(item.summary).not.toMatch(/\.\.\.$/);
        }
      });
    });

    test('should truncate summaries when full summaries disabled', async () => {
      mockScheduling.formatting.includeFullSummaries = false;

      const digest = await digestGenerator.generateDigest(mockScheduling);

      digest.content.forEach(item => {
        if (item.summary && item.summary.length > 200) {
          expect(item.summary).toMatch(/\.\.\.$/);
        }
      });
    });

    test('should include thumbnails when enabled', async () => {
      mockScheduling.formatting.includeThumbnails = true;

      const digest = await digestGenerator.generateDigest(mockScheduling);

      digest.content.forEach(item => {
        if (item.thumbnail) {
          expect(item).toHaveProperty('thumbnail');
        }
      });
    });

    test('should include reading time when enabled', async () => {
      mockScheduling.formatting.includeReadingTime = true;

      const digest = await digestGenerator.generateDigest(mockScheduling);

      digest.content.forEach(item => {
        expect(item).toHaveProperty('readingTime');
        expect(typeof item.readingTime).toBe('number');
        expect(item.readingTime).toBeGreaterThan(0);
      });
    });

    test('should handle errors gracefully', async () => {
      // Mock an error in content fetching
      const originalFetchContent = digestGenerator.fetchContent;
      digestGenerator.fetchContent = jest.fn().mockRejectedValue(new Error('Content fetch error'));

      await expect(digestGenerator.generateDigest(mockScheduling))
        .rejects.toThrow('Content fetch error');

      // Restore original method
      digestGenerator.fetchContent = originalFetchContent;
    });
  });

  describe('fetchContent', () => {
    test('should return array of content items', async () => {
      const criteria = mockScheduling.getContentSelectionCriteria();
      const content = await digestGenerator.fetchContent(mockScheduling.userId, criteria);

      expect(Array.isArray(content)).toBe(true);
      expect(content.length).toBeGreaterThan(0);
      
      content.forEach(item => {
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('title');
        expect(item).toHaveProperty('type');
        expect(item).toHaveProperty('publishDate');
        expect(item).toHaveProperty('url');
      });
    });

    test('should filter content by types', async () => {
      const criteria = {
        contentTypes: ['articles'],
        topicFilters: [],
        sourceFilters: [],
        prioritizeBreakingNews: false
      };

      const content = await digestGenerator.fetchContent(mockScheduling.userId, criteria);

      content.forEach(item => {
        expect(item.type).toBe('articles');
      });
    });

    test('should filter content by topic filters', async () => {
      const criteria = {
        contentTypes: ['articles', 'papers'],
        topicFilters: ['AI'],
        sourceFilters: [],
        prioritizeBreakingNews: false
      };

      const content = await digestGenerator.fetchContent(mockScheduling.userId, criteria);

      content.forEach(item => {
        expect(item.topics.some(topic => 
          topic.toLowerCase().includes('ai')
        )).toBe(true);
      });
    });
  });

  describe('sortContent', () => {
    let mockContent;

    beforeEach(() => {
      mockContent = [
        { id: '1', relevanceScore: 80, publishDate: '2023-01-01', popularityScore: 70 },
        { id: '2', relevanceScore: 90, publishDate: '2023-01-02', popularityScore: 85 },
        { id: '3', relevanceScore: 75, publishDate: '2023-01-03', popularityScore: 90 }
      ];
    });

    test('should sort by relevance', () => {
      const sorted = digestGenerator.sortContent(mockContent, 'relevance');
      
      expect(sorted[0].id).toBe('2'); // highest relevance
      expect(sorted[1].id).toBe('1');
      expect(sorted[2].id).toBe('3'); // lowest relevance
    });

    test('should sort by recency', () => {
      const sorted = digestGenerator.sortContent(mockContent, 'recency');
      
      expect(sorted[0].id).toBe('3'); // most recent
      expect(sorted[1].id).toBe('2');
      expect(sorted[2].id).toBe('1'); // oldest
    });

    test('should sort by popularity', () => {
      const sorted = digestGenerator.sortContent(mockContent, 'popularity');
      
      expect(sorted[0].id).toBe('3'); // highest popularity
      expect(sorted[1].id).toBe('2');
      expect(sorted[2].id).toBe('1'); // lowest popularity
    });

    test('should return original order for unknown sort criteria', () => {
      const sorted = digestGenerator.sortContent(mockContent, 'unknown');
      
      expect(sorted[0].id).toBe('1');
      expect(sorted[1].id).toBe('2');
      expect(sorted[2].id).toBe('3');
    });
  });

  describe('prioritizeBreakingNews', () => {
    test('should move breaking news to front', () => {
      const content = [
        { id: '1', isBreakingNews: false },
        { id: '2', isBreakingNews: true },
        { id: '3', isBreakingNews: false },
        { id: '4', isBreakingNews: true }
      ];

      const prioritized = digestGenerator.prioritizeBreakingNews(content);

      expect(prioritized[0].id).toBe('2');
      expect(prioritized[1].id).toBe('4');
      expect(prioritized[2].id).toBe('1');
      expect(prioritized[3].id).toBe('3');
    });

    test('should handle content with no breaking news', () => {
      const content = [
        { id: '1', isBreakingNews: false },
        { id: '2', isBreakingNews: false }
      ];

      const prioritized = digestGenerator.prioritizeBreakingNews(content);

      expect(prioritized).toEqual(content);
    });
  });

  describe('formatDigest', () => {
    let mockContent;
    let mockFormatting;

    beforeEach(() => {
      mockContent = [
        {
          id: '1',
          title: 'Test Article 1',
          type: 'articles',
          topics: ['AI'],
          summary: 'Test summary 1',
          publishDate: '2023-01-01'
        },
        {
          id: '2',
          title: 'Test Article 2',
          type: 'articles',
          topics: ['ML'],
          summary: 'Test summary 2',
          publishDate: '2023-01-02'
        }
      ];

      mockFormatting = {
        includeFullSummaries: true,
        includeThumbnails: true,
        includeReadingTime: true,
        groupByTopic: false,
        sortBy: 'relevance'
      };
    });

    test('should format digest with correct structure', async () => {
      const digest = await digestGenerator.formatDigest(mockContent, mockFormatting);

      expect(digest).toHaveProperty('title');
      expect(digest).toHaveProperty('summary');
      expect(digest).toHaveProperty('content');
      expect(digest).toHaveProperty('totalItems');
      expect(digest).toHaveProperty('generatedAt');

      expect(digest.totalItems).toBe(2);
      expect(Array.isArray(digest.content)).toBe(true);
    });

    test('should group content by topic when enabled', async () => {
      mockFormatting.groupByTopic = true;

      const digest = await digestGenerator.formatDigest(mockContent, mockFormatting);

      expect(typeof digest.content).toBe('object');
      expect(Array.isArray(digest.content)).toBe(false);
      expect(digest.content).toHaveProperty('AI');
      expect(digest.content).toHaveProperty('ML');
    });
  });

  describe('generateDigestTitle', () => {
    test('should generate title with item count', () => {
      const title = digestGenerator.generateDigestTitle(5);
      
      expect(title).toContain('Your AI Information Digest');
      expect(title).toContain('5 items');
      expect(title).toMatch(/\d{4}/); // Should contain year
    });
  });

  describe('generateDigestSummary', () => {
    test('should generate summary with content statistics', () => {
      const content = [
        { type: 'articles', topics: ['AI', 'ML'] },
        { type: 'papers', topics: ['AI'] },
        { type: 'articles', topics: ['NLP'] }
      ];

      const summary = digestGenerator.generateDigestSummary(content);

      expect(summary).toContain('3 items');
      expect(summary).toContain('2 articles');
      expect(summary).toContain('1 paper');
      expect(summary).toContain('AI');
    });
  });

  describe('Service Dependencies', () => {
    test('should set service dependencies', () => {
      const mockServices = {
        contentService: { mock: 'content' },
        personalizationService: { mock: 'personalization' },
        libraryService: { mock: 'library' }
      };

      digestGenerator.setServices(mockServices);

      expect(digestGenerator.contentService).toBe(mockServices.contentService);
      expect(digestGenerator.personalizationService).toBe(mockServices.personalizationService);
      expect(digestGenerator.libraryService).toBe(mockServices.libraryService);
    });
  });
});