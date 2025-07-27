const request = require('supertest');
const express = require('express');
require('./setup');

// Import service modules for direct testing
const AuthService = require('../../services/authentication/index');
const SourceService = require('../../services/source-management/index');
const ContentDiscoveryService = require('../../services/content-discovery/index');
const SummarizationService = require('../../services/content-summarization/index');
const PersonalizationService = require('../../services/personalization/index');
const LibraryService = require('../../services/library-management/index');
const ConfigurationService = require('../../services/configuration-management/index');

describe('Service-to-Service Integration Tests', () => {
  let app;
  let testUser;
  let authToken;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    
    // Mount all services
    app.use('/api/auth', AuthService);
    app.use('/api/sources', SourceService);
    app.use('/api/content', ContentDiscoveryService);
    app.use('/api/summarization', SummarizationService);
    app.use('/api/personalization', PersonalizationService);
    app.use('/api/library', LibraryService);
    app.use('/api/config', ConfigurationService);
  });

  beforeEach(async () => {
    // Create test user for each test
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'integration@test.com',
        password: 'TestPassword123!',
        name: 'Integration Test User'
      });

    testUser = registerResponse.body.user;
    
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'integration@test.com',
        password: 'TestPassword123!'
      });

    authToken = loginResponse.body.token;
  });

  describe('Content Discovery → Summarization Pipeline', () => {
    test('New content triggers automatic summarization', async () => {
      // Add a source first
      const sourceResponse = await request(app)
        .post('/api/sources')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          url: 'https://ai-research.example.com',
          name: 'AI Research Site',
          type: 'blog'
        });

      const sourceId = sourceResponse.body.id;

      // Simulate content discovery
      const contentData = {
        sourceId,
        title: 'Breakthrough in Neural Architecture Search',
        url: 'https://ai-research.example.com/nas-breakthrough',
        author: 'Research Team',
        publishDate: new Date().toISOString(),
        fullText: 'Recent advances in neural architecture search have led to the development of more efficient and accurate deep learning models. This paper presents a novel approach that combines evolutionary algorithms with gradient-based optimization to automatically design neural network architectures. The proposed method achieves state-of-the-art results on several benchmark datasets while requiring significantly less computational resources than previous approaches. Key innovations include a new search space design and an efficient evaluation strategy.',
        type: 'article'
      };

      const discoveryResponse = await request(app)
        .post('/api/content/discover')
        .set('Authorization', `Bearer ${authToken}`)
        .send(contentData);

      expect(discoveryResponse.status).toBe(201);
      expect(discoveryResponse.body).toHaveProperty('summary');
      expect(discoveryResponse.body).toHaveProperty('keyInsights');
      expect(discoveryResponse.body.summary).toContain('neural architecture search');
      expect(discoveryResponse.body.keyInsights).toBeInstanceOf(Array);
      expect(discoveryResponse.body.keyInsights.length).toBeGreaterThan(0);
    });

    test('Academic paper content gets specialized processing', async () => {
      const academicContent = {
        title: 'Attention Is All You Need: A Comprehensive Analysis',
        url: 'https://arxiv.org/abs/example',
        fullText: 'Abstract: We propose a new simple network architecture, the Transformer, based solely on attention mechanisms. Introduction: The dominant sequence transduction models are based on complex recurrent or convolutional neural networks. Methods: Our model employs multi-head self-attention mechanisms. Results: The Transformer achieves superior performance on translation tasks. Conclusion: Attention mechanisms alone are sufficient for sequence modeling.',
        type: 'paper',
        metadata: {
          venue: 'NIPS',
          year: 2017,
          citations: 50000
        }
      };

      const response = await request(app)
        .post('/api/summarization/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send(academicContent);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('summary');
      expect(response.body).toHaveProperty('methodology');
      expect(response.body).toHaveProperty('results');
      expect(response.body).toHaveProperty('keyContributions');
    });
  });

  describe('User Interactions → Personalization Pipeline', () => {
    test('Content interactions update user interest profile', async () => {
      // Create some content first
      const contentResponse = await request(app)
        .post('/api/content/discover')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Machine Learning Fundamentals',
          url: 'https://example.com/ml-fundamentals',
          fullText: 'This article covers the basics of machine learning including supervised learning, unsupervised learning, and reinforcement learning.',
          type: 'article',
          categories: ['machine-learning', 'education']
        });

      const contentId = contentResponse.body.id;

      // Simulate user interactions
      await request(app)
        .post(`/api/library/content/${contentId}/interact`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'view',
          duration: 300,
          engagement: 'high'
        });

      await request(app)
        .post(`/api/library/content/${contentId}/interact`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'save',
          timestamp: new Date().toISOString()
        });

      // Check if personalization service updated user profile
      const profileResponse = await request(app)
        .get('/api/personalization/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(profileResponse.status).toBe(200);
      expect(profileResponse.body).toHaveProperty('interests');
      expect(profileResponse.body.interests).toContain('machine-learning');
    });

    test('Personalized recommendations are generated based on interactions', async () => {
      // Create multiple pieces of content with different topics
      const contents = [
        {
          title: 'Deep Learning Advances',
          categories: ['deep-learning', 'neural-networks'],
          fullText: 'Recent advances in deep learning...'
        },
        {
          title: 'Natural Language Processing Trends',
          categories: ['nlp', 'transformers'],
          fullText: 'Current trends in NLP...'
        },
        {
          title: 'Computer Vision Breakthroughs',
          categories: ['computer-vision', 'cnn'],
          fullText: 'Latest breakthroughs in computer vision...'
        }
      ];

      const contentIds = [];
      for (const content of contents) {
        const response = await request(app)
          .post('/api/content/discover')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            ...content,
            url: `https://example.com/${content.title.toLowerCase().replace(/\s+/g, '-')}`,
            type: 'article'
          });
        contentIds.push(response.body.id);
      }

      // Interact heavily with deep learning content
      await request(app)
        .post(`/api/library/content/${contentIds[0]}/interact`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ type: 'view', duration: 600, engagement: 'high' });

      await request(app)
        .post(`/api/library/content/${contentIds[0]}/interact`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ type: 'save' });

      // Get personalized recommendations
      const recommendationsResponse = await request(app)
        .get('/api/personalization/recommendations')
        .set('Authorization', `Bearer ${authToken}`);

      expect(recommendationsResponse.status).toBe(200);
      expect(recommendationsResponse.body.recommendations).toBeInstanceOf(Array);
      
      // Deep learning content should be ranked higher
      const deepLearningRec = recommendationsResponse.body.recommendations
        .find(rec => rec.categories.includes('deep-learning'));
      expect(deepLearningRec).toBeDefined();
      expect(deepLearningRec.relevanceScore).toBeGreaterThan(0.7);
    });
  });

  describe('Configuration → Service Behavior Pipeline', () => {
    test('User preferences affect content discovery thresholds', async () => {
      // Set aggressive discovery settings
      await request(app)
        .put('/api/config/discovery-settings')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          aggressiveness: 0.9,
          includeThreshold: 0.3,
          autoApprove: true
        });

      // Test content discovery with low relevance
      const lowRelevanceContent = {
        title: 'Tangentially Related AI Topic',
        url: 'https://example.com/tangential',
        fullText: 'This article briefly mentions AI in the context of general technology trends.',
        type: 'article',
        relevanceScore: 0.4
      };

      const discoveryResponse = await request(app)
        .post('/api/content/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(lowRelevanceContent);

      expect(discoveryResponse.status).toBe(200);
      expect(discoveryResponse.body.shouldInclude).toBe(true);

      // Set conservative discovery settings
      await request(app)
        .put('/api/config/discovery-settings')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          aggressiveness: 0.3,
          includeThreshold: 0.7,
          autoApprove: false
        });

      // Same content should now be rejected
      const conservativeResponse = await request(app)
        .post('/api/content/evaluate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(lowRelevanceContent);

      expect(conservativeResponse.body.shouldInclude).toBe(false);
    });

    test('Summary preferences affect content processing', async () => {
      // Set detailed summary preference
      await request(app)
        .put('/api/config/summary-preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          length: 'detailed',
          includeKeyInsights: true,
          includeMethodology: true,
          maxLength: 500
        });

      const content = {
        title: 'Comprehensive AI Research Paper',
        fullText: 'This extensive research paper covers multiple aspects of artificial intelligence including theoretical foundations, practical applications, experimental methodologies, and future research directions. The paper presents novel algorithms, comprehensive evaluations, and detailed analysis of results across multiple domains.',
        type: 'paper'
      };

      const detailedResponse = await request(app)
        .post('/api/summarization/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send(content);

      expect(detailedResponse.body.summary.length).toBeGreaterThan(200);
      expect(detailedResponse.body).toHaveProperty('methodology');

      // Set brief summary preference
      await request(app)
        .put('/api/config/summary-preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          length: 'brief',
          includeKeyInsights: true,
          includeMethodology: false,
          maxLength: 100
        });

      const briefResponse = await request(app)
        .post('/api/summarization/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send(content);

      expect(briefResponse.body.summary.length).toBeLessThan(150);
      expect(briefResponse.body).not.toHaveProperty('methodology');
    });
  });

  describe('Library Management → Search Integration', () => {
    test('Content metadata is properly indexed for search', async () => {
      // Add content with rich metadata
      const contentWithMetadata = {
        title: 'Advanced Transformer Architectures',
        url: 'https://example.com/transformers',
        fullText: 'This paper introduces several improvements to transformer architectures including efficient attention mechanisms and novel positional encodings.',
        type: 'paper',
        author: 'Dr. Jane Smith',
        categories: ['transformers', 'attention-mechanisms', 'nlp'],
        topics: ['neural-networks', 'sequence-modeling'],
        metadata: {
          venue: 'ICML',
          year: 2023,
          keywords: ['attention', 'transformers', 'efficiency']
        }
      };

      const contentResponse = await request(app)
        .post('/api/content/discover')
        .set('Authorization', `Bearer ${authToken}`)
        .send(contentWithMetadata);

      const contentId = contentResponse.body.id;

      // Wait for indexing (simulate async processing)
      await new Promise(resolve => setTimeout(resolve, 100));

      // Test various search queries
      const titleSearchResponse = await request(app)
        .get('/api/library/search')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ q: 'transformer architectures' });

      expect(titleSearchResponse.body.results).toHaveLength(1);
      expect(titleSearchResponse.body.results[0].id).toBe(contentId);

      const authorSearchResponse = await request(app)
        .get('/api/library/search')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ q: 'Jane Smith' });

      expect(authorSearchResponse.body.results).toHaveLength(1);

      const categorySearchResponse = await request(app)
        .get('/api/library/search')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ categories: 'transformers' });

      expect(categorySearchResponse.body.results).toHaveLength(1);
    });

    test('Related content identification works across services', async () => {
      // Create related content pieces
      const relatedContents = [
        {
          title: 'Attention Mechanisms in Deep Learning',
          fullText: 'Comprehensive overview of attention mechanisms...',
          categories: ['attention-mechanisms', 'deep-learning']
        },
        {
          title: 'BERT: Pre-training of Deep Bidirectional Transformers',
          fullText: 'BERT represents a breakthrough in transformer-based models...',
          categories: ['transformers', 'nlp', 'pre-training']
        },
        {
          title: 'GPT-3: Language Models are Few-Shot Learners',
          fullText: 'GPT-3 demonstrates the power of large-scale language models...',
          categories: ['language-models', 'transformers', 'few-shot-learning']
        }
      ];

      const contentIds = [];
      for (const content of relatedContents) {
        const response = await request(app)
          .post('/api/content/discover')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            ...content,
            url: `https://example.com/${content.title.toLowerCase().replace(/\s+/g, '-')}`,
            type: 'paper'
          });
        contentIds.push(response.body.id);
      }

      // Get related content for the first item
      const relatedResponse = await request(app)
        .get(`/api/library/content/${contentIds[0]}/related`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(relatedResponse.status).toBe(200);
      expect(relatedResponse.body.relatedContent).toBeInstanceOf(Array);
      expect(relatedResponse.body.relatedContent.length).toBeGreaterThan(0);
      
      // Should find the transformer-related content
      const transformerRelated = relatedResponse.body.relatedContent
        .find(item => item.categories.includes('transformers'));
      expect(transformerRelated).toBeDefined();
    });
  });

  describe('Error Propagation and Recovery', () => {
    test('Service failures are handled gracefully across the pipeline', async () => {
      // Simulate a scenario where summarization service fails
      const contentData = {
        title: 'Test Content for Error Handling',
        url: 'https://example.com/error-test',
        fullText: 'This content will be used to test error handling.',
        type: 'article'
      };

      // Mock a summarization failure by sending malformed data
      const malformedContent = {
        ...contentData,
        fullText: null // This should cause summarization to fail
      };

      const response = await request(app)
        .post('/api/content/discover')
        .set('Authorization', `Bearer ${authToken}`)
        .send(malformedContent);

      // Content should still be saved even if summarization fails
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.processed).toBe(false);
      expect(response.body).toHaveProperty('processingError');
    });

    test('Authentication failures are properly handled across services', async () => {
      const invalidToken = 'invalid.jwt.token';

      // Test that all services properly reject invalid tokens
      const endpoints = [
        '/api/sources',
        '/api/content/discover',
        '/api/library/search',
        '/api/personalization/profile',
        '/api/config/summary-preferences'
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${invalidToken}`);

        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty('error');
      }
    });
  });
});