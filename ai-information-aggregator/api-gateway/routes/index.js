/**
 * Main routing configuration for API Gateway
 * Handles API versioning and service routing
 */

const express = require('express');
const { getServiceUrl } = require('../config/services');
const { createProxyMiddleware } = require('http-proxy-middleware');
const logger = require('../utils/logger');

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
  // Setup versioned routes
  Object.keys(API_VERSIONS).forEach(version => {
    const versionRouter = setupVersionRoutes(version, authMiddleware);
    app.use(API_VERSIONS[version], versionRouter);
  });

  // Default to v1 for backward compatibility
  const defaultRouter = setupVersionRoutes('v1', authMiddleware);
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