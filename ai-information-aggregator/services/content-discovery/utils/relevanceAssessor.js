const createLogger = require('../../../common/utils/logger');
const Content = require('../models/Content');
const natural = require('natural');

// Initialize logger
const logger = createLogger('relevance-assessor');

// Initialize natural language processing tools
const tokenizer = new natural.WordTokenizer();
const TfIdf = natural.TfIdf;
const stemmer = natural.PorterStemmer;

/**
 * Assess content relevance
 * @param {Object} content - Content document
 * @param {Object} options - Assessment options
 * @returns {Promise<Object>} - Assessment result
 */
async function assessContentRelevance(content, options = {}) {
  logger.info(`Assessing relevance for content: ${content._id}`);
  
  try {
    // Default options
    const defaultOptions = {
      userInterests: [],
      systemTopics: [],
      recentContentIds: [],
      popularContentIds: [],
      minScore: 0.1,
      maxScore: 1.0,
      weights: {
        textRelevance: 0.3,
        topicMatch: 0.2,
        recency: 0.15,
        popularity: 0.1,
        quality: 0.15,
        sourceRelevance: 0.1
      }
    };
    
    // Merge options
    const assessmentOptions = { ...defaultOptions, ...options };
    
    // Calculate individual relevance factors
    const textRelevance = await calculateTextRelevance(content, assessmentOptions);
    const topicMatch = calculateTopicMatch(content, assessmentOptions);
    const recency = calculateRecency(content);
    const popularity = calculatePopularity(content);
    const quality = calculateQuality(content);
    const sourceRelevance = await calculateSourceRelevance(content);
    
    // Calculate weighted score
    const relevanceScore = (
      textRelevance * assessmentOptions.weights.textRelevance +
      topicMatch * assessmentOptions.weights.topicMatch +
      recency * assessmentOptions.weights.recency +
      popularity * assessmentOptions.weights.popularity +
      quality * assessmentOptions.weights.quality +
      sourceRelevance * assessmentOptions.weights.sourceRelevance
    );
    
    // Clamp score to min/max range
    const clampedScore = Math.max(
      assessmentOptions.minScore,
      Math.min(assessmentOptions.maxScore, relevanceScore)
    );
    
    // Update content with new relevance score
    content.relevanceScore = clampedScore;
    await content.save();
    
    return {
      success: true,
      contentId: content._id,
      relevanceScore: clampedScore,
      factors: {
        textRelevance,
        topicMatch,
        recency,
        popularity,
        quality,
        sourceRelevance
      }
    };
  } catch (error) {
    logger.error(`Error assessing relevance for content ${content._id}: ${error.message}`, { error });
    
    return {
      success: false,
      contentId: content._id,
      error: error.message
    };
  }
}

/**
 * Calculate text relevance using TF-IDF
 * @param {Object} content - Content document
 * @param {Object} options - Assessment options
 * @returns {Promise<number>} - Text relevance score (0-1)
 */
async function calculateTextRelevance(content, options) {
  try {
    // Extract text from content
    const contentText = extractContentText(content);
    
    if (!contentText || contentText.length === 0) {
      return 0.5; // Default score for content without text
    }
    
    // Create TF-IDF model
    const tfidf = new TfIdf();
    
    // Add content text
    tfidf.addDocument(contentText);
    
    // Add user interests
    if (options.userInterests && options.userInterests.length > 0) {
      options.userInterests.forEach(interest => {
        tfidf.addDocument(interest);
      });
    }
    
    // Add system topics
    if (options.systemTopics && options.systemTopics.length > 0) {
      options.systemTopics.forEach(topic => {
        tfidf.addDocument(topic);
      });
    }
    
    // Calculate similarity between content and interests/topics
    let totalSimilarity = 0;
    let documentCount = 0;
    
    // Compare with user interests
    if (options.userInterests && options.userInterests.length > 0) {
      options.userInterests.forEach((interest, index) => {
        const similarity = calculateCosineSimilarity(tfidf, 0, index + 1);
        totalSimilarity += similarity;
        documentCount++;
      });
    }
    
    // Compare with system topics
    if (options.systemTopics && options.systemTopics.length > 0) {
      const startIndex = options.userInterests ? options.userInterests.length + 1 : 1;
      options.systemTopics.forEach((topic, index) => {
        const similarity = calculateCosineSimilarity(tfidf, 0, startIndex + index);
        totalSimilarity += similarity;
        documentCount++;
      });
    }
    
    // Calculate average similarity
    const averageSimilarity = documentCount > 0 ? totalSimilarity / documentCount : 0.5;
    
    return averageSimilarity;
  } catch (error) {
    logger.error(`Error calculating text relevance: ${error.message}`, { error });
    return 0.5; // Default score on error
  }
}

/**
 * Calculate topic match score
 * @param {Object} content - Content document
 * @param {Object} options - Assessment options
 * @returns {number} - Topic match score (0-1)
 */
function calculateTopicMatch(content, options) {
  try {
    if (!content.topics || content.topics.length === 0) {
      return 0.5; // Default score for content without topics
    }
    
    let matchCount = 0;
    let totalTopics = 0;
    
    // Check user interests
    if (options.userInterests && options.userInterests.length > 0) {
      options.userInterests.forEach(interest => {
        content.topics.forEach(topic => {
          if (isTopicMatch(topic, interest)) {
            matchCount++;
          }
        });
        totalTopics += content.topics.length;
      });
    }
    
    // Check system topics
    if (options.systemTopics && options.systemTopics.length > 0) {
      options.systemTopics.forEach(systemTopic => {
        content.topics.forEach(topic => {
          if (isTopicMatch(topic, systemTopic)) {
            matchCount++;
          }
        });
        totalTopics += content.topics.length;
      });
    }
    
    // Calculate match ratio
    const matchRatio = totalTopics > 0 ? matchCount / totalTopics : 0.5;
    
    return matchRatio;
  } catch (error) {
    logger.error(`Error calculating topic match: ${error.message}`, { error });
    return 0.5; // Default score on error
  }
}

/**
 * Calculate recency score
 * @param {Object} content - Content document
 * @returns {number} - Recency score (0-1)
 */
function calculateRecency(content) {
  try {
    if (!content.publishDate) {
      return 0.5; // Default score for content without publish date
    }
    
    const now = new Date();
    const publishDate = new Date(content.publishDate);
    const ageInDays = (now - publishDate) / (1000 * 60 * 60 * 24);
    
    // Exponential decay function for recency
    // Score = e^(-k * ageInDays) where k is decay rate
    const decayRate = 0.05; // Adjust as needed
    const recencyScore = Math.exp(-decayRate * ageInDays);
    
    return recencyScore;
  } catch (error) {
    logger.error(`Error calculating recency: ${error.message}`, { error });
    return 0.5; // Default score on error
  }
}

/**
 * Calculate popularity score
 * @param {Object} content - Content document
 * @returns {number} - Popularity score (0-1)
 */
function calculatePopularity(content) {
  try {
    // Use read count, save count, and share count as indicators of popularity
    const readCount = content.readCount || 0;
    const saveCount = content.saveCount || 0;
    const shareCount = content.shareCount || 0;
    
    // Calculate weighted popularity score
    // Shares are worth more than saves, which are worth more than reads
    const weightedScore = (readCount * 1 + saveCount * 3 + shareCount * 5) / 9;
    
    // Normalize score using logarithmic scale to handle varying magnitudes
    // Score = log(1 + weightedScore) / log(1 + maxExpectedScore)
    const maxExpectedScore = 100; // Adjust based on expected interaction levels
    const normalizedScore = Math.log(1 + weightedScore) / Math.log(1 + maxExpectedScore);
    
    return Math.min(1, normalizedScore);
  } catch (error) {
    logger.error(`Error calculating popularity: ${error.message}`, { error });
    return 0.5; // Default score on error
  }
}

/**
 * Calculate quality score
 * @param {Object} content - Content document
 * @returns {number} - Quality score (0-1)
 */
function calculateQuality(content) {
  try {
    // If content has quality factors, use them
    if (content.qualityScore !== undefined) {
      return content.qualityScore;
    }
    
    if (content.qualityFactors) {
      const factors = [
        content.qualityFactors.credibility || 0.5,
        content.qualityFactors.readability || 0.5,
        content.qualityFactors.originality || 0.5,
        content.qualityFactors.depth || 0.5
      ];
      
      // Calculate average quality score
      return factors.reduce((sum, factor) => sum + factor, 0) / factors.length;
    }
    
    // If no quality data, estimate based on content properties
    let qualityIndicators = 0;
    let totalIndicators = 0;
    
    // Check word count (longer content often has more depth)
    if (content.wordCount) {
      const wordCountScore = Math.min(1, content.wordCount / 1000);
      qualityIndicators += wordCountScore;
      totalIndicators++;
    }
    
    // Check if content has references (indicates credibility)
    if (content.references && content.references.length > 0) {
      const referenceScore = Math.min(1, content.references.length / 10);
      qualityIndicators += referenceScore;
      totalIndicators++;
    }
    
    // Check if content has visual elements (indicates better presentation)
    if (content.visualElements && content.visualElements.length > 0) {
      const visualScore = Math.min(1, content.visualElements.length / 5);
      qualityIndicators += visualScore;
      totalIndicators++;
    }
    
    // Calculate average quality score
    return totalIndicators > 0 ? qualityIndicators / totalIndicators : 0.5;
  } catch (error) {
    logger.error(`Error calculating quality: ${error.message}`, { error });
    return 0.5; // Default score on error
  }
}

/**
 * Calculate source relevance
 * @param {Object} content - Content document
 * @returns {Promise<number>} - Source relevance score (0-1)
 */
async function calculateSourceRelevance(content) {
  try {
    // If content has no source, return default score
    if (!content.sourceId) {
      return 0.5;
    }
    
    // Try to populate source if not already populated
    let source;
    if (typeof content.sourceId === 'object' && content.sourceId.relevanceScore !== undefined) {
      source = content.sourceId;
    } else {
      try {
        // This requires the Source model, which might be in a different service
        // In a real implementation, this might use a service call or shared database access
        const Source = require('../../source-management/models/Source');
        source = await Source.findById(content.sourceId);
      } catch (sourceError) {
        logger.warn(`Could not load source: ${sourceError.message}`);
        return 0.5;
      }
    }
    
    // If source was found, use its relevance score
    if (source && source.relevanceScore !== undefined) {
      return source.relevanceScore;
    }
    
    return 0.5; // Default score if source not found or has no relevance score
  } catch (error) {
    logger.error(`Error calculating source relevance: ${error.message}`, { error });
    return 0.5; // Default score on error
  }
}

/**
 * Filter content by relevance threshold
 * @param {Array} contents - Array of content documents
 * @param {number} threshold - Relevance threshold (0-1)
 * @returns {Array} - Filtered content documents
 */
function filterContentByRelevance(contents, threshold = 0.5) {
  try {
    return contents.filter(content => content.relevanceScore >= threshold);
  } catch (error) {
    logger.error(`Error filtering content by relevance: ${error.message}`, { error });
    return contents; // Return all content on error
  }
}

/**
 * Batch assess content relevance
 * @param {Array} contentIds - Array of content IDs
 * @param {Object} options - Assessment options
 * @returns {Promise<Object>} - Assessment results
 */
async function batchAssessContentRelevance(contentIds, options = {}) {
  logger.info(`Batch assessing relevance for ${contentIds.length} content items`);
  
  try {
    const results = {
      success: true,
      processed: 0,
      failed: 0,
      results: []
    };
    
    // Process content items in batches to avoid memory issues
    const batchSize = 50;
    for (let i = 0; i < contentIds.length; i += batchSize) {
      const batch = contentIds.slice(i, i + batchSize);
      
      // Get content documents
      const contents = await Content.find({ _id: { $in: batch } });
      
      // Process each content item
      for (const content of contents) {
        try {
          const result = await assessContentRelevance(content, options);
          results.results.push(result);
          
          if (result.success) {
            results.processed++;
          } else {
            results.failed++;
          }
        } catch (contentError) {
          logger.error(`Error assessing content ${content._id}: ${contentError.message}`, { error: contentError });
          results.failed++;
          results.results.push({
            success: false,
            contentId: content._id,
            error: contentError.message
          });
        }
      }
    }
    
    return results;
  } catch (error) {
    logger.error(`Error in batch assessment: ${error.message}`, { error });
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Extract text from content
 * @param {Object} content - Content document
 * @returns {string} - Extracted text
 */
function extractContentText(content) {
  // Combine various text fields with different weights
  const textParts = [];
  
  // Title is most important (3x weight)
  if (content.title) {
    textParts.push(content.title.repeat(3));
  }
  
  // Topics and categories are important (2x weight)
  if (content.topics && content.topics.length > 0) {
    textParts.push(content.topics.join(' ').repeat(2));
  }
  
  if (content.categories && content.categories.length > 0) {
    textParts.push(content.categories.join(' ').repeat(2));
  }
  
  // Summary is important
  if (content.summary) {
    textParts.push(content.summary);
  }
  
  // Key insights are important
  if (content.keyInsights && content.keyInsights.length > 0) {
    textParts.push(content.keyInsights.join(' '));
  }
  
  // Full text has normal weight
  if (content.fullText) {
    // For full text, we might want to limit the amount to avoid overwhelming other signals
    const maxFullTextLength = 5000;
    textParts.push(content.fullText.substring(0, maxFullTextLength));
  }
  
  // For papers, include abstract
  if (content.paperAbstract) {
    textParts.push(content.paperAbstract);
  }
  
  // For podcasts/videos, include transcript (limited)
  if (content.podcastTranscript || content.videoTranscript) {
    const transcript = content.podcastTranscript || content.videoTranscript;
    const maxTranscriptLength = 3000;
    textParts.push(transcript.substring(0, maxTranscriptLength));
  }
  
  return textParts.join(' ');
}

/**
 * Calculate cosine similarity between two documents in TF-IDF model
 * @param {Object} tfidf - TF-IDF model
 * @param {number} doc1Index - Index of first document
 * @param {number} doc2Index - Index of second document
 * @returns {number} - Cosine similarity (0-1)
 */
function calculateCosineSimilarity(tfidf, doc1Index, doc2Index) {
  try {
    // Get terms from both documents
    const terms = new Set();
    
    tfidf.listTerms(doc1Index).forEach(item => {
      terms.add(item.term);
    });
    
    tfidf.listTerms(doc2Index).forEach(item => {
      terms.add(item.term);
    });
    
    // Calculate vectors
    const vector1 = [];
    const vector2 = [];
    
    terms.forEach(term => {
      vector1.push(tfidf.tfidf(term, doc1Index));
      vector2.push(tfidf.tfidf(term, doc2Index));
    });
    
    // Calculate cosine similarity
    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;
    
    for (let i = 0; i < vector1.length; i++) {
      dotProduct += vector1[i] * vector2[i];
      magnitude1 += vector1[i] * vector1[i];
      magnitude2 += vector2[i] * vector2[i];
    }
    
    magnitude1 = Math.sqrt(magnitude1);
    magnitude2 = Math.sqrt(magnitude2);
    
    if (magnitude1 === 0 || magnitude2 === 0) {
      return 0;
    }
    
    return dotProduct / (magnitude1 * magnitude2);
  } catch (error) {
    logger.error(`Error calculating cosine similarity: ${error.message}`, { error });
    return 0;
  }
}

/**
 * Check if two topics match
 * @param {string} topic1 - First topic
 * @param {string} topic2 - Second topic
 * @returns {boolean} - Whether topics match
 */
function isTopicMatch(topic1, topic2) {
  // Normalize topics
  const normalizedTopic1 = topic1.toLowerCase().trim();
  const normalizedTopic2 = topic2.toLowerCase().trim();
  
  // Exact match
  if (normalizedTopic1 === normalizedTopic2) {
    return true;
  }
  
  // Stem words for fuzzy matching
  const stemmedTopic1 = stemmer.tokenizeAndStem(normalizedTopic1).join(' ');
  const stemmedTopic2 = stemmer.tokenizeAndStem(normalizedTopic2).join(' ');
  
  if (stemmedTopic1 === stemmedTopic2) {
    return true;
  }
  
  // Check if one contains the other
  if (normalizedTopic1.includes(normalizedTopic2) || normalizedTopic2.includes(normalizedTopic1)) {
    return true;
  }
  
  // Check for high similarity using Levenshtein distance for short topics
  if (normalizedTopic1.length < 20 && normalizedTopic2.length < 20) {
    const distance = natural.LevenshteinDistance(normalizedTopic1, normalizedTopic2);
    const maxLength = Math.max(normalizedTopic1.length, normalizedTopic2.length);
    const similarity = 1 - (distance / maxLength);
    
    if (similarity > 0.8) {
      return true;
    }
  }
  
  return false;
}

module.exports = {
  assessContentRelevance,
  batchAssessContentRelevance,
  filterContentByRelevance,
  calculateTextRelevance,
  calculateTopicMatch,
  calculateRecency,
  calculatePopularity,
  calculateQuality,
  calculateSourceRelevance
};