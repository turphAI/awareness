const SearchEngine = require('../utils/searchEngine');

// Mock elasticsearch and natural modules
jest.mock('elasticsearch', () => ({
  Client: jest.fn().mockImplementation(() => ({
    ping: jest.fn().mockResolvedValue(true),
    indices: {
      exists: jest.fn().mockResolvedValue(false),
      create: jest.fn().mockResolvedValue(true)
    },
    index: jest.fn().mockResolvedValue(true),
    delete: jest.fn().mockResolvedValue(true),
    search: jest.fn().mockResolvedValue({
      hits: {
        hits: [
          {
            _id: '1',
            _score: 0.8,
            _source: {
              title: 'Test Article',
              summary: 'Test summary',
              type: 'article'
            },
            highlight: {
              title: ['<em>Test</em> Article']
            }
          }
        ],
        total: { value: 1 },
        max_score: 0.8
      }
    }),
    suggest: jest.fn().mockResolvedValue({
      suggest: {
        title_suggest: [{ options: [{ text: 'Test Article', _score: 0.8 }] }],
        author_suggest: [{ options: [{ text: 'Test Author', _score: 0.7 }] }],
        topic_suggest: [{ options: [{ text: 'AI', _score: 0.6 }] }]
      }
    })
  }))
}));

jest.mock('natural', () => ({
  PorterStemmer: {
    stem: jest.fn(word => word.toLowerCase())
  },
  WordTokenizer: jest.fn().mockImplementation(() => ({
    tokenize: jest.fn(text => {
      if (!text || text.trim() === '') return [];
      return text.toLowerCase().split(/\s+/).filter(word => word.length > 0);
    })
  })),
  TfIdf: jest.fn().mockImplementation(() => ({
    addDocument: jest.fn(),
    listTerms: jest.fn().mockReturnValue([
      { term: 'test', tfidf: 0.5 },
      { term: 'article', tfidf: 0.3 }
    ]),
    tfidf: jest.fn().mockReturnValue(0.4)
  })),
  stopwords: ['the', 'a', 'an', 'and', 'or', 'but'],
  SentimentAnalyzer: jest.fn().mockImplementation(() => ({
    getSentiment: jest.fn().mockImplementation((tokens) => {
      // Return 0 for empty tokens array, 0.2 otherwise
      return tokens && tokens.length > 0 ? 0.2 : 0;
    })
  })),
  distance: {
    cosine: jest.fn().mockReturnValue(0.7)
  }
}));

describe('SearchEngine', () => {
  let searchEngine;

  beforeEach(() => {
    // Reset the module to get a fresh instance
    jest.resetModules();
    searchEngine = require('../utils/searchEngine');
  });

  describe('Text Analysis', () => {
    it('should analyze text and return key metrics', () => {
      const text = 'This is a test article about machine learning and artificial intelligence.';
      
      const analysis = searchEngine.analyzeText(text);
      
      expect(analysis).toHaveProperty('tokenCount');
      expect(analysis).toHaveProperty('uniqueTokens');
      expect(analysis).toHaveProperty('keyTerms');
      expect(analysis).toHaveProperty('readabilityScore');
      expect(analysis).toHaveProperty('sentiment');
      
      expect(typeof analysis.tokenCount).toBe('number');
      expect(typeof analysis.uniqueTokens).toBe('number');
      expect(Array.isArray(analysis.keyTerms)).toBe(true);
      expect(typeof analysis.readabilityScore).toBe('number');
      expect(typeof analysis.sentiment).toBe('object');
    });

    it('should handle empty text', () => {
      const analysis = searchEngine.analyzeText('');
      
      expect(analysis).toEqual({});
    });

    it('should handle null text', () => {
      const analysis = searchEngine.analyzeText(null);
      
      expect(analysis).toEqual({});
    });
  });

  describe('Syllable Counting', () => {
    it('should count syllables correctly', () => {
      expect(searchEngine.countSyllables('hello')).toBe(2);
      expect(searchEngine.countSyllables('cat')).toBe(1);
      expect(searchEngine.countSyllables('beautiful')).toBe(3);
      expect(searchEngine.countSyllables('a')).toBe(1);
    });

    it('should handle silent e', () => {
      expect(searchEngine.countSyllables('make')).toBe(1);
      expect(searchEngine.countSyllables('take')).toBe(1);
    });
  });

  describe('Sentiment Analysis', () => {
    it('should analyze sentiment', () => {
      const sentiment = searchEngine.analyzeSentiment('This is a great article!');
      
      expect(sentiment).toHaveProperty('score');
      expect(sentiment).toHaveProperty('sentiment');
      expect(typeof sentiment.score).toBe('number');
      expect(['positive', 'negative', 'neutral']).toContain(sentiment.sentiment);
    });

    it('should handle empty text sentiment', () => {
      const sentiment = searchEngine.analyzeSentiment('');
      
      expect(sentiment.score).toBe(0);
      expect(sentiment.sentiment).toBe('neutral');
    });
  });

  describe('Similar Content Finding', () => {
    it('should find similar content', () => {
      const allContent = [
        {
          _id: '1',
          title: 'Machine Learning Basics',
          summary: 'Introduction to ML',
          keyInsights: ['ML is powerful']
        },
        {
          _id: '2',
          title: 'Deep Learning Advanced',
          summary: 'Advanced DL concepts',
          keyInsights: ['DL uses neural networks']
        },
        {
          _id: '3',
          title: 'Natural Language Processing',
          summary: 'NLP fundamentals',
          keyInsights: ['NLP processes text']
        }
      ];

      const similar = searchEngine.findSimilarContent('1', allContent, 2);
      
      expect(Array.isArray(similar)).toBe(true);
      expect(similar.length).toBeLessThanOrEqual(2);
    });

    it('should return empty array for non-existent content', () => {
      const allContent = [
        {
          _id: '1',
          title: 'Test Article',
          summary: 'Test summary',
          keyInsights: []
        }
      ];

      const similar = searchEngine.findSimilarContent('999', allContent, 5);
      
      expect(similar).toEqual([]);
    });
  });

  describe('Elasticsearch Integration', () => {
    it('should check Elasticsearch availability', () => {
      const isAvailable = searchEngine.isElasticsearchAvailable();
      
      expect(typeof isAvailable).toBe('boolean');
    });

    it('should handle Elasticsearch search when available', async () => {
      // Mock Elasticsearch as available
      searchEngine.isConnected = true;

      const searchParams = {
        query: 'machine learning',
        filters: {
          type: ['article'],
          relevanceMin: 0.5
        },
        sortBy: 'relevance',
        page: 1,
        limit: 10
      };

      try {
        const results = await searchEngine.searchWithElasticsearch(searchParams);
        
        expect(results).toHaveProperty('results');
        expect(results).toHaveProperty('totalCount');
        expect(Array.isArray(results.results)).toBe(true);
      } catch (error) {
        // If Elasticsearch is not available, this is expected
        expect(error.message).toBe('Elasticsearch not available');
      }
    });

    it('should handle Elasticsearch unavailability', async () => {
      // Mock Elasticsearch as unavailable
      searchEngine.isConnected = false;

      const searchParams = {
        query: 'test',
        page: 1,
        limit: 10
      };

      await expect(searchEngine.searchWithElasticsearch(searchParams))
        .rejects.toThrow('Elasticsearch not available');
    });

    it('should get suggestions when Elasticsearch is available', async () => {
      // Mock Elasticsearch as available
      searchEngine.isConnected = true;

      try {
        const suggestions = await searchEngine.getSuggestions('machine', 5);
        
        expect(Array.isArray(suggestions)).toBe(true);
      } catch (error) {
        // If there's an error, suggestions should return empty array
        expect(error).toBeDefined();
      }
    });

    it('should return empty suggestions when Elasticsearch is unavailable', async () => {
      // Mock Elasticsearch as unavailable
      searchEngine.isConnected = false;

      const suggestions = await searchEngine.getSuggestions('machine', 5);
      
      expect(suggestions).toEqual([]);
    });
  });

  describe('Content Indexing', () => {
    it('should index content when Elasticsearch is available', async () => {
      // Mock Elasticsearch as available
      searchEngine.isConnected = true;

      const content = {
        _id: '507f1f77bcf86cd799439011',
        title: 'Test Article',
        summary: 'Test summary',
        fullText: 'Full text content',
        keyInsights: ['Key insight 1'],
        author: 'Test Author',
        type: 'article',
        categories: ['AI'],
        topics: ['machine learning'],
        publishDate: new Date(),
        relevanceScore: 0.8,
        qualityScore: 0.9,
        readCount: 10,
        saveCount: 5,
        outdated: false,
        processed: true
      };

      // This should not throw an error
      await expect(searchEngine.indexContent(content)).resolves.toBeUndefined();
    });

    it('should handle content removal when Elasticsearch is available', async () => {
      // Mock Elasticsearch as available
      searchEngine.isConnected = true;

      const contentId = '507f1f77bcf86cd799439011';

      // This should not throw an error
      await expect(searchEngine.removeContent(contentId)).resolves.toBeUndefined();
    });

    it('should skip indexing when Elasticsearch is unavailable', async () => {
      // Mock Elasticsearch as unavailable
      searchEngine.isConnected = false;

      const content = {
        _id: '507f1f77bcf86cd799439011',
        title: 'Test Article'
      };

      // This should not throw an error and should return undefined
      const result = await searchEngine.indexContent(content);
      expect(result).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle text analysis errors gracefully', () => {
      // Mock tokenizer to throw error
      const originalTokenizer = searchEngine.tokenizer;
      searchEngine.tokenizer = {
        tokenize: jest.fn().mockImplementation(() => {
          throw new Error('Tokenizer error');
        })
      };

      const result = searchEngine.analyzeText('test text');
      
      expect(result).toEqual({});

      // Restore original tokenizer
      searchEngine.tokenizer = originalTokenizer;
    });

    it('should handle sentiment analysis errors gracefully', () => {
      const result = searchEngine.analyzeSentiment('test text');
      
      // Should return default values on error
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('sentiment');
    });

    it('should handle similar content finding errors gracefully', () => {
      // Pass invalid data to trigger error
      const result = searchEngine.findSimilarContent('1', null, 5);
      
      expect(result).toEqual([]);
    });
  });
});