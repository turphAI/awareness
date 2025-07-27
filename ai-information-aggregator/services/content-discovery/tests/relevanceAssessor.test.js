const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const relevanceAssessor = require('../utils/relevanceAssessor');
const Content = require('../models/Content');

describe('Relevance Assessor', () => {
  let mongoServer;
  
  // Connect to test database before tests
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
  });
  
  // Clear test database after tests
  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
  });
  
  // Clear collections before each test
  beforeEach(async () => {
    await Content.deleteMany({});
  });
  
  describe('assessContentRelevance', () => {
    it('should assess content relevance and return a score', async () => {
      // Create test content
      const content = new Content({
        sourceId: new mongoose.Types.ObjectId(),
        url: 'https://example.com/article',
        title: 'Machine Learning Fundamentals',
        author: 'Test Author',
        publishDate: new Date(),
        type: 'article',
        categories: ['AI', 'Technology'],
        topics: ['Machine Learning', 'Neural Networks'],
        summary: 'An introduction to machine learning concepts and techniques.',
        fullText: 'This is a comprehensive guide to machine learning fundamentals.',
        readCount: 10,
        saveCount: 5,
        shareCount: 2
      });
      
      await content.save();
      
      // Define assessment options
      const options = {
        userInterests: ['AI', 'Machine Learning', 'Data Science'],
        systemTopics: ['Technology', 'Computer Science']
      };
      
      // Assess content relevance
      const result = await relevanceAssessor.assessContentRelevance(content, options);
      
      // Check result
      expect(result.success).toBe(true);
      expect(result.contentId.toString()).toBe(content._id.toString());
      expect(result.relevanceScore).toBeGreaterThan(0);
      expect(result.relevanceScore).toBeLessThanOrEqual(1);
      
      // Check factors
      expect(result.factors.textRelevance).toBeGreaterThan(0);
      expect(result.factors.topicMatch).toBeGreaterThan(0);
      expect(result.factors.recency).toBeGreaterThan(0);
      expect(result.factors.popularity).toBeGreaterThan(0);
      expect(result.factors.quality).toBeGreaterThan(0);
      expect(result.factors.sourceRelevance).toBeGreaterThan(0);
      
      // Check that content was updated with new relevance score
      const updatedContent = await Content.findById(content._id);
      expect(updatedContent.relevanceScore).toBe(result.relevanceScore);
    });
    
    it('should handle content without text fields', async () => {
      // Create test content with minimal fields
      const content = new Content({
        sourceId: new mongoose.Types.ObjectId(),
        url: 'https://example.com/article',
        title: 'Test Article',
        type: 'article'
      });
      
      await content.save();
      
      // Assess content relevance
      const result = await relevanceAssessor.assessContentRelevance(content);
      
      // Check result
      expect(result.success).toBe(true);
      expect(result.contentId.toString()).toBe(content._id.toString());
      expect(result.relevanceScore).toBeGreaterThan(0);
      expect(result.relevanceScore).toBeLessThanOrEqual(1);
    });
    
    it('should handle errors gracefully', async () => {
      // Create invalid content (missing required fields)
      const content = {
        _id: new mongoose.Types.ObjectId(),
        // Missing required fields
        save: jest.fn().mockRejectedValue(new Error('Validation error'))
      };
      
      // Assess content relevance
      const result = await relevanceAssessor.assessContentRelevance(content);
      
      // Check result
      expect(result.success).toBe(false);
      expect(result.contentId).toBe(content._id);
      expect(result.error).toBeDefined();
    });
  });
  
  describe('calculateTextRelevance', () => {
    it('should calculate text relevance based on content and interests', async () => {
      // Create test content
      const content = new Content({
        sourceId: new mongoose.Types.ObjectId(),
        url: 'https://example.com/article',
        title: 'Machine Learning Fundamentals',
        summary: 'An introduction to machine learning concepts and techniques.',
        fullText: 'This is a comprehensive guide to machine learning fundamentals.'
      });
      
      // Define options with matching interests
      const options = {
        userInterests: ['Machine Learning', 'AI'],
        systemTopics: ['Technology']
      };
      
      // Calculate text relevance
      const relevance = await relevanceAssessor.calculateTextRelevance(content, options);
      
      // Check result
      expect(relevance).toBeGreaterThan(0);
      expect(relevance).toBeLessThanOrEqual(1);
      
      // Calculate with non-matching interests
      const nonMatchingOptions = {
        userInterests: ['Biology', 'Chemistry'],
        systemTopics: ['Science']
      };
      
      const nonMatchingRelevance = await relevanceAssessor.calculateTextRelevance(content, nonMatchingOptions);
      
      // Non-matching interests should result in lower relevance
      expect(nonMatchingRelevance).toBeLessThan(relevance);
    });
  });
  
  describe('calculateTopicMatch', () => {
    it('should calculate topic match based on content topics and interests', () => {
      // Create test content
      const content = {
        topics: ['Machine Learning', 'Neural Networks', 'Deep Learning']
      };
      
      // Define options with matching interests
      const options = {
        userInterests: ['AI', 'Machine Learning'],
        systemTopics: ['Technology']
      };
      
      // Calculate topic match
      const match = relevanceAssessor.calculateTopicMatch(content, options);
      
      // Check result
      expect(match).toBeGreaterThan(0);
      expect(match).toBeLessThanOrEqual(1);
      
      // Calculate with non-matching interests
      const nonMatchingOptions = {
        userInterests: ['Biology', 'Chemistry'],
        systemTopics: ['Science']
      };
      
      const nonMatchingMatch = relevanceAssessor.calculateTopicMatch(content, nonMatchingOptions);
      
      // Non-matching interests should result in lower match
      expect(nonMatchingMatch).toBeLessThan(match);
    });
    
    it('should handle content without topics', () => {
      // Create test content without topics
      const content = {};
      
      // Define options
      const options = {
        userInterests: ['AI', 'Machine Learning'],
        systemTopics: ['Technology']
      };
      
      // Calculate topic match
      const match = relevanceAssessor.calculateTopicMatch(content, options);
      
      // Check result - should return default score
      expect(match).toBe(0.5);
    });
  });
  
  describe('calculateRecency', () => {
    it('should calculate recency based on publish date', () => {
      // Create test content with recent publish date
      const recentContent = {
        publishDate: new Date()
      };
      
      // Calculate recency
      const recentScore = relevanceAssessor.calculateRecency(recentContent);
      
      // Check result - recent content should have high score
      expect(recentScore).toBeGreaterThan(0.9);
      
      // Create test content with old publish date
      const oldContent = {
        publishDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) // 1 year ago
      };
      
      // Calculate recency
      const oldScore = relevanceAssessor.calculateRecency(oldContent);
      
      // Check result - old content should have lower score
      expect(oldScore).toBeLessThan(recentScore);
    });
    
    it('should handle content without publish date', () => {
      // Create test content without publish date
      const content = {};
      
      // Calculate recency
      const score = relevanceAssessor.calculateRecency(content);
      
      // Check result - should return default score
      expect(score).toBe(0.5);
    });
  });
  
  describe('calculatePopularity', () => {
    it('should calculate popularity based on interaction counts', () => {
      // Create test content with high interaction counts
      const popularContent = {
        readCount: 100,
        saveCount: 50,
        shareCount: 20
      };
      
      // Calculate popularity
      const popularScore = relevanceAssessor.calculatePopularity(popularContent);
      
      // Check result - popular content should have high score
      expect(popularScore).toBeGreaterThan(0.5);
      
      // Create test content with low interaction counts
      const unpopularContent = {
        readCount: 5,
        saveCount: 1,
        shareCount: 0
      };
      
      // Calculate popularity
      const unpopularScore = relevanceAssessor.calculatePopularity(unpopularContent);
      
      // Check result - unpopular content should have lower score
      expect(unpopularScore).toBeLessThan(popularScore);
    });
    
    it('should handle content without interaction counts', () => {
      // Create test content without interaction counts
      const content = {};
      
      // Calculate popularity
      const score = relevanceAssessor.calculatePopularity(content);
      
      // Check result - should return low score for no interactions
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThan(0.1);
    });
  });
  
  describe('calculateQuality', () => {
    it('should use existing quality score if available', () => {
      // Create test content with quality score
      const content = {
        qualityScore: 0.8
      };
      
      // Calculate quality
      const score = relevanceAssessor.calculateQuality(content);
      
      // Check result - should use existing score
      expect(score).toBe(0.8);
    });
    
    it('should calculate quality from quality factors if available', () => {
      // Create test content with quality factors
      const content = {
        qualityFactors: {
          credibility: 0.9,
          readability: 0.8,
          originality: 0.7,
          depth: 0.6
        }
      };
      
      // Calculate quality
      const score = relevanceAssessor.calculateQuality(content);
      
      // Check result - should be average of factors
      expect(score).toBe(0.75);
    });
    
    it('should estimate quality from content properties if no quality data', () => {
      // Create test content with properties that indicate quality
      const content = {
        wordCount: 2000,
        references: [1, 2, 3], // 3 references
        visualElements: [1, 2] // 2 visual elements
      };
      
      // Calculate quality
      const score = relevanceAssessor.calculateQuality(content);
      
      // Check result - should estimate based on properties
      expect(score).toBeGreaterThan(0.5);
    });
  });
  
  describe('filterContentByRelevance', () => {
    it('should filter content based on relevance threshold', () => {
      // Create test contents with different relevance scores
      const contents = [
        { _id: 1, relevanceScore: 0.9 },
        { _id: 2, relevanceScore: 0.7 },
        { _id: 3, relevanceScore: 0.5 },
        { _id: 4, relevanceScore: 0.3 },
        { _id: 5, relevanceScore: 0.1 }
      ];
      
      // Filter with threshold 0.5
      const filtered1 = relevanceAssessor.filterContentByRelevance(contents, 0.5);
      
      // Check result - should include contents with score >= 0.5
      expect(filtered1.length).toBe(3);
      expect(filtered1.map(c => c._id)).toEqual([1, 2, 3]);
      
      // Filter with threshold 0.8
      const filtered2 = relevanceAssessor.filterContentByRelevance(contents, 0.8);
      
      // Check result - should include contents with score >= 0.8
      expect(filtered2.length).toBe(1);
      expect(filtered2.map(c => c._id)).toEqual([1]);
    });
    
    it('should handle empty content array', () => {
      // Filter empty array
      const filtered = relevanceAssessor.filterContentByRelevance([]);
      
      // Check result - should return empty array
      expect(filtered).toEqual([]);
    });
  });
  
  describe('batchAssessContentRelevance', () => {
    it('should assess relevance for multiple content items', async () => {
      // Create test contents
      const contents = [
        new Content({
          sourceId: new mongoose.Types.ObjectId(),
          url: 'https://example.com/article1',
          title: 'Machine Learning Fundamentals',
          type: 'article',
          topics: ['Machine Learning', 'AI']
        }),
        new Content({
          sourceId: new mongoose.Types.ObjectId(),
          url: 'https://example.com/article2',
          title: 'Deep Learning Applications',
          type: 'article',
          topics: ['Deep Learning', 'Neural Networks']
        })
      ];
      
      // Save contents
      await Promise.all(contents.map(content => content.save()));
      
      // Get content IDs
      const contentIds = contents.map(content => content._id);
      
      // Define assessment options
      const options = {
        userInterests: ['AI', 'Machine Learning'],
        systemTopics: ['Technology']
      };
      
      // Batch assess content relevance
      const result = await relevanceAssessor.batchAssessContentRelevance(contentIds, options);
      
      // Check result
      expect(result.success).toBe(true);
      expect(result.processed).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.results.length).toBe(2);
      
      // Check that all contents were updated with relevance scores
      const updatedContents = await Content.find({ _id: { $in: contentIds } });
      expect(updatedContents[0].relevanceScore).toBeGreaterThan(0);
      expect(updatedContents[1].relevanceScore).toBeGreaterThan(0);
    });
    
    it('should handle errors for individual content items', async () => {
      // Create one valid content and one invalid ID
      const validContent = new Content({
        sourceId: new mongoose.Types.ObjectId(),
        url: 'https://example.com/article',
        title: 'Test Article',
        type: 'article'
      });
      
      await validContent.save();
      
      const invalidId = new mongoose.Types.ObjectId();
      
      // Batch assess content relevance
      const result = await relevanceAssessor.batchAssessContentRelevance([validContent._id, invalidId]);
      
      // Check result - should process valid content and fail for invalid ID
      expect(result.success).toBe(true);
      expect(result.processed).toBe(1);
      expect(result.failed).toBe(0); // No failure because the invalid ID just doesn't return a content
      expect(result.results.length).toBe(1);
    });
  });
});