import { connectToDatabase } from '../../lib/database.js';
import { authenticate } from '../../lib/auth.js';

// AI and NLP utilities
import natural from 'natural';
import compromise from 'compromise';
import { OpenAI } from 'openai';

// Initialize OpenAI client
const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null;

export default async function handler(req, res) {
  try {
    // Authentication
    const user = await authenticate(req);
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        error: 'Unauthorized' 
      });
    }

    // Database connection
    const db = await connectToDatabase();

    if (req.method === 'POST') {
      const { action, contentIds, options = {} } = req.body;

      if (!action) {
        return res.status(400).json({
          success: false,
          error: 'Action is required (categorize, extract_insights, analyze_academic, analyze_news)'
        });
      }

      if (!contentIds || !Array.isArray(contentIds) || contentIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Content IDs array is required'
        });
      }

      // Limit batch size to prevent timeouts
      if (contentIds.length > 20) {
        return res.status(400).json({
          success: false,
          error: 'Maximum 20 content items allowed per batch'
        });
      }

      // Get content items
      const placeholders = contentIds.map(() => '?').join(',');
      const [contents] = await db.execute(
        `SELECT c.*, s.created_by 
         FROM content c 
         JOIN sources s ON c.source_id = s.id 
         WHERE c.id IN (${placeholders}) AND s.created_by = ?`,
        [...contentIds, user.id]
      );

      if (contents.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'No accessible content found'
        });
      }

      let results = [];

      switch (action) {
        case 'categorize':
          results = await batchCategorizeContent(contents, options);
          break;
        case 'extract_insights':
          results = await batchExtractInsights(contents, options);
          break;
        case 'analyze_academic':
          results = await batchAnalyzeAcademic(contents, options);
          break;
        case 'analyze_news':
          results = await batchAnalyzeNews(contents, options);
          break;
        default:
          return res.status(400).json({
            success: false,
            error: 'Invalid action'
          });
      }

      // Update processed content in database
      for (const result of results) {
        if (!result.error && result.contentId) {
          const updates = [];
          const values = [];

          if (result.categories) {
            updates.push('categories = ?');
            values.push(JSON.stringify(result.categories));
          }

          if (result.insights) {
            updates.push('key_insights = ?');
            values.push(JSON.stringify(result.insights));
          }

          if (result.metadata) {
            updates.push('metadata = ?');
            values.push(JSON.stringify(result.metadata));
          }

          if (updates.length > 0) {
            updates.push('processed = TRUE');
            values.push(result.contentId);

            await db.execute(
              `UPDATE content SET ${updates.join(', ')} WHERE id = ?`,
              values
            );
          }
        }
      }

      return res.json({
        success: true,
        data: {
          results,
          processed: results.length,
          successful: results.filter(r => !r.error).length,
          failed: results.filter(r => r.error).length
        }
      });
    }

    if (req.method === 'GET') {
      // Get analysis configuration
      const config = {
        actions: ['categorize', 'extract_insights', 'analyze_academic', 'analyze_news'],
        limits: {
          maxBatchSize: 20,
          maxTextLength: 50000
        },
        categories: getDefaultCategories(),
        aiAvailable: !!process.env.OPENAI_API_KEY
      };

      return res.json({
        success: true,
        data: config
      });
    }

    res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    });

  } catch (error) {
    console.error('Content analysis error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      details: error.message 
    });
  }
}

/**
 * Batch categorize content
 */
async function batchCategorizeContent(contents, options) {
  const results = [];

  for (const content of contents) {
    try {
      const text = content.full_text || content.summary || '';
      if (!text.trim()) {
        results.push({
          contentId: content.id,
          error: 'No text content to categorize'
        });
        continue;
      }

      const categories = await categorizeContent(text, options);
      
      results.push({
        contentId: content.id,
        title: content.title,
        categories,
        confidence: categories.length > 0 ? 0.8 : 0.3
      });

    } catch (error) {
      results.push({
        contentId: content.id,
        error: error.message
      });
    }
  }

  return results;
}

/**
 * Batch extract insights
 */
async function batchExtractInsights(contents, options) {
  const results = [];

  for (const content of contents) {
    try {
      const text = content.full_text || content.summary || '';
      if (!text.trim()) {
        results.push({
          contentId: content.id,
          error: 'No text content to analyze'
        });
        continue;
      }

      const insights = await extractInsights(text, options);
      
      results.push({
        contentId: content.id,
        title: content.title,
        insights,
        confidence: insights.length > 0 ? 0.8 : 0.3
      });

    } catch (error) {
      results.push({
        contentId: content.id,
        error: error.message
      });
    }
  }

  return results;
}

/**
 * Batch analyze academic content
 */
async function batchAnalyzeAcademic(contents, options) {
  const results = [];

  for (const content of contents) {
    try {
      const text = content.full_text || content.summary || '';
      if (!text.trim()) {
        results.push({
          contentId: content.id,
          error: 'No text content to analyze'
        });
        continue;
      }

      const analysis = await analyzeAcademicContent(text, options);
      
      results.push({
        contentId: content.id,
        title: content.title,
        ...analysis
      });

    } catch (error) {
      results.push({
        contentId: content.id,
        error: error.message
      });
    }
  }

  return results;
}

/**
 * Batch analyze news content
 */
async function batchAnalyzeNews(contents, options) {
  const results = [];

  for (const content of contents) {
    try {
      const text = content.full_text || content.summary || '';
      if (!text.trim()) {
        results.push({
          contentId: content.id,
          error: 'No text content to analyze'
        });
        continue;
      }

      const analysis = await analyzeNewsContent(text, options);
      
      results.push({
        contentId: content.id,
        title: content.title,
        ...analysis
      });

    } catch (error) {
      results.push({
        contentId: content.id,
        error: error.message
      });
    }
  }

  return results;
}

/**
 * Categorize content using AI or rule-based approach
 */
async function categorizeContent(text, options = {}) {
  try {
    // Try AI-based categorization first
    if (openai) {
      const aiCategories = await aiCategorizeContent(text, options);
      if (aiCategories && aiCategories.length > 0) {
        return aiCategories;
      }
    }

    // Fallback to rule-based categorization
    return ruleBasedCategorization(text);
  } catch (error) {
    console.error('Categorization failed:', error);
    return [];
  }
}

/**
 * AI-based content categorization
 */
async function aiCategorizeContent(text, options) {
  try {
    const categories = getDefaultCategories();
    const categoryList = Object.keys(categories).join(', ');

    const prompt = `Analyze the following text and categorize it into one or more of these categories: ${categoryList}

Return only the category names that best fit the content, separated by commas. If none fit well, return "Other".

Text to categorize:
${text.substring(0, 2000)}...

Categories:`;

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are an expert content categorizer. Analyze text and assign appropriate categories.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 100,
      temperature: 0.3
    });

    const result = response.choices[0]?.message?.content?.trim();
    if (result) {
      return result.split(',').map(cat => cat.trim()).filter(cat => cat && cat !== 'Other');
    }

    return [];
  } catch (error) {
    console.error('AI categorization failed:', error);
    return null;
  }
}

/**
 * Rule-based categorization fallback
 */
function ruleBasedCategorization(text) {
  const categories = getDefaultCategories();
  const matchedCategories = [];
  const lowerText = text.toLowerCase();

  for (const [category, keywords] of Object.entries(categories)) {
    const matches = keywords.filter(keyword => 
      lowerText.includes(keyword.toLowerCase())
    );
    
    if (matches.length >= 2) { // Require at least 2 keyword matches
      matchedCategories.push(category);
    }
  }

  return matchedCategories;
}

/**
 * Extract key insights from text
 */
async function extractInsights(text, options = {}) {
  try {
    // Try AI-based insight extraction first
    if (openai) {
      const aiInsights = await aiExtractInsights(text, options);
      if (aiInsights && aiInsights.length > 0) {
        return aiInsights;
      }
    }

    // Fallback to rule-based extraction
    return ruleBasedInsightExtraction(text);
  } catch (error) {
    console.error('Insight extraction failed:', error);
    return [];
  }
}

/**
 * AI-based insight extraction
 */
async function aiExtractInsights(text, options) {
  try {
    const prompt = `Extract 3-5 key insights from the following text. Each insight should be a concise, actionable statement that captures important information.

Format as a numbered list:

Text to analyze:
${text.substring(0, 3000)}...

Key Insights:`;

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at extracting key insights from technical and business content.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 300,
      temperature: 0.3
    });

    const result = response.choices[0]?.message?.content?.trim();
    if (result) {
      // Parse numbered list into array
      return result
        .split('\n')
        .filter(line => /^\d+\./.test(line.trim()))
        .map(line => line.replace(/^\d+\.\s*/, '').trim())
        .filter(insight => insight.length > 10);
    }

    return [];
  } catch (error) {
    console.error('AI insight extraction failed:', error);
    return null;
  }
}

/**
 * Rule-based insight extraction fallback
 */
function ruleBasedInsightExtraction(text) {
  const insights = [];
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
  
  // Look for sentences with insight indicators
  const insightIndicators = [
    'key finding', 'important', 'significant', 'shows that', 'reveals',
    'demonstrates', 'indicates', 'suggests', 'concludes', 'result'
  ];
  
  for (const sentence of sentences) {
    const lowerSentence = sentence.toLowerCase();
    if (insightIndicators.some(indicator => lowerSentence.includes(indicator))) {
      insights.push(sentence.trim());
      if (insights.length >= 5) break; // Limit to 5 insights
    }
  }
  
  return insights;
}

/**
 * Analyze academic content
 */
async function analyzeAcademicContent(text, options = {}) {
  const analysis = {
    isAcademicPaper: false,
    confidence: 0,
    sections: {},
    metadata: {}
  };

  // Check for academic indicators
  const academicIndicators = [
    'abstract', 'methodology', 'results', 'conclusion', 'references',
    'doi:', 'arxiv:', 'journal', 'conference', 'proceedings'
  ];

  const lowerText = text.toLowerCase();
  const indicatorMatches = academicIndicators.filter(indicator => 
    lowerText.includes(indicator)
  );

  analysis.confidence = Math.min(indicatorMatches.length / academicIndicators.length, 1.0);
  analysis.isAcademicPaper = analysis.confidence > 0.4;

  if (analysis.isAcademicPaper) {
    // Extract sections
    analysis.sections = extractAcademicSections(text);
    analysis.metadata = {
      hasAbstract: lowerText.includes('abstract'),
      hasMethodology: lowerText.includes('methodology') || lowerText.includes('methods'),
      hasResults: lowerText.includes('results'),
      hasConclusion: lowerText.includes('conclusion'),
      hasReferences: lowerText.includes('references') || lowerText.includes('bibliography')
    };
  }

  return analysis;
}

/**
 * Analyze news content
 */
async function analyzeNewsContent(text, options = {}) {
  const analysis = {
    isNewsArticle: false,
    confidence: 0,
    credibilityScore: 0.5,
    biasLevel: 'medium',
    factOpinionRatio: 0.5,
    metadata: {}
  };

  // Check for news indicators
  const newsIndicators = [
    'breaking', 'reported', 'according to', 'sources say', 'officials',
    'spokesperson', 'press release', 'statement', 'announced'
  ];

  const lowerText = text.toLowerCase();
  const indicatorMatches = newsIndicators.filter(indicator => 
    lowerText.includes(indicator)
  );

  analysis.confidence = Math.min(indicatorMatches.length / newsIndicators.length, 1.0);
  analysis.isNewsArticle = analysis.confidence > 0.3;

  if (analysis.isNewsArticle) {
    // Analyze fact vs opinion ratio
    analysis.factOpinionRatio = calculateFactOpinionRatio(text);
    
    // Estimate credibility based on language patterns
    analysis.credibilityScore = estimateCredibility(text);
    
    // Estimate bias level
    analysis.biasLevel = estimateBiasLevel(text);
    
    analysis.metadata = {
      hasQuotes: /["'].*?["']/.test(text),
      hasSources: lowerText.includes('source') || lowerText.includes('according to'),
      hasNumbers: /\d+/.test(text),
      wordCount: text.split(/\s+/).length
    };
  }

  return analysis;
}

/**
 * Extract academic sections from text
 */
function extractAcademicSections(text) {
  const sections = {};
  const sectionHeaders = ['abstract', 'introduction', 'methodology', 'methods', 'results', 'discussion', 'conclusion'];
  
  for (const header of sectionHeaders) {
    const regex = new RegExp(`\\b${header}\\b[\\s\\S]*?(?=\\b(?:${sectionHeaders.join('|')})\\b|$)`, 'i');
    const match = text.match(regex);
    if (match) {
      sections[header] = match[0].substring(0, 500) + '...'; // Truncate for storage
    }
  }
  
  return sections;
}

/**
 * Calculate fact vs opinion ratio
 */
function calculateFactOpinionRatio(text) {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
  let factCount = 0;
  let opinionCount = 0;
  
  const factIndicators = ['data shows', 'study found', 'research indicates', 'statistics', 'according to'];
  const opinionIndicators = ['believe', 'think', 'feel', 'opinion', 'should', 'must', 'probably'];
  
  for (const sentence of sentences) {
    const lowerSentence = sentence.toLowerCase();
    
    if (factIndicators.some(indicator => lowerSentence.includes(indicator))) {
      factCount++;
    } else if (opinionIndicators.some(indicator => lowerSentence.includes(indicator))) {
      opinionCount++;
    }
  }
  
  const total = factCount + opinionCount;
  return total > 0 ? factCount / total : 0.5;
}

/**
 * Estimate content credibility
 */
function estimateCredibility(text) {
  let score = 0.5; // Start with neutral
  const lowerText = text.toLowerCase();
  
  // Positive indicators
  if (lowerText.includes('study') || lowerText.includes('research')) score += 0.1;
  if (lowerText.includes('data') || lowerText.includes('statistics')) score += 0.1;
  if (lowerText.includes('expert') || lowerText.includes('professor')) score += 0.1;
  if (/\d+%/.test(text)) score += 0.1; // Contains percentages
  
  // Negative indicators
  if (lowerText.includes('rumor') || lowerText.includes('allegedly')) score -= 0.1;
  if (lowerText.includes('shocking') || lowerText.includes('unbelievable')) score -= 0.1;
  if (text.includes('!!!') || text.includes('???')) score -= 0.1;
  
  return Math.max(0, Math.min(1, score));
}

/**
 * Estimate bias level
 */
function estimateBiasLevel(text) {
  const lowerText = text.toLowerCase();
  let biasScore = 0;
  
  // Emotional language indicators
  const emotionalWords = ['outrageous', 'shocking', 'devastating', 'amazing', 'terrible', 'fantastic'];
  biasScore += emotionalWords.filter(word => lowerText.includes(word)).length * 0.1;
  
  // Absolute statements
  if (lowerText.includes('always') || lowerText.includes('never') || lowerText.includes('all')) {
    biasScore += 0.1;
  }
  
  if (biasScore < 0.3) return 'low';
  if (biasScore < 0.6) return 'medium';
  return 'high';
}

/**
 * Get default categories for content classification
 */
function getDefaultCategories() {
  return {
    'Technology': ['ai', 'artificial intelligence', 'machine learning', 'software', 'programming', 'tech', 'digital'],
    'Science': ['research', 'study', 'experiment', 'scientific', 'discovery', 'analysis', 'data'],
    'Business': ['market', 'company', 'revenue', 'profit', 'investment', 'startup', 'economy'],
    'Health': ['medical', 'health', 'disease', 'treatment', 'patient', 'doctor', 'medicine'],
    'Education': ['learning', 'student', 'university', 'school', 'education', 'teaching', 'academic'],
    'Politics': ['government', 'policy', 'election', 'political', 'law', 'regulation', 'congress'],
    'Environment': ['climate', 'environment', 'sustainability', 'green', 'renewable', 'carbon', 'pollution'],
    'Finance': ['financial', 'banking', 'investment', 'stock', 'cryptocurrency', 'money', 'trading']
  };
}