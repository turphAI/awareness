const InterestProfile = require('../models/InterestProfile');
const _ = require('lodash');

class InterestModeler {
  constructor() {
    this.interactionWeights = {
      view: 0.1,
      save: 0.8,
      share: 0.9,
      dismiss: -0.5,
      like: 0.7,
      comment: 0.6,
      click: 0.3
    };
  }

  /**
   * Initialize interest profile for a new user
   * @param {string} userId - User ID
   * @param {Object} explicitPreferences - User's explicit preferences
   * @returns {Promise<InterestProfile>} Created interest profile
   */
  async initializeProfile(userId, explicitPreferences = {}) {
    try {
      // Check if profile already exists
      let profile = await InterestProfile.findOne({ userId });
      if (profile) {
        return profile;
      }

      // Create new profile with explicit preferences
      profile = new InterestProfile({
        userId,
        explicitPreferences: {
          topics: explicitPreferences.topics || [],
          categories: explicitPreferences.categories || [],
          sourceTypes: explicitPreferences.sourceTypes || []
        }
      });

      // Initialize interests based on explicit preferences
      if (explicitPreferences.topics) {
        explicitPreferences.topics.forEach(topic => {
          profile.topics.push({
            topic,
            weight: 0.8, // High initial weight for explicit preferences
            interactionCount: 0
          });
        });
      }

      if (explicitPreferences.categories) {
        explicitPreferences.categories.forEach(category => {
          profile.categories.push({
            category,
            weight: 0.8,
            interactionCount: 0
          });
        });
      }

      if (explicitPreferences.sourceTypes) {
        explicitPreferences.sourceTypes.forEach(sourceType => {
          profile.sourceTypes.push({
            sourceType,
            weight: 0.8,
            interactionCount: 0
          });
        });
      }

      await profile.save();
      return profile;
    } catch (error) {
      throw new Error(`Failed to initialize interest profile: ${error.message}`);
    }
  }

  /**
   * Update interest profile based on user interaction
   * @param {string} userId - User ID
   * @param {Object} interaction - Interaction data
   * @param {Object} content - Content that was interacted with
   * @returns {Promise<InterestProfile>} Updated interest profile
   */
  async updateFromInteraction(userId, interaction, content) {
    try {
      let profile = await InterestProfile.findOne({ userId });
      if (!profile) {
        profile = await this.initializeProfile(userId);
      }

      const interactionType = this.getInteractionType(interaction.type);
      const strength = this.interactionWeights[interaction.type] || 0.1;

      // Update topic interests
      if (content.topics && content.topics.length > 0) {
        content.topics.forEach(topic => {
          profile.updateTopicInterest(topic, interactionType, Math.abs(strength));
        });
      }

      // Update category interests
      if (content.categories && content.categories.length > 0) {
        content.categories.forEach(category => {
          profile.updateCategoryInterest(category, interactionType, Math.abs(strength));
        });
      }

      // Update source type interests
      if (content.sourceType) {
        profile.updateSourceTypeInterest(content.sourceType, interactionType, Math.abs(strength));
      }

      // Apply decay to maintain relevance
      profile.applyDecay();

      await profile.save();
      return profile;
    } catch (error) {
      throw new Error(`Failed to update interest profile: ${error.message}`);
    }
  }

  /**
   * Get user's interest profile
   * @param {string} userId - User ID
   * @returns {Promise<InterestProfile>} User's interest profile
   */
  async getProfile(userId) {
    try {
      let profile = await InterestProfile.findOne({ userId });
      if (!profile) {
        profile = await this.initializeProfile(userId);
      }
      return profile;
    } catch (error) {
      throw new Error(`Failed to get interest profile: ${error.message}`);
    }
  }

  /**
   * Update explicit preferences
   * @param {string} userId - User ID
   * @param {Object} preferences - New explicit preferences
   * @returns {Promise<InterestProfile>} Updated interest profile
   */
  async updateExplicitPreferences(userId, preferences) {
    try {
      let profile = await InterestProfile.findOne({ userId });
      if (!profile) {
        profile = await this.initializeProfile(userId, preferences);
        return profile;
      }

      // Update explicit preferences
      profile.explicitPreferences = {
        topics: preferences.topics || profile.explicitPreferences.topics,
        categories: preferences.categories || profile.explicitPreferences.categories,
        sourceTypes: preferences.sourceTypes || profile.explicitPreferences.sourceTypes
      };

      // Add new explicit preferences to interests with high weights
      if (preferences.topics) {
        preferences.topics.forEach(topic => {
          const existingTopic = profile.topics.find(t => t.topic === topic);
          if (existingTopic) {
            existingTopic.weight = Math.max(existingTopic.weight, 0.8);
          } else {
            profile.topics.push({
              topic,
              weight: 0.8,
              interactionCount: 0
            });
          }
        });
      }

      if (preferences.categories) {
        preferences.categories.forEach(category => {
          const existingCategory = profile.categories.find(c => c.category === category);
          if (existingCategory) {
            existingCategory.weight = Math.max(existingCategory.weight, 0.8);
          } else {
            profile.categories.push({
              category,
              weight: 0.8,
              interactionCount: 0
            });
          }
        });
      }

      if (preferences.sourceTypes) {
        preferences.sourceTypes.forEach(sourceType => {
          const existingSourceType = profile.sourceTypes.find(st => st.sourceType === sourceType);
          if (existingSourceType) {
            existingSourceType.weight = Math.max(existingSourceType.weight, 0.8);
          } else {
            profile.sourceTypes.push({
              sourceType,
              weight: 0.8,
              interactionCount: 0
            });
          }
        });
      }

      await profile.save();
      return profile;
    } catch (error) {
      throw new Error(`Failed to update explicit preferences: ${error.message}`);
    }
  }

  /**
   * Get personalized interest summary
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Interest summary
   */
  async getInterestSummary(userId) {
    try {
      const profile = await this.getProfile(userId);
      
      return {
        topTopics: profile.getTopInterests('topics', 10),
        topCategories: profile.getTopInterests('categories', 5),
        topSourceTypes: profile.getTopInterests('sourceTypes', 3),
        explicitPreferences: profile.explicitPreferences,
        profileStats: {
          totalTopics: profile.topics.length,
          totalCategories: profile.categories.length,
          totalSourceTypes: profile.sourceTypes.length,
          learningRate: profile.learningRate,
          lastUpdated: profile.updated
        }
      };
    } catch (error) {
      throw new Error(`Failed to get interest summary: ${error.message}`);
    }
  }

  /**
   * Adjust learning parameters
   * @param {string} userId - User ID
   * @param {Object} parameters - Learning parameters to adjust
   * @returns {Promise<InterestProfile>} Updated profile
   */
  async adjustLearningParameters(userId, parameters) {
    try {
      const profile = await InterestProfile.findOne({ userId });
      if (!profile) {
        throw new Error('Profile not found');
      }

      if (parameters.learningRate !== undefined) {
        profile.learningRate = Math.max(0.01, Math.min(0.5, parameters.learningRate));
      }

      if (parameters.decayRate !== undefined) {
        profile.decayRate = Math.max(0.8, Math.min(0.99, parameters.decayRate));
      }

      if (parameters.adaptiveWeights) {
        if (parameters.adaptiveWeights.explicitWeight !== undefined) {
          profile.adaptiveWeights.explicitWeight = Math.max(0, Math.min(1, parameters.adaptiveWeights.explicitWeight));
        }
        if (parameters.adaptiveWeights.implicitWeight !== undefined) {
          profile.adaptiveWeights.implicitWeight = Math.max(0, Math.min(1, parameters.adaptiveWeights.implicitWeight));
        }
      }

      await profile.save();
      return profile;
    } catch (error) {
      throw new Error(`Failed to adjust learning parameters: ${error.message}`);
    }
  }

  /**
   * Determine interaction type (positive/negative)
   * @param {string} interactionType - Type of interaction
   * @returns {string} 'positive' or 'negative'
   */
  getInteractionType(interactionType) {
    const positiveInteractions = ['view', 'save', 'share', 'like', 'comment', 'click'];
    const negativeInteractions = ['dismiss', 'dislike', 'report'];
    
    if (positiveInteractions.includes(interactionType)) {
      return 'positive';
    } else if (negativeInteractions.includes(interactionType)) {
      return 'negative';
    }
    
    return 'positive'; // Default to positive for unknown interactions
  }

  /**
   * Reset interest profile
   * @param {string} userId - User ID
   * @returns {Promise<InterestProfile>} Reset profile
   */
  async resetProfile(userId) {
    try {
      const profile = await InterestProfile.findOne({ userId });
      if (!profile) {
        throw new Error('Profile not found');
      }

      // Keep explicit preferences but reset learned interests
      profile.topics = [];
      profile.categories = [];
      profile.sourceTypes = [];

      // Re-initialize with explicit preferences
      if (profile.explicitPreferences.topics) {
        profile.explicitPreferences.topics.forEach(topic => {
          profile.topics.push({
            topic,
            weight: 0.8,
            interactionCount: 0
          });
        });
      }

      if (profile.explicitPreferences.categories) {
        profile.explicitPreferences.categories.forEach(category => {
          profile.categories.push({
            category,
            weight: 0.8,
            interactionCount: 0
          });
        });
      }

      if (profile.explicitPreferences.sourceTypes) {
        profile.explicitPreferences.sourceTypes.forEach(sourceType => {
          profile.sourceTypes.push({
            sourceType,
            weight: 0.8,
            interactionCount: 0
          });
        });
      }

      await profile.save();
      return profile;
    } catch (error) {
      throw new Error(`Failed to reset profile: ${error.message}`);
    }
  }
}

module.exports = InterestModeler;