const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

/**
 * User Schema
 * Comprehensive user model with authentication, preferences, and profile data
 */
const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email address']
  },
  passwordHash: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters long'],
    select: false // Don't include password in query results by default
  },
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'editor', 'moderator'],
    default: 'user'
  },
  preferences: {
    topics: [{
      type: String,
      trim: true
    }],
    contentVolume: {
      type: Number,
      default: 10,
      min: 1,
      max: 100
    },
    discoveryAggressiveness: {
      type: Number,
      default: 0.5,
      min: 0,
      max: 1
    },
    summaryLength: {
      type: String,
      enum: ['short', 'medium', 'long'],
      default: 'medium'
    },
    digestFrequency: {
      type: String,
      enum: ['daily', 'weekly', 'never'],
      default: 'daily'
    }
  },
  notifications: {
    email: {
      type: Boolean,
      default: true
    },
    push: {
      type: Boolean,
      default: true
    },
    digest: {
      type: Boolean,
      default: true
    }
  },
  profile: {
    bio: {
      type: String,
      maxlength: [500, 'Bio cannot exceed 500 characters']
    },
    avatar: {
      type: String
    },
    organization: {
      type: String,
      trim: true
    },
    jobTitle: {
      type: String,
      trim: true
    },
    location: {
      type: String,
      trim: true
    },
    website: {
      type: String,
      trim: true,
      match: [
        /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/,
        'Please provide a valid URL'
      ]
    }
  },
  resetPasswordToken: {
    type: String,
    select: false
  },
  resetPasswordExpire: {
    type: Date,
    select: false
  },
  emailVerificationToken: {
    type: String,
    select: false
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  active: {
    type: Boolean,
    default: true,
    select: false
  },
  // New fields for account deletion
  accountDeletionScheduled: {
    type: Date,
    default: null
  },
  accountDeleted: {
    type: Boolean,
    default: false
  },
  accountDeletedAt: {
    type: Date,
    default: null
  },
  // Data retention preferences
  dataRetention: {
    contentHistory: {
      type: Boolean,
      default: true
    },
    searchHistory: {
      type: Boolean,
      default: true
    },
    interactionData: {
      type: Boolean,
      default: true
    },
    usageStatistics: {
      type: Boolean,
      default: true
    }
  },
  // Privacy settings
  privacySettings: {
    shareUsageData: {
      type: Boolean,
      default: true
    },
    allowRecommendations: {
      type: Boolean,
      default: true
    },
    allowContentTracking: {
      type: Boolean,
      default: true
    },
    allowThirdPartySharing: {
      type: Boolean,
      default: false
    }
  },
  // Consent tracking
  consents: [{
    type: {
      type: String,
      enum: ['privacy_policy', 'terms_of_service', 'marketing', 'cookies', 'data_processing'],
      required: true
    },
    version: {
      type: String,
      required: true
    },
    given: {
      type: Boolean,
      default: false
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    ipAddress: {
      type: String
    }
  }]
}, {
  timestamps: true
});

// Indexes for better query performance
userSchema.index({ email: 1 });
userSchema.index({ 'preferences.topics': 1 });
userSchema.index({ active: 1 });
userSchema.index({ accountDeletionScheduled: 1 });
userSchema.index({ accountDeleted: 1 });

/**
 * Pre-save hook to hash password before saving
 */
userSchema.pre('save', async function(next) {
  // Only hash the password if it's modified (or new)
  if (!this.isModified('passwordHash')) return next();
  
  try {
    // Generate salt and hash password
    const salt = await bcrypt.genSalt(10);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    next();
  } catch (error) {
    next(error);
  }
});

/**
 * Compare provided password with stored hash
 * @param {string} candidatePassword - Password to compare
 * @returns {Promise<boolean>} - True if passwords match
 */
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

/**
 * Generate JWT token for authentication
 * @returns {string} - JWT token
 */
userSchema.methods.generateAuthToken = function() {
  return jwt.sign(
    { id: this._id, role: this.role },
    process.env.JWT_SECRET || 'default-jwt-secret-do-not-use-in-production',
    { expiresIn: process.env.JWT_EXPIRATION || '1d' }
  );
};

/**
 * Generate password reset token
 * @returns {string} - Reset token
 */
userSchema.methods.generatePasswordResetToken = function() {
  // Generate random token
  const resetToken = crypto.randomBytes(20).toString('hex');
  
  // Hash token and set to resetPasswordToken field
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  
  // Set token expiration (10 minutes)
  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000;
  
  return resetToken;
};

/**
 * Generate email verification token
 * @returns {string} - Verification token
 */
userSchema.methods.generateEmailVerificationToken = function() {
  // Generate random token
  const verificationToken = crypto.randomBytes(20).toString('hex');
  
  // Hash token and set to emailVerificationToken field
  this.emailVerificationToken = crypto
    .createHash('sha256')
    .update(verificationToken)
    .digest('hex');
  
  return verificationToken;
};

/**
 * Update user preferences
 * @param {Object} preferences - New preferences
 * @returns {Promise<Document>} - Updated user document
 */
userSchema.methods.updatePreferences = function(preferences) {
  this.preferences = { ...this.preferences, ...preferences };
  return this.save();
};

/**
 * Update notification settings
 * @param {Object} settings - New notification settings
 * @returns {Promise<Document>} - Updated user document
 */
userSchema.methods.updateNotificationSettings = function(settings) {
  this.notifications = { ...this.notifications, ...settings };
  return this.save();
};

/**
 * Update user profile
 * @param {Object} profileData - New profile data
 * @returns {Promise<Document>} - Updated user document
 */
userSchema.methods.updateProfile = function(profileData) {
  this.profile = { ...this.profile, ...profileData };
  return this.save();
};

/**
 * Schedule account for deletion
 * @param {number} daysDelay - Number of days before deletion
 * @returns {Promise<Document>} - Updated user document
 */
userSchema.methods.scheduleAccountDeletion = function(daysDelay = 30) {
  const deletionDate = new Date();
  deletionDate.setDate(deletionDate.getDate() + daysDelay);
  
  this.accountDeletionScheduled = deletionDate;
  return this.save();
};

/**
 * Cancel scheduled account deletion
 * @returns {Promise<Document>} - Updated user document
 */
userSchema.methods.cancelAccountDeletion = function() {
  this.accountDeletionScheduled = null;
  return this.save();
};

/**
 * Execute account deletion (anonymize data)
 * @returns {Promise<Document>} - Updated user document
 */
userSchema.methods.executeAccountDeletion = async function() {
  // Generate random string for anonymization
  const randomString = crypto.randomBytes(8).toString('hex');
  
  // Anonymize personal data
  this.email = `deleted-${randomString}@example.com`;
  this.name = 'Deleted User';
  this.passwordHash = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
  this.profile = {};
  this.preferences = {};
  this.notifications = {};
  
  // Mark as deleted
  this.active = false;
  this.accountDeleted = true;
  this.accountDeletedAt = new Date();
  this.accountDeletionScheduled = null;
  
  return this.save();
};

/**
 * Record user consent
 * @param {string} type - Consent type
 * @param {string} version - Policy version
 * @param {boolean} given - Whether consent was given
 * @param {string} ipAddress - User's IP address
 * @returns {Promise<Document>} - Updated user document
 */
userSchema.methods.recordConsent = function(type, version, given, ipAddress) {
  // Remove existing consent of the same type
  this.consents = this.consents.filter(consent => consent.type !== type);
  
  // Add new consent
  this.consents.push({
    type,
    version,
    given,
    timestamp: new Date(),
    ipAddress
  });
  
  return this.save();
};

/**
 * Check if user has given consent
 * @param {string} type - Consent type
 * @returns {boolean} - Whether consent was given
 */
userSchema.methods.hasConsent = function(type) {
  const consent = this.consents.find(c => c.type === type);
  return consent ? consent.given : false;
};

/**
 * Update data retention preferences
 * @param {Object} preferences - New data retention preferences
 * @returns {Promise<Document>} - Updated user document
 */
userSchema.methods.updateDataRetention = function(preferences) {
  this.dataRetention = { ...this.dataRetention, ...preferences };
  return this.save();
};

/**
 * Update privacy settings
 * @param {Object} settings - New privacy settings
 * @returns {Promise<Document>} - Updated user document
 */
userSchema.methods.updatePrivacySettings = function(settings) {
  this.privacySettings = { ...this.privacySettings, ...settings };
  return this.save();
};

/**
 * Find user by email
 * @param {string} email - User email
 * @returns {Promise<Document>} - User document
 */
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase(), active: true });
};

/**
 * Find user by reset password token
 * @param {string} token - Reset token
 * @returns {Promise<Document>} - User document
 */
userSchema.statics.findByResetToken = function(token) {
  const hashedToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
  
  return this.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpire: { $gt: Date.now() },
    active: true
  });
};

/**
 * Find user by email verification token
 * @param {string} token - Verification token
 * @returns {Promise<Document>} - User document
 */
userSchema.statics.findByVerificationToken = function(token) {
  const hashedToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
  
  return this.findOne({
    emailVerificationToken: hashedToken,
    active: true
  });
};

/**
 * Find users scheduled for deletion
 * @returns {Promise<Array>} - Array of user documents
 */
userSchema.statics.findScheduledForDeletion = function() {
  return this.find({
    accountDeletionScheduled: { $lt: new Date() },
    accountDeleted: false,
    active: true
  });
};

// Create model from schema
const User = mongoose.model('User', userSchema);

module.exports = User;