/**
 * Unit tests for service discovery
 */

const axios = require('axios');
const serviceDiscovery = require('../utils/serviceDiscovery');
const { getAllServices } = require('../config/services');

// Mock dependencies
jest.mock('axios');
jest.mock('../config/services');
jest.mock('../utils/logger');

describe('Service Discovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock getAllServices
    getAllServices.mockReturnValue({
      authentication: {
        name: 'authentication-service',
        host: 'auth-host',
        port: 3001,
        healthPath: '/health',
        timeout: 5000,
        retries: 3
      },
      sourceManagement: {
        name: 'source-management-service',
        host: 'source-host',
        port: 3002,
        healthPath: '/health',
        timeout: 5000,
        retries: 3
      }
    });
  });

  afterEach(() => {
    serviceDiscovery.stopHealthChecks();
  });

  describe('Health Checks', () => {
    test('should start health checks', () => {
      const spy = jest.spyOn(serviceDiscovery, 'performHealthChecks');
      serviceDiscovery.startHealthChecks();
      
      expect(spy).toHaveBeenCalled();
      
      spy.mockRestore();
    });

    test('should stop health checks', () => {
      serviceDiscovery.startHealthChecks();
      serviceDiscovery.stopHealthChecks();
      
      // Should not throw any errors
      expect(true).toBe(true);
    });

    test('should check service health successfully', async () => {
      axios.get.mockResolvedValue({ status: 200 });
      
      await serviceDiscovery.checkServiceHealth('authentication', {
        host: 'auth-host',
        port: 3001,
        healthPath: '/health',
        timeout: 5000
      });
      
      const status = serviceDiscovery.getServiceStatus('authentication');
      expect(status.healthy).toBe(true);
      expect(status.consecutiveFailures).toBe(0);
    });

    test('should handle service health check failure', async () => {
      axios.get.mockRejectedValue(new Error('Connection refused'));
      
      await serviceDiscovery.checkServiceHealth('authentication', {
        host: 'auth-host',
        port: 3001,
        healthPath: '/health',
        timeout: 5000
      });
      
      const status = serviceDiscovery.getServiceStatus('authentication');
      expect(status.healthy).toBe(false);
      expect(status.error).toBe('Connection refused');
      expect(status.consecutiveFailures).toBe(1);
    });

    test('should handle HTTP error status codes', async () => {
      axios.get.mockResolvedValue({ status: 500 });
      
      await serviceDiscovery.checkServiceHealth('authentication', {
        host: 'auth-host',
        port: 3001,
        healthPath: '/health',
        timeout: 5000
      });
      
      const status = serviceDiscovery.getServiceStatus('authentication');
      expect(status.healthy).toBe(false);
      expect(status.error).toBe('HTTP 500');
    });
  });

  describe('Service Status Management', () => {
    test('should update service status correctly', () => {
      serviceDiscovery.updateServiceStatus('testService', true, null);
      
      const status = serviceDiscovery.getServiceStatus('testService');
      expect(status.healthy).toBe(true);
      expect(status.error).toBe(null);
      expect(status.consecutiveFailures).toBe(0);
      expect(status.lastCheck).toBeInstanceOf(Date);
    });

    test('should increment consecutive failures', () => {
      serviceDiscovery.updateServiceStatus('testService', false, 'Error 1');
      serviceDiscovery.updateServiceStatus('testService', false, 'Error 2');
      
      const status = serviceDiscovery.getServiceStatus('testService');
      expect(status.healthy).toBe(false);
      expect(status.consecutiveFailures).toBe(2);
    });

    test('should reset consecutive failures on success', () => {
      serviceDiscovery.updateServiceStatus('testService', false, 'Error');
      serviceDiscovery.updateServiceStatus('testService', false, 'Error');
      serviceDiscovery.updateServiceStatus('testService', true, null);
      
      const status = serviceDiscovery.getServiceStatus('testService');
      expect(status.healthy).toBe(true);
      expect(status.consecutiveFailures).toBe(0);
    });

    test('should return default status for unknown service', () => {
      const status = serviceDiscovery.getServiceStatus('unknownService');
      
      expect(status.healthy).toBe(false);
      expect(status.lastCheck).toBe(null);
      expect(status.error).toBe('No health check performed');
      expect(status.consecutiveFailures).toBe(0);
    });
  });

  describe('Service Availability', () => {
    test('should consider service available when healthy', () => {
      serviceDiscovery.updateServiceStatus('testService', true, null);
      
      expect(serviceDiscovery.isServiceAvailable('testService')).toBe(true);
    });

    test('should consider service unavailable when unhealthy', () => {
      serviceDiscovery.updateServiceStatus('testService', false, 'Error');
      
      expect(serviceDiscovery.isServiceAvailable('testService')).toBe(false);
    });

    test('should consider service unavailable after too many failures', () => {
      // Simulate 3 consecutive failures
      for (let i = 0; i < 3; i++) {
        serviceDiscovery.updateServiceStatus('testService', false, 'Error');
      }
      
      expect(serviceDiscovery.isServiceAvailable('testService')).toBe(false);
    });

    test('should get healthy services', () => {
      serviceDiscovery.updateServiceStatus('authentication', true, null);
      serviceDiscovery.updateServiceStatus('sourceManagement', false, 'Error');
      
      const healthyServices = serviceDiscovery.getHealthyServices();
      expect(healthyServices).toContain('authentication');
      expect(healthyServices).not.toContain('sourceManagement');
    });

    test('should get unhealthy services', () => {
      serviceDiscovery.updateServiceStatus('authentication', true, null);
      serviceDiscovery.updateServiceStatus('sourceManagement', false, 'Error');
      
      const unhealthyServices = serviceDiscovery.getUnhealthyServices();
      expect(unhealthyServices).toContain('sourceManagement');
      expect(unhealthyServices).not.toContain('authentication');
    });
  });

  describe('All Service Statuses', () => {
    test('should return all service statuses', () => {
      serviceDiscovery.updateServiceStatus('authentication', true, null);
      serviceDiscovery.updateServiceStatus('sourceManagement', false, 'Error');
      
      const allStatuses = serviceDiscovery.getAllServiceStatuses();
      
      expect(allStatuses).toHaveProperty('authentication');
      expect(allStatuses).toHaveProperty('sourceManagement');
      expect(allStatuses.authentication.healthy).toBe(true);
      expect(allStatuses.sourceManagement.healthy).toBe(false);
    });
  });
});