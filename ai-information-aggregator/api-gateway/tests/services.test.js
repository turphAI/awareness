/**
 * Unit tests for service configuration
 */

const { services, getServiceUrl, getAllServices, serviceExists } = require('../config/services');

describe('Service Configuration', () => {
  describe('Service Definitions', () => {
    test('should have all required services defined', () => {
      const expectedServices = [
        'authentication',
        'sourceManagement',
        'contentDiscovery',
        'podcastExtraction',
        'contentSummarization',
        'personalization',
        'libraryManagement',
        'configurationManagement'
      ];

      expectedServices.forEach(serviceName => {
        expect(services).toHaveProperty(serviceName);
      });
    });

    test('should have required properties for each service', () => {
      Object.entries(services).forEach(([serviceName, config]) => {
        expect(config).toHaveProperty('name');
        expect(config).toHaveProperty('host');
        expect(config).toHaveProperty('port');
        expect(config).toHaveProperty('healthPath');
        expect(config).toHaveProperty('timeout');
        expect(config).toHaveProperty('retries');

        expect(typeof config.name).toBe('string');
        expect(typeof config.host).toBe('string');
        expect(typeof config.port).toBe('number');
        expect(typeof config.healthPath).toBe('string');
        expect(typeof config.timeout).toBe('number');
        expect(typeof config.retries).toBe('number');
      });
    });
  });

  describe('getServiceUrl', () => {
    test('should return correct URL for existing service', () => {
      const url = getServiceUrl('authentication');
      expect(url).toBe('http://authentication-service:3001');
    });

    test('should return correct URL for source management service', () => {
      const url = getServiceUrl('sourceManagement');
      expect(url).toBe('http://source-management-service:3002');
    });

    test('should throw error for non-existent service', () => {
      expect(() => {
        getServiceUrl('nonExistentService');
      }).toThrow('Service nonExistentService not found');
    });

    test('should use environment variables when available', () => {
      const originalEnv = process.env.AUTH_SERVICE_HOST;
      process.env.AUTH_SERVICE_HOST = 'custom-auth-host';
      
      // Re-require the module to pick up env changes
      jest.resetModules();
      const { getServiceUrl: getServiceUrlWithEnv } = require('../config/services');
      
      const url = getServiceUrlWithEnv('authentication');
      expect(url).toBe('http://custom-auth-host:3001');
      
      // Restore original env
      process.env.AUTH_SERVICE_HOST = originalEnv;
    });
  });

  describe('getAllServices', () => {
    test('should return all services', () => {
      const allServices = getAllServices();
      expect(allServices).toEqual(services);
      expect(Object.keys(allServices)).toHaveLength(8);
    });
  });

  describe('serviceExists', () => {
    test('should return true for existing service', () => {
      expect(serviceExists('authentication')).toBe(true);
      expect(serviceExists('sourceManagement')).toBe(true);
      expect(serviceExists('contentDiscovery')).toBe(true);
    });

    test('should return false for non-existing service', () => {
      expect(serviceExists('nonExistentService')).toBe(false);
      expect(serviceExists('')).toBe(false);
      expect(serviceExists(null)).toBe(false);
    });
  });

  describe('Service Configuration Validation', () => {
    test('should have unique ports for all services', () => {
      const ports = Object.values(services).map(service => service.port);
      const uniquePorts = [...new Set(ports)];
      expect(ports).toHaveLength(uniquePorts.length);
    });

    test('should have valid health check paths', () => {
      Object.values(services).forEach(service => {
        expect(service.healthPath).toMatch(/^\/.*$/);
      });
    });

    test('should have reasonable timeout values', () => {
      Object.values(services).forEach(service => {
        expect(service.timeout).toBeGreaterThan(0);
        expect(service.timeout).toBeLessThanOrEqual(30000);
      });
    });

    test('should have reasonable retry values', () => {
      Object.values(services).forEach(service => {
        expect(service.retries).toBeGreaterThan(0);
        expect(service.retries).toBeLessThanOrEqual(5);
      });
    });
  });
});