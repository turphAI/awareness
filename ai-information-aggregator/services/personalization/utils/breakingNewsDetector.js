const _ = require('lodash');

class BreakingNewsDetector {
  constructor() {
    // Detection thresholds and weights
    this.detectionConfig = {
      // Velocity thresholds (content per time period)
      velocityThresholds: {
        critical: 10, // 10+ articles in 1 hour
        high: 5,      // 5+ articles in 1 hour
        medium: 3     // 3+ articles in 1 hour
      },
      
      // Engagement velocity thresholds
      engagementThresholds: {
        critical: 1000, // 1000+ interactions in 1 hour
        high: 500,      // 500+ interactions in 1 hour
        medium: 200     // 200+ interactions in 1 hour
      },

      // Keywords that indicate breaking news
      breakingKeywords: [
        'breaking', 'urgent', 'alert', 'emergency', 'developing',
        'just in', 'live', 'update', 'confirmed', 'reports',
        'explosion', 'attack', 'earthquake', 'fire', 'crash',
        'death', 'killed', 'injured', 'missing', 'rescue'
      ],

      // Source credibility weights
      sourceWeights: {
        'reuters': 1.0,
        'ap': 1.0,
        'bbc': 0.95,
        'cnn': 0.9,
        'nytimes': 0.95,
        'washingtonpost': 0.9,
        'guardian': 0.9,
        'default': 0.5
      },

      // Time windows for analysis (in minutes)
      timeWindows: {
        immediate: 15,  // 15 minutes
        short: 60,      // 1 hour
        medium: 240,    // 4 hours
        long: 1440      // 24 hours
      },

      // Minimum score for breaking news classification
      breakingNewsThreshold: 0.7,
      
      // Notification cooldown (minutes)
      notificationCooldown: 30
    };

    // Content tracking for velocity analysis
    this.contentTracker = new Map(); // topic -> content[]
    this.engagementTracker = new Map(); // contentId -> engagement[]
    this.notificationHistory = new Map(); // userId -> notifications[]
  }

  /**
   * Analyze content for breaking news potential
   * @param {Object} content - Content to analyze
   * @param {Object} context - Additional context (engagement, related content)
   * @returns {Promise<Object>} Breaking news analysis
   */
  async analyzeContent(content, context = {}) {
    try {
      const analysis = {
        contentId: content.id,
        timestamp: new Date(),
        scores: {},
        factors: [],
        priority: 'normal',
        isBreakingNews: false,
        confidence: 0,
        recommendedActions: []
      };

      // Calculate individual scores
      analysis.scores.velocity = this.calculateVelocityScore(content, context);
      analysis.scores.engagement = this.calculateEngagementScore(content, context);
      analysis.scores.keywords = this.calculateKeywordScore(content);
      analysis.scores.source = this.calculateSourceScore(content);
      analysis.scores.recency = this.calculateRecencyScore(content);
      analysis.scores.uniqueness = this.calculateUniquenessScore(content, context);

      // Calculate composite score
      const compositeScore = this.calculateCompositeScore(analysis.scores);
      analysis.compositeScore = compositeScore;

      // Determine priority and breaking news status
      analysis.priority = this.determinePriority(compositeScore, analysis.scores);
      analysis.isBreakingNews = compositeScore >= this.detectionConfig.breakingNewsThreshold;
      analysis.confidence = this.calculateConfidence(analysis.scores, context);

      // Identify contributing factors
      analysis.factors = this.identifyContributingFactors(analysis.scores);

      // Generate recommended actions
      analysis.recommendedActions = this.generateRecommendedActions(analysis);

      // Track content for velocity analysis
      this.trackContent(content, analysis);

      return analysis;
    } catch (error) {
      throw new Error(`Failed to analyze content for breaking news: ${error.message}`);
    }
  }

  /**
   * Calculate velocity score based on similar content frequency
   * @param {Object} content - Content to analyze
   * @param {Object} context - Additional context
   * @returns {number} Velocity score (0-1)
   */
  calculateVelocityScore(content, context) {
    if (!content.topics || content.topics.length === 0) {
      return 0;
    }

    const primaryTopic = content.topics[0];
    const relatedContent = this.getRelatedContent(primaryTopic, this.detectionConfig.timeWindows.short);
    
    if (relatedContent.length === 0) {
      return 0;
    }

    const contentCount = relatedContent.length;
    
    if (contentCount >= this.detectionConfig.velocityThresholds.critical) {
      return 1.0;
    } else if (contentCount >= this.detectionConfig.velocityThresholds.high) {
      return 0.8;
    } else if (contentCount >= this.detectionConfig.velocityThresholds.medium) {
      return 0.6;
    } else {
      return Math.min(contentCount / this.detectionConfig.velocityThresholds.medium, 0.4);
    }
  }

  /**
   * Calculate engagement velocity score
   * @param {Object} content - Content to analyze
   * @param {Object} context - Additional context
   * @returns {number} Engagement score (0-1)
   */
  calculateEngagementScore(content, context) {
    const engagement = context.engagement || content.metrics;
    
    if (!engagement) {
      return 0;
    }

    // Calculate engagement velocity (interactions per hour)
    const contentAge = this.getContentAge(content);
    const ageInHours = Math.max(contentAge / (60 * 60 * 1000), 0.1); // Minimum 0.1 hours
    
    const totalEngagement = (engagement.likes || 0) + 
                           (engagement.shares || 0) * 2 + 
                           (engagement.comments || 0) * 1.5;
    
    const engagementVelocity = totalEngagement / ageInHours;

    if (engagementVelocity >= this.detectionConfig.engagementThresholds.critical) {
      return 1.0;
    } else if (engagementVelocity >= this.detectionConfig.engagementThresholds.high) {
      return 0.8;
    } else if (engagementVelocity >= this.detectionConfig.engagementThresholds.medium) {
      return 0.6;
    } else {
      return Math.min(engagementVelocity / this.detectionConfig.engagementThresholds.medium, 0.4);
    }
  }

  /**
   * Calculate keyword-based breaking news score
   * @param {Object} content - Content to analyze
   * @returns {number} Keyword score (0-1)
   */
  calculateKeywordScore(content) {
    const text = `${content.title || ''} ${content.description || ''} ${content.content || ''}`.toLowerCase();
    
    let keywordScore = 0;
    let matchCount = 0;

    this.detectionConfig.breakingKeywords.forEach(keyword => {
      if (text.includes(keyword.toLowerCase())) {
        matchCount++;
        // Weight keywords by importance
        if (['breaking', 'urgent', 'alert', 'emergency'].includes(keyword)) {
          keywordScore += 0.3;
        } else if (['developing', 'just in', 'live', 'confirmed'].includes(keyword)) {
          keywordScore += 0.2;
        } else {
          keywordScore += 0.1;
        }
      }
    });

    // Bonus for multiple keyword matches
    if (matchCount > 1) {
      keywordScore += Math.min(matchCount * 0.1, 0.3);
    }

    return Math.min(keywordScore, 1);
  }

  /**
   * Calculate source credibility score
   * @param {Object} content - Content to analyze
   * @returns {number} Source score (0-1)
   */
  calculateSourceScore(content) {
    if (!content.source || !content.source.name) {
      return this.detectionConfig.sourceWeights.default;
    }

    const sourceName = content.source.name.toLowerCase();
    
    // Check for exact matches first
    for (const [source, weight] of Object.entries(this.detectionConfig.sourceWeights)) {
      if (source !== 'default' && sourceName.includes(source)) {
        return weight;
      }
    }

    // Use source credibility score if available
    if (content.source.credibilityScore !== undefined) {
      return content.source.credibilityScore;
    }

    return this.detectionConfig.sourceWeights.default;
  }

  /**
   * Calculate recency score
   * @param {Object} content - Content to analyze
   * @returns {number} Recency score (0-1)
   */
  calculateRecencyScore(content) {
    const contentAge = this.getContentAge(content);
    const ageInMinutes = contentAge / (60 * 1000);

    if (ageInMinutes <= this.detectionConfig.timeWindows.immediate) {
      return 1.0; // Very recent
    } else if (ageInMinutes <= this.detectionConfig.timeWindows.short) {
      return 0.8; // Recent
    } else if (ageInMinutes <= this.detectionConfig.timeWindows.medium) {
      return 0.6; // Moderately recent
    } else if (ageInMinutes <= this.detectionConfig.timeWindows.long) {
      return 0.3; // Old but within 24 hours
    } else {
      return 0.1; // Very old
    }
  }

  /**
   * Calculate uniqueness score (how different this content is)
   * @param {Object} content - Content to analyze
   * @param {Object} context - Additional context
   * @returns {number} Uniqueness score (0-1)
   */
  calculateUniquenessScore(content, context) {
    if (!content.topics || content.topics.length === 0) {
      return 0.5; // Neutral for unknown topics
    }

    const primaryTopic = content.topics[0];
    const recentContent = this.getRelatedContent(primaryTopic, this.detectionConfig.timeWindows.medium);
    
    if (recentContent.length === 0) {
      return 1.0; // Completely unique topic
    }

    // Calculate content similarity (simplified)
    const similarityScores = recentContent.map(relatedContent => 
      this.calculateContentSimilarity(content, relatedContent)
    );

    const avgSimilarity = _.mean(similarityScores);
    return Math.max(0, 1 - avgSimilarity); // Higher uniqueness = lower similarity
  }

  /**
   * Calculate composite breaking news score
   * @param {Object} scores - Individual component scores
   * @returns {number} Composite score (0-1)
   */
  calculateCompositeScore(scores) {
    const weights = {
      velocity: 0.25,
      engagement: 0.2,
      keywords: 0.2,
      source: 0.15,
      recency: 0.15,
      uniqueness: 0.05
    };

    return Object.keys(weights).reduce((total, key) => {
      return total + (scores[key] || 0) * weights[key];
    }, 0);
  }

  /**
   * Determine priority level
   * @param {number} compositeScore - Composite breaking news score
   * @param {Object} scores - Individual scores
   * @returns {string} Priority level
   */
  determinePriority(compositeScore, scores) {
    if (compositeScore >= 0.9 || scores.keywords >= 0.8) {
      return 'critical';
    } else if (compositeScore >= 0.7 || scores.velocity >= 0.8) {
      return 'high';
    } else if (compositeScore >= 0.5) {
      return 'medium';
    } else {
      return 'normal';
    }
  }

  /**
   * Calculate confidence in the breaking news detection
   * @param {Object} scores - Individual scores
   * @param {Object} context - Additional context
   * @returns {number} Confidence score (0-1)
   */
  calculateConfidence(scores, context) {
    let confidence = 0;

    // Higher confidence with multiple strong signals
    const strongSignals = Object.values(scores).filter(score => score >= 0.7).length;
    confidence += Math.min(strongSignals * 0.2, 0.6);

    // Higher confidence with source credibility
    if (scores.source >= 0.9) {
      confidence += 0.2;
    }

    // Higher confidence with engagement data
    if (context.engagement && Object.keys(context.engagement).length > 0) {
      confidence += 0.1;
    }

    // Higher confidence with keyword matches
    if (scores.keywords >= 0.5) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1);
  }

  /**
   * Identify factors contributing to breaking news score
   * @param {Object} scores - Individual scores
   * @returns {Array} Contributing factors
   */
  identifyContributingFactors(scores) {
    const factors = [];

    if (scores.velocity >= 0.6) {
      factors.push('High content velocity detected');
    }
    if (scores.engagement >= 0.6) {
      factors.push('High engagement velocity');
    }
    if (scores.keywords >= 0.5) {
      factors.push('Breaking news keywords present');
    }
    if (scores.source >= 0.8) {
      factors.push('High credibility source');
    }
    if (scores.recency >= 0.8) {
      factors.push('Very recent content');
    }
    if (scores.uniqueness >= 0.7) {
      factors.push('Unique or novel topic');
    }

    return factors;
  }

  /**
   * Generate recommended actions based on analysis
   * @param {Object} analysis - Breaking news analysis
   * @returns {Array} Recommended actions
   */
  generateRecommendedActions(analysis) {
    const actions = [];

    if (analysis.isBreakingNews) {
      actions.push('Send immediate notifications to interested users');
      
      if (analysis.priority === 'critical') {
        actions.push('Escalate to editorial team');
        actions.push('Consider push notifications');
      }
      
      if (analysis.priority === 'high') {
        actions.push('Feature in breaking news section');
        actions.push('Send email alerts to subscribers');
      }
    }

    if (analysis.scores.velocity >= 0.6) {
      actions.push('Monitor for developing story');
      actions.push('Aggregate related content');
    }

    if (analysis.confidence < 0.5) {
      actions.push('Require manual review before notification');
    }

    return actions;
  }

  /**
   * Check if user should be notified about breaking news
   * @param {string} userId - User ID
   * @param {Object} content - Content to notify about
   * @param {Object} analysis - Breaking news analysis
   * @param {Object} userProfile - User's interest profile
   * @returns {Promise<Object>} Notification decision
   */
  async shouldNotifyUser(userId, content, analysis, userProfile) {
    try {
      const decision = {
        shouldNotify: false,
        reason: '',
        notificationType: 'none',
        priority: analysis.priority,
        cooldownActive: false
      };

      // Check if breaking news
      if (!analysis.isBreakingNews) {
        decision.reason = 'Content not classified as breaking news';
        return decision;
      }

      // Check notification cooldown
      if (this.isNotificationCooldownActive(userId, content)) {
        decision.cooldownActive = true;
        decision.reason = 'Notification cooldown active';
        return decision;
      }

      // Check user interest relevance
      const relevanceScore = this.calculateUserRelevance(content, userProfile);
      if (relevanceScore < 0.3) {
        decision.reason = 'Content not relevant to user interests';
        return decision;
      }

      // Determine notification type based on priority and relevance
      if (analysis.priority === 'critical' && relevanceScore >= 0.7) {
        decision.shouldNotify = true;
        decision.notificationType = 'push';
        decision.reason = 'Critical breaking news relevant to user';
      } else if (analysis.priority === 'high' && relevanceScore >= 0.5) {
        decision.shouldNotify = true;
        decision.notificationType = 'email';
        decision.reason = 'High priority breaking news relevant to user';
      } else if (relevanceScore >= 0.6) {
        decision.shouldNotify = true;
        decision.notificationType = 'in-app';
        decision.reason = 'Breaking news relevant to user interests';
      } else {
        decision.reason = 'Relevance score too low for notification';
      }

      return decision;
    } catch (error) {
      throw new Error(`Failed to determine notification decision: ${error.message}`);
    }
  }

  /**
   * Send breaking news notification to user
   * @param {string} userId - User ID
   * @param {Object} content - Content to notify about
   * @param {Object} analysis - Breaking news analysis
   * @param {string} notificationType - Type of notification
   * @returns {Promise<Object>} Notification result
   */
  async sendNotification(userId, content, analysis, notificationType) {
    try {
      const notification = {
        id: `breaking_${content.id}_${Date.now()}`,
        userId,
        contentId: content.id,
        type: notificationType,
        priority: analysis.priority,
        title: this.generateNotificationTitle(content, analysis),
        message: this.generateNotificationMessage(content, analysis),
        timestamp: new Date(),
        delivered: false,
        opened: false
      };

      // Record notification (in real implementation, this would send to notification service)
      this.recordNotification(userId, notification);

      // Simulate notification delivery
      notification.delivered = true;

      return {
        success: true,
        notification,
        deliveryMethod: notificationType
      };
    } catch (error) {
      throw new Error(`Failed to send notification: ${error.message}`);
    }
  }

  /**
   * Get content age in milliseconds
   * @param {Object} content - Content object
   * @returns {number} Age in milliseconds
   */
  getContentAge(content) {
    const publishedAt = content.publishedAt || content.createdAt || new Date();
    return Date.now() - new Date(publishedAt).getTime();
  }

  /**
   * Get related content for a topic within time window
   * @param {string} topic - Topic to search for
   * @param {number} timeWindowMinutes - Time window in minutes
   * @returns {Array} Related content
   */
  getRelatedContent(topic, timeWindowMinutes) {
    const topicContent = this.contentTracker.get(topic) || [];
    const cutoffTime = Date.now() - (timeWindowMinutes * 60 * 1000);
    
    return topicContent.filter(content => 
      new Date(content.timestamp).getTime() > cutoffTime
    );
  }

  /**
   * Calculate content similarity (simplified)
   * @param {Object} content1 - First content
   * @param {Object} content2 - Second content
   * @returns {number} Similarity score (0-1)
   */
  calculateContentSimilarity(content1, content2) {
    // Simplified similarity based on topic overlap
    const topics1 = new Set(content1.topics || []);
    const topics2 = new Set(content2.topics || []);
    
    const intersection = new Set([...topics1].filter(x => topics2.has(x)));
    const union = new Set([...topics1, ...topics2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Calculate user relevance for content
   * @param {Object} content - Content to evaluate
   * @param {Object} userProfile - User's interest profile
   * @returns {number} Relevance score (0-1)
   */
  calculateUserRelevance(content, userProfile) {
    if (!userProfile || !content.topics) {
      return 0.5; // Neutral relevance
    }

    let relevanceScore = 0;
    let matchCount = 0;

    // Check topic matches
    if (userProfile.topics) {
      content.topics.forEach(topic => {
        const userInterest = userProfile.topics.find(t => 
          t.topic.toLowerCase() === topic.toLowerCase()
        );
        if (userInterest) {
          relevanceScore += userInterest.weight;
          matchCount++;
        }
      });
    }

    // Check category matches
    if (userProfile.categories && content.categories) {
      content.categories.forEach(category => {
        const userInterest = userProfile.categories.find(c => 
          c.category.toLowerCase() === category.toLowerCase()
        );
        if (userInterest) {
          relevanceScore += userInterest.weight * 0.8; // Slightly lower weight for categories
          matchCount++;
        }
      });
    }

    return matchCount > 0 ? relevanceScore / matchCount : 0;
  }

  /**
   * Check if notification cooldown is active
   * @param {string} userId - User ID
   * @param {Object} content - Content to check
   * @returns {boolean} Whether cooldown is active
   */
  isNotificationCooldownActive(userId, content) {
    const userNotifications = this.notificationHistory.get(userId) || [];
    const cooldownTime = this.detectionConfig.notificationCooldown * 60 * 1000;
    const cutoffTime = Date.now() - cooldownTime;

    // Check for recent notifications about similar topics
    const recentSimilarNotifications = userNotifications.filter(notification => {
      if (new Date(notification.timestamp).getTime() <= cutoffTime) {
        return false;
      }
      
      // Check if topics overlap
      const notificationTopics = notification.content?.topics || [];
      const contentTopics = content.topics || [];
      
      return notificationTopics.some(topic => 
        contentTopics.includes(topic)
      );
    });

    return recentSimilarNotifications.length > 0;
  }

  /**
   * Generate notification title
   * @param {Object} content - Content object
   * @param {Object} analysis - Breaking news analysis
   * @returns {string} Notification title
   */
  generateNotificationTitle(content, analysis) {
    const priorityPrefix = {
      critical: '🚨 URGENT: ',
      high: '⚡ Breaking: ',
      medium: '📰 News: ',
      normal: ''
    };

    return `${priorityPrefix[analysis.priority]}${content.title}`;
  }

  /**
   * Generate notification message
   * @param {Object} content - Content object
   * @param {Object} analysis - Breaking news analysis
   * @returns {string} Notification message
   */
  generateNotificationMessage(content, analysis) {
    const description = content.description || content.summary || '';
    const truncatedDescription = description.length > 100 ? 
      description.substring(0, 100) + '...' : description;
    
    return truncatedDescription || 'Breaking news update available';
  }

  /**
   * Track content for velocity analysis
   * @param {Object} content - Content to track
   * @param {Object} analysis - Analysis results
   */
  trackContent(content, analysis) {
    if (!content.topics || content.topics.length === 0) {
      return;
    }

    content.topics.forEach(topic => {
      if (!this.contentTracker.has(topic)) {
        this.contentTracker.set(topic, []);
      }
      
      const topicContent = this.contentTracker.get(topic);
      topicContent.push({
        contentId: content.id,
        timestamp: new Date(),
        analysis
      });

      // Keep only recent content (last 24 hours)
      const cutoffTime = Date.now() - (24 * 60 * 60 * 1000);
      const recentContent = topicContent.filter(item => 
        new Date(item.timestamp).getTime() > cutoffTime
      );
      
      this.contentTracker.set(topic, recentContent);
    });
  }

  /**
   * Record notification for tracking
   * @param {string} userId - User ID
   * @param {Object} notification - Notification object
   */
  recordNotification(userId, notification) {
    if (!this.notificationHistory.has(userId)) {
      this.notificationHistory.set(userId, []);
    }

    const userNotifications = this.notificationHistory.get(userId);
    userNotifications.push({
      ...notification,
      content: {
        topics: notification.content?.topics || []
      }
    });

    // Keep only recent notifications (last 7 days)
    const cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const recentNotifications = userNotifications.filter(n => 
      new Date(n.timestamp).getTime() > cutoffTime
    );
    
    this.notificationHistory.set(userId, recentNotifications);
  }

  /**
   * Get detection configuration
   * @returns {Object} Current detection configuration
   */
  getDetectionConfig() {
    return { ...this.detectionConfig };
  }

  /**
   * Update detection configuration
   * @param {Object} config - New configuration
   */
  updateDetectionConfig(config) {
    this.detectionConfig = { ...this.detectionConfig, ...config };
  }

  /**
   * Get breaking news statistics
   * @returns {Object} Statistics about breaking news detection
   */
  getStatistics() {
    const stats = {
      totalTrackedTopics: this.contentTracker.size,
      totalNotificationsSent: 0,
      notificationsByPriority: {
        critical: 0,
        high: 0,
        medium: 0,
        normal: 0
      },
      activeUsers: this.notificationHistory.size
    };

    // Count notifications by priority
    for (const notifications of this.notificationHistory.values()) {
      stats.totalNotificationsSent += notifications.length;
      notifications.forEach(notification => {
        stats.notificationsByPriority[notification.priority]++;
      });
    }

    return stats;
  }

  /**
   * Clear tracking data (for testing or maintenance)
   */
  clearTrackingData() {
    this.contentTracker.clear();
    this.engagementTracker.clear();
    this.notificationHistory.clear();
  }
}

module.exports = BreakingNewsDetector;