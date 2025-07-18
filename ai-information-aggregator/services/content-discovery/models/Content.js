const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Content Schema
 * Comprehensive model for content items with rich metadata and relationships
 */
const contentSchema = new Schema({
  sourceId: {
    type: Schema.Types.ObjectId,
    ref: 'Source',
    required: [true, 'Source ID is required']
  },
  url: {
    type: String,
    required: [true, 'URL is required'],
    trim: true,
    index: true,
    match: [
      /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/,
      'Please provide a valid URL'
    ]
  },
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [500, 'Title cannot exceed 500 characters'],
    index: true
  },
  author: {
    type: String,
    trim: true,
    index: true
  },
  publishDate: {
    type: Date,
    index: true
  },
  discoveryDate: {
    type: Date,
    default: Date.now,
    index: true
  },
  type: {
    type: String,
    enum: {
      values: ['article', 'paper', 'podcast', 'video', 'social', 'newsletter', 'book', 'course'],
      message: 'Type must be article, paper, podcast, video, social, newsletter, book, or course'
    },
    required: [true, 'Type is required'],
    index: true
  },
  categories: [{
    type: String,
    trim: true,
    index: true
  }],
  topics: [{
    type: String,
    trim: true,
    index: true
  }],
  relevanceScore: {
    type: Number,
    default: 0.5,
    min: [0, 'Relevance score must be at least 0'],
    max: [1, 'Relevance score cannot exceed 1'],
    index: true
  },
  summary: {
    type: String,
    maxlength: [5000, 'Summary cannot exceed 5000 characters']
  },
  keyInsights: [{
    type: String,
    maxlength: [1000, 'Key insight cannot exceed 1000 characters']
  }],
  fullText: {
    type: String
  },
  references: [{
    type: Schema.Types.ObjectId,
    ref: 'Reference'
  }],
  visualElements: [{
    type: {
      type: String,
      enum: ['image', 'chart', 'diagram', 'table', 'video']
    },
    url: {
      type: String
    },
    description: {
      type: String
    },
    data: {
      type: Schema.Types.Mixed
    }
  }],
  metadata: {
    type: Map,
    of: Schema.Types.Mixed,
    default: {}
  },
  processed: {
    type: Boolean,
    default: false,
    index: true
  },
  outdated: {
    type: Boolean,
    default: false,
    index: true
  },
  readCount: {
    type: Number,
    default: 0
  },
  saveCount: {
    type: Number,
    default: 0
  },
  shareCount: {
    type: Number,
    default: 0
  },
  language: {
    type: String,
    trim: true,
    default: 'en'
  },
  sentiment: {
    type: String,
    enum: ['positive', 'neutral', 'negative', 'mixed'],
    default: 'neutral'
  },
  sentimentScore: {
    type: Number,
    min: -1,
    max: 1,
    default: 0
  },
  readingTime: {
    type: Number, // in minutes
    min: 0
  },
  wordCount: {
    type: Number,
    min: 0
  },
  // Article-specific fields
  articleSection: {
    type: String,
    trim: true
  },
  // Paper-specific fields
  paperAbstract: {
    type: String
  },
  paperDOI: {
    type: String,
    trim: true
  },
  paperCitations: {
    type: Number,
    min: 0,
    default: 0
  },
  paperAuthors: [{
    name: {
      type: String,
      trim: true
    },
    affiliation: {
      type: String,
      trim: true
    },
    email: {
      type: String,
      trim: true
    }
  }],
  // Podcast-specific fields
  podcastEpisodeNumber: {
    type: Number,
    min: 0
  },
  podcastDuration: {
    type: Number, // in seconds
    min: 0
  },
  podcastTranscript: {
    type: String
  },
  // Video-specific fields
  videoDuration: {
    type: Number, // in seconds
    min: 0
  },
  videoTranscript: {
    type: String
  },
  // Social-specific fields
  socialPlatform: {
    type: String,
    trim: true
  },
  socialUsername: {
    type: String,
    trim: true
  },
  socialLikes: {
    type: Number,
    min: 0,
    default: 0
  },
  socialShares: {
    type: Number,
    min: 0,
    default: 0
  },
  socialComments: {
    type: Number,
    min: 0,
    default: 0
  },
  // User interaction tracking
  userInteractions: [{
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    interactionType: {
      type: String,
      enum: ['view', 'save', 'share', 'dismiss'],
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    metadata: {
      type: Map,
      of: String
    }
  }],
  // Content quality assessment
  qualityScore: {
    type: Number,
    min: 0,
    max: 1,
    default: 0.5
  },
  qualityFactors: {
    credibility: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.5
    },
    readability: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.5
    },
    originality: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.5
    },
    depth: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.5
    }
  },
  // Processing history
  processingHistory: [{
    stage: {
      type: String,
      enum: ['discovery', 'extraction', 'analysis', 'summarization', 'categorization'],
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    duration: {
      type: Number, // in milliseconds
      min: 0
    },
    success: {
      type: Boolean,
      default: true
    },
    error: {
      type: String
    },
    metadata: {
      type: Map,
      of: Schema.Types.Mixed
    }
  }]
}, {
  timestamps: true
});

// Compound indexes for better query performance
contentSchema.index({ sourceId: 1, url: 1 }, { unique: true });
contentSchema.index({ type: 1, categories: 1 });
contentSchema.index({ type: 1, topics: 1 });
contentSchema.index({ publishDate: -1, relevanceScore: -1 });
contentSchema.index({ 'userInteractions.userId': 1, 'userInteractions.interactionType': 1 });

/**
 * Calculate reading time based on word count
 * @returns {number} - Reading time in minutes
 */
contentSchema.methods.calculateReadingTime = function() {
  if (!this.wordCount) {
    return null;
  }
  
  // Average reading speed: 200-250 words per minute
  const wordsPerMinute = 225;
  this.readingTime = Math.ceil(this.wordCount / wordsPerMinute);
  return this.readingTime;
};

/**
 * Mark content as processed
 * @param {Object} processingDetails - Details about the processing
 * @returns {Promise<Document>} - Updated content document
 */
contentSchema.methods.markAsProcessed = function(processingDetails = {}) {
  this.processed = true;
  
  if (processingDetails.stage) {
    this.processingHistory.push({
      stage: processingDetails.stage,
      duration: processingDetails.duration,
      success: processingDetails.success !== false,
      error: processingDetails.error,
      metadata: processingDetails.metadata
    });
  }
  
  return this.save();
};

/**
 * Mark content as outdated
 * @returns {Promise<Document>} - Updated content document
 */
contentSchema.methods.markAsOutdated = function() {
  this.outdated = true;
  return this.save();
};

/**
 * Update relevance score
 * @param {number} score - New relevance score
 * @returns {Promise<Document>} - Updated content document
 */
contentSchema.methods.updateRelevance = function(score) {
  this.relevanceScore = score;
  return this.save();
};

/**
 * Add user interaction
 * @param {string} userId - User ID
 * @param {string} interactionType - Type of interaction
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<Document>} - Updated content document
 */
contentSchema.methods.addUserInteraction = function(userId, interactionType, metadata = {}) {
  this.userInteractions.push({
    userId,
    interactionType,
    timestamp: new Date(),
    metadata: new Map(Object.entries(metadata))
  });
  
  // Update interaction counts
  if (interactionType === 'view') {
    this.readCount += 1;
  } else if (interactionType === 'save') {
    this.saveCount += 1;
  } else if (interactionType === 'share') {
    this.shareCount += 1;
  }
  
  return this.save();
};

/**
 * Update content quality assessment
 * @param {Object} qualityFactors - Quality assessment factors
 * @returns {Promise<Document>} - Updated content document
 */
contentSchema.methods.updateQualityAssessment = function(qualityFactors) {
  this.qualityFactors = {
    ...this.qualityFactors,
    ...qualityFactors
  };
  
  // Calculate overall quality score as average of factors
  const factors = Object.values(this.qualityFactors);
  this.qualityScore = factors.reduce((sum, factor) => sum + factor, 0) / factors.length;
  
  return this.save();
};

/**
 * Find content by source
 * @param {string} sourceId - Source ID
 * @returns {Promise<Array>} - Array of content documents
 */
contentSchema.statics.findBySource = function(sourceId) {
  return this.find({ sourceId, processed: true });
};

/**
 * Find content by type
 * @param {string} type - Content type
 * @returns {Promise<Array>} - Array of content documents
 */
contentSchema.statics.findByType = function(type) {
  return this.find({ type, processed: true });
};

/**
 * Find content by topic
 * @param {string} topic - Topic name
 * @returns {Promise<Array>} - Array of content documents
 */
contentSchema.statics.findByTopic = function(topic) {
  return this.find({ topics: topic, processed: true });
};

/**
 * Find recent content
 * @param {number} limit - Maximum number of items to return
 * @returns {Promise<Array>} - Array of content documents
 */
contentSchema.statics.findRecentContent = function(limit = 10) {
  return this.find({ processed: true })
    .sort({ publishDate: -1 })
    .limit(limit);
};

/**
 * Find relevant content
 * @param {number} limit - Maximum number of items to return
 * @returns {Promise<Array>} - Array of content documents
 */
contentSchema.statics.findRelevantContent = function(limit = 10) {
  return this.find({ processed: true })
    .sort({ relevanceScore: -1 })
    .limit(limit);
};

/**
 * Find popular content
 * @param {number} limit - Maximum number of items to return
 * @returns {Promise<Array>} - Array of content documents
 */
contentSchema.statics.findPopularContent = function(limit = 10) {
  return this.find({ processed: true })
    .sort({ readCount: -1, saveCount: -1, shareCount: -1 })
    .limit(limit);
};

/**
 * Find content by user interaction
 * @param {string} userId - User ID
 * @param {string} interactionType - Type of interaction
 * @returns {Promise<Array>} - Array of content documents
 */
contentSchema.statics.findByUserInteraction = function(userId, interactionType) {
  return this.find({
    'userInteractions': {
      $elemMatch: {
        userId,
        interactionType
      }
    }
  });
};

/**
 * Search content by text
 * @param {string} query - Search query
 * @param {number} limit - Maximum number of items to return
 * @returns {Promise<Array>} - Array of content documents
 */
contentSchema.statics.searchContent = function(query, limit = 10) {
  return this.find({
    $or: [
      { title: { $regex: query, $options: 'i' } },
      { summary: { $regex: query, $options: 'i' } },
      { keyInsights: { $elemMatch: { $regex: query, $options: 'i' } } }
    ],
    processed: true
  }).limit(limit);
};

/**
 * Find related content
 * @param {string} contentId - Content ID
 * @param {number} limit - Maximum number of items to return
 * @returns {Promise<Array>} - Array of content documents
 */
contentSchema.statics.findRelatedContent = async function(contentId, limit = 5) {
  const content = await this.findById(contentId);
  
  if (!content) {
    return [];
  }
  
  return this.find({
    _id: { $ne: contentId },
    $or: [
      { topics: { $in: content.topics } },
      { categories: { $in: content.categories } }
    ],
    processed: true
  })
    .sort({ relevanceScore: -1 })
    .limit(limit);
};

// Create model from schema
const Content = mongoose.model('Content', contentSchema);

module.exports = Content;