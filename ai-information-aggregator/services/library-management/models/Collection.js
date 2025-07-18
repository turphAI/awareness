const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Collection Schema
 * Model for user-organized content collections
 */
const collectionSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  name: {
    type: String,
    required: [true, 'Collection name is required'],
    trim: true,
    maxlength: [100, 'Collection name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Collection description cannot exceed 500 characters']
  },
  contentIds: [{
    type: Schema.Types.ObjectId,
    ref: 'Content'
  }],
  public: {
    type: Boolean,
    default: false
  },
  featured: {
    type: Boolean,
    default: false
  },
  color: {
    type: String,
    default: '#3498db', // Default blue color
    match: [/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Please provide a valid hex color']
  },
  icon: {
    type: String,
    default: 'folder'
  },
  tags: [{
    type: String,
    trim: true
  }],
  parent: {
    type: Schema.Types.ObjectId,
    ref: 'Collection',
    default: null
  },
  sortOrder: {
    type: Number,
    default: 0
  },
  viewCount: {
    type: Number,
    default: 0
  },
  lastViewed: {
    type: Date,
    default: null
  },
  collaborators: [{
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['viewer', 'editor', 'admin'],
      default: 'viewer'
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  metadata: {
    type: Map,
    of: Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Compound indexes for better query performance
collectionSchema.index({ userId: 1, name: 1 }, { unique: true });
collectionSchema.index({ 'collaborators.userId': 1 });
collectionSchema.index({ public: 1, featured: 1 });

/**
 * Add content to collection
 * @param {string|Array} contentId - Content ID or array of content IDs
 * @returns {Promise<Document>} - Updated collection document
 */
collectionSchema.methods.addContent = function(contentId) {
  if (Array.isArray(contentId)) {
    // Filter out duplicates
    const newContentIds = contentId.filter(id => 
      !this.contentIds.some(existingId => existingId.toString() === id.toString())
    );
    this.contentIds.push(...newContentIds);
  } else if (!this.contentIds.some(id => id.toString() === contentId.toString())) {
    this.contentIds.push(contentId);
  }
  
  return this.save();
};

/**
 * Remove content from collection
 * @param {string|Array} contentId - Content ID or array of content IDs
 * @returns {Promise<Document>} - Updated collection document
 */
collectionSchema.methods.removeContent = function(contentId) {
  if (Array.isArray(contentId)) {
    this.contentIds = this.contentIds.filter(id => 
      !contentId.some(removeId => removeId.toString() === id.toString())
    );
  } else {
    this.contentIds = this.contentIds.filter(id => id.toString() !== contentId.toString());
  }
  
  return this.save();
};

/**
 * Record collection view
 * @returns {Promise<Document>} - Updated collection document
 */
collectionSchema.methods.recordView = function() {
  this.viewCount += 1;
  this.lastViewed = new Date();
  return this.save();
};

/**
 * Add collaborator to collection
 * @param {string} userId - User ID
 * @param {string} role - Collaborator role
 * @returns {Promise<Document>} - Updated collection document
 */
collectionSchema.methods.addCollaborator = function(userId, role = 'viewer') {
  const existingCollaborator = this.collaborators.find(c => 
    c.userId.toString() === userId.toString()
  );
  
  if (existingCollaborator) {
    existingCollaborator.role = role;
  } else {
    this.collaborators.push({
      userId,
      role,
      addedAt: new Date()
    });
  }
  
  return this.save();
};

/**
 * Remove collaborator from collection
 * @param {string} userId - User ID
 * @returns {Promise<Document>} - Updated collection document
 */
collectionSchema.methods.removeCollaborator = function(userId) {
  this.collaborators = this.collaborators.filter(c => 
    c.userId.toString() !== userId.toString()
  );
  
  return this.save();
};

/**
 * Update collection metadata
 * @param {Object} metadata - New metadata
 * @returns {Promise<Document>} - Updated collection document
 */
collectionSchema.methods.updateMetadata = function(metadata) {
  this.metadata = new Map(Object.entries(metadata));
  return this.save();
};

/**
 * Find collections by user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} - Array of collection documents
 */
collectionSchema.statics.findByUser = function(userId) {
  return this.find({ userId });
};

/**
 * Find collections by content
 * @param {string} contentId - Content ID
 * @returns {Promise<Array>} - Array of collection documents
 */
collectionSchema.statics.findByContent = function(contentId) {
  return this.find({ contentIds: contentId });
};

/**
 * Find collections by collaborator
 * @param {string} userId - User ID
 * @returns {Promise<Array>} - Array of collection documents
 */
collectionSchema.statics.findByCollaborator = function(userId) {
  return this.find({ 'collaborators.userId': userId });
};

/**
 * Find public collections
 * @param {number} limit - Maximum number of collections to return
 * @returns {Promise<Array>} - Array of collection documents
 */
collectionSchema.statics.findPublicCollections = function(limit = 10) {
  return this.find({ public: true })
    .sort({ featured: -1, viewCount: -1 })
    .limit(limit);
};

/**
 * Find featured collections
 * @param {number} limit - Maximum number of collections to return
 * @returns {Promise<Array>} - Array of collection documents
 */
collectionSchema.statics.findFeaturedCollections = function(limit = 10) {
  return this.find({ public: true, featured: true })
    .sort({ viewCount: -1 })
    .limit(limit);
};

/**
 * Find popular collections
 * @param {number} limit - Maximum number of collections to return
 * @returns {Promise<Array>} - Array of collection documents
 */
collectionSchema.statics.findPopularCollections = function(limit = 10) {
  return this.find({ public: true })
    .sort({ viewCount: -1 })
    .limit(limit);
};

/**
 * Search collections by name or description
 * @param {string} query - Search query
 * @param {boolean} includePrivate - Whether to include private collections
 * @param {string} userId - User ID for private collections
 * @returns {Promise<Array>} - Array of collection documents
 */
collectionSchema.statics.searchCollections = function(query, includePrivate = false, userId = null) {
  const searchQuery = {
    $or: [
      { name: { $regex: query, $options: 'i' } },
      { description: { $regex: query, $options: 'i' } },
      { tags: { $in: [new RegExp(query, 'i')] } }
    ]
  };
  
  if (!includePrivate) {
    searchQuery.public = true;
  } else if (userId) {
    searchQuery.$or = [
      { public: true },
      { userId },
      { 'collaborators.userId': userId }
    ];
  }
  
  return this.find(searchQuery);
};

// Create model from schema
const Collection = mongoose.model('Collection', collectionSchema);

module.exports = Collection;