const mongoose = require('mongoose');

const digestSchedulingSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    unique: true,
    index: true
  },
  enabled: {
    type: Boolean,
    default: true
  },
  frequency: {
    type: String,
    enum: ['daily', 'weekly', 'bi-weekly', 'monthly'],
    default: 'daily'
  },
  deliveryTime: {
    hour: {
      type: Number,
      min: 0,
      max: 23,
      default: 8 // 8 AM
    },
    minute: {
      type: Number,
      min: 0,
      max: 59,
      default: 0
    },
    timezone: {
      type: String,
      default: 'UTC'
    }
  },
  weeklySettings: {
    dayOfWeek: {
      type: Number,
      min: 0, // Sunday
      max: 6, // Saturday
      default: 1 // Monday
    }
  },
  monthlySettings: {
    dayOfMonth: {
      type: Number,
      min: 1,
      max: 31,
      default: 1
    }
  },
  contentSelection: {
    maxItems: {
      type: Number,
      min: 5,
      max: 50,
      default: 20
    },
    prioritizeBreakingNews: {
      type: Boolean,
      default: true
    },
    includePersonalizedContent: {
      type: Boolean,
      default: true
    },
    contentTypes: {
      articles: {
        type: Boolean,
        default: true
      },
      papers: {
        type: Boolean,
        default: true
      },
      podcasts: {
        type: Boolean,
        default: true
      },
      videos: {
        type: Boolean,
        default: false
      },
      social: {
        type: Boolean,
        default: false
      }
    },
    topicFilters: [{
      type: String
    }],
    sourceFilters: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Source'
    }]
  },
  formatting: {
    includeFullSummaries: {
      type: Boolean,
      default: true
    },
    includeThumbnails: {
      type: Boolean,
      default: true
    },
    includeReadingTime: {
      type: Boolean,
      default: true
    },
    groupByTopic: {
      type: Boolean,
      default: true
    },
    sortBy: {
      type: String,
      enum: ['relevance', 'recency', 'popularity'],
      default: 'relevance'
    }
  },
  deliveryMethod: {
    email: {
      enabled: {
        type: Boolean,
        default: false
      },
      address: {
        type: String
      }
    },
    inApp: {
      enabled: {
        type: Boolean,
        default: true
      }
    }
  },
  lastDelivery: {
    type: Date
  },
  nextDelivery: {
    type: Date
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
digestSchedulingSchema.pre('save', function(next) {
  this.updated = Date.now();
  next();
});

// Method to calculate next delivery time
digestSchedulingSchema.methods.calculateNextDelivery = function() {
  if (!this.enabled) {
    return null;
  }

  const now = new Date();
  const nextDelivery = new Date();
  
  // Set the time
  nextDelivery.setHours(this.deliveryTime.hour, this.deliveryTime.minute, 0, 0);
  
  switch (this.frequency) {
    case 'daily':
      // If today's delivery time has passed, schedule for tomorrow
      if (nextDelivery <= now) {
        nextDelivery.setDate(nextDelivery.getDate() + 1);
      }
      break;
      
    case 'weekly':
      // Find next occurrence of the specified day of week
      const targetDay = this.weeklySettings.dayOfWeek;
      const currentDay = nextDelivery.getDay();
      let daysUntilTarget = targetDay - currentDay;
      
      if (daysUntilTarget < 0 || (daysUntilTarget === 0 && nextDelivery <= now)) {
        daysUntilTarget += 7;
      }
      
      nextDelivery.setDate(nextDelivery.getDate() + daysUntilTarget);
      break;
      
    case 'bi-weekly':
      // Similar to weekly but add 14 days if we have a last delivery
      const biWeeklyTargetDay = this.weeklySettings.dayOfWeek;
      const biWeeklyCurrentDay = nextDelivery.getDay();
      let biWeeklyDaysUntilTarget = biWeeklyTargetDay - biWeeklyCurrentDay;
      
      if (this.lastDelivery) {
        const daysSinceLastDelivery = Math.floor((now - this.lastDelivery) / (1000 * 60 * 60 * 24));
        if (daysSinceLastDelivery < 14) {
          // Add remaining days to complete 2 weeks
          biWeeklyDaysUntilTarget += 14 - (daysSinceLastDelivery % 14);
        }
      }
      
      if (biWeeklyDaysUntilTarget <= 0) {
        biWeeklyDaysUntilTarget += 14;
      }
      
      nextDelivery.setDate(nextDelivery.getDate() + biWeeklyDaysUntilTarget);
      break;
      
    case 'monthly':
      // Set to the specified day of month
      nextDelivery.setDate(this.monthlySettings.dayOfMonth);
      
      // If this month's date has passed, move to next month
      if (nextDelivery <= now) {
        nextDelivery.setMonth(nextDelivery.getMonth() + 1);
        nextDelivery.setDate(this.monthlySettings.dayOfMonth);
      }
      
      // Handle months with fewer days
      if (nextDelivery.getDate() !== this.monthlySettings.dayOfMonth) {
        nextDelivery.setDate(0); // Last day of previous month
      }
      break;
  }
  
  return nextDelivery;
};

// Method to update next delivery time
digestSchedulingSchema.methods.updateNextDelivery = function() {
  this.nextDelivery = this.calculateNextDelivery();
  return this.nextDelivery;
};

// Method to mark delivery as completed
digestSchedulingSchema.methods.markDeliveryCompleted = function() {
  this.lastDelivery = new Date();
  this.updateNextDelivery();
};

// Method to validate scheduling configuration
digestSchedulingSchema.methods.validateConfiguration = function() {
  const errors = [];
  
  // Validate delivery time
  if (this.deliveryTime.hour < 0 || this.deliveryTime.hour > 23) {
    errors.push('Invalid delivery hour: must be between 0 and 23');
  }
  if (this.deliveryTime.minute < 0 || this.deliveryTime.minute > 59) {
    errors.push('Invalid delivery minute: must be between 0 and 59');
  }
  
  // Validate weekly settings
  if ((this.frequency === 'weekly' || this.frequency === 'bi-weekly') && 
      (this.weeklySettings.dayOfWeek < 0 || this.weeklySettings.dayOfWeek > 6)) {
    errors.push('Invalid day of week: must be between 0 (Sunday) and 6 (Saturday)');
  }
  
  // Validate monthly settings
  if (this.frequency === 'monthly' && 
      (this.monthlySettings.dayOfMonth < 1 || this.monthlySettings.dayOfMonth > 31)) {
    errors.push('Invalid day of month: must be between 1 and 31');
  }
  
  // Validate content selection
  if (this.contentSelection.maxItems < 5 || this.contentSelection.maxItems > 50) {
    errors.push('Invalid max items: must be between 5 and 50');
  }
  
  // Validate delivery method
  if (!this.deliveryMethod.email.enabled && !this.deliveryMethod.inApp.enabled) {
    errors.push('At least one delivery method must be enabled');
  }
  
  if (this.deliveryMethod.email.enabled && !this.deliveryMethod.email.address) {
    errors.push('Email address is required when email delivery is enabled');
  }
  
  return errors;
};

// Method to get content selection criteria
digestSchedulingSchema.methods.getContentSelectionCriteria = function() {
  const criteria = {
    maxItems: this.contentSelection.maxItems,
    prioritizeBreakingNews: this.contentSelection.prioritizeBreakingNews,
    includePersonalizedContent: this.contentSelection.includePersonalizedContent,
    contentTypes: [],
    topicFilters: this.contentSelection.topicFilters || [],
    sourceFilters: this.contentSelection.sourceFilters || [],
    sortBy: this.formatting.sortBy
  };
  
  // Build content types array
  for (const [type, enabled] of Object.entries(this.contentSelection.contentTypes)) {
    if (enabled) {
      criteria.contentTypes.push(type);
    }
  }
  
  return criteria;
};

// Method to get formatting preferences
digestSchedulingSchema.methods.getFormattingPreferences = function() {
  return {
    includeFullSummaries: this.formatting.includeFullSummaries,
    includeThumbnails: this.formatting.includeThumbnails,
    includeReadingTime: this.formatting.includeReadingTime,
    groupByTopic: this.formatting.groupByTopic,
    sortBy: this.formatting.sortBy
  };
};

// Static method to get or create digest scheduling for a user
digestSchedulingSchema.statics.getOrCreateForUser = async function(userId) {
  let scheduling = await this.findOne({ userId });
  
  if (!scheduling) {
    scheduling = new this({ userId });
    scheduling.updateNextDelivery();
    await scheduling.save();
  }
  
  return scheduling;
};

// Static method to find schedules ready for delivery
digestSchedulingSchema.statics.findReadyForDelivery = async function() {
  const now = new Date();
  return this.find({
    enabled: true,
    nextDelivery: { $lte: now }
  });
};

module.exports = mongoose.model('DigestScheduling', digestSchedulingSchema);