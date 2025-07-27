const mongoose = require('mongoose');

const contentVolumeSettingsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    unique: true,
    index: true
  },
  dailyLimit: {
    type: Number,
    required: true,
    min: 1,
    max: 1000,
    default: 50
  },
  priorityThreshold: {
    type: Number,
    required: true,
    min: 0,
    max: 1,
    default: 0.7
  },
  adaptiveEnabled: {
    type: Boolean,
    default: true
  },
  userBehaviorMetrics: {
    averageReadTime: {
      type: Number,
      default: 0
    },
    completionRate: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.5
    },
    engagementScore: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.5
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  contentTypeWeights: {
    article: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.8
    },
    paper: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.9
    },
    podcast: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.7
    },
    video: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.6
    },
    social: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.4
    }
  },
  created: {
    type: Date,
    default: Date.now
  },
  updated: {
    type: Date,
    default: Date.now
  }
});

// Update the 'updated' field on save
contentVolumeSettingsSchema.pre('save', function(next) {
  this.updated = Date.now();
  next();
});

// Method to calculate adaptive daily limit based on user behavior
contentVolumeSettingsSchema.methods.calculateAdaptiveLimit = function() {
  if (!this.adaptiveEnabled) {
    return this.dailyLimit;
  }

  const baseLimit = this.dailyLimit;
  const { completionRate, engagementScore } = this.userBehaviorMetrics;
  
  // Adjust limit based on user engagement
  let adaptiveFactor = 1.0;
  
  if (completionRate > 0.8 && engagementScore > 0.7) {
    // High engagement - increase limit by up to 50%
    adaptiveFactor = 1.0 + (0.5 * ((completionRate + engagementScore) / 2 - 0.75) / 0.25);
  } else if (completionRate < 0.3 || engagementScore < 0.3) {
    // Low engagement - decrease limit by up to 30%
    adaptiveFactor = 0.7 + (0.3 * Math.max(completionRate, engagementScore) / 0.3);
  }
  
  return Math.round(baseLimit * adaptiveFactor);
};

// Method to update user behavior metrics
contentVolumeSettingsSchema.methods.updateBehaviorMetrics = function(metrics) {
  const { averageReadTime, completionRate, engagementScore } = metrics;
  
  if (averageReadTime !== undefined) {
    this.userBehaviorMetrics.averageReadTime = averageReadTime;
  }
  if (completionRate !== undefined) {
    this.userBehaviorMetrics.completionRate = Math.max(0, Math.min(1, completionRate));
  }
  if (engagementScore !== undefined) {
    this.userBehaviorMetrics.engagementScore = Math.max(0, Math.min(1, engagementScore));
  }
  
  this.userBehaviorMetrics.lastUpdated = Date.now();
};

// Method to prioritize content based on volume settings
contentVolumeSettingsSchema.methods.prioritizeContent = function(contentList) {
  const adaptiveLimit = this.calculateAdaptiveLimit();
  
  // Sort content by relevance score and content type weight
  const prioritizedContent = contentList.map(content => ({
    ...content,
    priorityScore: content.relevanceScore * (this.contentTypeWeights[content.type] || 0.5)
  })).sort((a, b) => b.priorityScore - a.priorityScore);
  
  // Apply priority threshold and limit
  const filteredContent = prioritizedContent.filter(content => 
    content.priorityScore >= this.priorityThreshold
  );
  
  return filteredContent.slice(0, adaptiveLimit);
};

// Static method to get or create settings for a user
contentVolumeSettingsSchema.statics.getOrCreateForUser = async function(userId) {
  let settings = await this.findOne({ userId });
  
  if (!settings) {
    settings = new this({ userId });
    await settings.save();
  }
  
  return settings;
};

module.exports = mongoose.model('ContentVolumeSettings', contentVolumeSettingsSchema);