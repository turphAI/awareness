const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Interaction Schema
 * Model for tracking user interactions with content
 */
const interactionSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  contentId: {
    type: Schema.Types.ObjectId,
    ref: 'Content',
    required: [true, 'Content ID is required'],
    index: true
  },
  type: {
    type: String,
    enum: {
      values: ['view', 'save', 'share', 'dismiss', 'like', 'dislike', 'comment', 'highlight', 'note'],
      message: 'Interaction type must be view, save, share, dismiss, like, dislike, comment, highlight, or note'
    },
    required: [true, 'Interaction type is required'],
    index: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  duration: {
    type: Number, // in seconds
    min: 0
  },
  progress: {
    type: Number, // percentage 0-100
    min: 0,
    max: 100
  },
  device: {
    type: String,
    trim: true
  },
  platform: {
    type: String,
    trim: true
  },
  location: {
    type: String,
    trim: true
  },
  referrer: {
    type: String,
    trim: true
  },
  metadata: {
    type: Map,
    of: Schema.Types.Mixed,
    default: {}
  },
  // Comment-specific fields
  commentText: {
    type: String,
    trim: true
  },
  commentParent: {
    type: Schema.Types.ObjectId,
    ref: 'Interaction',
    default: null
  },
  // Highlight-specific fields
  highlightText: {
    type: String,
    trim: true
  },
  highlightPosition: {
    start: {
      type: Number,
      min: 0
    },
    end: {
      type: Number,
      min: 0
    },
    context: {
      type: String,
      trim: true
    }
  },
  // Note-specific fields
  noteText: {
    type: String,
    trim: true
  },
  notePosition: {
    type: String, // Could be a paragraph ID, timestamp, etc.
    trim: true
  },
  // Share-specific fields
  shareMethod: {
    type: String,
    enum: ['email', 'twitter', 'facebook', 'linkedin', 'copy', 'other'],
    default: 'other'
  },
  shareRecipients: [{
    type: String,
    trim: true
  }]
}, {
  timestamps: true
});

// Compound indexes for better query performance
interactionSchema.index({ userId: 1, contentId: 1, type: 1 });
interactionSchema.index({ contentId: 1, type: 1 });
interactionSchema.index({ timestamp: -1 });

/**
 * Update interaction metadata
 * @param {Object} metadata - New metadata
 * @returns {Promise<Document>} - Updated interaction document
 */
interactionSchema.methods.updateMetadata = function(metadata) {
  this.metadata = new Map(Object.entries(metadata));
  return this.save();
};

/**
 * Update interaction duration
 * @param {number} duration - Duration in seconds
 * @returns {Promise<Document>} - Updated interaction document
 */
interactionSchema.methods.updateDuration = function(duration) {
  this.duration = duration;
  return this.save();
};

/**
 * Update interaction progress
 * @param {number} progress - Progress percentage (0-100)
 * @returns {Promise<Document>} - Updated interaction document
 */
interactionSchema.methods.updateProgress = function(progress) {
  this.progress = Math.min(Math.max(progress, 0), 100);
  return this.save();
};

/**
 * Add comment reply
 * @param {string} userId - User ID
 * @param {string} text - Comment text
 * @returns {Promise<Document>} - New interaction document (reply)
 */
interactionSchema.methods.addReply = async function(userId, text) {
  if (this.type !== 'comment') {
    throw new Error('Can only add replies to comments');
  }
  
  const reply = new this.constructor({
    userId,
    contentId: this.contentId,
    type: 'comment',
    commentText: text,
    commentParent: this._id
  });
  
  return reply.save();
};

/**
 * Find user interactions
 * @param {string} userId - User ID
 * @param {string} type - Interaction type (optional)
 * @returns {Promise<Array>} - Array of interaction documents
 */
interactionSchema.statics.findByUser = function(userId, type = null) {
  const query = { userId };
  
  if (type) {
    query.type = type;
  }
  
  return this.find(query).sort({ timestamp: -1 });
};

/**
 * Find content interactions
 * @param {string} contentId - Content ID
 * @param {string} type - Interaction type (optional)
 * @returns {Promise<Array>} - Array of interaction documents
 */
interactionSchema.statics.findByContent = function(contentId, type = null) {
  const query = { contentId };
  
  if (type) {
    query.type = type;
  }
  
  return this.find(query).sort({ timestamp: -1 });
};

/**
 * Find user-content interactions
 * @param {string} userId - User ID
 * @param {string} contentId - Content ID
 * @returns {Promise<Array>} - Array of interaction documents
 */
interactionSchema.statics.findByUserAndContent = function(userId, contentId) {
  return this.find({ userId, contentId }).sort({ timestamp: -1 });
};

/**
 * Find comments for content
 * @param {string} contentId - Content ID
 * @param {boolean} topLevelOnly - Whether to return only top-level comments
 * @returns {Promise<Array>} - Array of interaction documents
 */
interactionSchema.statics.findComments = function(contentId, topLevelOnly = false) {
  const query = { 
    contentId,
    type: 'comment'
  };
  
  if (topLevelOnly) {
    query.commentParent = null;
  }
  
  return this.find(query).sort({ timestamp: -1 });
};

/**
 * Find comment replies
 * @param {string} commentId - Comment ID
 * @returns {Promise<Array>} - Array of interaction documents
 */
interactionSchema.statics.findReplies = function(commentId) {
  return this.find({
    commentParent: commentId,
    type: 'comment'
  }).sort({ timestamp: 1 });
};

/**
 * Find highlights for content
 * @param {string} contentId - Content ID
 * @param {string} userId - User ID (optional)
 * @returns {Promise<Array>} - Array of interaction documents
 */
interactionSchema.statics.findHighlights = function(contentId, userId = null) {
  const query = { 
    contentId,
    type: 'highlight'
  };
  
  if (userId) {
    query.userId = userId;
  }
  
  return this.find(query).sort({ 'highlightPosition.start': 1 });
};

/**
 * Find notes for content
 * @param {string} contentId - Content ID
 * @param {string} userId - User ID (optional)
 * @returns {Promise<Array>} - Array of interaction documents
 */
interactionSchema.statics.findNotes = function(contentId, userId = null) {
  const query = { 
    contentId,
    type: 'note'
  };
  
  if (userId) {
    query.userId = userId;
  }
  
  return this.find(query).sort({ timestamp: -1 });
};

/**
 * Get interaction counts for content
 * @param {string} contentId - Content ID
 * @returns {Promise<Object>} - Object with interaction counts
 */
interactionSchema.statics.getInteractionCounts = async function(contentId) {
  const counts = await this.aggregate([
    { $match: { contentId: mongoose.Types.ObjectId(contentId) } },
    { $group: { _id: '$type', count: { $sum: 1 } } }
  ]);
  
  const result = {
    view: 0,
    save: 0,
    share: 0,
    like: 0,
    dislike: 0,
    comment: 0,
    highlight: 0,
    note: 0
  };
  
  counts.forEach(item => {
    if (result.hasOwnProperty(item._id)) {
      result[item._id] = item.count;
    }
  });
  
  return result;
};

/**
 * Get recent user activity
 * @param {string} userId - User ID
 * @param {number} limit - Maximum number of interactions to return
 * @returns {Promise<Array>} - Array of interaction documents
 */
interactionSchema.statics.getRecentActivity = function(userId, limit = 10) {
  return this.find({ userId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('contentId', 'title url type');
};

// Create model from schema
const Interaction = mongoose.model('Interaction', interactionSchema);

module.exports = Interaction;