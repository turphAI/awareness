const ContentMetadata = require('../models/ContentMetadata');
const logger = require('../../../common/utils/logger');

/**
 * Content Aging Manager
 * Manages content aging, identifies outdated content, and provides update suggestions
 */
class ContentAgingManager {
  constructor() {
    this.agingRules = {
      // Content type specific aging rules (in days)
      'article': 365,      // News articles become outdated after 1 year
      'academic': 1095,    // Academic papers after 3 years
      'video': 730,        // Videos after 2 years
      'podcast': 180,      // Podcasts after 6 months
      'document': 545,     // Documents after 1.5 years
      'webpage': 365,      // Web pages after 1 year
      'book': 1825,        // Books after 5 years
      'other': 730         // Default 2 years
    };

    this.topicAgingRules = {
      // Topic-specific aging rules (in days)
      'ai': 180,           // AI content becomes outdated quickly
      'llm': 180,          // LLM content becomes outdated quickly
      'machine learning': 365,
      'deep learning': 365,
      'technology': 365,
      'research': 730,
      'methodology': 1095,
      'theory': 1460
    };

    this.freshnessThreshold = 0.3; // Content with freshness score below this is considered for aging
  }

  /**
   * Identify outdated content based on various criteria
   * @param {Object} options - Options for identifying outdated content
   * @returns {Promise<Array>} - Array of outdated content metadata
   */
  async identifyOutdatedContent(options = {}) {
    try {
      const {
        limit = 100,
        contentType = null,
        domain = null,
        forceRecheck = false
      } = options;

      logger.info('Starting outdated content identification', { options });

      // Build query for content to check
      const query = {};
      
      if (contentType) {
        query.contentType = contentType;
      }
      
      if (domain) {
        query['source.domain'] = domain;
      }

      // If not force rechecking, only check content that hasn't been flagged as outdated
      if (!forceRecheck) {
        query['aging.isOutdated'] = { $ne: true };
      }

      const contentToCheck = await ContentMetadata.find(query)
        .sort({ publishedAt: 1 }) // Check oldest content first
        .limit(limit);

      const outdatedContent = [];

      for (const content of contentToCheck) {
        const agingResult = await this.assessContentAging(content);
        
        if (agingResult.isOutdated) {
          // Mark content as outdated
          await content.markOutdated(
            agingResult.reasons,
            agingResult.suggestions
          );
          
          outdatedContent.push({
            contentId: content.contentId,
            title: content.title,
            publishedAt: content.publishedAt,
            reasons: agingResult.reasons,
            suggestions: agingResult.suggestions,
            agingScore: agingResult.agingScore
          });
        } else if (agingResult.nextReviewAt) {
          // Update next review date
          content.aging.nextReviewAt = agingResult.nextReviewAt;
          await content.save();
        }
      }

      logger.info('Completed outdated content identification', {
        totalChecked: contentToCheck.length,
        outdatedFound: outdatedContent.length
      });

      return outdatedContent;
    } catch (error) {
      logger.error('Error identifying outdated content', { error: error.message });
      throw error;
    }
  }

  /**
   * Assess if specific content is outdated
   * @param {Object} contentMetadata - Content metadata document
   * @returns {Promise<Object>} - Aging assessment result
   */
  async assessContentAging(contentMetadata) {
    try {
      const now = new Date();
      const publishedAt = new Date(contentMetadata.publishedAt);
      const daysSincePublished = Math.floor((now - publishedAt) / (1000 * 60 * 60 * 24));

      const assessment = {
        isOutdated: false,
        reasons: [],
        suggestions: [],
        agingScore: 0,
        nextReviewAt: null
      };

      // Check age-based criteria
      const ageResult = this.checkAgeBasedCriteria(contentMetadata, daysSincePublished);
      assessment.agingScore += ageResult.score;
      if (ageResult.isOutdated) {
        assessment.isOutdated = true;
        assessment.reasons.push(...ageResult.reasons);
        assessment.suggestions.push(...ageResult.suggestions);
      }

      // Check freshness score
      const freshnessResult = this.checkFreshnessScore(contentMetadata);
      assessment.agingScore += freshnessResult.score;
      if (freshnessResult.isOutdated) {
        assessment.isOutdated = true;
        assessment.reasons.push(...freshnessResult.reasons);
        assessment.suggestions.push(...freshnessResult.suggestions);
      }

      // Check topic-specific aging
      const topicResult = this.checkTopicSpecificAging(contentMetadata, daysSincePublished);
      assessment.agingScore += topicResult.score;
      if (topicResult.isOutdated) {
        assessment.isOutdated = true;
        assessment.reasons.push(...topicResult.reasons);
        assessment.suggestions.push(...topicResult.suggestions);
      }

      // Check for broken links or references
      const linkResult = await this.checkBrokenReferences(contentMetadata);
      assessment.agingScore += linkResult.score;
      if (linkResult.isOutdated) {
        assessment.isOutdated = true;
        assessment.reasons.push(...linkResult.reasons);
        assessment.suggestions.push(...linkResult.suggestions);
      }

      // Normalize aging score (0-1 scale)
      assessment.agingScore = Math.min(assessment.agingScore / 4, 1);

      // Set next review date if not outdated
      if (!assessment.isOutdated) {
        assessment.nextReviewAt = this.calculateNextReviewDate(contentMetadata, daysSincePublished);
      }

      return assessment;
    } catch (error) {
      logger.error('Error assessing content aging', { 
        contentId: contentMetadata.contentId,
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Check age-based criteria for content aging
   * @param {Object} contentMetadata - Content metadata
   * @param {number} daysSincePublished - Days since content was published
   * @returns {Object} - Age-based assessment result
   */
  checkAgeBasedCriteria(contentMetadata, daysSincePublished) {
    const contentType = contentMetadata.contentType || 'other';
    const maxAge = this.agingRules[contentType] || this.agingRules.other;
    
    const result = {
      isOutdated: false,
      reasons: [],
      suggestions: [],
      score: 0
    };

    if (daysSincePublished > maxAge) {
      result.isOutdated = true;
      result.reasons.push('deprecated_info');
      result.suggestions.push(`Content is ${daysSincePublished} days old, consider updating or verifying information`);
      result.score = 1;
    } else if (daysSincePublished > maxAge * 0.8) {
      // Content is approaching aging threshold
      result.suggestions.push('Content is approaching aging threshold, schedule for review');
      result.score = 0.6;
    } else if (daysSincePublished > maxAge * 0.5) {
      result.score = 0.3;
    }

    return result;
  }

  /**
   * Check freshness score for content aging
   * @param {Object} contentMetadata - Content metadata
   * @returns {Object} - Freshness-based assessment result
   */
  checkFreshnessScore(contentMetadata) {
    const freshnessScore = contentMetadata.freshnessScore || 0.5;
    
    const result = {
      isOutdated: false,
      reasons: [],
      suggestions: [],
      score: 0
    };

    if (freshnessScore < this.freshnessThreshold) {
      result.isOutdated = true;
      result.reasons.push('deprecated_info');
      result.suggestions.push('Content has low freshness score, verify current relevance');
      result.score = 1;
    } else if (freshnessScore < this.freshnessThreshold * 1.5) {
      result.suggestions.push('Freshness score is declining, monitor for updates');
      result.score = 0.5;
    }

    return result;
  }

  /**
   * Check topic-specific aging criteria
   * @param {Object} contentMetadata - Content metadata
   * @param {number} daysSincePublished - Days since content was published
   * @returns {Object} - Topic-based assessment result
   */
  checkTopicSpecificAging(contentMetadata, daysSincePublished) {
    const topics = contentMetadata.topics || [];
    
    const result = {
      isOutdated: false,
      reasons: [],
      suggestions: [],
      score: 0
    };

    // Find the most restrictive aging rule for the content's topics
    let minTopicAge = Infinity;
    let applicableTopic = null;

    for (const topic of topics) {
      const topicLower = topic.toLowerCase();
      for (const [ruleTopic, maxAge] of Object.entries(this.topicAgingRules)) {
        if (topicLower.includes(ruleTopic)) {
          if (maxAge < minTopicAge) {
            minTopicAge = maxAge;
            applicableTopic = ruleTopic;
          }
        }
      }
    }

    if (minTopicAge !== Infinity && daysSincePublished > minTopicAge) {
      result.isOutdated = true;
      result.reasons.push('technology_change');
      result.suggestions.push(`Content about ${applicableTopic} may be outdated due to rapid field evolution`);
      result.score = 1;
    } else if (minTopicAge !== Infinity && daysSincePublished > minTopicAge * 0.7) {
      result.suggestions.push(`Monitor for updates in ${applicableTopic} field`);
      result.score = 0.4;
    }

    return result;
  }

  /**
   * Check for broken references and links
   * @param {Object} contentMetadata - Content metadata
   * @returns {Promise<Object>} - Reference-based assessment result
   */
  async checkBrokenReferences(contentMetadata) {
    const result = {
      isOutdated: false,
      reasons: [],
      suggestions: [],
      score: 0
    };

    // This is a simplified implementation
    // In a real system, you would check actual URLs and references
    const citations = contentMetadata.citations || [];
    const brokenCitations = citations.filter(citation => {
      // Simulate broken link detection
      // In reality, you would make HTTP requests to check URLs
      return citation.url && Math.random() < 0.1; // 10% chance of broken link
    });

    if (brokenCitations.length > 0) {
      result.isOutdated = true;
      result.reasons.push('broken_links');
      result.suggestions.push(`${brokenCitations.length} broken references found, update or remove them`);
      result.score = Math.min(brokenCitations.length / citations.length, 1);
    }

    return result;
  }

  /**
   * Calculate next review date for content
   * @param {Object} contentMetadata - Content metadata
   * @param {number} daysSincePublished - Days since content was published
   * @returns {Date} - Next review date
   */
  calculateNextReviewDate(contentMetadata, daysSincePublished) {
    const contentType = contentMetadata.contentType || 'other';
    const maxAge = this.agingRules[contentType] || this.agingRules.other;
    
    // Calculate review interval based on content age and type
    let reviewInterval;
    if (daysSincePublished < maxAge * 0.3) {
      reviewInterval = Math.floor(maxAge * 0.3); // Review in 30% of max age
    } else if (daysSincePublished < maxAge * 0.6) {
      reviewInterval = Math.floor(maxAge * 0.2); // Review in 20% of max age
    } else {
      reviewInterval = Math.floor(maxAge * 0.1); // Review in 10% of max age
    }

    // Minimum review interval of 30 days
    reviewInterval = Math.max(reviewInterval, 30);

    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + reviewInterval);
    
    return nextReviewDate;
  }

  /**
   * Get content due for review
   * @param {Object} options - Options for finding content due for review
   * @returns {Promise<Array>} - Array of content due for review
   */
  async getContentDueForReview(options = {}) {
    try {
      const {
        limit = 50,
        beforeDate = new Date()
      } = options;

      logger.info('Finding content due for review', { beforeDate, limit });

      const contentDueForReview = await ContentMetadata.findDueForReview(beforeDate)
        .limit(limit);

      return contentDueForReview.map(content => ({
        contentId: content.contentId,
        title: content.title,
        publishedAt: content.publishedAt,
        lastReviewedAt: content.aging.lastReviewedAt,
        nextReviewAt: content.aging.nextReviewAt,
        contentType: content.contentType,
        topics: content.topics
      }));
    } catch (error) {
      logger.error('Error finding content due for review', { error: error.message });
      throw error;
    }
  }

  /**
   * Generate update suggestions for outdated content
   * @param {Object} contentMetadata - Content metadata
   * @returns {Array} - Array of update suggestions
   */
  generateUpdateSuggestions(contentMetadata) {
    const suggestions = [];
    const now = new Date();
    const publishedAt = new Date(contentMetadata.publishedAt);
    const daysSincePublished = Math.floor((now - publishedAt) / (1000 * 60 * 60 * 24));

    // General suggestions based on content type
    const contentType = contentMetadata.contentType || 'other';
    switch (contentType) {
      case 'article':
        suggestions.push('Verify facts and statistics are still current');
        suggestions.push('Check if referenced companies or products still exist');
        suggestions.push('Update any outdated screenshots or examples');
        break;
      case 'academic':
        suggestions.push('Review recent publications in the same field');
        suggestions.push('Check if methodologies are still considered best practice');
        suggestions.push('Verify that cited works are still accessible');
        break;
      case 'video':
        suggestions.push('Check if video content is still accessible');
        suggestions.push('Verify that demonstrated tools/software are still available');
        break;
      case 'podcast':
        suggestions.push('Check if mentioned resources are still available');
        suggestions.push('Verify guest information and affiliations');
        break;
    }

    // Topic-specific suggestions
    const topics = contentMetadata.topics || [];
    if (topics.some(topic => topic.toLowerCase().includes('ai') || topic.toLowerCase().includes('llm'))) {
      suggestions.push('AI/LLM field evolves rapidly - check for newer models or techniques');
      suggestions.push('Verify that mentioned AI tools and services are still available');
    }

    // Age-based suggestions
    if (daysSincePublished > 365) {
      suggestions.push('Content is over a year old - comprehensive review recommended');
    }
    if (daysSincePublished > 730) {
      suggestions.push('Consider creating updated version or marking as historical reference');
    }

    return suggestions;
  }

  /**
   * Mark content as reviewed and up-to-date
   * @param {string} contentId - Content ID
   * @param {Object} reviewData - Review data
   * @returns {Promise<Object>} - Updated content metadata
   */
  async markContentReviewed(contentId, reviewData = {}) {
    try {
      const {
        isUpToDate = true,
        reasons = [],
        suggestions = [],
        nextReviewDate = null
      } = reviewData;

      const contentMetadata = await ContentMetadata.findOne({ contentId });
      if (!contentMetadata) {
        throw new Error('Content metadata not found');
      }

      if (isUpToDate) {
        const calculatedNextReview = nextReviewDate || 
          this.calculateNextReviewDate(contentMetadata, 0);
        await contentMetadata.markUpToDate(calculatedNextReview);
      } else {
        await contentMetadata.markOutdated(reasons, suggestions);
      }

      logger.info('Content review status updated', {
        contentId,
        isUpToDate,
        nextReviewDate: contentMetadata.aging.nextReviewAt
      });

      return contentMetadata;
    } catch (error) {
      logger.error('Error marking content as reviewed', {
        contentId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get aging statistics
   * @returns {Promise<Object>} - Aging statistics
   */
  async getAgingStatistics() {
    try {
      const stats = await ContentMetadata.aggregate([
        {
          $group: {
            _id: null,
            totalContent: { $sum: 1 },
            outdatedContent: {
              $sum: { $cond: ['$aging.isOutdated', 1, 0] }
            },
            dueForReview: {
              $sum: {
                $cond: [
                  { $lte: ['$aging.nextReviewAt', new Date()] },
                  1,
                  0
                ]
              }
            },
            avgDaysSinceReview: {
              $avg: {
                $divide: [
                  { $subtract: [new Date(), '$aging.lastReviewedAt'] },
                  1000 * 60 * 60 * 24
                ]
              }
            }
          }
        }
      ]);

      const typeStats = await ContentMetadata.aggregate([
        {
          $group: {
            _id: '$contentType',
            total: { $sum: 1 },
            outdated: {
              $sum: { $cond: ['$aging.isOutdated', 1, 0] }
            }
          }
        }
      ]);

      const reasonStats = await ContentMetadata.aggregate([
        { $match: { 'aging.isOutdated': true } },
        { $unwind: '$aging.outdatedReasons' },
        {
          $group: {
            _id: '$aging.outdatedReasons',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } }
      ]);

      return {
        overview: stats[0] || {
          totalContent: 0,
          outdatedContent: 0,
          dueForReview: 0,
          avgDaysSinceReview: 0
        },
        byType: typeStats,
        outdatedReasons: reasonStats
      };
    } catch (error) {
      logger.error('Error getting aging statistics', { error: error.message });
      throw error;
    }
  }
}

module.exports = ContentAgingManager;