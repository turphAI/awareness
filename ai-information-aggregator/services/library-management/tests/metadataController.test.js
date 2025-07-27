const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { app } = require('../index');
const ContentMetadata = require('../models/ContentMetadata');
const MetadataExtractor = require('../utils/metadataExtractor');

// Mock the MetadataExtractor
jest.mock('../utils/metadataExtractor');

describe('Metadata Controller', () => {
  let authToken;
  let testContentId;
  let testMetadata;

  beforeAll(async () => {
    // Connect to test database
    const mongoUri = process.env.MONGO_TEST_URI || 'mongodb://localhost:27017/ai-aggregator-test';
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    // Create auth token
    authToken = jwt.sign(
      { userId: 'test-user-id', email: 'test@example.com' },
      process.env.JWT_SECRET || 'fallback-secret-key'
    );

    testContentId = new mongoose.Types.ObjectId();
  });

  beforeEach(async () => {
    // Clear the database
    await ContentMetadata.deleteMany({});

    // Create test metadata
    testMetadata = {
      contentId: testContentId,
      title: 'Test Article',
      description: 'A test article about AI',
      contentType: 'article',
      language: 'en',
      keywords: ['ai', 'machine learning'],
      tags: ['technology', 'artificial intelligence'],
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
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('POST /api/metadata/extract', () => {
    it('should extract and store metadata successfully', async () => {
      const mockExtractedMetadata = {
        title: 'Extracted Title',
        description: 'Extracted description',
        contentType: 'article',
        keywords: ['ai', 'test'],
        processing: { status: 'completed' }
      };

      MetadataExtractor.prototype.extractMetadata = jest.fn().mockResolvedValue(mockExtractedMetadata);

      const response = await request(app)
        .post('/api/metadata/extract')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          contentId: testContentId.toString(),
          content: {
            title: 'Test Content',
            url: 'https://example.com/test',
            content: 'Test content body'
          }
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Extracted Title');
      expect(response.body.data.contentId).toBe(testContentId.toString());
    });

    it('should return 409 if metadata already exists and forceUpdate is false', async () => {
      // Create existing metadata
      await new ContentMetadata(testMetadata).save();

      const response = await request(app)
        .post('/api/metadata/extract')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          contentId: testContentId.toString(),
          content: { title: 'Test Content' }
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already exists');
    });

    it('should update existing metadata when forceUpdate is true', async () => {
      // Create existing metadata
      await new ContentMetadata(testMetadata).save();

      const mockExtractedMetadata = {
        title: 'Updated Title',
        description: 'Updated description',
        contentType: 'article',
        processing: { status: 'completed' }
      };

      MetadataExtractor.prototype.extractMetadata = jest.fn().mockResolvedValue(mockExtractedMetadata);

      const response = await request(app)
        .post('/api/metadata/extract')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          contentId: testContentId.toString(),
          content: { title: 'Test Content' },
          options: { forceUpdate: true }
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Updated Title');
    });

    it('should return 400 for invalid content ID', async () => {
      const response = await request(app)
        .post('/api/metadata/extract')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          contentId: 'invalid-id',
          content: { title: 'Test Content' }
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 401 without auth token', async () => {
      const response = await request(app)
        .post('/api/metadata/extract')
        .send({
          contentId: testContentId.toString(),
          content: { title: 'Test Content' }
        });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/metadata/:contentId', () => {
    it('should retrieve metadata successfully', async () => {
      await new ContentMetadata(testMetadata).save();

      const response = await request(app)
        .get(`/api/metadata/${testContentId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Test Article');
      expect(response.body.data.contentId).toBe(testContentId.toString());
    });

    it('should return 404 if metadata not found', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .get(`/api/metadata/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/metadata/:contentId', () => {
    it('should update metadata successfully', async () => {
      await new ContentMetadata(testMetadata).save();

      const updates = {
        title: 'Updated Title',
        description: 'Updated description',
        keywords: ['updated', 'keywords']
      };

      const response = await request(app)
        .put(`/api/metadata/${testContentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updates);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Updated Title');
      expect(response.body.data.description).toBe('Updated description');
    });

    it('should return 404 if metadata not found', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .put(`/api/metadata/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Updated Title' });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/metadata/:contentId', () => {
    it('should delete metadata successfully', async () => {
      await new ContentMetadata(testMetadata).save();

      const response = await request(app)
        .delete(`/api/metadata/${testContentId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify deletion
      const deletedMetadata = await ContentMetadata.findOne({ contentId: testContentId });
      expect(deletedMetadata).toBeNull();
    });

    it('should return 404 if metadata not found', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .delete(`/api/metadata/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/metadata (search)', () => {
    beforeEach(async () => {
      // Create multiple test metadata entries
      const metadata1 = new ContentMetadata({
        ...testMetadata,
        contentId: new mongoose.Types.ObjectId(),
        title: 'AI Machine Learning Article',
        contentType: 'article',
        topics: ['artificial intelligence', 'machine learning'],
        qualityScore: 0.9
      });

      const metadata2 = new ContentMetadata({
        ...testMetadata,
        contentId: new mongoose.Types.ObjectId(),
        title: 'Deep Learning Video',
        contentType: 'video',
        topics: ['deep learning', 'neural networks'],
        qualityScore: 0.7
      });

      await metadata1.save();
      await metadata2.save();
    });

    it('should search metadata with text query', async () => {
      const response = await request(app)
        .get('/api/metadata')
        .query({ query: 'machine learning' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toHaveLength(1);
      expect(response.body.data.results[0].title).toContain('Machine Learning');
    });

    it('should filter by content type', async () => {
      const response = await request(app)
        .get('/api/metadata')
        .query({ contentType: 'video' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toHaveLength(1);
      expect(response.body.data.results[0].contentType).toBe('video');
    });

    it('should filter by minimum quality score', async () => {
      const response = await request(app)
        .get('/api/metadata')
        .query({ minQualityScore: 0.8 })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toHaveLength(1);
      expect(response.body.data.results[0].qualityScore).toBeGreaterThanOrEqual(0.8);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/metadata')
        .query({ limit: 1, offset: 0 })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toHaveLength(1);
      expect(response.body.data.pagination.limit).toBe(1);
      expect(response.body.data.pagination.offset).toBe(0);
    });
  });

  describe('PUT /api/metadata/:contentId/engagement', () => {
    it('should update engagement metrics successfully', async () => {
      await new ContentMetadata(testMetadata).save();

      const metrics = {
        views: 1000,
        likes: 50,
        shares: 10,
        comments: 5
      };

      const response = await request(app)
        .put(`/api/metadata/${testContentId}/engagement`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ metrics });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.engagement.views).toBe(1000);
      expect(response.body.data.engagement.likes).toBe(50);
    });
  });

  describe('POST /api/metadata/:contentId/related', () => {
    it('should add related content successfully', async () => {
      await new ContentMetadata(testMetadata).save();
      const relatedContentId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .post(`/api/metadata/${testContentId}/related`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          relatedContentId: relatedContentId.toString(),
          relationshipType: 'similar',
          strength: 0.8
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.relatedContent).toHaveLength(1);
      expect(response.body.data.relatedContent[0].relationshipType).toBe('similar');
    });
  });

  describe('PUT /api/metadata/:contentId/outdated', () => {
    it('should mark content as outdated successfully', async () => {
      await new ContentMetadata(testMetadata).save();

      const reasons = ['factual_error', 'deprecated_info'];
      const suggestions = ['Update statistics', 'Review methodology'];

      const response = await request(app)
        .put(`/api/metadata/${testContentId}/outdated`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ reasons, suggestions });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.aging.isOutdated).toBe(true);
      expect(response.body.data.aging.outdatedReasons).toEqual(reasons);
    });
  });

  describe('PUT /api/metadata/:contentId/up-to-date', () => {
    it('should mark content as up-to-date successfully', async () => {
      const outdatedMetadata = {
        ...testMetadata,
        aging: {
          isOutdated: true,
          outdatedReasons: ['factual_error'],
          updateSuggestions: ['Update info']
        }
      };
      await new ContentMetadata(outdatedMetadata).save();

      const nextReviewDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

      const response = await request(app)
        .put(`/api/metadata/${testContentId}/up-to-date`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ nextReviewDate: nextReviewDate.toISOString() });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.aging.isOutdated).toBe(false);
      expect(response.body.data.aging.outdatedReasons).toHaveLength(0);
    });
  });

  describe('GET /api/metadata/outdated/list', () => {
    it('should retrieve outdated content successfully', async () => {
      const outdatedMetadata = {
        ...testMetadata,
        aging: {
          isOutdated: true,
          outdatedReasons: ['factual_error'],
          lastReviewedAt: new Date()
        }
      };
      await new ContentMetadata(outdatedMetadata).save();

      const response = await request(app)
        .get('/api/metadata/outdated/list')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toHaveLength(1);
      expect(response.body.data.results[0].aging.isOutdated).toBe(true);
    });
  });

  describe('GET /api/metadata/stats/overview', () => {
    it('should retrieve content statistics successfully', async () => {
      await new ContentMetadata(testMetadata).save();

      const response = await request(app)
        .get('/api/metadata/stats/overview')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.overview).toBeDefined();
      expect(response.body.data.byType).toBeDefined();
      expect(response.body.data.topDomains).toBeDefined();
    });
  });

  describe('PUT /api/metadata/:contentId/quality-scores', () => {
    it('should update quality scores successfully', async () => {
      await new ContentMetadata(testMetadata).save();

      const scores = {
        qualityScore: 0.95,
        relevanceScore: 0.85,
        popularityScore: 0.75
      };

      const response = await request(app)
        .put(`/api/metadata/${testContentId}/quality-scores`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ scores });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.qualityScore).toBe(0.95);
      expect(response.body.data.relevanceScore).toBe(0.85);
    });
  });

  describe('PUT /api/metadata/:contentId/custom-fields', () => {
    it('should update custom fields successfully', async () => {
      await new ContentMetadata(testMetadata).save();

      const fields = {
        doi: '10.1000/test.doi',
        journal: 'Test Journal',
        customField: 'custom value'
      };

      const response = await request(app)
        .put(`/api/metadata/${testContentId}/custom-fields`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ fields });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.customFields.get('doi')).toBe('10.1000/test.doi');
    });
  });
});