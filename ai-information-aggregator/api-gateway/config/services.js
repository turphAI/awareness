/**
 * Service configuration for API Gateway
 * Defines service endpoints, health checks, and routing rules
 */

const services = {
  authentication: {
    name: 'authentication-service',
    host: process.env.AUTH_SERVICE_HOST || 'authentication-service',
    port: process.env.AUTH_SERVICE_PORT || 3001,
    healthPath: '/health',
    timeout: 5000,
    retries: 3
  },
  sourceManagement: {
    name: 'source-management-service',
    host: process.env.SOURCE_SERVICE_HOST || 'source-management-service',
    port: process.env.SOURCE_SERVICE_PORT || 3002,
    healthPath: '/health',
    timeout: 5000,
    retries: 3
  },
  contentDiscovery: {
    name: 'content-discovery-service',
    host: process.env.CONTENT_SERVICE_HOST || 'content-discovery-service',
    port: process.env.CONTENT_SERVICE_PORT || 3003,
    healthPath: '/health',
    timeout: 5000,
    retries: 3
  },
  podcastExtraction: {
    name: 'podcast-extraction-service',
    host: process.env.PODCAST_SERVICE_HOST || 'podcast-extraction-service',
    port: process.env.PODCAST_SERVICE_PORT || 3004,
    healthPath: '/health',
    timeout: 5000,
    retries: 3
  },
  contentSummarization: {
    name: 'content-summarization-service',
    host: process.env.SUMMARIZATION_SERVICE_HOST || 'content-summarization-service',
    port: process.env.SUMMARIZATION_SERVICE_PORT || 3005,
    healthPath: '/health',
    timeout: 5000,
    retries: 3
  },
  personalization: {
    name: 'personalization-service',
    host: process.env.PERSONALIZATION_SERVICE_HOST || 'personalization-service',
    port: process.env.PERSONALIZATION_SERVICE_PORT || 3006,
    healthPath: '/health',
    timeout: 5000,
    retries: 3
  },
  libraryManagement: {
    name: 'library-management-service',
    host: process.env.LIBRARY_SERVICE_HOST || 'library-management-service',
    port: process.env.LIBRARY_SERVICE_PORT || 3007,
    healthPath: '/health',
    timeout: 5000,
    retries: 3
  },
  configurationManagement: {
    name: 'configuration-management-service',
    host: process.env.CONFIG_SERVICE_HOST || 'configuration-management-service',
    port: process.env.CONFIG_SERVICE_PORT || 3008,
    healthPath: '/health',
    timeout: 5000,
    retries: 3
  }
};

/**
 * Get service URL
 * @param {string} serviceName - Name of the service
 * @returns {string} - Full service URL
 */
const getServiceUrl = (serviceName) => {
  const service = services[serviceName];
  if (!service) {
    throw new Error(`Service ${serviceName} not found`);
  }
  return `http://${service.host}:${service.port}`;
};

/**
 * Get all services
 * @returns {Object} - All services configuration
 */
const getAllServices = () => services;

/**
 * Check if service exists
 * @param {string} serviceName - Name of the service
 * @returns {boolean} - True if service exists
 */
const serviceExists = (serviceName) => {
  return serviceName in services;
};

module.exports = {
  services,
  getServiceUrl,
  getAllServices,
  serviceExists
};