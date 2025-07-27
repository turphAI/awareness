import api from './api';

const categoryService = {
  // Get all categories
  getAllCategories: async () => {
    const response = await api.get('/categories');
    return response.data;
  },

  // Get category by ID
  getCategoryById: async (id) => {
    const response = await api.get(`/categories/${id}`);
    return response.data;
  },

  // Create new category
  createCategory: async (categoryData) => {
    const response = await api.post('/categories', categoryData);
    return response.data;
  },

  // Update category
  updateCategory: async (id, categoryData) => {
    const response = await api.put(`/categories/${id}`, categoryData);
    return response.data;
  },

  // Delete category
  deleteCategory: async (id) => {
    const response = await api.delete(`/categories/${id}`);
    return response.data;
  },

  // Get sources in category
  getCategorySources: async (id) => {
    const response = await api.get(`/categories/${id}/sources`);
    return response.data;
  },

  // Add source to category
  addSourceToCategory: async (categoryId, sourceId) => {
    const response = await api.post(`/categories/${categoryId}/sources`, { sourceId });
    return response.data;
  },

  // Remove source from category
  removeSourceFromCategory: async (categoryId, sourceId) => {
    const response = await api.delete(`/categories/${categoryId}/sources`, { data: { sourceId } });
    return response.data;
  },

  // Get subcategories
  getSubcategories: async (id) => {
    const response = await api.get(`/categories/${id}/subcategories`);
    return response.data;
  },

  // Suggest categories for source
  suggestCategories: async (sourceData) => {
    const response = await api.post('/categories/suggest', sourceData);
    return response.data;
  }
};

export default categoryService;