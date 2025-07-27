const TextSummarizer = require('../utils/textSummarizer');
const KeyInsightExtractor = require('../utils/keyInsightExtractor');
const ContentCategorizer = require('../utils/contentCategorizer');
const AcademicPaperAnalyzer = require('../utils/academicPaperAnalyzer');
const NewsArticleAnalyzer = require('../utils/newsArticleAnalyzer');
const VisualContentDescriptor = require('../utils/visualContentDescriptor');

class SummarizationController {
  constructor() {
    this.textSummarizer = new TextSummarizer();
    this.keyInsightExtractor = new KeyInsightExtractor();
    this.contentCategorizer = new ContentCategorizer();
    this.academicPaperAnalyzer = new AcademicPaperAnalyzer();
    this.newsArticleAnalyzer = new NewsArticleAnalyzer();
    this.visualContentDescriptor = new VisualContentDescriptor();
  }

  /**
   * Summarize single text content
   */
  async summarizeText(req, res) {
    try {
      const { text, options = {} } = req.body;

      if (!text || text.trim().length === 0) {
        return res.status(400).json({
          error: 'Text content is required'
        });
      }

      const result = await this.textSummarizer.summarizeText(text, options);

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      console.error('Error in summarizeText:', error);
      res.status(500).json({
        error: 'Failed to summarize text',
        details: error.message
      });
    }
  }

  /**
   * Batch summarize multiple texts
   */
  async batchSummarize(req, res) {
    try {
      const { texts, options = {} } = req.body;

      if (!Array.isArray(texts) || texts.length === 0) {
        return res.status(400).json({
          error: 'Array of texts is required'
        });
      }

      if (texts.length > 50) {
        return res.status(400).json({
          error: 'Maximum 50 texts allowed per batch'
        });
      }

      const results = await this.textSummarizer.batchSummarize(texts, options);

      res.json({
        success: true,
        data: {
          results,
          processed: results.length,
          successful: results.filter(r => !r.error).length,
          failed: results.filter(r => r.error).length
        }
      });

    } catch (error) {
      console.error('Error in batchSummarize:', error);
      res.status(500).json({
        error: 'Failed to batch summarize texts',
        details: error.message
      });
    }
  }

  /**
   * Get summarization configuration options
   */
  async getConfig(req, res) {
    try {
      const config = {
        lengthOptions: ['brief', 'short', 'medium', 'long', 'detailed'],
        detailOptions: ['brief', 'balanced', 'detailed'],
        defaultOptions: {
          length: 'medium',
          detail: 'balanced',
          temperature: 0.3
        },
        limits: {
          maxTextLength: 50000, // characters
          maxBatchSize: 50,
          maxTokens: {
            brief: 100,
            short: 150,
            medium: 250,
            long: 400,
            detailed: 600
          }
        }
      };

      res.json({
        success: true,
        data: config
      });

    } catch (error) {
      console.error('Error in getConfig:', error);
      res.status(500).json({
        error: 'Failed to get configuration',
        details: error.message
      });
    }
  }

  /**
   * Extract key insights from text content
   */
  async extractInsights(req, res) {
    try {
      const { text, options = {} } = req.body;

      if (!text || text.trim().length === 0) {
        return res.status(400).json({
          error: 'Text content is required'
        });
      }

      const result = await this.keyInsightExtractor.extractInsights(text, options);

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      console.error('Error in extractInsights:', error);
      res.status(500).json({
        error: 'Failed to extract insights',
        details: error.message
      });
    }
  }

  /**
   * Batch extract insights from multiple texts
   */
  async batchExtractInsights(req, res) {
    try {
      const { texts, options = {} } = req.body;

      if (!Array.isArray(texts) || texts.length === 0) {
        return res.status(400).json({
          error: 'Array of texts is required'
        });
      }

      if (texts.length > 20) {
        return res.status(400).json({
          error: 'Maximum 20 texts allowed per batch for insight extraction'
        });
      }

      const results = await this.keyInsightExtractor.batchExtractInsights(texts, options);

      res.json({
        success: true,
        data: {
          results,
          processed: results.length,
          successful: results.filter(r => !r.error).length,
          failed: results.filter(r => r.error).length
        }
      });

    } catch (error) {
      console.error('Error in batchExtractInsights:', error);
      res.status(500).json({
        error: 'Failed to batch extract insights',
        details: error.message
      });
    }
  }

  /**
   * Categorize single text content
   */
  async categorizeText(req, res) {
    try {
      const { text, options = {} } = req.body;

      if (!text || text.trim().length === 0) {
        return res.status(400).json({
          error: 'Text content is required'
        });
      }

      const result = await this.contentCategorizer.categorizeContent(text, options);

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      console.error('Error in categorizeText:', error);
      res.status(500).json({
        error: 'Failed to categorize text',
        details: error.message
      });
    }
  }

  /**
   * Batch categorize multiple texts
   */
  async batchCategorize(req, res) {
    try {
      const { texts, options = {} } = req.body;

      if (!Array.isArray(texts) || texts.length === 0) {
        return res.status(400).json({
          error: 'Array of texts is required'
        });
      }

      if (texts.length > 100) {
        return res.status(400).json({
          error: 'Maximum 100 texts allowed per batch for categorization'
        });
      }

      const results = await this.contentCategorizer.batchCategorize(texts, options);

      res.json({
        success: true,
        data: {
          results,
          processed: results.length,
          successful: results.filter(r => !r.error).length,
          failed: results.filter(r => r.error).length
        }
      });

    } catch (error) {
      console.error('Error in batchCategorize:', error);
      res.status(500).json({
        error: 'Failed to batch categorize texts',
        details: error.message
      });
    }
  }

  /**
   * Get available categories
   */
  async getCategories(req, res) {
    try {
      const categories = this.contentCategorizer.getCategories();

      res.json({
        success: true,
        data: {
          categories,
          count: Object.keys(categories).length
        }
      });

    } catch (error) {
      console.error('Error in getCategories:', error);
      res.status(500).json({
        error: 'Failed to get categories',
        details: error.message
      });
    }
  }

  /**
   * Add custom category
   */
  async addCategory(req, res) {
    try {
      const { name, keywords, weight = 1.0 } = req.body;

      if (!name || !Array.isArray(keywords) || keywords.length === 0) {
        return res.status(400).json({
          error: 'Category name and keywords array are required'
        });
      }

      this.contentCategorizer.addCategory(name, keywords, weight);

      res.json({
        success: true,
        data: {
          message: `Category '${name}' added successfully`,
          category: {
            name,
            keywords,
            weight
          }
        }
      });

    } catch (error) {
      console.error('Error in addCategory:', error);
      res.status(500).json({
        error: 'Failed to add category',
        details: error.message
      });
    }
  }

  /**
   * Remove category
   */
  async removeCategory(req, res) {
    try {
      const { name } = req.params;

      if (!name) {
        return res.status(400).json({
          error: 'Category name is required'
        });
      }

      this.contentCategorizer.removeCategory(name);

      res.json({
        success: true,
        data: {
          message: `Category '${name}' removed successfully`
        }
      });

    } catch (error) {
      console.error('Error in removeCategory:', error);
      res.status(500).json({
        error: 'Failed to remove category',
        details: error.message
      });
    }
  }

  /**
   * Analyze academic paper with structure-aware parsing
   */
  async analyzeAcademicPaper(req, res) {
    try {
      const { text, options = {} } = req.body;

      if (!text || text.trim().length === 0) {
        return res.status(400).json({
          error: 'Text content is required'
        });
      }

      const result = await this.academicPaperAnalyzer.analyzeAcademicPaper(text, options);

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      console.error('Error in analyzeAcademicPaper:', error);
      res.status(500).json({
        error: 'Failed to analyze academic paper',
        details: error.message
      });
    }
  }

  /**
   * Batch analyze multiple academic papers
   */
  async batchAnalyzeAcademicPapers(req, res) {
    try {
      const { texts, options = {} } = req.body;

      if (!Array.isArray(texts) || texts.length === 0) {
        return res.status(400).json({
          error: 'Array of texts is required'
        });
      }

      if (texts.length > 10) {
        return res.status(400).json({
          error: 'Maximum 10 papers allowed per batch for academic analysis'
        });
      }

      const results = await this.academicPaperAnalyzer.batchAnalyze(texts, options);

      res.json({
        success: true,
        data: {
          results,
          processed: results.length,
          academicPapers: results.filter(r => r.isAcademicPaper).length,
          nonAcademicContent: results.filter(r => !r.isAcademicPaper && !r.error).length,
          failed: results.filter(r => r.error).length
        }
      });

    } catch (error) {
      console.error('Error in batchAnalyzeAcademicPapers:', error);
      res.status(500).json({
        error: 'Failed to batch analyze academic papers',
        details: error.message
      });
    }
  }

  /**
   * Get academic analysis configuration options
   */
  async getAcademicConfig(req, res) {
    try {
      const config = {
        extractionOptions: {
          extractMethodology: true,
          extractResults: true,
          extractAbstract: true,
          extractConclusion: true
        },
        summaryLengthOptions: ['brief', 'medium', 'detailed'],
        defaultOptions: {
          extractMethodology: true,
          extractResults: true,
          extractAbstract: true,
          extractConclusion: true,
          summaryLength: 'medium'
        },
        limits: {
          maxTextLength: 100000, // characters
          maxBatchSize: 10,
          academicConfidenceThreshold: 0.4
        },
        supportedSections: [
          'abstract',
          'introduction', 
          'methodology',
          'results',
          'discussion',
          'conclusion',
          'references'
        ]
      };

      res.json({
        success: true,
        data: config
      });

    } catch (error) {
      console.error('Error in getAcademicConfig:', error);
      res.status(500).json({
        error: 'Failed to get academic analysis configuration',
        details: error.message
      });
    }
  }

  /**
   * Analyze news article for fact vs opinion classification and credibility
   */
  async analyzeNewsArticle(req, res) {
    try {
      const { text, options = {} } = req.body;

      if (!text || text.trim().length === 0) {
        return res.status(400).json({
          error: 'Text content is required'
        });
      }

      const result = await this.newsArticleAnalyzer.analyzeNewsArticle(text, options);

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      console.error('Error in analyzeNewsArticle:', error);
      res.status(500).json({
        error: 'Failed to analyze news article',
        details: error.message
      });
    }
  }

  /**
   * Batch analyze multiple news articles
   */
  async batchAnalyzeNewsArticles(req, res) {
    try {
      const { texts, options = {} } = req.body;

      if (!Array.isArray(texts) || texts.length === 0) {
        return res.status(400).json({
          error: 'Array of texts is required'
        });
      }

      if (texts.length > 20) {
        return res.status(400).json({
          error: 'Maximum 20 articles allowed per batch for news analysis'
        });
      }

      const results = await this.newsArticleAnalyzer.batchAnalyze(texts, options);

      res.json({
        success: true,
        data: {
          results,
          processed: results.length,
          newsArticles: results.filter(r => r.isNewsArticle?.isNews).length,
          nonNewsContent: results.filter(r => !r.isNewsArticle?.isNews && !r.error).length,
          failed: results.filter(r => r.error).length
        }
      });

    } catch (error) {
      console.error('Error in batchAnalyzeNewsArticles:', error);
      res.status(500).json({
        error: 'Failed to batch analyze news articles',
        details: error.message
      });
    }
  }

  /**
   * Get news analysis configuration options
   */
  async getNewsConfig(req, res) {
    try {
      const config = {
        analysisOptions: {
          includeSourceCredibility: true,
          includeBiasDetection: true,
          includeFactOpinionRatio: true
        },
        credibilityLevels: ['low', 'low-medium', 'medium', 'medium-high', 'high'],
        biasLevels: ['low', 'low-medium', 'medium', 'medium-high', 'high'],
        qualityLevels: ['very-poor', 'poor', 'fair', 'good', 'excellent'],
        sourceTypes: [
          'government',
          'academic', 
          'established_media',
          'news_agency',
          'independent_media',
          'blog',
          'social_media',
          'unknown'
        ],
        defaultOptions: {
          includeSourceCredibility: true,
          includeBiasDetection: true,
          includeFactOpinionRatio: true,
          sourceType: 'unknown'
        },
        limits: {
          maxTextLength: 50000, // characters
          maxBatchSize: 20,
          newsConfidenceThreshold: 0.4
        }
      };

      res.json({
        success: true,
        data: config
      });

    } catch (error) {
      console.error('Error in getNewsConfig:', error);
      res.status(500).json({
        error: 'Failed to get news analysis configuration',
        details: error.message
      });
    }
  }

  /**
   * Analyze visual content and generate description
   */
  async analyzeVisualContent(req, res) {
    try {
      const { imageInput, options = {} } = req.body;

      if (!imageInput) {
        return res.status(400).json({
          error: 'Image input is required (URL or base64 data)'
        });
      }

      const result = await this.visualContentDescriptor.analyzeVisualContent(imageInput, options);

      if (result.error) {
        return res.status(400).json({
          error: 'Failed to analyze visual content',
          details: result.error
        });
      }

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      console.error('Error in analyzeVisualContent:', error);
      res.status(500).json({
        error: 'Failed to analyze visual content',
        details: error.message
      });
    }
  }

  /**
   * Batch analyze multiple visual contents
   */
  async batchAnalyzeVisualContent(req, res) {
    try {
      const { imageInputs, options = {} } = req.body;

      if (!Array.isArray(imageInputs) || imageInputs.length === 0) {
        return res.status(400).json({
          error: 'Array of image inputs is required'
        });
      }

      if (imageInputs.length > 10) {
        return res.status(400).json({
          error: 'Maximum 10 images allowed per batch'
        });
      }

      const results = await this.visualContentDescriptor.batchAnalyzeVisualContent(imageInputs, options);

      res.json({
        success: true,
        data: {
          results,
          processed: results.length,
          successful: results.filter(r => !r.error).length,
          failed: results.filter(r => r.error).length
        }
      });

    } catch (error) {
      console.error('Error in batchAnalyzeVisualContent:', error);
      res.status(500).json({
        error: 'Failed to batch analyze visual content',
        details: error.message
      });
    }
  }

  /**
   * Get visual content analysis configuration options
   */
  async getVisualConfig(req, res) {
    try {
      const config = this.visualContentDescriptor.getConfig();

      res.json({
        success: true,
        data: config
      });

    } catch (error) {
      console.error('Error in getVisualConfig:', error);
      res.status(500).json({
        error: 'Failed to get visual content configuration',
        details: error.message
      });
    }
  }

  /**
   * Update visual content relevance threshold
   */
  async updateVisualRelevanceThreshold(req, res) {
    try {
      const { threshold } = req.body;

      if (typeof threshold !== 'number' || threshold < 0 || threshold > 1) {
        return res.status(400).json({
          error: 'Threshold must be a number between 0.0 and 1.0'
        });
      }

      this.visualContentDescriptor.setRelevanceThreshold(threshold);

      res.json({
        success: true,
        data: {
          message: 'Relevance threshold updated successfully',
          threshold
        }
      });

    } catch (error) {
      console.error('Error in updateVisualRelevanceThreshold:', error);
      res.status(500).json({
        error: 'Failed to update relevance threshold',
        details: error.message
      });
    }
  }

  /**
   * Health check for summarization service
   */
  async healthCheck(req, res) {
    try {
      // Test with a simple summarization
      const testText = "This is a test text for the summarization service. It contains multiple sentences to verify that the service is working correctly. The service should be able to process this text and return a summary.";
      
      const result = await this.textSummarizer.summarizeText(testText, { length: 'brief' });

      // Test academic paper analysis
      const testAcademicText = `
        Abstract
        This is a test academic paper to verify the academic analysis functionality.
        
        Methodology
        We used a simple test approach to validate the system.
        
        Results
        The system successfully identified this as academic content.
      `;
      
      const academicResult = await this.academicPaperAnalyzer.analyzeAcademicPaper(testAcademicText, { summaryLength: 'brief' });

      // Test news article analysis
      const testNewsText = `
        According to a new study published today, researchers have found significant improvements in AI technology. 
        The data shows a 25% increase in performance metrics compared to previous models.
        "This is a breakthrough in the field," said Dr. Smith, lead researcher on the project.
        However, critics argue that more testing is needed before widespread adoption.
      `;
      
      const newsResult = await this.newsArticleAnalyzer.analyzeNewsArticle(testNewsText, { sourceType: 'academic' });

      // Test visual content analysis
      const testImageData = {
        base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        mimeType: 'image/png'
      };
      
      const visualResult = await this.visualContentDescriptor.analyzeVisualContent(testImageData, { 
        includeRelevanceAssessment: true,
        detailLevel: 'brief'
      });

      res.json({
        success: true,
        status: 'healthy',
        data: {
          aiAvailable: !!process.env.OPENAI_API_KEY,
          testSummary: result.summary,
          method: result.method,
          academicAnalysisWorking: academicResult.isAcademicPaper,
          academicConfidence: academicResult.confidence,
          newsAnalysisWorking: newsResult.isNewsArticle?.isNews,
          newsConfidence: newsResult.isNewsArticle?.confidence,
          factOpinionRatio: newsResult.factOpinionAnalysis?.ratio,
          visualAnalysisWorking: !visualResult.error,
          visualConfidence: visualResult.confidence,
          visualRelevanceMethod: visualResult.relevanceAssessment?.method
        }
      });

    } catch (error) {
      console.error('Error in healthCheck:', error);
      res.status(500).json({
        success: false,
        status: 'unhealthy',
        error: error.message
      });
    }
  }
}

module.exports = SummarizationController;