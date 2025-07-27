const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Topic Preference Schema
 * Model for managing user topic preferences and interests
 */
const topicPreferenceSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  topic: {
    type: String,
    required: [true, 'Topic is required'],
    trim: true,
    maxlength: [100, 'Topic cannot exceed 100 characters'],
    index: true
  },
  category: {
    type: String,
    enum: {
      values: ['ai-research', 'machine-learning', 'nlp', 'computer-vision', 'robotics', 'ethics', 'industry-news', 'tools', 'frameworks', 'other'],
      message: 'Category must be one of: ai-research, machine-learning, nlp, computer-vision, robotics, ethics, industry-news, tools, frameworks, other'
    },
    required: [true, 'Category is required'],
    index: true
  },
  priority: {
    type: String,
    enum: {
      values: ['high', 'medium', 'low'],
      message: 'Priority must be high, medium, or low'
    },
    default: 'medium',
    index: true
  },
  weight: {
    type: Number,
    min: [0, 'Weight must be at least 0'],
    max: [1, 'Weight cannot exceed 1'],
    default: 0.5
  },
  keywords: [{
    type: String,
    trim: true,
    lowercase: true,
    maxlength: [50, 'Keyword cannot exceed 50 characters']
  }],
  excludeKeywords: [{
    type: String,
    trim: true,
    lowercase: true,
    maxlength: [50, 'Exclude keyword cannot exceed 50 characters']
  }],
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  source: {
    type: String,
    enum: ['user-defined', 'system-suggested', 'learned-from-behavior'],
    default: 'user-defined'
  },
  confidence: {
    type: Number,
    min: [0, 'Confidence must be at least 0'],
    max: [1, 'Confidence cannot exceed 1'],
    default: 1.0
  },
  lastUsed: {
    type: Date,
    default: null
  },
  usageCount: {
    type: Number,
    default: 0,
    min: 0
  },
  feedback: {
    positive: {
      type: Number,
      default: 0,
      min: 0
    },
    negative: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  metadata: {
    type: Map,
    of: Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Compound indexes for better query performance
topicPreferenceSchema.index({ userId: 1, topic: 1 }, { unique: true });
topicPreferenceSchema.index({ userId: 1, category: 1 });
topicPreferenceSchema.index({ userId: 1, priority: 1, isActive: 1 });
topicPreferenceSchema.index({ userId: 1, weight: -1, isActive: 1 });

/**
 * Update topic usage statistics
 * @returns {Promise<Document>} - Updated topic preference document
 */
topicPreferenceSchema.methods.recordUsage = function() {
  this.usageCount += 1;
  this.lastUsed = new Date();
  return this.save();
};

/**
 * Add positive feedback
 * @returns {Promise<Document>} - Updated topic preference document
 */
topicPreferenceSchema.methods.addPositiveFeedback = function() {
  this.feedback.positive += 1;
  this.confidence = Math.min(1.0, this.confidence + 0.1);
  return this.save();
};

/**
 * Add negative feedback
 * @returns {Promise<Document>} - Updated topic preference document
 */
topicPreferenceSchema.methods.addNegativeFeedback = function() {
  this.feedback.negative += 1;
  this.confidence = Math.max(0.0, this.confidence - 0.1);
  return this.save();
};

/**
 * Update topic weight based on usage and feedback
 * @returns {Promise<Document>} - Updated topic preference document
 */
topicPreferenceSchema.methods.updateWeight = function() {
  const totalFeedback = this.feedback.positive + this.feedback.negative;
  if (totalFeedback > 0) {
    const positiveRatio = this.feedback.positive / totalFeedback;
    // Adjust weight based on feedback ratio and usage count
    const usageFactor = Math.min(1.0, this.usageCount / 100);
    this.weight = (positiveRatio * 0.7) + (usageFactor * 0.3);
  }
  return this.save();
};

/**
 * Add keyword to topic preference
 * @param {string} keyword - Keyword to add
 * @returns {Promise<Document>} - Updated topic preference document
 */
topicPreferenceSchema.methods.addKeyword = function(keyword) {
  const normalizedKeyword = keyword.toLowerCase().trim();
  if (!this.keywords.includes(normalizedKeyword)) {
    this.keywords.push(normalizedKeyword);
  }
  return this.save();
};

/**
 * Remove keyword from topic preference
 * @param {string} keyword - Keyword to remove
 * @returns {Promise<Document>} - Updated topic preference document
 */
topicPreferenceSchema.methods.removeKeyword = function(keyword) {
  const normalizedKeyword = keyword.toLowerCase().trim();
  this.keywords = this.keywords.filter(k => k !== normalizedKeyword);
  return this.save();
};

/**
 * Add exclude keyword to topic preference
 * @param {string} keyword - Keyword to exclude
 * @returns {Promise<Document>} - Updated topic preference document
 */
topicPreferenceSchema.methods.addExcludeKeyword = function(keyword) {
  const normalizedKeyword = keyword.toLowerCase().trim();
  if (!this.excludeKeywords.includes(normalizedKeyword)) {
    this.excludeKeywords.push(normalizedKeyword);
  }
  return this.save();
};

/**
 * Remove exclude keyword from topic preference
 * @param {string} keyword - Keyword to remove from exclusions
 * @returns {Promise<Document>} - Updated topic preference document
 */
topicPreferenceSchema.methods.removeExcludeKeyword = function(keyword) {
  const normalizedKeyword = keyword.toLowerCase().trim();
  this.excludeKeywords = this.excludeKeywords.filter(k => k !== normalizedKeyword);
  return this.save();
};

/**
 * Toggle active status
 * @returns {Promise<Document>} - Updated topic preference document
 */
topicPreferenceSchema.methods.toggleActive = function() {
  this.isActive = !this.isActive;
  return this.save();
};

/**
 * Find topic preferences by user
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @returns {Promise<Array>} - Array of topic preference documents
 */
topicPreferenceSchema.statics.findByUser = function(userId, options = {}) {
  const {
    category = null,
    priority = null,
    isActive = true,
    sortBy = 'weight',
    sortOrder = -1,
    limit = null
  } = options;

  const query = { userId };
  
  if (category) query.category = category;
  if (priority) query.priority = priority;
  if (isActive !== null) query.isActive = isActive;

  let queryBuilder = this.find(query);
  
  // Apply sorting
  const sortObj = {};
  sortObj[sortBy] = sortOrder;
  queryBuilder = queryBuilder.sort(sortObj);
  
  // Apply limit if specified
  if (limit) {
    queryBuilder = queryBuilder.limit(limit);
  }
  
  return queryBuilder;
};

/**
 * Find topic preferences by category
 * @param {string} userId - User ID
 * @param {string} category - Category name
 * @returns {Promise<Array>} - Array of topic preference documents
 */
topicPreferenceSchema.statics.findByCategory = function(userId, category) {
  return this.find({
    userId,
    category,
    isActive: true
  }).sort({ weight: -1 });
};

/**
 * Find high priority topic preferences
 * @param {string} userId - User ID
 * @returns {Promise<Array>} - Array of high priority topic preference documents
 */
topicPreferenceSchema.statics.findHighPriority = function(userId) {
  return this.find({
    userId,
    priority: 'high',
    isActive: true
  }).sort({ weight: -1 });
};

/**
 * Search topic preferences by keyword
 * @param {string} userId - User ID
 * @param {string} keyword - Search keyword
 * @returns {Promise<Array>} - Array of matching topic preference documents
 */
topicPreferenceSchema.statics.searchByKeyword = function(userId, keyword) {
  const normalizedKeyword = keyword.toLowerCase().trim();
  
  return this.find({
    userId,
    isActive: true,
    $or: [
      { topic: { $regex: normalizedKeyword, $options: 'i' } },
      { keywords: normalizedKeyword }
    ]
  }).sort({ weight: -1 });
};

/**
 * Get topic preference statistics for user
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Statistics object
 */
topicPreferenceSchema.statics.getUserStatistics = async function(userId) {
  const stats = await this.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: null,
        totalPreferences: { $sum: 1 },
        activePreferences: {
          $sum: { $cond: ['$isActive', 1, 0] }
        },
        avgWeight: { $avg: '$weight' },
        avgConfidence: { $avg: '$confidence' },
        totalUsage: { $sum: '$usageCount' },
        totalPositiveFeedback: { $sum: '$feedback.positive' },
        totalNegativeFeedback: { $sum: '$feedback.negative' }
      }
    }
  ]);

  const categoryStats = await this.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
        avgWeight: { $avg: '$weight' },
        totalUsage: { $sum: '$usageCount' }
      }
    },
    { $sort: { count: -1 } }
  ]);

  const priorityStats = await this.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: '$priority',
        count: { $sum: 1 },
        avgWeight: { $avg: '$weight' }
      }
    }
  ]);

  return {
    overview: stats[0] || {
      totalPreferences: 0,
      activePreferences: 0,
      avgWeight: 0,
      avgConfidence: 0,
      totalUsage: 0,
      totalPositiveFeedback: 0,
      totalNegativeFeedback: 0
    },
    byCategory: categoryStats,
    byPriority: priorityStats
  };
};

/**
 * Suggest new topics based on user behavior
 * @param {string} userId - User ID
 * @param {Array} recentContent - Array of recent content items
 * @returns {Promise<Array>} - Array of suggested topics
 */
topicPreferenceSchema.statics.suggestTopics = async function(userId, recentContent = []) {
  // Get existing user preferences
  const existingPreferences = await this.find({ userId, isActive: true });
  const existingTopics = existingPreferences.map(p => p.topic.toLowerCase());

  // Extract topics from recent content
  const contentTopics = recentContent.flatMap(content => 
    (content.topics || []).concat(content.categories || [])
  );

  // Count topic frequency
  const topicCounts = {};
  contentTopics.forEach(topic => {
    const normalizedTopic = topic.toLowerCase().trim();
    if (!existingTopics.includes(normalizedTopic)) {
      topicCounts[normalizedTopic] = (topicCounts[normalizedTopic] || 0) + 1;
    }
  });

  // Sort by frequency and return top suggestions
  return Object.entries(topicCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .map(([topic, count]) => ({
      topic,
      frequency: count,
      suggestedCategory: this.categorizeTopicSuggestion(topic),
      suggestedPriority: count > 5 ? 'high' : count > 2 ? 'medium' : 'low'
    }));
};

/**
 * Categorize a topic suggestion
 * @param {string} topic - Topic to categorize
 * @returns {string} - Suggested category
 */
topicPreferenceSchema.statics.categorizeTopicSuggestion = function(topic) {
  const topicLower = topic.toLowerCase();
  
  if (topicLower.includes('research') || topicLower.includes('paper') || topicLower.includes('study')) {
    return 'ai-research';
  } else if (topicLower.includes('ml') || topicLower.includes('machine learning') || topicLower.includes('algorithm')) {
    return 'machine-learning';
  } else if (topicLower.includes('nlp') || topicLower.includes('language') || topicLower.includes('text')) {
    return 'nlp';
  } else if (topicLower.includes('vision') || topicLower.includes('image') || topicLower.includes('visual')) {
    return 'computer-vision';
  } else if (topicLower.includes('robot') || topicLower.includes('automation')) {
    return 'robotics';
  } else if (topicLower.includes('ethic') || topicLower.includes('bias') || topicLower.includes('fair')) {
    return 'ethics';
  } else if (topicLower.includes('tool') || topicLower.includes('software') || topicLower.includes('platform')) {
    return 'tools';
  } else if (topicLower.includes('framework') || topicLower.includes('library') || topicLower.includes('api')) {
    return 'frameworks';
  } else if (topicLower.includes('news') || topicLower.includes('industry') || topicLower.includes('market')) {
    return 'industry-news';
  } else {
    return 'other';
  }
};

// Create model from schema
const TopicPreference = mongoose.model('TopicPreference', topicPreferenceSchema);

module.exports = TopicPreference;