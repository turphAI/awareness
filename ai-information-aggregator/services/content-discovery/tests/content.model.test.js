const mongoose = require('mongoose');
const Content = require('../models/Content');

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

// Clear content collection before each test
beforeEach(async () => {
  await Content.deleteMany({});
});

describe('Content Model', () => {
  describe('Schema', () => {
    it('should create a new content item successfully', async () => {
      const contentData = {
        sourceId: new mongoose.Types.ObjectId(),
        url: 'https://example.com/article',
        title: 'Test Article',
        author: 'Test Author',
        publishDate: new Date(),
        type: 'article',
        categories: ['AI', 'Technology'],
        topics: ['Machine Learning', 'Neural Networks']
      };
      
      const content = new Content(contentData);
      const savedContent = await content.save();
      
      expect(savedContent._id).toBeDefined();
      expect(savedContent.url).toBe(contentData.url);
      expect(savedContent.title).toBe(contentData.title);
      expect(savedContent.author).toBe(contentData.author);
      expect(savedContent.type).toBe(contentData.type);
      expect(savedContent.categories).toEqual(expect.arrayContaining(contentData.categories));
      expect(savedContent.topics).toEqual(expect.arrayContaining(contentData.topics));
      expect(savedContent.relevanceScore).toBe(0.5); // Default value
      expect(savedContent.processed).toBe(false); // Default value
      expect(savedContent.outdated).toBe(false); // Default value
    });
    
    it('should fail validation when URL is invalid', async () => {
      const contentData = {
        sourceId: new mongoose.Types.ObjectId(),
        url: 'invalid-url',
        title: 'Test Article',
        type: 'article'
      };
      
      const content = new Content(contentData);
      
      await expect(content.save()).rejects.toThrow();
    });
    
    it('should fail validation when required fields are missing', async () => {
      const contentData = {
        url: 'https://example.com/article'
        // Missing sourceId, title, and type
      };
      
      const content = new Content(contentData);
      
      await expect(content.save()).rejects.toThrow();
    });
    
    it('should fail validation when type is invalid', async () => {
      const contentData = {
        sourceId: new mongoose.Types.ObjectId(),
        url: 'https://example.com/article',
        title: 'Test Article',
        type: 'invalid-type' // Invalid type
      };
      
      const content = new Content(contentData);
      
      await expect(content.save()).rejects.toThrow();
    });
  });
  
  describe('Content Methods', () => {
    it('should calculate reading time based on word count', async () => {
      const contentData = {
        sourceId: new mongoose.Types.ObjectId(),
        url: 'https://example.com/article',
        title: 'Test Article',
        type: 'article',
        wordCount: 1000
      };
      
      const content = new Content(contentData);
      await content.save();
      
      const readingTime = content.calculateReadingTime();
      
      expect(readingTime).toBe(5); // 1000 words / 225 words per minute = ~4.44, rounded up to 5
      expect(content.readingTime).toBe(5);
    });
    
    it('should mark content as processed', async () => {
      const contentData = {
        sourceId: new mongoose.Types.ObjectId(),
        url: 'https://example.com/article',
        title: 'Test Article',
        type: 'article'
      };
      
      const content = new Content(contentData);
      await content.save();
      
      expect(content.processed).toBe(false);
      
      const processingDetails = {
        stage: 'summarization',
        duration: 1500,
        success: true,
        metadata: { model: 'gpt-4' }
      };
      
      await content.markAsProcessed(processingDetails);
      
      expect(content.processed).toBe(true);
      expect(content.processingHistory).toHaveLength(1);
      expect(content.processingHistory[0].stage).toBe('summarization');
      expect(content.processingHistory[0].duration).toBe(1500);
      expect(content.processingHistory[0].success).toBe(true);
    });
    
    it('should mark content as outdated', async () => {
      const contentData = {
        sourceId: new mongoose.Types.ObjectId(),
        url: 'https://example.com/article',
        title: 'Test Article',
        type: 'article'
      };
      
      const content = new Content(contentData);
      await content.save();
      
      expect(content.outdated).toBe(false);
      
      await content.markAsOutdated();
      
      expect(content.outdated).toBe(true);
    });
    
    it('should update relevance score', async () => {
      const contentData = {
        sourceId: new mongoose.Types.ObjectId(),
        url: 'https://example.com/article',
        title: 'Test Article',
        type: 'article'
      };
      
      const content = new Content(contentData);
      await content.save();
      
      const newScore = 0.8;
      await content.updateRelevance(newScore);
      
      expect(content.relevanceScore).toBe(newScore);
    });
    
    it('should add user interaction and update counts', async () => {
      const contentData = {
        sourceId: new mongoose.Types.ObjectId(),
        url: 'https://example.com/article',
        title: 'Test Article',
        type: 'article'
      };
      
      const content = new Content(contentData);
      await content.save();
      
      const userId = new mongoose.Types.ObjectId();
      const metadata = { device: 'mobile', duration: '120s' };
      
      await content.addUserInteraction(userId, 'view', metadata);
      
      expect(content.userInteractions).toHaveLength(1);
      expect(content.userInteractions[0].userId.toString()).toBe(userId.toString());
      expect(content.userInteractions[0].interactionType).toBe('view');
      expect(content.userInteractions[0].metadata.get('device')).toBe('mobile');
      expect(content.readCount).toBe(1);
      
      await content.addUserInteraction(userId, 'save');
      expect(content.userInteractions).toHaveLength(2);
      expect(content.saveCount).toBe(1);
      
      await content.addUserInteraction(userId, 'share');
      expect(content.userInteractions).toHaveLength(3);
      expect(content.shareCount).toBe(1);
    });
    
    it('should update quality assessment', async () => {
      const contentData = {
        sourceId: new mongoose.Types.ObjectId(),
        url: 'https://example.com/article',
        title: 'Test Article',
        type: 'article'
      };
      
      const content = new Content(contentData);
      await content.save();
      
      const qualityFactors = {
        credibility: 0.9,
        readability: 0.8,
        originality: 0.7,
        depth: 0.6
      };
      
      await content.updateQualityAssessment(qualityFactors);
      
      expect(content.qualityFactors.credibility).toBe(0.9);
      expect(content.qualityFactors.readability).toBe(0.8);
      expect(content.qualityFactors.originality).toBe(0.7);
      expect(content.qualityFactors.depth).toBe(0.6);
      
      // Average of all factors: (0.9 + 0.8 + 0.7 + 0.6) / 4 = 0.75
      expect(content.qualityScore).toBeCloseTo(0.75, 2);
    });
  });
  
  describe('Static Methods', () => {
    it('should find content by source', async () => {
      const sourceId1 = new mongoose.Types.ObjectId();
      const sourceId2 = new mongoose.Types.ObjectId();
      
      // Create test content
      await Promise.all([
        new Content({
          sourceId: sourceId1,
          url: 'https://example.com/article1',
          title: 'Article 1',
          type: 'article',
          processed: true
        }).save(),
        new Content({
          sourceId: sourceId2,
          url: 'https://example.com/article2',
          title: 'Article 2',
          type: 'article',
          processed: true
        }).save(),
        new Content({
          sourceId: sourceId1,
          url: 'https://example.com/article3',
          title: 'Article 3',
          type: 'article',
          processed: true
        }).save()
      ]);
      
      const source1Content = await Content.findBySource(sourceId1);
      expect(source1Content).toHaveLength(2);
      expect(source1Content[0].sourceId.toString()).toBe(sourceId1.toString());
      expect(source1Content[1].sourceId.toString()).toBe(sourceId1.toString());
      
      const source2Content = await Content.findBySource(sourceId2);
      expect(source2Content).toHaveLength(1);
      expect(source2Content[0].sourceId.toString()).toBe(sourceId2.toString());
    });
    
    it('should find content by type', async () => {
      // Create test content
      await Promise.all([
        new Content({
          sourceId: new mongoose.Types.ObjectId(),
          url: 'https://example.com/article1',
          title: 'Article 1',
          type: 'article',
          processed: true
        }).save(),
        new Content({
          sourceId: new mongoose.Types.ObjectId(),
          url: 'https://example.com/paper1',
          title: 'Paper 1',
          type: 'paper',
          processed: true
        }).save(),
        new Content({
          sourceId: new mongoose.Types.ObjectId(),
          url: 'https://example.com/article2',
          title: 'Article 2',
          type: 'article',
          processed: true
        }).save()
      ]);
      
      const articles = await Content.findByType('article');
      expect(articles).toHaveLength(2);
      expect(articles[0].type).toBe('article');
      expect(articles[1].type).toBe('article');
      
      const papers = await Content.findByType('paper');
      expect(papers).toHaveLength(1);
      expect(papers[0].type).toBe('paper');
    });
    
    it('should find content by topic', async () => {
      // Create test content
      await Promise.all([
        new Content({
          sourceId: new mongoose.Types.ObjectId(),
          url: 'https://example.com/article1',
          title: 'Article 1',
          type: 'article',
          topics: ['AI', 'Machine Learning'],
          processed: true
        }).save(),
        new Content({
          sourceId: new mongoose.Types.ObjectId(),
          url: 'https://example.com/article2',
          title: 'Article 2',
          type: 'article',
          topics: ['Machine Learning', 'Deep Learning'],
          processed: true
        }).save(),
        new Content({
          sourceId: new mongoose.Types.ObjectId(),
          url: 'https://example.com/article3',
          title: 'Article 3',
          type: 'article',
          topics: ['AI', 'NLP'],
          processed: true
        }).save()
      ]);
      
      const aiContent = await Content.findByTopic('AI');
      expect(aiContent).toHaveLength(2);
      
      const mlContent = await Content.findByTopic('Machine Learning');
      expect(mlContent).toHaveLength(2);
      
      const dlContent = await Content.findByTopic('Deep Learning');
      expect(dlContent).toHaveLength(1);
    });
    
    it('should find recent content', async () => {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      
      // Create test content
      await Promise.all([
        new Content({
          sourceId: new mongoose.Types.ObjectId(),
          url: 'https://example.com/article1',
          title: 'Article 1',
          type: 'article',
          publishDate: now,
          processed: true
        }).save(),
        new Content({
          sourceId: new mongoose.Types.ObjectId(),
          url: 'https://example.com/article2',
          title: 'Article 2',
          type: 'article',
          publishDate: oneDayAgo,
          processed: true
        }).save(),
        new Content({
          sourceId: new mongoose.Types.ObjectId(),
          url: 'https://example.com/article3',
          title: 'Article 3',
          type: 'article',
          publishDate: twoDaysAgo,
          processed: true
        }).save(),
        new Content({
          sourceId: new mongoose.Types.ObjectId(),
          url: 'https://example.com/article4',
          title: 'Article 4',
          type: 'article',
          publishDate: threeDaysAgo,
          processed: true
        }).save()
      ]);
      
      const recentContent = await Content.findRecentContent(2);
      expect(recentContent).toHaveLength(2);
      expect(recentContent[0].publishDate.getTime()).toBe(now.getTime());
      expect(recentContent[1].publishDate.getTime()).toBe(oneDayAgo.getTime());
    });
    
    it('should find relevant content', async () => {
      // Create test content
      await Promise.all([
        new Content({
          sourceId: new mongoose.Types.ObjectId(),
          url: 'https://example.com/article1',
          title: 'Article 1',
          type: 'article',
          relevanceScore: 0.9,
          processed: true
        }).save(),
        new Content({
          sourceId: new mongoose.Types.ObjectId(),
          url: 'https://example.com/article2',
          title: 'Article 2',
          type: 'article',
          relevanceScore: 0.7,
          processed: true
        }).save(),
        new Content({
          sourceId: new mongoose.Types.ObjectId(),
          url: 'https://example.com/article3',
          title: 'Article 3',
          type: 'article',
          relevanceScore: 0.5,
          processed: true
        }).save(),
        new Content({
          sourceId: new mongoose.Types.ObjectId(),
          url: 'https://example.com/article4',
          title: 'Article 4',
          type: 'article',
          relevanceScore: 0.3,
          processed: true
        }).save()
      ]);
      
      const relevantContent = await Content.findRelevantContent(2);
      expect(relevantContent).toHaveLength(2);
      expect(relevantContent[0].relevanceScore).toBe(0.9);
      expect(relevantContent[1].relevanceScore).toBe(0.7);
    });
    
    it('should find popular content', async () => {
      // Create test content
      const content1 = new Content({
        sourceId: new mongoose.Types.ObjectId(),
        url: 'https://example.com/article1',
        title: 'Article 1',
        type: 'article',
        processed: true
      });
      
      const content2 = new Content({
        sourceId: new mongoose.Types.ObjectId(),
        url: 'https://example.com/article2',
        title: 'Article 2',
        type: 'article',
        processed: true
      });
      
      const content3 = new Content({
        sourceId: new mongoose.Types.ObjectId(),
        url: 'https://example.com/article3',
        title: 'Article 3',
        type: 'article',
        processed: true
      });
      
      await content1.save();
      await content2.save();
      await content3.save();
      
      // Add user interactions
      const userId = new mongoose.Types.ObjectId();
      
      // Content 1: 5 views, 3 saves, 2 shares
      for (let i = 0; i < 5; i++) {
        await content1.addUserInteraction(userId, 'view');
      }
      for (let i = 0; i < 3; i++) {
        await content1.addUserInteraction(userId, 'save');
      }
      for (let i = 0; i < 2; i++) {
        await content1.addUserInteraction(userId, 'share');
      }
      
      // Content 2: 10 views, 1 save, 0 shares
      for (let i = 0; i < 10; i++) {
        await content2.addUserInteraction(userId, 'view');
      }
      await content2.addUserInteraction(userId, 'save');
      
      // Content 3: 3 views, 0 saves, 0 shares
      for (let i = 0; i < 3; i++) {
        await content3.addUserInteraction(userId, 'view');
      }
      
      const popularContent = await Content.findPopularContent(2);
      expect(popularContent).toHaveLength(2);
      expect(popularContent[0].readCount).toBe(10); // Content 2 has most views
      expect(popularContent[1].readCount).toBe(5); // Content 1 has second most views
    });
    
    it('should find content by user interaction', async () => {
      const userId1 = new mongoose.Types.ObjectId();
      const userId2 = new mongoose.Types.ObjectId();
      
      // Create test content
      const content1 = new Content({
        sourceId: new mongoose.Types.ObjectId(),
        url: 'https://example.com/article1',
        title: 'Article 1',
        type: 'article',
        processed: true
      });
      
      const content2 = new Content({
        sourceId: new mongoose.Types.ObjectId(),
        url: 'https://example.com/article2',
        title: 'Article 2',
        type: 'article',
        processed: true
      });
      
      const content3 = new Content({
        sourceId: new mongoose.Types.ObjectId(),
        url: 'https://example.com/article3',
        title: 'Article 3',
        type: 'article',
        processed: true
      });
      
      await content1.save();
      await content2.save();
      await content3.save();
      
      // Add user interactions
      await content1.addUserInteraction(userId1, 'view');
      await content1.addUserInteraction(userId1, 'save');
      await content2.addUserInteraction(userId1, 'view');
      await content2.addUserInteraction(userId2, 'save');
      await content3.addUserInteraction(userId2, 'view');
      
      const user1SavedContent = await Content.findByUserInteraction(userId1, 'save');
      expect(user1SavedContent).toHaveLength(1);
      expect(user1SavedContent[0].title).toBe('Article 1');
      
      const user1ViewedContent = await Content.findByUserInteraction(userId1, 'view');
      expect(user1ViewedContent).toHaveLength(2);
      
      const user2SavedContent = await Content.findByUserInteraction(userId2, 'save');
      expect(user2SavedContent).toHaveLength(1);
      expect(user2SavedContent[0].title).toBe('Article 2');
    });
    
    it('should search content by text', async () => {
      // Create test content
      await Promise.all([
        new Content({
          sourceId: new mongoose.Types.ObjectId(),
          url: 'https://example.com/article1',
          title: 'Machine Learning Basics',
          summary: 'An introduction to machine learning concepts',
          type: 'article',
          processed: true
        }).save(),
        new Content({
          sourceId: new mongoose.Types.ObjectId(),
          url: 'https://example.com/article2',
          title: 'Deep Learning Applications',
          summary: 'How deep learning is used in various fields',
          type: 'article',
          processed: true
        }).save(),
        new Content({
          sourceId: new mongoose.Types.ObjectId(),
          url: 'https://example.com/article3',
          title: 'Natural Language Processing',
          summary: 'Understanding NLP techniques',
          keyInsights: ['Machine learning is essential for NLP'],
          type: 'article',
          processed: true
        }).save()
      ]);
      
      const mlResults = await Content.searchContent('machine learning');
      expect(mlResults).toHaveLength(2);
      
      const deepResults = await Content.searchContent('deep');
      expect(deepResults).toHaveLength(1);
      expect(deepResults[0].title).toBe('Deep Learning Applications');
      
      const nlpResults = await Content.searchContent('NLP');
      expect(nlpResults).toHaveLength(1);
      expect(nlpResults[0].title).toBe('Natural Language Processing');
    });
  });
});