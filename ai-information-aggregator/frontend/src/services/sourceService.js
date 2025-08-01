import api, { handleApiError } from './api';
import { centralizedApiService } from './centralizedApiService';

const sourceService = {
  // Get all sources - now uses centralized service
  getAllSources: async () => {
    return centralizedApiService.sources.getAll();
  },

  // Get source by ID - now uses centralized service
  getSourceById: async (id) => {
    return centralizedApiService.sources.getById(id);
  },

  // Create new source - now uses centralized service
  createSource: async (sourceData) => {
    return centralizedApiService.sources.create(sourceData);
  },

  // Update source - now uses centralized service
  updateSource: async (id, sourceData) => {
    return centralizedApiService.sources.update(id, sourceData);
  },

  // Delete source - now uses centralized service
  deleteSource: async (id) => {
    return centralizedApiService.sources.delete(id);
  },

  // Update source relevance
  updateRelevance: async (id, score, reason) => {
    try {
      const response = await api.put(`/sources/${id}/relevance`, { score, reason });
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  // Validate URL
  validateUrl: async (url) => {
    try {
      const response = await api.post('/sources/validate-url', { url });
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  // Get URL metadata
  getUrlMetadata: async (url) => {
    try {
      const response = await api.post('/sources/metadata', { url });
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  // Get sources by type
  getSourcesByType: async (type) => {
    try {
      const response = await api.get(`/sources/type/${type}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  // Get sources by category
  getSourcesByCategory: async (category) => {
    try {
      const response = await api.get(`/sources/category/${category}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  // Bulk import sources
  bulkImportSources: async (sources) => {
    try {
      const response = await api.post('/sources/bulk-import', { sources });
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }
};

export default sourceService;