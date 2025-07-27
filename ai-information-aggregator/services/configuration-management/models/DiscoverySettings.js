const mongoose = require('mongoose');

const discoverySettingsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    unique: true,
    index: true
  },
  // Main aggressiveness level (0-1, where 1 is most aggressive)
  aggressivenessLevel: {
    type: Number,
    required: true,
    min: 0,
    max: 1,
    default: 0.5
  },
  // Threshold for automatic content inclusion (0-1)
  autoInclusionThreshold: {
    type: Number,
    required: true,
    min: 0,
    max: 1,
    default: 0.7
  },
  // Threshold for queuing content for manual review (0-1)
  manualReviewThreshold: {
    type: Number,
    required: true,
    min: 0,
    max: 1,
    default: 0.4
  },
  // Source-specific discovery settings
  sourceDiscoverySettings: {
    // Enable discovery from references in content
    enableReferenceDiscovery: {
      type: Boolean,
      default: true
    },
    // Enable discovery from citations in academic papers
    enableCitationDiscovery: {
      type: Boolean,
      default: true
    },
    // Enable discovery from podcast mentions
    enablePodcastDiscovery: {
      type: Boolean,
      default: true
    },
    // Maximum depth for reference following (1-5)
    maxDiscoveryDepth: {
      type: Number,
      min: 1,
      max: 5,
      default: 2
    }
  },
  // Content type specific thresholds
  contentTypeThresholds: {
    article: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.6
    },
    paper: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.8
    },
    podcast: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.5
    },
    video: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.4
    },
    social: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.3
    }
  },
  // Topic-specific discovery settings
  topicSensitivity: {
    // How sensitive to be to topic matching (0-1)
    sensitivity: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.6
    },
    // Boost factor for preferred topics
    preferredTopicBoost: {
      type: Number,
      min: 1,
      max: 3,
      default: 1.5
    },
    // Penalty factor for non-preferred topics
    nonPreferredTopicPenalty: {
      type: Number,
      min: 0.1,
      max: 1,
      default: 0.7
    }
  },
  // Temporal discovery settings
  temporalSettings: {
    // Boost factor for recent content (within 24 hours)
    recentContentBoost: {
      type: Number,
      min: 1,
      max: 3,
      default: 1.3
    },
    // Penalty factor for old content (older than 30 days)
    oldContentPenalty: {
      type: Number,
      min: 0.1,
      max: 1,
      default: 0.8
    },
    // Enable breaking news detection
    enableBreakingNewsDetection: {
      type: Boolean,
      default: true
    }
  },
  // Quality filters
  qualityFilters: {
    // Minimum source credibility score (0-1)
    minSourceCredibility: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.3
    },
    // Enable duplicate content filtering
    enableDuplicateFiltering: {
      type: Boolean,
      default: true
    },
    // Minimum content length (characters)
    minContentLength: {
      type: Number,
      min: 0,
      default: 100
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
discoverySettingsSchema.pre('save', function(next) {
  this.updated = Date.now();
  next();
});

// Method to calculate effective threshold for a specific content type and context
discoverySettingsSchema.methods.calculateEffectiveThreshold = function(contentType, context = {}) {
  let baseThreshold = this.contentTypeThresholds[contentType] || this.autoInclusionThreshold;
  
  // Apply aggressiveness level adjustment (higher aggressiveness = lower threshold)
  const aggressivenessAdjustment = (0.5 - this.aggressivenessLevel) * 0.4; // -0.2 to +0.2
  baseThreshold = Math.max(0, Math.min(1, baseThreshold + aggressivenessAdjustment));
  
  // Apply topic sensitivity adjustments
  if (context.isPreferredTopic) {
    baseThreshold /= this.topicSensitivity.preferredTopicBoost; // Lower threshold for preferred topics
  } else if (context.isNonPreferredTopic) {
    baseThreshold /= this.topicSensitivity.nonPreferredTopicPenalty; // Higher threshold for non-preferred topics (penalty < 1)
  }
  
  // Apply temporal adjustments
  if (context.isRecent) {
    baseThreshold /= this.temporalSettings.recentContentBoost; // Lower threshold for recent content
  } else if (context.isOld) {
    baseThreshold /= this.temporalSettings.oldContentPenalty; // Higher threshold for old content (penalty < 1)
  }
  
  return Math.max(0, Math.min(1, baseThreshold));
};

// Method to determine if content should be auto-included
discoverySettingsSchema.methods.shouldAutoInclude = function(content, relevanceScore, context = {}) {
  const effectiveThreshold = this.calculateEffectiveThreshold(content.type, context);
  
  // Check quality filters
  if (this.qualityFilters.minSourceCredibility > 0 && 
      (content.sourceCredibility || 0) < this.qualityFilters.minSourceCredibility) {
    return false;
  }
  
  if (this.qualityFilters.minContentLength > 0 && 
      (content.contentLength || 0) < this.qualityFilters.minContentLength) {
    return false;
  }
  
  // Breaking news gets special treatment
  if (context.isBreakingNews && this.temporalSettings.enableBreakingNewsDetection) {
    return relevanceScore >= (effectiveThreshold * 0.7); // Lower threshold for breaking news
  }
  
  return relevanceScore >= effectiveThreshold;
};

// Method to determine if content should be queued for manual review
discoverySettingsSchema.methods.shouldQueueForReview = function(content, relevanceScore, context = {}) {
  if (this.shouldAutoInclude(content, relevanceScore, context)) {
    return false; // Already auto-included
  }
  
  // Check quality filters - content that fails quality filters should not be queued
  if (this.qualityFilters.minSourceCredibility > 0 && 
      (content.sourceCredibility || 0) < this.qualityFilters.minSourceCredibility) {
    return false;
  }
  
  if (this.qualityFilters.minContentLength > 0 && 
      (content.contentLength || 0) < this.qualityFilters.minContentLength) {
    return false;
  }
  
  const reviewThreshold = Math.min(
    this.manualReviewThreshold,
    this.calculateEffectiveThreshold(content.type, context)
  );
  
  return relevanceScore >= reviewThreshold;
};

// Method to get discovery configuration for external services
discoverySettingsSchema.methods.getDiscoveryConfig = function() {
  return {
    aggressivenessLevel: this.aggressivenessLevel,
    autoInclusionThreshold: this.autoInclusionThreshold,
    manualReviewThreshold: this.manualReviewThreshold,
    sourceDiscoverySettings: this.sourceDiscoverySettings,
    contentTypeThresholds: this.contentTypeThresholds,
    topicSensitivity: this.topicSensitivity,
    temporalSettings: this.temporalSettings,
    qualityFilters: this.qualityFilters
  };
};

// Method to update settings based on aggressiveness level
discoverySettingsSchema.methods.updateFromAggressivenessLevel = function(level) {
  this.aggressivenessLevel = Math.max(0, Math.min(1, level));
  
  // Adjust thresholds based on aggressiveness (higher aggressiveness = lower thresholds)
  const baseAdjustment = (0.5 - level) * 0.4; // +0.2 to -0.2
  
  this.autoInclusionThreshold = Math.max(0.1, Math.min(0.9, 0.7 + baseAdjustment));
  this.manualReviewThreshold = Math.max(0.05, Math.min(0.8, 0.4 + baseAdjustment));
  
  // Adjust content type thresholds
  Object.keys(this.contentTypeThresholds).forEach(type => {
    const defaultThresholds = {
      article: 0.6,
      paper: 0.8,
      podcast: 0.5,
      video: 0.4,
      social: 0.3
    };
    const defaultThreshold = defaultThresholds[type] || 0.6;
    this.contentTypeThresholds[type] = Math.max(0.1, Math.min(0.9, defaultThreshold + baseAdjustment));
  });
  
  // Adjust discovery depth based on aggressiveness
  this.sourceDiscoverySettings.maxDiscoveryDepth = Math.max(1, Math.min(5, 
    Math.round(2 + (level - 0.5) * 2)
  ));
};

// Static method to get or create settings for a user
discoverySettingsSchema.statics.getOrCreateForUser = async function(userId) {
  let settings = await this.findOne({ userId });
  
  if (!settings) {
    settings = new this({ userId });
    await settings.save();
  }
  
  return settings;
};

module.exports = mongoose.model('DiscoverySettings', discoverySettingsSchema);