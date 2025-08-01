import api, { handleApiError } from './api';

class CollectionService {
  /**
   * Create a new collection
   * @param {Object} collectionData - Collection data
   * @returns {Promise} API response
   */
  async createCollection(collectionData) {
    try {
      const response = await api.post('/collections', collectionData);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  /**
   * Get user's collections
   * @param {Object} params - Query parameters
   * @returns {Promise} API response
   */
  async getUserCollections(params = {}) {
    try {
      const response = await api.get('/collections', { params });
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  /**
   * Get a specific collection by ID
   * @param {string} collectionId - Collection ID
   * @returns {Promise} API response
   */
  async getCollection(collectionId) {
    try {
      const response = await api.get(`/collections/${collectionId}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  /**
   * Update a collection
   * @param {string} collectionId - Collection ID
   * @param {Object} updateData - Update data
   * @returns {Promise} API response
   */
  async updateCollection(collectionId, updateData) {
    return api.put(`/api/collections/${collectionId}`, updateData);
  }

  /**
   * Delete a collection
   * @param {string} collectionId - Collection ID
   * @returns {Promise} API response
   */
  async deleteCollection(collectionId) {
    return api.delete(`/api/collections/${collectionId}`);
  }

  /**
   * Add content to collection
   * @param {string} collectionId - Collection ID
   * @param {Object} contentData - Content data with contentIds array
   * @returns {Promise} API response
   */
  async addContent(collectionId, contentData) {
    return api.post(`/api/collections/${collectionId}/content`, contentData);
  }

  /**
   * Remove content from collection
   * @param {string} collectionId - Collection ID
   * @param {Object} contentData - Content data with contentIds array
   * @returns {Promise} API response
   */
  async removeContent(collectionId, contentData) {
    return api.delete(`/api/collections/${collectionId}/content`, { data: contentData });
  }

  /**
   * Add collaborator to collection
   * @param {string} collectionId - Collection ID
   * @param {Object} collaboratorData - Collaborator data
   * @returns {Promise} API response
   */
  async addCollaborator(collectionId, collaboratorData) {
    return api.post(`/api/collections/${collectionId}/collaborators`, collaboratorData);
  }

  /**
   * Remove collaborator from collection
   * @param {string} collectionId - Collection ID
   * @param {string} collaboratorUserId - Collaborator user ID
   * @returns {Promise} API response
   */
  async removeCollaborator(collectionId, collaboratorUserId) {
    return api.delete(`/api/collections/${collectionId}/collaborators/${collaboratorUserId}`);
  }

  /**
   * Search collections
   * @param {Object} params - Search parameters
   * @returns {Promise} API response
   */
  async searchCollections(params = {}) {
    return api.get('/api/collections/search', { params });
  }

  /**
   * Get public collections
   * @param {Object} params - Query parameters
   * @returns {Promise} API response
   */
  async getPublicCollections(params = {}) {
    return api.get('/api/collections/public', { params });
  }

  /**
   * Get collections containing specific content
   * @param {string} contentId - Content ID
   * @returns {Promise} API response
   */
  async getCollectionsByContent(contentId) {
    return api.get(`/api/collections/by-content/${contentId}`);
  }

  /**
   * Update collection metadata
   * @param {string} collectionId - Collection ID
   * @param {Object} metadata - Metadata object
   * @returns {Promise} API response
   */
  async updateMetadata(collectionId, metadata) {
    return api.put(`/api/collections/${collectionId}/metadata`, { metadata });
  }

  /**
   * Get featured collections
   * @param {Object} params - Query parameters
   * @returns {Promise} API response
   */
  async getFeaturedCollections(params = {}) {
    return api.get('/api/collections/public', { 
      params: { ...params, featured: true } 
    });
  }

  /**
   * Get popular collections
   * @param {Object} params - Query parameters
   * @returns {Promise} API response
   */
  async getPopularCollections(params = {}) {
    return api.get('/api/collections/public', { 
      params: { ...params, popular: true } 
    });
  }

  /**
   * Duplicate a collection
   * @param {string} collectionId - Collection ID to duplicate
   * @param {Object} newCollectionData - New collection data
   * @returns {Promise} API response
   */
  async duplicateCollection(collectionId, newCollectionData = {}) {
    const originalCollection = await this.getCollection(collectionId);
    const collectionData = originalCollection.data;
    
    const duplicateData = {
      name: newCollectionData.name || `${collectionData.name} (Copy)`,
      description: newCollectionData.description || collectionData.description,
      color: newCollectionData.color || collectionData.color,
      icon: newCollectionData.icon || collectionData.icon,
      tags: newCollectionData.tags || collectionData.tags,
      public: newCollectionData.public !== undefined ? newCollectionData.public : false,
      featured: false // Never duplicate as featured
    };
    
    const newCollection = await this.createCollection(duplicateData);
    
    // Add content if original collection had content
    if (collectionData.contentIds && collectionData.contentIds.length > 0) {
      const contentIds = collectionData.contentIds.map(content => 
        typeof content === 'object' ? content._id : content
      );
      await this.addContent(newCollection.data._id, { contentIds });
    }
    
    return newCollection;
  }

  /**
   * Export collection data
   * @param {string} collectionId - Collection ID
   * @param {string} format - Export format ('json', 'csv')
   * @returns {Promise} API response
   */
  async exportCollection(collectionId, format = 'json') {
    return api.get(`/api/collections/${collectionId}/export`, {
      params: { format },
      responseType: format === 'csv' ? 'blob' : 'json'
    });
  }

  /**
   * Import collection data
   * @param {File} file - File to import
   * @param {Object} options - Import options
   * @returns {Promise} API response
   */
  async importCollection(file, options = {}) {
    const formData = new FormData();
    formData.append('file', file);
    
    Object.keys(options).forEach(key => {
      formData.append(key, options[key]);
    });
    
    return api.post('/api/collections/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  }

  /**
   * Get collection statistics
   * @param {string} collectionId - Collection ID
   * @returns {Promise} API response
   */
  async getCollectionStats(collectionId) {
    return api.get(`/api/collections/${collectionId}/stats`);
  }

  /**
   * Get user's collection statistics
   * @returns {Promise} API response
   */
  async getUserCollectionStats() {
    return api.get('/api/collections/stats');
  }
}

export default new CollectionService();