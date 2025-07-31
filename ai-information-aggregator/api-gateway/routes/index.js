/**
 * Main routing configuration for API Gateway
 * Handles API versioning and service routing
 */

const express = require('express');
const { getServiceUrl } = require('../config/services');
const { createProxyMiddleware } = require('http-proxy-middleware');
const logger = require('../utils/logger');
const authRoutes = require('./auth');

const router = express.Router();

/**
 * API Version configuration
 */
const API_VERSIONS = {
  v1: '/api/v1',
  v2: '/api/v2'
};

/**
 * Route definitions with versioning support
 */
const routeDefinitions = {
  v1: {
    // Authentication routes (public)
    auth: {
      path: '/auth',
      service: 'authentication',
      requiresAuth: false,
      methods: ['GET', 'POST', 'PUT', 'DELETE']
    },
    // Source management routes
    sources: {
      path: '/sources',
      service: 'sourceManagement',
      requiresAuth: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE']
    },
    // Content discovery routes
    content: {
      path: '/content',
      service: 'contentDiscovery',
      requiresAuth: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE']
    },
    // Podcast extraction routes
    podcasts: {
      path: '/podcasts',
      service: 'podcastExtraction',
      requiresAuth: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE']
    },
    // Content summarization routes
    summaries: {
      path: '/summaries',
      service: 'contentSummarization',
      requiresAuth: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE']
    },
    // Personalization routes
    personalization: {
      path: '/personalization',
      service: 'personalization',
      requiresAuth: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE']
    },
    // Library management routes
    library: {
      path: '/library',
      service: 'libraryManagement',
      requiresAuth: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE']
    },
    // Configuration management routes
    config: {
      path: '/config',
      service: 'configurationManagement',
      requiresAuth: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE']
    }
  },
  v2: {
    // Future API version routes can be defined here
    // For now, v2 will inherit v1 routes
  }
};

/**
 * Create proxy middleware with error handling and logging
 */
const createServiceProxy = (serviceName, options = {}) => {
  const serviceUrl = getServiceUrl(serviceName);
  
  return createProxyMiddleware({
    target: serviceUrl,
    changeOrigin: true,
    timeout: options.timeout || 30000,
    proxyTimeout: options.proxyTimeout || 30000,
    onError: (err, req, res) => {
      logger.error(`Proxy error for ${serviceName}:`, {
        error: err.message,
        url: req.url,
        method: req.method
      });
      
      if (!res.headersSent) {
        res.status(503).json({
          error: 'Service temporarily unavailable',
          service: serviceName,
          timestamp: new Date().toISOString()
        });
      }
    },
    onProxyReq: (proxyReq, req, res) => {
      logger.info(`Proxying request to ${serviceName}:`, {
        method: req.method,
        url: req.url,
        target: serviceUrl
      });
    },
    onProxyRes: (proxyRes, req, res) => {
      logger.info(`Response from ${serviceName}:`, {
        statusCode: proxyRes.statusCode,
        method: req.method,
        url: req.url
      });
    }
  });
};

/**
 * Setup routes for a specific API version
 */
const setupVersionRoutes = (version, authMiddleware) => {
  const versionRouter = express.Router();
  const routes = routeDefinitions[version] || routeDefinitions.v1;

  Object.entries(routes).forEach(([routeName, config]) => {
    const { path, service, requiresAuth, methods } = config;
    
    try {
      const proxy = createServiceProxy(service);
      
      if (requiresAuth && authMiddleware) {
        versionRouter.use(path, authMiddleware, proxy);
      } else {
        versionRouter.use(path, proxy);
      }
      
      logger.info(`Route configured: ${API_VERSIONS[version]}${path} -> ${service}`);
    } catch (error) {
      logger.error(`Failed to configure route ${path}:`, error);
    }
  });

  return versionRouter;
};

/**
 * Initialize all routes
 */
const initializeRoutes = (app, authMiddleware) => {
  // Add direct auth routes (not proxied)
  app.use('/api/auth', authRoutes);
  
  // Temporary in-memory storage for sources and categories
  const tempSources = [];
  const tempCategories = [
    { _id: '1', name: 'Machine Learning', description: 'ML related content', color: '#007bff' },
    { _id: '2', name: 'Natural Language Processing', description: 'NLP and language models', color: '#28a745' },
    { _id: '3', name: 'Computer Vision', description: 'Image and video processing', color: '#dc3545' },
    { _id: '4', name: 'AI Ethics', description: 'Ethical considerations in AI', color: '#ffc107' },
    { _id: '5', name: 'Research Papers', description: 'Academic research', color: '#6f42c1' },
    { _id: '6', name: 'Industry News', description: 'AI industry updates', color: '#fd7e14' }
  ];
  
  // Add temporary dashboard endpoints
  app.get('/api/dashboard/stats', (req, res) => {
    res.json({
      sourcesMonitored: tempSources.length,
      articlesToday: Math.min(tempSources.length * 3, 15), // Simulate articles based on sources
      savedItems: Math.min(tempSources.length * 8, 50), // Simulate saved items
      collections: Math.min(Math.floor(tempSources.length / 2), 10) // Simulate collections
    });
  });
  
  app.get('/api/dashboard/content', (req, res) => {
    // Generate dynamic content based on user's sources
    const content = [];
    
    tempSources.forEach((source, index) => {
      // Generate 1-2 articles per source
      const articlesPerSource = Math.random() > 0.5 ? 2 : 1;
      
      for (let i = 0; i < articlesPerSource; i++) {
        const articleId = `${source.id}-${i}`;
        const hoursAgo = Math.floor(Math.random() * 24);
        const publishDate = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
        
        let title, summary, topics;
        
        // Generate content based on source type and URL
        if (source.type === 'academic' || source.url.includes('arxiv')) {
          const academicTitles = [
            'Attention Mechanisms in Large Language Models: A Comprehensive Survey',
            'Scaling Laws for Neural Language Models: New Insights',
            'Multimodal Learning with Vision-Language Transformers',
            'Efficient Fine-tuning of Large Language Models',
            'Reinforcement Learning from Human Feedback: Recent Advances'
          ];
          title = academicTitles[Math.floor(Math.random() * academicTitles.length)];
          summary = 'This paper presents novel approaches to improving model performance and efficiency in large-scale AI systems, with experimental validation on multiple benchmarks.';
          topics = ['machine-learning', 'research', 'transformers'];
        } else if (source.type === 'blog' || source.url.includes('blog')) {
          const blogTitles = [
            'GPT-4 Turbo: What Developers Need to Know',
            'Building Production-Ready AI Applications',
            'The Future of AI: Trends and Predictions for 2025',
            'Open Source AI Models: A Game Changer',
            'AI Safety: Best Practices for Responsible Development'
          ];
          title = blogTitles[Math.floor(Math.random() * blogTitles.length)];
          summary = 'Practical insights and real-world applications of AI technology, including implementation tips and industry best practices.';
          topics = ['ai-development', 'industry-news', 'best-practices'];
        } else if (source.type === 'news') {
          const newsTitles = [
            'Major AI Company Announces Breakthrough in Reasoning',
            'New Regulations for AI Development Proposed',
            'AI Startup Raises $100M Series B Funding',
            'Tech Giants Partner on AI Safety Initiative',
            'AI-Powered Healthcare Solution Shows Promising Results'
          ];
          title = newsTitles[Math.floor(Math.random() * newsTitles.length)];
          summary = 'Latest developments in the AI industry, covering funding, partnerships, regulatory changes, and technological breakthroughs.';
          topics = ['industry-news', 'funding', 'regulation'];
        } else {
          // Default content for other types
          const generalTitles = [
            'Advances in AI Technology: Recent Developments',
            'Machine Learning Applications in Real World',
            'Understanding Neural Network Architectures',
            'AI Ethics and Responsible Development',
            'The Impact of AI on Various Industries'
          ];
          title = generalTitles[Math.floor(Math.random() * generalTitles.length)];
          summary = 'Comprehensive coverage of AI developments, applications, and their impact across different sectors and use cases.';
          topics = ['artificial-intelligence', 'technology', 'applications'];
        }
        
        // Add source categories to topics if available
        if (source.categories && source.categories.length > 0) {
          topics = [...topics, ...source.categories.map(cat => cat.toLowerCase().replace(/\s+/g, '-'))];
        }
        
        content.push({
          id: articleId,
          title: title,
          summary: summary,
          relevanceScore: source.relevanceScore || (0.7 + Math.random() * 0.3), // Use source relevance or random
          publishDate: publishDate,
          topics: [...new Set(topics)], // Remove duplicates
          type: source.type,
          source: {
            name: source.name,
            url: source.url,
            id: source.id
          }
        });
      }
    });
    
    // If no sources, return the original mock content
    if (content.length === 0) {
      content.push(
        {
          id: '1',
          title: 'GPT-4 Turbo: Enhanced Performance and Reduced Costs',
          summary: 'OpenAI announces GPT-4 Turbo with improved efficiency, longer context windows, and significant cost reductions for developers.',
          relevanceScore: 0.95,
          publishDate: new Date().toISOString(),
          topics: ['llm', 'gpt-4', 'openai'],
          type: 'news'
        },
        {
          id: '2',
          title: 'Attention Is All You Need: Transformer Architecture Deep Dive',
          summary: 'A comprehensive analysis of the transformer architecture that revolutionized natural language processing and machine learning.',
          relevanceScore: 0.88,
          publishDate: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          topics: ['transformers', 'attention', 'nlp'],
          type: 'academic'
        }
      ]
    });
  });
  
  // Add temporary source validation endpoint until source management service is implemented
  app.post('/api/sources/validate-url', (req, res) => {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'URL is required'
      });
    }
    
    // Basic URL validation
    try {
      new URL(url);
      
      // For now, just return success for any valid URL format
      res.json({
        valid: true,
        url: url,
        message: 'URL format is valid',
        type: 'website' // Default type
      });
    } catch (error) {
      res.status(400).json({
        error: 'Validation error',
        message: 'Invalid URL format'
      });
    }
  });
  
  // Add temporary sources endpoints until source management service is implemented
  app.get('/api/sources', (req, res) => {
    // Return stored sources
    res.json(tempSources);
  });
  
  app.post('/api/sources', (req, res) => {
    // Store the source in memory and return it
    const sourceData = req.body;
    const newSource = {
      _id: Date.now().toString(), // Use _id instead of id to match frontend expectations
      ...sourceData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      active: true
    };
    
    // Add to temporary storage
    tempSources.push(newSource);
    
    res.status(201).json(newSource);
  });
  
  // Add temporary categories endpoints
  app.get('/api/categories', (req, res) => {
    // Return stored categories
    res.json(tempCategories);
  });
  
  app.post('/api/categories', (req, res) => {
    const categoryData = req.body;
    const newCategory = {
      _id: Date.now().toString(),
      ...categoryData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    tempCategories.push(newCategory);
    res.status(201).json(newCategory);
  });
  
  app.delete('/api/categories/:id', (req, res) => {
    const index = tempCategories.findIndex(cat => cat._id === req.params.id);
    if (index > -1) {
      tempCategories.splice(index, 1);
    }
    res.json({ message: 'Category deleted successfully' });
  });
  
  app.post('/api/categories/suggest', (req, res) => {
    // Return some suggested categories based on the source
    res.json([
      { _id: '5', name: 'Research Papers', score: 0.9 },
      { _id: '1', name: 'Machine Learning', score: 0.8 }
    ]);
  });
  
  // Add more source endpoints
  app.put('/api/sources/:id', (req, res) => {
    const sourceData = req.body;
    const sourceIndex = tempSources.findIndex(source => source._id === req.params.id);
    
    if (sourceIndex > -1) {
      tempSources[sourceIndex] = {
        ...tempSources[sourceIndex],
        ...sourceData,
        updatedAt: new Date().toISOString()
      };
      res.json(tempSources[sourceIndex]);
    } else {
      res.status(404).json({ message: 'Source not found' });
    }
  });
  
  app.delete('/api/sources/:id', (req, res) => {
    const index = tempSources.findIndex(source => source._id === req.params.id);
    if (index > -1) {
      tempSources.splice(index, 1);
    }
    res.json({ message: 'Source deleted successfully' });
  });
  
  app.put('/api/sources/:id/relevance', (req, res) => {
    const { score, reason } = req.body;
    const sourceIndex = tempSources.findIndex(source => source._id === req.params.id);
    
    if (sourceIndex > -1) {
      tempSources[sourceIndex].relevanceScore = score;
      tempSources[sourceIndex].relevanceReason = reason;
      tempSources[sourceIndex].updatedAt = new Date().toISOString();
      res.json(tempSources[sourceIndex]);
    } else {
      res.status(404).json({ message: 'Source not found' });
    }
  });

  // Setup versioned routes for other services
  Object.keys(API_VERSIONS).forEach(version => {
    const versionRouter = setupVersionRoutes(version, authMiddleware);
    app.use(API_VERSIONS[version], versionRouter);
  });

  // Default to v1 for backward compatibility (excluding auth which is handled above)
  const defaultRouter = setupVersionRoutes('v1', authMiddleware);
  // Remove auth from default router since we handle it directly
  const routesWithoutAuth = { ...routeDefinitions.v1 };
  delete routesWithoutAuth.auth;
  
  Object.entries(routesWithoutAuth).forEach(([routeName, config]) => {
    const { path, service, requiresAuth, methods } = config;
    
    try {
      const proxy = createServiceProxy(service);
      
      if (requiresAuth && authMiddleware) {
        defaultRouter.use(path, authMiddleware, proxy);
      } else {
        defaultRouter.use(path, proxy);
      }
      
      logger.info(`Route configured: /api${path} -> ${service}`);
    } catch (error) {
      logger.error(`Failed to configure route ${path}:`, error);
    }
  });
  
  app.use('/api', defaultRouter);

  // API version info endpoint
  app.get('/api/versions', (req, res) => {
    res.json({
      versions: Object.keys(API_VERSIONS),
      current: 'v1',
      endpoints: API_VERSIONS
    });
  });

  logger.info('All routes initialized successfully');
};

/**
 * Get route information
 */
const getRouteInfo = () => {
  return {
    versions: API_VERSIONS,
    routes: routeDefinitions
  };
};

module.exports = {
  initializeRoutes,
  getRouteInfo,
  API_VERSIONS,
  routeDefinitions
};