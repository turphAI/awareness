const mongoose = require('mongoose');

const sourceSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['website', 'blog', 'academic', 'podcast', 'social'],
    required: true
  },
  categories: [{
    type: String,
    trim: true
  }],
  relevanceScore: {
    type: Number,
    default: 0.5,
    min: 0,
    max: 1
  },
  checkFrequency: {
    type: String,
    default: 'daily'
  },
  lastChecked: {
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
    }
  },
  discoveredFrom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Source',
    default: null
  },
  active: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Indexes for better query performance
sourceSchema.index({ url: 1 });
sourceSchema.index({ type: 1 });
sourceSchema.index({ categories: 1 });
sourceSchema.index({ active: 1 });
sourceSchema.index({ createdBy: 1 });

// Methods
sourceSchema.methods.updateRelevance = function(score) {
  this.relevanceScore = score;
  return this.save();
};

// Static methods
sourceSchema.statics.findByType = function(type) {
  return this.find({ type, active: true });
};

sourceSchema.statics.findActiveByUser = function(userId) {
  return this.find({ createdBy: userId, active: true });
};

const Source = mongoose.model('Source', sourceSchema);

module.exports = Source;