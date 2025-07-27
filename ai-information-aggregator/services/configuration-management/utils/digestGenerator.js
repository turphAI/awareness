const createLogger = require('../../../common/utils/logger');
const logger = createLogger('digest-generator');

class DigestGenerator {
  constructor() {
    this.contentService = null; // Will be injected
    this.personalizationService = null; // Will be injected
    this.libraryService = null; // Will be injected
  }

  // Set service dependencies (for testing and modularity)
  setServices({ contentService, personalizationService, libraryService }) {
    this.contentService = contentService;
    this.personalizationService = personalizationService;
    this.libraryService = libraryService;
  }

  /**
   * Generate a digest for a user based on their scheduling preferences
   * @param {Object} scheduling - User's digest scheduling configuration
   * @returns {Object} Generated digest content
   */
  async generateDigest(scheduling) {
    try {
      logger.info(`Generating digest for user ${scheduling.userId}`);

      // Get content selection criteria
      const criteria = scheduling.getContentSelectionCriteria();
      const formatting = scheduling.getFormattingPreferences();

      // Fetch content based on criteria
      const content = await this.fetchContent(scheduling.userId, criteria);

      // Apply personalization if enabled
      let personalizedContent = content;
      if (criteria.includePersonalizedContent && this.personalizationService) {
        personalizedContent = await this.applyPersonalization(scheduling.userId, content);
      }

      // Sort and limit content
      const sortedContent = this.sortContent(personalizedContent, criteria.sortBy);
      const limitedContent = sortedContent.slice(0, criteria.maxItems);

      // Format the digest
      const digest = await this.formatDigest(limitedContent, formatting);

      // Add metadata
      digest.metadata = {
        userId: scheduling.userId,
        generatedAt: new Date(),
        frequency: scheduling.frequency,
        contentCount: limitedContent.length,
        criteria: criteria,
        formatting: formatting
      };

      logger.info(`Generated digest with ${limitedContent.length} items for user ${scheduling.userId}`);
      return digest;

    } catch (error) {
      logger.error(`Error generating digest for user ${scheduling.userId}:`, error);
      throw error;
    }
  }

  /**
   * Fetch content based on selection criteria
   * @param {string} userId - User ID
   * @param {Object} criteria - Content selection criteria
   * @returns {Array} Array of content items
   */
  async fetchContent(userId, criteria) {
    try {
      // Mock implementation - in real system would call content discovery service
      const mockContent = await this.getMockContent(criteria);
      
      // Filter by content types
      let filteredContent = mockContent.filter(item => 
        criteria.contentTypes.includes(item.type)
      );

      // Filter by topic filters if specified
      if (criteria.topicFilters && criteria.topicFilters.length > 0) {
        filteredContent = filteredContent.filter(item =>
          item.topics && item.topics.some(topic =>
            criteria.topicFilters.some(filter =>
              topic.toLowerCase().includes(filter.toLowerCase())
            )
          )
        );
      }

      // Filter by source filters if specified
      if (criteria.sourceFilters && criteria.sourceFilters.length > 0) {
        filteredContent = filteredContent.filter(item =>
          criteria.sourceFilters.includes(item.sourceId)
        );
      }

      // Prioritize breaking news if enabled
      if (criteria.prioritizeBreakingNews) {
        filteredContent = this.prioritizeBreakingNews(filteredContent);
      }

      return filteredContent;

    } catch (error) {
      logger.error('Error fetching content:', error);
      throw error;
    }
  }

  /**
   * Apply personalization to content
   * @param {string} userId - User ID
   * @param {Array} content - Content items
   * @returns {Array} Personalized content items
   */
  async applyPersonalization(userId, content) {
    try {
      // Mock implementation - in real system would call personalization service
      return content.map(item => ({
        ...item,
        relevanceScore: Math.random() * 100, // Mock relevance score
        personalizedReason: 'Based on your interests in AI and Machine Learning'
      }));

    } catch (error) {
      logger.error('Error applying personalization:', error);
      return content; // Return original content if personalization fails
    }
  }

  /**
   * Sort content based on specified criteria
   * @param {Array} content - Content items
   * @param {string} sortBy - Sort criteria ('relevance', 'recency', 'popularity')
   * @returns {Array} Sorted content items
   */
  sortContent(content, sortBy) {
    switch (sortBy) {
      case 'relevance':
        return content.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
      
      case 'recency':
        return content.sort((a, b) => new Date(b.publishDate) - new Date(a.publishDate));
      
      case 'popularity':
        return content.sort((a, b) => (b.popularityScore || 0) - (a.popularityScore || 0));
      
      default:
        return content;
    }
  }

  /**
   * Prioritize breaking news content
   * @param {Array} content - Content items
   * @returns {Array} Content with breaking news prioritized
   */
  prioritizeBreakingNews(content) {
    const breakingNews = content.filter(item => item.isBreakingNews);
    const regularContent = content.filter(item => !item.isBreakingNews);
    
    return [...breakingNews, ...regularContent];
  }

  /**
   * Format the digest based on formatting preferences
   * @param {Array} content - Content items
   * @param {Object} formatting - Formatting preferences
   * @returns {Object} Formatted digest
   */
  async formatDigest(content, formatting) {
    try {
      let formattedContent = content;

      // Group by topic if enabled
      if (formatting.groupByTopic) {
        formattedContent = this.groupContentByTopic(content);
      }

      // Format individual items
      const formattedItems = await Promise.all(
        (Array.isArray(formattedContent) ? formattedContent : Object.values(formattedContent).flat())
          .map(item => this.formatContentItem(item, formatting))
      );

      const digest = {
        title: this.generateDigestTitle(content.length),
        summary: this.generateDigestSummary(content),
        content: formatting.groupByTopic ? formattedContent : formattedItems,
        totalItems: content.length,
        generatedAt: new Date()
      };

      return digest;

    } catch (error) {
      logger.error('Error formatting digest:', error);
      throw error;
    }
  }

  /**
   * Group content by topic
   * @param {Array} content - Content items
   * @returns {Object} Content grouped by topic
   */
  groupContentByTopic(content) {
    const grouped = {};
    
    content.forEach(item => {
      const primaryTopic = item.topics && item.topics.length > 0 ? item.topics[0] : 'General';
      
      if (!grouped[primaryTopic]) {
        grouped[primaryTopic] = [];
      }
      
      grouped[primaryTopic].push(item);
    });

    return grouped;
  }

  /**
   * Format individual content item
   * @param {Object} item - Content item
   * @param {Object} formatting - Formatting preferences
   * @returns {Object} Formatted content item
   */
  async formatContentItem(item, formatting) {
    const formatted = {
      id: item.id,
      title: item.title,
      author: item.author,
      publishDate: item.publishDate,
      url: item.url,
      type: item.type,
      topics: item.topics
    };

    // Include full summaries if enabled
    if (formatting.includeFullSummaries && item.summary) {
      formatted.summary = item.summary;
    } else if (item.summary) {
      // Include shortened summary
      formatted.summary = item.summary.length > 200 
        ? item.summary.substring(0, 200) + '...'
        : item.summary;
    }

    // Include key insights if available
    if (item.keyInsights && item.keyInsights.length > 0) {
      formatted.keyInsights = item.keyInsights.slice(0, 3); // Limit to top 3
    }

    // Include thumbnails if enabled
    if (formatting.includeThumbnails && item.thumbnail) {
      formatted.thumbnail = item.thumbnail;
    }

    // Include reading time if enabled
    if (formatting.includeReadingTime && item.readingTime) {
      formatted.readingTime = item.readingTime;
    } else if (formatting.includeReadingTime && item.summary) {
      // Estimate reading time based on summary length
      const wordsPerMinute = 200;
      const wordCount = item.summary.split(' ').length;
      formatted.readingTime = Math.ceil(wordCount / wordsPerMinute);
    }

    // Include relevance score if available
    if (item.relevanceScore) {
      formatted.relevanceScore = Math.round(item.relevanceScore);
    }

    return formatted;
  }

  /**
   * Generate digest title
   * @param {number} itemCount - Number of items in digest
   * @returns {string} Digest title
   */
  generateDigestTitle(itemCount) {
    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    return `Your AI Information Digest - ${today} (${itemCount} items)`;
  }

  /**
   * Generate digest summary
   * @param {Array} content - Content items
   * @returns {string} Digest summary
   */
  generateDigestSummary(content) {
    const topicCounts = {};
    const typeCounts = {};

    content.forEach(item => {
      // Count topics
      if (item.topics) {
        item.topics.forEach(topic => {
          topicCounts[topic] = (topicCounts[topic] || 0) + 1;
        });
      }

      // Count types
      typeCounts[item.type] = (typeCounts[item.type] || 0) + 1;
    });

    const topTopics = Object.entries(topicCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([topic]) => topic);

    const typesList = Object.entries(typeCounts)
      .map(([type, count]) => `${count} ${type}${count > 1 ? 's' : ''}`)
      .join(', ');

    let summary = `This digest contains ${content.length} items including ${typesList}.`;
    
    if (topTopics.length > 0) {
      summary += ` Top topics covered: ${topTopics.join(', ')}.`;
    }

    return summary;
  }

  /**
   * Get mock content for testing/development
   * @param {Object} criteria - Content selection criteria
   * @returns {Array} Mock content items
   */
  async getMockContent(criteria) {
    // Mock content for testing - in real system this would come from content discovery service
    return [
      {
        id: '1',
        title: 'Latest Advances in Large Language Models',
        author: 'Dr. Jane Smith',
        publishDate: new Date(Date.now() - 86400000), // 1 day ago
        url: 'https://example.com/llm-advances',
        type: 'articles',
        topics: ['AI', 'Machine Learning', 'NLP'],
        summary: 'Recent breakthroughs in large language models have shown significant improvements in reasoning capabilities and efficiency.',
        keyInsights: ['Improved reasoning', 'Better efficiency', 'New architectures'],
        relevanceScore: 95,
        popularityScore: 88,
        isBreakingNews: true,
        thumbnail: 'https://example.com/thumb1.jpg',
        readingTime: 5,
        sourceId: 'source1'
      },
      {
        id: '2',
        title: 'Understanding Transformer Architecture',
        author: 'Prof. John Doe',
        publishDate: new Date(Date.now() - 172800000), // 2 days ago
        url: 'https://example.com/transformer-arch',
        type: 'papers',
        topics: ['AI', 'Deep Learning', 'Architecture'],
        summary: 'A comprehensive analysis of transformer architecture and its impact on modern AI systems.',
        keyInsights: ['Attention mechanisms', 'Scalability', 'Performance gains'],
        relevanceScore: 87,
        popularityScore: 92,
        isBreakingNews: false,
        thumbnail: 'https://example.com/thumb2.jpg',
        readingTime: 12,
        sourceId: 'source2'
      },
      {
        id: '3',
        title: 'AI Ethics in Practice - Podcast Episode',
        author: 'AI Ethics Panel',
        publishDate: new Date(Date.now() - 259200000), // 3 days ago
        url: 'https://example.com/ai-ethics-podcast',
        type: 'podcasts',
        topics: ['AI Ethics', 'Governance', 'Society'],
        summary: 'Discussion on practical applications of AI ethics in real-world scenarios.',
        keyInsights: ['Bias mitigation', 'Transparency', 'Accountability'],
        relevanceScore: 78,
        popularityScore: 75,
        isBreakingNews: false,
        thumbnail: 'https://example.com/thumb3.jpg',
        readingTime: 45,
        sourceId: 'source3'
      },
      {
        id: '4',
        title: 'Computer Vision Breakthrough',
        author: 'Research Team',
        publishDate: new Date(Date.now() - 345600000), // 4 days ago
        url: 'https://example.com/cv-breakthrough',
        type: 'articles',
        topics: ['Computer Vision', 'AI', 'Research'],
        summary: 'New computer vision techniques achieve state-of-the-art results on benchmark datasets.',
        keyInsights: ['SOTA results', 'Novel techniques', 'Benchmark performance'],
        relevanceScore: 82,
        popularityScore: 79,
        isBreakingNews: false,
        thumbnail: 'https://example.com/thumb4.jpg',
        readingTime: 8,
        sourceId: 'source4'
      },
      {
        id: '5',
        title: 'Machine Learning in Healthcare',
        author: 'Medical AI Team',
        publishDate: new Date(Date.now() - 432000000), // 5 days ago
        url: 'https://example.com/ml-healthcare',
        type: 'papers',
        topics: ['Machine Learning', 'Healthcare', 'Applications'],
        summary: 'Exploring the applications and challenges of machine learning in healthcare settings.',
        keyInsights: ['Clinical applications', 'Data privacy', 'Regulatory challenges'],
        relevanceScore: 73,
        popularityScore: 81,
        isBreakingNews: false,
        thumbnail: 'https://example.com/thumb5.jpg',
        readingTime: 15,
        sourceId: 'source5'
      }
    ];
  }
}

module.exports = DigestGenerator;