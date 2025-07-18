/**
 * Base interface for microservices
 * This is a JavaScript implementation of an interface pattern
 */
class ServiceInterface {
  /**
   * Initialize the service
   * @returns {Promise<void>}
   */
  async initialize() {
    throw new Error('Method not implemented');
  }
  
  /**
   * Start the service
   * @returns {Promise<void>}
   */
  async start() {
    throw new Error('Method not implemented');
  }
  
  /**
   * Stop the service
   * @returns {Promise<void>}
   */
  async stop() {
    throw new Error('Method not implemented');
  }
  
  /**
   * Get service health status
   * @returns {Promise<Object>}
   */
  async getHealth() {
    throw new Error('Method not implemented');
  }
  
  /**
   * Get service metrics
   * @returns {Promise<Object>}
   */
  async getMetrics() {
    throw new Error('Method not implemented');
  }
}

module.exports = ServiceInterface;