/**
 * Source Locator Tests
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const sourceLocator = require('../utils/sourceLocator');
const Reference = require('../../content-discovery/models/Reference');
const Content = require('../../content-discovery/models/Content');

// Mock dependencies
jest.mock('axios', () => ({
  head: jest.fn(),
  get: jest.fn()
}));
const axios = require('axios');

jest.mock('../../content-discovery/utils/discoveryQueue', () => ({
  addToQueue: jest.fn().mockResolvedValue(true)
}));
const discoveryQueue = require('../../content-discovery/utils/discoveryQueue');

describe('Source Locator', () => {
  let mongoServer;
  
  beforeAll(async () => {
    // Set up in-memory MongoDB server
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
  });
  
  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });
  
  beforeEach(async () => {
    // Clear all mocks and database collections before each test
    jest.clearAllMocks();
    await Reference.deleteMany({});
    await Content.deleteMany({});
  });
  
  describe('locateSource', () => {
    it('should find existing content by URL', async () => {
      // Create existing content
      const existingContent = new Content({
        url: 'https://example.com/article',
        title: 'Test Article',
        author: 'John Doe',
        type: 'article'
      });
      await existingContent.save();
      
      // Create reference with matching URL
      const reference = {
        _id: new mongoose.Types.ObjectId(),
        url: 'https://example.com/article',
        title: 'Referenced Article',
        authors: ['John Doe']
      };
      
      // Test source location
      const result = await sourceLocator.locateSource(reference);
      
      // Verify result
      expect(result.found).toBe(true);
      expect(result.sourceType).toBe('existing');
      expect(result.source._id.toString()).toBe(existingContent._id.toString());
    });
    
    it('should find existing content by title and author', async () => {
      // Create existing content
      const existingContent = new Content({
        title: 'Machine Learning Fundamentals',
        author: 'Jane Smith',
        type: 'article'
      });
      await existingContent.save();
      
      // Create reference with matching title and author
      const reference = {
        _id: new mongoose.Types.ObjectId(),
        title: 'Machine Learning Fundamentals',
        authors: ['Jane Smith']
      };
      
      // Test source location
      const result = await sourceLocator.locateSource(reference);
      
      // Verify result
      expect(result.found).toBe(true);
      expect(result.sourceType).toBe('existing');
      expect(result.source._id.toString()).toBe(existingContent._id.toString());
    });
    
    it('should create new source from URL when URL is accessible', async () => {
      // Mock axios to simulate accessible URL
      axios.head.mockResolvedValueOnce({ status: 200 });
      
      // Create reference with URL
      const reference = {
        _id: new mongoose.Types.ObjectId(),
        url: 'https://example.com/new-article',
        title: 'New Article',
        authors: ['Alice Johnson'],
        sourceContentId: new mongoose.Types.ObjectId()
      };
      
      // Test source location
      const result = await sourceLocator.locateSource(reference);
      
      // Verify result
      expect(result.found).toBe(true);
      expect(result.sourceType).toBe('new');
      expect(result.source.url).toBe('https://example.com/new-article');
      expect(result.source.name).toBe('New Article');
      expect(axios.head).toHaveBeenCalledWith('https://example.com/new-article', expect.any(Object));
    });
    
    it('should extract and use DOI when available', async () => {
      // Mock axios for DOI resolution
      axios.get.mockResolvedValueOnce({
        status: 200,
        data: {
          title: 'Research Paper Title',
          author: [{ family: 'Smith', given: 'John' }],
          published: { 'date-parts': [[2023, 5, 15]] }
        }
      });
      
      // Create reference with DOI in URL
      const reference = {
        _id: new mongoose.Types.ObjectId(),
        url: 'https://doi.org/10.1234/example',
        title: 'Research Paper',
        authors: ['John Smith'],
        sourceContentId: new mongoose.Types.ObjectId()
      };
      
      // Test source location
      const result = await sourceLocator.locateSource(reference);
      
      // Verify result
      expect(result.found).toBe(true);
      expect(result.sourceType).toBe('new');
      expect(result.source.url).toBe('https://doi.org/10.1234/example');
      expect(result.source.name).toBe('Research Paper Title');
      expect(result.source.type).toBe('academic');
      expect(axios.get).toHaveBeenCalledWith('https://doi.org/10.1234/example', expect.any(Object));
    });
    
    it('should queue reference for manual resolution when source not found', async () => {
      // Mock all search strategies to fail
      axios.head.mockRejectedValue(new Error('Connection failed'));
      axios.get.mockRejectedValue(new Error('Connection failed'));
      
      // Create reference
      const reference = new Reference({
        sourceContentId: new mongoose.Types.ObjectId(),
        title: 'Unknown Article',
        authors: ['Unknown Author'],
        referenceType: 'mention'
      });
      await reference.save();
      
      // Test source location
      const result = await sourceLocator.locateSource(reference);
      
      // Verify result
      expect(result.found).toBe(false);
      expect(result.message).toContain('queued for manual resolution');
      
      // Verify reference was updated
      const updatedReference = await Reference.findById(reference._id);
      expect(updatedReference.needsManualResolution).toBe(true);
      expect(updatedReference.resolutionAttempts).toBe(1);
      
      // Verify it was added to discovery queue
      expect(discoveryQueue.addToQueue).toHaveBeenCalledWith(expect.objectContaining({
        type: 'manual_reference_resolution',
        referenceId: reference._id,
        priority: 'high'
      }));
    });
  });
  
  describe('validateSource', () => {
    it('should validate accessible source with required metadata', async () => {
      // Mock axios to simulate accessible URL
      axios.head.mockResolvedValueOnce({ status: 200 });
      
      // Create source to validate
      const source = {
        url: 'https://example.com/valid-article',
        title: 'Valid Article'
      };
      
      // Test source validation
      const result = await sourceLocator.validateSource(source);
      
      // Verify result
      expect(result).toBe(true);
      expect(axios.head).toHaveBeenCalledWith('https://example.com/valid-article', expect.any(Object));
    });
    
    it('should reject source with inaccessible URL', async () => {
      // Mock axios to simulate inaccessible URL
      axios.head.mockRejectedValueOnce(new Error('Connection failed'));
      
      // Create source to validate
      const source = {
        url: 'https://example.com/invalid-article',
        title: 'Invalid Article'
      };
      
      // Test source validation
      const result = await sourceLocator.validateSource(source);
      
      // Verify result
      expect(result).toBe(false);
      expect(axios.head).toHaveBeenCalledWith('https://example.com/invalid-article', expect.any(Object));
    });
    
    it('should reject source without title', async () => {
      // Create source to validate without title
      const source = {
        url: 'https://example.com/no-title'
      };
      
      // Test source validation
      const result = await sourceLocator.validateSource(source);
      
      // Verify result
      expect(result).toBe(false);
    });
  });
  
  describe('_determineSourceType', () => {
    it('should identify academic sources', () => {
      const academicSources = [
        { url: 'https://arxiv.org/abs/1234.5678' },
        { url: 'https://doi.org/10.1234/example' },
        { url: 'https://academia.edu/paper/123' },
        { url: 'https://researchgate.net/publication/123' }
      ];
      
      academicSources.forEach(source => {
        expect(sourceLocator._determineSourceType(source)).toBe('academic');
      });
    });
    
    it('should identify video sources', () => {
      const videoSources = [
        { url: 'https://youtube.com/watch?v=123' },
        { url: 'https://vimeo.com/123456' }
      ];
      
      videoSources.forEach(source => {
        expect(sourceLocator._determineSourceType(source)).toBe('video');
      });
    });
    
    it('should identify social media sources', () => {
      const socialSources = [
        { url: 'https://twitter.com/user/status/123' },
        { url: 'https://facebook.com/post/123' },
        { url: 'https://linkedin.com/posts/123' }
      ];
      
      socialSources.forEach(source => {
        expect(sourceLocator._determineSourceType(source)).toBe('social');
      });
    });
    
    it('should identify blog sources', () => {
      const blogSources = [
        { url: 'https://medium.com/post/123' },
        { url: 'https://blog.example.com/post' },
        { url: 'https://example.blog/post' }
      ];
      
      blogSources.forEach(source => {
        expect(sourceLocator._determineSourceType(source)).toBe('blog');
      });
    });
    
    it('should default to website for other sources', () => {
      const otherSources = [
        { url: 'https://example.com/page' },
        { url: 'https://news.example.com/article' }
      ];
      
      otherSources.forEach(source => {
        expect(sourceLocator._determineSourceType(source)).toBe('website');
      });
    });
  });
  
  describe('_extractDOI', () => {
    it('should extract DOI from direct property', () => {
      const reference = {
        doi: '10.1234/example'
      };
      
      expect(sourceLocator._extractDOI(reference)).toBe('10.1234/example');
    });
    
    it('should extract DOI from URL', () => {
      const reference = {
        url: 'https://doi.org/10.1234/example'
      };
      
      expect(sourceLocator._extractDOI(reference)).toBe('10.1234/example');
    });
    
    it('should extract DOI from context', () => {
      const reference = {
        context: 'As mentioned in the paper (doi: 10.1234/example), the results show...'
      };
      
      expect(sourceLocator._extractDOI(reference)).toBe('10.1234/example');
    });
    
    it('should return null when no DOI is found', () => {
      const reference = {
        title: 'Paper without DOI',
        url: 'https://example.com/paper'
      };
      
      expect(sourceLocator._extractDOI(reference)).toBeNull();
    });
  });
});