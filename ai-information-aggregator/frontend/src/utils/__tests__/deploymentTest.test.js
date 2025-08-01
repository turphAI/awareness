import {
  testRoutes,
  testStaticAssets,
  testApiEndpoints,
  testResponsiveBreakpoints,
  testPerformanceMetrics,
  testSecurityHeaders,
  runDeploymentTests
} from '../deploymentTest';

// Mock fetch for testing
global.fetch = jest.fn();

describe('Deployment Tests', () => {
  beforeEach(() => {
    fetch.mockClear();
    // Mock performance API
    global.performance = {
      getEntriesByType: jest.fn(),
      memory: {
        usedJSHeapSize: 1000000,
        totalJSHeapSize: 2000000,
        jsHeapSizeLimit: 4000000
      }
    };
  });

  describe('testRoutes', () => {
    it('should test all routes successfully', async () => {
      fetch.mockResolvedValue({
        status: 200,
        headers: new Map()
      });

      const results = await testRoutes();
      
      expect(results).toHaveLength(9);
      expect(results[0]).toHaveProperty('route');
      expect(results[0]).toHaveProperty('status');
      expect(results[0]).toHaveProperty('success');
    });

    it('should handle route errors', async () => {
      fetch.mockRejectedValue(new Error('Network error'));

      const results = await testRoutes();
      
      expect(results[0].success).toBe(false);
      expect(results[0].error).toBe('Network error');
    });
  });

  describe('testStaticAssets', () => {
    it('should test static assets loading', async () => {
      fetch.mockResolvedValue({
        status: 200,
        headers: new Map([
          ['cache-control', 'public, max-age=31536000'],
          ['content-type', 'text/css']
        ])
      });

      const results = await testStaticAssets();
      
      expect(results).toHaveLength(4);
      expect(results[0]).toHaveProperty('asset');
      expect(results[0]).toHaveProperty('cacheControl');
    });
  });

  describe('testApiEndpoints', () => {
    it('should test API endpoints', async () => {
      fetch.mockResolvedValue({
        status: 200,
        headers: new Map([
          ['access-control-allow-origin', '*']
        ])
      });

      const results = await testApiEndpoints();
      
      expect(results).toHaveLength(3);
      expect(results[0]).toHaveProperty('endpoint');
      expect(results[0]).toHaveProperty('cors');
    });
  });

  describe('testResponsiveBreakpoints', () => {
    it('should test responsive breakpoints', () => {
      const results = testResponsiveBreakpoints();
      
      expect(results).toHaveLength(4);
      expect(results[0]).toHaveProperty('breakpoint');
      expect(results[0]).toHaveProperty('width');
      expect(results[0]).toHaveProperty('height');
      expect(results[0]).toHaveProperty('aspectRatio');
    });
  });

  describe('testPerformanceMetrics', () => {
    it('should test performance metrics when available', () => {
      global.performance.getEntriesByType.mockImplementation((type) => {
        if (type === 'navigation') {
          return [{
            domContentLoadedEventStart: 100,
            domContentLoadedEventEnd: 200,
            loadEventStart: 300,
            loadEventEnd: 400,
            fetchStart: 0
          }];
        }
        if (type === 'resource') {
          return [
            { duration: 500 },
            { duration: 1500 } // slow resource
          ];
        }
        return [];
      });

      const results = testPerformanceMetrics();
      
      expect(results).toHaveProperty('metrics');
      expect(results).toHaveProperty('thresholds');
      expect(results).toHaveProperty('passed');
      expect(results.metrics.slowResources).toBe(1);
    });

    it('should handle missing performance API', () => {
      const originalPerformance = global.performance;
      delete global.performance;

      const results = testPerformanceMetrics();
      
      expect(results.success).toBe(false);
      expect(results.error).toBe('Performance API not available');
      
      // Restore performance
      global.performance = originalPerformance;
    });
  });

  describe('testSecurityHeaders', () => {
    it('should test security headers', async () => {
      // Mock window.location
      delete window.location;
      window.location = { 
        origin: 'https://example.com',
        protocol: 'https:'
      };

      fetch.mockResolvedValue({
        headers: new Map([
          ['strict-transport-security', 'max-age=31536000'],
          ['x-frame-options', 'DENY']
        ])
      });

      const results = await testSecurityHeaders();
      
      expect(results).toHaveProperty('https');
      expect(results).toHaveProperty('headers');
      expect(results).toHaveProperty('recommendations');
      expect(results.https).toBe(true);
    });
  });

  describe('runDeploymentTests', () => {
    it('should run all deployment tests', async () => {
      fetch.mockResolvedValue({
        status: 200,
        headers: new Map()
      });

      performance.getEntriesByType.mockReturnValue([{
        domContentLoadedEventStart: 100,
        domContentLoadedEventEnd: 200,
        loadEventStart: 300,
        loadEventEnd: 400,
        fetchStart: 0
      }]);

      // Mock window.location
      delete window.location;
      window.location = { 
        origin: 'https://example.com',
        protocol: 'https:'
      };

      const results = await runDeploymentTests();
      
      expect(results).toHaveProperty('timestamp');
      expect(results).toHaveProperty('tests');
      expect(results).toHaveProperty('overallSuccess');
      expect(results).toHaveProperty('successRate');
      expect(results.tests).toHaveProperty('routes');
      expect(results.tests).toHaveProperty('staticAssets');
      expect(results.tests).toHaveProperty('apiEndpoints');
    });
  });
});