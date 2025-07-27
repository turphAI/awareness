const natural = require('natural');
const compromise = require('compromise');

class ContentCategorizer {
  constructor() {
    this.stemmer = natural.PorterStemmer;
    this.tfidf = new natural.TfIdf();
    
    // Predefined AI/LLM topic categories
    this.categories = {
      'machine-learning': {
        keywords: ['machine learning', 'ml', 'neural network', 'deep learning', 'training', 'model', 'algorithm', 'supervised', 'unsupervised', 'reinforcement'],
        weight: 1.0
      },
      'large-language-models': {
        keywords: ['llm', 'large language model', 'gpt', 'bert', 'transformer', 'attention', 'language model', 'generative', 'chatgpt', 'claude'],
        weight: 1.2
      },
      'natural-language-processing': {
        keywords: ['nlp', 'natural language processing', 'text processing', 'tokenization', 'sentiment analysis', 'named entity', 'parsing'],
        weight: 1.0
      },
      'computer-vision': {
        keywords: ['computer vision', 'image recognition', 'object detection', 'cnn', 'convolutional', 'image processing', 'visual'],
        weight: 0.8
      },
      'ai-ethics': {
        keywords: ['ai ethics', 'bias', 'fairness', 'responsible ai', 'explainable ai', 'transparency', 'accountability', 'safety'],
        weight: 1.1
      },
      'ai-applications': {
        keywords: ['ai application', 'use case', 'implementation', 'deployment', 'production', 'real world', 'industry'],
        weight: 0.9
      },
      'research': {
        keywords: ['research', 'paper', 'study', 'experiment', 'findings', 'methodology', 'results', 'analysis', 'academic'],
        weight: 1.0
      },
      'tools-frameworks': {
        keywords: ['framework', 'library', 'tool', 'api', 'sdk', 'platform', 'tensorflow', 'pytorch', 'hugging face'],
        weight: 0.9
      },
      'business-strategy': {
        keywords: ['business', 'strategy', 'market', 'investment', 'startup', 'company', 'revenue', 'growth', 'adoption'],
        weight: 0.8
      },
      'regulation-policy': {
        keywords: ['regulation', 'policy', 'law', 'governance', 'compliance', 'legal', 'government', 'legislation'],
        weight: 0.9
      }
    };

    // Initialize TF-IDF with category keywords
    this.initializeTfIdf();
  }

  /**
   * Initialize TF-IDF with category keywords
   */
  initializeTfIdf() {
    Object.entries(this.categories).forEach(([category, data]) => {
      const document = data.keywords.join(' ');
      this.tfidf.addDocument(document);
    });
  }

  /**
   * Categorize content using multiple approaches
   * @param {string} text - Text content to categorize
   * @param {Object} options - Categorization options
   * @returns {Object} Categorization results
   */
  async categorizeContent(text, options = {}) {
    try {
      const {
        threshold = 0.1,
        maxCategories = 5,
        includeScores = true,
        useNLP = true
      } = options;

      if (!text || typeof text !== 'string') {
        throw new Error('Valid text content is required');
      }

      const preprocessedText = this.preprocessText(text);
      
      // Multiple categorization approaches
      const keywordScores = this.categorizeByKeywords(preprocessedText);
      const tfidfScores = this.categorizeByTfIdf(preprocessedText);
      const nlpScores = useNLP ? this.categorizeByNLP(text) : {};

      // Combine scores with weights
      const combinedScores = this.combineScores(keywordScores, tfidfScores, nlpScores);

      // Filter and sort results
      const filteredCategories = Object.entries(combinedScores)
        .filter(([_, score]) => score >= threshold)
        .sort(([, a], [, b]) => b - a)
        .slice(0, maxCategories);

      const result = {
        categories: filteredCategories.map(([category, score]) => ({
          category,
          score: includeScores ? parseFloat(score.toFixed(3)) : undefined,
          confidence: this.getConfidenceLevel(score)
        })),
        primaryCategory: filteredCategories.length > 0 ? filteredCategories[0][0] : null,
        metadata: {
          textLength: text.length,
          processedTokens: preprocessedText.split(' ').length,
          threshold,
          maxCategories
        }
      };

      return result;

    } catch (error) {
      throw new Error(`Categorization failed: ${error.message}`);
    }
  }

  /**
   * Batch categorize multiple texts
   * @param {Array} texts - Array of text contents
   * @param {Object} options - Categorization options
   * @returns {Array} Array of categorization results
   */
  async batchCategorize(texts, options = {}) {
    if (!Array.isArray(texts)) {
      throw new Error('Texts must be an array');
    }

    const results = [];
    
    for (let i = 0; i < texts.length; i++) {
      try {
        const result = await this.categorizeContent(texts[i], options);
        results.push({
          index: i,
          ...result
        });
      } catch (error) {
        results.push({
          index: i,
          error: error.message,
          categories: [],
          primaryCategory: null
        });
      }
    }

    return results;
  }

  /**
   * Preprocess text for categorization
   * @param {string} text - Raw text
   * @returns {string} Preprocessed text
   */
  preprocessText(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Categorize using keyword matching
   * @param {string} text - Preprocessed text
   * @returns {Object} Category scores
   */
  categorizeByKeywords(text) {
    const scores = {};
    const words = text.split(' ');
    const wordCount = words.length;

    Object.entries(this.categories).forEach(([category, data]) => {
      let matches = 0;
      let totalWeight = 0;

      data.keywords.forEach(keyword => {
        const keywordWords = keyword.split(' ');
        
        if (keywordWords.length === 1) {
          // Single word keyword
          const count = words.filter(word => 
            word === keyword || this.stemmer.stem(word) === this.stemmer.stem(keyword)
          ).length;
          matches += count;
          totalWeight += count * data.weight;
        } else {
          // Multi-word keyword (phrase)
          const regex = new RegExp(keyword.replace(/\s+/g, '\\s+'), 'gi');
          const phraseMatches = (text.match(regex) || []).length;
          matches += phraseMatches * keywordWords.length;
          totalWeight += phraseMatches * keywordWords.length * data.weight;
        }
      });

      scores[category] = wordCount > 0 ? totalWeight / wordCount : 0;
    });

    return scores;
  }

  /**
   * Categorize using TF-IDF similarity
   * @param {string} text - Preprocessed text
   * @returns {Object} Category scores
   */
  categorizeByTfIdf(text) {
    const scores = {};
    const categoryNames = Object.keys(this.categories);

    // Add the text as a document to calculate TF-IDF
    this.tfidf.addDocument(text);
    const textIndex = this.tfidf.documents.length - 1;

    categoryNames.forEach((category, index) => {
      const similarity = this.calculateCosineSimilarity(textIndex, index);
      scores[category] = similarity * this.categories[category].weight;
    });

    // Remove the temporary document
    this.tfidf.documents.pop();

    return scores;
  }

  /**
   * Categorize using NLP analysis
   * @param {string} text - Original text
   * @returns {Object} Category scores
   */
  categorizeByNLP(text) {
    const scores = {};
    const doc = compromise(text);

    // Extract entities and topics
    const entities = doc.topics().out('array');
    const nouns = doc.nouns().out('array');
    const adjectives = doc.adjectives().out('array');

    // Analyze entities for AI/ML relevance
    const aiTerms = [...entities, ...nouns, ...adjectives]
      .map(term => term.toLowerCase())
      .filter(term => term.length > 2);

    Object.entries(this.categories).forEach(([category, data]) => {
      let relevanceScore = 0;
      
      aiTerms.forEach(term => {
        data.keywords.forEach(keyword => {
          if (term.includes(keyword) || keyword.includes(term)) {
            relevanceScore += 0.1 * data.weight;
          }
        });
      });

      scores[category] = Math.min(relevanceScore, 1.0);
    });

    return scores;
  }

  /**
   * Combine scores from different approaches
   * @param {Object} keywordScores - Keyword-based scores
   * @param {Object} tfidfScores - TF-IDF based scores
   * @param {Object} nlpScores - NLP-based scores
   * @returns {Object} Combined scores
   */
  combineScores(keywordScores, tfidfScores, nlpScores) {
    const combined = {};
    const categories = Object.keys(this.categories);

    categories.forEach(category => {
      const keywordScore = keywordScores[category] || 0;
      const tfidfScore = tfidfScores[category] || 0;
      const nlpScore = nlpScores[category] || 0;

      // Weighted combination
      combined[category] = (
        keywordScore * 0.5 +
        tfidfScore * 0.3 +
        nlpScore * 0.2
      );
    });

    return combined;
  }

  /**
   * Calculate cosine similarity between two documents
   * @param {number} docIndex1 - First document index
   * @param {number} docIndex2 - Second document index
   * @returns {number} Cosine similarity score
   */
  calculateCosineSimilarity(docIndex1, docIndex2) {
    const terms1 = this.tfidf.listTerms(docIndex1);
    const terms2 = this.tfidf.listTerms(docIndex2);

    if (terms1.length === 0 || terms2.length === 0) {
      return 0;
    }

    const vector1 = {};
    const vector2 = {};

    terms1.forEach(term => {
      vector1[term.term] = term.tfidf;
    });

    terms2.forEach(term => {
      vector2[term.term] = term.tfidf;
    });

    const allTerms = new Set([...Object.keys(vector1), ...Object.keys(vector2)]);
    
    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;

    allTerms.forEach(term => {
      const val1 = vector1[term] || 0;
      const val2 = vector2[term] || 0;
      
      dotProduct += val1 * val2;
      magnitude1 += val1 * val1;
      magnitude2 += val2 * val2;
    });

    if (magnitude1 === 0 || magnitude2 === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(magnitude1) * Math.sqrt(magnitude2));
  }

  /**
   * Get confidence level based on score
   * @param {number} score - Category score
   * @returns {string} Confidence level
   */
  getConfidenceLevel(score) {
    if (score >= 0.7) return 'high';
    if (score >= 0.4) return 'medium';
    if (score >= 0.1) return 'low';
    return 'very-low';
  }

  /**
   * Get available categories
   * @returns {Object} Available categories with descriptions
   */
  getCategories() {
    const result = {};
    
    Object.entries(this.categories).forEach(([category, data]) => {
      result[category] = {
        name: category.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        keywords: data.keywords,
        weight: data.weight
      };
    });

    return result;
  }

  /**
   * Add custom category
   * @param {string} categoryName - Name of the category
   * @param {Array} keywords - Keywords for the category
   * @param {number} weight - Weight for the category
   */
  addCategory(categoryName, keywords, weight = 1.0) {
    if (!categoryName || !Array.isArray(keywords) || keywords.length === 0) {
      throw new Error('Valid category name and keywords array are required');
    }

    this.categories[categoryName] = {
      keywords: keywords.map(k => k.toLowerCase()),
      weight
    };

    // Reinitialize TF-IDF with new category
    this.tfidf = new natural.TfIdf();
    this.initializeTfIdf();
  }

  /**
   * Remove category
   * @param {string} categoryName - Name of the category to remove
   */
  removeCategory(categoryName) {
    if (this.categories[categoryName]) {
      delete this.categories[categoryName];
      
      // Reinitialize TF-IDF without removed category
      this.tfidf = new natural.TfIdf();
      this.initializeTfIdf();
    }
  }
}

module.exports = ContentCategorizer;