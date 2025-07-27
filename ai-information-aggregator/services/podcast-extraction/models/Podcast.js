const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Podcast Schema
 * Model for podcast feeds
 */
const podcastSchema = new Schema({
  sourceId: {
    type: Schema.Types.ObjectId,
    ref: 'Source',
    required: [true, 'Source ID is required']
  },
  title: {
    type: String,
    required: [true, 'Podcast title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  author: {
    type: String,
    trim: true
  },
  feedUrl: {
    type: String,
    required: [true, 'Feed URL is required'],
    trim: true,
    unique: true,
    match: [
      /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/,
      'Please provide a valid URL'
    ]
  },
  websiteUrl: {
    type: String,
    trim: true,
    match: [
      /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/,
      'Please provide a valid URL'
    ]
  },
  imageUrl: {
    type: String,
    trim: true,
    match: [
      /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/,
      'Please provide a valid URL'
    ]
  },
  categories: [{
    type: String,
    trim: true
  }],
  language: {
    type: String,
    trim: true,
    default: 'en'
  },
  explicit: {
    type: Boolean,
    default: false
  },
  lastChecked: {
    type: Date,
    default: null
  },
  lastUpdated: {
    type: Date,
    default: null
  },
  active: {
    type: Boolean,
    default: true
  },
  checkFrequency: {
    type: String,
    enum: {
      values: ['hourly', 'daily', 'weekly'],
      message: 'Check frequency must be hourly, daily, or weekly'
    },
    default: 'daily'
  },
  episodeCount: {
    type: Number,
    default: 0
  },
  metadata: {
    type: Map,
    of: Schema.Types.Mixed,
    default: {}
  },
  errorCount: {
    type: Number,
    default: 0
  },
  lastError: {
    message: {
      type: String,
      default: null
    },
    date: {
      type: Date,
      default: null
    }
  }
}, {
  timestamps: true
});

// Indexes for better query performance
podcastSchema.index({ sourceId: 1 });
podcastSchema.index({ feedUrl: 1 }, { unique: true });
podcastSchema.index({ active: 1 });
podcastSchema.index({ lastChecked: 1 });
podcastSchema.index({ checkFrequency: 1 });
podcastSchema.index({ categories: 1 });

/**
 * Record successful check
 * @returns {Promise<Document>} - Updated podcast document
 */
podcastSchema.methods.recordCheck = function() {
  this.lastChecked = new Date();
  return this.save();
};

/**
 * Record content update
 * @returns {Promise<Document>} - Updated podcast document
 */
podcastSchema.methods.recordUpdate = function() {
  this.lastUpdated = new Date();
  this.episodeCount += 1;
  return this.save();
};

/**
 * Record error during check
 * @param {string} message - Error message
 * @returns {Promise<Document>} - Updated podcast document
 */
podcastSchema.methods.recordError = function(message) {
  this.errorCount += 1;
  this.lastError = {
    message,
    date: new Date()
  };
  return this.save();
};

/**
 * Reset error count
 * @returns {Promise<Document>} - Updated podcast document
 */
podcastSchema.methods.resetErrors = function() {
  this.errorCount = 0;
  this.lastError = {
    message: null,
    date: null
  };
  return this.save();
};

/**
 * Update podcast metadata
 * @param {Object} metadata - New metadata
 * @returns {Promise<Document>} - Updated podcast document
 */
podcastSchema.methods.updateMetadata = function(metadata) {
  this.metadata = new Map(Object.entries(metadata));
  return this.save();
};

/**
 * Find podcasts that need checking
 * @param {string} frequency - Check frequency
 * @returns {Promise<Array>} - Array of podcast documents
 */
podcastSchema.statics.findPodcastsForChecking = function(frequency) {
  const checkThresholds = {
    hourly: 60 * 60 * 1000, // 1 hour
    daily: 24 * 60 * 60 * 1000, // 24 hours
    weekly: 7 * 24 * 60 * 60 * 1000 // 7 days
  };
  
  const threshold = checkThresholds[frequency] || checkThresholds.daily;
  const checkBefore = new Date(Date.now() - threshold);
  
  return this.find({
    active: true,
    checkFrequency: frequency,
    $or: [
      { lastChecked: { $lt: checkBefore } },
      { lastChecked: null }
    ]
  });
};

/**
 * Find podcasts with errors
 * @param {number} minErrors - Minimum error count
 * @returns {Promise<Array>} - Array of podcast documents
 */
podcastSchema.statics.findPodcastsWithErrors = function(minErrors = 1) {
  return this.find({
    active: true,
    errorCount: { $gte: minErrors }
  });
};

/**
 * Find podcasts by category
 * @param {string} category - Category name
 * @returns {Promise<Array>} - Array of podcast documents
 */
podcastSchema.statics.findByCategory = function(category) {
  return this.find({
    categories: category,
    active: true
  });
};

// Create model from schema
const Podcast = mongoose.model('Podcast', podcastSchema);

module.exports = Podcast;