const InterestModeler = require('./interestModeler');
const _ = require('lodash');

class RelevanceScorer {
  constructor() {
    this.interestModeler = new InterestModeler();
    
    // Scoring weights for different factors
    this.scoringWeights = {
      topicMatch: 0.4,
      categoryMatch: 0.3,
      sourceTypeMatch: 0.15,
      recency: 0.1,
      quality: 0.05
    };

    // Decay factors for time-based scoring
    this.recencyDecay = {
      hourly: 1.0,
      daily: 0.9,
      weekly: 0.7,
      monthly: 0.5,
      older: 0.2
    };
  }

  /**
   * Calculate personalized relevance score for content
   * @param {string} userId - User ID
   * @param {Object} content - Content to score
   * @param {Object} options - Scoring options
   * @returns {Promise<Object>} Relevance score and breakdown
   */
  async calculateRelevanceScore(userId, content, options = {}) {
    try {
      const profile = await this.interestModeler.getProfile(userId);
      
      const scores = {
        topicScore: this.calculateTopicScore(content, profile),
        categoryScore: this.calculateCategoryScore(content, profile),
        sourceTypeScore: this.calculateSourceTypeScore(content, profile),
        recencyScore: this.calculateRecencyScore(content),
        qualityScore: this.calculateQualityScore(content)
      };

      const weightedScore = this.calculateWeightedScore(scores, options.weights);
      const normalizedScore = this.normalizeScore(weightedScore);

      return {
        totalScore: normalizedScore,
        breakdown: {
          ...scores,
          weightedScore,
          normalizedScore
        },
        factors: this.getScoreFactors(content, profile, scores),
        confidence: this.calculateConfidence(profile, scores)
      };
    } catch (error) {
      throw new Error(`Failed to calculate relevance score: ${error.message}`);
    }
  }

  /**
   * Score multiple content items and rank them
   * @param {string} userId - User ID
   * @param {Array} contentItems - Array of content to score
   * @param {Object} options - Scoring options
   * @returns {Promise<Array>} Ranked content with scores
   */
  async scoreAndRankContent(userId, contentItems, options = {}) {
    try {
      const scoredContent = await Promise.all(
        contentItems.map(async (content) => {
          const scoreResult = await this.calculateRelevanceScore(userId, content, options);
          return {
            ...content,
            relevanceScore: scoreResult.totalScore,
            scoreBreakdown: scoreResult.breakdown,
            scoreFactors: scoreResult.factors,
            confidence: scoreResult.confidence
          };
        })
      );

      // Sort by relevance score (descending)
      const rankedContent = scoredContent.sort((a, b) => b.relevanceScore - a.relevanceScore);

      // Apply diversity if requested
      if (options.diversify) {
        return this.applyDiversification(rankedContent, options.diversify);
      }

      return rankedContent;
    } catch (error) {
      throw new Error(`Failed to score and rank content: ${error.message}`);
    }
  }

  /**
   * Calculate topic-based relevance score
   * @param {Object} content - Content object
   * @param {Object} profile - User interest profile
   * @returns {number} Topic score (0-1)
   */
  calculateTopicScore(content, profile) {
    if (!content.topics || content.topics.length === 0) {
      return 0;
    }

    let totalScore = 0;
    let matchCount = 0;

    content.topics.forEach(topic => {
      const userInterest = profile.topics.find(t => t.topic.toLowerCase() === topic.toLowerCase());
      if (userInterest) {
        totalScore += userInterest.weight;
        matchCount++;
      }
    });

    if (matchCount === 0) {
      return 0;
    }

    // Average score with bonus for multiple matches
    const averageScore = totalScore / matchCount;
    const matchBonus = Math.min(matchCount / content.topics.length, 1) * 0.2;
    
    return Math.min(averageScore + matchBonus, 1);
  }

  /**
   * Calculate category-based relevance score
   * @param {Object} content - Content object
   * @param {Object} profile - User interest profile
   * @returns {number} Category score (0-1)
   */
  calculateCategoryScore(content, profile) {
    if (!content.categories || content.categories.length === 0) {
      return 0;
    }

    let totalScore = 0;
    let matchCount = 0;

    content.categories.forEach(category => {
      const userInterest = profile.categories.find(c => c.category.toLowerCase() === category.toLowerCase());
      if (userInterest) {
        totalScore += userInterest.weight;
        matchCount++;
      }
    });

    if (matchCount === 0) {
      return 0;
    }

    return totalScore / matchCount;
  }

  /**
   * Calculate source type relevance score
   * @param {Object} content - Content object
   * @param {Object} profile - User interest profile
   * @returns {number} Source type score (0-1)
   */
  calculateSourceTypeScore(content, profile) {
    if (!content.sourceType) {
      return 0.5; // Neutral score for unknown source type
    }

    const userInterest = profile.sourceTypes.find(st => st.sourceType === content.sourceType);
    return userInterest ? userInterest.weight : 0.3; // Default low score for unmatched types
  }

  /**
   * Calculate recency-based score
   * @param {Object} content - Content object
   * @returns {number} Recency score (0-1)
   */
  calculateRecencyScore(content) {
    if (!content.publishedAt && !content.createdAt) {
      return 0.5; // Neutral score for unknown date
    }

    const contentDate = new Date(content.publishedAt || content.createdAt);
    const now = new Date();
    const ageInHours = (now - contentDate) / (1000 * 60 * 60);

    if (ageInHours <= 24) {
      return this.recencyDecay.hourly;
    } else if (ageInHours <= 24 * 7) {
      return this.recencyDecay.daily;
    } else if (ageInHours <= 24 * 30) {
      return this.recencyDecay.weekly;
    } else if (ageInHours <= 24 * 365) {
      return this.recencyDecay.monthly;
    } else {
      return this.recencyDecay.older;
    }
  }

  /**
   * Calculate quality-based score
   * @param {Object} content - Content object
   * @returns {number} Quality score (0-1)
   */
  calculateQualityScore(content) {
    let qualityScore = 0.5; // Base score

    // Factor in engagement metrics if available
    if (content.metrics) {
      const { views, likes, shares, comments } = content.metrics;
      
      // Normalize engagement (simple heuristic)
      const engagementScore = Math.min(
        (likes + shares * 2 + comments * 1.5) / Math.max(views, 1),
        1
      );
      
      qualityScore += engagementScore * 0.3;
    }

    // Factor in source credibility
    if (content.source && content.source.credibilityScore) {
      qualityScore += content.source.credibilityScore * 0.2;
    }

    // Factor in content length (moderate length preferred)
    if (content.wordCount) {
      const lengthScore = this.calculateLengthScore(content.wordCount);
      qualityScore += lengthScore * 0.1;
    }

    return Math.min(qualityScore, 1);
  }

  /**
   * Calculate length-based quality score
   * @param {number} wordCount - Word count of content
   * @returns {number} Length score (0-1)
   */
  calculateLengthScore(wordCount) {
    // Prefer moderate length content (300-2000 words)
    if (wordCount >= 300 && wordCount <= 2000) {
      return 1;
    } else if (wordCount < 300) {
      return wordCount / 300; // Linear increase up to 300
    } else {
      return Math.max(0.3, 1 - (wordCount - 2000) / 5000); // Gradual decrease after 2000
    }
  }

  /**
   * Calculate weighted final score
   * @param {Object} scores - Individual component scores
   * @param {Object} customWeights - Custom weights (optional)
   * @returns {number} Weighted score
   */
  calculateWeightedScore(scores, customWeights = {}) {
    const weights = { ...this.scoringWeights, ...customWeights };
    
    return (
      scores.topicScore * weights.topicMatch +
      scores.categoryScore * weights.categoryMatch +
      scores.sourceTypeScore * weights.sourceTypeMatch +
      scores.recencyScore * weights.recency +
      scores.qualityScore * weights.quality
    );
  }

  /**
   * Normalize score to 0-100 range
   * @param {number} score - Raw weighted score
   * @returns {number} Normalized score (0-100)
   */
  normalizeScore(score) {
    return Math.round(Math.max(0, Math.min(100, score * 100)));
  }

  /**
   * Get human-readable score factors
   * @param {Object} content - Content object
   * @param {Object} profile - User profile
   * @param {Object} scores - Component scores
   * @returns {Object} Score factors explanation
   */
  getScoreFactors(content, profile, scores) {
    const factors = [];

    if (scores.topicScore > 0.7) {
      factors.push('Strong topic match');
    } else if (scores.topicScore > 0.4) {
      factors.push('Moderate topic match');
    }

    if (scores.categoryScore > 0.7) {
      factors.push('Strong category match');
    }

    if (scores.sourceTypeScore > 0.7) {
      factors.push('Preferred source type');
    }

    if (scores.recencyScore > 0.8) {
      factors.push('Very recent content');
    } else if (scores.recencyScore > 0.6) {
      factors.push('Recent content');
    }

    if (scores.qualityScore > 0.7) {
      factors.push('High quality content');
    }

    return {
      positive: factors,
      topMatches: this.getTopMatches(content, profile),
      scoreDistribution: {
        topic: Math.round(scores.topicScore * 100),
        category: Math.round(scores.categoryScore * 100),
        sourceType: Math.round(scores.sourceTypeScore * 100),
        recency: Math.round(scores.recencyScore * 100),
        quality: Math.round(scores.qualityScore * 100)
      }
    };
  }

  /**
   * Get top matching interests
   * @param {Object} content - Content object
   * @param {Object} profile - User profile
   * @returns {Object} Top matches
   */
  getTopMatches(content, profile) {
    const matches = {
      topics: [],
      categories: []
    };

    if (content.topics) {
      content.topics.forEach(topic => {
        const userInterest = profile.topics.find(t => t.topic.toLowerCase() === topic.toLowerCase());
        if (userInterest) {
          matches.topics.push({
            name: topic,
            weight: userInterest.weight,
            interactionCount: userInterest.interactionCount
          });
        }
      });
    }

    if (content.categories) {
      content.categories.forEach(category => {
        const userInterest = profile.categories.find(c => c.category.toLowerCase() === category.toLowerCase());
        if (userInterest) {
          matches.categories.push({
            name: category,
            weight: userInterest.weight,
            interactionCount: userInterest.interactionCount
          });
        }
      });
    }

    return matches;
  }

  /**
   * Calculate confidence in the score
   * @param {Object} profile - User profile
   * @param {Object} scores - Component scores
   * @returns {number} Confidence score (0-1)
   */
  calculateConfidence(profile, scores) {
    let confidence = 0.5; // Base confidence

    // Higher confidence with more user data
    const totalInteractions = profile.topics.reduce((sum, t) => sum + t.interactionCount, 0) +
                             profile.categories.reduce((sum, c) => sum + c.interactionCount, 0);
    
    const dataConfidence = Math.min(totalInteractions / 50, 0.4); // Max 0.4 boost from data
    confidence += dataConfidence;

    // Higher confidence with strong matches
    const matchConfidence = Math.max(scores.topicScore, scores.categoryScore) * 0.3;
    confidence += matchConfidence;

    return Math.min(confidence, 1);
  }

  /**
   * Apply diversification to ranked content
   * @param {Array} rankedContent - Content ranked by relevance
   * @param {Object} diversifyOptions - Diversification options
   * @returns {Array} Diversified content list
   */
  applyDiversification(rankedContent, diversifyOptions) {
    const { maxPerCategory = 3, maxPerSource = 2 } = diversifyOptions;
    const categoryCounts = {};
    const sourceCounts = {};
    const diversifiedContent = [];

    for (const content of rankedContent) {
      let canAdd = true;

      // Check category limits
      if (content.categories && content.categories.length > 0) {
        const primaryCategory = content.categories[0];
        if (categoryCounts[primaryCategory] >= maxPerCategory) {
          canAdd = false;
        }
      }

      // Check source limits
      if (content.source && content.source.name) {
        if (sourceCounts[content.source.name] >= maxPerSource) {
          canAdd = false;
        }
      }

      if (canAdd) {
        diversifiedContent.push(content);

        // Update counts
        if (content.categories && content.categories.length > 0) {
          const primaryCategory = content.categories[0];
          categoryCounts[primaryCategory] = (categoryCounts[primaryCategory] || 0) + 1;
        }

        if (content.source && content.source.name) {
          sourceCounts[content.source.name] = (sourceCounts[content.source.name] || 0) + 1;
        }
      }
    }

    return diversifiedContent;
  }

  /**
   * Get scoring configuration
   * @returns {Object} Current scoring configuration
   */
  getScoringConfig() {
    return {
      weights: this.scoringWeights,
      recencyDecay: this.recencyDecay
    };
  }

  /**
   * Update scoring configuration
   * @param {Object} config - New configuration
   */
  updateScoringConfig(config) {
    if (config.weights) {
      this.scoringWeights = { ...this.scoringWeights, ...config.weights };
    }
    
    if (config.recencyDecay) {
      this.recencyDecay = { ...this.recencyDecay, ...config.recencyDecay };
    }
  }
}

module.exports = RelevanceScorer;