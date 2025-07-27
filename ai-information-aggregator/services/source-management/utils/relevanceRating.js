/**
 * Relevance Rating System
 * Provides utilities for calculating and adjusting source relevance scores
 */
const createLogger = require('../../../common/utils/logger');
const logger = createLogger('relevance-rating');

/**
 * Calculate weighted relevance score based on multiple factors
 * @param {Object} factors - Rating factors with weights
 * @returns {number} - Calculated relevance score between 0 and 1
 */
exports.calculateRelevanceScore = (factors) => {
  try {
    // Default weights if not provided
    const weights = {
      userRating: 0.5,        // User's explicit rating
      contentQuality: 0.2,    // Quality of content from this source
      updateFrequency: 0.1,   // How often the source is updated
      contentRelevance: 0.2,  // How relevant the content is to user interests
      ...factors.weights
    };

    // Default values if not provided
    const values = {
      userRating: 0.5,
      contentQuality: 0.5,
      updateFrequency: 0.5,
      contentRelevance: 0.5,
      ...factors.values
    };

    // Calculate weighted score
    let score = 0;
    let totalWeight = 0;

    for (const [factor, weight] of Object.entries(weights)) {
      if (values[factor] !== undefined) {
        score += weight * values[factor];
        totalWeight += weight;
      }
    }

    // Normalize score if weights don't sum to 1
    if (totalWeight > 0) {
      score = score / totalWeight;
    }

    // Ensure score is between 0 and 1
    return Math.max(0, Math.min(1, score));
  } catch (error) {
    logger.error('Error calculating relevance score:', error);
    return 0.5; // Default to neutral score on error
  }
};

/**
 * Adjust relevance score based on user interaction
 * @param {number} currentScore - Current relevance score
 * @param {string} interactionType - Type of interaction (view, save, share, dismiss)
 * @param {number} weight - Weight of this interaction (0-1)
 * @returns {number} - Adjusted relevance score
 */
exports.adjustScoreByInteraction = (currentScore, interactionType, weight = 0.1) => {
  try {
    const interactionImpact = {
      view: 0.02,      // Small positive impact
      save: 0.05,      // Medium positive impact
      share: 0.1,      // Large positive impact
      dismiss: -0.1,   // Negative impact
      dislike: -0.05   // Medium negative impact
    };

    const impact = interactionImpact[interactionType] || 0;
    const adjustedScore = currentScore + (impact * weight);

    // Ensure score is between 0 and 1
    return Math.max(0, Math.min(1, adjustedScore));
  } catch (error) {
    logger.error('Error adjusting relevance score:', error);
    return currentScore; // Return unchanged score on error
  }
};

/**
 * Calculate priority level based on relevance score
 * @param {number} relevanceScore - Source relevance score (0-1)
 * @returns {string} - Priority level (low, medium, high, critical)
 */
exports.calculatePriorityLevel = (relevanceScore) => {
  if (relevanceScore >= 0.8) {
    return 'critical';
  } else if (relevanceScore >= 0.6) {
    return 'high';
  } else if (relevanceScore >= 0.4) {
    return 'medium';
  } else {
    return 'low';
  }
};

/**
 * Get check frequency recommendation based on relevance score
 * @param {number} relevanceScore - Source relevance score (0-1)
 * @returns {string} - Recommended check frequency (hourly, daily, weekly, monthly)
 */
exports.getRecommendedCheckFrequency = (relevanceScore) => {
  if (relevanceScore >= 0.8) {
    return 'hourly';
  } else if (relevanceScore >= 0.6) {
    return 'daily';
  } else if (relevanceScore >= 0.3) {
    return 'weekly';
  } else {
    return 'monthly';
  }
};

/**
 * Decay relevance score over time for sources without recent updates
 * @param {number} currentScore - Current relevance score
 * @param {Date} lastUpdated - Date of last content update
 * @param {number} decayRate - Rate of decay (0-1)
 * @returns {number} - Decayed relevance score
 */
exports.decayScoreOverTime = (currentScore, lastUpdated, decayRate = 0.01) => {
  try {
    if (!lastUpdated) {
      return currentScore;
    }

    // Ensure lastUpdated is a valid Date object
    const updateDate = lastUpdated instanceof Date ? lastUpdated : new Date(lastUpdated);
    
    // Check if date is valid
    if (isNaN(updateDate.getTime())) {
      return currentScore; // Return unchanged score if date is invalid
    }

    const now = new Date();
    const daysSinceUpdate = (now - updateDate) / (1000 * 60 * 60 * 24);
    
    // Apply decay based on days since last update
    // Limit maximum decay to 50% of original score
    const decay = Math.min(daysSinceUpdate * decayRate, 0.5);
    const decayedScore = currentScore * (1 - decay);
    
    // Ensure score is between 0 and 1
    return Math.max(0, Math.min(1, decayedScore));
  } catch (error) {
    logger.error('Error decaying relevance score:', error);
    return currentScore; // Return unchanged score on error
  }
};