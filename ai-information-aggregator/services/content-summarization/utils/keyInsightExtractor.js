const natural = require('natural');
const compromise = require('compromise');
const Anthropic = require('@anthropic-ai/sdk');

class KeyInsightExtractor {
  constructor() {
    // Only initialize Anthropic client if API key is available
    if (process.env.ANTHROPIC_API_KEY) {
      this.anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
    } else {
      this.anthropic = null;
    }
    this.tokenizer = new natural.WordTokenizer();
    this.stemmer = natural.PorterStemmer;
    this.tfidf = new natural.TfIdf();
  }

  /**
   * Extract key insights from text content
   * @param {string} text - The text to extract insights from
   * @param {Object} options - Configuration options
   * @returns {Promise<Object>} Insights extraction result
   */
  async extractInsights(text, options = {}) {
    try {
      const {
        maxInsights = 5,
        minConfidence = 0.6,
        includeContext = true,
        contentType = 'general'
      } = options;

      // Validate input
      if (!text || typeof text !== 'string') {
        throw new Error('Invalid text input');
      }

      const cleanedText = this._preprocessText(text);
      
      // Check if text is too short for meaningful insights
      if (this._getWordCount(cleanedText) < 10) {
        return {
          insights: [],
          totalFound: 0,
          confidence: 0,
          method: 'insufficient_content'
        };
      }

      // Extract insights using multiple approaches
      const aiInsights = await this._extractAIInsights(cleanedText, options);
      const statisticalInsights = this._extractStatisticalInsights(cleanedText, options);
      const patternInsights = this._extractPatternInsights(cleanedText, options);

      // Combine and rank insights
      const combinedInsights = this._combineInsights([
        ...(aiInsights || []),
        ...statisticalInsights,
        ...patternInsights
      ]);

      // Filter and rank insights
      const rankedInsights = this._rankInsights(combinedInsights, text);
      const filteredInsights = this._filterInsights(rankedInsights, {
        maxInsights,
        minConfidence
      });

      return {
        insights: filteredInsights,
        totalFound: combinedInsights.length,
        confidence: this._calculateOverallConfidence(filteredInsights),
        method: aiInsights ? 'hybrid_ai_statistical' : 'statistical_pattern',
        metadata: {
          contentLength: this._getWordCount(text),
          processingTime: Date.now()
        }
      };

    } catch (error) {
      console.error('Error in insight extraction:', error);
      throw new Error(`Insight extraction failed: ${error.message}`);
    }
  }

  /**
   * Extract insights using AI-based approach
   * @private
   */
  async _extractAIInsights(text, options) {
    try {
      if (!this.anthropic) {
        console.warn('Anthropic API key not configured, skipping AI insight extraction');
        return null;
      }

      const prompt = this._buildInsightPrompt(text, options);
      
      const response = await this.anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 500,
        temperature: 0.2,
        system: 'You are an expert at identifying key insights and important points from text content. Focus on actionable insights, important facts, and significant conclusions.',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const aiResponse = response.content[0]?.text?.trim();
      return this._parseAIInsights(aiResponse);

    } catch (error) {
      console.error('AI insight extraction failed:', error);
      return null;
    }
  }

  /**
   * Build insight extraction prompt
   * @private
   */
  _buildInsightPrompt(text, options) {
    const contentTypeInstructions = {
      academic: 'Focus on research findings, methodologies, and conclusions.',
      news: 'Focus on key facts, implications, and important developments.',
      technical: 'Focus on technical details, specifications, and implementation insights.',
      general: 'Focus on main points, important facts, and actionable insights.'
    };

    return `Extract the most important insights from the following text. ${contentTypeInstructions[options.contentType] || contentTypeInstructions.general}

Format your response as a JSON array of objects, each with:
- "text": the insight text
- "type": one of "fact", "conclusion", "implication", "recommendation"
- "confidence": a number between 0 and 1
- "context": brief context or supporting information

Text to analyze:
${text}

Insights:`;
  }

  /**
   * Parse AI response into structured insights
   * @private
   */
  _parseAIInsights(aiResponse) {
    try {
      // Try to parse as JSON first
      const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const insights = JSON.parse(jsonMatch[0]);
        return insights.map(insight => ({
          ...insight,
          source: 'ai',
          confidence: Math.min(Math.max(insight.confidence || 0.7, 0), 1)
        }));
      }

      // Fallback: parse line by line
      const lines = aiResponse.split('\n').filter(line => line.trim());
      return lines.map((line, index) => ({
        text: line.replace(/^[-*•]\s*/, '').trim(),
        type: 'fact',
        confidence: 0.7,
        source: 'ai',
        context: `AI-extracted insight ${index + 1}`
      }));

    } catch (error) {
      console.error('Failed to parse AI insights:', error);
      return [];
    }
  }

  /**
   * Extract insights using statistical analysis
   * @private
   */
  _extractStatisticalInsights(text, options) {
    const insights = [];
    
    try {
      // Create a fresh TF-IDF instance for this analysis
      const tfidf = new natural.TfIdf();
      tfidf.addDocument(text);
      
      // Extract sentences and analyze them
      const sentences = this._extractSentences(text);
      const scoredSentences = this._scoreSentencesForInsights(sentences, text);
      
      // Select top sentences as insights
      const topSentences = scoredSentences
        .sort((a, b) => b.insightScore - a.insightScore)
        .slice(0, Math.min(8, sentences.length));

      topSentences.forEach(sentence => {
        if (sentence.insightScore >= 0.19) { // Lower threshold for better results
          insights.push({
            text: sentence.text,
            type: this._classifyInsightType(sentence.text),
            confidence: Math.min(sentence.insightScore, 0.9),
            source: 'statistical',
            context: `Statistical analysis (score: ${sentence.insightScore.toFixed(2)})`
          });
        }
      });

    } catch (error) {
      console.error('Statistical insight extraction failed:', error);
    }

    return insights;
  }

  /**
   * Extract insights using pattern recognition
   * @private
   */
  _extractPatternInsights(text, options) {
    const insights = [];
    
    try {
      // Look for numerical patterns (statistics, percentages, etc.)
      const numericalInsights = this._extractNumericalInsights(text);
      insights.push(...numericalInsights);

      // Look for causal relationships
      const causalInsights = this._extractCausalInsights(text);
      insights.push(...causalInsights);

      // Look for comparative statements
      const comparativeInsights = this._extractComparativeInsights(text);
      insights.push(...comparativeInsights);

      // Look for temporal patterns
      const temporalInsights = this._extractTemporalInsights(text);
      insights.push(...temporalInsights);

    } catch (error) {
      console.error('Pattern insight extraction failed:', error);
    }

    return insights;
  }

  /**
   * Extract numerical insights (statistics, percentages, etc.)
   * @private
   */
  _extractNumericalInsights(text) {
    const insights = [];
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
    
    sentences.forEach(sentence => {
      const trimmedSentence = sentence.trim();
      if (trimmedSentence.length === 0) return;
      
      // Look for percentages
      const percentageMatch = trimmedSentence.match(/(\d+(?:\.\d+)?)\s*%/g);
      if (percentageMatch) {
        insights.push({
          text: trimmedSentence,
          type: 'fact',
          confidence: 0.8,
          source: 'pattern',
          context: 'Contains statistical data (percentage)'
        });
        return; // Don't double-count this sentence
      }

      // Look for large numbers or measurements
      const numberMatch = trimmedSentence.match(/(\d{1,3}(?:,\d{3})*|\d+(?:\.\d+)?)\s*(million|billion|thousand|times|fold)/i);
      if (numberMatch) {
        insights.push({
          text: trimmedSentence,
          type: 'fact',
          confidence: 0.7,
          source: 'pattern',
          context: 'Contains quantitative information'
        });
        return;
      }

      // Look for any significant numbers
      const anyNumberMatch = trimmedSentence.match(/\b\d+(?:\.\d+)?\b/g);
      if (anyNumberMatch && anyNumberMatch.length > 0) {
        // Only include if the sentence seems meaningful
        const meaningfulWords = ['accuracy', 'performance', 'improvement', 'increase', 'decrease', 'result', 'study', 'research'];
        const hasMeaningfulContext = meaningfulWords.some(word => 
          trimmedSentence.toLowerCase().includes(word)
        );
        
        if (hasMeaningfulContext) {
          insights.push({
            text: trimmedSentence,
            type: 'fact',
            confidence: 0.6,
            source: 'pattern',
            context: 'Contains numerical data'
          });
        }
      }
    });

    return insights;
  }

  /**
   * Extract causal relationship insights
   * @private
   */
  _extractCausalInsights(text) {
    const insights = [];
    const causalPatterns = [
      /because\s+of/i,
      /due\s+to/i,
      /as\s+a\s+result/i,
      /leads\s+to/i,
      /causes?/i,
      /therefore/i,
      /consequently/i,
      /results?\s+in/i,
      /shows?\s+that/i,
      /indicates?\s+that/i,
      /suggests?\s+that/i
    ];

    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 15);
    
    sentences.forEach(sentence => {
      const trimmedSentence = sentence.trim();
      if (trimmedSentence.length === 0) return;
      
      const hasCausalPattern = causalPatterns.some(pattern => pattern.test(trimmedSentence));
      if (hasCausalPattern) {
        insights.push({
          text: trimmedSentence,
          type: 'implication',
          confidence: 0.6,
          source: 'pattern',
          context: 'Contains causal relationship'
        });
      }
    });

    return insights;
  }

  /**
   * Extract comparative insights
   * @private
   */
  _extractComparativeInsights(text) {
    const insights = [];
    const comparativePatterns = [
      /better\s+than/i,
      /worse\s+than/i,
      /compared\s+to/i,
      /versus/i,
      /vs\.?/i,
      /more\s+\w+\s+than/i,
      /less\s+\w+\s+than/i
    ];

    const sentences = text.split(/[.!?]+/);
    
    sentences.forEach(sentence => {
      const hasComparativePattern = comparativePatterns.some(pattern => pattern.test(sentence));
      if (hasComparativePattern && sentence.trim().length > 20) {
        insights.push({
          text: sentence.trim(),
          type: 'conclusion',
          confidence: 0.65,
          source: 'pattern',
          context: 'Contains comparative analysis'
        });
      }
    });

    return insights;
  }

  /**
   * Extract temporal insights
   * @private
   */
  _extractTemporalInsights(text) {
    const insights = [];
    const temporalPatterns = [
      /in\s+the\s+future/i,
      /will\s+be/i,
      /expected\s+to/i,
      /predicted/i,
      /forecast/i,
      /trend/i,
      /over\s+time/i
    ];

    const sentences = text.split(/[.!?]+/);
    
    sentences.forEach(sentence => {
      const hasTemporalPattern = temporalPatterns.some(pattern => pattern.test(sentence));
      if (hasTemporalPattern && sentence.trim().length > 20) {
        insights.push({
          text: sentence.trim(),
          type: 'recommendation',
          confidence: 0.6,
          source: 'pattern',
          context: 'Contains temporal or predictive information'
        });
      }
    });

    return insights;
  }

  /**
   * Combine insights from different sources and remove duplicates
   * @private
   */
  _combineInsights(insightArrays) {
    const combined = [];
    const seenTexts = new Map(); // Use Map to track best insight for each text

    insightArrays.forEach(insight => {
      // Create a normalized version for duplicate detection
      const normalized = insight.text.toLowerCase().replace(/[^\w\s]/g, '').trim();
      
      if (normalized.length > 10) {
        // If we haven't seen this text, or if this insight has higher confidence, use it
        if (!seenTexts.has(normalized) || seenTexts.get(normalized).confidence < insight.confidence) {
          seenTexts.set(normalized, insight);
        }
      }
    });

    // Convert map values back to array
    return Array.from(seenTexts.values());
  }

  /**
   * Rank insights based on various factors
   * @private
   */
  _rankInsights(insights, originalText) {
    return insights.map(insight => {
      let score = insight.confidence || 0.5;
      
      // Boost score based on insight type
      const typeBoosts = {
        conclusion: 1.2,
        implication: 1.1,
        fact: 1.0,
        recommendation: 0.9
      };
      score *= typeBoosts[insight.type] || 1.0;

      // Boost score based on source reliability
      const sourceBoosts = {
        ai: 1.1,
        statistical: 1.0,
        pattern: 0.9
      };
      score *= sourceBoosts[insight.source] || 1.0;

      // Boost score for insights with key terms
      const keyTerms = ['important', 'significant', 'key', 'critical', 'major', 'primary'];
      const hasKeyTerms = keyTerms.some(term => 
        insight.text.toLowerCase().includes(term)
      );
      if (hasKeyTerms) {
        score *= 1.15;
      }

      // Penalize very short or very long insights
      const textLength = insight.text.length;
      if (textLength < 30) {
        score *= 0.8;
      } else if (textLength > 200) {
        score *= 0.9;
      }

      return {
        ...insight,
        finalScore: Math.min(score, 1.0)
      };
    }).sort((a, b) => b.finalScore - a.finalScore);
  }

  /**
   * Filter insights based on criteria
   * @private
   */
  _filterInsights(rankedInsights, options) {
    return rankedInsights
      .filter(insight => insight.finalScore >= options.minConfidence)
      .slice(0, options.maxInsights)
      .map(insight => ({
        text: insight.text,
        type: insight.type,
        confidence: insight.finalScore,
        source: insight.source,
        context: insight.context
      }));
  }

  /**
   * Calculate overall confidence for the extraction
   * @private
   */
  _calculateOverallConfidence(insights) {
    if (insights.length === 0) return 0;
    
    const avgConfidence = insights.reduce((sum, insight) => sum + insight.confidence, 0) / insights.length;
    const diversityBonus = new Set(insights.map(i => i.source)).size * 0.05;
    
    return Math.min(avgConfidence + diversityBonus, 1.0);
  }

  /**
   * Score sentences for insight potential
   * @private
   */
  _scoreSentencesForInsights(sentences, fullText) {
    const tokens = this.tokenizer.tokenize(fullText.toLowerCase());
    const wordFreq = this._calculateWordFrequency(tokens);
    
    return sentences.map(sentence => {
      const sentenceTokens = this.tokenizer.tokenize(sentence.text.toLowerCase());
      let score = 0;
      
      // Base score from word frequency
      sentenceTokens.forEach(token => {
        if (wordFreq[token]) {
          score += wordFreq[token];
        }
      });
      
      // Normalize by sentence length
      score = score / Math.max(sentenceTokens.length, 1);
      
      // Boost for insight indicators
      const insightIndicators = [
        'shows', 'demonstrates', 'reveals', 'indicates', 'suggests',
        'found', 'discovered', 'concluded', 'determined', 'proved',
        'important', 'significant', 'key', 'critical', 'major'
      ];
      
      insightIndicators.forEach(indicator => {
        if (sentence.text.toLowerCase().includes(indicator)) {
          score *= 1.3;
        }
      });
      
      // Boost for numbers and statistics
      if (/\d+/.test(sentence.text)) {
        score *= 1.2;
      }
      
      return {
        ...sentence,
        insightScore: Math.min(score, 1.0)
      };
    });
  }

  /**
   * Classify the type of insight
   * @private
   */
  _classifyInsightType(text) {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('conclude') || lowerText.includes('therefore') || lowerText.includes('thus')) {
      return 'conclusion';
    }
    if (lowerText.includes('imply') || lowerText.includes('suggest') || lowerText.includes('indicate')) {
      return 'implication';
    }
    if (lowerText.includes('should') || lowerText.includes('recommend') || lowerText.includes('ought')) {
      return 'recommendation';
    }
    
    return 'fact';
  }

  /**
   * Extract sentences from text
   * @private
   */
  _extractSentences(text) {
    // First try compromise for better sentence parsing
    try {
      const doc = compromise(text);
      const sentences = doc.sentences().out('array');
      
      if (sentences.length > 0) {
        return sentences
          .filter(sentence => sentence.length > 20)
          .map((sentence, index) => ({
            text: sentence.trim(),
            position: index,
            length: sentence.length
          }));
      }
    } catch (error) {
      console.warn('Compromise sentence extraction failed, using fallback');
    }
    
    // Fallback to simple sentence splitting
    const sentences = text.split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 20);
    
    return sentences.map((sentence, index) => ({
      text: sentence,
      position: index,
      length: sentence.length
    }));
  }

  /**
   * Calculate word frequency
   * @private
   */
  _calculateWordFrequency(tokens) {
    const freq = {};
    const stopWords = new Set(natural.stopwords);
    
    tokens.forEach(token => {
      if (!stopWords.has(token) && token.length > 2) {
        const stemmed = this.stemmer.stem(token);
        freq[stemmed] = (freq[stemmed] || 0) + 1;
      }
    });
    
    return freq;
  }

  /**
   * Preprocess text for analysis
   * @private
   */
  _preprocessText(text) {
    return text
      .replace(/[^\w\s.,!?;:()-]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Get word count
   * @private
   */
  _getWordCount(text) {
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Batch extract insights from multiple texts
   * @param {Array} texts - Array of texts to analyze
   * @param {Object} options - Configuration options
   * @returns {Promise<Array>} Array of insight extraction results
   */
  async batchExtractInsights(texts, options = {}) {
    const results = [];
    
    for (const text of texts) {
      try {
        const insights = await this.extractInsights(text, options);
        results.push(insights);
      } catch (error) {
        results.push({
          insights: [],
          totalFound: 0,
          confidence: 0,
          error: error.message,
          method: 'error'
        });
      }
    }
    
    return results;
  }
}

module.exports = KeyInsightExtractor;