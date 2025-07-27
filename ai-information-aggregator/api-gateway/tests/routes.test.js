/**
 * Unit tests for routing configuration
 */

const request = require('supertest');
const express = require('express');
const { initializeRoutes, getRouteInfo, API_VERSIONS } = require('../routes');
const { getServiceUrl } = require('../config/services');

// Mock dependencies
jest.mock('../config/services');
jest.mock('../utils/logger');
jest.mock('http-proxy-middleware', () => ({
  createProxyMiddleware: jest.fn(() => (req, res, next) => {
    res.json({ proxied: true, service: req.baseUrl });
  })
}));

describe('API Gateway Routing', () => {
  let app;
  let mockAuthMiddleware;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Mock auth middleware
    mockAuthMiddleware = jest.fn((req, res, next) => {
      req.user = { id: 'test-user', role: 'user' };
      next();
    });

    // Mock service URL function
    getServiceUrl.mockImplementation((serviceName) => {
      return `http://mock-${serviceName}:3000`;
    });

    // Initialize routes
    initializeRoutes(app, mockAuthMiddleware);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('API Versioning', () => {
    test('should support v1 API endpoints', async () => {
      const response = await request(app)
        .get('/api/v1/auth/health')
        .expect(200);

      expect(response.body).toEqual({ proxied: true, service: '/api/v1/auth' });
    });

    test('should support default API endpoints (v1)', async () => {
      const response = await request(app)
        .get('/api/auth/health')
        .expect(200);

      expect(response.body).toEqual({ proxied: true, service: '/api/auth' });
    });

    test('should return API version information', async () => {
      const response = await request(app)
        .get('/api/versions')
        .expect(200);

      expect(response.body).toHaveProperty('versions');
      expect(response.body).toHaveProperty('current', 'v1');
      expect(response.body).toHaveProperty('endpoints');
      expect(response.body.versions).toContain('v1');
    });
  });

  describe('Service Routing', () => {
    test('should route authentication requests without auth middleware', async () => {
      await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test@example.com', password: 'password' })
        .expect(200);

      // Auth middleware should not be called for auth routes
      expect(mockAuthMiddleware).not.toHaveBeenCalled();
    });

    test('should route protected requests with auth middleware', async () => {
      await request(app)
        .get('/api/v1/sources')
        .expect(200);

      // Auth middleware should be called for protected routes
      expect(mockAuthMiddleware).toHaveBeenCalled();
    });

    test('should route to source management service', async () => {
      const response = await request(app)
        .get('/api/v1/sources')
        .expect(200);

      expect(response.body).toEqual({ proxied: true, service: '/api/v1/sources' });
      expect(getServiceUrl).toHaveBeenCalledWith('sourceManagement');
    });

    test('should route to content discovery service', async () => {
      const response = await request(app)
        .get('/api/v1/content')
        .expect(200);

      expect(response.body).toEqual({ proxied: true, service: '/api/v1/content' });
      expect(getServiceUrl).toHaveBeenCalledWith('contentDiscovery');
    });

    test('should route to library management service', async () => {
      const response = await request(app)
        .get('/api/v1/library')
        .expect(200);

      expect(response.body).toEqual({ proxied: true, service: '/api/v1/library' });
      expect(getServiceUrl).toHaveBeenCalledWith('libraryManagement');
    });
  });

  describe('Route Information', () => {
    test('should return route information', () => {
      const routeInfo = getRouteInfo();

      expect(routeInfo).toHaveProperty('versions');
      expect(routeInfo).toHaveProperty('routes');
      expect(routeInfo.versions).toEqual(API_VERSIONS);
      expect(routeInfo.routes).toHaveProperty('v1');
    });

    test('should include all expected v1 routes', () => {
      const routeInfo = getRouteInfo();
      const v1Routes = routeInfo.routes.v1;

      expect(v1Routes).toHaveProperty('auth');
      expect(v1Routes).toHaveProperty('sources');
      expect(v1Routes).toHaveProperty('content');
      expect(v1Routes).toHaveProperty('podcasts');
      expect(v1Routes).toHaveProperty('summaries');
      expect(v1Routes).toHaveProperty('personalization');
      expect(v1Routes).toHaveProperty('library');
      expect(v1Routes).toHaveProperty('config');
    });
  });

  describe('HTTP Methods', () => {
    test('should support GET requests', async () => {
      await request(app)
        .get('/api/v1/sources')
        .expect(200);
    });

    test('should support POST requests', async () => {
      await request(app)
        .post('/api/v1/sources')
        .send({ name: 'Test Source' })
        .expect(200);
    });

    test('should support PUT requests', async () => {
      await request(app)
        .put('/api/v1/sources/123')
        .send({ name: 'Updated Source' })
        .expect(200);
    });

    test('should support DELETE requests', async () => {
      await request(app)
        .delete('/api/v1/sources/123')
        .expect(200);
    });
  });
});