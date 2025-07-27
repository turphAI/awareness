const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Episode Schema
 * Model for podcast episodes
 */
const episodeSchema = new Schema({
  podcastId: {
    type: Schema.Types.ObjectId,
    ref: 'Podcast',
    required: [true, 'Podcast ID is required'],
    index: true
  },
  contentId: {
    type: Schema.Types.ObjectId,
    ref: 'Content',
    default: null,
    index: true
  },
  title: {
    type: String,
    required: [true, 'Episode title is required'],
    trim: true,
    maxlength: [500, 'Title cannot exceed 500 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [5000, 'Description cannot exceed 5000 characters']
  },
  guid: {
    type: String,
    required: [true, 'Episode GUID is required'],
    trim: true,
    index: true
  },
  url: {
    type: String,
    required: [true, 'Episode URL is required'],
    trim: true,
    match: [
      /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/,
      'Please provide a valid URL'
    ],
    index: true
  },
  audioUrl: {
    type: String,
    required: [true, 'Audio URL is required'],
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
  publishDate: {
    type: Date,
    required: [true, 'Publish date is required'],
    index: true
  },
  duration: {
    type: Number, // in seconds
    default: 0
  },
  episodeNumber: {
    type: Number,
    default: null
  },
  season: {
    type: Number,
    default: null
  },
  explicit: {
    type: Boolean,
    default: false
  },
  audioProcessed: {
    type: Boolean,
    default: false,
    index: true
  },
  transcriptAvailable: {
    type: Boolean,
    default: false,
    index: true
  },
  transcriptProcessed: {
    type: Boolean,
    default: false,
    index: true
  },
  downloadPath: {
    type: String,
    default: null
  },
  processingStatus: {
    type: String,
    enum: {
      values: ['pending', 'downloading', 'transcribing', 'analyzing', 'completed', 'failed'],
      message: 'Processing status must be pending, downloading, transcribing, analyzing, completed, or failed'
    },
    default: 'pending',
    index: true
  },
  processingError: {
    type: String,
    default: null
  },
  showNotes: {
    type: String,
    default: null
  },
  chapters: [{
    title: {
      type: String,
      trim: true
    },
    startTime: {
      type: Number, // in seconds
      min: 0
    },
    endTime: {
      type: Number, // in seconds
      min: 0
    },
    imageUrl: {
      type: String,
      trim: true
    }
  }],
  metadata: {
    type: Map,
    of: Schema.Types.Mixed,
    default: {}
  },
  referencesExtracted: {
    type: Boolean,
    default: false,
    index: true
  },
  referenceCount: {
    type: Number,
    default: 0
  },
  referencesResolved: {
    type: Number,
    default: 0
  },
  referencesNeedingManualResolution: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Compound indexes for better query performance
episodeSchema.index({ podcastId: 1, guid: 1 }, { unique: true });
episodeSchema.index({ podcastId: 1, publishDate: -1 });

/**
 * Update processing status
 * @param {string} status - New processing status
 * @param {string} error - Error message (if status is 'failed')
 * @returns {Promise<Document>} - Updated episode document
 */
episodeSchema.methods.updateProcessingStatus = function(status, error = null) {
  this.processingStatus = status;
  
  if (status === 'failed') {
    this.processingError = error;
  }
  
  return this.save();
};

/**
 * Set download path
 * @param {string} path - Download path
 * @returns {Promise<Document>} - Updated episode document
 */
episodeSchema.methods.setDownloadPath = function(path) {
  this.downloadPath = path;
  return this.save();
};

/**
 * Mark audio as processed
 * @returns {Promise<Document>} - Updated episode document
 */
episodeSchema.methods.markAudioProcessed = function() {
  this.audioProcessed = true;
  return this.save();
};

/**
 * Set transcript availability
 * @param {boolean} available - Whether transcript is available
 * @returns {Promise<Document>} - Updated episode document
 */
episodeSchema.methods.setTranscriptAvailable = function(available = true) {
  this.transcriptAvailable = available;
  return this.save();
};

/**
 * Mark transcript as processed
 * @returns {Promise<Document>} - Updated episode document
 */
episodeSchema.methods.markTranscriptProcessed = function() {
  this.transcriptProcessed = true;
  return this.save();
};

/**
 * Update episode metadata
 * @param {Object} metadata - New metadata
 * @returns {Promise<Document>} - Updated episode document
 */
episodeSchema.methods.updateMetadata = function(metadata) {
  this.metadata = new Map(Object.entries(metadata));
  return this.save();
};

/**
 * Find episodes by podcast
 * @param {string} podcastId - Podcast ID
 * @param {Object} options - Query options
 * @returns {Promise<Array>} - Array of episode documents
 */
episodeSchema.statics.findByPodcast = function(podcastId, options = {}) {
  const { limit = 10, skip = 0, sort = '-publishDate' } = options;
  
  return this.find({ podcastId })
    .sort(sort)
    .skip(parseInt(skip))
    .limit(parseInt(limit));
};

/**
 * Find episodes pending processing
 * @param {number} limit - Maximum number of episodes to return
 * @returns {Promise<Array>} - Array of episode documents
 */
episodeSchema.statics.findPendingProcessing = function(limit = 10) {
  return this.find({
    processingStatus: 'pending'
  })
    .sort('publishDate')
    .limit(limit);
};

/**
 * Find episodes with failed processing
 * @param {number} limit - Maximum number of episodes to return
 * @returns {Promise<Array>} - Array of episode documents
 */
episodeSchema.statics.findFailedProcessing = function(limit = 10) {
  return this.find({
    processingStatus: 'failed'
  })
    .sort('-updatedAt')
    .limit(limit);
};

/**
 * Find episodes without transcripts
 * @param {number} limit - Maximum number of episodes to return
 * @returns {Promise<Array>} - Array of episode documents
 */
episodeSchema.statics.findWithoutTranscripts = function(limit = 10) {
  return this.find({
    audioProcessed: true,
    transcriptAvailable: false
  })
    .sort('-publishDate')
    .limit(limit);
};

/**
 * Find episodes with unprocessed transcripts
 * @param {number} limit - Maximum number of episodes to return
 * @returns {Promise<Array>} - Array of episode documents
 */
episodeSchema.statics.findWithUnprocessedTranscripts = function(limit = 10) {
  return this.find({
    transcriptAvailable: true,
    transcriptProcessed: false
  })
    .sort('-publishDate')
    .limit(limit);
};

/**
 * Mark references as extracted
 * @param {number} count - Number of references extracted
 * @returns {Promise<Document>} - Updated episode document
 */
episodeSchema.methods.markReferencesExtracted = function(count) {
  this.referencesExtracted = true;
  this.referenceCount = count;
  return this.save();
};

/**
 * Update reference resolution counts
 * @param {number} resolved - Number of resolved references
 * @param {number} needingManualResolution - Number of references needing manual resolution
 * @returns {Promise<Document>} - Updated episode document
 */
episodeSchema.methods.updateReferenceResolutionCounts = function(resolved, needingManualResolution) {
  this.referencesResolved = resolved;
  this.referencesNeedingManualResolution = needingManualResolution;
  return this.save();
};

/**
 * Find episodes with unresolved references
 * @param {number} limit - Maximum number of episodes to return
 * @returns {Promise<Array>} - Array of episode documents
 */
episodeSchema.statics.findWithUnresolvedReferences = function(limit = 10) {
  return this.find({
    referencesExtracted: true,
    $expr: { $lt: ['$referencesResolved', '$referenceCount'] }
  })
    .sort('-publishDate')
    .limit(limit);
};

// Create model from schema
const Episode = mongoose.model('Episode', episodeSchema);

module.exports = Episode;