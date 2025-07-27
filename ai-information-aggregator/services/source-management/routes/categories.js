const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { validateCategory, validateCategorySuggestion } = require('../middleware/validation');
const { authenticate } = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(authenticate);

// Get all categories for the authenticated user
router.get('/', categoryController.getAllCategories);

// Create default system categories (admin only)
router.post('/defaults', categoryController.createDefaultCategories);

// Suggest categories for a source
router.post('/suggest', validateCategorySuggestion, categoryController.suggestCategories);

// Get subcategories
router.get('/:id/subcategories', categoryController.getSubcategories);

// Get sources in a category
router.get('/:id/sources', categoryController.getCategorySources);

// Add source to category
router.post('/:id/sources', categoryController.addSourceToCategory);

// Remove source from category
router.delete('/:id/sources', categoryController.removeSourceFromCategory);

// Get a specific category by ID
router.get('/:id', categoryController.getCategoryById);

// Create a new category
router.post('/', validateCategory, categoryController.createCategory);

// Update a category
router.put('/:id', validateCategory, categoryController.updateCategory);

// Delete a category
router.delete('/:id', categoryController.deleteCategory);

module.exports = router;