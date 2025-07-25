const InterestModeler = require('./interestModeler');
const RelevanceScorer = require('./relevanceScorer');
const _ = require('lodash');

class InteractionLearner {
  constructor() {
    this.interestModeler = new InterestModeler();
    this.relevanceScorer = new RelevanceScorer();
    
    // Learning parameters
    this.learningConfig = {
      feedbackThreshold: 0.1, // Minimum difference to trigger learning
      adaptationRate: 0.05, // How quickly to adapt scoring weights
      confidenceThreshold: 0.7, // Minimum confidence for learning
      maxLearningCycles: 10, // Maximum learning iterations per session
      evaluationWindow: 100 // Number of recent interactions to evaluate
    };

    // Interaction tracking
    this.interactionBuffer = new Map(); // userId -> interactions[]
    this.learningMetrics = new Map(); // userId -> metrics
  }

  /**
   * Process user interaction and update personalization
   * @param {string} userId - User ID
   * @param {Object} interaction - Interaction data
   * @param {Object} content - Content that was interacted with
   * @returns {Promise<Object>} Learning result
   */
  async processInteraction(userId, interaction, content) {
    try {
      // Store interaction for learning
      await this.recordInteraction(userId, interaction, content);

      // Update interest profile based on interaction
      await this.interestModeler.updateFromInteraction(userId, interaction, content);

      // Evaluate if learning is needed
      const shouldLearn = await this.shouldTriggerLearning(userId, interaction, content);
      
      let learningResult = null;
      if (shouldLearn) {
        learningResult = await this.performLearning(userId);
      }

      return {
        interactionProcessed: true,
        profileUpdated: true,
        learningTriggered: shouldLearn,
        learningResult,
        metrics: await this.getUserLearningMetrics(userId)
      };
    } catch (error) {
      throw new Error(`Failed to process interaction: ${error.message}`);
    }
  }

  /**
   * Record interaction for learning analysis
   * @param {string} userId - User ID
   * @param {Object} interaction - Interaction data
   * @param {Object} content - Content data
   */
  async recordInteraction(userId, interaction, content) {
    if (!this.interactionBuffer.has(userId)) {
      this.interactionBuffer.set(userId, []);
    }

    const interactions = this.interactionBuffer.get(userId);
    
    // Get current relevance score for comparison
    const scoreResult = await this.relevanceScorer.calculateRelevanceScore(userId, content);
    
    const interactionRecord = {
      timestamp: new Date(),
      interaction: {
        type: interaction.type,
        duration: interaction.duration,
        engagement: interaction.engagement || this.calculateEngagement(interaction)
      },
      content: {
        id: content.id,
        topics: content.topics,
        categories: content.categories,
        sourceType: content.sourceType
      },
      prediction: {
        relevanceScore: scoreResult.totalScore,
        confidence: scoreResult.confidence,
        breakdown: scoreResult.breakdown
      },
      actual: {
        userEngagement: this.mapInteractionToEngagement(interaction),
        satisfaction: this.inferSatisfaction(interaction)
      }
    };

    interactions.push(interactionRecord);

    // Keep only recent interactions
    if (interactions.length > this.learningConfig.evaluationWindow) {
      interactions.shift();
    }

    this.interactionBuffer.set(userId, interactions);
  }

  /**
   * Determine if learning should be triggered
   * @param {string} userId - User ID
   * @param {Object} interaction - Current interaction
   * @param {Object} content - Current content
   * @returns {Promise<boolean>} Whether to trigger learning
   */
  async shouldTriggerLearning(userId, interaction, content) {
    const interactions = this.interactionBuffer.get(userId) || [];
    
    // Need minimum interactions for learning
    if (interactions.length < 10) {
      return false;
    }

    // Check if there's a significant prediction error
    const recentInteractions = interactions.slice(-10);
    const predictionError = this.calculatePredictionError(recentInteractions);
    
    if (predictionError > this.learningConfig.feedbackThreshold) {
      return true;
    }

    // Periodic learning trigger
    const lastLearning = this.getLastLearningTime(userId);
    const timeSinceLastLearning = Date.now() - lastLearning;
    const shouldPeriodicLearn = timeSinceLastLearning > 24 * 60 * 60 * 1000; // 24 hours

    return shouldPeriodicLearn && interactions.length >= 20;
  }

  /**
   * Perform learning to improve personalization
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Learning results
   */
  async performLearning(userId) {
    try {
      const interactions = this.interactionBuffer.get(userId) || [];
      
      if (interactions.length < 10) {
        return { success: false, reason: 'Insufficient data' };
      }

      // Analyze prediction accuracy
      const analysis = this.analyzePredictionAccuracy(interactions);
      
      // Adjust scoring weights based on analysis
      const weightAdjustments = this.calculateWeightAdjustments(analysis);
      
      // Apply adjustments
      await this.applyScoringAdjustments(userId, weightAdjustments);
      
      // Update learning metrics
      await this.updateLearningMetrics(userId, analysis, weightAdjustments);

      return {
        success: true,
        analysis,
        adjustments: weightAdjustments,
        improvementPotential: analysis.improvementPotential,
        confidence: analysis.confidence
      };
    } catch (error) {
      throw new Error(`Learning failed: ${error.message}`);
    }
  }

  /**
   * Analyze prediction accuracy from interactions
   * @param {Array} interactions - User interactions
   * @returns {Object} Analysis results
   */
  analyzePredictionAccuracy(interactions) {
    const analysis = {
      totalInteractions: interactions.length,
      accuracyByType: {},
      overallAccuracy: 0,
      biases: {},
      patterns: {},
      improvementPotential: 0,
      confidence: 0
    };

    // Group interactions by content characteristics
    const groupedByTopic = _.groupBy(interactions, i => i.content.topics?.[0] || 'unknown');
    const groupedByCategory = _.groupBy(interactions, i => i.content.categories?.[0] || 'unknown');
    const groupedBySource = _.groupBy(interactions, i => i.content.sourceType || 'unknown');

    // Analyze accuracy for each group
    analysis.accuracyByType.topic = this.analyzeGroupAccuracy(groupedByTopic);
    analysis.accuracyByType.category = this.analyzeGroupAccuracy(groupedByCategory);
    analysis.accuracyByType.sourceType = this.analyzeGroupAccuracy(groupedBySource);

    // Calculate overall accuracy
    const accuracyScores = interactions.map(i => this.calculateInteractionAccuracy(i));
    analysis.overallAccuracy = _.mean(accuracyScores);

    // Identify biases (systematic over/under-prediction)
    analysis.biases = this.identifyPredictionBiases(interactions);

    // Identify patterns
    analysis.patterns = this.identifyLearningPatterns(interactions);

    // Calculate improvement potential
    analysis.improvementPotential = this.calculateImprovementPotential(analysis);

    // Calculate confidence in analysis
    analysis.confidence = this.calculateAnalysisConfidence(interactions, analysis);

    return analysis;
  }

  /**
   * Calculate weight adjustments based on analysis
   * @param {Object} analysis - Prediction analysis
   * @returns {Object} Weight adjustments
   */
  calculateWeightAdjustments(analysis) {
    const adjustments = {
      topicMatch: 0,
      categoryMatch: 0,
      sourceTypeMatch: 0,
      recency: 0,
      quality: 0
    };

    // Adjust based on accuracy by type
    if (analysis.accuracyByType.topic.accuracy < 0.7) {
      adjustments.topicMatch = -this.learningConfig.adaptationRate;
    } else if (analysis.accuracyByType.topic.accuracy > 0.9) {
      adjustments.topicMatch = this.learningConfig.adaptationRate;
    }

    if (analysis.accuracyByType.category.accuracy < 0.7) {
      adjustments.categoryMatch = -this.learningConfig.adaptationRate;
    } else if (analysis.accuracyByType.category.accuracy > 0.9) {
      adjustments.categoryMatch = this.learningConfig.adaptationRate;
    }

    if (analysis.accuracyByType.sourceType.accuracy < 0.7) {
      adjustments.sourceTypeMatch = -this.learningConfig.adaptationRate;
    } else if (analysis.accuracyByType.sourceType.accuracy > 0.9) {
      adjustments.sourceTypeMatch = this.learningConfig.adaptationRate;
    }

    // Adjust based on biases
    if (analysis.biases.recencyBias > 0.2) {
      adjustments.recency = -this.learningConfig.adaptationRate;
    } else if (analysis.biases.recencyBias < -0.2) {
      adjustments.recency = this.learningConfig.adaptationRate;
    }

    if (analysis.biases.qualityBias > 0.2) {
      adjustments.quality = -this.learningConfig.adaptationRate;
    } else if (analysis.biases.qualityBias < -0.2) {
      adjustments.quality = this.learningConfig.adaptationRate;
    }

    return adjustments;
  }

  /**
   * Apply scoring adjustments to user's personalization
   * @param {string} userId - User ID
   * @param {Object} adjustments - Weight adjustments
   */
  async applyScoringAdjustments(userId, adjustments) {
    // Get current scoring config
    const currentConfig = this.relevanceScorer.getScoringConfig();
    
    // Apply adjustments
    const newWeights = { ...currentConfig.weights };
    Object.keys(adjustments).forEach(key => {
      if (adjustments[key] !== 0) {
        newWeights[key] = Math.max(0.05, Math.min(0.8, newWeights[key] + adjustments[key]));
      }
    });

    // Update scoring configuration (this would ideally be per-user)
    this.relevanceScorer.updateScoringConfig({ weights: newWeights });
  }

  /**
   * Calculate engagement score from interaction
   * @param {Object} interaction - Interaction data
   * @returns {number} Engagement score (0-1)
   */
  calculateEngagement(interaction) {
    let engagement = 0;

    // Base engagement by interaction type
    const baseEngagement = {
      view: 0.1,
      click: 0.3,
      save: 0.8,
      share: 0.9,
      like: 0.7,
      comment: 0.8,
      dismiss: 0.0
    };

    engagement = baseEngagement.hasOwnProperty(interaction.type) ? baseEngagement[interaction.type] : 0.1;

    // Factor in duration if available
    if (interaction.duration) {
      const durationBonus = Math.min(interaction.duration / 300, 0.3); // Max 5 minutes
      engagement += durationBonus;
    }

    // Factor in scroll depth or other engagement metrics
    if (interaction.scrollDepth) {
      engagement += interaction.scrollDepth * 0.2;
    }

    return Math.min(engagement, 1);
  }

  /**
   * Map interaction to engagement level
   * @param {Object} interaction - Interaction data
   * @returns {number} Engagement level (0-1)
   */
  mapInteractionToEngagement(interaction) {
    const engagementMap = {
      dismiss: 0.0,
      view: 0.2,
      click: 0.4,
      like: 0.7,
      save: 0.8,
      share: 0.9,
      comment: 0.8
    };

    return engagementMap.hasOwnProperty(interaction.type) ? engagementMap[interaction.type] : 0.1;
  }

  /**
   * Infer user satisfaction from interaction
   * @param {Object} interaction - Interaction data
   * @returns {number} Satisfaction score (0-1)
   */
  inferSatisfaction(interaction) {
    let satisfaction = 0.5; // Neutral baseline

    // Positive indicators
    if (['save', 'share', 'like', 'comment'].includes(interaction.type)) {
      satisfaction = 0.8;
    }

    // Negative indicators
    if (['dismiss', 'dislike'].includes(interaction.type)) {
      satisfaction = 0.2;
    }

    // Factor in time spent
    if (interaction.duration) {
      if (interaction.duration > 60) { // More than 1 minute
        satisfaction += 0.2;
      } else if (interaction.duration < 10) { // Less than 10 seconds
        satisfaction -= 0.2;
      }
    }

    return Math.max(0, Math.min(1, satisfaction));
  }

  /**
   * Calculate prediction error for interactions
   * @param {Array} interactions - Recent interactions
   * @returns {number} Average prediction error
   */
  calculatePredictionError(interactions) {
    const errors = interactions.map(i => this.calculateInteractionError(i));
    return _.mean(errors);
  }

  /**
   * Calculate error for single interaction
   * @param {Object} interaction - Interaction record
   * @returns {number} Prediction error
   */
  calculateInteractionError(interaction) {
    const predicted = interaction.prediction.relevanceScore / 100; // Normalize to 0-1
    const actual = interaction.actual.userEngagement;
    
    return Math.abs(predicted - actual);
  }

  /**
   * Calculate accuracy for single interaction
   * @param {Object} interaction - Interaction record
   * @returns {number} Accuracy score (0-1)
   */
  calculateInteractionAccuracy(interaction) {
    const error = this.calculateInteractionError(interaction);
    return 1 - error; // Convert error to accuracy
  }

  /**
   * Analyze accuracy for grouped interactions
   * @param {Object} groupedInteractions - Interactions grouped by some criteria
   * @returns {Object} Group accuracy analysis
   */
  analyzeGroupAccuracy(groupedInteractions) {
    const groupAnalysis = {};
    let totalAccuracy = 0;
    let totalCount = 0;

    Object.keys(groupedInteractions).forEach(group => {
      const interactions = groupedInteractions[group];
      const accuracies = interactions.map(i => this.calculateInteractionAccuracy(i));
      const avgAccuracy = _.mean(accuracies);
      
      groupAnalysis[group] = {
        count: interactions.length,
        accuracy: avgAccuracy,
        confidence: Math.min(interactions.length / 10, 1) // More interactions = higher confidence
      };

      totalAccuracy += avgAccuracy * interactions.length;
      totalCount += interactions.length;
    });

    return {
      groups: groupAnalysis,
      accuracy: totalCount > 0 ? totalAccuracy / totalCount : 0,
      coverage: Object.keys(groupAnalysis).length
    };
  }

  /**
   * Identify prediction biases
   * @param {Array} interactions - User interactions
   * @returns {Object} Identified biases
   */
  identifyPredictionBiases(interactions) {
    const biases = {};

    // Recency bias - do we over-predict for recent content?
    const recentContent = interactions.filter(i => {
      const contentAge = Date.now() - new Date(i.content.publishedAt || i.timestamp).getTime();
      return contentAge < 24 * 60 * 60 * 1000; // Less than 24 hours
    });

    if (recentContent.length > 0) {
      const recentErrors = recentContent.map(i => {
        const predicted = i.prediction.relevanceScore / 100;
        const actual = i.actual.userEngagement;
        return predicted - actual; // Positive = over-prediction
      });
      biases.recencyBias = _.mean(recentErrors);
    }

    // Quality bias - do we over-predict for high-quality content?
    const highQualityContent = interactions.filter(i => 
      i.prediction.breakdown.qualityScore > 0.7
    );

    if (highQualityContent.length > 0) {
      const qualityErrors = highQualityContent.map(i => {
        const predicted = i.prediction.relevanceScore / 100;
        const actual = i.actual.userEngagement;
        return predicted - actual;
      });
      biases.qualityBias = _.mean(qualityErrors);
    }

    return biases;
  }

  /**
   * Identify learning patterns
   * @param {Array} interactions - User interactions
   * @returns {Object} Identified patterns
   */
  identifyLearningPatterns(interactions) {
    const patterns = {};

    // Time-based patterns
    const hourlyEngagement = _.groupBy(interactions, i => 
      new Date(i.timestamp).getHours()
    );

    patterns.timeOfDay = Object.keys(hourlyEngagement).map(hour => ({
      hour: parseInt(hour),
      avgEngagement: _.meanBy(hourlyEngagement[hour], 'actual.userEngagement'),
      count: hourlyEngagement[hour].length
    })).sort((a, b) => b.avgEngagement - a.avgEngagement);

    // Content type preferences
    const sourceTypeEngagement = _.groupBy(interactions, 'content.sourceType');
    patterns.sourceTypePreference = Object.keys(sourceTypeEngagement).map(type => ({
      sourceType: type,
      avgEngagement: _.meanBy(sourceTypeEngagement[type], 'actual.userEngagement'),
      count: sourceTypeEngagement[type].length
    })).sort((a, b) => b.avgEngagement - a.avgEngagement);

    return patterns;
  }

  /**
   * Calculate improvement potential
   * @param {Object} analysis - Prediction analysis
   * @returns {number} Improvement potential (0-1)
   */
  calculateImprovementPotential(analysis) {
    const currentAccuracy = analysis.overallAccuracy;
    const maxPossibleAccuracy = 0.95; // Realistic maximum
    
    return (maxPossibleAccuracy - currentAccuracy) / maxPossibleAccuracy;
  }

  /**
   * Calculate confidence in analysis
   * @param {Array} interactions - Interactions used for analysis
   * @param {Object} analysis - Analysis results
   * @returns {number} Confidence score (0-1)
   */
  calculateAnalysisConfidence(interactions, analysis) {
    let confidence = 0;

    // Data quantity factor
    const dataFactor = Math.min(interactions.length / 100, 0.4);
    confidence += dataFactor;

    // Data diversity factor
    const uniqueTopics = new Set(interactions.map(i => i.content.topics?.[0]).filter(Boolean)).size;
    const uniqueCategories = new Set(interactions.map(i => i.content.categories?.[0]).filter(Boolean)).size;
    const diversityFactor = Math.min((uniqueTopics + uniqueCategories) / 20, 0.3);
    confidence += diversityFactor;

    // Consistency factor
    const consistencyFactor = analysis.overallAccuracy * 0.3;
    confidence += consistencyFactor;

    return Math.min(confidence, 1);
  }

  /**
   * Get user learning metrics
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Learning metrics
   */
  async getUserLearningMetrics(userId) {
    const interactions = this.interactionBuffer.get(userId) || [];
    const metrics = this.learningMetrics.get(userId) || {};

    return {
      totalInteractions: interactions.length,
      recentInteractions: interactions.filter(i => 
        Date.now() - new Date(i.timestamp).getTime() < 7 * 24 * 60 * 60 * 1000
      ).length,
      averageEngagement: interactions.length > 0 ? 
        _.meanBy(interactions, 'actual.userEngagement') : 0,
      predictionAccuracy: interactions.length > 0 ? 
        _.mean(interactions.map(i => this.calculateInteractionAccuracy(i))) : 0,
      lastLearningUpdate: metrics.lastLearningUpdate || null,
      learningCycles: metrics.learningCycles || 0,
      improvementTrend: metrics.improvementTrend || 0
    };
  }

  /**
   * Update learning metrics for user
   * @param {string} userId - User ID
   * @param {Object} analysis - Learning analysis
   * @param {Object} adjustments - Applied adjustments
   */
  async updateLearningMetrics(userId, analysis, adjustments) {
    const currentMetrics = this.learningMetrics.get(userId) || {};
    
    const updatedMetrics = {
      ...currentMetrics,
      lastLearningUpdate: new Date(),
      learningCycles: (currentMetrics.learningCycles || 0) + 1,
      lastAccuracy: analysis.overallAccuracy,
      lastImprovementPotential: analysis.improvementPotential,
      lastAdjustments: adjustments,
      improvementTrend: this.calculateImprovementTrend(currentMetrics, analysis)
    };

    this.learningMetrics.set(userId, updatedMetrics);
  }

  /**
   * Calculate improvement trend
   * @param {Object} currentMetrics - Current metrics
   * @param {Object} analysis - New analysis
   * @returns {number} Improvement trend (-1 to 1)
   */
  calculateImprovementTrend(currentMetrics, analysis) {
    if (!currentMetrics.lastAccuracy) {
      return 0;
    }

    const accuracyChange = analysis.overallAccuracy - currentMetrics.lastAccuracy;
    return Math.max(-1, Math.min(1, accuracyChange * 10)); // Scale to -1 to 1
  }

  /**
   * Get last learning time for user
   * @param {string} userId - User ID
   * @returns {number} Timestamp of last learning
   */
  getLastLearningTime(userId) {
    const metrics = this.learningMetrics.get(userId);
    return metrics?.lastLearningUpdate?.getTime() || 0;
  }

  /**
   * Reset learning data for user
   * @param {string} userId - User ID
   */
  resetLearningData(userId) {
    this.interactionBuffer.delete(userId);
    this.learningMetrics.delete(userId);
  }

  /**
   * Get learning configuration
   * @returns {Object} Current learning configuration
   */
  getLearningConfig() {
    return { ...this.learningConfig };
  }

  /**
   * Update learning configuration
   * @param {Object} config - New configuration
   */
  updateLearningConfig(config) {
    this.learningConfig = { ...this.learningConfig, ...config };
  }
}

module.exports = InteractionLearner;