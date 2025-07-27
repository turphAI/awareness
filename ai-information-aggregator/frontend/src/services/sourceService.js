import api from './api';

const sourceService = {
  // Get all sources
  getAllSources: async () => {
    const response = await api.get('/sources');
    return response.data;
  },

  // Get source by ID
  getSourceById: async (id) => {
    const response = await api.get(`/sources/${id}`);
    return response.data;
  },

  // Create new source
  createSource: async (sourceData) => {
    const response = await api.post('/sources', sourceData);
    return response.data;
  },

  // Update source
  updateSource: async (id, sourceData) => {
    const response = await api.put(`/sources/${id}`, sourceData);
    return response.data;
  },

  // Delete source
  deleteSource: async (id) => {
    const response = await api.delete(`/sources/${id}`);
    return response.data;
  },

  // Update source relevance
  updateRelevance: async (id, score, reason) => {
    const response = await api.put(`/sources/${id}/relevance`, { score, reason });
    return response.data;
  },

  // Validate URL
  validateUrl: async (url) => {
    const response = await api.post('/sources/validate-url', { url });
    return response.data;
  },

  // Get URL metadata
  getUrlMetadata: async (url) => {
    const response = await api.post('/sources/metadata', { url });
    return response.data;
  },

  // Get sources by type
  getSourcesByType: async (type) => {
    const response = await api.get(`/sources/type/${type}`);
    return response.data;
  },

  // Get sources by category
  getSourcesByCategory: async (category) => {
    const response = await api.get(`/sources/category/${category}`);
    return response.data;
  },

  // Bulk import sources
  bulkImportSources: async (sources) => {
    const response = await api.post('/sources/bulk-import', { sources });
    return response.data;
  }
};

export default sourceService;