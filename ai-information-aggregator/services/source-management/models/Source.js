const mongoose = require('mongoose');
const crypto = require('crypto');

/**
 * Source Schema
 * Comprehensive model for information sources with validation and methods
 */
const sourceSchema = new mongoose.Schema({
  url: {
    type: String,
    required: [true, 'URL is required'],
    unique: true,
    trim: true,
    match: [
      /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/,
      'Please provide a valid URL'
    ]
  },
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  type: {
    type: String,
    enum: {
      values: ['website', 'blog', 'academic', 'podcast', 'social', 'newsletter', 'rss'],
      message: 'Type must be website, blog, academic, podcast, social, newsletter, or rss'
    },
    required: [true, 'Type is required']
  },
  categories: [{
    type: String,
    trim: true
  }],
  tags: [{
    type: String,
    trim: true
  }],
  relevanceScore: {
    type: Number,
    default: 0.5,
    min: [0, 'Relevance score must be at least 0'],
    max: [1, 'Relevance score cannot exceed 1']
  },
  checkFrequency: {
    type: String,
    enum: {
      values: ['hourly', 'daily', 'weekly', 'monthly'],
      message: 'Check frequency must be hourly, daily, weekly, or monthly'
    },
    default: 'daily'
  },
  lastChecked: {
    type: Date,
    default: null
  },
  lastUpdated: {
    type: Date,
    default: null
  },
  requiresAuthentication: {
    type: Boolean,
    default: false
  },
  credentials: {
    encrypted: {
      type: String,
      default: null
    },
    iv: {
      type: String,
      default: null
    }
  },
  discoveredFrom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Source',
    default: null
  },
  discoveryDate: {
    type: Date,
    default: Date.now
  },
  active: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  contentCount: {
    type: Number,
    default: 0
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
  },
  metadata: {
    type: Map,
    of: String,
    default: {}
  },
  // RSS-specific fields
  rssUrl: {
    type: String,
    trim: true
  },
  // Podcast-specific fields
  podcastAuthor: {
    type: String,
    trim: true
  },
  podcastLanguage: {
    type: String,
    trim: true
  },
  // Academic-specific fields
  academicPublisher: {
    type: String,
    trim: true
  },
  academicDomain: {
    type: String,
    trim: true
  },
  // Social-specific fields
  socialPlatform: {
    type: String,
    trim: true
  },
  socialUsername: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Indexes for better query performance
sourceSchema.index({ url: 1 });
sourceSchema.index({ type: 1 });
sourceSchema.index({ categories: 1 });
sourceSchema.index({ tags: 1 });
sourceSchema.index({ active: 1 });
sourceSchema.index({ createdBy: 1 });
sourceSchema.index({ relevanceScore: -1 });
sourceSchema.index({ lastChecked: 1 });
sourceSchema.index({ checkFrequency: 1 });

/**
 * Encrypt credentials for secure storage
 * @param {Object} credentials - Credentials to encrypt
 * @returns {Object} - Encrypted credentials and IV
 */
sourceSchema.methods.encryptCredentials = function(credentials) {
  const algorithm = 'aes-256-ctr';
  const secretKey = crypto.scryptSync(process.env.CREDENTIAL_ENCRYPTION_KEY || 'default-key-do-not-use-in-production', 'salt', 32);
  const iv = crypto.randomBytes(16);
  
  const cipher = crypto.createCipheriv(algorithm, secretKey, iv);
  
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(credentials)),
    cipher.final()
  ]);
  
  this.credentials = {
    encrypted: encrypted.toString('hex'),
    iv: iv.toString('hex')
  };
  
  return this.save();
};

/**
 * Decrypt credentials for use
 * @returns {Object} - Decrypted credentials
 */
sourceSchema.methods.decryptCredentials = function() {
  if (!this.credentials.encrypted || !this.credentials.iv) {
    return null;
  }
  
  const algorithm = 'aes-256-ctr';
  const secretKey = crypto.scryptSync(process.env.CREDENTIAL_ENCRYPTION_KEY || 'default-key-do-not-use-in-production', 'salt', 32);
  const decipher = crypto.createDecipheriv(
    algorithm,
    secretKey,
    Buffer.from(this.credentials.iv, 'hex')
  );
  
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(this.credentials.encrypted, 'hex')),
    decipher.final()
  ]);
  
  return JSON.parse(decrypted.toString());
};

/**
 * Update source relevance score
 * @param {number} score - New relevance score
 * @param {Object} metadata - Optional metadata about the update
 * @returns {Promise<Document>} - Updated source document
 */
sourceSchema.methods.updateRelevance = function(score, metadata = {}) {
  this.relevanceScore = score;
  
  // Store relevance update history in metadata if not already present
  if (!this.metadata.has('relevanceHistory')) {
    this.metadata.set('relevanceHistory', JSON.stringify([]));
  }
  
  // Parse existing history
  const history = JSON.parse(this.metadata.get('relevanceHistory') || '[]');
  
  // Add new entry to history
  history.push({
    score,
    date: new Date(),
    reason: metadata.reason || 'manual_update',
    userId: metadata.userId || this.createdBy
  });
  
  // Keep only the last 10 entries
  if (history.length > 10) {
    history.shift();
  }
  
  // Update metadata
  this.metadata.set('relevanceHistory', JSON.stringify(history));
  
  // Update priority level based on score
  this.metadata.set('priorityLevel', this._calculatePriorityLevel());
  
  return this.save();
};

/**
 * Calculate priority level based on relevance score
 * @private
 * @returns {string} - Priority level (low, medium, high, critical)
 */
sourceSchema.methods._calculatePriorityLevel = function() {
  const score = this.relevanceScore;
  
  if (score >= 0.8) {
    return 'critical';
  } else if (score >= 0.6) {
    return 'high';
  } else if (score >= 0.4) {
    return 'medium';
  } else {
    return 'low';
  }
};

/**
 * Adjust relevance score based on user interaction
 * @param {string} interactionType - Type of interaction (view, save, share, dismiss)
 * @param {string} userId - ID of the user who interacted
 * @param {number} weight - Weight of this interaction (0-1)
 * @returns {Promise<Document>} - Updated source document
 */
sourceSchema.methods.adjustRelevanceByInteraction = function(interactionType, userId, weight = 0.1) {
  const interactionImpact = {
    view: 0.02,      // Small positive impact
    save: 0.05,      // Medium positive impact
    share: 0.1,      // Large positive impact
    dismiss: -0.1,   // Negative impact
    dislike: -0.05   // Medium negative impact
  };
  
  const impact = interactionImpact[interactionType] || 0;
  const newScore = Math.max(0, Math.min(1, this.relevanceScore + (impact * weight)));
  
  return this.updateRelevance(newScore, {
    reason: `interaction_${interactionType}`,
    userId
  });
};

/**
 * Decay relevance score over time
 * @param {number} decayRate - Rate of decay (0-1)
 * @returns {Promise<Document>} - Updated source document
 */
sourceSchema.methods.decayRelevanceScore = function(decayRate = 0.01) {
  if (!this.lastUpdated) {
    return Promise.resolve(this);
  }
  
  const now = new Date();
  const daysSinceUpdate = (now - this.lastUpdated) / (1000 * 60 * 60 * 24);
  
  // Apply decay based on days since last update
  // Limit maximum decay to 50% of original score
  const decay = Math.min(daysSinceUpdate * decayRate, 0.5);
  const decayedScore = this.relevanceScore * (1 - decay);
  const newScore = Math.max(0, Math.min(1, decayedScore));
  
  return this.updateRelevance(newScore, {
    reason: 'time_decay',
    daysSinceUpdate
  });
};

/**
 * Record successful check
 * @returns {Promise<Document>} - Updated source document
 */
sourceSchema.methods.recordCheck = function() {
  this.lastChecked = new Date();
  return this.save();
};

/**
 * Record content update
 * @returns {Promise<Document>} - Updated source document
 */
sourceSchema.methods.recordUpdate = function() {
  this.lastUpdated = new Date();
  this.contentCount += 1;
  return this.save();
};

/**
 * Record error during check
 * @param {string} message - Error message
 * @returns {Promise<Document>} - Updated source document
 */
sourceSchema.methods.recordError = function(message) {
  this.errorCount += 1;
  this.lastError = {
    message,
    date: new Date()
  };
  return this.save();
};

/**
 * Reset error count
 * @returns {Promise<Document>} - Updated source document
 */
sourceSchema.methods.resetErrors = function() {
  this.errorCount = 0;
  this.lastError = {
    message: null,
    date: null
  };
  return this.save();
};

/**
 * Update source metadata
 * @param {Object} metadata - New metadata
 * @returns {Promise<Document>} - Updated source document
 */
sourceSchema.methods.updateMetadata = function(metadata) {
  this.metadata = new Map(Object.entries(metadata));
  return this.save();
};

/**
 * Find sources by type
 * @param {string} type - Source type
 * @returns {Promise<Array>} - Array of source documents
 */
sourceSchema.statics.findByType = function(type) {
  return this.find({ type, active: true });
};

/**
 * Find active sources by user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} - Array of source documents
 */
sourceSchema.statics.findActiveByUser = function(userId) {
  return this.find({ createdBy: userId, active: true });
};

/**
 * Find sources by category
 * @param {string} category - Category name
 * @returns {Promise<Array>} - Array of source documents
 */
sourceSchema.statics.findByCategory = function(category) {
  return this.find({ categories: category, active: true });
};

/**
 * Find sources by tag
 * @param {string} tag - Tag name
 * @returns {Promise<Array>} - Array of source documents
 */
sourceSchema.statics.findByTag = function(tag) {
  return this.find({ tags: tag, active: true });
};

/**
 * Find sources that need checking
 * @param {string} frequency - Check frequency
 * @returns {Promise<Array>} - Array of source documents
 */
sourceSchema.statics.findSourcesForChecking = function(frequency) {
  const checkThresholds = {
    hourly: 60 * 60 * 1000, // 1 hour
    daily: 24 * 60 * 60 * 1000, // 24 hours
    weekly: 7 * 24 * 60 * 60 * 1000, // 7 days
    monthly: 30 * 24 * 60 * 60 * 1000 // 30 days
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
 * Find sources with errors
 * @param {number} minErrors - Minimum error count
 * @returns {Promise<Array>} - Array of source documents
 */
sourceSchema.statics.findSourcesWithErrors = function(minErrors = 1) {
  return this.find({
    active: true,
    errorCount: { $gte: minErrors }
  });
};

/**
 * Find most relevant sources
 * @param {number} limit - Maximum number of sources to return
 * @returns {Promise<Array>} - Array of source documents
 */
sourceSchema.statics.findMostRelevant = function(limit = 10) {
  return this.find({ active: true })
    .sort({ relevanceScore: -1 })
    .limit(limit);
};

// Create model from schema
const Source = mongoose.model('Source', sourceSchema);

module.exports = Source;