const OpenAI = require('openai');
const axios = require('axios');

class VisualContentDescriptor {
  constructor() {
    this.openai = process.env.OPENAI_API_KEY ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    }) : null;
    
    this.relevanceThreshold = 0.6;
    this.maxImageSize = 20 * 1024 * 1024; // 20MB
    this.supportedFormats = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  }

  /**
   * Analyze and describe visual content from URL or base64 data
   * @param {string|Object} imageInput - Image URL or object with base64 data
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} Analysis result with description and relevance
   */
  async analyzeVisualContent(imageInput, options = {}) {
    try {
      const {
        includeRelevanceAssessment = true,
        contextText = '',
        detailLevel = 'medium',
        focusAreas = ['ai', 'llm', 'machine learning', 'technology']
      } = options;

      // Validate input
      if (!imageInput) {
        throw new Error('Image input is required');
      }

      // Process image input
      let imageData;
      if (typeof imageInput === 'string') {
        // URL input
        imageData = await this._fetchImageFromUrl(imageInput);
      } else if (imageInput.base64) {
        // Base64 input
        imageData = {
          base64: imageInput.base64,
          mimeType: imageInput.mimeType || 'image/jpeg'
        };
      } else {
        throw new Error('Invalid image input format');
      }

      // Validate image format and size
      this._validateImage(imageData);

      // Generate description using AI
      const description = await this._generateDescription(imageData, detailLevel, contextText);

      // Assess relevance if requested
      let relevanceAssessment = null;
      if (includeRelevanceAssessment) {
        relevanceAssessment = await this._assessRelevance(description.text, focusAreas, contextText);
      }

      return {
        description: description.text,
        confidence: description.confidence,
        relevanceAssessment,
        metadata: {
          mimeType: imageData.mimeType,
          size: imageData.size,
          detailLevel,
          focusAreas,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('Error analyzing visual content:', error);
      return {
        error: error.message,
        description: null,
        confidence: 0,
        relevanceAssessment: null
      };
    }
  }

  /**
   * Batch analyze multiple visual contents
   * @param {Array} imageInputs - Array of image inputs
   * @param {Object} options - Analysis options
   * @returns {Promise<Array>} Array of analysis results
   */
  async batchAnalyzeVisualContent(imageInputs, options = {}) {
    if (!Array.isArray(imageInputs)) {
      throw new Error('Image inputs must be an array');
    }

    if (imageInputs.length > 10) {
      throw new Error('Maximum 10 images allowed per batch');
    }

    const results = [];
    
    for (let i = 0; i < imageInputs.length; i++) {
      try {
        const result = await this.analyzeVisualContent(imageInputs[i], options);
        results.push({
          index: i,
          ...result
        });
      } catch (error) {
        results.push({
          index: i,
          error: error.message,
          description: null,
          confidence: 0,
          relevanceAssessment: null
        });
      }
    }

    return results;
  }

  /**
   * Assess relevance of visual content to AI/LLM topics
   * @param {string} description - Image description
   * @param {Array} focusAreas - Areas of focus for relevance
   * @param {string} contextText - Additional context
   * @returns {Promise<Object>} Relevance assessment
   */
  async _assessRelevance(description, focusAreas, contextText = '') {
    try {
      if (!this.openai) {
        // Fallback keyword-based relevance assessment
        return this._keywordBasedRelevance(description, focusAreas);
      }

      const prompt = `
        Analyze the relevance of this image description to the following focus areas: ${focusAreas.join(', ')}.
        
        Image Description: "${description}"
        ${contextText ? `Additional Context: "${contextText}"` : ''}
        
        Provide a relevance assessment with:
        1. Overall relevance score (0.0 to 1.0)
        2. Specific relevance to each focus area
        3. Key relevant elements identified
        4. Reasoning for the assessment
        
        Respond in JSON format:
        {
          "overallRelevance": 0.0-1.0,
          "focusAreaRelevance": {
            "area1": 0.0-1.0,
            "area2": 0.0-1.0
          },
          "relevantElements": ["element1", "element2"],
          "reasoning": "explanation of relevance assessment"
        }
      `;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at assessing the relevance of visual content to AI, machine learning, and technology topics. Provide accurate, objective assessments.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 500
      });

      const result = JSON.parse(response.choices[0].message.content);
      
      return {
        overallRelevance: result.overallRelevance,
        focusAreaRelevance: result.focusAreaRelevance,
        relevantElements: result.relevantElements,
        reasoning: result.reasoning,
        isRelevant: result.overallRelevance >= this.relevanceThreshold,
        method: 'ai'
      };

    } catch (error) {
      console.error('Error in AI relevance assessment, falling back to keyword-based:', error);
      return this._keywordBasedRelevance(description, focusAreas);
    }
  }

  /**
   * Generate description of visual content using AI
   * @param {Object} imageData - Image data with base64 and mimeType
   * @param {string} detailLevel - Level of detail for description
   * @param {string} contextText - Additional context
   * @returns {Promise<Object>} Description with confidence
   */
  async _generateDescription(imageData, detailLevel, contextText) {
    if (!this.openai) {
      return {
        text: 'Visual content description not available (AI service not configured)',
        confidence: 0,
        method: 'fallback'
      };
    }

    try {
      const detailPrompts = {
        brief: 'Provide a brief, one-sentence description of this image.',
        medium: 'Provide a detailed description of this image, including key elements, text, and context.',
        detailed: 'Provide a comprehensive description of this image, including all visible elements, text content, layout, colors, and potential significance.'
      };

      const prompt = `
        ${detailPrompts[detailLevel] || detailPrompts.medium}
        
        ${contextText ? `Additional context: ${contextText}` : ''}
        
        Focus particularly on elements related to AI, machine learning, technology, research, or academic content.
        
        Respond in JSON format:
        {
          "description": "detailed description of the image",
          "confidence": 0.0-1.0,
          "keyElements": ["element1", "element2"],
          "textContent": "any text visible in the image",
          "technicalElements": ["technical elements if any"]
        }
      `;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-vision-preview',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${imageData.mimeType};base64,${imageData.base64}`
                }
              }
            ]
          }
        ],
        temperature: 0.3,
        max_tokens: 1000
      });

      const result = JSON.parse(response.choices[0].message.content);
      
      return {
        text: result.description,
        confidence: result.confidence,
        keyElements: result.keyElements,
        textContent: result.textContent,
        technicalElements: result.technicalElements,
        method: 'ai'
      };

    } catch (error) {
      console.error('Error generating AI description:', error);
      return {
        text: `Visual content detected (${imageData.mimeType}) - AI description unavailable: ${error.message}`,
        confidence: 0.3,
        method: 'fallback'
      };
    }
  }

  /**
   * Fetch image from URL
   * @param {string} url - Image URL
   * @returns {Promise<Object>} Image data
   */
  async _fetchImageFromUrl(url) {
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 30000,
        maxContentLength: this.maxImageSize,
        headers: {
          'User-Agent': 'AI-Information-Aggregator/1.0'
        }
      });

      const mimeType = response.headers['content-type'] || 'image/jpeg';
      const base64 = Buffer.from(response.data).toString('base64');
      
      return {
        base64,
        mimeType,
        size: response.data.length,
        url
      };

    } catch (error) {
      throw new Error(`Failed to fetch image from URL: ${error.message}`);
    }
  }

  /**
   * Validate image format and size
   * @param {Object} imageData - Image data to validate
   */
  _validateImage(imageData) {
    if (!imageData.base64) {
      throw new Error('Invalid image data: base64 content required');
    }

    if (!this.supportedFormats.includes(imageData.mimeType)) {
      throw new Error(`Unsupported image format: ${imageData.mimeType}. Supported formats: ${this.supportedFormats.join(', ')}`);
    }

    const sizeInBytes = imageData.size || (imageData.base64.length * 0.75);
    if (sizeInBytes > this.maxImageSize) {
      throw new Error(`Image too large: ${Math.round(sizeInBytes / 1024 / 1024)}MB. Maximum size: ${this.maxImageSize / 1024 / 1024}MB`);
    }
  }

  /**
   * Fallback keyword-based relevance assessment
   * @param {string} description - Image description
   * @param {Array} focusAreas - Focus areas for relevance
   * @returns {Object} Relevance assessment
   */
  _keywordBasedRelevance(description, focusAreas) {
    // Ensure description is a string
    if (typeof description !== 'string') {
      description = String(description || '');
    }
    const keywords = {
      ai: ['artificial intelligence', 'ai', 'neural network', 'deep learning', 'machine learning', 'algorithm'],
      llm: ['large language model', 'llm', 'gpt', 'transformer', 'language model', 'nlp'],
      'machine learning': ['machine learning', 'ml', 'training', 'model', 'dataset', 'prediction'],
      technology: ['technology', 'tech', 'software', 'hardware', 'computer', 'digital', 'innovation'],
      research: ['research', 'study', 'paper', 'academic', 'experiment', 'analysis', 'findings'],
      data: ['data', 'statistics', 'chart', 'graph', 'visualization', 'metrics']
    };

    const descriptionLower = description.toLowerCase();
    const focusAreaRelevance = {};
    let totalRelevance = 0;
    const relevantElements = [];

    focusAreas.forEach(area => {
      const areaKeywords = keywords[area.toLowerCase()] || [area.toLowerCase()];
      let areaScore = 0;
      
      areaKeywords.forEach(keyword => {
        if (descriptionLower.includes(keyword)) {
          areaScore += 0.2;
          relevantElements.push(keyword);
        }
      });
      
      focusAreaRelevance[area] = Math.min(areaScore, 1.0);
      totalRelevance += focusAreaRelevance[area];
    });

    const overallRelevance = Math.min(totalRelevance / focusAreas.length, 1.0);

    return {
      overallRelevance,
      focusAreaRelevance,
      relevantElements: [...new Set(relevantElements)],
      reasoning: 'Keyword-based relevance assessment using predefined technology and AI-related terms',
      isRelevant: overallRelevance >= this.relevanceThreshold,
      method: 'keyword'
    };
  }

  /**
   * Get configuration options for visual content analysis
   * @returns {Object} Configuration options
   */
  getConfig() {
    return {
      detailLevels: ['brief', 'medium', 'detailed'],
      supportedFormats: this.supportedFormats,
      maxImageSize: this.maxImageSize,
      relevanceThreshold: this.relevanceThreshold,
      defaultFocusAreas: ['ai', 'llm', 'machine learning', 'technology'],
      limits: {
        maxBatchSize: 10,
        maxImageSize: this.maxImageSize,
        timeout: 30000
      },
      aiAvailable: !!this.openai
    };
  }

  /**
   * Update relevance threshold
   * @param {number} threshold - New threshold (0.0 to 1.0)
   */
  setRelevanceThreshold(threshold) {
    if (threshold < 0 || threshold > 1) {
      throw new Error('Relevance threshold must be between 0.0 and 1.0');
    }
    this.relevanceThreshold = threshold;
  }
}

module.exports = VisualContentDescriptor;