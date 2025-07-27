const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Content Metadata Schema
 * Model for managing enhanced content metadata
 */
const contentMetadataSchema = new Schema({
  contentId: {
    type: Schema.Types.ObjectId,
    ref: 'Content',
    required: [true, 'Content ID is required'],
    unique: true,
    index: true
  },
  // Basic metadata
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    index: 'text'
  },
  description: {
    type: String,
    trim: true,
    index: 'text'
  },
  summary: {
    type: String,
    trim: true,
    index: 'text'
  },
  keywords: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  categories: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  topics: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  
  // Content properties
  contentType: {
    type: String,
    enum: ['article', 'video', 'podcast', 'document', 'image', 'webpage', 'academic', 'book', 'other'],
    required: [true, 'Content type is required'],
    index: true
  },
  language: {
    type: String,
    default: 'en',
    index: true
  },
  wordCount: {
    type: Number,
    min: 0
  },
  readingTime: {
    type: Number, // in minutes
    min: 0
  },
  difficulty: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced', 'expert'],
    default: 'intermediate'
  },
  
  // Source information
  source: {
    name: {
      type: String,
      trim: true,
      index: true
    },
    url: {
      type: String,
      trim: true
    },
    domain: {
      type: String,
      trim: true,
      lowercase: true,
      index: true
    },
    credibilityScore: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.5
    },
    authorityScore: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.5
    }
  },
  
  // Author information
  authors: [{
    name: {
      type: String,
      trim: true,
      required: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true
    },
    affiliation: {
      type: String,
      trim: true
    },
    bio: {
      type: String,
      trim: true
    },
    expertise: [{
      type: String,
      trim: true
    }]
  }],
  
  // Publication information
  publishedAt: {
    type: Date,
    index: true
  },
  updatedAt: {
    type: Date,
    index: true
  },
  version: {
    type: String,
    trim: true
  },
  edition: {
    type: String,
    trim: true
  },
  
  // Quality metrics
  qualityScore: {
    type: Number,
    min: 0,
    max: 1,
    default: 0.5
  },
  relevanceScore: {
    type: Number,
    min: 0,
    max: 1,
    default: 0.5
  },
  popularityScore: {
    type: Number,
    min: 0,
    max: 1,
    default: 0.5
  },
  freshnessScore: {
    type: Number,
    min: 0,
    max: 1,
    default: 0.5
  },
  
  // Content structure
  structure: {
    hasImages: {
      type: Boolean,
      default: false
    },
    hasVideos: {
      type: Boolean,
      default: false
    },
    hasAudio: {
      type: Boolean,
      default: false
    },
    hasCode: {
      type: Boolean,
      default: false
    },
    hasTables: {
      type: Boolean,
      default: false
    },
    hasCharts: {
      type: Boolean,
      default: false
    },
    sectionCount: {
      type: Number,
      min: 0,
      default: 0
    },
    headingCount: {
      type: Number,
      min: 0,
      default: 0
    }
  },
  
  // Engagement metrics
  engagement: {
    views: {
      type: Number,
      min: 0,
      default: 0
    },
    likes: {
      type: Number,
      min: 0,
      default: 0
    },
    shares: {
      type: Number,
      min: 0,
      default: 0
    },
    comments: {
      type: Number,
      min: 0,
      default: 0
    },
    saves: {
      type: Number,
      min: 0,
      default: 0
    },
    avgRating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0
    },
    ratingCount: {
      type: Number,
      min: 0,
      default: 0
    }
  },
  
  // Content relationships
  relatedContent: [{
    contentId: {
      type: Schema.Types.ObjectId,
      ref: 'Content',
      required: true
    },
    relationshipType: {
      type: String,
      enum: ['similar', 'sequel', 'prequel', 'reference', 'citation', 'update', 'translation'],
      required: true
    },
    strength: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.5
    }
  }],
  
  // Citations and references
  citations: [{
    title: {
      type: String,
      trim: true,
      required: true
    },
    authors: [{
      type: String,
      trim: true
    }],
    source: {
      type: String,
      trim: true
    },
    year: {
      type: Number,
      min: 1900,
      max: new Date().getFullYear() + 10
    },
    url: {
      type: String,
      trim: true
    },
    doi: {
      type: String,
      trim: true
    }
  }],
  
  // Content aging information
  aging: {
    isOutdated: {
      type: Boolean,
      default: false
    },
    lastReviewedAt: {
      type: Date,
      default: Date.now
    },
    nextReviewAt: {
      type: Date
    },
    outdatedReasons: [{
      type: String,
      enum: ['factual_error', 'deprecated_info', 'broken_links', 'policy_change', 'technology_change', 'other']
    }],
    updateSuggestions: [{
      type: String,
      trim: true
    }]
  },
  
  // Custom metadata fields
  customFields: {
    type: Map,
    of: Schema.Types.Mixed,
    default: {}
  },
  
  // Processing status
  processing: {
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending'
    },
    lastProcessedAt: {
      type: Date
    },
    processingErrors: [{
      type: String,
      trim: true
    }],
    extractedAt: {
      type: Date,
      default: Date.now
    }
  }
}, {
  timestamps: true
});

// Text index for full-text search
contentMetadataSchema.index({
  title: 'text',
  description: 'text',
  summary: 'text',
  keywords: 'text',
  tags: 'text',
  'authors.name': 'text'
});

// Compound indexes for common queries
contentMetadataSchema.index({ contentType: 1, publishedAt: -1 });
contentMetadataSchema.index({ 'source.domain': 1, publishedAt: -1 });
contentMetadataSchema.index({ categories: 1, qualityScore: -1 });
contentMetadataSchema.index({ topics: 1, relevanceScore: -1 });
contentMetadataSchema.index({ 'aging.isOutdated': 1, 'aging.nextReviewAt': 1 });

/**
 * Update engagement metrics
 * @param {Object} metrics - New engagement metrics
 * @returns {Promise<Document>} - Updated metadata document
 */
contentMetadataSchema.methods.updateEngagement = function(metrics) {
  Object.keys(metrics).forEach(key => {
    if (this.engagement[key] !== undefined) {
      this.engagement[key] = metrics[key];
    }
  });
  return this.save();
};

/**
 * Add related content
 * @param {string} contentId - Related content ID
 * @param {string} relationshipType - Type of relationship
 * @param {number} strength - Relationship strength (0-1)
 * @returns {Promise<Document>} - Updated metadata document
 */
contentMetadataSchema.methods.addRelatedContent = function(contentId, relationshipType, strength = 0.5) {
  const existing = this.relatedContent.find(rc => 
    rc.contentId.toString() === contentId.toString()
  );
  
  if (existing) {
    existing.relationshipType = relationshipType;
    existing.strength = strength;
  } else {
    this.relatedContent.push({
      contentId,
      relationshipType,
      strength
    });
  }
  
  return this.save();
};

/**
 * Remove related content
 * @param {string} contentId - Related content ID
 * @returns {Promise<Document>} - Updated metadata document
 */
contentMetadataSchema.methods.removeRelatedContent = function(contentId) {
  this.relatedContent = this.relatedContent.filter(rc => 
    rc.contentId.toString() !== contentId.toString()
  );
  return this.save();
};

/**
 * Add citation
 * @param {Object} citation - Citation data
 * @returns {Promise<Document>} - Updated metadata document
 */
contentMetadataSchema.methods.addCitation = function(citation) {
  this.citations.push(citation);
  return this.save();
};

/**
 * Update quality scores
 * @param {Object} scores - Quality scores
 * @returns {Promise<Document>} - Updated metadata document
 */
contentMetadataSchema.methods.updateQualityScores = function(scores) {
  if (scores.qualityScore !== undefined) this.qualityScore = scores.qualityScore;
  if (scores.relevanceScore !== undefined) this.relevanceScore = scores.relevanceScore;
  if (scores.popularityScore !== undefined) this.popularityScore = scores.popularityScore;
  if (scores.freshnessScore !== undefined) this.freshnessScore = scores.freshnessScore;
  return this.save();
};

/**
 * Mark content as outdated
 * @param {Array} reasons - Reasons for being outdated
 * @param {Array} suggestions - Update suggestions
 * @returns {Promise<Document>} - Updated metadata document
 */
contentMetadataSchema.methods.markOutdated = function(reasons = [], suggestions = []) {
  this.aging.isOutdated = true;
  this.aging.outdatedReasons = reasons;
  this.aging.updateSuggestions = suggestions;
  this.aging.lastReviewedAt = new Date();
  return this.save();
};

/**
 * Mark content as up-to-date
 * @param {Date} nextReviewDate - Next review date
 * @returns {Promise<Document>} - Updated metadata document
 */
contentMetadataSchema.methods.markUpToDate = function(nextReviewDate) {
  this.aging.isOutdated = false;
  this.aging.outdatedReasons = [];
  this.aging.updateSuggestions = [];
  this.aging.lastReviewedAt = new Date();
  this.aging.nextReviewAt = nextReviewDate;
  return this.save();
};

/**
 * Update custom fields
 * @param {Object} fields - Custom fields
 * @returns {Promise<Document>} - Updated metadata document
 */
contentMetadataSchema.methods.updateCustomFields = function(fields) {
  this.customFields = new Map(Object.entries(fields));
  return this.save();
};

/**
 * Find metadata by content type
 * @param {string} contentType - Content type
 * @param {Object} options - Query options
 * @returns {Promise<Array>} - Array of metadata documents
 */
contentMetadataSchema.statics.findByContentType = function(contentType, options = {}) {
  const query = { contentType };
  const { limit = 10, sort = { publishedAt: -1 } } = options;
  
  return this.find(query)
    .sort(sort)
    .limit(limit);
};

/**
 * Find metadata by source domain
 * @param {string} domain - Source domain
 * @param {Object} options - Query options
 * @returns {Promise<Array>} - Array of metadata documents
 */
contentMetadataSchema.statics.findByDomain = function(domain, options = {}) {
  const query = { 'source.domain': domain };
  const { limit = 10, sort = { publishedAt: -1 } } = options;
  
  return this.find(query)
    .sort(sort)
    .limit(limit);
};

/**
 * Find outdated content
 * @param {Object} options - Query options
 * @returns {Promise<Array>} - Array of metadata documents
 */
contentMetadataSchema.statics.findOutdatedContent = function(options = {}) {
  const query = { 'aging.isOutdated': true };
  const { limit = 10, sort = { 'aging.lastReviewedAt': 1 } } = options;
  
  return this.find(query)
    .sort(sort)
    .limit(limit);
};

/**
 * Find content due for review
 * @param {Date} beforeDate - Find content due before this date
 * @returns {Promise<Array>} - Array of metadata documents
 */
contentMetadataSchema.statics.findDueForReview = function(beforeDate = new Date()) {
  return this.find({
    'aging.nextReviewAt': { $lte: beforeDate },
    'aging.isOutdated': false
  }).sort({ 'aging.nextReviewAt': 1 });
};

/**
 * Search metadata with full-text search
 * @param {string} query - Search query
 * @param {Object} filters - Additional filters
 * @param {Object} options - Query options
 * @returns {Promise<Array>} - Array of metadata documents
 */
contentMetadataSchema.statics.searchMetadata = function(query, filters = {}, options = {}) {
  const searchQuery = {
    $text: { $search: query },
    ...filters
  };
  
  const { limit = 10, sort = { score: { $meta: 'textScore' } } } = options;
  
  return this.find(searchQuery, { score: { $meta: 'textScore' } })
    .sort(sort)
    .limit(limit);
};

/**
 * Get content statistics
 * @returns {Promise<Object>} - Content statistics
 */
contentMetadataSchema.statics.getContentStatistics = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalContent: { $sum: 1 },
        avgQualityScore: { $avg: '$qualityScore' },
        avgRelevanceScore: { $avg: '$relevanceScore' },
        outdatedCount: {
          $sum: { $cond: ['$aging.isOutdated', 1, 0] }
        }
      }
    }
  ]);
  
  const typeStats = await this.aggregate([
    {
      $group: {
        _id: '$contentType',
        count: { $sum: 1 }
      }
    }
  ]);
  
  const domainStats = await this.aggregate([
    {
      $group: {
        _id: '$source.domain',
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]);
  
  return {
    overview: stats[0] || {
      totalContent: 0,
      avgQualityScore: 0,
      avgRelevanceScore: 0,
      outdatedCount: 0
    },
    byType: typeStats,
    topDomains: domainStats
  };
};

// Create model from schema
const ContentMetadata = mongoose.model('ContentMetadata', contentMetadataSchema);

module.exports = ContentMetadata;