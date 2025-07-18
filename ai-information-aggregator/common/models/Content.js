const mongoose = require('mongoose');

const contentSchema = new mongoose.Schema({
  sourceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Source',
    required: true
  },
  url: {
    type: String,
    required: true,
    trim: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  author: {
    type: String,
    trim: true
  },
  publishDate: {
    type: Date
  },
  discoveryDate: {
    type: Date,
    default: Date.now
  },
  type: {
    type: String,
    enum: ['article', 'paper', 'podcast', 'video', 'social'],
    required: true
  },
  categories: [{
    type: String,
    trim: true
  }],
  topics: [{
    type: String,
    trim: true
  }],
  relevanceScore: {
    type: Number,
    default: 0.5,
    min: 0,
    max: 1
  },
  summary: {
    type: String
  },
  keyInsights: [{
    type: String
  }],
  fullText: {
    type: String
  },
  references: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Reference'
  }],
  visualElements: [{
    type: {
      type: String,
      enum: ['image', 'chart', 'diagram', 'table']
    },
    url: {
      type: String
    },
    description: {
      type: String
    }
  }],
  metadata: {
    type: Map,
    of: String
  },
  processed: {
    type: Boolean,
    default: false
  },
  outdated: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes for better query performance
contentSchema.index({ sourceId: 1 });
contentSchema.index({ url: 1 });
contentSchema.index({ type: 1 });
contentSchema.index({ categories: 1 });
contentSchema.index({ topics: 1 });
contentSchema.index({ relevanceScore: -1 });
contentSchema.index({ publishDate: -1 });
contentSchema.index({ discoveryDate: -1 });

// Methods
contentSchema.methods.markAsProcessed = function() {
  this.processed = true;
  return this.save();
};

contentSchema.methods.markAsOutdated = function() {
  this.outdated = true;
  return this.save();
};

contentSchema.methods.updateRelevance = function(score) {
  this.relevanceScore = score;
  return this.save();
};

// Static methods
contentSchema.statics.findBySource = function(sourceId) {
  return this.find({ sourceId });
};

contentSchema.statics.findByType = function(type) {
  return this.find({ type, processed: true });
};

contentSchema.statics.findByTopic = function(topic) {
  return this.find({ topics: topic, processed: true });
};

contentSchema.statics.findRecentContent = function(limit = 10) {
  return this.find({ processed: true })
    .sort({ publishDate: -1 })
    .limit(limit);
};

contentSchema.statics.findRelevantContent = function(limit = 10) {
  return this.find({ processed: true })
    .sort({ relevanceScore: -1 })
    .limit(limit);
};

const Content = mongoose.model('Content', contentSchema);

module.exports = Content;