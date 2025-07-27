const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Podcast = require('../models/Podcast');

describe('Podcast Model', () => {
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
  
  // Clear podcasts collection before each test
  beforeEach(async () => {
    await Podcast.deleteMany({});
  });
  
  describe('Schema', () => {
    it('should create a new podcast successfully', async () => {
      const podcastData = {
        sourceId: new mongoose.Types.ObjectId(),
        title: 'Test Podcast',
        description: 'Test Description',
        feedUrl: 'https://example.com/feed.xml',
        websiteUrl: 'https://example.com',
        categories: ['Technology', 'Science'],
        language: 'en',
        checkFrequency: 'daily'
      };
      
      const podcast = new Podcast(podcastData);
      const savedPodcast = await podcast.save();
      
      expect(savedPodcast._id).toBeDefined();
      expect(savedPodcast.title).toBe(podcastData.title);
      expect(savedPodcast.description).toBe(podcastData.description);
      expect(savedPodcast.feedUrl).toBe(podcastData.feedUrl);
      expect(savedPodcast.websiteUrl).toBe(podcastData.websiteUrl);
      expect(savedPodcast.categories).toEqual(expect.arrayContaining(podcastData.categories));
      expect(savedPodcast.language).toBe(podcastData.language);
      expect(savedPodcast.checkFrequency).toBe(podcastData.checkFrequency);
      expect(savedPodcast.active).toBe(true); // Default value
      expect(savedPodcast.episodeCount).toBe(0); // Default value
    });
    
    it('should fail validation when required fields are missing', async () => {
      const podcast = new Podcast({
        // Missing sourceId and title
        feedUrl: 'https://example.com/feed.xml'
      });
      
      await expect(podcast.save()).rejects.toThrow();
    });
    
    it('should fail validation when feedUrl is invalid', async () => {
      const podcast = new Podcast({
        sourceId: new mongoose.Types.ObjectId(),
        title: 'Test Podcast',
        feedUrl: 'invalid-url'
      });
      
      await expect(podcast.save()).rejects.toThrow();
    });
    
    it('should fail validation when checkFrequency is invalid', async () => {
      const podcast = new Podcast({
        sourceId: new mongoose.Types.ObjectId(),
        title: 'Test Podcast',
        feedUrl: 'https://example.com/feed.xml',
        checkFrequency: 'invalid-frequency'
      });
      
      await expect(podcast.save()).rejects.toThrow();
    });
  });
  
  describe('Methods', () => {
    it('should record check', async () => {
      const podcast = new Podcast({
        sourceId: new mongoose.Types.ObjectId(),
        title: 'Test Podcast',
        feedUrl: 'https://example.com/feed.xml'
      });
      
      await podcast.save();
      
      expect(podcast.lastChecked).toBeNull();
      
      await podcast.recordCheck();
      
      expect(podcast.lastChecked).toBeInstanceOf(Date);
    });
    
    it('should record update', async () => {
      const podcast = new Podcast({
        sourceId: new mongoose.Types.ObjectId(),
        title: 'Test Podcast',
        feedUrl: 'https://example.com/feed.xml'
      });
      
      await podcast.save();
      
      expect(podcast.lastUpdated).toBeNull();
      expect(podcast.episodeCount).toBe(0);
      
      await podcast.recordUpdate();
      
      expect(podcast.lastUpdated).toBeInstanceOf(Date);
      expect(podcast.episodeCount).toBe(1);
    });
    
    it('should record error', async () => {
      const podcast = new Podcast({
        sourceId: new mongoose.Types.ObjectId(),
        title: 'Test Podcast',
        feedUrl: 'https://example.com/feed.xml'
      });
      
      await podcast.save();
      
      expect(podcast.errorCount).toBe(0);
      expect(podcast.lastError.message).toBeNull();
      
      const errorMessage = 'Test error';
      await podcast.recordError(errorMessage);
      
      expect(podcast.errorCount).toBe(1);
      expect(podcast.lastError.message).toBe(errorMessage);
      expect(podcast.lastError.date).toBeInstanceOf(Date);
    });
    
    it('should reset errors', async () => {
      const podcast = new Podcast({
        sourceId: new mongoose.Types.ObjectId(),
        title: 'Test Podcast',
        feedUrl: 'https://example.com/feed.xml',
        errorCount: 5,
        lastError: {
          message: 'Test error',
          date: new Date()
        }
      });
      
      await podcast.save();
      
      expect(podcast.errorCount).toBe(5);
      expect(podcast.lastError.message).toBe('Test error');
      
      await podcast.resetErrors();
      
      expect(podcast.errorCount).toBe(0);
      expect(podcast.lastError.message).toBeNull();
      expect(podcast.lastError.date).toBeNull();
    });
    
    it('should update metadata', async () => {
      const podcast = new Podcast({
        sourceId: new mongoose.Types.ObjectId(),
        title: 'Test Podcast',
        feedUrl: 'https://example.com/feed.xml'
      });
      
      await podcast.save();
      
      const metadata = {
        author: 'Test Author',
        website: 'https://example.com',
        copyright: '2023 Test'
      };
      
      await podcast.updateMetadata(metadata);
      
      expect(podcast.metadata.get('author')).toBe(metadata.author);
      expect(podcast.metadata.get('website')).toBe(metadata.website);
      expect(podcast.metadata.get('copyright')).toBe(metadata.copyright);
    });
  });
  
  describe('Static Methods', () => {
    it('should find podcasts for checking', async () => {
      // Create test podcasts
      const now = new Date();
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      
      await Promise.all([
        // Should be found (daily, checked 2 days ago)
        new Podcast({
          sourceId: new mongoose.Types.ObjectId(),
          title: 'Podcast 1',
          feedUrl: 'https://example.com/feed1.xml',
          active: true,
          checkFrequency: 'daily',
          lastChecked: twoDaysAgo
        }).save(),
        
        // Should not be found (daily, checked recently)
        new Podcast({
          sourceId: new mongoose.Types.ObjectId(),
          title: 'Podcast 2',
          feedUrl: 'https://example.com/feed2.xml',
          active: true,
          checkFrequency: 'daily',
          lastChecked: now
        }).save(),
        
        // Should be found (daily, never checked)
        new Podcast({
          sourceId: new mongoose.Types.ObjectId(),
          title: 'Podcast 3',
          feedUrl: 'https://example.com/feed3.xml',
          active: true,
          checkFrequency: 'daily',
          lastChecked: null
        }).save(),
        
        // Should not be found (inactive)
        new Podcast({
          sourceId: new mongoose.Types.ObjectId(),
          title: 'Podcast 4',
          feedUrl: 'https://example.com/feed4.xml',
          active: false,
          checkFrequency: 'daily',
          lastChecked: twoDaysAgo
        }).save(),
        
        // Should not be found (weekly, checked 2 days ago)
        new Podcast({
          sourceId: new mongoose.Types.ObjectId(),
          title: 'Podcast 5',
          feedUrl: 'https://example.com/feed5.xml',
          active: true,
          checkFrequency: 'weekly',
          lastChecked: twoDaysAgo
        }).save()
      ]);
      
      // Find podcasts for daily checking
      const dailyPodcasts = await Podcast.findPodcastsForChecking('daily');
      
      expect(dailyPodcasts).toHaveLength(2);
      expect(dailyPodcasts[0].title).toBe('Podcast 1');
      expect(dailyPodcasts[1].title).toBe('Podcast 3');
    });
    
    it('should find podcasts with errors', async () => {
      // Create test podcasts
      await Promise.all([
        // Should be found (2 errors)
        new Podcast({
          sourceId: new mongoose.Types.ObjectId(),
          title: 'Podcast 1',
          feedUrl: 'https://example.com/feed1.xml',
          active: true,
          errorCount: 2,
          lastError: {
            message: 'Test error',
            date: new Date()
          }
        }).save(),
        
        // Should be found (5 errors)
        new Podcast({
          sourceId: new mongoose.Types.ObjectId(),
          title: 'Podcast 2',
          feedUrl: 'https://example.com/feed2.xml',
          active: true,
          errorCount: 5,
          lastError: {
            message: 'Test error',
            date: new Date()
          }
        }).save(),
        
        // Should not be found (0 errors)
        new Podcast({
          sourceId: new mongoose.Types.ObjectId(),
          title: 'Podcast 3',
          feedUrl: 'https://example.com/feed3.xml',
          active: true,
          errorCount: 0
        }).save(),
        
        // Should not be found (inactive)
        new Podcast({
          sourceId: new mongoose.Types.ObjectId(),
          title: 'Podcast 4',
          feedUrl: 'https://example.com/feed4.xml',
          active: false,
          errorCount: 3
        }).save()
      ]);
      
      // Find podcasts with errors
      const podcastsWithErrors = await Podcast.findPodcastsWithErrors();
      
      expect(podcastsWithErrors).toHaveLength(2);
      expect(podcastsWithErrors[0].title).toBe('Podcast 1');
      expect(podcastsWithErrors[1].title).toBe('Podcast 2');
      
      // Find podcasts with at least 3 errors
      const podcastsWithManyErrors = await Podcast.findPodcastsWithErrors(3);
      
      expect(podcastsWithManyErrors).toHaveLength(1);
      expect(podcastsWithManyErrors[0].title).toBe('Podcast 2');
    });
    
    it('should find podcasts by category', async () => {
      // Create test podcasts
      await Promise.all([
        // Should be found (has Technology category)
        new Podcast({
          sourceId: new mongoose.Types.ObjectId(),
          title: 'Podcast 1',
          feedUrl: 'https://example.com/feed1.xml',
          active: true,
          categories: ['Technology', 'Science']
        }).save(),
        
        // Should be found (has Technology category)
        new Podcast({
          sourceId: new mongoose.Types.ObjectId(),
          title: 'Podcast 2',
          feedUrl: 'https://example.com/feed2.xml',
          active: true,
          categories: ['Technology', 'Business']
        }).save(),
        
        // Should not be found (no Technology category)
        new Podcast({
          sourceId: new mongoose.Types.ObjectId(),
          title: 'Podcast 3',
          feedUrl: 'https://example.com/feed3.xml',
          active: true,
          categories: ['Business', 'Finance']
        }).save(),
        
        // Should not be found (inactive)
        new Podcast({
          sourceId: new mongoose.Types.ObjectId(),
          title: 'Podcast 4',
          feedUrl: 'https://example.com/feed4.xml',
          active: false,
          categories: ['Technology']
        }).save()
      ]);
      
      // Find podcasts by category
      const technologyPodcasts = await Podcast.findByCategory('Technology');
      
      expect(technologyPodcasts).toHaveLength(2);
      expect(technologyPodcasts[0].title).toBe('Podcast 1');
      expect(technologyPodcasts[1].title).toBe('Podcast 2');
      
      const businessPodcasts = await Podcast.findByCategory('Business');
      
      expect(businessPodcasts).toHaveLength(2);
      expect(businessPodcasts[0].title).toBe('Podcast 2');
      expect(businessPodcasts[1].title).toBe('Podcast 3');
      
      const financePodcasts = await Podcast.findByCategory('Finance');
      
      expect(financePodcasts).toHaveLength(1);
      expect(financePodcasts[0].title).toBe('Podcast 3');
    });
  });
});