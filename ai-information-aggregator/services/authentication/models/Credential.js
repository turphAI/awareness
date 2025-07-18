const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Credential Schema
 * Model for storing encrypted credentials for external services
 */
const credentialSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  service: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  encryptedData: {
    version: {
      type: Number,
      required: true,
      default: 1
    },
    salt: {
      type: String,
      required: true
    },
    iv: {
      type: String,
      required: true
    },
    tag: {
      type: String,
      required: true
    },
    encrypted: {
      type: String,
      required: true
    }
  },
  lastUsed: {
    type: Date,
    default: null
  },
  expiresAt: {
    type: Date,
    default: null,
    index: true
  },
  active: {
    type: Boolean,
    default: true,
    index: true
  },
  metadata: {
    type: Map,
    of: String,
    default: {}
  }
}, {
  timestamps: true
});

// Compound index for user and service
credentialSchema.index({ userId: 1, service: 1, name: 1 }, { unique: true });

/**
 * Record credential usage
 * @returns {Promise<Document>} - Updated credential document
 */
credentialSchema.methods.recordUsage = function() {
  this.lastUsed = new Date();
  return this.save();
};

/**
 * Deactivate credential
 * @returns {Promise<Document>} - Updated credential document
 */
credentialSchema.methods.deactivate = function() {
  this.active = false;
  return this.save();
};

/**
 * Update credential metadata
 * @param {Object} metadata - New metadata
 * @returns {Promise<Document>} - Updated credential document
 */
credentialSchema.methods.updateMetadata = function(metadata) {
  this.metadata = new Map(Object.entries(metadata));
  return this.save();
};

/**
 * Find active credentials by user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} - Array of credential documents
 */
credentialSchema.statics.findActiveByUser = function(userId) {
  return this.find({
    userId,
    active: true,
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ]
  });
};

/**
 * Find active credentials by user and service
 * @param {string} userId - User ID
 * @param {string} service - Service name
 * @returns {Promise<Array>} - Array of credential documents
 */
credentialSchema.statics.findActiveByUserAndService = function(userId, service) {
  return this.find({
    userId,
    service,
    active: true,
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ]
  });
};

/**
 * Find expired credentials
 * @returns {Promise<Array>} - Array of credential documents
 */
credentialSchema.statics.findExpired = function() {
  return this.find({
    active: true,
    expiresAt: { $lt: new Date() }
  });
};

// Create model from schema
const Credential = mongoose.model('Credential', credentialSchema);

module.exports = Credential;