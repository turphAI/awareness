const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
require('./setup');

// Import services
const authService = require('../../services/authentication/index');
const sourceService = require('../../services/source-management/index');
const contentService = require('../../services/content-discovery/index');
const libraryService = require('../../services/library-management/index');
const apiGateway = require('../../api-gateway/index');

describe('End-to-End User Journey Integration Tests', () => {
  let app;
  let authToken;
  let userId;
  let sourceId;
  let contentId;

  beforeAll(async () => {
    // Initialize the API Gateway with all services
    app = express();
    app.use(express.json());
    
    // Mount service routes
    app.use('/api/auth', authService);
    app.use('/api/sources', sourceService);
    app.use('/api/content', contentService);
    app.use('/api/library', libraryService);
  });

  describe('Complete User Journey: Registration to Content Consumption', () => {
    test('1. User Registration and Authentication', async () => {
      // Register new user
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'testuser@example.com',
          password: 'SecurePassword123!',
          name: 'Test User'
        })
        .expect(201);

      expect(registerResponse.body).toHaveProperty('user');
      expect(registerResponse.body.user.email).toBe('testuser@example.com');
      userId = registerResponse.body.user.id;

      // Login user
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'testuser@example.com',
          password: 'SecurePassword123!'
        })
        .expect(200);

      expect(loginResponse.body).toHaveProperty('token');
      authToken = loginResponse.body.token;
    });

    test('2. Source Management Workflow', async () => {
      // Add a new source
      const sourceResponse = await request(app)
        .post('/api/sources')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          url: 'https://example-ai-blog.com',
          name: 'AI Research Blog',
          type: 'blog',
          categories: ['machine-learning', 'research'],
          relevanceScore: 8
        })
        .expect(201);

      expect(sourceResponse.body).toHaveProperty('id');
      expect(sourceResponse.body.name).toBe('AI Research Blog');
      sourceId = sourceResponse.body.id;

      // Verify source was added to user's sources
      const sourcesResponse = await request(app)
        .get('/api/sources')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(sourcesResponse.body.sources).toHaveLength(1);
      expect(sourcesResponse.body.sources[0].id).toBe(sourceId);
    });

    test('3. Content Discovery and Processing', async () => {
      // Simulate content discovery from the added source
      const discoveryResponse = await request(app)
        .post('/api/content/discover')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          sourceId: sourceId,
          content: {
            title: 'Latest Advances in Large Language Models',
            url: 'https://example-ai-blog.com/llm-advances',
            author: 'Dr. AI Researcher',
            publishDate: new Date().toISOString(),
            fullText: 'This article discusses the latest advances in large language models, including improvements in reasoning capabilities and efficiency. Recent research has shown significant progress in areas such as few-shot learning and model compression.',
            type: 'article'
          }
        })
        .expect(201);

      expect(discoveryResponse.body).toHaveProperty('id');
      expect(discoveryResponse.body.title).toBe('Latest Advances in Large Language Models');
      contentId = discoveryResponse.body.id;

      // Verify content was processed and summarized
      expect(discoveryResponse.body).toHaveProperty('summary');
      expect(discoveryResponse.body).toHaveProperty('keyInsights');
      expect(discoveryResponse.body.processed).toBe(true);
    });

    test('4. Content Library and Search', async () => {
      // Search for content in library
      const searchResponse = await request(app)
        .get('/api/library/search')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ q: 'language models' })
        .expect(200);

      expect(searchResponse.body.results).toHaveLength(1);
      expect(searchResponse.body.results[0].id).toBe(contentId);

      // Get content details
      const contentResponse = await request(app)
        .get(`/api/library/content/${contentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(contentResponse.body.title).toBe('Latest Advances in Large Language Models');
      expect(contentResponse.body).toHaveProperty('relatedContent');
    });

    test('5. Collection Management', async () => {
      // Create a new collection
      const collectionResponse = await request(app)
        .post('/api/library/collections')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'LLM Research',
          description: 'Collection of LLM research articles'
        })
        .expect(201);

      const collectionId = collectionResponse.body.id;

      // Add content to collection
      await request(app)
        .post(`/api/library/collections/${collectionId}/content`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ contentId })
        .expect(200);

      // Verify content was added to collection
      const collectionDetailsResponse = await request(app)
        .get(`/api/library/collections/${collectionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(collectionDetailsResponse.body.contentIds).toContain(contentId);
    });

    test('6. User Preferences and Personalization', async () => {
      // Update user preferences
      await request(app)
        .put('/api/auth/preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          topics: ['machine-learning', 'natural-language-processing'],
          contentVolume: 10,
          summaryLength: 'medium'
        })
        .expect(200);

      // Verify personalized dashboard reflects preferences
      const dashboardResponse = await request(app)
        .get('/api/library/dashboard')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(dashboardResponse.body).toHaveProperty('personalizedContent');
      expect(dashboardResponse.body.personalizedContent).toHaveLength(1);
    });

    test('7. Data Export and Privacy', async () => {
      // Export user data
      const exportResponse = await request(app)
        .get('/api/auth/export')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(exportResponse.body).toHaveProperty('userData');
      expect(exportResponse.body).toHaveProperty('sources');
      expect(exportResponse.body).toHaveProperty('content');
      expect(exportResponse.body).toHaveProperty('collections');
    });
  });

  describe('Cross-Service Integration Tests', () => {
    test('Content Discovery triggers Summarization Service', async () => {
      // Mock content discovery that should trigger summarization
      const contentData = {
        title: 'Advanced AI Techniques',
        url: 'https://example.com/ai-techniques',
        fullText: 'This comprehensive article covers advanced artificial intelligence techniques including deep learning, reinforcement learning, and neural architecture search. The paper presents novel approaches to improving model performance and efficiency.',
        type: 'article',
        sourceId: sourceId
      };

      const response = await request(app)
        .post('/api/content/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send(contentData)
        .expect(201);

      // Verify summarization was triggered
      expect(response.body).toHaveProperty('summary');
      expect(response.body).toHaveProperty('keyInsights');
      expect(response.body.keyInsights).toBeInstanceOf(Array);
      expect(response.body.summary.length).toBeGreaterThan(0);
    });

    test('User interactions update Personalization Service', async () => {
      // Simulate user interaction with content
      await request(app)
        .post(`/api/library/content/${contentId}/interact`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'view',
          duration: 120
        })
        .expect(200);

      // Verify personalization service received the interaction
      const personalizedResponse = await request(app)
        .get('/api/library/personalized')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(personalizedResponse.body).toHaveProperty('recommendations');
      expect(personalizedResponse.body.recommendations).toBeInstanceOf(Array);
    });

    test('Source authentication flows work end-to-end', async () => {
      // Add a source that requires authentication
      const authSourceResponse = await request(app)
        .post('/api/sources')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          url: 'https://premium-ai-journal.com',
          name: 'Premium AI Journal',
          type: 'academic',
          requiresAuthentication: true,
          credentials: {
            username: 'testuser',
            password: 'testpass'
          }
        })
        .expect(201);

      const authSourceId = authSourceResponse.body.id;

      // Verify credentials are stored securely
      const sourceDetailsResponse = await request(app)
        .get(`/api/sources/${authSourceId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(sourceDetailsResponse.body.requiresAuthentication).toBe(true);
      expect(sourceDetailsResponse.body).not.toHaveProperty('credentials');
    });
  });

  describe('Error Handling and Resilience', () => {
    test('Service failures are handled gracefully', async () => {
      // Test with invalid source URL
      const invalidSourceResponse = await request(app)
        .post('/api/sources')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          url: 'invalid-url',
          name: 'Invalid Source'
        })
        .expect(400);

      expect(invalidSourceResponse.body).toHaveProperty('error');
      expect(invalidSourceResponse.body.error).toContain('Invalid URL');
    });

    test('Authentication failures are handled properly', async () => {
      // Test with invalid token
      await request(app)
        .get('/api/sources')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      // Test with no token
      await request(app)
        .get('/api/sources')
        .expect(401);
    });

    test('Rate limiting works across services', async () => {
      // Make multiple rapid requests to test rate limiting
      const promises = Array(20).fill().map(() =>
        request(app)
          .get('/api/library/dashboard')
          .set('Authorization', `Bearer ${authToken}`)
      );

      const responses = await Promise.all(promises);
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });
});