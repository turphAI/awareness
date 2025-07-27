const natural = require('natural');
const compromise = require('compromise');
const { OpenAI } = require('openai');

// TODO: Migrate from OpenAI to Anthropic Claude API for production
// Current implementation uses OpenAI GPT-3.5-turbo for development/testing
// Production will use Anthropic Claude with similar API structure

class TextSummarizer {
  constructor() {
    // TODO: Replace with Anthropic client for production
    // this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.tokenizer = new natural.WordTokenizer();
    this.stemmer = natural.PorterStemmer;
  }

  /**
   * Summarize text using AI-based approach
   * @param {string} text - The text to summarize
   * @param {Object} options - Configuration options
   * @returns {Promise<Object>} Summary result
   */
  async summarizeText(text, options = {}) {
    try {
      const {
        length = 'medium',
        detail = 'balanced',
        maxTokens = this._getMaxTokens(length),
        temperature = 0.3
      } = options;

      // Validate input
      if (!text || typeof text !== 'string') {
        throw new Error('Invalid text input');
      }

      // Clean and preprocess text
      const cleanedText = this._preprocessText(text);
      
      // Check if text is too short to summarize
      if (this._getWordCount(cleanedText) < 50) {
        return {
          summary: cleanedText,
          originalLength: this._getWordCount(text),
          summaryLength: this._getWordCount(cleanedText),
          compressionRatio: 1.0,
          method: 'no_summarization_needed'
        };
      }

      // Use AI-based summarization for better quality
      const aiSummary = await this._aiSummarize(cleanedText, {
        maxTokens,
        temperature,
        detail
      });

      // Fallback to extractive summarization if AI fails
      const fallbackSummary = this._extractiveSummarize(cleanedText, options);

      const finalSummary = aiSummary || fallbackSummary;
      
      return {
        summary: finalSummary,
        originalLength: this._getWordCount(text),
        summaryLength: this._getWordCount(finalSummary),
        compressionRatio: this._getWordCount(finalSummary) / this._getWordCount(text),
        method: aiSummary ? 'ai_based' : 'extractive',
        confidence: aiSummary ? 0.9 : 0.7
      };

    } catch (error) {
      console.error('Error in text summarization:', error);
      throw new Error(`Summarization failed: ${error.message}`);
    }
  }

  /**
   * AI-based summarization using OpenAI
   * @private
   */
  async _aiSummarize(text, options) {
    try {
      // TODO: Update to check for ANTHROPIC_API_KEY in production
      if (!process.env.OPENAI_API_KEY) {
        console.warn('OpenAI API key not configured, falling back to extractive summarization');
        return null;
      }

      const prompt = this._buildSummarizationPrompt(text, options);
      
      // TODO: Replace with Anthropic Claude API call for production
      // const response = await this.anthropic.messages.create({
      //   model: 'claude-3-sonnet-20240229',
      //   max_tokens: options.maxTokens,
      //   temperature: options.temperature,
      //   messages: [{ role: 'user', content: prompt }]
      // });
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at creating concise, accurate summaries of technical content, particularly in AI/ML and technology domains.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: options.maxTokens,
        temperature: options.temperature,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0
      });

      // TODO: Update response parsing for Anthropic
      // return response.content[0]?.text?.trim();
      return response.choices[0]?.message?.content?.trim();
    } catch (error) {
      console.error('AI summarization failed:', error);
      return null;
    }
  }

  /**
   * Build summarization prompt based on detail level
   * @private
   */
  _buildSummarizationPrompt(text, options) {
    const detailInstructions = {
      brief: 'Create a very concise summary focusing only on the main point.',
      balanced: 'Create a balanced summary that captures key points and important details.',
      detailed: 'Create a comprehensive summary that includes main points, key details, and important context.'
    };

    return `Please summarize the following text. ${detailInstructions[options.detail] || detailInstructions.balanced}

Text to summarize:
${text}

Summary:`;
  }

  /**
   * Extractive summarization as fallback
   * @private
   */
  _extractiveSummarize(text, options) {
    try {
      const sentences = this._extractSentences(text);
      const scoredSentences = this._scoreSentences(sentences, text);
      const topSentences = this._selectTopSentences(scoredSentences, options);
      
      return topSentences
        .sort((a, b) => a.position - b.position)
        .map(s => s.text)
        .join(' ');
    } catch (error) {
      console.error('Extractive summarization failed:', error);
      // Return first few sentences as last resort
      const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
      return sentences.slice(0, 3).join('. ') + '.';
    }
  }

  /**
   * Extract sentences from text
   * @private
   */
  _extractSentences(text) {
    const doc = compromise(text);
    const sentences = doc.sentences().out('array');
    
    return sentences
      .filter(sentence => sentence.length > 20) // Filter out very short sentences
      .map((sentence, index) => ({
        text: sentence.trim(),
        position: index,
        length: sentence.length
      }));
  }

  /**
   * Score sentences based on various factors
   * @private
   */
  _scoreSentences(sentences, fullText) {
    const tokens = this.tokenizer.tokenize(fullText.toLowerCase());
    const wordFreq = this._calculateWordFrequency(tokens);
    
    return sentences.map(sentence => {
      const sentenceTokens = this.tokenizer.tokenize(sentence.text.toLowerCase());
      let score = 0;
      
      // Score based on word frequency
      sentenceTokens.forEach(token => {
        if (wordFreq[token]) {
          score += wordFreq[token];
        }
      });
      
      // Normalize by sentence length
      score = score / sentenceTokens.length;
      
      // Boost sentences with numbers (often contain important facts)
      if (/\d+/.test(sentence.text)) {
        score *= 1.2;
      }
      
      // Boost sentences with key phrases
      const keyPhrases = ['important', 'significant', 'key', 'main', 'primary', 'conclusion', 'result'];
      keyPhrases.forEach(phrase => {
        if (sentence.text.toLowerCase().includes(phrase)) {
          score *= 1.1;
        }
      });
      
      return {
        ...sentence,
        score
      };
    });
  }

  /**
   * Select top sentences for summary
   * @private
   */
  _selectTopSentences(scoredSentences, options) {
    const targetLength = this._getTargetSentenceCount(options.length);
    
    return scoredSentences
      .sort((a, b) => b.score - a.score)
      .slice(0, targetLength);
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
   * Preprocess text for summarization
   * @private
   */
  _preprocessText(text) {
    return text
      .replace(/[^\w\s.,!?;:()-]/g, '') // Remove special characters first
      .replace(/\s+/g, ' ') // Then normalize whitespace
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
   * Get max tokens based on length setting
   * @private
   */
  _getMaxTokens(length) {
    const tokenLimits = {
      brief: 100,
      short: 150,
      medium: 250,
      long: 400,
      detailed: 600
    };
    
    return tokenLimits[length] || tokenLimits.medium;
  }

  /**
   * Get target sentence count for extractive summarization
   * @private
   */
  _getTargetSentenceCount(length) {
    const sentenceCounts = {
      brief: 2,
      short: 3,
      medium: 5,
      long: 8,
      detailed: 12
    };
    
    return sentenceCounts[length] || sentenceCounts.medium;
  }

  /**
   * Batch summarize multiple texts
   * @param {Array} texts - Array of texts to summarize
   * @param {Object} options - Configuration options
   * @returns {Promise<Array>} Array of summary results
   */
  async batchSummarize(texts, options = {}) {
    const results = [];
    
    for (const text of texts) {
      try {
        const summary = await this.summarizeText(text, options);
        results.push(summary);
      } catch (error) {
        results.push({
          error: error.message,
          originalText: text ? text.substring(0, 100) + '...' : 'null/undefined text'
        });
      }
    }
    
    return results;
  }
}

module.exports = TextSummarizer;