const mongoose = require('mongoose');
const Source = require('../models/Source');
const crypto = require('crypto');

// Mock environment variables
process.env.CREDENTIAL_ENCRYPTION_KEY = 'test-encryption-key-32-bytes-length!';

// Connect to test database before tests
beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/test-db', {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
});

// Clear test database after tests
afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
});

// Clear sources collection before each test
beforeEach(async () => {
  await Source.deleteMany({});
});

describe('Source Model', () => {
  describe('Schema', () => {
    it('should create a new source successfully', async () => {
      const sourceData = {
        url: 'https://example.com',
        name: 'Example Source',
        description: 'A test source',
        type: 'website',
        categories: ['AI', 'Technology'],
        tags: ['test', 'example'],
        createdBy: new mongoose.Types.ObjectId()
      };
      
      const source = new Source(sourceData);
      const savedSource = await source.save();
      
      expect(savedSource._id).toBeDefined();
      expect(savedSource.url).toBe(sourceData.url);
      expect(savedSource.name).toBe(sourceData.name);
      expect(savedSource.description).toBe(sourceData.description);
      expect(savedSource.type).toBe(sourceData.type);
      expect(savedSource.categories).toEqual(expect.arrayContaining(sourceData.categories));
      expect(savedSource.tags).toEqual(expect.arrayContaining(sourceData.tags));
      expect(savedSource.relevanceScore).toBe(0.5); // Default value
      expect(savedSource.checkFrequency).toBe('daily'); // Default value
      expect(savedSource.active).toBe(true); // Default value
    });
    
    it('should fail validation when URL is invalid', async () => {
      const sourceData = {
        url: 'invalid-url',
        name: 'Example Source',
        type: 'website',
        createdBy: new mongoose.Types.ObjectId()
      };
      
      const source = new Source(sourceData);
      
      await expect(source.save()).rejects.toThrow();
    });
    
    it('should fail validation when required fields are missing', async () => {
      const sourceData = {
        url: 'https://example.com'
        // Missing name, type, and createdBy
      };
      
      const source = new Source(sourceData);
      
      await expect(source.save()).rejects.toThrow();
    });
    
    it('should fail validation when type is invalid', async () => {
      const sourceData = {
        url: 'https://example.com',
        name: 'Example Source',
        type: 'invalid-type', // Invalid type
        createdBy: new mongoose.Types.ObjectId()
      };
      
      const source = new Source(sourceData);
      
      await expect(source.save()).rejects.toThrow();
    });
  });
  
  describe('Credential Encryption', () => {
    it('should encrypt and decrypt credentials', async () => {
      const sourceData = {
        url: 'https://example.com',
        name: 'Example Source',
        type: 'website',
        requiresAuthentication: true,
        createdBy: new mongoose.Types.ObjectId()
      };
      
      const source = new Source(sourceData);
      await source.save();
      
      const credentials = {
        username: 'testuser',
        password: 'testpassword'
      };
      
      await source.encryptCredentials(credentials);
      
      // Credentials should be encrypted
      expect(source.credentials.encrypted).toBeDefined();
      expect(source.credentials.iv).toBeDefined();
      expect(source.credentials.encrypted).not.toContain('testuser');
      expect(source.credentials.encrypted).not.toContain('testpassword');
      
      // Should be able to decrypt credentials
      const decrypted = source.decryptCredentials();
      expect(decrypted).toEqual(credentials);
    });
    
    it('should return null when decrypting non-existent credentials', async () => {
      const sourceData = {
        url: 'https://example.com',
        name: 'Example Source',
        type: 'website',
        requiresAuthentication: true,
        createdBy: new mongoose.Types.ObjectId()
      };
      
      const source = new Source(sourceData);
      await source.save();
      
      const decrypted = source.decryptCredentials();
      expect(decrypted).toBeNull();
    });
  });
  
  describe('Source Methods', () => {
    it('should update relevance score', async () => {
      const sourceData = {
        url: 'https://example.com',
        name: 'Example Source',
        type: 'website',
        createdBy: new mongoose.Types.ObjectId()
      };
      
      const source = new Source(sourceData);
      await source.save();
      
      const newScore = 0.8;
      await source.updateRelevance(newScore);
      
      expect(source.relevanceScore).toBe(newScore);
    });
    
    it('should record check', async () => {
      const sourceData = {
        url: 'https://example.com',
        name: 'Example Source',
        type: 'website',
        createdBy: new mongoose.Types.ObjectId()
      };
      
      const source = new Source(sourceData);
      await source.save();
      
      expect(source.lastChecked).toBeNull();
      
      await source.recordCheck();
      
      expect(source.lastChecked).toBeInstanceOf(Date);
    });
    
    it('should record update', async () => {
      const sourceData = {
        url: 'https://example.com',
        name: 'Example Source',
        type: 'website',
        createdBy: new mongoose.Types.ObjectId()
      };
      
      const source = new Source(sourceData);
      await source.save();
      
      expect(source.lastUpdated).toBeNull();
      expect(source.contentCount).toBe(0);
      
      await source.recordUpdate();
      
      expect(source.lastUpdated).toBeInstanceOf(Date);
      expect(source.contentCount).toBe(1);
    });
    
    it('should record error', async () => {
      const sourceData = {
        url: 'https://example.com',
        name: 'Example Source',
        type: 'website',
        createdBy: new mongoose.Types.ObjectId()
      };
      
      const source = new Source(sourceData);
      await source.save();
      
      expect(source.errorCount).toBe(0);
      expect(source.lastError.message).toBeNull();
      
      const errorMessage = 'Test error message';
      await source.recordError(errorMessage);
      
      expect(source.errorCount).toBe(1);
      expect(source.lastError.message).toBe(errorMessage);
      expect(source.lastError.date).toBeInstanceOf(Date);
    });
    
    it('should reset errors', async () => {
      const sourceData = {
        url: 'https://example.com',
        name: 'Example Source',
        type: 'website',
        createdBy: new mongoose.Types.ObjectId()
      };
      
      const source = new Source(sourceData);
      await source.save();
      
      await source.recordError('Test error');
      expect(source.errorCount).toBe(1);
      
      await source.resetErrors();
      
      expect(source.errorCount).toBe(0);
      expect(source.lastError.message).toBeNull();
      expect(source.lastError.date).toBeNull();
    });
    
    it('should update metadata', async () => {
      const sourceData = {
        url: 'https://example.com',
        name: 'Example Source',
        type: 'website',
        createdBy: new mongoose.Types.ObjectId()
      };
      
      const source = new Source(sourceData);
      await source.save();
      
      const metadata = {
        favicon: 'https://example.com/favicon.ico',
        language: 'en',
        author: 'Test Author'
      };
      
      await source.updateMetadata(metadata);
      
      expect(source.metadata.get('favicon')).toBe(metadata.favicon);
      expect(source.metadata.get('language')).toBe(metadata.language);
      expect(source.metadata.get('author')).toBe(metadata.author);
    });
  });
  
  describe('Static Methods', () => {
    it('should find sources by type', async () => {
      const userId = new mongoose.Types.ObjectId();
      
      // Create test sources
      await Promise.all([
        new Source({
          url: 'https://example1.com',
          name: 'Example 1',
          type: 'website',
          createdBy: userId
        }).save(),
        new Source({
          url: 'https://example2.com',
          name: 'Example 2',
          type: 'blog',
          createdBy: userId
        }).save(),
        new Source({
          url: 'https://example3.com',
          name: 'Example 3',
          type: 'website',
          createdBy: userId
        }).save()
      ]);
      
      const websites = await Source.findByType('website');
      expect(websites).toHaveLength(2);
      expect(websites[0].type).toBe('website');
      expect(websites[1].type).toBe('website');
      
      const blogs = await Source.findByType('blog');
      expect(blogs).toHaveLength(1);
      expect(blogs[0].type).toBe('blog');
    });
    
    it('should find active sources by user', async () => {
      const userId1 = new mongoose.Types.ObjectId();
      const userId2 = new mongoose.Types.ObjectId();
      
      // Create test sources
      await Promise.all([
        new Source({
          url: 'https://example1.com',
          name: 'Example 1',
          type: 'website',
          createdBy: userId1
        }).save(),
        new Source({
          url: 'https://example2.com',
          name: 'Example 2',
          type: 'blog',
          createdBy: userId2
        }).save(),
        new Source({
          url: 'https://example3.com',
          name: 'Example 3',
          type: 'website',
          createdBy: userId1,
          active: false
        }).save()
      ]);
      
      const user1Sources = await Source.findActiveByUser(userId1);
      expect(user1Sources).toHaveLength(1);
      expect(user1Sources[0].createdBy.toString()).toBe(userId1.toString());
      expect(user1Sources[0].active).toBe(true);
      
      const user2Sources = await Source.findActiveByUser(userId2);
      expect(user2Sources).toHaveLength(1);
      expect(user2Sources[0].createdBy.toString()).toBe(userId2.toString());
    });
    
    it('should find sources by category', async () => {
      const userId = new mongoose.Types.ObjectId();
      
      // Create test sources
      await Promise.all([
        new Source({
          url: 'https://example1.com',
          name: 'Example 1',
          type: 'website',
          categories: ['AI', 'Technology'],
          createdBy: userId
        }).save(),
        new Source({
          url: 'https://example2.com',
          name: 'Example 2',
          type: 'blog',
          categories: ['Technology', 'Programming'],
          createdBy: userId
        }).save(),
        new Source({
          url: 'https://example3.com',
          name: 'Example 3',
          type: 'website',
          categories: ['AI', 'Machine Learning'],
          createdBy: userId
        }).save()
      ]);
      
      const aiSources = await Source.findByCategory('AI');
      expect(aiSources).toHaveLength(2);
      
      const programmingSources = await Source.findByCategory('Programming');
      expect(programmingSources).toHaveLength(1);
      
      const mlSources = await Source.findByCategory('Machine Learning');
      expect(mlSources).toHaveLength(1);
    });
    
    it('should find sources by tag', async () => {
      const userId = new mongoose.Types.ObjectId();
      
      // Create test sources
      await Promise.all([
        new Source({
          url: 'https://example1.com',
          name: 'Example 1',
          type: 'website',
          tags: ['important', 'featured'],
          createdBy: userId
        }).save(),
        new Source({
          url: 'https://example2.com',
          name: 'Example 2',
          type: 'blog',
          tags: ['featured', 'tutorial'],
          createdBy: userId
        }).save(),
        new Source({
          url: 'https://example3.com',
          name: 'Example 3',
          type: 'website',
          tags: ['important', 'news'],
          createdBy: userId
        }).save()
      ]);
      
      const importantSources = await Source.findByTag('important');
      expect(importantSources).toHaveLength(2);
      
      const featuredSources = await Source.findByTag('featured');
      expect(featuredSources).toHaveLength(2);
      
      const tutorialSources = await Source.findByTag('tutorial');
      expect(tutorialSources).toHaveLength(1);
    });
    
    it('should find sources for checking', async () => {
      const userId = new mongoose.Types.ObjectId();
      const now = new Date();
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      
      // Create test sources
      await Promise.all([
        new Source({
          url: 'https://example1.com',
          name: 'Example 1',
          type: 'website',
          checkFrequency: 'daily',
          lastChecked: twoDaysAgo,
          createdBy: userId
        }).save(),
        new Source({
          url: 'https://example2.com',
          name: 'Example 2',
          type: 'blog',
          checkFrequency: 'daily',
          lastChecked: now,
          createdBy: userId
        }).save(),
        new Source({
          url: 'https://example3.com',
          name: 'Example 3',
          type: 'website',
          checkFrequency: 'hourly',
          lastChecked: oneHourAgo,
          createdBy: userId
        }).save(),
        new Source({
          url: 'https://example4.com',
          name: 'Example 4',
          type: 'podcast',
          checkFrequency: 'hourly',
          lastChecked: null,
          createdBy: userId
        }).save()
      ]);
      
      const dailySources = await Source.findSourcesForChecking('daily');
      expect(dailySources).toHaveLength(1);
      expect(dailySources[0].url).toBe('https://example1.com');
      
      const hourlySources = await Source.findSourcesForChecking('hourly');
      expect(hourlySources).toHaveLength(2);
      expect(hourlySources.map(s => s.url)).toContain('https://example3.com');
      expect(hourlySources.map(s => s.url)).toContain('https://example4.com');
    });
    
    it('should find sources with errors', async () => {
      const userId = new mongoose.Types.ObjectId();
      
      // Create test sources
      const sources = await Promise.all([
        new Source({
          url: 'https://example1.com',
          name: 'Example 1',
          type: 'website',
          createdBy: userId
        }).save(),
        new Source({
          url: 'https://example2.com',
          name: 'Example 2',
          type: 'blog',
          createdBy: userId
        }).save(),
        new Source({
          url: 'https://example3.com',
          name: 'Example 3',
          type: 'website',
          createdBy: userId
        }).save()
      ]);
      
      // Record errors
      await sources[0].recordError('Error 1');
      await sources[1].recordError('Error 1');
      await sources[1].recordError('Error 2');
      
      const sourcesWithErrors = await Source.findSourcesWithErrors();
      expect(sourcesWithErrors).toHaveLength(2);
      
      const sourcesWithMultipleErrors = await Source.findSourcesWithErrors(2);
      expect(sourcesWithMultipleErrors).toHaveLength(1);
      expect(sourcesWithMultipleErrors[0].url).toBe('https://example2.com');
    });
    
    it('should find most relevant sources', async () => {
      const userId = new mongoose.Types.ObjectId();
      
      // Create test sources
      await Promise.all([
        new Source({
          url: 'https://example1.com',
          name: 'Example 1',
          type: 'website',
          relevanceScore: 0.3,
          createdBy: userId
        }).save(),
        new Source({
          url: 'https://example2.com',
          name: 'Example 2',
          type: 'blog',
          relevanceScore: 0.9,
          createdBy: userId
        }).save(),
        new Source({
          url: 'https://example3.com',
          name: 'Example 3',
          type: 'website',
          relevanceScore: 0.7,
          createdBy: userId
        }).save(),
        new Source({
          url: 'https://example4.com',
          name: 'Example 4',
          type: 'podcast',
          relevanceScore: 0.5,
          createdBy: userId
        }).save()
      ]);
      
      const relevantSources = await Source.findMostRelevant(2);
      expect(relevantSources).toHaveLength(2);
      expect(relevantSources[0].url).toBe('https://example2.com');
      expect(relevantSources[1].url).toBe('https://example3.com');
    });
  });
});