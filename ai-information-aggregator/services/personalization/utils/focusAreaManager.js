const _ = require('lodash');

class FocusAreaManager {
  constructor() {
    // Focus area storage (in production, this would be a database)
    this.focusAreas = new Map(); // userId -> focusAreas[]
    this.contentFilters = new Map(); // userId -> activeFilters
    
    // Default focus area templates
    this.focusAreaTemplates = {
      'technology': {
        name: 'Technology',
        description: 'Latest developments in technology and innovation',
        topics: ['artificial intelligence', 'machine learning', 'blockchain', 'cybersecurity', 'software development'],
        categories: ['technology', 'innovation', 'startups'],
        keywords: ['tech', 'digital', 'innovation', 'software', 'hardware'],
        sourceTypes: ['blog', 'academic', 'news'],
        priority: 'high'
      },
      'business': {
        name: 'Business & Finance',
        description: 'Business news, market trends, and financial insights',
        topics: ['finance', 'markets', 'economics', 'business strategy', 'entrepreneurship'],
        categories: ['business', 'finance', 'economics'],
        keywords: ['business', 'market', 'finance', 'economy', 'investment'],
        sourceTypes: ['news', 'blog', 'academic'],
        priority: 'medium'
      },
      'science': {
        name: 'Science & Research',
        description: 'Scientific discoveries and research developments',
        topics: ['physics', 'biology', 'chemistry', 'medicine', 'climate science'],
        categories: ['science', 'research', 'health'],
        keywords: ['research', 'study', 'discovery', 'experiment', 'scientific'],
        sourceTypes: ['academic', 'news'],
        priority: 'medium'
      },
      'health': {
        name: 'Health & Wellness',
        description: 'Health news, medical breakthroughs, and wellness tips',
        topics: ['medicine', 'health', 'wellness', 'nutrition', 'mental health'],
        categories: ['health', 'medicine', 'wellness'],
        keywords: ['health', 'medical', 'wellness', 'treatment', 'disease'],
        sourceTypes: ['news', 'blog', 'academic'],
        priority: 'high'
      }
    };

    // Filter configuration
    this.filterConfig = {
      // Matching thresholds
      topicMatchThreshold: 0.3,
      categoryMatchThreshold: 0.2,
      keywordMatchThreshold: 0.1,
      
      // Scoring weights
      weights: {
        topicMatch: 0.4,
        categoryMatch: 0.3,
        keywordMatch: 0.2,
        sourceTypeMatch: 0.1
      },
      
      // Minimum score for content to pass filter
      minimumPassScore: 0.3,
      
      // Maximum focus areas per user
      maxFocusAreas: 10
    };
  }

  /**
   * Create a new focus area for a user
   * @param {string} userId - User ID
   * @param {Object} focusAreaData - Focus area configuration
   * @returns {Promise<Object>} Created focus area
   */
  async createFocusArea(userId, focusAreaData) {
    try {
      // Validate focus area data
      this.validateFocusAreaData(focusAreaData);
      
      // Check user's focus area limit
      const userFocusAreas = this.focusAreas.get(userId) || [];
      if (userFocusAreas.length >= this.filterConfig.maxFocusAreas) {
        throw new Error(`Maximum focus areas limit (${this.filterConfig.maxFocusAreas}) reached`);
      }

      // Create focus area with unique ID
      const focusArea = {
        id: this.generateFocusAreaId(),
        userId,
        name: focusAreaData.name,
        description: focusAreaData.description || '',
        topics: focusAreaData.topics || [],
        categories: focusAreaData.categories || [],
        keywords: focusAreaData.keywords || [],
        sourceTypes: focusAreaData.sourceTypes || [],
        priority: focusAreaData.priority || 'medium',
        isActive: focusAreaData.isActive !== false, // Default to true
        createdAt: new Date(),
        updatedAt: new Date(),
        contentCount: 0,
        lastMatchedAt: null
      };

      // Add to user's focus areas
      userFocusAreas.push(focusArea);
      this.focusAreas.set(userId, userFocusAreas);

      return focusArea;
    } catch (error) {
      throw new Error(`Failed to create focus area: ${error.message}`);
    }
  }

  /**
   * Create focus area from template
   * @param {string} userId - User ID
   * @param {string} templateId - Template identifier
   * @param {Object} customizations - Optional customizations
   * @returns {Promise<Object>} Created focus area
   */
  async createFromTemplate(userId, templateId, customizations = {}) {
    try {
      const template = this.focusAreaTemplates[templateId];
      if (!template) {
        throw new Error(`Focus area template '${templateId}' not found`);
      }

      // Merge template with customizations
      const focusAreaData = {
        ...template,
        ...customizations,
        // Merge arrays instead of replacing
        topics: [...(template.topics || []), ...(customizations.topics || [])],
        categories: [...(template.categories || []), ...(customizations.categories || [])],
        keywords: [...(template.keywords || []), ...(customizations.keywords || [])],
        sourceTypes: [...(template.sourceTypes || []), ...(customizations.sourceTypes || [])]
      };

      return await this.createFocusArea(userId, focusAreaData);
    } catch (error) {
      throw new Error(`Failed to create focus area from template: ${error.message}`);
    }
  }

  /**
   * Update an existing focus area
   * @param {string} userId - User ID
   * @param {string} focusAreaId - Focus area ID
   * @param {Object} updates - Updates to apply
   * @returns {Promise<Object>} Updated focus area
   */
  async updateFocusArea(userId, focusAreaId, updates) {
    try {
      const userFocusAreas = this.focusAreas.get(userId) || [];
      const focusAreaIndex = userFocusAreas.findIndex(fa => fa.id === focusAreaId);
      
      if (focusAreaIndex === -1) {
        throw new Error('Focus area not found');
      }

      // Get the existing focus area
      const focusArea = userFocusAreas[focusAreaIndex];

      // Validate updates if they contain validation-required fields
      if (updates.name !== undefined || updates.topics !== undefined || updates.categories !== undefined || updates.keywords !== undefined || updates.priority !== undefined) {
        // Create a merged object for validation
        const dataToValidate = {
          name: updates.name !== undefined ? updates.name : focusArea.name,
          topics: updates.topics !== undefined ? updates.topics : focusArea.topics,
          categories: updates.categories !== undefined ? updates.categories : focusArea.categories,
          keywords: updates.keywords !== undefined ? updates.keywords : focusArea.keywords,
          priority: updates.priority !== undefined ? updates.priority : focusArea.priority
        };
        this.validateFocusAreaData(dataToValidate);
      }

      // Apply updates
      const updatedFocusArea = {
        ...focusArea,
        ...updates,
        updatedAt: new Date()
      };

      userFocusAreas[focusAreaIndex] = updatedFocusArea;
      this.focusAreas.set(userId, userFocusAreas);

      return updatedFocusArea;
    } catch (error) {
      throw new Error(`Failed to update focus area: ${error.message}`);
    }
  }

  /**
   * Delete a focus area
   * @param {string} userId - User ID
   * @param {string} focusAreaId - Focus area ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteFocusArea(userId, focusAreaId) {
    try {
      const userFocusAreas = this.focusAreas.get(userId) || [];
      const initialLength = userFocusAreas.length;
      
      const filteredFocusAreas = userFocusAreas.filter(fa => fa.id !== focusAreaId);
      
      if (filteredFocusAreas.length === initialLength) {
        throw new Error('Focus area not found');
      }

      this.focusAreas.set(userId, filteredFocusAreas);
      
      // Remove from active filters if present
      const activeFilters = this.contentFilters.get(userId) || [];
      const updatedFilters = activeFilters.filter(filterId => filterId !== focusAreaId);
      this.contentFilters.set(userId, updatedFilters);

      return true;
    } catch (error) {
      throw new Error(`Failed to delete focus area: ${error.message}`);
    }
  }

  /**
   * Get all focus areas for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} User's focus areas
   */
  async getFocusAreas(userId) {
    try {
      return this.focusAreas.get(userId) || [];
    } catch (error) {
      throw new Error(`Failed to get focus areas: ${error.message}`);
    }
  }

  /**
   * Get a specific focus area
   * @param {string} userId - User ID
   * @param {string} focusAreaId - Focus area ID
   * @returns {Promise<Object>} Focus area
   */
  async getFocusArea(userId, focusAreaId) {
    try {
      const userFocusAreas = this.focusAreas.get(userId) || [];
      const focusArea = userFocusAreas.find(fa => fa.id === focusAreaId);
      
      if (!focusArea) {
        throw new Error('Focus area not found');
      }

      return focusArea;
    } catch (error) {
      throw new Error(`Failed to get focus area: ${error.message}`);
    }
  }

  /**
   * Set active content filters for a user
   * @param {string} userId - User ID
   * @param {Array} focusAreaIds - Array of focus area IDs to activate
   * @returns {Promise<Array>} Active focus areas
   */
  async setActiveFilters(userId, focusAreaIds) {
    try {
      const userFocusAreas = this.focusAreas.get(userId) || [];
      
      // Validate that all focus area IDs exist
      const validIds = focusAreaIds.filter(id => 
        userFocusAreas.some(fa => fa.id === id && fa.isActive)
      );

      if (validIds.length !== focusAreaIds.length) {
        const invalidIds = focusAreaIds.filter(id => !validIds.includes(id));
        throw new Error(`Invalid focus area IDs: ${invalidIds.join(', ')}`);
      }

      this.contentFilters.set(userId, validIds);
      
      // Return the active focus areas
      return userFocusAreas.filter(fa => validIds.includes(fa.id));
    } catch (error) {
      throw new Error(`Failed to set active filters: ${error.message}`);
    }
  }

  /**
   * Get active content filters for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Active focus areas
   */
  async getActiveFilters(userId) {
    try {
      const activeFilterIds = this.contentFilters.get(userId) || [];
      const userFocusAreas = this.focusAreas.get(userId) || [];
      
      return userFocusAreas.filter(fa => 
        activeFilterIds.includes(fa.id) && fa.isActive
      );
    } catch (error) {
      throw new Error(`Failed to get active filters: ${error.message}`);
    }
  }

  /**
   * Filter content based on user's active focus areas
   * @param {string} userId - User ID
   * @param {Array} contentItems - Content to filter
   * @returns {Promise<Array>} Filtered content with focus area matches
   */
  async filterContent(userId, contentItems) {
    try {
      const activeFilters = await this.getActiveFilters(userId);
      
      if (activeFilters.length === 0) {
        // No active filters, return all content
        return contentItems.map(content => ({
          ...content,
          focusAreaMatches: [],
          focusAreaScore: 0
        }));
      }

      const filteredContent = [];

      for (const content of contentItems) {
        const matchResults = this.evaluateContentMatches(content, activeFilters);
        
        if (matchResults.totalScore >= this.filterConfig.minimumPassScore) {
          filteredContent.push({
            ...content,
            focusAreaMatches: matchResults.matches,
            focusAreaScore: matchResults.totalScore,
            matchingFocusAreas: matchResults.matchingFocusAreas
          });

          // Update focus area statistics
          this.updateFocusAreaStats(userId, matchResults.matchingFocusAreas);
        }
      }

      // Sort by focus area score (descending)
      return filteredContent.sort((a, b) => b.focusAreaScore - a.focusAreaScore);
    } catch (error) {
      throw new Error(`Failed to filter content: ${error.message}`);
    }
  }

  /**
   * Evaluate how well content matches focus areas
   * @param {Object} content - Content to evaluate
   * @param {Array} focusAreas - Focus areas to match against
   * @returns {Object} Match evaluation results
   */
  evaluateContentMatches(content, focusAreas) {
    const results = {
      matches: [],
      totalScore: 0,
      matchingFocusAreas: []
    };

    for (const focusArea of focusAreas) {
      const match = this.calculateFocusAreaMatch(content, focusArea);
      
      if (match.score > 0) {
        results.matches.push(match);
        results.matchingFocusAreas.push(focusArea.id);
      }
    }

    // Calculate total score (weighted average based on priority)
    if (results.matches.length > 0) {
      const priorityWeights = { high: 1.0, medium: 0.8, low: 0.6 };
      
      let weightedSum = 0;
      let totalWeight = 0;

      results.matches.forEach(match => {
        const weight = priorityWeights[match.focusArea.priority] || 0.8;
        weightedSum += match.score * weight;
        totalWeight += weight;
      });

      results.totalScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
    }

    return results;
  }

  /**
   * Calculate how well content matches a specific focus area
   * @param {Object} content - Content to evaluate
   * @param {Object} focusArea - Focus area to match against
   * @returns {Object} Match result
   */
  calculateFocusAreaMatch(content, focusArea) {
    const match = {
      focusAreaId: focusArea.id,
      focusArea: focusArea,
      score: 0,
      breakdown: {
        topicMatch: 0,
        categoryMatch: 0,
        keywordMatch: 0,
        sourceTypeMatch: 0
      },
      matchedElements: {
        topics: [],
        categories: [],
        keywords: [],
        sourceTypes: []
      }
    };

    // Calculate topic matches
    if (content.topics && focusArea.topics.length > 0) {
      const topicMatches = this.calculateArrayMatch(content.topics, focusArea.topics);
      match.breakdown.topicMatch = topicMatches.score;
      match.matchedElements.topics = topicMatches.matches;
    }

    // Calculate category matches
    if (content.categories && focusArea.categories.length > 0) {
      const categoryMatches = this.calculateArrayMatch(content.categories, focusArea.categories);
      match.breakdown.categoryMatch = categoryMatches.score;
      match.matchedElements.categories = categoryMatches.matches;
    }

    // Calculate keyword matches
    if (focusArea.keywords.length > 0) {
      const keywordMatches = this.calculateKeywordMatch(content, focusArea.keywords);
      match.breakdown.keywordMatch = keywordMatches.score;
      match.matchedElements.keywords = keywordMatches.matches;
    }

    // Calculate source type match
    if (content.sourceType && focusArea.sourceTypes.includes(content.sourceType)) {
      match.breakdown.sourceTypeMatch = 1.0;
      match.matchedElements.sourceTypes = [content.sourceType];
    }

    // Calculate weighted total score
    const weights = this.filterConfig.weights;
    match.score = (
      match.breakdown.topicMatch * weights.topicMatch +
      match.breakdown.categoryMatch * weights.categoryMatch +
      match.breakdown.keywordMatch * weights.keywordMatch +
      match.breakdown.sourceTypeMatch * weights.sourceTypeMatch
    );

    return match;
  }

  /**
   * Calculate match score between two arrays
   * @param {Array} contentArray - Content array (topics/categories)
   * @param {Array} focusArray - Focus area array
   * @returns {Object} Match result
   */
  calculateArrayMatch(contentArray, focusArray) {
    const matches = [];
    let totalScore = 0;

    for (const contentItem of contentArray) {
      for (const focusItem of focusArray) {
        if (this.isStringMatch(contentItem, focusItem)) {
          matches.push({
            content: contentItem,
            focus: focusItem,
            similarity: this.calculateStringSimilarity(contentItem, focusItem)
          });
          totalScore += 1;
          break; // Avoid double counting
        }
      }
    }

    return {
      score: Math.min(totalScore / Math.max(contentArray.length, focusArray.length), 1),
      matches
    };
  }

  /**
   * Calculate keyword matches in content text
   * @param {Object} content - Content object
   * @param {Array} keywords - Keywords to search for
   * @returns {Object} Keyword match result
   */
  calculateKeywordMatch(content, keywords) {
    const text = `${content.title || ''} ${content.description || ''} ${content.content || ''}`.toLowerCase();
    const matches = [];
    let matchCount = 0;

    for (const keyword of keywords) {
      if (text.includes(keyword.toLowerCase())) {
        matches.push(keyword);
        matchCount++;
      }
    }

    return {
      score: Math.min(matchCount / keywords.length, 1),
      matches
    };
  }

  /**
   * Check if two strings match (exact or partial)
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {boolean} Whether strings match
   */
  isStringMatch(str1, str2) {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    
    // Exact match
    if (s1 === s2) return true;
    
    // Partial match (one contains the other)
    if (s1.includes(s2) || s2.includes(s1)) return true;
    
    // Similarity-based match (for future enhancement)
    return this.calculateStringSimilarity(s1, s2) > 0.8;
  }

  /**
   * Calculate similarity between two strings
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Similarity score (0-1)
   */
  calculateStringSimilarity(str1, str2) {
    // Simple Jaccard similarity based on words
    const words1 = new Set(str1.toLowerCase().split(/\s+/));
    const words2 = new Set(str2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Update focus area statistics
   * @param {string} userId - User ID
   * @param {Array} matchingFocusAreaIds - IDs of matching focus areas
   */
  updateFocusAreaStats(userId, matchingFocusAreaIds) {
    const userFocusAreas = this.focusAreas.get(userId) || [];
    
    userFocusAreas.forEach(focusArea => {
      if (matchingFocusAreaIds.includes(focusArea.id)) {
        focusArea.contentCount = (focusArea.contentCount || 0) + 1;
        focusArea.lastMatchedAt = new Date();
      }
    });

    this.focusAreas.set(userId, userFocusAreas);
  }

  /**
   * Get focus area analytics for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Analytics data
   */
  async getFocusAreaAnalytics(userId) {
    try {
      const userFocusAreas = this.focusAreas.get(userId) || [];
      const activeFilterIds = this.contentFilters.get(userId) || [];

      const analytics = {
        totalFocusAreas: userFocusAreas.length,
        activeFocusAreas: activeFilterIds.length,
        focusAreaStats: userFocusAreas.map(fa => ({
          id: fa.id,
          name: fa.name,
          priority: fa.priority,
          isActive: fa.isActive,
          isFiltering: activeFilterIds.includes(fa.id),
          contentCount: fa.contentCount || 0,
          lastMatchedAt: fa.lastMatchedAt,
          createdAt: fa.createdAt,
          topicsCount: fa.topics.length,
          categoriesCount: fa.categories.length,
          keywordsCount: fa.keywords.length
        })),
        priorityDistribution: this.calculatePriorityDistribution(userFocusAreas),
        activitySummary: this.calculateActivitySummary(userFocusAreas)
      };

      return analytics;
    } catch (error) {
      throw new Error(`Failed to get focus area analytics: ${error.message}`);
    }
  }

  /**
   * Calculate priority distribution
   * @param {Array} focusAreas - Focus areas
   * @returns {Object} Priority distribution
   */
  calculatePriorityDistribution(focusAreas) {
    const distribution = { high: 0, medium: 0, low: 0 };
    
    focusAreas.forEach(fa => {
      distribution[fa.priority] = (distribution[fa.priority] || 0) + 1;
    });

    return distribution;
  }

  /**
   * Calculate activity summary
   * @param {Array} focusAreas - Focus areas
   * @returns {Object} Activity summary
   */
  calculateActivitySummary(focusAreas) {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    return {
      totalContentMatched: focusAreas.reduce((sum, fa) => sum + (fa.contentCount || 0), 0),
      activeToday: focusAreas.filter(fa => 
        fa.lastMatchedAt && new Date(fa.lastMatchedAt) > oneDayAgo
      ).length,
      activeThisWeek: focusAreas.filter(fa => 
        fa.lastMatchedAt && new Date(fa.lastMatchedAt) > oneWeekAgo
      ).length,
      neverMatched: focusAreas.filter(fa => !fa.lastMatchedAt).length
    };
  }

  /**
   * Suggest focus areas based on user's content interaction history
   * @param {string} userId - User ID
   * @param {Array} interactionHistory - User's content interactions
   * @returns {Promise<Array>} Suggested focus areas
   */
  async suggestFocusAreas(userId, interactionHistory) {
    try {
      if (!interactionHistory || interactionHistory.length === 0) {
        // Return popular templates if no history
        return Object.keys(this.focusAreaTemplates).map(templateId => ({
          templateId,
          ...this.focusAreaTemplates[templateId],
          reason: 'Popular focus area',
          confidence: 0.5
        }));
      }

      // Analyze interaction patterns
      const patterns = this.analyzeInteractionPatterns(interactionHistory);
      
      // Generate suggestions based on patterns
      const suggestions = this.generateFocusAreaSuggestions(patterns);
      
      // Filter out existing focus areas
      const existingFocusAreas = this.focusAreas.get(userId) || [];
      const existingTopics = new Set();
      existingFocusAreas.forEach(fa => {
        fa.topics.forEach(topic => existingTopics.add(topic.toLowerCase()));
      });

      return suggestions.filter(suggestion => {
        const hasOverlap = suggestion.topics.some(topic => 
          existingTopics.has(topic.toLowerCase())
        );
        return !hasOverlap;
      });
    } catch (error) {
      throw new Error(`Failed to suggest focus areas: ${error.message}`);
    }
  }

  /**
   * Analyze user interaction patterns
   * @param {Array} interactionHistory - Interaction history
   * @returns {Object} Interaction patterns
   */
  analyzeInteractionPatterns(interactionHistory) {
    const patterns = {
      topTopics: {},
      topCategories: {},
      topSourceTypes: {},
      engagementByTopic: {},
      totalInteractions: interactionHistory.length
    };

    interactionHistory.forEach(interaction => {
      const content = interaction.content;
      const engagement = this.getInteractionEngagement(interaction);

      // Count topics
      if (content.topics) {
        content.topics.forEach(topic => {
          patterns.topTopics[topic] = (patterns.topTopics[topic] || 0) + 1;
          patterns.engagementByTopic[topic] = (patterns.engagementByTopic[topic] || 0) + engagement;
        });
      }

      // Count categories
      if (content.categories) {
        content.categories.forEach(category => {
          patterns.topCategories[category] = (patterns.topCategories[category] || 0) + 1;
        });
      }

      // Count source types
      if (content.sourceType) {
        patterns.topSourceTypes[content.sourceType] = (patterns.topSourceTypes[content.sourceType] || 0) + 1;
      }
    });

    return patterns;
  }

  /**
   * Generate focus area suggestions from patterns
   * @param {Object} patterns - Interaction patterns
   * @returns {Array} Focus area suggestions
   */
  generateFocusAreaSuggestions(patterns) {
    const suggestions = [];

    // Get top topics by frequency and engagement
    const topTopics = Object.entries(patterns.topTopics)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([topic]) => topic);

    const topCategories = Object.entries(patterns.topCategories)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([category]) => category);

    // Create suggestions based on topic clusters
    const topicClusters = this.clusterTopics(topTopics);
    
    topicClusters.forEach((cluster, index) => {
      if (cluster.length >= 2) { // Only suggest if there are multiple related topics
        const avgEngagement = cluster.reduce((sum, topic) => 
          sum + (patterns.engagementByTopic[topic] || 0), 0
        ) / cluster.length;

        suggestions.push({
          name: this.generateClusterName(cluster),
          description: `Focus area based on your interest in ${cluster.join(', ')}`,
          topics: cluster,
          categories: topCategories.slice(0, 3),
          keywords: this.generateKeywordsFromTopics(cluster),
          sourceTypes: ['news', 'blog'],
          priority: avgEngagement > 0.7 ? 'high' : 'medium',
          reason: `You frequently engage with content about ${cluster[0]}`,
          confidence: Math.min(avgEngagement, 0.9)
        });
      }
    });

    return suggestions.slice(0, 5); // Return top 5 suggestions
  }

  /**
   * Cluster related topics together
   * @param {Array} topics - Topics to cluster
   * @returns {Array} Topic clusters
   */
  clusterTopics(topics) {
    // Simple clustering based on word similarity
    const clusters = [];
    const used = new Set();

    topics.forEach(topic => {
      if (used.has(topic)) return;

      const cluster = [topic];
      used.add(topic);

      topics.forEach(otherTopic => {
        if (topic !== otherTopic && !used.has(otherTopic)) {
          if (this.calculateStringSimilarity(topic, otherTopic) > 0.3) {
            cluster.push(otherTopic);
            used.add(otherTopic);
          }
        }
      });

      clusters.push(cluster);
    });

    return clusters;
  }

  /**
   * Generate a name for a topic cluster
   * @param {Array} cluster - Topic cluster
   * @returns {string} Cluster name
   */
  generateClusterName(cluster) {
    // Use the most common words across topics
    const words = cluster.join(' ').split(/\s+/);
    const wordCounts = {};
    
    words.forEach(word => {
      if (word.length > 3) { // Ignore short words
        wordCounts[word] = (wordCounts[word] || 0) + 1;
      }
    });

    const topWords = Object.entries(wordCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 2)
      .map(([word]) => word);

    return topWords.length > 0 ? 
      topWords.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' & ') :
      cluster[0].charAt(0).toUpperCase() + cluster[0].slice(1);
  }

  /**
   * Generate keywords from topics
   * @param {Array} topics - Topics
   * @returns {Array} Generated keywords
   */
  generateKeywordsFromTopics(topics) {
    const keywords = new Set();
    
    topics.forEach(topic => {
      // Add the topic itself
      keywords.add(topic);
      
      // Add individual words from multi-word topics
      topic.split(/\s+/).forEach(word => {
        if (word.length > 3) {
          keywords.add(word);
        }
      });
    });

    return Array.from(keywords).slice(0, 10);
  }

  /**
   * Get engagement score from interaction
   * @param {Object} interaction - Interaction object
   * @returns {number} Engagement score (0-1)
   */
  getInteractionEngagement(interaction) {
    const engagementMap = {
      view: 0.1,
      click: 0.3,
      save: 0.8,
      share: 0.9,
      like: 0.7,
      comment: 0.8,
      dismiss: 0.0
    };

    return engagementMap[interaction.type] || 0.1;
  }

  /**
   * Validate focus area data
   * @param {Object} focusAreaData - Focus area data to validate
   */
  validateFocusAreaData(focusAreaData) {
    if (!focusAreaData.name || typeof focusAreaData.name !== 'string') {
      throw new Error('Focus area name is required and must be a string');
    }

    if (focusAreaData.name.length < 2 || focusAreaData.name.length > 100) {
      throw new Error('Focus area name must be between 2 and 100 characters');
    }

    if (focusAreaData.topics && !Array.isArray(focusAreaData.topics)) {
      throw new Error('Topics must be an array');
    }

    if (focusAreaData.categories && !Array.isArray(focusAreaData.categories)) {
      throw new Error('Categories must be an array');
    }

    if (focusAreaData.keywords && !Array.isArray(focusAreaData.keywords)) {
      throw new Error('Keywords must be an array');
    }

    if (focusAreaData.priority && !['high', 'medium', 'low'].includes(focusAreaData.priority)) {
      throw new Error('Priority must be one of: high, medium, low');
    }
  }

  /**
   * Generate unique focus area ID
   * @returns {string} Unique ID
   */
  generateFocusAreaId() {
    return `fa_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get available focus area templates
   * @returns {Object} Available templates
   */
  getAvailableTemplates() {
    return { ...this.focusAreaTemplates };
  }

  /**
   * Get filter configuration
   * @returns {Object} Filter configuration
   */
  getFilterConfig() {
    return { ...this.filterConfig };
  }

  /**
   * Update filter configuration
   * @param {Object} config - New configuration
   */
  updateFilterConfig(config) {
    this.filterConfig = { ...this.filterConfig, ...config };
  }

  /**
   * Clear all data (for testing)
   */
  clearAllData() {
    this.focusAreas.clear();
    this.contentFilters.clear();
  }
}

module.exports = FocusAreaManager;