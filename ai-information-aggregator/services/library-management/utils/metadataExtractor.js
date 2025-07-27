const ContentMetadata = require('../models/ContentMetadata');
const axios = require('axios');
const cheerio = require('cheerio');
const url = require('url');

class MetadataExtractor {
  constructor() {
    this.extractors = {
      webpage: this.extractWebpageMetadata.bind(this),
      article: this.extractArticleMetadata.bind(this),
      academic: this.extractAcademicMetadata.bind(this),
      video: this.extractVideoMetadata.bind(this),
      podcast: this.extractPodcastMetadata.bind(this),
      document: this.extractDocumentMetadata.bind(this)
    };
  }

  /**
   * Extract and normalize metadata from content
   * @param {Object} content - Content object
   * @param {Object} options - Extraction options
   * @returns {Promise<Object>} Extracted metadata
   */
  async extractMetadata(content, options = {}) {
    try {
      const contentType = this.determineContentType(content);
      const extractor = this.extractors[contentType] || this.extractBasicMetadata.bind(this);
      
      // Extract basic metadata
      let metadata = await this.extractBasicMetadata(content);
      
      // Apply specific extractor
      const specificMetadata = await extractor(content, options);
      metadata = { ...metadata, ...specificMetadata };
      
      // Enhance with additional processing
      metadata = await this.enhanceMetadata(metadata, content, options);
      
      // Normalize and validate
      metadata = this.normalizeMetadata(metadata);
      
      return metadata;
    } catch (error) {
      throw new Error(`Failed to extract metadata: ${error.message}`);
    }
  }

  /**
   * Extract basic metadata common to all content types
   * @param {Object} content - Content object
   * @returns {Promise<Object>} Basic metadata
   */
  async extractBasicMetadata(content) {
    const metadata = {
      title: content.title || '',
      description: content.description || content.summary || '',
      summary: content.summary || '',
      contentType: this.determineContentType(content),
      language: content.language || 'en',
      publishedAt: content.publishedAt ? new Date(content.publishedAt) : null,
      updatedAt: content.updatedAt ? new Date(content.updatedAt) : null,
      
      // Source information
      source: {
        name: content.source?.name || '',
        url: content.url || content.source?.url || '',
        domain: content.url ? this.extractDomain(content.url) : '',
        credibilityScore: content.source?.credibilityScore || 0.5,
        authorityScore: content.source?.authorityScore || 0.5
      },
      
      // Authors
      authors: this.extractAuthors(content),
      
      // Content properties
      wordCount: content.wordCount || this.estimateWordCount(content.content || content.description || ''),
      readingTime: 0, // Will be calculated
      
      // Initialize other fields
      keywords: content.keywords || [],
      tags: content.tags || [],
      categories: content.categories || [],
      topics: content.topics || [],
      
      // Quality metrics (will be calculated)
      qualityScore: 0.5,
      relevanceScore: 0.5,
      popularityScore: 0.5,
      freshnessScore: 0.5,
      
      // Structure analysis
      structure: {
        hasImages: false,
        hasVideos: false,
        hasAudio: false,
        hasCode: false,
        hasTables: false,
        hasCharts: false,
        sectionCount: 0,
        headingCount: 0
      },
      
      // Engagement metrics
      engagement: {
        views: content.metrics?.views || 0,
        likes: content.metrics?.likes || 0,
        shares: content.metrics?.shares || 0,
        comments: content.metrics?.comments || 0,
        saves: content.metrics?.saves || 0,
        avgRating: content.metrics?.avgRating || 0,
        ratingCount: content.metrics?.ratingCount || 0
      },
      
      // Processing status
      processing: {
        status: 'processing',
        extractedAt: new Date()
      }
    };

    // Calculate reading time
    metadata.readingTime = this.calculateReadingTime(metadata.wordCount);
    
    return metadata;
  }

  /**
   * Extract webpage-specific metadata
   * @param {Object} content - Content object
   * @param {Object} options - Extraction options
   * @returns {Promise<Object>} Webpage metadata
   */
  async extractWebpageMetadata(content, options = {}) {
    const metadata = {};
    
    if (content.url && options.fetchContent !== false) {
      try {
        const response = await axios.get(content.url, {
          timeout: 10000,
          headers: {
            'User-Agent': 'AI Information Aggregator Bot 1.0'
          }
        });
        
        const $ = cheerio.load(response.data);
        
        // Extract meta tags
        metadata.title = metadata.title || $('meta[property="og:title"]').attr('content') || $('title').text().trim();
        metadata.description = metadata.description || $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content');
        
        // Extract keywords from meta tags
        const metaKeywords = $('meta[name="keywords"]').attr('content');
        if (metaKeywords) {
          metadata.keywords = [...(metadata.keywords || []), ...metaKeywords.split(',').map(k => k.trim())];
        }
        
        // Analyze content structure
        metadata.structure = {
          hasImages: $('img').length > 0,
          hasVideos: $('video, iframe[src*="youtube"], iframe[src*="vimeo"]').length > 0,
          hasAudio: $('audio').length > 0,
          hasCode: $('code, pre').length > 0,
          hasTables: $('table').length > 0,
          hasCharts: $('canvas, svg').length > 0,
          sectionCount: $('section').length || $('div.section').length,
          headingCount: $('h1, h2, h3, h4, h5, h6').length
        };
        
        // Extract author information
        const authorMeta = $('meta[name="author"]').attr('content');
        if (authorMeta && !metadata.authors?.length) {
          metadata.authors = [{ name: authorMeta }];
        }
        
        // Extract publication date
        const pubDate = $('meta[property="article:published_time"]').attr('content') || 
                       $('meta[name="date"]').attr('content') ||
                       $('time[datetime]').attr('datetime');
        if (pubDate && !metadata.publishedAt) {
          metadata.publishedAt = new Date(pubDate);
        }
        
      } catch (error) {
        console.warn(`Failed to fetch webpage content: ${error.message}`);
      }
    }
    
    return metadata;
  }

  /**
   * Extract article-specific metadata
   * @param {Object} content - Content object
   * @returns {Promise<Object>} Article metadata
   */
  async extractArticleMetadata(content) {
    const metadata = await this.extractWebpageMetadata(content);
    
    // Article-specific enhancements
    if (content.content) {
      // Extract topics using simple keyword analysis
      const topics = this.extractTopicsFromText(content.content);
      metadata.topics = [...(metadata.topics || []), ...topics];
      
      // Analyze content difficulty
      metadata.difficulty = this.analyzeDifficulty(content.content);
    }
    
    return metadata;
  }

  /**
   * Extract academic paper metadata
   * @param {Object} content - Content object
   * @returns {Promise<Object>} Academic metadata
   */
  async extractAcademicMetadata(content) {
    const metadata = {};
    
    // Extract DOI if present
    if (content.doi) {
      metadata.customFields = { doi: content.doi };
    }
    
    // Extract citations
    if (content.references) {
      metadata.citations = content.references.map(ref => ({
        title: ref.title || '',
        authors: ref.authors || [],
        source: ref.journal || ref.conference || '',
        year: ref.year,
        url: ref.url,
        doi: ref.doi
      }));
    }
    
    // Academic papers are typically advanced
    metadata.difficulty = 'advanced';
    
    // Extract research topics
    if (content.abstract) {
      const topics = this.extractTopicsFromText(content.abstract);
      metadata.topics = [...(metadata.topics || []), ...topics];
    }
    
    return metadata;
  }

  /**
   * Extract video metadata
   * @param {Object} content - Content object
   * @returns {Promise<Object>} Video metadata
   */
  async extractVideoMetadata(content) {
    const metadata = {};
    
    // Video-specific properties
    if (content.duration) {
      metadata.customFields = { 
        duration: content.duration,
        durationMinutes: Math.ceil(content.duration / 60)
      };
      
      // Estimate reading time based on video duration
      metadata.readingTime = Math.ceil(content.duration / 60);
    }
    
    if (content.transcript) {
      metadata.wordCount = this.estimateWordCount(content.transcript);
      const topics = this.extractTopicsFromText(content.transcript);
      metadata.topics = [...(metadata.topics || []), ...topics];
    }
    
    metadata.structure = {
      hasImages: true, // Videos have thumbnails
      hasVideos: true,
      hasAudio: true,
      hasCode: false,
      hasTables: false,
      hasCharts: false,
      sectionCount: content.chapters?.length || 0,
      headingCount: content.chapters?.length || 0
    };
    
    return metadata;
  }

  /**
   * Extract podcast metadata
   * @param {Object} content - Content object
   * @returns {Promise<Object>} Podcast metadata
   */
  async extractPodcastMetadata(content) {
    const metadata = {};
    
    // Podcast-specific properties
    if (content.duration) {
      metadata.customFields = { 
        duration: content.duration,
        durationMinutes: Math.ceil(content.duration / 60),
        episodeNumber: content.episodeNumber,
        seasonNumber: content.seasonNumber
      };
      
      metadata.readingTime = Math.ceil(content.duration / 60);
    }
    
    if (content.transcript) {
      metadata.wordCount = this.estimateWordCount(content.transcript);
      const topics = this.extractTopicsFromText(content.transcript);
      metadata.topics = [...(metadata.topics || []), ...topics];
    }
    
    metadata.structure = {
      hasImages: false,
      hasVideos: false,
      hasAudio: true,
      hasCode: false,
      hasTables: false,
      hasCharts: false,
      sectionCount: content.segments?.length || 0,
      headingCount: content.segments?.length || 0
    };
    
    return metadata;
  }

  /**
   * Extract document metadata
   * @param {Object} content - Content object
   * @returns {Promise<Object>} Document metadata
   */
  async extractDocumentMetadata(content) {
    const metadata = {};
    
    // Document-specific properties
    if (content.pageCount) {
      metadata.customFields = { pageCount: content.pageCount };
      // Estimate reading time based on page count (assuming 250 words per page)
      metadata.readingTime = Math.ceil((content.pageCount * 250) / 200); // 200 WPM
    }
    
    if (content.content) {
      const topics = this.extractTopicsFromText(content.content);
      metadata.topics = [...(metadata.topics || []), ...topics];
      metadata.difficulty = this.analyzeDifficulty(content.content);
    }
    
    return metadata;
  }

  /**
   * Enhance metadata with additional processing
   * @param {Object} metadata - Current metadata
   * @param {Object} content - Original content
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Enhanced metadata
   */
  async enhanceMetadata(metadata, content, options = {}) {
    // Calculate quality scores
    metadata.qualityScore = this.calculateQualityScore(metadata, content);
    metadata.relevanceScore = this.calculateRelevanceScore(metadata, content);
    metadata.popularityScore = this.calculatePopularityScore(metadata, content);
    metadata.freshnessScore = this.calculateFreshnessScore(metadata, content);
    
    // Extract additional keywords from content
    if (content.content && options.extractKeywords !== false) {
      const extractedKeywords = this.extractKeywords(content.content);
      metadata.keywords = [...(metadata.keywords || []), ...extractedKeywords];
    }
    
    // Deduplicate arrays
    metadata.keywords = [...new Set(metadata.keywords || [])];
    metadata.tags = [...new Set(metadata.tags || [])];
    metadata.categories = [...new Set(metadata.categories || [])];
    metadata.topics = [...new Set(metadata.topics || [])];
    
    return metadata;
  }

  /**
   * Normalize metadata to ensure consistency
   * @param {Object} metadata - Metadata to normalize
   * @returns {Object} Normalized metadata
   */
  normalizeMetadata(metadata) {
    // Ensure required fields
    metadata.title = metadata.title || 'Untitled';
    metadata.contentType = metadata.contentType || 'other';
    metadata.language = metadata.language || 'en';
    
    // Normalize arrays
    metadata.keywords = (metadata.keywords || []).map(k => k.toLowerCase().trim()).filter(Boolean);
    metadata.tags = (metadata.tags || []).map(t => t.toLowerCase().trim()).filter(Boolean);
    metadata.categories = (metadata.categories || []).map(c => c.toLowerCase().trim()).filter(Boolean);
    metadata.topics = (metadata.topics || []).map(t => t.toLowerCase().trim()).filter(Boolean);
    
    // Ensure numeric fields are valid
    metadata.wordCount = Math.max(0, metadata.wordCount || 0);
    metadata.readingTime = Math.max(0, metadata.readingTime || 0);
    metadata.qualityScore = Math.max(0, Math.min(1, metadata.qualityScore || 0.5));
    metadata.relevanceScore = Math.max(0, Math.min(1, metadata.relevanceScore || 0.5));
    metadata.popularityScore = Math.max(0, Math.min(1, metadata.popularityScore || 0.5));
    metadata.freshnessScore = Math.max(0, Math.min(1, metadata.freshnessScore || 0.5));
    
    // Set processing status
    metadata.processing = {
      ...metadata.processing,
      status: 'completed',
      lastProcessedAt: new Date()
    };
    
    return metadata;
  }

  /**
   * Determine content type from content object
   * @param {Object} content - Content object
   * @returns {string} Content type
   */
  determineContentType(content) {
    if (content.type) return content.type;
    if (content.contentType) return content.contentType;
    
    // Infer from URL or other properties
    if (content.url) {
      const urlObj = new URL(content.url);
      if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('vimeo.com')) {
        return 'video';
      }
      if (urlObj.pathname.includes('.pdf')) {
        return 'document';
      }
    }
    
    if (content.duration) {
      return content.transcript ? 'podcast' : 'video';
    }
    
    if (content.doi || content.journal) {
      return 'academic';
    }
    
    return 'article';
  }

  /**
   * Extract domain from URL
   * @param {string} urlString - URL string
   * @returns {string} Domain
   */
  extractDomain(urlString) {
    try {
      const urlObj = new URL(urlString);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return '';
    }
  }

  /**
   * Extract authors from content
   * @param {Object} content - Content object
   * @returns {Array} Authors array
   */
  extractAuthors(content) {
    if (content.authors && Array.isArray(content.authors)) {
      return content.authors.map(author => ({
        name: typeof author === 'string' ? author : author.name,
        email: author.email || '',
        affiliation: author.affiliation || '',
        bio: author.bio || '',
        expertise: author.expertise || []
      }));
    }
    
    if (content.author) {
      return [{
        name: content.author,
        email: '',
        affiliation: '',
        bio: '',
        expertise: []
      }];
    }
    
    return [];
  }

  /**
   * Estimate word count from text
   * @param {string} text - Text content
   * @returns {number} Estimated word count
   */
  estimateWordCount(text) {
    if (!text) return 0;
    return text.trim().split(/\s+/).length;
  }

  /**
   * Calculate reading time in minutes
   * @param {number} wordCount - Word count
   * @param {number} wpm - Words per minute (default: 200)
   * @returns {number} Reading time in minutes
   */
  calculateReadingTime(wordCount, wpm = 200) {
    return Math.ceil(wordCount / wpm);
  }

  /**
   * Extract topics from text using simple keyword analysis
   * @param {string} text - Text content
   * @returns {Array} Extracted topics
   */
  extractTopicsFromText(text) {
    if (!text) return [];
    
    // Simple topic extraction - in a real implementation, you'd use NLP
    const commonTopics = [
      'artificial intelligence', 'machine learning', 'deep learning', 'neural networks',
      'blockchain', 'cryptocurrency', 'web development', 'mobile development',
      'data science', 'big data', 'cloud computing', 'cybersecurity',
      'software engineering', 'programming', 'javascript', 'python', 'react',
      'business', 'marketing', 'finance', 'economics', 'management',
      'health', 'medicine', 'science', 'research', 'technology'
    ];
    
    const lowerText = text.toLowerCase();
    return commonTopics.filter(topic => lowerText.includes(topic));
  }

  /**
   * Extract keywords from text
   * @param {string} text - Text content
   * @returns {Array} Extracted keywords
   */
  extractKeywords(text) {
    if (!text) return [];
    
    // Simple keyword extraction - remove common words and get frequent terms
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those']);
    
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.has(word));
    
    // Count word frequency
    const wordCount = {};
    words.forEach(word => {
      wordCount[word] = (wordCount[word] || 0) + 1;
    });
    
    // Return top keywords
    return Object.entries(wordCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);
  }

  /**
   * Analyze content difficulty
   * @param {string} text - Text content
   * @returns {string} Difficulty level
   */
  analyzeDifficulty(text) {
    if (!text) return 'intermediate';
    
    // Simple difficulty analysis based on word length and sentence complexity
    const words = text.split(/\s+/);
    const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const avgSentenceLength = words.length / sentences.length;
    
    if (avgWordLength > 6 && avgSentenceLength > 20) {
      return 'advanced';
    } else if (avgWordLength > 5 && avgSentenceLength > 15) {
      return 'intermediate';
    } else {
      return 'beginner';
    }
  }

  /**
   * Calculate quality score
   * @param {Object} metadata - Metadata object
   * @param {Object} content - Content object
   * @returns {number} Quality score (0-1)
   */
  calculateQualityScore(metadata, content) {
    let score = 0.5; // Base score
    
    // Content completeness
    if (metadata.title && metadata.title.length > 10) score += 0.1;
    if (metadata.description && metadata.description.length > 50) score += 0.1;
    if (metadata.authors && metadata.authors.length > 0) score += 0.1;
    if (metadata.wordCount > 500) score += 0.1;
    
    // Source credibility
    if (metadata.source.credibilityScore > 0.7) score += 0.1;
    
    // Content structure
    if (metadata.structure.headingCount > 0) score += 0.05;
    if (metadata.structure.sectionCount > 0) score += 0.05;
    
    return Math.min(1, score);
  }

  /**
   * Calculate relevance score
   * @param {Object} metadata - Metadata object
   * @param {Object} content - Content object
   * @returns {number} Relevance score (0-1)
   */
  calculateRelevanceScore(metadata, content) {
    let score = 0.5; // Base score
    
    // Topic relevance
    if (metadata.topics && metadata.topics.length > 0) score += 0.2;
    if (metadata.keywords && metadata.keywords.length > 5) score += 0.1;
    if (metadata.categories && metadata.categories.length > 0) score += 0.1;
    
    // Content depth
    if (metadata.wordCount > 1000) score += 0.1;
    
    return Math.min(1, score);
  }

  /**
   * Calculate popularity score
   * @param {Object} metadata - Metadata object
   * @param {Object} content - Content object
   * @returns {number} Popularity score (0-1)
   */
  calculatePopularityScore(metadata, content) {
    const engagement = metadata.engagement;
    let score = 0.3; // Base score
    
    // Engagement metrics
    if (engagement.views > 1000) score += 0.2;
    if (engagement.likes > 50) score += 0.1;
    if (engagement.shares > 10) score += 0.1;
    if (engagement.comments > 5) score += 0.1;
    if (engagement.saves > 20) score += 0.2;
    
    return Math.min(1, score);
  }

  /**
   * Calculate freshness score
   * @param {Object} metadata - Metadata object
   * @param {Object} content - Content object
   * @returns {number} Freshness score (0-1)
   */
  calculateFreshnessScore(metadata, content) {
    if (!metadata.publishedAt) return 0.5;
    
    const now = new Date();
    const ageInDays = (now - metadata.publishedAt) / (1000 * 60 * 60 * 24);
    
    if (ageInDays < 7) return 1.0;
    if (ageInDays < 30) return 0.8;
    if (ageInDays < 90) return 0.6;
    if (ageInDays < 365) return 0.4;
    return 0.2;
  }
}

module.exports = MetadataExtractor;