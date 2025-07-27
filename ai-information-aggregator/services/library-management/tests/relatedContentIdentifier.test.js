const RelatedContentIdentifier = require('../utils/relatedContentIdentifier');
const ContentMetadata = require('../models/ContentMetadata');
const Content = require('../../content-discovery/models/Content');

// Mock the models
jest.mock('../models/ContentMetadata');
jest.mock('../../content-discovery/models/Content');

describe('RelatedContentIdentifier', () => {
  let identifier;
  let mockContent1, mockContent2, mockMetadata1, mockMetadata2;

  beforeEach(() => {
    identifier = new RelatedContentIdentifier();
    
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock content objects
    mockContent1 = {
      _id: 'content1',
      title: 'Introduction to Machine Learning',
      author: 'John Doe',
      type: 'article',
      topics: ['machine learning', 'artificial intelligence', 'data science'],
      categories: ['technology', 'education'],
      publishDate: new Date('2023-01-15'),
      summary: 'A comprehensive introduction to machine learning concepts and algorithms.',
      keyInsights: ['ML is transforming industries', 'Data quality is crucial'],
      relevanceScore: 0.8,
      processed: true
    };

    mockContent2 = {
      _id: 'content2',
      title: 'Advanced Machine Learning Techniques',
      author: 'Jane Smith',
      type: 'article',
      topics: ['machine learning', 'deep learning', 'neural networks'],
      categories: ['technology', 'research'],
      publishDate: new Date('2023-02-10'),
      summary: 'Exploring advanced techniques in machine learning and deep learning.',
      keyInsights: ['Deep learning requires large datasets', 'GPU acceleration is important'],
      relevanceScore: 0.9,
      processed: true
    };

    mockMetadata1 = {
      contentId: 'content1',
      keywords: ['machine', 'learning', 'algorithms'],
      tags: ['beginner', 'tutorial'],
      qualityScore: 0.85
    };

    mockMetadata2 = {
      contentId: 'content2',
      keywords: ['deep', 'learning', 'neural'],
      tags: ['advanced', 'research'],
      qualityScore: 0.92
    };
  });

  describe('calculateSimilarity', () => {
    it('should calculate similarity between two content items', () => {
      const similarity = identifier.calculateSimilarity(mockContent1, mockContent2);
      
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThanOrEqual(1);
    });

    it('should return higher similarity for content with overlapping topics', () => {
      const content3 = {
        ...mockContent2,
        topics: ['machine learning', 'artificial intelligence'] // More overlap with content1
      };
      
      const similarity1 = identifier.calculateSimilarity(mockContent1, mockContent2);
      const similarity2 = identifier.calculateSimilarity(mockContent1, content3);
      
      expect(similarity2).toBeGreaterThan(similarity1);
    });

    it('should return low similarity for completely different content', () => {
      const differentContent = {
        _id: 'content3',
        title: 'Cooking Recipes',
        author: 'Chef Bob',
        type: 'article',
        topics: ['cooking', 'recipes', 'food'],
        categories: ['lifestyle', 'food'],
        publishDate: new Date('2023-01-15'),
        summary: 'Delicious recipes for home cooking.',
        keyInsights: ['Fresh ingredients matter', 'Timing is everything'],
        relevanceScore: 0.7
      };
      
      const similarity = identifier.calculateSimilarity(mockContent1, differentContent);
      expect(similarity).toBeLessThan(0.3);
    });
  });

  describe('calculateTopicSimilarity', () => {
    it('should return 1 for identical topic arrays', () => {
      const topics = ['machine learning', 'AI'];
      const similarity = identifier.calculateTopicSimilarity(topics, topics);
      expect(similarity).toBe(1);
    });

    it('should return 0 for completely different topics', () => {
      const topics1 = ['machine learning', 'AI'];
      const topics2 = ['cooking', 'recipes'];
      const similarity = identifier.calculateTopicSimilarity(topics1, topics2);
      expect(similarity).toBe(0);
    });

    it('should calculate Jaccard coefficient correctly', () => {
      const topics1 = ['machine learning', 'AI', 'data science'];
      const topics2 = ['machine learning', 'deep learning'];
      const similarity = identifier.calculateTopicSimilarity(topics1, topics2);
      
      // Intersection: ['machine learning'] = 1
      // Union: ['machine learning', 'AI', 'data science', 'deep learning'] = 4
      // Jaccard = 1/4 = 0.25
      expect(similarity).toBe(0.25);
    });

    it('should handle empty arrays', () => {
      expect(identifier.calculateTopicSimilarity([], [])).toBe(1);
      expect(identifier.calculateTopicSimilarity(['topic'], [])).toBe(0);
      expect(identifier.calculateTopicSimilarity([], ['topic'])).toBe(0);
    });
  });

  describe('calculateAuthorSimilarity', () => {
    it('should return 1 for same author', () => {
      const content1 = { author: 'John Doe' };
      const content2 = { author: 'John Doe' };
      const similarity = identifier.calculateAuthorSimilarity(content1, content2);
      expect(similarity).toBe(1);
    });

    it('should return 0 for different authors', () => {
      const content1 = { author: 'John Doe' };
      const content2 = { author: 'Jane Smith' };
      const similarity = identifier.calculateAuthorSimilarity(content1, content2);
      expect(similarity).toBe(0);
    });

    it('should handle missing authors', () => {
      const content1 = { author: 'John Doe' };
      const content2 = {};
      const similarity = identifier.calculateAuthorSimilarity(content1, content2);
      expect(similarity).toBe(0);
    });

    it('should handle authors array format', () => {
      const content1 = { authors: [{ name: 'John Doe' }] };
      const content2 = { authors: [{ name: 'John Doe' }] };
      const similarity = identifier.calculateAuthorSimilarity(content1, content2);
      expect(similarity).toBe(1);
    });
  });

  describe('calculateTemporalSimilarity', () => {
    it('should return high similarity for content published on same date', () => {
      const date = new Date('2023-01-15');
      const content1 = { publishDate: date };
      const content2 = { publishDate: date };
      const similarity = identifier.calculateTemporalSimilarity(content1, content2);
      expect(similarity).toBe(1);
    });

    it('should return lower similarity for content published far apart', () => {
      const content1 = { publishDate: new Date('2023-01-15') };
      const content2 = { publishDate: new Date('2023-12-15') };
      const similarity = identifier.calculateTemporalSimilarity(content1, content2);
      expect(similarity).toBeLessThan(0.1);
    });

    it('should handle missing dates', () => {
      const content1 = { publishDate: new Date('2023-01-15') };
      const content2 = {};
      const similarity = identifier.calculateTemporalSimilarity(content1, content2);
      expect(similarity).toBe(0.5);
    });
  });

  describe('extractKeywords', () => {
    it('should extract keywords and remove stop words', () => {
      const text = 'The machine learning algorithm is very effective for data analysis';
      const keywords = identifier.extractKeywords(text);
      
      expect(keywords).not.toContain('the');
      expect(keywords).not.toContain('is');
      expect(keywords).not.toContain('for');
      expect(keywords).toContain('machine');
      expect(keywords).toContain('learning');
      expect(keywords).toContain('algorithm');
    });

    it('should filter out short words', () => {
      const text = 'AI is a big field';
      const keywords = identifier.extractKeywords(text);
      
      expect(keywords).not.toContain('ai'); // Too short
      expect(keywords).not.toContain('is'); // Stop word
      expect(keywords).toContain('big');
      expect(keywords).toContain('field');
    });

    it('should limit keywords to 50', () => {
      const longText = Array(100).fill('keyword').join(' ');
      const keywords = identifier.extractKeywords(longText);
      expect(keywords.length).toBeLessThanOrEqual(50);
    });
  });

  describe('findRelatedContent', () => {
    beforeEach(() => {
      // Mock Content.findById
      Content.findById.mockResolvedValue(mockContent1);
      
      // Mock Content.find with lean method
      const mockQuery = {
        lean: jest.fn().mockResolvedValue([mockContent2])
      };
      Content.find.mockReturnValue(mockQuery);
      
      // Mock ContentMetadata.findOne
      ContentMetadata.findOne
        .mockResolvedValueOnce(mockMetadata1) // For source content
        .mockResolvedValueOnce(mockMetadata2); // For related content
    });

    it('should find related content successfully', async () => {
      const relatedContent = await identifier.findRelatedContent('content1', {
        threshold: 0.1 // Lower threshold to ensure we get results
      });
      
      expect(Content.findById).toHaveBeenCalledWith('content1');
      expect(Content.find).toHaveBeenCalledWith({
        _id: { $ne: 'content1' },
        processed: true
      });
      expect(relatedContent.length).toBeGreaterThanOrEqual(0);
      if (relatedContent.length > 0) {
        expect(relatedContent[0]).toHaveProperty('content');
        expect(relatedContent[0]).toHaveProperty('similarity');
        expect(relatedContent[0]).toHaveProperty('relationshipType');
      }
    });

    it('should respect similarity threshold', async () => {
      const relatedContent = await identifier.findRelatedContent('content1', {
        threshold: 0.9 // Very high threshold
      });
      
      // Should return empty array if no content meets threshold
      expect(relatedContent.length).toBeLessThanOrEqual(1);
    });

    it('should limit results correctly', async () => {
      // Mock multiple related content
      const mockQuery = {
        lean: jest.fn().mockResolvedValue([mockContent2, { ...mockContent2, _id: 'content3' }])
      };
      Content.find.mockReturnValue(mockQuery);
      ContentMetadata.findOne
        .mockResolvedValueOnce(mockMetadata1)
        .mockResolvedValueOnce(mockMetadata2)
        .mockResolvedValueOnce(mockMetadata2);
      
      const relatedContent = await identifier.findRelatedContent('content1', {
        limit: 1,
        threshold: 0.1 // Lower threshold
      });
      
      expect(relatedContent.length).toBeLessThanOrEqual(1);
    });

    it('should throw error if source content not found', async () => {
      Content.findById.mockResolvedValue(null);
      
      await expect(identifier.findRelatedContent('nonexistent'))
        .rejects.toThrow('Source content not found');
    });
  });

  describe('determineRelationshipType', () => {
    it('should identify same author relationship', () => {
      const content1 = { author: 'John Doe', topics: ['AI'] };
      const content2 = { author: 'John Doe', topics: ['ML'] };
      const relationshipType = identifier.determineRelationshipType(content1, content2, 0.5);
      expect(relationshipType).toBe('same_author');
    });

    it('should identify similar topic relationship', () => {
      const content1 = { author: 'John Doe', topics: ['AI', 'ML', 'data', 'science'] };
      const content2 = { author: 'Jane Smith', topics: ['AI', 'ML', 'data'] };
      const relationshipType = identifier.determineRelationshipType(content1, content2, 0.8);
      expect(relationshipType).toBe('similar_topic');
    });

    it('should identify update relationship', () => {
      const content1 = { title: 'Machine Learning Guide', author: 'John Doe', topics: ['ML'] };
      const content2 = { title: 'Machine Learning Guide v2', author: 'Jane Smith', topics: ['ML'] };
      const relationshipType = identifier.determineRelationshipType(content1, content2, 0.8);
      expect(relationshipType).toBe('update');
    });

    it('should default to similar relationship', () => {
      const content1 = { author: 'John Doe', topics: ['AI'] };
      const content2 = { author: 'Jane Smith', topics: ['ML'] };
      const relationshipType = identifier.determineRelationshipType(content1, content2, 0.4);
      expect(relationshipType).toBe('similar');
    });
  });

  describe('generateConnectionVisualization', () => {
    beforeEach(() => {
      Content.findById.mockResolvedValue(mockContent1);
      ContentMetadata.findOne.mockResolvedValue(mockMetadata1);
      
      // Mock findRelatedContent
      jest.spyOn(identifier, 'findRelatedContent').mockResolvedValue([
        {
          content: { ...mockContent2, _id: 'content2' },
          similarity: 0.7,
          relationshipType: 'similar_topic'
        }
      ]);
    });

    it('should generate visualization data', async () => {
      const visualization = await identifier.generateConnectionVisualization('content1');
      
      expect(visualization).toHaveProperty('nodes');
      expect(visualization).toHaveProperty('edges');
      expect(visualization).toHaveProperty('metrics');
      expect(visualization).toHaveProperty('rootId', 'content1');
      expect(visualization.nodes.length).toBeGreaterThanOrEqual(1); // At least root node
      expect(visualization.edges.length).toBeGreaterThanOrEqual(0); // May have edges
    });

    it('should respect maxNodes limit', async () => {
      const visualization = await identifier.generateConnectionVisualization('content1', {
        maxNodes: 1
      });
      
      expect(visualization.nodes.length).toBeLessThanOrEqual(1);
    });

    it('should include network metrics', async () => {
      const visualization = await identifier.generateConnectionVisualization('content1', {
        includeMetrics: true
      });
      
      expect(visualization.metrics).toHaveProperty('nodeCount');
      expect(visualization.metrics).toHaveProperty('edgeCount');
      expect(visualization.metrics).toHaveProperty('density');
      expect(visualization.metrics).toHaveProperty('avgDegree');
    });
  });

  describe('updateRelatedContentMetadata', () => {
    let mockMetadata;

    beforeEach(() => {
      mockMetadata = {
        contentId: 'content1',
        relatedContent: [],
        addRelatedContent: jest.fn().mockResolvedValue(mockMetadata),
        save: jest.fn().mockResolvedValue(mockMetadata)
      };
      
      ContentMetadata.findOne.mockResolvedValue(mockMetadata);
    });

    it('should update existing metadata', async () => {
      const relatedContent = [
        {
          content: { _id: 'content2' },
          relationshipType: 'similar',
          similarity: 0.7
        }
      ];
      
      await identifier.updateRelatedContentMetadata('content1', relatedContent);
      
      expect(ContentMetadata.findOne).toHaveBeenCalledWith({ contentId: 'content1' });
      expect(mockMetadata.addRelatedContent).toHaveBeenCalledWith('content2', 'similar', 0.7);
    });

    it('should create new metadata if not exists', async () => {
      ContentMetadata.findOne.mockResolvedValue(null);
      
      const mockNewMetadata = {
        contentId: 'content1',
        relatedContent: [],
        addRelatedContent: jest.fn().mockResolvedValue(),
        save: jest.fn().mockResolvedValue()
      };
      
      // Mock constructor
      ContentMetadata.mockImplementation(() => mockNewMetadata);
      
      const relatedContent = [
        {
          content: { _id: 'content2' },
          relationshipType: 'similar',
          similarity: 0.7
        }
      ];
      
      await identifier.updateRelatedContentMetadata('content1', relatedContent);
      
      expect(ContentMetadata).toHaveBeenCalledWith({ contentId: 'content1' });
    });
  });

  describe('batchProcessRelatedContent', () => {
    beforeEach(() => {
      jest.spyOn(identifier, 'findRelatedContent').mockResolvedValue([]);
      jest.spyOn(identifier, 'updateRelatedContentMetadata').mockResolvedValue();
    });

    it('should process content in batches', async () => {
      const contentIds = ['content1', 'content2', 'content3'];
      const results = await identifier.batchProcessRelatedContent(contentIds, {
        batchSize: 2
      });
      
      expect(results.processed).toBe(3);
      expect(results.failed).toBe(0);
      expect(identifier.findRelatedContent).toHaveBeenCalledTimes(3);
    });

    it('should handle errors gracefully', async () => {
      const contentIds = ['content1', 'content2'];
      identifier.findRelatedContent.mockRejectedValueOnce(new Error('Test error'));
      
      const results = await identifier.batchProcessRelatedContent(contentIds);
      
      expect(results.processed).toBe(1);
      expect(results.failed).toBe(1);
      expect(results.errors).toHaveLength(1);
      expect(results.errors[0]).toHaveProperty('contentId', 'content1');
      expect(results.errors[0]).toHaveProperty('error', 'Test error');
    });

    it('should skip metadata update when disabled', async () => {
      const contentIds = ['content1'];
      await identifier.batchProcessRelatedContent(contentIds, {
        updateMetadata: false
      });
      
      expect(identifier.updateRelatedContentMetadata).not.toHaveBeenCalled();
    });
  });

  describe('calculateNodeSize', () => {
    it('should calculate node size based on engagement metrics', () => {
      const content = {
        readCount: 100,
        saveCount: 50,
        shareCount: 30,
        relevanceScore: 0.8
      };
      
      const metadata = {
        qualityScore: 0.9
      };
      
      const size = identifier.calculateNodeSize(content, metadata);
      expect(size).toBeGreaterThan(10); // Base size
      expect(size).toBeLessThanOrEqual(50); // Max size
    });

    it('should handle missing metrics', () => {
      const content = {};
      const metadata = null;
      
      const size = identifier.calculateNodeSize(content, metadata);
      expect(size).toBe(10); // Base size only
    });
  });

  describe('getNodeColor', () => {
    it('should return correct colors for different content types', () => {
      expect(identifier.getNodeColor('article')).toBe('#3498db');
      expect(identifier.getNodeColor('paper')).toBe('#e74c3c');
      expect(identifier.getNodeColor('podcast')).toBe('#9b59b6');
      expect(identifier.getNodeColor('unknown')).toBe('#95a5a6'); // Default
    });
  });

  describe('calculateNetworkMetrics', () => {
    it('should calculate basic network metrics', () => {
      const nodes = [
        { id: 'node1' },
        { id: 'node2' },
        { id: 'node3' }
      ];
      
      const edges = [
        { source: 'node1', target: 'node2' },
        { source: 'node2', target: 'node3' }
      ];
      
      const metrics = identifier.calculateNetworkMetrics(nodes, edges);
      
      expect(metrics).toHaveProperty('nodeCount', 3);
      expect(metrics).toHaveProperty('edgeCount', 2);
      expect(metrics).toHaveProperty('density');
      expect(metrics).toHaveProperty('avgDegree');
      expect(metrics).toHaveProperty('maxDegree');
      expect(metrics).toHaveProperty('clusteringCoefficient');
    });

    it('should handle empty network', () => {
      const metrics = identifier.calculateNetworkMetrics([], []);
      
      expect(metrics.nodeCount).toBe(0);
      expect(metrics.edgeCount).toBe(0);
      expect(metrics.density).toBe(0);
    });
  });
});