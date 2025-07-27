const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Transcript Schema
 * Model for podcast episode transcripts
 */
const transcriptSchema = new Schema({
  episodeId: {
    type: Schema.Types.ObjectId,
    ref: 'Episode',
    required: [true, 'Episode ID is required'],
    unique: true,
    index: true
  },
  fullText: {
    type: String,
    required: [true, 'Full transcript text is required']
  },
  segments: [{
    text: {
      type: String,
      required: true
    },
    startTime: {
      type: Number, // in seconds
      required: true,
      min: 0
    },
    endTime: {
      type: Number, // in seconds
      required: true,
      min: 0
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 1
    },
    speaker: {
      type: String,
      default: null
    }
  }],
  language: {
    type: String,
    default: 'en'
  },
  processed: {
    type: Boolean,
    default: false,
    index: true
  },
  references: [{
    type: Schema.Types.ObjectId,
    ref: 'Reference'
  }],
  topics: [{
    type: String,
    trim: true
  }],
  keywords: [{
    type: String,
    trim: true
  }],
  summary: {
    type: String,
    default: null
  },
  metadata: {
    type: Map,
    of: Schema.Types.Mixed,
    default: {}
  },
  processingHistory: [{
    stage: {
      type: String,
      enum: ['transcription', 'analysis', 'reference-extraction', 'summarization'],
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

/**
 * Mark transcript as processed
 * @param {Object} processingDetails - Details about the processing
 * @returns {Promise<Document>} - Updated transcript document
 */
transcriptSchema.methods.markAsProcessed = function(processingDetails = {}) {
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
 * Add reference to transcript
 * @param {string} referenceId - Reference ID
 * @returns {Promise<Document>} - Updated transcript document
 */
transcriptSchema.methods.addReference = function(referenceId) {
  if (!this.references.includes(referenceId)) {
    this.references.push(referenceId);
  }
  
  return this.save();
};

/**
 * Update transcript topics
 * @param {Array} topics - Array of topics
 * @returns {Promise<Document>} - Updated transcript document
 */
transcriptSchema.methods.updateTopics = function(topics) {
  this.topics = topics;
  return this.save();
};

/**
 * Update transcript keywords
 * @param {Array} keywords - Array of keywords
 * @returns {Promise<Document>} - Updated transcript document
 */
transcriptSchema.methods.updateKeywords = function(keywords) {
  this.keywords = keywords;
  return this.save();
};

/**
 * Update transcript summary
 * @param {string} summary - Transcript summary
 * @returns {Promise<Document>} - Updated transcript document
 */
transcriptSchema.methods.updateSummary = function(summary) {
  this.summary = summary;
  return this.save();
};

/**
 * Update transcript metadata
 * @param {Object} metadata - New metadata
 * @returns {Promise<Document>} - Updated transcript document
 */
transcriptSchema.methods.updateMetadata = function(metadata) {
  this.metadata = new Map(Object.entries(metadata));
  return this.save();
};

/**
 * Find unprocessed transcripts
 * @param {number} limit - Maximum number of transcripts to return
 * @returns {Promise<Array>} - Array of transcript documents
 */
transcriptSchema.statics.findUnprocessed = function(limit = 10) {
  return this.find({
    processed: false
  })
    .sort('createdAt')
    .limit(limit);
};

/**
 * Search transcripts by text
 * @param {string} query - Search query
 * @param {number} limit - Maximum number of transcripts to return
 * @returns {Promise<Array>} - Array of transcript documents
 */
transcriptSchema.statics.searchByText = function(query, limit = 10) {
  return this.find({
    $text: { $search: query }
  })
    .sort({ score: { $meta: 'textScore' } })
    .limit(limit);
};

/**
 * Find transcripts by topic
 * @param {string} topic - Topic to search for
 * @param {number} limit - Maximum number of transcripts to return
 * @returns {Promise<Array>} - Array of transcript documents
 */
transcriptSchema.statics.findByTopic = function(topic, limit = 10) {
  return this.find({
    topics: topic
  })
    .sort('-createdAt')
    .limit(limit);
};

// Create text index for full-text search
transcriptSchema.index({ fullText: 'text' });

// Create model from schema
const Transcript = mongoose.model('Transcript', transcriptSchema);

module.exports = Transcript;