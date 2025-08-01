import api, { handleApiError } from './api';

const categoryService = {
  // Get all categories
  getAllCategories: async () => {
    try {
      const response = await api.get('/categories');
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  // Get category by ID
  getCategoryById: async (id) => {
    try {
      const response = await api.get(`/categories/${id}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  // Create new category
  createCategory: async (categoryData) => {
    try {
      const response = await api.post('/categories', categoryData);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  // Update category
  updateCategory: async (id, categoryData) => {
    try {
      const response = await api.put(`/categories/${id}`, categoryData);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  // Delete category
  deleteCategory: async (id) => {
    try {
      const response = await api.delete(`/categories/${id}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  // Get sources in category
  getCategorySources: async (id) => {
    try {
      const response = await api.get(`/categories/${id}/sources`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  // Add source to category
  addSourceToCategory: async (categoryId, sourceId) => {
    try {
      const response = await api.post(`/categories/${categoryId}/sources`, { sourceId });
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  // Remove source from category
  removeSourceFromCategory: async (categoryId, sourceId) => {
    try {
      const response = await api.delete(`/categories/${categoryId}/sources`, { data: { sourceId } });
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  // Get subcategories
  getSubcategories: async (id) => {
    try {
      const response = await api.get(`/categories/${id}/subcategories`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  // Suggest categories for source
  suggestCategories: async (sourceData) => {
    try {
      const response = await api.post('/categories/suggest', sourceData);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }
};

export default categoryService;