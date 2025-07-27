const { Client } = require('elasticsearch');
const natural = require('natural');
const createLogger = require('../../../common/utils/logger');

const logger = createLogger('search-engine');

/**
 * Search Engine Service
 * Provides full-text search capabilities using Elasticsearch and natural language processing
 */
class SearchEngine {
  constructor() {
    this.client = null;
    this.stemmer = natural.PorterStemmer;
    this.tokenizer = new natural.WordTokenizer();
    this.tfidf = new natural.TfIdf();
    this.isConnected = false;
    
    this.initializeElasticsearch();
  }

  /**
   * Initialize Elasticsearch connection
   */
  async initializeElasticsearch() {
    try {
      const elasticsearchUrl = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';
      
      this.client = new Client({
        host: elasticsearchUrl,
        log: process.env.NODE_ENV === 'development' ? 'trace' : 'error'
      });

      // Test connection
      await this.client.ping({ requestTimeout: 5000 });
      this.isConnected = true;
      logger.info('Connected to Elasticsearch');

      // Create index if it doesn't exist
      await this.createContentIndex();
    } catch (error) {
      logger.warn('Elasticsearch not available, falling back to MongoDB text search:', error.message);
      this.isConnected = false;
    }
  }

  /**
   * Create content index in Elasticsearch
   */
  async createContentIndex() {
    if (!this.isConnected) return;

    try {
      const indexExists = await this.client.indices.exists({ index: 'content' });
      
      if (!indexExists) {
        await this.client.indices.create({
          index: 'content',
          body: {
            settings: {
              analysis: {
                analyzer: {
                  content_analyzer: {
                    type: 'custom',
                    tokenizer: 'standard',
                    filter: [
                      'lowercase',
                      'stop',
                      'stemmer',
                      'synonym'
                    ]
                  }
                },
                filter: {
                  synonym: {
                    type: 'synonym',
                    synonyms: [
                      'AI,artificial intelligence,machine intelligence',
                      'ML,machine learning',
                      'DL,deep learning',
                      'NLP,natural language processing',
                      'CV,computer vision'
                    ]
                  }
                }
              }
            },
            mappings: {
              properties: {
                title: {
                  type: 'text',
                  analyzer: 'content_analyzer',
                  boost: 3.0
                },
                summary: {
                  type: 'text',
                  analyzer: 'content_analyzer',
                  boost: 2.0
                },
                fullText: {
                  type: 'text',
                  analyzer: 'content_analyzer'
                },
                keyInsights: {
                  type: 'text',
                  analyzer: 'content_analyzer',
                  boost: 2.5
                },
                author: {
                  type: 'text',
                  analyzer: 'keyword',
                  boost: 1.5
                },
                type: {
                  type: 'keyword'
                },
                categories: {
                  type: 'keyword'
                },
                topics: {
                  type: 'keyword'
                },
                publishDate: {
                  type: 'date'
                },
                relevanceScore: {
                  type: 'float'
                },
                qualityScore: {
                  type: 'float'
                },
                readCount: {
                  type: 'integer'
                },
                saveCount: {
                  type: 'integer'
                },
                outdated: {
                  type: 'boolean'
                },
                processed: {
                  type: 'boolean'
                }
              }
            }
          }
        });
        
        logger.info('Created content index in Elasticsearch');
      }
    } catch (error) {
      logger.error('Error creating Elasticsearch index:', error);
    }
  }

  /**
   * Index content document in Elasticsearch
   * @param {Object} content - Content document to index
   */
  async indexContent(content) {
    if (!this.isConnected) return;

    try {
      await this.client.index({
        index: 'content',
        id: content._id.toString(),
        body: {
          title: content.title,
          summary: content.summary,
          fullText: content.fullText,
          keyInsights: content.keyInsights,
          author: content.author,
          type: content.type,
          categories: content.categories,
          topics: content.topics,
          publishDate: content.publishDate,
          relevanceScore: content.relevanceScore,
          qualityScore: content.qualityScore,
          readCount: content.readCount,
          saveCount: content.saveCount,
          outdated: content.outdated,
          processed: content.processed
        }
      });
      
      logger.debug(`Indexed content: ${content.title}`);
    } catch (error) {
      logger.error('Error indexing content:', error);
    }
  }

  /**
   * Remove content from Elasticsearch index
   * @param {string} contentId - Content ID to remove
   */
  async removeContent(contentId) {
    if (!this.isConnected) return;

    try {
      await this.client.delete({
        index: 'content',
        id: contentId
      });
      
      logger.debug(`Removed content from index: ${contentId}`);
    } catch (error) {
      if (error.status !== 404) {
        logger.error('Error removing content from index:', error);
      }
    }
  }

  /**
   * Perform full-text search using Elasticsearch
   * @param {Object} searchParams - Search parameters
   * @returns {Object} Search results
   */
  async searchWithElasticsearch(searchParams) {
    if (!this.isConnected) {
      throw new Error('Elasticsearch not available');
    }

    const {
      query,
      filters = {},
      sortBy = 'relevance',
      sortOrder = 'desc',
      page = 1,
      limit = 20
    } = searchParams;

    try {
      // Build Elasticsearch query
      const esQuery = {
        bool: {
          must: [],
          filter: []
        }
      };

      // Add text search
      if (query) {
        esQuery.bool.must.push({
          multi_match: {
            query: query,
            fields: [
              'title^3',
              'summary^2',
              'keyInsights^2.5',
              'fullText',
              'author^1.5'
            ],
            type: 'best_fields',
            fuzziness: 'AUTO',
            operator: 'or'
          }
        });
      }

      // Add filters
      if (filters.type) {
        const types = Array.isArray(filters.type) ? filters.type : [filters.type];
        esQuery.bool.filter.push({ terms: { type: types } });
      }

      if (filters.categories) {
        const categories = Array.isArray(filters.categories) ? filters.categories : [filters.categories];
        esQuery.bool.filter.push({ terms: { categories: categories } });
      }

      if (filters.topics) {
        const topics = Array.isArray(filters.topics) ? filters.topics : [filters.topics];
        esQuery.bool.filter.push({ terms: { topics: topics } });
      }

      if (filters.author) {
        esQuery.bool.filter.push({
          match: { author: { query: filters.author, fuzziness: 'AUTO' } }
        });
      }

      if (filters.dateFrom || filters.dateTo) {
        const dateRange = {};
        if (filters.dateFrom) dateRange.gte = filters.dateFrom;
        if (filters.dateTo) dateRange.lte = filters.dateTo;
        esQuery.bool.filter.push({ range: { publishDate: dateRange } });
      }

      if (filters.relevanceMin !== undefined || filters.relevanceMax !== undefined) {
        const relevanceRange = {};
        if (filters.relevanceMin !== undefined) relevanceRange.gte = filters.relevanceMin;
        if (filters.relevanceMax !== undefined) relevanceRange.lte = filters.relevanceMax;
        esQuery.bool.filter.push({ range: { relevanceScore: relevanceRange } });
      }

      // Add default filters
      esQuery.bool.filter.push({ term: { processed: true } });
      
      if (!filters.includeOutdated) {
        esQuery.bool.filter.push({ term: { outdated: false } });
      }

      // Build sort
      const sort = [];
      switch (sortBy) {
        case 'relevance':
          if (query) {
            sort.push('_score');
          } else {
            sort.push({ relevanceScore: { order: sortOrder } });
          }
          break;
        case 'date':
          sort.push({ publishDate: { order: sortOrder } });
          break;
        case 'quality':
          sort.push({ qualityScore: { order: sortOrder } });
          break;
        case 'readCount':
          sort.push({ readCount: { order: sortOrder } });
          break;
        case 'saveCount':
          sort.push({ saveCount: { order: sortOrder } });
          break;
        default:
          sort.push({ relevanceScore: { order: 'desc' } });
      }

      // Execute search
      const response = await this.client.search({
        index: 'content',
        body: {
          query: esQuery,
          sort: sort,
          from: (page - 1) * limit,
          size: limit,
          highlight: {
            fields: {
              title: {},
              summary: {},
              fullText: { fragment_size: 150, number_of_fragments: 3 }
            }
          }
        }
      });

      // Process results
      const results = response.hits.hits.map(hit => ({
        _id: hit._id,
        _score: hit._score,
        ...hit._source,
        highlights: hit.highlight
      }));

      return {
        results,
        totalCount: response.hits.total.value || response.hits.total,
        maxScore: response.hits.max_score
      };

    } catch (error) {
      logger.error('Elasticsearch search error:', error);
      throw error;
    }
  }

  /**
   * Get search suggestions using Elasticsearch
   * @param {string} query - Partial query string
   * @param {number} limit - Maximum number of suggestions
   * @returns {Array} Array of suggestions
   */
  async getSuggestions(query, limit = 10) {
    if (!this.isConnected) {
      return [];
    }

    try {
      const response = await this.client.search({
        index: 'content',
        body: {
          suggest: {
            title_suggest: {
              prefix: query,
              completion: {
                field: 'title.suggest',
                size: limit / 2
              }
            },
            author_suggest: {
              prefix: query,
              completion: {
                field: 'author.suggest',
                size: limit / 4
              }
            },
            topic_suggest: {
              prefix: query,
              completion: {
                field: 'topics.suggest',
                size: limit / 4
              }
            }
          }
        }
      });

      const suggestions = [];
      
      // Process title suggestions
      response.suggest.title_suggest[0].options.forEach(option => {
        suggestions.push({
          type: 'title',
          value: option.text,
          label: option.text,
          score: option._score
        });
      });

      // Process author suggestions
      response.suggest.author_suggest[0].options.forEach(option => {
        suggestions.push({
          type: 'author',
          value: option.text,
          label: `Author: ${option.text}`,
          score: option._score
        });
      });

      // Process topic suggestions
      response.suggest.topic_suggest[0].options.forEach(option => {
        suggestions.push({
          type: 'topic',
          value: option.text,
          label: `Topic: ${option.text}`,
          score: option._score
        });
      });

      return suggestions.sort((a, b) => b.score - a.score).slice(0, limit);

    } catch (error) {
      logger.error('Error getting suggestions:', error);
      return [];
    }
  }

  /**
   * Analyze text using natural language processing
   * @param {string} text - Text to analyze
   * @returns {Object} Analysis results
   */
  analyzeText(text) {
    if (!text) return {};

    try {
      // Tokenize
      const tokens = this.tokenizer.tokenize(text.toLowerCase());
      
      // Remove stop words
      const filteredTokens = tokens.filter(token => 
        !natural.stopwords.includes(token) && token.length > 2
      );

      // Stem words
      const stemmedTokens = filteredTokens.map(token => 
        this.stemmer.stem(token)
      );

      // Calculate term frequency
      const termFreq = {};
      stemmedTokens.forEach(token => {
        termFreq[token] = (termFreq[token] || 0) + 1;
      });

      // Extract key terms (top 10 most frequent)
      const keyTerms = Object.entries(termFreq)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([term]) => term);

      // Calculate readability score (Flesch Reading Ease approximation)
      const sentences = text.split(/[.!?]+/).length;
      const words = tokens.length;
      const syllables = tokens.reduce((count, word) => {
        return count + this.countSyllables(word);
      }, 0);

      const readabilityScore = sentences > 0 && words > 0 ? 
        206.835 - (1.015 * (words / sentences)) - (84.6 * (syllables / words)) : 0;

      return {
        tokenCount: tokens.length,
        uniqueTokens: new Set(tokens).size,
        keyTerms,
        readabilityScore: Math.max(0, Math.min(100, readabilityScore)),
        sentiment: this.analyzeSentiment(text)
      };

    } catch (error) {
      logger.error('Error analyzing text:', error);
      return {};
    }
  }

  /**
   * Count syllables in a word (approximation)
   * @param {string} word - Word to count syllables for
   * @returns {number} Number of syllables
   */
  countSyllables(word) {
    word = word.toLowerCase();
    if (word.length <= 3) return 1;
    
    const vowels = 'aeiouy';
    let count = 0;
    let previousWasVowel = false;
    
    for (let i = 0; i < word.length; i++) {
      const isVowel = vowels.includes(word[i]);
      if (isVowel && !previousWasVowel) {
        count++;
      }
      previousWasVowel = isVowel;
    }
    
    // Handle silent 'e'
    if (word.endsWith('e')) {
      count--;
    }
    
    return Math.max(1, count);
  }

  /**
   * Analyze sentiment of text
   * @param {string} text - Text to analyze
   * @returns {Object} Sentiment analysis results
   */
  analyzeSentiment(text) {
    try {
      const analyzer = new natural.SentimentAnalyzer('English', 
        natural.PorterStemmer, ['negation']);
      
      const tokens = this.tokenizer.tokenize(text.toLowerCase());
      const score = analyzer.getSentiment(tokens);
      
      let sentiment = 'neutral';
      if (score > 0.1) sentiment = 'positive';
      else if (score < -0.1) sentiment = 'negative';
      
      return {
        score,
        sentiment
      };
    } catch (error) {
      logger.error('Error analyzing sentiment:', error);
      return { score: 0, sentiment: 'neutral' };
    }
  }

  /**
   * Find similar content using TF-IDF
   * @param {string} contentId - Content ID to find similar content for
   * @param {Array} allContent - Array of all content documents
   * @param {number} limit - Maximum number of similar items to return
   * @returns {Array} Array of similar content
   */
  findSimilarContent(contentId, allContent, limit = 5) {
    try {
      // Build TF-IDF corpus
      this.tfidf = new natural.TfIdf();
      
      allContent.forEach(content => {
        const text = `${content.title} ${content.summary} ${content.keyInsights?.join(' ') || ''}`;
        this.tfidf.addDocument(text);
      });

      // Find the target content
      const targetIndex = allContent.findIndex(content => 
        content._id.toString() === contentId
      );
      
      if (targetIndex === -1) return [];

      // Calculate similarities
      const similarities = [];
      
      for (let i = 0; i < allContent.length; i++) {
        if (i !== targetIndex) {
          const similarity = this.calculateCosineSimilarity(targetIndex, i);
          if (similarity > 0.1) { // Minimum similarity threshold
            similarities.push({
              content: allContent[i],
              similarity
            });
          }
        }
      }

      // Sort by similarity and return top results
      return similarities
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit)
        .map(item => item.content);

    } catch (error) {
      logger.error('Error finding similar content:', error);
      return [];
    }
  }

  /**
   * Calculate cosine similarity between two documents
   * @param {number} docIndex1 - Index of first document
   * @param {number} docIndex2 - Index of second document
   * @returns {number} Cosine similarity score
   */
  calculateCosineSimilarity(docIndex1, docIndex2) {
    const terms1 = this.tfidf.listTerms(docIndex1);
    const terms2 = this.tfidf.listTerms(docIndex2);
    
    const termSet = new Set([
      ...terms1.map(t => t.term),
      ...terms2.map(t => t.term)
    ]);
    
    const vector1 = [];
    const vector2 = [];
    
    termSet.forEach(term => {
      vector1.push(this.tfidf.tfidf(term, docIndex1));
      vector2.push(this.tfidf.tfidf(term, docIndex2));
    });
    
    return natural.distance.cosine(vector1, vector2);
  }

  /**
   * Check if Elasticsearch is available
   * @returns {boolean} True if connected to Elasticsearch
   */
  isElasticsearchAvailable() {
    return this.isConnected;
  }
}

// Export singleton instance
module.exports = new SearchEngine();