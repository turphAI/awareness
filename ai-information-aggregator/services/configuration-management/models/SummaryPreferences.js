const mongoose = require('mongoose');

const summaryPreferencesSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    unique: true,
    index: true
  },
  defaultLength: {
    type: String,
    enum: ['brief', 'standard', 'detailed', 'comprehensive'],
    default: 'standard'
  },
  contentTypePreferences: {
    article: {
      length: {
        type: String,
        enum: ['brief', 'standard', 'detailed', 'comprehensive'],
        default: 'standard'
      },
      includeKeyInsights: {
        type: Boolean,
        default: true
      },
      includeReferences: {
        type: Boolean,
        default: true
      }
    },
    paper: {
      length: {
        type: String,
        enum: ['brief', 'standard', 'detailed', 'comprehensive'],
        default: 'detailed'
      },
      includeMethodology: {
        type: Boolean,
        default: true
      },
      includeResults: {
        type: Boolean,
        default: true
      },
      includeKeyInsights: {
        type: Boolean,
        default: true
      },
      includeReferences: {
        type: Boolean,
        default: true
      }
    },
    podcast: {
      length: {
        type: String,
        enum: ['brief', 'standard', 'detailed', 'comprehensive'],
        default: 'standard'
      },
      includeTimestamps: {
        type: Boolean,
        default: true
      },
      includeKeyInsights: {
        type: Boolean,
        default: true
      },
      includeReferences: {
        type: Boolean,
        default: true
      }
    },
    video: {
      length: {
        type: String,
        enum: ['brief', 'standard', 'detailed', 'comprehensive'],
        default: 'standard'
      },
      includeVisualElements: {
        type: Boolean,
        default: true
      },
      includeKeyInsights: {
        type: Boolean,
        default: true
      },
      includeReferences: {
        type: Boolean,
        default: true
      }
    },
    social: {
      length: {
        type: String,
        enum: ['brief', 'standard', 'detailed', 'comprehensive'],
        default: 'brief'
      },
      includeContext: {
        type: Boolean,
        default: true
      },
      includeReferences: {
        type: Boolean,
        default: false
      }
    }
  },
  lengthParameters: {
    brief: {
      maxWords: {
        type: Number,
        default: 50,
        min: 20,
        max: 100
      },
      maxSentences: {
        type: Number,
        default: 3,
        min: 1,
        max: 5
      }
    },
    standard: {
      maxWords: {
        type: Number,
        default: 150,
        min: 100,
        max: 250
      },
      maxSentences: {
        type: Number,
        default: 8,
        min: 5,
        max: 12
      }
    },
    detailed: {
      maxWords: {
        type: Number,
        default: 300,
        min: 250,
        max: 500
      },
      maxSentences: {
        type: Number,
        default: 15,
        min: 12,
        max: 25
      }
    },
    comprehensive: {
      maxWords: {
        type: Number,
        default: 500,
        min: 400,
        max: 1000
      },
      maxSentences: {
        type: Number,
        default: 25,
        min: 20,
        max: 50
      }
    }
  },
  adaptiveSettings: {
    enabled: {
      type: Boolean,
      default: true
    },
    basedOnReadingSpeed: {
      type: Boolean,
      default: true
    },
    basedOnEngagement: {
      type: Boolean,
      default: true
    },
    basedOnTimeAvailable: {
      type: Boolean,
      default: true
    }
  },
  userBehaviorMetrics: {
    averageReadingSpeed: {
      type: Number, // words per minute
      default: 200
    },
    preferredSummaryLength: {
      type: String,
      enum: ['brief', 'standard', 'detailed', 'comprehensive'],
      default: 'standard'
    },
    engagementWithSummaries: {
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
summaryPreferencesSchema.pre('save', function(next) {
  this.updated = Date.now();
  next();
});

// Method to get summary parameters for specific content type
summaryPreferencesSchema.methods.getSummaryParameters = function(contentType, overrideLength = null) {
  const lengthType = overrideLength || this.contentTypePreferences[contentType]?.length || this.defaultLength;
  const lengthParams = this.lengthParameters[lengthType];
  const contentPrefs = this.contentTypePreferences[contentType] || {};
  
  return {
    length: lengthType,
    maxWords: lengthParams.maxWords,
    maxSentences: lengthParams.maxSentences,
    includeKeyInsights: contentPrefs.includeKeyInsights !== false,
    includeReferences: contentPrefs.includeReferences !== false,
    includeMethodology: contentPrefs.includeMethodology || false,
    includeResults: contentPrefs.includeResults || false,
    includeTimestamps: contentPrefs.includeTimestamps || false,
    includeVisualElements: contentPrefs.includeVisualElements || false,
    includeContext: contentPrefs.includeContext || false
  };
};

// Method to calculate adaptive summary length based on user behavior
summaryPreferencesSchema.methods.calculateAdaptiveLength = function(contentType, userContext = {}) {
  if (!this.adaptiveSettings.enabled) {
    return this.contentTypePreferences[contentType]?.length || this.defaultLength;
  }

  let baseLength = this.contentTypePreferences[contentType]?.length || this.defaultLength;
  const lengthOrder = ['brief', 'standard', 'detailed', 'comprehensive'];
  let currentIndex = lengthOrder.indexOf(baseLength);
  
  // Adjust based on reading speed
  if (this.adaptiveSettings.basedOnReadingSpeed && this.userBehaviorMetrics.averageReadingSpeed) {
    const readingSpeed = this.userBehaviorMetrics.averageReadingSpeed;
    if (readingSpeed > 250) {
      // Fast reader - can handle longer summaries
      currentIndex = Math.min(currentIndex + 1, lengthOrder.length - 1);
    } else if (readingSpeed < 150) {
      // Slow reader - prefer shorter summaries
      currentIndex = Math.max(currentIndex - 1, 0);
    }
  }
  
  // Adjust based on engagement
  if (this.adaptiveSettings.basedOnEngagement && this.userBehaviorMetrics.engagementWithSummaries) {
    const engagement = this.userBehaviorMetrics.engagementWithSummaries;
    if (engagement > 0.7) {
      // High engagement - can handle longer summaries
      currentIndex = Math.min(currentIndex + 1, lengthOrder.length - 1);
    } else if (engagement < 0.3) {
      // Low engagement - prefer shorter summaries
      currentIndex = Math.max(currentIndex - 1, 0);
    }
  }
  
  // Adjust based on available time (if provided in context) - this takes priority
  if (this.adaptiveSettings.basedOnTimeAvailable && userContext.availableTimeMinutes) {
    const timeMinutes = userContext.availableTimeMinutes;
    if (timeMinutes < 2) {
      return 'brief'; // Force brief for very short time
    } else if (timeMinutes < 5) {
      currentIndex = Math.min(currentIndex, 1); // Standard or less
    } else if (timeMinutes > 15) {
      currentIndex = Math.min(currentIndex + 1, lengthOrder.length - 1); // Can handle longer
    }
  }
  
  return lengthOrder[currentIndex];
};

// Method to update user behavior metrics
summaryPreferencesSchema.methods.updateBehaviorMetrics = function(metrics) {
  const { averageReadingSpeed, preferredSummaryLength, engagementWithSummaries } = metrics;
  
  if (averageReadingSpeed !== undefined) {
    this.userBehaviorMetrics.averageReadingSpeed = Math.max(50, Math.min(1000, averageReadingSpeed));
  }
  if (preferredSummaryLength !== undefined) {
    this.userBehaviorMetrics.preferredSummaryLength = preferredSummaryLength;
  }
  if (engagementWithSummaries !== undefined) {
    this.userBehaviorMetrics.engagementWithSummaries = Math.max(0, Math.min(1, engagementWithSummaries));
  }
  
  this.userBehaviorMetrics.lastUpdated = Date.now();
};

// Method to validate summary configuration
summaryPreferencesSchema.methods.validateConfiguration = function() {
  const errors = [];
  
  // Validate length parameters
  for (const [lengthType, params] of Object.entries(this.lengthParameters)) {
    if (params.maxWords < 20 || params.maxWords > 1000) {
      errors.push(`Invalid maxWords for ${lengthType}: must be between 20 and 1000`);
    }
    if (params.maxSentences < 1 || params.maxSentences > 50) {
      errors.push(`Invalid maxSentences for ${lengthType}: must be between 1 and 50`);
    }
  }
  
  return errors;
};

// Static method to get or create preferences for a user
summaryPreferencesSchema.statics.getOrCreateForUser = async function(userId) {
  let preferences = await this.findOne({ userId });
  
  if (!preferences) {
    preferences = new this({ userId });
    await preferences.save();
  }
  
  return preferences;
};

module.exports = mongoose.model('SummaryPreferences', summaryPreferencesSchema);