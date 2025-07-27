import api from './api';

class ContentService {
  /**
   * Get content by ID
   * @param {string} contentId - Content ID
   * @returns {Promise} API response
   */
  async getContent(contentId) {
    return api.get(`/api/content/${contentId}`);
  }

  /**
   * Search content
   * @param {Object} params - Search parameters
   * @returns {Promise} API response
   */
  async searchContent(params = {}) {
    return api.get('/api/content/search', { params });
  }

  /**
   * Get user's content
   * @param {Object} params - Query parameters
   * @returns {Promise} API response
   */
  async getUserContent(params = {}) {
    return api.get('/api/content', { params });
  }

  /**
   * Create new content
   * @param {Object} contentData - Content data
   * @returns {Promise} API response
   */
  async createContent(contentData) {
    return api.post('/api/content', contentData);
  }

  /**
   * Update content
   * @param {string} contentId - Content ID
   * @param {Object} updateData - Update data
   * @returns {Promise} API response
   */
  async updateContent(contentId, updateData) {
    return api.put(`/api/content/${contentId}`, updateData);
  }

  /**
   * Delete content
   * @param {string} contentId - Content ID
   * @returns {Promise} API response
   */
  async deleteContent(contentId) {
    return api.delete(`/api/content/${contentId}`);
  }

  /**
   * Get content metadata
   * @param {string} contentId - Content ID
   * @returns {Promise} API response
   */
  async getContentMetadata(contentId) {
    return api.get(`/api/content/${contentId}/metadata`);
  }

  /**
   * Get related content
   * @param {string} contentId - Content ID
   * @param {Object} params - Query parameters
   * @returns {Promise} API response
   */
  async getRelatedContent(contentId, params = {}) {
    return api.get(`/api/content/${contentId}/related`, { params });
  }

  /**
   * Get content by category
   * @param {string} category - Category name
   * @param {Object} params - Query parameters
   * @returns {Promise} API response
   */
  async getContentByCategory(category, params = {}) {
    return api.get(`/api/content/category/${category}`, { params });
  }

  /**
   * Get trending content
   * @param {Object} params - Query parameters
   * @returns {Promise} API response
   */
  async getTrendingContent(params = {}) {
    return api.get('/api/content/trending', { params });
  }

  /**
   * Get recent content
   * @param {Object} params - Query parameters
   * @returns {Promise} API response
   */
  async getRecentContent(params = {}) {
    return api.get('/api/content/recent', { params });
  }
}

export default new ContentService();