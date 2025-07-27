const mongoose = require('mongoose');

const notificationSettingsSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  channels: {
    email: {
      enabled: {
        type: Boolean,
        default: true
      },
      frequency: {
        type: String,
        enum: ['immediate', 'hourly', 'daily', 'weekly', 'never'],
        default: 'daily'
      }
    },
    push: {
      enabled: {
        type: Boolean,
        default: false
      },
      frequency: {
        type: String,
        enum: ['immediate', 'hourly', 'daily', 'weekly', 'never'],
        default: 'immediate'
      }
    },
    digest: {
      enabled: {
        type: Boolean,
        default: true
      },
      frequency: {
        type: String,
        enum: ['daily', 'weekly', 'monthly', 'never'],
        default: 'daily'
      },
      time: {
        type: String,
        default: '09:00',
        validate: {
          validator: function(v) {
            return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
          },
          message: 'Time must be in HH:MM format'
        }
      },
      timezone: {
        type: String,
        default: 'UTC'
      }
    }
  },
  contentTypes: {
    breakingNews: {
      type: Boolean,
      default: true
    },
    newContent: {
      type: Boolean,
      default: true
    },
    weeklyDigest: {
      type: Boolean,
      default: true
    },
    systemUpdates: {
      type: Boolean,
      default: true
    }
  },
  quietHours: {
    enabled: {
      type: Boolean,
      default: false
    },
    start: {
      type: String,
      default: '22:00',
      validate: {
        validator: function(v) {
          return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
        },
        message: 'Time must be in HH:MM format'
      }
    },
    end: {
      type: String,
      default: '08:00',
      validate: {
        validator: function(v) {
          return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
        },
        message: 'Time must be in HH:MM format'
      }
    },
    timezone: {
      type: String,
      default: 'UTC'
    }
  }
}, {
  timestamps: true
});

// Index for efficient queries
notificationSettingsSchema.index({ userId: 1 });

// Virtual for getting all notification preferences
notificationSettingsSchema.virtual('allSettings').get(function() {
  return {
    channels: this.channels,
    contentTypes: this.contentTypes,
    quietHours: this.quietHours
  };
});

// Method to check if notifications are allowed at a given time
notificationSettingsSchema.methods.isNotificationAllowed = function(currentTime, timezone = 'UTC') {
  if (!this.quietHours.enabled) {
    return true;
  }

  // Simple time comparison (in production, would use proper timezone handling)
  const current = currentTime || new Date().toLocaleTimeString('en-US', { 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit',
    timeZone: timezone 
  });
  
  const start = this.quietHours.start;
  const end = this.quietHours.end;
  
  // Handle overnight quiet hours (e.g., 22:00 to 08:00)
  if (start > end) {
    return !(current >= start || current <= end);
  }
  
  // Handle same-day quiet hours (e.g., 12:00 to 14:00)
  return !(current >= start && current <= end);
};

// Method to get notification frequency for a specific channel
notificationSettingsSchema.methods.getChannelFrequency = function(channel) {
  if (!this.channels[channel] || !this.channels[channel].enabled) {
    return 'never';
  }
  return this.channels[channel].frequency;
};

// Static method to get default settings for a user
notificationSettingsSchema.statics.getDefaultSettings = function(userId) {
  return {
    userId,
    channels: {
      email: { enabled: true, frequency: 'daily' },
      push: { enabled: false, frequency: 'immediate' },
      digest: { enabled: true, frequency: 'daily', time: '09:00', timezone: 'UTC' }
    },
    contentTypes: {
      breakingNews: true,
      newContent: true,
      weeklyDigest: true,
      systemUpdates: true
    },
    quietHours: {
      enabled: false,
      start: '22:00',
      end: '08:00',
      timezone: 'UTC'
    }
  };
};

module.exports = mongoose.model('NotificationSettings', notificationSettingsSchema);