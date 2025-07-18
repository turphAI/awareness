const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Reference Schema
 * Model for references between content items
 */
const referenceSchema = new Schema({
  sourceContentId: {
    type: Schema.Types.ObjectId,
    ref: 'Content',
    required: [true, 'Source content ID is required'],
    index: true
  },
  referenceType: {
    type: String,
    enum: {
      values: ['citation', 'mention', 'link', 'quote', 'related'],
      message: 'Reference type must be citation, mention, link, quote, or related'
    },
    required: [true, 'Reference type is required'],
    index: true
  },
  title: {
    type: String,
    trim: true
  },
  url: {
    type: String,
    trim: true,
    match: [
      /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/,
      'Please provide a valid URL'
    ]
  },
  authors: [{
    type: String,
    trim: true
  }],
  publishDate: {
    type: Date
  },
  context: {
    type: String,
    maxlength: [1000, 'Context cannot exceed 1000 characters']
  },
  contextLocation: {
    // For text content: paragraph number, sentence number, etc.
    // For audio/video content: timestamp
    value: {
      type: String,
      trim: true
    },
    type: {
      type: String,
      enum: ['timestamp', 'paragraph', 'page', 'section', 'other'],
      default: 'other'
    }
  },
  resolved: {
    type: Boolean,
    default: false,
    index: true
  },
  targetContentId: {
    type: Schema.Types.ObjectId,
    ref: 'Content',
    default: null,
    index: true
  },
  confidence: {
    type: Number,
    min: [0, 'Confidence score must be at least 0'],
    max: [1, 'Confidence score cannot exceed 1'],
    default: 0.5
  },
  extractionMethod: {
    type: String,
    enum: ['automatic', 'manual', 'hybrid'],
    default: 'automatic'
  },
  verificationStatus: {
    type: String,
    enum: ['unverified', 'verified', 'rejected'],
    default: 'unverified'
  },
  metadata: {
    type: Map,
    of: Schema.Types.Mixed,
    default: {}
  },
  // Citation-specific fields
  citationStyle: {
    type: String,
    trim: true
  },
  citationText: {
    type: String,
    trim: true
  },
  doi: {
    type: String,
    trim: true
  },
  // Link-specific fields
  linkText: {
    type: String,
    trim: true
  },
  linkRelation: {
    type: String,
    trim: true
  },
  // Quote-specific fields
  quoteText: {
    type: String,
    trim: true
  },
  // Processing history
  processingHistory: [{
    stage: {
      type: String,
      enum: ['extraction', 'resolution', 'verification'],
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
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
referenceSchema.index({ sourceContentId: 1, url: 1 });
referenceSchema.index({ sourceContentId: 1, targetContentId: 1 });

/**
 * Mark reference as resolved
 * @param {string} targetContentId - Target content ID
 * @param {number} confidence - Confidence score
 * @returns {Promise<Document>} - Updated reference document
 */
referenceSchema.methods.markAsResolved = function(targetContentId, confidence = 1.0) {
  this.resolved = true;
  this.targetContentId = targetContentId;
  this.confidence = confidence;
  
  this.processingHistory.push({
    stage: 'resolution',
    timestamp: new Date(),
    success: true,
    metadata: new Map([['confidence', confidence.toString()]])
  });
  
  return this.save();
};

/**
 * Mark reference as verified
 * @param {boolean} isValid - Whether the reference is valid
 * @returns {Promise<Document>} - Updated reference document
 */
referenceSchema.methods.verify = function(isValid = true) {
  this.verificationStatus = isValid ? 'verified' : 'rejected';
  
  this.processingHistory.push({
    stage: 'verification',
    timestamp: new Date(),
    success: true,
    metadata: new Map([['isValid', isValid.toString()]])
  });
  
  return this.save();
};

/**
 * Update reference metadata
 * @param {Object} metadata - New metadata
 * @returns {Promise<Document>} - Updated reference document
 */
referenceSchema.methods.updateMetadata = function(metadata) {
  this.metadata = new Map(Object.entries(metadata));
  return this.save();
};

/**
 * Record processing error
 * @param {string} stage - Processing stage
 * @param {string} errorMessage - Error message
 * @returns {Promise<Document>} - Updated reference document
 */
referenceSchema.methods.recordError = function(stage, errorMessage) {
  this.processingHistory.push({
    stage,
    timestamp: new Date(),
    success: false,
    error: errorMessage
  });
  
  return this.save();
};

/**
 * Find references by source content
 * @param {string} sourceContentId - Source content ID
 * @returns {Promise<Array>} - Array of reference documents
 */
referenceSchema.statics.findBySourceContent = function(sourceContentId) {
  return this.find({ sourceContentId });
};

/**
 * Find references by target content
 * @param {string} targetContentId - Target content ID
 * @returns {Promise<Array>} - Array of reference documents
 */
referenceSchema.statics.findByTargetContent = function(targetContentId) {
  return this.find({ targetContentId });
};

/**
 * Find unresolved references
 * @param {number} limit - Maximum number of references to return
 * @returns {Promise<Array>} - Array of reference documents
 */
referenceSchema.statics.findUnresolved = function(limit = 100) {
  return this.find({ resolved: false })
    .limit(limit);
};

/**
 * Find references by URL
 * @param {string} url - Reference URL
 * @returns {Promise<Array>} - Array of reference documents
 */
referenceSchema.statics.findByUrl = function(url) {
  return this.find({ url });
};

/**
 * Find references by type
 * @param {string} referenceType - Reference type
 * @returns {Promise<Array>} - Array of reference documents
 */
referenceSchema.statics.findByType = function(referenceType) {
  return this.find({ referenceType });
};

/**
 * Find references by verification status
 * @param {string} status - Verification status
 * @returns {Promise<Array>} - Array of reference documents
 */
referenceSchema.statics.findByVerificationStatus = function(status) {
  return this.find({ verificationStatus: status });
};

// Create model from schema
const Reference = mongoose.model('Reference', referenceSchema);

module.exports = Reference;