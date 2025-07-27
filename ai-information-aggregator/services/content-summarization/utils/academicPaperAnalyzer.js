const natural = require('natural');
const compromise = require('compromise');
const { OpenAI } = require('openai');

// TODO: Migrate from OpenAI to Anthropic Claude API for production
// Current implementation uses OpenAI GPT-3.5-turbo for development/testing
// Production will use Anthropic Claude with similar API structure

class AcademicPaperAnalyzer {
  constructor() {
    // TODO: Replace with Anthropic client for production
    // this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.tokenizer = new natural.WordTokenizer();
    this.stemmer = natural.PorterStemmer;
    
    // Academic paper section patterns
    this.sectionPatterns = {
      abstract: /(?:^|\n)\s*(?:abstract|summary)\s*:?\s*\n/i,
      introduction: /(?:^|\n)\s*(?:1\.?\s*)?(?:introduction|background)\s*:?\s*\n/i,
      methodology: /(?:^|\n)\s*(?:\d+\.?\s*)?(?:methodology|methods?|approach|experimental\s+setup|materials?\s+and\s+methods?)\s*:?\s*\n/i,
      results: /(?:^|\n)\s*(?:\d+\.?\s*)?(?:results?|findings?|experimental\s+results?|evaluation)\s*:?\s*\n/i,
      discussion: /(?:^|\n)\s*(?:\d+\.?\s*)?(?:discussion|analysis|interpretation)\s*:?\s*\n/i,
      conclusion: /(?:^|\n)\s*(?:\d+\.?\s*)?(?:conclusions?|summary|final\s+remarks?)\s*:?\s*\n/i,
      references: /(?:^|\n)\s*(?:references?|bibliography|citations?)\s*:?\s*\n/i
    };

    // Keywords for identifying academic content
    this.academicKeywords = {
      methodology: [
        'experiment', 'study', 'analysis', 'approach', 'method', 'technique',
        'procedure', 'protocol', 'framework', 'algorithm', 'model', 'dataset',
        'participants', 'subjects', 'sample', 'statistical', 'hypothesis',
        'variable', 'control', 'treatment', 'baseline', 'evaluation'
      ],
      results: [
        'result', 'finding', 'outcome', 'performance', 'accuracy', 'precision',
        'recall', 'score', 'metric', 'measurement', 'data', 'evidence',
        'significant', 'correlation', 'improvement', 'increase', 'decrease',
        'comparison', 'versus', 'outperform', 'achieve', 'demonstrate'
      ]
    };
  }

  /**
   * Analyze academic paper with structure-aware parsing
   * @param {string} text - The academic paper text
   * @param {Object} options - Configuration options
   * @returns {Promise<Object>} Analysis result with methodology and results
   */
  async analyzeAcademicPaper(text, options = {}) {
    try {
      const {
        extractMethodology = true,
        extractResults = true,
        extractAbstract = true,
        extractConclusion = true,
        summaryLength = 'medium'
      } = options;

      // Validate input
      if (!text || typeof text !== 'string') {
        throw new Error('Invalid text input');
      }

      // Check if text appears to be an academic paper
      const isAcademicPaper = this._isAcademicPaper(text);
      if (!isAcademicPaper.isAcademic) {
        return {
          isAcademicPaper: false,
          confidence: isAcademicPaper.confidence,
          reason: 'Text does not appear to be an academic paper',
          fallbackSummary: await this._generateFallbackSummary(text, summaryLength)
        };
      }

      // Extract paper structure
      const structure = this._extractPaperStructure(text);
      
      // Extract key sections
      const sections = {};
      
      if (extractAbstract && structure.abstract) {
        sections.abstract = await this._extractAndSummarizeSection(
          structure.abstract, 'abstract', summaryLength
        );
      }

      if (extractMethodology && structure.methodology) {
        sections.methodology = await this._extractAndSummarizeSection(
          structure.methodology, 'methodology', summaryLength
        );
      }

      if (extractResults && structure.results) {
        sections.results = await this._extractAndSummarizeSection(
          structure.results, 'results', summaryLength
        );
      }

      if (extractConclusion && structure.conclusion) {
        sections.conclusion = await this._extractAndSummarizeSection(
          structure.conclusion, 'conclusion', summaryLength
        );
      }

      // Extract metadata
      const metadata = this._extractMetadata(text, structure);

      // Generate comprehensive summary highlighting methodology and results
      const comprehensiveSummary = await this._generateAcademicSummary(
        sections, metadata, summaryLength
      );

      return {
        isAcademicPaper: true,
        confidence: isAcademicPaper.confidence,
        metadata,
        sections,
        comprehensiveSummary,
        structure: {
          hasAbstract: !!structure.abstract,
          hasMethodology: !!structure.methodology,
          hasResults: !!structure.results,
          hasConclusion: !!structure.conclusion,
          sectionsFound: Object.keys(structure).length
        },
        analysisMethod: 'structure_aware_academic'
      };

    } catch (error) {
      console.error('Error in academic paper analysis:', error);
      throw new Error(`Academic paper analysis failed: ${error.message}`);
    }
  }

  /**
   * Check if text appears to be an academic paper
   * @private
   */
  _isAcademicPaper(text) {
    let score = 0;
    let indicators = [];

    // Check for academic structure indicators
    const structureIndicators = [
      { pattern: this.sectionPatterns.abstract, weight: 3, name: 'abstract' },
      { pattern: this.sectionPatterns.methodology, weight: 4, name: 'methodology' },
      { pattern: this.sectionPatterns.results, weight: 4, name: 'results' },
      { pattern: this.sectionPatterns.references, weight: 2, name: 'references' }
    ];

    structureIndicators.forEach(indicator => {
      if (indicator.pattern.test(text)) {
        score += indicator.weight;
        indicators.push(indicator.name);
      }
    });

    // Check for academic keywords
    const lowerText = text.toLowerCase();
    let keywordScore = 0;
    
    [...this.academicKeywords.methodology, ...this.academicKeywords.results].forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = (lowerText.match(regex) || []).length;
      keywordScore += Math.min(matches * 0.5, 2); // Cap contribution per keyword
    });

    score += Math.min(keywordScore, 8); // Cap total keyword contribution

    // Check for citation patterns
    const citationPatterns = [
      /\[\d+\]/g, // [1], [2], etc.
      /\(\w+\s+et\s+al\.?,?\s+\d{4}\)/gi, // (Smith et al., 2020)
      /\(\w+,?\s+\d{4}\)/g // (Smith, 2020)
    ];

    citationPatterns.forEach(pattern => {
      const matches = (text.match(pattern) || []).length;
      if (matches > 0) {
        score += Math.min(matches * 0.3, 3);
        indicators.push('citations');
      }
    });

    // Check for DOI or academic identifiers
    if (/doi:\s*10\.\d+/i.test(text) || /arxiv:\d+\.\d+/i.test(text)) {
      score += 3;
      indicators.push('academic_identifiers');
    }

    const confidence = Math.min(score / 15, 1); // Normalize to 0-1
    const isAcademic = confidence > 0.4;

    return {
      isAcademic,
      confidence,
      score,
      indicators,
      threshold: 0.4
    };
  }

  /**
   * Extract paper structure by identifying sections
   * @private
   */
  _extractPaperStructure(text) {
    const structure = {};
    const sections = Object.keys(this.sectionPatterns);
    
    // Find section boundaries
    const sectionBoundaries = [];
    
    sections.forEach(sectionName => {
      const pattern = this.sectionPatterns[sectionName];
      const match = pattern.exec(text);
      if (match) {
        sectionBoundaries.push({
          name: sectionName,
          start: match.index,
          headerEnd: match.index + match[0].length
        });
      }
    });

    // Sort by position in text
    sectionBoundaries.sort((a, b) => a.start - b.start);

    // Extract section content
    sectionBoundaries.forEach((section, index) => {
      const nextSection = sectionBoundaries[index + 1];
      const endPos = nextSection ? nextSection.start : text.length;
      
      const content = text.substring(section.headerEnd, endPos).trim();
      if (content.length > 50) { // Only include substantial sections
        structure[section.name] = content;
      }
    });

    return structure;
  }

  /**
   * Extract and summarize a specific section
   * @private
   */
  async _extractAndSummarizeSection(sectionText, sectionType, summaryLength) {
    try {
      // Use AI to extract and summarize the section with context
      const summary = await this._aiSummarizeSection(sectionText, sectionType, summaryLength);
      
      // Extract key points using rule-based approach as backup
      const keyPoints = this._extractKeyPoints(sectionText, sectionType);
      
      return {
        originalText: sectionText,
        summary: summary || this._fallbackSectionSummary(sectionText, sectionType),
        keyPoints,
        wordCount: this._getWordCount(sectionText),
        method: summary ? 'ai_based' : 'rule_based'
      };
    } catch (error) {
      console.error(`Error processing ${sectionType} section:`, error);
      return {
        originalText: sectionText,
        summary: this._fallbackSectionSummary(sectionText, sectionType),
        keyPoints: this._extractKeyPoints(sectionText, sectionType),
        wordCount: this._getWordCount(sectionText),
        method: 'fallback',
        error: error.message
      };
    }
  }

  /**
   * AI-based section summarization
   * @private
   */
  async _aiSummarizeSection(sectionText, sectionType, summaryLength) {
    try {
      if (!process.env.OPENAI_API_KEY) {
        return null;
      }

      const prompt = this._buildSectionPrompt(sectionText, sectionType, summaryLength);
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at analyzing academic papers and extracting key information from specific sections. Focus on the most important technical details and findings.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: this._getSectionMaxTokens(summaryLength),
        temperature: 0.2,
        top_p: 1
      });

      return response.choices[0]?.message?.content?.trim();
    } catch (error) {
      console.error('AI section summarization failed:', error);
      return null;
    }
  }

  /**
   * Build section-specific prompt
   * @private
   */
  _buildSectionPrompt(sectionText, sectionType, summaryLength) {
    const prompts = {
      abstract: 'Summarize this abstract, highlighting the main contribution, approach, and key findings:',
      methodology: 'Summarize this methodology section, focusing on the experimental approach, techniques used, and key parameters:',
      results: 'Summarize these results, highlighting the main findings, performance metrics, and significant outcomes:',
      conclusion: 'Summarize this conclusion, focusing on the main takeaways and implications:',
      default: 'Summarize this academic section, focusing on the key technical information:'
    };

    const lengthInstructions = {
      brief: 'Keep it very concise (1-2 sentences).',
      medium: 'Provide a balanced summary (2-4 sentences).',
      detailed: 'Provide a comprehensive summary (4-6 sentences).'
    };

    const basePrompt = prompts[sectionType] || prompts.default;
    const lengthInstruction = lengthInstructions[summaryLength] || lengthInstructions.medium;

    return `${basePrompt} ${lengthInstruction}

Section text:
${sectionText}

Summary:`;
  }

  /**
   * Extract key points from section using rule-based approach
   * @private
   */
  _extractKeyPoints(sectionText, sectionType) {
    const sentences = this._extractSentences(sectionText);
    const keywords = this.academicKeywords[sectionType] || [...this.academicKeywords.methodology, ...this.academicKeywords.results];
    
    // Score sentences based on keyword presence and other factors
    const scoredSentences = sentences.map(sentence => {
      let score = 0;
      const lowerSentence = sentence.text.toLowerCase();
      
      // Keyword matching
      keywords.forEach(keyword => {
        if (lowerSentence.includes(keyword)) {
          score += 1;
        }
      });
      
      // Boost sentences with numbers (often contain results)
      if (/\d+\.?\d*\s*%|\d+\.?\d*\s*times|\d+\.?\d*\s*fold/i.test(sentence.text)) {
        score += 2;
      }
      
      // Boost sentences with comparison words
      const comparisonWords = ['better', 'worse', 'higher', 'lower', 'improved', 'increased', 'decreased', 'outperform'];
      comparisonWords.forEach(word => {
        if (lowerSentence.includes(word)) {
          score += 1;
        }
      });
      
      return { ...sentence, score };
    });
    
    // Return top 3-5 sentences as key points
    return scoredSentences
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.min(5, Math.ceil(sentences.length * 0.3)))
      .sort((a, b) => a.position - b.position)
      .map(s => s.text);
  }

  /**
   * Fallback section summary using extractive approach
   * @private
   */
  _fallbackSectionSummary(sectionText, sectionType) {
    const sentences = this._extractSentences(sectionText);
    if (sentences.length === 0) return sectionText;
    
    const keyPoints = this._extractKeyPoints(sectionText, sectionType);
    return keyPoints.slice(0, 3).join(' ');
  }

  /**
   * Extract metadata from the paper
   * @private
   */
  _extractMetadata(text, structure) {
    const metadata = {};
    
    // Try to extract title (usually first significant line)
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    if (lines.length > 0) {
      metadata.title = lines[0].trim();
    }
    
    // Extract authors (look for patterns after title)
    const authorPatterns = [
      /^([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s*,\s*[A-Z][a-z]+\s+[A-Z][a-z]+)*)/m,
      /authors?:\s*([^.\n]+)/i
    ];
    
    for (const pattern of authorPatterns) {
      const match = text.match(pattern);
      if (match) {
        metadata.authors = match[1].trim();
        break;
      }
    }
    
    // Extract DOI
    const doiMatch = text.match(/doi:\s*(10\.\d+\/[^\s]+)/i);
    if (doiMatch) {
      metadata.doi = doiMatch[1];
    }
    
    // Extract arXiv ID
    const arxivMatch = text.match(/arxiv:(\d+\.\d+)/i);
    if (arxivMatch) {
      metadata.arxivId = arxivMatch[1];
    }
    
    // Estimate publication year
    const yearMatch = text.match(/\b(20\d{2})\b/g);
    if (yearMatch) {
      // Take the most recent year that's not in the future
      const currentYear = new Date().getFullYear();
      const years = yearMatch.map(y => parseInt(y)).filter(y => y <= currentYear);
      if (years.length > 0) {
        metadata.year = Math.max(...years);
      }
    }
    
    // Count references
    const refSection = structure.references;
    if (refSection) {
      const refLines = refSection.split('\n').filter(line => line.trim().length > 0);
      metadata.referenceCount = refLines.length;
    }
    
    return metadata;
  }

  /**
   * Generate comprehensive academic summary
   * @private
   */
  async _generateAcademicSummary(sections, metadata, summaryLength) {
    try {
      if (!process.env.OPENAI_API_KEY) {
        return this._generateRuleBasedSummary(sections, metadata);
      }

      const prompt = this._buildComprehensivePrompt(sections, metadata, summaryLength);
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at creating comprehensive summaries of academic papers that highlight methodology and results as required. Focus on technical accuracy and key contributions.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: this._getComprehensiveMaxTokens(summaryLength),
        temperature: 0.3
      });

      return response.choices[0]?.message?.content?.trim();
    } catch (error) {
      console.error('AI comprehensive summary failed:', error);
      return this._generateRuleBasedSummary(sections, metadata);
    }
  }

  /**
   * Build comprehensive summary prompt
   * @private
   */
  _buildComprehensivePrompt(sections, metadata, summaryLength) {
    let prompt = 'Create a comprehensive summary of this academic paper that specifically highlights the methodology and results as required. ';
    
    if (summaryLength === 'brief') {
      prompt += 'Keep it concise but ensure methodology and results are covered.';
    } else if (summaryLength === 'detailed') {
      prompt += 'Provide detailed coverage of the methodology and results with supporting context.';
    } else {
      prompt += 'Provide balanced coverage of the methodology and results.';
    }
    
    prompt += '\n\nPaper information:\n';
    
    if (metadata.title) {
      prompt += `Title: ${metadata.title}\n`;
    }
    if (metadata.authors) {
      prompt += `Authors: ${metadata.authors}\n`;
    }
    
    prompt += '\nKey sections:\n';
    
    Object.entries(sections).forEach(([sectionName, sectionData]) => {
      prompt += `\n${sectionName.toUpperCase()}:\n${sectionData.summary}\n`;
    });
    
    prompt += '\nComprehensive Summary:';
    return prompt;
  }

  /**
   * Generate rule-based summary as fallback
   * @private
   */
  _generateRuleBasedSummary(sections, metadata) {
    let summary = '';
    
    if (metadata.title) {
      summary += `This paper titled "${metadata.title}" `;
    } else {
      summary += 'This academic paper ';
    }
    
    if (sections.methodology) {
      summary += `employs the following methodology: ${sections.methodology.summary} `;
    }
    
    if (sections.results) {
      summary += `The key results show: ${sections.results.summary} `;
    }
    
    if (sections.abstract) {
      summary += `As outlined in the abstract: ${sections.abstract.summary}`;
    }
    
    return summary.trim();
  }

  /**
   * Generate fallback summary for non-academic content
   * @private
   */
  async _generateFallbackSummary(text, summaryLength) {
    // Use basic text summarization for non-academic content
    const sentences = this._extractSentences(text);
    const targetCount = summaryLength === 'brief' ? 2 : summaryLength === 'detailed' ? 5 : 3;
    
    return sentences
      .slice(0, Math.min(targetCount, sentences.length))
      .map(s => s.text)
      .join(' ');
  }

  /**
   * Extract sentences from text
   * @private
   */
  _extractSentences(text) {
    const doc = compromise(text);
    const sentences = doc.sentences().out('array');
    
    return sentences
      .filter(sentence => sentence.length > 20)
      .map((sentence, index) => ({
        text: sentence.trim(),
        position: index,
        length: sentence.length
      }));
  }

  /**
   * Get word count
   * @private
   */
  _getWordCount(text) {
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Get max tokens for section summarization
   * @private
   */
  _getSectionMaxTokens(summaryLength) {
    const tokenLimits = {
      brief: 80,
      medium: 150,
      detailed: 250
    };
    return tokenLimits[summaryLength] || tokenLimits.medium;
  }

  /**
   * Get max tokens for comprehensive summary
   * @private
   */
  _getComprehensiveMaxTokens(summaryLength) {
    const tokenLimits = {
      brief: 200,
      medium: 350,
      detailed: 500
    };
    return tokenLimits[summaryLength] || tokenLimits.medium;
  }

  /**
   * Batch analyze multiple academic papers
   * @param {Array} texts - Array of paper texts to analyze
   * @param {Object} options - Configuration options
   * @returns {Promise<Array>} Array of analysis results
   */
  async batchAnalyze(texts, options = {}) {
    const results = [];
    
    for (const text of texts) {
      try {
        const analysis = await this.analyzeAcademicPaper(text, options);
        results.push(analysis);
      } catch (error) {
        results.push({
          error: error.message,
          isAcademicPaper: false,
          originalText: text ? text.substring(0, 100) + '...' : 'null/undefined text'
        });
      }
    }
    
    return results;
  }
}

module.exports = AcademicPaperAnalyzer;