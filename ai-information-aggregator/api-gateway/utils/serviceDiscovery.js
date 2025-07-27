/**
 * Service Discovery utility
 * Handles health checks and service availability
 */

const axios = require('axios');
const { getAllServices } = require('../config/services');
const logger = require('./logger');

class ServiceDiscovery {
  constructor() {
    this.serviceStatus = new Map();
    this.healthCheckInterval = 30000; // 30 seconds
    this.healthCheckTimer = null;
  }

  /**
   * Start health checking for all services
   */
  startHealthChecks() {
    this.performHealthChecks();
    this.healthCheckTimer = setInterval(() => {
      this.performHealthChecks();
    }, this.healthCheckInterval);
    
    logger.info('Service health checks started');
  }

  /**
   * Stop health checking
   */
  stopHealthChecks() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    logger.info('Service health checks stopped');
  }

  /**
   * Perform health checks on all services
   */
  async performHealthChecks() {
    const services = getAllServices();
    const healthCheckPromises = Object.entries(services).map(([name, config]) =>
      this.checkServiceHealth(name, config)
    );

    await Promise.allSettled(healthCheckPromises);
  }

  /**
   * Check health of a specific service
   */
  async checkServiceHealth(serviceName, serviceConfig) {
    const url = `http://${serviceConfig.host}:${serviceConfig.port}${serviceConfig.healthPath}`;
    const timeout = serviceConfig.timeout || 5000;

    try {
      const response = await axios.get(url, { timeout });
      
      if (response.status === 200) {
        this.updateServiceStatus(serviceName, true, null);
        logger.debug(`Service ${serviceName} is healthy`);
      } else {
        this.updateServiceStatus(serviceName, false, `HTTP ${response.status}`);
        logger.warn(`Service ${serviceName} returned status ${response.status}`);
      }
    } catch (error) {
      this.updateServiceStatus(serviceName, false, error.message);
      logger.error(`Health check failed for ${serviceName}:`, error.message);
    }
  }

  /**
   * Update service status
   */
  updateServiceStatus(serviceName, isHealthy, error) {
    const previousStatus = this.serviceStatus.get(serviceName);
    const newStatus = {
      healthy: isHealthy,
      lastCheck: new Date(),
      error: error,
      consecutiveFailures: isHealthy ? 0 : (previousStatus?.consecutiveFailures || 0) + 1
    };

    this.serviceStatus.set(serviceName, newStatus);

    // Log status changes
    if (!previousStatus || previousStatus.healthy !== isHealthy) {
      const statusText = isHealthy ? 'healthy' : 'unhealthy';
      logger.info(`Service ${serviceName} status changed to ${statusText}`);
    }
  }

  /**
   * Get service status
   */
  getServiceStatus(serviceName) {
    return this.serviceStatus.get(serviceName) || {
      healthy: false,
      lastCheck: null,
      error: 'No health check performed',
      consecutiveFailures: 0
    };
  }

  /**
   * Get all service statuses
   */
  getAllServiceStatuses() {
    const services = getAllServices();
    const statuses = {};

    Object.keys(services).forEach(serviceName => {
      statuses[serviceName] = this.getServiceStatus(serviceName);
    });

    return statuses;
  }

  /**
   * Check if service is available
   */
  isServiceAvailable(serviceName) {
    const status = this.getServiceStatus(serviceName);
    return status.healthy && status.consecutiveFailures < 3;
  }

  /**
   * Get healthy services
   */
  getHealthyServices() {
    const services = getAllServices();
    return Object.keys(services).filter(serviceName => 
      this.isServiceAvailable(serviceName)
    );
  }

  /**
   * Get unhealthy services
   */
  getUnhealthyServices() {
    const services = getAllServices();
    return Object.keys(services).filter(serviceName => 
      !this.isServiceAvailable(serviceName)
    );
  }
}

// Create singleton instance
const serviceDiscovery = new ServiceDiscovery();

module.exports = serviceDiscovery;