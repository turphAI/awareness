const ContentMetadata = require('../models/ContentMetadata');
const mongoose = require('mongoose');

describe('Basic Metadata Tests', () => {
  beforeAll(async () => {
    // Connect to test database
    const mongoUri = process.env.MONGO_TEST_URI || 'mongodb://localhost:27017/ai-aggregator-test';
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clear the database
    await ContentMetadata.deleteMany({});
  });

  describe('ContentMetadata Model', () => {
    it('should create metadata successfully', async () => {
      const testContentId = new mongoose.Types.ObjectId();
      const metadataData = {
        contentId: testContentId,
        title: 'Test Article',
        description: 'A test article about AI',
        contentType: 'article',
        language: 'en',
        keywords: ['ai', 'machine learning'],
        tags: ['technology'],
        categories: ['tech'],
        topics: ['artificial intelligence'],
        source: {
          name: 'Test Source',
          url: 'https://example.com/article',
          domain: 'example.com',
          credibilityScore: 0.8,
          authorityScore: 0.7
        },
        authors: [{
          name: 'John Doe',
          email: 'john@example.com'
        }],
        wordCount: 1000,
        readingTime: 5,
        qualityScore: 0.8,
        relevanceScore: 0.9,
        popularityScore: 0.6,
        freshnessScore: 0.7,
        publishedAt: new Date('2024-01-01'),
        processing: {
          status: 'completed',
          extractedAt: new Date()
        }
      };

      const metadata = new ContentMetadata(metadataData);
      const savedMetadata = await metadata.save();

      expect(savedMetadata._id).toBeDefined();
      expect(savedMetadata.title).toBe('Test Article');
      expect(savedMetadata.contentType).toBe('article');
      expect(savedMetadata.source.domain).toBe('example.com');
      expect(savedMetadata.authors).toHaveLength(1);
      expect(savedMetadata.authors[0].name).toBe('John Doe');
    });

    it('should update engagement metrics', async () => {
      const testContentId = new mongoose.Types.ObjectId();
      const metadata = new ContentMetadata({
        contentId: testContentId,
        title: 'Test Article',
        contentType: 'article',
        processing: { status: 'completed' }
      });
      
      await metadata.save();

      const metrics = {
        views: 1000,
        likes: 50,
        shares: 10
      };

      await metadata.updateEngagement(metrics);

      expect(metadata.engagement.views).toBe(1000);
      expect(metadata.engagement.likes).toBe(50);
      expect(metadata.engagement.shares).toBe(10);
    });

    it('should add related content', async () => {
      const testContentId = new mongoose.Types.ObjectId();
      const relatedContentId = new mongoose.Types.ObjectId();
      
      const metadata = new ContentMetadata({
        contentId: testContentId,
        title: 'Test Article',
        contentType: 'article',
        processing: { status: 'completed' }
      });
      
      await metadata.save();

      await metadata.addRelatedContent(relatedContentId, 'similar', 0.8);

      expect(metadata.relatedContent).toHaveLength(1);
      expect(metadata.relatedContent[0].relationshipType).toBe('similar');
      expect(metadata.relatedContent[0].strength).toBe(0.8);
    });

    it('should mark content as outdated', async () => {
      const testContentId = new mongoose.Types.ObjectId();
      const metadata = new ContentMetadata({
        contentId: testContentId,
        title: 'Test Article',
        contentType: 'article',
        processing: { status: 'completed' }
      });
      
      await metadata.save();

      const reasons = ['factual_error', 'deprecated_info'];
      const suggestions = ['Update statistics', 'Review methodology'];

      await metadata.markOutdated(reasons, suggestions);

      expect(metadata.aging.isOutdated).toBe(true);
      expect(metadata.aging.outdatedReasons).toEqual(reasons);
      expect(metadata.aging.updateSuggestions).toEqual(suggestions);
    });

    it('should search metadata with text search', async () => {
      const testContentId1 = new mongoose.Types.ObjectId();
      const testContentId2 = new mongoose.Types.ObjectId();

      await ContentMetadata.create([
        {
          contentId: testContentId1,
          title: 'AI Machine Learning Article',
          description: 'An article about artificial intelligence',
          contentType: 'article',
          processing: { status: 'completed' }
        },
        {
          contentId: testContentId2,
          title: 'Web Development Guide',
          description: 'A guide about web development',
          contentType: 'article',
          processing: { status: 'completed' }
        }
      ]);

      const results = await ContentMetadata.searchMetadata('machine learning');
      
      expect(results).toHaveLength(1);
      expect(results[0].title).toContain('Machine Learning');
    });

    it('should get content statistics', async () => {
      const testContentId = new mongoose.Types.ObjectId();
      await ContentMetadata.create({
        contentId: testContentId,
        title: 'Test Article',
        contentType: 'article',
        qualityScore: 0.8,
        relevanceScore: 0.9,
        processing: { status: 'completed' }
      });

      const stats = await ContentMetadata.getContentStatistics();

      expect(stats.overview.totalContent).toBe(1);
      expect(stats.overview.avgQualityScore).toBe(0.8);
      expect(stats.overview.avgRelevanceScore).toBe(0.9);
      expect(stats.byType).toHaveLength(1);
      expect(stats.byType[0]._id).toBe('article');
      expect(stats.byType[0].count).toBe(1);
    });
  });
});