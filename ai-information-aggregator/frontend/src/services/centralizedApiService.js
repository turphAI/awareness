import { apiService, handleApiError, tokenManager, loadingManager } from './api';

/**
 * Centralized API Service for all backend calls
 * Provides consistent error handling, loading states, and authentication
 */
class CentralizedApiService {
  constructor() {
    this.apiService = apiService;
    this.loadingManager = loadingManager;
  }

  // Authentication Services
  auth = {
    login: async (credentials) => {
      try {
        const response = await this.apiService.post('/auth/login', credentials);
        const { token, user } = response;
        
        if (token) {
          tokenManager.setToken(token);
        }
        
        return { token, user };
      } catch (error) {
        throw new Error(handleApiError(error));
      }
    },

    register: async (userData) => {
      try {
        const response = await this.apiService.post('/auth/register', userData);
        const { token, user } = response;
        
        if (token) {
          tokenManager.setToken(token);
        }
        
        return { token, user };
      } catch (error) {
        throw new Error(handleApiError(error));
      }
    },

    logout: async () => {
      try {
        await this.apiService.post('/auth/logout');
      } catch (error) {
        console.error('Logout API call failed:', error);
      } finally {
        tokenManager.removeToken();
      }
    },

    getCurrentUser: async () => {
      try {
        const response = await this.apiService.get('/auth/profile');
        return response.user;
      } catch (error) {
        throw new Error(handleApiError(error));
      }
    },

    updateProfile: async (profileData) => {
      try {
        const response = await this.apiService.put('/auth/profile', profileData);
        return response.user;
      } catch (error) {
        throw new Error(handleApiError(error));
      }
    },

    changePassword: async (passwordData) => {
      try {
        const response = await this.apiService.put('/auth/change-password', passwordData);
        return response;
      } catch (error) {
        throw new Error(handleApiError(error));
      }
    },

    requestPasswordReset: async (email) => {
      try {
        const response = await this.apiService.post('/auth/forgot-password', { email });
        return response;
      } catch (error) {
        throw new Error(handleApiError(error));
      }
    },

    resetPassword: async (resetData) => {
      try {
        const response = await this.apiService.post('/auth/reset-password', resetData);
        return response;
      } catch (error) {
        throw new Error(handleApiError(error));
      }
    },

    isAuthenticated: () => {
      return !!tokenManager.getToken() && tokenManager.isTokenValid();
    }
  };

  // Source Management Services
  sources = {
    getAll: async () => {
      try {
        const response = await this.apiService.get('/sources');
        return response;
      } catch (error) {
        throw new Error(handleApiError(error));
      }
    },

    getById: async (id) => {
      try {
        const response = await this.apiService.get(`/sources/${id}`);
        return response;
      } catch (error) {
        throw new Error(handleApiError(error));
      }
    },

    create: async (sourceData) => {
      try {
        const response = await this.apiService.post('/sources', sourceData);
        return response;
      } catch (error) {
        throw new Error(handleApiError(error));
      }
    },

    update: async (id, sourceData) => {
      try {
        const response = await this.apiService.put(`/sources/${id}`, sourceData);
        return response;
      } catch (error) {
        throw new Error(handleApiError(error));
      }
    },

    delete: async (id) => {
      try {
        const response = await this.apiService.delete(`/sources/${id}`);
        return response;
      } catch (error) {
        throw new Error(handleApiError(error));
      }
    },

    updateRelevance: async (id, score, reason) => {
      try {
        const response = await this.apiService.put(`/sources/${id}/relevance`, { score, reason });
        return response;
      } catch (error) {
        throw new Error(handleApiError(error));
      }
    },

    validateUrl: async (url) => {
      try {
        const response = await this.apiService.post('/sources/validate-url', { url });
        return response;
      } catch (error) {
        throw new Error(handleApiError(error));
      }
    },

    getMetadata: async (url) => {
      try {
        const response = await this.apiService.post('/sources/metadata', { url });
        return response;
      } catch (error) {
        throw new Error(handleApiError(error));
      }
    },

    getByType: async (type) => {
      try {
        const response = await this.apiService.get(`/sources/type/${type}`);
        return response;
      } catch (error) {
        throw new Error(handleApiError(error));
      }
    },

    getByCategory: async (category) => {
      try {
        const response = await this.apiService.get(`/sources/category/${category}`);
        return response;
      } catch (error) {
        throw new Error(handleApiError(error));
      }
    },

    bulkImport: async (sources) => {
      try {
        const response = await this.apiService.post('/sources/bulk-import', { sources });
        return response;
      } catch (error) {
        throw new Error(handleApiError(error));
      }
    }
  };

  // Content Services
  content = {
    getById: async (contentId) => {
      try {
        const response = await this.apiService.get(`/content/${contentId}`);
        return response;
      } catch (error) {
        throw new Error(handleApiError(error));
      }
    },

    search: async (params = {}) => {
      try {
        const response = await this.apiService.get('/content/search', params);
        return response;
      } catch (error) {
        throw new Error(handleApiError(error));
      }
    },

    getUserContent: async (params = {}) => {
      try {
        const response = await this.apiService.get('/content', params);
        return response;
      } catch (error) {
        throw new Error(handleApiError(error));
      }
    },

    create: async (contentData) => {
      try {
        const response = await this.apiService.post('/content', contentData);
        return response;
      } catch (error) {
        throw new Error(handleApiError(error));
      }
    },

    update: async (contentId, updateData) => {
      try {
        const response = await this.apiService.put(`/content/${contentId}`, updateData);
        return response;
      } catch (error) {
        throw new Error(handleApiError(error));
      }
    },

    delete: async (contentId) => {
      try {
        const response = await this.apiService.delete(`/content/${contentId}`);
        return response;
      } catch (error) {
        throw new Error(handleApiError(error));
      }
    },

    getMetadata: async (contentId) => {
      try {
        const response = await this.apiService.get(`/content/${contentId}/metadata`);
        return response;
      } catch (error) {
        throw new Error(handleApiError(error));
      }
    },

    getRelated: async (contentId, params = {}) => {
      try {
        const response = await this.apiService.get(`/content/${contentId}/related`, params);
        return response;
      } catch (error) {
        throw new Error(handleApiError(error));
      }
    },

    getByCategory: async (category, params = {}) => {
      try {
        const response = await this.apiService.get(`/content/category/${category}`, params);
        return response;
      } catch (error) {
        throw new Error(handleApiError(error));
      }
    },

    getTrending: async (params = {}) => {
      try {
        const response = await this.apiService.get('/content/trending', params);
        return response;
      } catch (error) {
        throw new Error(handleApiError(error));
      }
    },

    getRecent: async (params = {}) => {
      try {
        const response = await this.apiService.get('/content/recent', params);
        return response;
      } catch (error) {
        throw new Error(handleApiError(error));
      }
    }
  };

  // Category Services
  categories = {
    getAll: async () => {
      try {
        const response = await this.apiService.get('/categories');
        return response;
      } catch (error) {
        throw new Error(handleApiError(error));
      }
    },

    getById: async (id) => {
      try {
        const response = await this.apiService.get(`/categories/${id}`);
        return response;
      } catch (error) {
        throw new Error(handleApiError(error));
      }
    },

    create: async (categoryData) => {
      try {
        const response = await this.apiService.post('/categories', categoryData);
        return response;
      } catch (error) {
        throw new Error(handleApiError(error));
      }
    },

    update: async (id, categoryData) => {
      try {
        const response = await this.apiService.put(`/categories/${id}`, categoryData);
        return response;
      } catch (error) {
        throw new Error(handleApiError(error));
      }
    },

    delete: async (id) => {
      try {
        const response = await this.apiService.delete(`/categories/${id}`);
        return response;
      } catch (error) {
        throw new Error(handleApiError(error));
      }
    },

    getSources: async (id) => {
      try {
        const response = await this.apiService.get(`/categories/${id}/sources`);
        return response;
      } catch (error) {
        throw new Error(handleApiError(error));
      }
    },

    addSource: async (categoryId, sourceId) => {
      try {
        const response = await this.apiService.post(`/categories/${categoryId}/sources`, { sourceId });
        return response;
      } catch (error) {
        throw new Error(handleApiError(error));
      }
    },

    removeSource: async (categoryId, sourceId) => {
      try {
        const response = await this.apiService.delete(`/categories/${categoryId}/sources`, { sourceId });
        return response;
      } catch (error) {
        throw new Error(handleApiError(error));
      }
    },

    getSubcategories: async (id) => {
      try {
        const response = await this.apiService.get(`/categories/${id}/subcategories`);
        return response;
      } catch (error) {
        throw new Error(handleApiError(error));
      }
    },

    suggest: async (sourceData) => {
      try {
        const response = await this.apiService.post('/categories/suggest', sourceData);
        return response;
      } catch (error) {
        throw new Error(handleApiError(error));
      }
    }
  };

  // Collection Services
  collections = {
    create: async (collectionData) => {
      try {
        const response = await this.apiService.post('/collections', collectionData);
        return response;
      } catch (error) {
        throw new Error(handleApiError(error));
      }
    },

    getUserCollections: async (params = {}) => {
      try {
        const response = await this.apiService.get('/collections', params);
        return response;
      } catch (error) {
        throw new Error(handleApiError(error));
      }
    },

    getById: async (collectionId) => {
      try {
        const response = await this.apiService.get(`/collections/${collectionId}`);
        return response;
      } catch (error) {
        throw new Error(handleApiError(error));
      }
    },

    update: async (collectionId, updateData) => {
      try {
        const response = await this.apiService.put(`/collections/${collectionId}`, updateData);
        return response;
      } catch (error) {
        throw new Error(handleApiError(error));
      }
    },

    delete: async (collectionId) => {
      try {
        const response = await this.apiService.delete(`/collections/${collectionId}`);
        return response;
      } catch (error) {
        throw new Error(handleApiError(error));
      }
    },

    addContent: async (collectionId, contentData) => {
      try {
        const response = await this.apiService.post(`/collections/${collectionId}/content`, contentData);
        return response;
      } catch (error) {
        throw new Error(handleApiError(error));
      }
    },

    removeContent: async (collectionId, contentData) => {
      try {
        const response = await this.apiService.delete(`/collections/${collectionId}/content`, contentData);
        return response;
      } catch (error) {
        throw new Error(handleApiError(error));
      }
    },

    search: async (params = {}) => {
      try {
        const response = await this.apiService.get('/collections/search', params);
        return response;
      } catch (error) {
        throw new Error(handleApiError(error));
      }
    },

    getPublic: async (params = {}) => {
      try {
        const response = await this.apiService.get('/collections/public', params);
        return response;
      } catch (error) {
        throw new Error(handleApiError(error));
      }
    },

    export: async (collectionId, format = 'json') => {
      try {
        const response = await this.apiService.get(`/collections/${collectionId}/export`, 
          { format }, 
          { responseType: format === 'csv' ? 'blob' : 'json' }
        );
        return response;
      } catch (error) {
        throw new Error(handleApiError(error));
      }
    },

    import: async (file, options = {}) => {
      try {
        const response = await this.apiService.upload('/collections/import', file);
        return response;
      } catch (error) {
        throw new Error(handleApiError(error));
      }
    }
  };

  // Configuration Services
  configuration = {
    getTopicPreferences: async () => {
      try {
        const response = await this.apiService.get('/configuration/topic-preferences');
        return response;
      } catch (error) {
        throw new Error(handleApiError(error));
      }
    },

    updateTopicPreferences: async (preferences) => {
      try {
        const response = await this.apiService.put('/configuration/topic-preferences', preferences);
        return response;
      } catch (error) {
        throw new Error(handleApiError(error));
      }
    },

    getNotificationSettings: async () => {
      try {
        const response = await this.apiService.get('/configuration/notification-settings');
        return response;
      } catch (error) {
        throw new Error(handleApiError(error));
      }
    },

    updateNotificationSettings: async (settings) => {
      try {
        const response = await this.apiService.put('/configuration/notification-settings', settings);
        return response;
      } catch (error) {
        throw new Error(handleApiError(error));
      }
    },

    getContentVolumeSettings: async () => {
      try {
        const response = await this.apiService.get('/configuration/content-volume');
        return response;
      } catch (error) {
        throw new Error(handleApiError(error));
      }
    },

    updateContentVolumeSettings: async (settings) => {
      try {
        const response = await this.apiService.put('/configuration/content-volume', settings);
        return response;
      } catch (error) {
        throw new Error(handleApiError(error));
      }
    },

    getDiscoverySettings: async () => {
      try {
        const response = await this.apiService.get('/configuration/discovery-settings');
        return response;
      } catch (error) {
        throw new Error(handleApiError(error));
      }
    },

    updateDiscoverySettings: async (settings) => {
      try {
        const response = await this.apiService.put('/configuration/discovery-settings', settings);
        return response;
      } catch (error) {
        throw new Error(handleApiError(error));
      }
    },

    getSummaryPreferences: async () => {
      try {
        const response = await this.apiService.get('/configuration/summary-preferences');
        return response;
      } catch (error) {
        throw new Error(handleApiError(error));
      }
    },

    updateSummaryPreferences: async (preferences) => {
      try {
        const response = await this.apiService.put('/configuration/summary-preferences', preferences);
        return response;
      } catch (error) {
        throw new Error(handleApiError(error));
      }
    },

    getDigestScheduling: async () => {
      try {
        const response = await this.apiService.get('/configuration/digest-scheduling');
        return response;
      } catch (error) {
        throw new Error(handleApiError(error));
      }
    },

    updateDigestScheduling: async (scheduling) => {
      try {
        const response = await this.apiService.put('/configuration/digest-scheduling', scheduling);
        return response;
      } catch (error) {
        throw new Error(handleApiError(error));
      }
    },

    getAllSettings: async () => {
      try {
        const requests = [
          { method: 'GET', url: '/configuration/topic-preferences' },
          { method: 'GET', url: '/configuration/notification-settings' },
          { method: 'GET', url: '/configuration/content-volume' },
          { method: 'GET', url: '/configuration/discovery-settings' },
          { method: 'GET', url: '/configuration/summary-preferences' },
          { method: 'GET', url: '/configuration/digest-scheduling' }
        ];

        const results = await this.apiService.batch(requests);
        
        return {
          topicPreferences: results[0].error ? null : results[0],
          notificationSettings: results[1].error ? null : results[1],
          contentVolumeSettings: results[2].error ? null : results[2],
          discoverySettings: results[3].error ? null : results[3],
          summaryPreferences: results[4].error ? null : results[4],
          digestScheduling: results[5].error ? null : results[5]
        };
      } catch (error) {
        throw new Error(handleApiError(error));
      }
    }
  };

  // Utility methods
  utils = {
    healthCheck: async () => {
      return this.apiService.healthCheck();
    },

    isLoading: (key) => {
      return this.loadingManager.isLoading(key);
    },

    subscribeToLoading: (callback) => {
      return this.loadingManager.subscribe(callback);
    },

    getLoadingStates: () => {
      return this.loadingManager.loadingStates;
    }
  };
}

// Create and export singleton instance
export const centralizedApiService = new CentralizedApiService();
export default centralizedApiService;