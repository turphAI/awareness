const natural = require('natural');
const compromise = require('compromise');

class NewsArticleAnalyzer {
  constructor() {
    this.factIndicators = [
      'according to', 'data shows', 'statistics indicate', 'research reveals',
      'study found', 'report states', 'survey shows', 'analysis indicates',
      'evidence suggests', 'findings show', 'documented', 'verified',
      'confirmed', 'measured', 'recorded', 'observed', 'published',
      'official', 'government', 'agency', 'department', 'institution'
    ];

    this.opinionIndicators = [
      'i believe', 'i think', 'in my opinion', 'it seems', 'appears to be',
      'likely', 'probably', 'possibly', 'might', 'could', 'should',
      'would', 'may', 'perhaps', 'arguably', 'presumably', 'allegedly',
      'supposedly', 'reportedly', 'critics say', 'supporters claim',
      'experts believe', 'analysts suggest', 'observers note'
    ];

    this.credibilityFactors = {
      sourceTypes: {
        'government': 0.9,
        'academic': 0.85,
        'established_media': 0.8,
        'news_agency': 0.75,
        'independent_media': 0.6,
        'blog': 0.4,
        'social_media': 0.2,
        'unknown': 0.3
      },
      indicators: {
        citations: 0.2,
        quotes: 0.15,
        data_references: 0.2,
        byline: 0.1,
        publication_date: 0.1,
        fact_ratio: 0.25
      }
    };

    this.biasIndicators = {
      emotional: [
        'outrageous', 'shocking', 'devastating', 'incredible', 'amazing',
        'terrible', 'wonderful', 'horrible', 'fantastic', 'awful',
        'unbelievable', 'stunning', 'alarming', 'disturbing'
      ],
      loaded: [
        'slammed', 'blasted', 'destroyed', 'crushed', 'demolished',
        'annihilated', 'eviscerated', 'obliterated', 'skyrocketed',
        'plummeted', 'soared', 'crashed'
      ]
    };
  }

  /**
   * Analyze news article for fact vs opinion classification and credibility
   */
  async analyzeNewsArticle(text, options = {}) {
    try {
      // Validate input
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        throw new Error('Text content is required and must be a non-empty string');
      }

      const {
        includeSourceCredibility = true,
        includeBiasDetection = true,
        includeFactOpinionRatio = true,
        sourceUrl = null,
        sourceType = 'unknown'
      } = options;

      // Basic text analysis
      const doc = compromise(text);
      const sentences = doc.sentences().out('array');
      const wordCount = doc.terms().length;

      // Analyze each sentence for fact vs opinion
      const sentenceAnalysis = sentences.map(sentence => 
        this.analyzeSentence(sentence)
      );

      // Calculate overall fact/opinion ratio
      const factSentences = sentenceAnalysis.filter(s => s.type === 'fact').length;
      const opinionSentences = sentenceAnalysis.filter(s => s.type === 'opinion').length;
      const neutralSentences = sentenceAnalysis.filter(s => s.type === 'neutral').length;

      const factOpinionRatio = {
        facts: factSentences,
        opinions: opinionSentences,
        neutral: neutralSentences,
        total: sentences.length,
        factPercentage: sentences.length > 0 ? (factSentences / sentences.length) * 100 : 0,
        opinionPercentage: sentences.length > 0 ? (opinionSentences / sentences.length) * 100 : 0,
        neutralPercentage: sentences.length > 0 ? (neutralSentences / sentences.length) * 100 : 0
      };

      let result = {
        isNewsArticle: this.detectNewsArticle(text),
        wordCount,
        sentenceCount: sentences.length,
        factOpinionAnalysis: {
          ratio: factOpinionRatio,
          sentences: includeFactOpinionRatio ? sentenceAnalysis : undefined
        }
      };

      // Add source credibility assessment if requested
      if (includeSourceCredibility) {
        result.credibilityAssessment = this.assessSourceCredibility(
          text, 
          sourceUrl, 
          sourceType, 
          factOpinionRatio
        );
      }

      // Add bias detection if requested
      if (includeBiasDetection) {
        result.biasAnalysis = this.detectBias(text);
      }

      // Add content quality indicators
      result.qualityIndicators = this.assessContentQuality(text, sentenceAnalysis);

      return result;

    } catch (error) {
      console.error('Error analyzing news article:', error);
      throw new Error(`News analysis failed: ${error.message}`);
    }
  }

  /**
   * Analyze individual sentence for fact vs opinion classification
   */
  analyzeSentence(sentence) {
    const lowerSentence = sentence.toLowerCase();
    
    // Count fact indicators
    const factScore = this.factIndicators.reduce((score, indicator) => {
      return score + (lowerSentence.includes(indicator) ? 1 : 0);
    }, 0);

    // Count opinion indicators
    const opinionScore = this.opinionIndicators.reduce((score, indicator) => {
      return score + (lowerSentence.includes(indicator) ? 1 : 0);
    }, 0);

    // Check for quotes (often factual reporting)
    const hasQuotes = /["'].*["']/.test(sentence);
    const hasNumbers = /\d+/.test(sentence);
    const hasPercentages = /%|\bpercent\b/.test(sentence);

    // Adjust scores based on additional indicators
    let adjustedFactScore = factScore;
    let adjustedOpinionScore = opinionScore;

    if (hasQuotes) adjustedFactScore += 0.5;
    if (hasNumbers || hasPercentages) adjustedFactScore += 0.3;

    // Check for subjective language
    const doc = compromise(sentence);
    const adjectives = doc.adjectives().out('array');
    const subjectiveAdjectives = adjectives.filter(adj => 
      this.biasIndicators.emotional.includes(adj.toLowerCase()) ||
      this.biasIndicators.loaded.includes(adj.toLowerCase())
    );

    if (subjectiveAdjectives.length > 0) {
      adjustedOpinionScore += subjectiveAdjectives.length * 0.3;
    }

    // Determine classification
    let type = 'neutral';
    let confidence = 0.5;

    if (adjustedFactScore > adjustedOpinionScore && adjustedFactScore > 0) {
      type = 'fact';
      confidence = Math.min(0.9, 0.5 + (adjustedFactScore * 0.1));
    } else if (adjustedOpinionScore > adjustedFactScore && adjustedOpinionScore > 0) {
      type = 'opinion';
      confidence = Math.min(0.9, 0.5 + (adjustedOpinionScore * 0.1));
    }

    return {
      sentence: sentence.substring(0, 100) + (sentence.length > 100 ? '...' : ''),
      type,
      confidence,
      indicators: {
        factScore: adjustedFactScore,
        opinionScore: adjustedOpinionScore,
        hasQuotes,
        hasNumbers,
        hasPercentages,
        subjectiveLanguage: subjectiveAdjectives.length
      }
    };
  }

  /**
   * Detect if content is likely a news article
   */
  detectNewsArticle(text) {
    if (!text || typeof text !== 'string') {
      return {
        isNews: false,
        confidence: 0,
        indicators: {
          newsPatterns: 0,
          hasDateline: false,
          hasQuotes: false,
          wordCount: 0
        }
      };
    }

    const newsIndicators = [
      /\b(reuters|ap|associated press|bloomberg|cnn|bbc|npr)\b/i,
      /\b(reported|breaking|developing|update|latest)\b/i,
      /\b(according to|sources say|officials said)\b/i,
      /\b(yesterday|today|this morning|last night)\b/i,
      /\b(press release|statement|announcement)\b/i
    ];

    const doc = compromise(text);
    const hasDateline = /^[A-Z\s]+,\s+[A-Za-z]+\s+\d+/.test(text.trim());
    const hasQuotes = (text.match(/["'].*?["']/g) || []).length >= 1;
    
    const indicatorCount = newsIndicators.reduce((count, pattern) => {
      return count + (pattern.test(text) ? 1 : 0);
    }, 0);

    const confidence = Math.min(0.9, 
      (indicatorCount * 0.2) + 
      (hasDateline ? 0.2 : 0) + 
      (hasQuotes ? 0.1 : 0)
    );

    return {
      isNews: confidence > 0.4,
      confidence,
      indicators: {
        newsPatterns: indicatorCount,
        hasDateline,
        hasQuotes,
        wordCount: doc.terms().length
      }
    };
  }

  /**
   * Assess source credibility based on various factors
   */
  assessSourceCredibility(text, sourceUrl, sourceType, factOpinionRatio) {
    let credibilityScore = this.credibilityFactors.sourceTypes[sourceType] || 0.3;

    // Adjust based on content quality
    const factRatio = isNaN(factOpinionRatio.factPercentage) ? 0 : factOpinionRatio.factPercentage / 100;
    credibilityScore += this.credibilityFactors.indicators.fact_ratio * factRatio;

    // Check for citations and references
    const citationCount = (text.match(/\bhttps?:\/\/\S+/g) || []).length;
    const quoteCount = (text.match(/["'].*?["']/g) || []).length;
    
    if (citationCount > 0) {
      credibilityScore += this.credibilityFactors.indicators.citations * 
        Math.min(1, citationCount / 5);
    }

    if (quoteCount > 0) {
      credibilityScore += this.credibilityFactors.indicators.quotes * 
        Math.min(1, quoteCount / 10);
    }

    // Check for byline and publication info
    const hasByline = /\bby\s+[\w\s]+/i.test(text.substring(0, 500));
    if (hasByline) {
      credibilityScore += this.credibilityFactors.indicators.byline;
    }

    // Check for data references
    const dataReferences = (text.match(/\b(study|research|data|statistics|survey|report)\b/gi) || []).length;
    if (dataReferences > 0) {
      credibilityScore += this.credibilityFactors.indicators.data_references * 
        Math.min(1, dataReferences / 10);
    }

    // Normalize score
    credibilityScore = Math.min(1, Math.max(0, credibilityScore));

    return {
      score: credibilityScore,
      level: this.getCredibilityLevel(credibilityScore),
      factors: {
        sourceType,
        factRatio: isNaN(factRatio) ? '0.00' : factRatio.toFixed(2),
        citations: citationCount,
        quotes: quoteCount,
        hasByline,
        dataReferences
      }
    };
  }

  /**
   * Detect potential bias in the content
   */
  detectBias(text) {
    const lowerText = text.toLowerCase();
    
    // Count emotional language
    const emotionalWords = this.biasIndicators.emotional.filter(word => 
      lowerText.includes(word)
    );

    // Count loaded language
    const loadedWords = this.biasIndicators.loaded.filter(word => 
      lowerText.includes(word)
    );

    // Check for one-sided reporting
    const balanceIndicators = [
      'however', 'but', 'although', 'despite', 'on the other hand',
      'critics argue', 'supporters claim', 'both sides', 'alternative view'
    ];

    const balanceCount = balanceIndicators.reduce((count, indicator) => {
      return count + (lowerText.includes(indicator) ? 1 : 0);
    }, 0);

    const biasScore = (emotionalWords.length + loadedWords.length) / 
      (text.split(' ').length / 100); // Per 100 words

    return {
      biasScore,
      level: this.getBiasLevel(biasScore),
      indicators: {
        emotionalLanguage: emotionalWords.length,
        loadedLanguage: loadedWords.length,
        balanceIndicators: balanceCount,
        emotionalWords: emotionalWords.slice(0, 5), // First 5 examples
        loadedWords: loadedWords.slice(0, 5) // First 5 examples
      }
    };
  }

  /**
   * Assess overall content quality
   */
  assessContentQuality(text, sentenceAnalysis) {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return {
        score: 0,
        level: 'very-poor',
        metrics: {
          avgSentenceLength: 0,
          readabilityScore: 0,
          hasParagraphs: false,
          hasProperPunctuation: false,
          highConfidenceSentences: 0
        }
      };
    }

    const doc = compromise(text);
    const sentences = doc.sentences().out('array');
    
    if (sentences.length === 0) {
      return {
        score: 0,
        level: 'very-poor',
        metrics: {
          avgSentenceLength: 0,
          readabilityScore: 0,
          hasParagraphs: false,
          hasProperPunctuation: false,
          highConfidenceSentences: 0
        }
      };
    }
    
    // Calculate average sentence length
    const avgSentenceLength = sentences.reduce((sum, sentence) => 
      sum + sentence.split(' ').length, 0) / sentences.length;

    // Check for proper structure - look for multiple paragraphs with content
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    const hasParagraphs = paragraphs.length > 1;
    const hasProperPunctuation = /[.!?]$/.test(text.trim());

    // Calculate readability (simplified Flesch score approximation)
    const avgWordsPerSentence = doc.terms().length / sentences.length;
    const readabilityScore = isNaN(avgWordsPerSentence) ? 0 : 206.835 - (1.015 * avgWordsPerSentence);

    // Quality indicators
    const qualityScore = [
      avgSentenceLength > 10 && avgSentenceLength < 25 ? 0.2 : 0,
      hasParagraphs ? 0.2 : 0,
      hasProperPunctuation ? 0.1 : 0,
      readabilityScore > 60 ? 0.2 : readabilityScore > 30 ? 0.1 : 0,
      sentenceAnalysis.length > 0 ? (sentenceAnalysis.filter(s => s.confidence > 0.7).length / sentenceAnalysis.length * 0.3) : 0
    ].reduce((sum, score) => sum + score, 0);

    return {
      score: Math.min(1, qualityScore),
      level: this.getQualityLevel(qualityScore),
      metrics: {
        avgSentenceLength: isNaN(avgSentenceLength) ? 0 : Math.round(avgSentenceLength),
        readabilityScore: isNaN(readabilityScore) ? 0 : Math.round(readabilityScore),
        hasParagraphs,
        hasProperPunctuation,
        highConfidenceSentences: sentenceAnalysis.filter(s => s.confidence > 0.7).length
      }
    };
  }

  /**
   * Batch analyze multiple news articles
   */
  async batchAnalyze(texts, options = {}) {
    const results = [];

    for (let i = 0; i < texts.length; i++) {
      try {
        const result = await this.analyzeNewsArticle(texts[i], {
          ...options,
          sourceType: options.sourceTypes?.[i] || 'unknown'
        });
        results.push({
          index: i,
          ...result
        });
      } catch (error) {
        results.push({
          index: i,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Get credibility level description
   */
  getCredibilityLevel(score) {
    if (score >= 0.8) return 'high';
    if (score >= 0.6) return 'medium-high';
    if (score >= 0.4) return 'medium';
    if (score >= 0.2) return 'low-medium';
    return 'low';
  }

  /**
   * Get bias level description
   */
  getBiasLevel(score) {
    if (score >= 3) return 'high';
    if (score >= 2) return 'medium-high';
    if (score >= 1) return 'medium';
    if (score >= 0.5) return 'low-medium';
    return 'low';
  }

  /**
   * Get quality level description
   */
  getQualityLevel(score) {
    if (score >= 0.8) return 'excellent';
    if (score >= 0.6) return 'good';
    if (score >= 0.4) return 'fair';
    if (score >= 0.2) return 'poor';
    return 'very-poor';
  }
}

module.exports = NewsArticleAnalyzer;