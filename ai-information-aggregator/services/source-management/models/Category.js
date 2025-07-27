const mongoose = require('mongoose');

/**
 * Category Schema
 * Model for source categories with validation and methods
 */
const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Category name is required'],
    unique: true,
    trim: true,
    maxlength: [50, 'Category name cannot exceed 50 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [200, 'Description cannot exceed 200 characters']
  },
  color: {
    type: String,
    default: '#3498db',
    match: [/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Please provide a valid hex color']
  },
  parentCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isSystem: {
    type: Boolean,
    default: false
  },
  sourceCount: {
    type: Number,
    default: 0
  },
  keywords: [{
    type: String,
    trim: true
  }]
}, {
  timestamps: true
});

// Indexes for better query performance
categorySchema.index({ name: 1 });
categorySchema.index({ createdBy: 1 });
categorySchema.index({ parentCategory: 1 });
categorySchema.index({ isSystem: 1 });

/**
 * Find categories by user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} - Array of category documents
 */
categorySchema.statics.findByUser = function(userId) {
  return this.find({ 
    $or: [
      { createdBy: userId },
      { isSystem: true }
    ]
  });
};

/**
 * Find system categories
 * @returns {Promise<Array>} - Array of category documents
 */
categorySchema.statics.findSystemCategories = function() {
  return this.find({ isSystem: true });
};

/**
 * Find categories by parent
 * @param {string} parentId - Parent category ID
 * @returns {Promise<Array>} - Array of category documents
 */
categorySchema.statics.findByParent = function(parentId) {
  return this.find({ parentCategory: parentId });
};

/**
 * Increment source count
 * @returns {Promise<Document>} - Updated category document
 */
categorySchema.methods.incrementSourceCount = function() {
  this.sourceCount += 1;
  return this.save();
};

/**
 * Decrement source count
 * @returns {Promise<Document>} - Updated category document
 */
categorySchema.methods.decrementSourceCount = function() {
  if (this.sourceCount > 0) {
    this.sourceCount -= 1;
  }
  return this.save();
};

// Create model from schema
const Category = mongoose.model('Category', categorySchema);

module.exports = Category;