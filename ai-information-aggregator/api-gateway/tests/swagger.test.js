/**
 * Unit tests for API documentation
 */

const request = require('supertest');
const express = require('express');
const { specs, swaggerUi } = require('../docs/swagger');

describe('API Documentation', () => {
  let app;

  beforeEach(() => {
    app = express();
    
    // Setup swagger documentation
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));
    
    // Redirect root to API documentation
    app.get('/', (req, res) => {
      res.redirect('/api-docs');
    });
  });

  describe('Swagger Specification', () => {
    test('should have valid OpenAPI specification', () => {
      expect(specs).toBeDefined();
      expect(specs.openapi).toBe('3.0.0');
      expect(specs.info).toBeDefined();
      expect(specs.info.title).toBe('AI Information Aggregator API');
      expect(specs.info.version).toBe('1.0.0');
    });

    test('should have required API information', () => {
      expect(specs.info.description).toContain('AI Information Aggregator');
      expect(specs.info.contact).toBeDefined();
      expect(specs.info.license).toBeDefined();
    });

    test('should have server configurations', () => {
      expect(specs.servers).toBeDefined();
      expect(Array.isArray(specs.servers)).toBe(true);
      expect(specs.servers.length).toBeGreaterThan(0);
    });

    test('should have security schemes defined', () => {
      expect(specs.components.securitySchemes).toBeDefined();
      expect(specs.components.securitySchemes.bearerAuth).toBeDefined();
      expect(specs.components.securitySchemes.bearerAuth.type).toBe('http');
      expect(specs.components.securitySchemes.bearerAuth.scheme).toBe('bearer');
    });

    test('should have common schemas defined', () => {
      const schemas = specs.components.schemas;
      
      expect(schemas.Error).toBeDefined();
      expect(schemas.User).toBeDefined();
      expect(schemas.Source).toBeDefined();
      expect(schemas.Content).toBeDefined();
      expect(schemas.HealthStatus).toBeDefined();
    });

    test('should have common responses defined', () => {
      const responses = specs.components.responses;
      
      expect(responses.UnauthorizedError).toBeDefined();
      expect(responses.ForbiddenError).toBeDefined();
      expect(responses.RateLimitError).toBeDefined();
      expect(responses.NotFoundError).toBeDefined();
      expect(responses.InternalServerError).toBeDefined();
    });

    test('should have API tags defined', () => {
      expect(specs.tags).toBeDefined();
      expect(Array.isArray(specs.tags)).toBe(true);
      
      const tagNames = specs.tags.map(tag => tag.name);
      expect(tagNames).toContain('Authentication');
      expect(tagNames).toContain('Sources');
      expect(tagNames).toContain('Content');
      expect(tagNames).toContain('System');
    });
  });

  describe('Documentation Endpoints', () => {
    test('should serve Swagger UI at /api-docs', async () => {
      const response = await request(app)
        .get('/api-docs/')
        .expect(200);

      expect(response.text).toContain('swagger-ui');
      expect(response.headers['content-type']).toMatch(/text\/html/);
    });

    test('should redirect root to API documentation', async () => {
      const response = await request(app)
        .get('/')
        .expect(302);

      expect(response.headers.location).toBe('/api-docs');
    });

    test('should serve OpenAPI JSON specification', async () => {
      // Add endpoint for JSON spec
      app.get('/api-docs.json', (req, res) => {
        res.json(specs);
      });

      const response = await request(app)
        .get('/api-docs.json')
        .expect(200);

      expect(response.body.openapi).toBe('3.0.0');
      expect(response.body.info.title).toBe('AI Information Aggregator API');
    });
  });

  describe('Schema Validation', () => {
    test('User schema should have required properties', () => {
      const userSchema = specs.components.schemas.User;
      
      expect(userSchema.type).toBe('object');
      expect(userSchema.properties.id).toBeDefined();
      expect(userSchema.properties.email).toBeDefined();
      expect(userSchema.properties.name).toBeDefined();
      expect(userSchema.properties.role).toBeDefined();
      expect(userSchema.required).toContain('id');
      expect(userSchema.required).toContain('email');
    });

    test('Source schema should have required properties', () => {
      const sourceSchema = specs.components.schemas.Source;
      
      expect(sourceSchema.type).toBe('object');
      expect(sourceSchema.properties.id).toBeDefined();
      expect(sourceSchema.properties.url).toBeDefined();
      expect(sourceSchema.properties.name).toBeDefined();
      expect(sourceSchema.properties.type).toBeDefined();
      expect(sourceSchema.required).toContain('id');
      expect(sourceSchema.required).toContain('url');
    });

    test('Content schema should have required properties', () => {
      const contentSchema = specs.components.schemas.Content;
      
      expect(contentSchema.type).toBe('object');
      expect(contentSchema.properties.id).toBeDefined();
      expect(contentSchema.properties.title).toBeDefined();
      expect(contentSchema.properties.type).toBeDefined();
      expect(contentSchema.required).toContain('id');
      expect(contentSchema.required).toContain('title');
    });

    test('Error schema should have required properties', () => {
      const errorSchema = specs.components.schemas.Error;
      
      expect(errorSchema.type).toBe('object');
      expect(errorSchema.properties.error).toBeDefined();
      expect(errorSchema.properties.message).toBeDefined();
      expect(errorSchema.required).toContain('error');
      expect(errorSchema.required).toContain('message');
    });
  });

  describe('Response Definitions', () => {
    test('should have proper error response structures', () => {
      const unauthorizedError = specs.components.responses.UnauthorizedError;
      const forbiddenError = specs.components.responses.ForbiddenError;
      const rateLimitError = specs.components.responses.RateLimitError;
      
      expect(unauthorizedError.description).toContain('Authentication');
      expect(forbiddenError.description).toContain('Access denied');
      expect(rateLimitError.description).toContain('Rate limit');
      
      // Check that responses have proper content types
      expect(unauthorizedError.content['application/json']).toBeDefined();
      expect(forbiddenError.content['application/json']).toBeDefined();
      expect(rateLimitError.content['application/json']).toBeDefined();
    });

    test('rate limit response should have proper headers', () => {
      const rateLimitError = specs.components.responses.RateLimitError;
      
      expect(rateLimitError.headers).toBeDefined();
      expect(rateLimitError.headers['RateLimit-Limit']).toBeDefined();
      expect(rateLimitError.headers['RateLimit-Remaining']).toBeDefined();
      expect(rateLimitError.headers['RateLimit-Reset']).toBeDefined();
    });
  });

  describe('Security Configuration', () => {
    test('should have bearer authentication configured', () => {
      const bearerAuth = specs.components.securitySchemes.bearerAuth;
      
      expect(bearerAuth.type).toBe('http');
      expect(bearerAuth.scheme).toBe('bearer');
      expect(bearerAuth.bearerFormat).toBe('JWT');
    });

    test('should have global security requirement', () => {
      expect(specs.security).toBeDefined();
      expect(Array.isArray(specs.security)).toBe(true);
      expect(specs.security[0].bearerAuth).toBeDefined();
    });
  });
});