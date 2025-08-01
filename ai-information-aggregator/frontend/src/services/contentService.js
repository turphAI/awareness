import api, { handleApiError } from './api';

class ContentService {
  /**
   * Get content by ID
   * @param {string} contentId - Content ID
   * @returns {Promise} API response
   */
  async getContent(contentId) {
    try {
      const response = await api.get(`/content/${contentId}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  /**
   * Search content
   * @param {Object} params - Search parameters
   * @returns {Promise} API response
   */
  async searchContent(params = {}) {
    try {
      const response = await api.get('/content/search', { params });
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  /**
   * Get user's content
   * @param {Object} params - Query parameters
   * @returns {Promise} API response
   */
  async getUserContent(params = {}) {
    try {
      const response = await api.get('/content', { params });
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  /**
   * Create new content
   * @param {Object} contentData - Content data
   * @returns {Promise} API response
   */
  async createContent(contentData) {
    try {
      const response = await api.post('/content', contentData);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  /**
   * Update content
   * @param {string} contentId - Content ID
   * @param {Object} updateData - Update data
   * @returns {Promise} API response
   */
  async updateContent(contentId, updateData) {
    try {
      const response = await api.put(`/content/${contentId}`, updateData);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  /**
   * Delete content
   * @param {string} contentId - Content ID
   * @returns {Promise} API response
   */
  async deleteContent(contentId) {
    try {
      const response = await api.delete(`/content/${contentId}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  /**
   * Get content metadata
   * @param {string} contentId - Content ID
   * @returns {Promise} API response
   */
  async getContentMetadata(contentId) {
    try {
      const response = await api.get(`/content/${contentId}/metadata`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  /**
   * Get related content
   * @param {string} contentId - Content ID
   * @param {Object} params - Query parameters
   * @returns {Promise} API response
   */
  async getRelatedContent(contentId, params = {}) {
    try {
      const response = await api.get(`/content/${contentId}/related`, { params });
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  /**
   * Get content by category
   * @param {string} category - Category name
   * @param {Object} params - Query parameters
   * @returns {Promise} API response
   */
  async getContentByCategory(category, params = {}) {
    try {
      const response = await api.get(`/content/category/${category}`, { params });
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  /**
   * Get trending content
   * @param {Object} params - Query parameters
   * @returns {Promise} API response
   */
  async getTrendingContent(params = {}) {
    try {
      const response = await api.get('/content/trending', { params });
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  /**
   * Get recent content
   * @param {Object} params - Query parameters
   * @returns {Promise} API response
   */
  async getRecentContent(params = {}) {
    try {
      const response = await api.get('/content/recent', { params });
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }
}

export default new ContentService();