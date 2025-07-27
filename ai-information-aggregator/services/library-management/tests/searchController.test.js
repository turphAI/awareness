const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { app } = require('../index');
const Content = require('../../content-discovery/models/Content');
const Collection = require('../models/Collection');
const jwt = require('jsonwebtoken');

// Mock User model since it's in a different service
const mockUser = {
  _id: new mongoose.Types.ObjectId(),
  email: 'test@example.com',
  name: 'Test User',
  passwordHash: 'hashedpassword',
  save: jest.fn().mockResolvedValue(true)
};

// Mock User model methods
const User = {
  deleteMany: jest.fn().mockResolvedValue({}),
  findById: jest.fn().mockResolvedValue(mockUser),
  create: jest.fn().mockResolvedValue(mockUser)
};

describe('Search Controller', () => {
  let mongoServer;
  let testUser;
  let authToken;
  let testContent;
  let testCollection;

  beforeAll(async () => {
    // Start in-memory MongoDB instance
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    
    // Connect to the in-memory database
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    // Clean up and close connections
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear all collections
    await Content.deleteMany({});
    await Collection.deleteMany({});
    await User.deleteMany({});

    // Create test user
    testUser = mockUser;

    // Generate auth token
    authToken = jwt.sign(
      { userId: testUser._id, email: testUser.email },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    // Create test content
    testContent = [
      {
        sourceId: new mongoose.Types.ObjectId(),
        url: 'https://example.com/article1',
        title: 'Introduction to Machine Learning',
        author: 'John Doe',
        publishDate: new Date('2023-01-15'),
        type: 'article',
        categories: ['AI', 'Technology'],
        topics: ['machine learning', 'artificial intelligence'],
        relevanceScore: 0.8,
        summary: 'A comprehensive guide to machine learning fundamentals',
        keyInsights: ['ML is transforming industries', 'Data quality is crucial'],
        fullText: 'Machine learning is a subset of artificial intelligence...',
        processed: true,
        outdated: false,
        readCount: 10,
        saveCount: 5,
        qualityScore: 0.9
      },
      {
        sourceId: new mongoose.Types.ObjectId(),
        url: 'https://example.com/paper1',
        title: 'Deep Learning Applications in Healthcare',
        author: 'Jane Smith',
        publishDate: new Date('2023-02-20'),
        type: 'paper',
        categories: ['AI', 'Healthcare'],
        topics: ['deep learning', 'healthcare', 'medical imaging'],
        relevanceScore: 0.9,
        summary: 'Research on deep learning applications in medical diagnosis',
        keyInsights: ['Deep learning improves diagnostic accuracy', 'Large datasets are essential'],
        fullText: 'Deep learning has shown remarkable success in healthcare applications...',
        processed: true,
        outdated: false,
        readCount: 25,
        saveCount: 15,
        qualityScore: 0.95
      },
      {
        sourceId: new mongoose.Types.ObjectId(),
        url: 'https://example.com/podcast1',
        title: 'AI Ethics Discussion',
        author: 'Tech Podcast',
        publishDate: new Date('2023-03-10'),
        type: 'podcast',
        categories: ['AI', 'Ethics'],
        topics: ['AI ethics', 'responsible AI'],
        relevanceScore: 0.7,
        summary: 'Discussion on ethical considerations in AI development',
        keyInsights: ['Ethics should be considered from the start', 'Bias in AI is a major concern'],
        fullText: 'In this episode, we discuss the importance of ethics in AI...',
        processed: true,
        outdated: false,
        readCount: 8,
        saveCount: 3,
        qualityScore: 0.8
      },
      {
        sourceId: new mongoose.Types.ObjectId(),
        url: 'https://example.com/old-article',
        title: 'Outdated AI Trends',
        author: 'Old Author',
        publishDate: new Date('2020-01-01'),
        type: 'article',
        categories: ['AI'],
        topics: ['old trends'],
        relevanceScore: 0.3,
        summary: 'Old article about AI trends',
        keyInsights: ['Some old insights'],
        fullText: 'This article discusses old AI trends...',
        processed: true,
        outdated: true,
        readCount: 2,
        saveCount: 0,
        qualityScore: 0.4
      }
    ];

    await Content.insertMany(testContent);

    // Create test collection
    testCollection = new Collection({
      userId: testUser._id,
      name: 'My AI Collection',
      description: 'Collection of AI-related content',
      contentIds: [testContent[0]._id, testContent[1]._id],
      public: true
    });
    await testCollection.save();
  });

  describe('GET /api/search/content', () => {
    it('should search content with text query', async () => {
      const response = await request(app)
        .get('/api/search/content')
        .query({ query: 'machine learning' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toHaveLength(1);
      expect(response.body.data.results[0].title).toBe('Introduction to Machine Learning');
      expect(response.body.data.pagination.totalCount).toBe(1);
    });

    it('should filter content by type', async () => {
      const response = await request(app)
        .get('/api/search/content')
        .query({ type: 'paper' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toHaveLength(1);
      expect(response.body.data.results[0].type).toBe('paper');
    });

    it('should filter content by categories', async () => {
      const response = await request(app)
        .get('/api/search/content')
        .query({ categories: ['Healthcare'] })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toHaveLength(1);
      expect(response.body.data.results[0].categories).toContain('Healthcare');
    });

    it('should filter content by topics', async () => {
      const response = await request(app)
        .get('/api/search/content')
        .query({ topics: ['deep learning'] })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toHaveLength(1);
      expect(response.body.data.results[0].topics).toContain('deep learning');
    });

    it('should filter content by author', async () => {
      const response = await request(app)
        .get('/api/search/content')
        .query({ author: 'John Doe' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toHaveLength(1);
      expect(response.body.data.results[0].author).toBe('John Doe');
    });

    it('should filter content by date range', async () => {
      const response = await request(app)
        .get('/api/search/content')
        .query({
          dateFrom: '2023-02-01',
          dateTo: '2023-03-31'
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toHaveLength(2);
    });

    it('should filter content by relevance score range', async () => {
      const response = await request(app)
        .get('/api/search/content')
        .query({
          relevanceMin: 0.8,
          relevanceMax: 1.0
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toHaveLength(2);
      response.body.data.results.forEach(item => {
        expect(item.relevanceScore).toBeGreaterThanOrEqual(0.8);
      });
    });

    it('should sort content by relevance score', async () => {
      const response = await request(app)
        .get('/api/search/content')
        .query({
          sortBy: 'relevance',
          sortOrder: 'desc'
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toHaveLength(3);
      
      // Check if sorted by relevance score descending
      for (let i = 0; i < response.body.data.results.length - 1; i++) {
        expect(response.body.data.results[i].relevanceScore)
          .toBeGreaterThanOrEqualTo(response.body.data.results[i + 1].relevanceScore);
      }
    });

    it('should sort content by date', async () => {
      const response = await request(app)
        .get('/api/search/content')
        .query({
          sortBy: 'date',
          sortOrder: 'desc'
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toHaveLength(3);
      
      // Check if sorted by date descending
      for (let i = 0; i < response.body.data.results.length - 1; i++) {
        const date1 = new Date(response.body.data.results[i].publishDate);
        const date2 = new Date(response.body.data.results[i + 1].publishDate);
        expect(date1.getTime()).toBeGreaterThanOrEqualTo(date2.getTime());
      }
    });

    it('should exclude outdated content by default', async () => {
      const response = await request(app)
        .get('/api/search/content')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toHaveLength(3);
      response.body.data.results.forEach(item => {
        expect(item.outdated).not.toBe(true);
      });
    });

    it('should include outdated content when requested', async () => {
      const response = await request(app)
        .get('/api/search/content')
        .query({ includeOutdated: true })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toHaveLength(4);
    });

    it('should handle pagination correctly', async () => {
      const response = await request(app)
        .get('/api/search/content')
        .query({
          page: 1,
          limit: 2
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toHaveLength(2);
      expect(response.body.data.pagination.currentPage).toBe(1);
      expect(response.body.data.pagination.totalCount).toBe(3);
      expect(response.body.data.pagination.totalPages).toBe(2);
      expect(response.body.data.pagination.hasNextPage).toBe(true);
      expect(response.body.data.pagination.hasPrevPage).toBe(false);
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .get('/api/search/content')
        .expect(401);
    });

    it('should validate query parameters', async () => {
      const response = await request(app)
        .get('/api/search/content')
        .query({
          relevanceMin: 2.0, // Invalid: should be between 0 and 1
          sortBy: 'invalid' // Invalid sort field
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('GET /api/search/suggestions', () => {
    it('should return search suggestions', async () => {
      const response = await request(app)
        .get('/api/search/suggestions')
        .query({ query: 'machine' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.suggestions).toBeDefined();
      expect(Array.isArray(response.body.data.suggestions)).toBe(true);
    });

    it('should return empty suggestions for short query', async () => {
      const response = await request(app)
        .get('/api/search/suggestions')
        .query({ query: 'a' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.suggestions).toHaveLength(0);
    });

    it('should validate query parameter', async () => {
      await request(app)
        .get('/api/search/suggestions')
        .query({ query: 'a' }) // Too short
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('GET /api/search/facets', () => {
    it('should return search facets', async () => {
      const response = await request(app)
        .get('/api/search/facets')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.facets).toBeDefined();
      expect(response.body.data.facets.types).toBeDefined();
      expect(response.body.data.facets.categories).toBeDefined();
      expect(response.body.data.facets.topics).toBeDefined();
      expect(response.body.data.facets.authors).toBeDefined();
    });

    it('should return facets for specific query', async () => {
      const response = await request(app)
        .get('/api/search/facets')
        .query({ query: 'machine learning' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.facets).toBeDefined();
    });
  });

  describe('GET /api/search/collections', () => {
    it('should search collections', async () => {
      const response = await request(app)
        .get('/api/search/collections')
        .query({ query: 'AI Collection' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toHaveLength(1);
      expect(response.body.data.results[0].name).toBe('My AI Collection');
    });

    it('should filter collections by user', async () => {
      const response = await request(app)
        .get('/api/search/collections')
        .query({ userId: testUser._id.toString() })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toHaveLength(1);
    });

    it('should filter collections by public status', async () => {
      const response = await request(app)
        .get('/api/search/collections')
        .query({ public: true })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toHaveLength(1);
      expect(response.body.data.results[0].public).toBe(true);
    });
  });

  describe('POST /api/search/advanced', () => {
    it('should perform advanced search', async () => {
      const searchRequest = {
        query: 'machine learning',
        filters: {
          type: ['article', 'paper'],
          relevanceRange: { min: 0.7, max: 1.0 }
        },
        sortBy: 'relevance',
        sortOrder: 'desc'
      };

      const response = await request(app)
        .post('/api/search/advanced')
        .send(searchRequest)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toBeDefined();
      expect(Array.isArray(response.body.data.results)).toBe(true);
    });

    it('should handle complex filters', async () => {
      const searchRequest = {
        filters: {
          type: ['article'],
          categories: ['AI', 'Technology'],
          dateRange: {
            from: '2023-01-01',
            to: '2023-12-31'
          },
          qualityRange: { min: 0.8 }
        }
      };

      const response = await request(app)
        .post('/api/search/advanced')
        .send(searchRequest)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toBeDefined();
    });

    it('should validate request body', async () => {
      const invalidRequest = {
        query: 'a'.repeat(501), // Too long
        sortBy: 'invalid'
      };

      const response = await request(app)
        .post('/api/search/advanced')
        .send(invalidRequest)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Close the database connection to simulate an error
      await mongoose.disconnect();

      const response = await request(app)
        .get('/api/search/content')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Internal server error');

      // Reconnect for cleanup
      const mongoUri = mongoServer.getUri();
      await mongoose.connect(mongoUri);
    });
  });
});