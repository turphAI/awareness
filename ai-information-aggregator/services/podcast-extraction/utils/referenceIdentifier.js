const createLogger = require('../../../common/utils/logger');
const Transcript = require('../models/Transcript');
const Reference = require('../../content-discovery/models/Reference');
const Episode = require('../models/Episode');
const Content = require('../../content-discovery/models/Content');
const timestampLinker = require('./timestampLinker');
const natural = require('natural');
const { WordTokenizer, SentenceTokenizer } = natural;

// Initialize logger
const logger = createLogger('reference-identifier');

// Initialize tokenizers
const wordTokenizer = new WordTokenizer();
const sentenceTokenizer = new SentenceTokenizer();

// Common academic paper titles words
const academicKeywords = [
  'study', 'research', 'analysis', 'framework', 'approach', 'method', 'model',
  'system', 'algorithm', 'theory', 'evaluation', 'assessment', 'review',
  'survey', 'overview', 'introduction', 'exploration', 'investigation',
  'experiment', 'implementation', 'design', 'development', 'application'
];

// Common reference phrases
const referencePatterns = [
  /according to ([^,.]+)/i,
  /([^,.]+) reported/i,
  /([^,.]+) states/i,
  /([^,.]+) claims/i,
  /([^,.]+) suggests/i,
  /([^,.]+) found/i,
  /study by ([^,.]+)/i,
  /research by ([^,.]+)/i,
  /([^,.]+)'s research/i,
  /([^,.]+)'s study/i,
  /([^,.]+)'s paper/i,
  /paper by ([^,.]+)/i,
  /article by ([^,.]+)/i,
  /published by ([^,.]+)/i,
  /published in ([^,.]+)/i,
  /presented by ([^,.]+)/i,
  /presented at ([^,.]+)/i,
  /mentioned in ([^,.]+)/i,
  /cited in ([^,.]+)/i,
  /referenced in ([^,.]+)/i,
  /available at ([^,.]+)/i,
  /check out ([^,.]+)/i,
  /link to ([^,.]+)/i,
  /link in ([^,.]+)/i,
  /go to ([^,.]+)/i,
  /visit ([^,.]+)/i
];

// URL regex pattern
const urlPattern = /(https?:\/\/[^\s]+)/g;

/**
 * Process transcript to identify references
 * @param {string|Object} transcriptIdOrObj - Transcript ID or object
 * @returns {Promise<Object>} - Processing result
 */
async function processTranscript(transcriptIdOrObj) {
  try {
    // Get transcript
    const transcript = typeof transcriptIdOrObj === 'string' 
      ? await Transcript.findById(transcriptIdOrObj).populate('episodeId')
      : transcriptIdOrObj;
    
    if (!transcript) {
      logger.warn(`Transcript not found: ${transcriptIdOrObj}`);
      return { success: false, error: 'Transcript not found' };
    }

    logger.info(`Processing transcript for episode: ${transcript.episodeId._id}`);
    
    // Extract references
    const startTime = Date.now();
    const extractedReferences = await extractReferencesFromTranscript(transcript);
    const duration = Date.now() - startTime;
    
    // Save references to database
    const savedReferences = await saveReferences(transcript, extractedReferences);
    
    // Link timestamps for saved references
    if (savedReferences.length > 0) {
      try {
        await timestampLinker.batchLinkTimestamps(transcript.episodeId._id, {
          skipLinked: true
        });
        logger.info(`Linked timestamps for references in episode ${transcript.episodeId._id}`);
      } catch (linkError) {
        logger.error(`Error linking timestamps: ${linkError.message}`, { error: linkError });
      }
    }
    
    // Update transcript processing history
    await transcript.markAsProcessed({
      stage: 'reference-extraction',
      duration,
      success: true,
      metadata: {
        extractedCount: extractedReferences.length,
        savedCount: savedReferences.length
      }
    });
    
    logger.info(`Processed transcript ${transcript._id}, found ${savedReferences.length} references`);
    
    return {
      success: true,
      transcriptId: transcript._id,
      episodeId: transcript.episodeId._id,
      extractedCount: extractedReferences.length,
      savedCount: savedReferences.length,
      references: savedReferences
    };
  } catch (error) {
    logger.error(`Error processing transcript: ${error.message}`, { error });
    
    // Try to update transcript processing history with error
    if (typeof transcriptIdOrObj === 'object' && transcriptIdOrObj._id) {
      try {
        await transcriptIdOrObj.markAsProcessed({
          stage: 'reference-extraction',
          success: false,
          error: error.message
        });
      } catch (updateError) {
        logger.error(`Failed to update transcript processing history: ${updateError.message}`);
      }
    }
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Extract references from transcript
 * @param {Object} transcript - Transcript object
 * @returns {Promise<Array>} - Array of extracted references
 */
async function extractReferencesFromTranscript(transcript) {
  const references = [];
  
  try {
    // Get full text and segments
    const { fullText, segments } = transcript;
    
    if (!fullText || fullText.trim() === '') {
      logger.warn(`Transcript ${transcript._id} has no text content`);
      return references;
    }
    
    // Extract URLs
    const urlReferences = extractUrlReferences(fullText, segments);
    references.push(...urlReferences);
    
    // Extract entity references
    const entityReferences = extractEntityReferences(fullText, segments);
    references.push(...entityReferences);
    
    // Extract academic paper references
    const paperReferences = extractPaperReferences(fullText, segments);
    references.push(...paperReferences);
    
    // Extract pattern-based references
    const patternReferences = extractPatternReferences(fullText, segments);
    references.push(...patternReferences);
    
    return references;
  } catch (error) {
    logger.error(`Error extracting references from transcript: ${error.message}`, { error });
    return references;
  }
}

/**
 * Extract URL references from text
 * @param {string} text - Full transcript text
 * @param {Array} segments - Transcript segments
 * @returns {Array} - Array of URL references
 */
function extractUrlReferences(text, segments) {
  const references = [];
  
  try {
    // Find all URLs in text
    const urlMatches = text.match(urlPattern);
    
    if (!urlMatches) {
      return references;
    }
    
    // Process each URL
    for (const url of urlMatches) {
      // Find segment containing this URL
      const segment = findSegmentContainingText(segments, url);
      
      // Create reference object
      references.push({
        referenceType: 'link',
        url: url,
        context: extractContext(text, url),
        contextLocation: segment ? {
          value: segment.startTime.toString(),
          type: 'timestamp'
        } : {
          value: '0',
          type: 'timestamp'
        },
        confidence: 0.95,
        extractionMethod: 'automatic'
      });
    }
  } catch (error) {
    logger.error(`Error extracting URL references: ${error.message}`, { error });
  }
  
  return references;
}

/**
 * Extract entity references from text
 * @param {string} text - Full transcript text
 * @param {Array} segments - Transcript segments
 * @returns {Array} - Array of entity references
 */
function extractEntityReferences(text, segments) {
  const references = [];
  
  try {
    // Split text into sentences
    const sentences = sentenceTokenizer.tokenize(text);
    
    // Process each sentence
    for (const sentence of sentences) {
      // Skip short sentences
      if (sentence.length < 10) {
        continue;
      }
      
      // Extract potential named entities
      const entities = extractNamedEntities(sentence);
      
      // Process each entity
      for (const entity of entities) {
        // Skip common words and short entities
        if (isCommonWord(entity) || entity.length < 4) {
          continue;
        }
        
        // Find segment containing this entity
        const segment = findSegmentContainingText(segments, entity);
        
        // Create reference object
        references.push({
          referenceType: 'mention',
          title: entity,
          context: sentence,
          contextLocation: segment ? {
            value: segment.startTime.toString(),
            type: 'timestamp'
          } : {
            value: '0',
            type: 'timestamp'
          },
          confidence: 0.7,
          extractionMethod: 'automatic'
        });
      }
    }
  } catch (error) {
    logger.error(`Error extracting entity references: ${error.message}`, { error });
  }
  
  return references;
}

/**
 * Extract academic paper references from text
 * @param {string} text - Full transcript text
 * @param {Array} segments - Transcript segments
 * @returns {Array} - Array of paper references
 */
function extractPaperReferences(text, segments) {
  const references = [];
  
  try {
    // Split text into sentences
    const sentences = sentenceTokenizer.tokenize(text);
    
    // Process each sentence
    for (const sentence of sentences) {
      // Skip short sentences
      if (sentence.length < 20) {
        continue;
      }
      
      // Check if sentence contains academic keywords
      if (!containsAcademicKeywords(sentence)) {
        continue;
      }
      
      // Extract potential paper titles
      const paperTitles = extractPotentialPaperTitles(sentence);
      
      // Process each paper title
      for (const title of paperTitles) {
        // Skip short titles
        if (title.length < 10) {
          continue;
        }
        
        // Find segment containing this title
        const segment = findSegmentContainingText(segments, title);
        
        // Create reference object
        references.push({
          referenceType: 'citation',
          title: title,
          context: sentence,
          contextLocation: segment ? {
            value: segment.startTime.toString(),
            type: 'timestamp'
          } : {
            value: '0',
            type: 'timestamp'
          },
          confidence: 0.6,
          extractionMethod: 'automatic'
        });
      }
    }
  } catch (error) {
    logger.error(`Error extracting paper references: ${error.message}`, { error });
  }
  
  return references;
}

/**
 * Extract pattern-based references from text
 * @param {string} text - Full transcript text
 * @param {Array} segments - Transcript segments
 * @returns {Array} - Array of pattern references
 */
function extractPatternReferences(text, segments) {
  const references = [];
  
  try {
    // Process each reference pattern
    for (const pattern of referencePatterns) {
      const matches = [...text.matchAll(pattern)];
      
      // Process each match
      for (const match of matches) {
        const entity = match[1].trim();
        
        // Skip common words and short entities
        if (isCommonWord(entity) || entity.length < 4) {
          continue;
        }
        
        // Find segment containing this match
        const segment = findSegmentContainingText(segments, match[0]);
        
        // Create reference object
        references.push({
          referenceType: 'mention',
          title: entity,
          context: extractContext(text, match[0]),
          contextLocation: segment ? {
            value: segment.startTime.toString(),
            type: 'timestamp'
          } : {
            value: '0',
            type: 'timestamp'
          },
          confidence: 0.8,
          extractionMethod: 'automatic'
        });
      }
    }
  } catch (error) {
    logger.error(`Error extracting pattern references: ${error.message}`, { error });
  }
  
  return references;
}

/**
 * Extract named entities from text
 * @param {string} text - Text to extract entities from
 * @returns {Array} - Array of entities
 */
function extractNamedEntities(text) {
  const entities = [];
  
  try {
    // Simple heuristic: look for capitalized word sequences
    const words = text.split(/\s+/);
    let currentEntity = [];
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i].replace(/[,.;:!?()[\]{}'"]/g, '');
      
      // Skip empty words
      if (!word) {
        continue;
      }
      
      // Check if word starts with capital letter
      if (/^[A-Z]/.test(word)) {
        currentEntity.push(word);
      } else {
        // End of entity
        if (currentEntity.length > 0) {
          entities.push(currentEntity.join(' '));
          currentEntity = [];
        }
      }
    }
    
    // Add last entity if any
    if (currentEntity.length > 0) {
      entities.push(currentEntity.join(' '));
    }
  } catch (error) {
    logger.error(`Error extracting named entities: ${error.message}`, { error });
  }
  
  return entities;
}

/**
 * Check if text contains academic keywords
 * @param {string} text - Text to check
 * @returns {boolean} - Whether text contains academic keywords
 */
function containsAcademicKeywords(text) {
  const lowerText = text.toLowerCase();
  return academicKeywords.some(keyword => lowerText.includes(keyword));
}

/**
 * Extract potential paper titles from text
 * @param {string} text - Text to extract titles from
 * @returns {Array} - Array of potential paper titles
 */
function extractPotentialPaperTitles(text) {
  const titles = [];
  
  try {
    // Look for quoted text
    const quoteMatches = text.match(/"([^"]+)"/g);
    
    if (quoteMatches) {
      for (const match of quoteMatches) {
        // Remove quotes
        const title = match.substring(1, match.length - 1).trim();
        
        // Check if title contains academic keywords
        if (containsAcademicKeywords(title)) {
          titles.push(title);
        }
      }
    }
    
    // Look for text between "titled" and punctuation
    const titledMatches = text.match(/titled\s+([^,.;:!?]+)/i);
    
    if (titledMatches && titledMatches[1]) {
      titles.push(titledMatches[1].trim());
    }
    
    // Look for text between "called" and punctuation
    const calledMatches = text.match(/called\s+([^,.;:!?]+)/i);
    
    if (calledMatches && calledMatches[1]) {
      titles.push(calledMatches[1].trim());
    }
    
    // Look for text between "paper" and "by"
    const paperByMatches = text.match(/paper\s+([^,.;:!?]+)\s+by/i);
    
    if (paperByMatches && paperByMatches[1]) {
      titles.push(paperByMatches[1].trim());
    }
  } catch (error) {
    logger.error(`Error extracting potential paper titles: ${error.message}`, { error });
  }
  
  return titles;
}

/**
 * Find segment containing text
 * @param {Array} segments - Transcript segments
 * @param {string} text - Text to find
 * @returns {Object|null} - Segment containing text or null
 */
function findSegmentContainingText(segments, text) {
  if (!segments || segments.length === 0) {
    return null;
  }
  
  for (const segment of segments) {
    if (segment.text && segment.text.includes(text)) {
      return segment;
    }
  }
  
  return null;
}

/**
 * Extract context around text
 * @param {string} fullText - Full text
 * @param {string} text - Text to extract context for
 * @returns {string} - Context
 */
function extractContext(fullText, text) {
  try {
    const index = fullText.indexOf(text);
    
    if (index === -1) {
      return '';
    }
    
    // Get 100 characters before and after the text
    const start = Math.max(0, index - 100);
    const end = Math.min(fullText.length, index + text.length + 100);
    
    return fullText.substring(start, end);
  } catch (error) {
    logger.error(`Error extracting context: ${error.message}`, { error });
    return '';
  }
}

/**
 * Check if word is common
 * @param {string} word - Word to check
 * @returns {boolean} - Whether word is common
 */
function isCommonWord(word) {
  const commonWords = [
    'the', 'and', 'that', 'this', 'with', 'for', 'from', 'about',
    'have', 'has', 'had', 'was', 'were', 'are', 'been', 'being',
    'they', 'them', 'their', 'there', 'these', 'those', 'some',
    'what', 'when', 'where', 'which', 'who', 'whom', 'whose',
    'how', 'why', 'because', 'although', 'though', 'since',
    'while', 'during', 'after', 'before', 'until', 'unless',
    'also', 'however', 'therefore', 'thus', 'hence', 'then',
    'just', 'very', 'really', 'quite', 'rather', 'somewhat'
  ];
  
  return commonWords.includes(word.toLowerCase());
}

/**
 * Save references to database
 * @param {Object} transcript - Transcript object
 * @param {Array} extractedReferences - Array of extracted references
 * @returns {Promise<Array>} - Array of saved references
 */
async function saveReferences(transcript, extractedReferences) {
  const savedReferences = [];
  
  try {
    // Get episode content ID
    const episode = await Episode.findById(transcript.episodeId);
    
    if (!episode || !episode.contentId) {
      logger.warn(`Episode ${transcript.episodeId} has no content ID`);
      return savedReferences;
    }
    
    // Process each reference
    for (const ref of extractedReferences) {
      try {
        // Create reference document
        const reference = new Reference({
          sourceContentId: episode.contentId,
          ...ref
        });
        
        // Save reference
        const savedRef = await reference.save();
        savedReferences.push(savedRef);
        
        // Add reference to transcript
        transcript.references.push(savedRef._id);
      } catch (refError) {
        logger.error(`Error saving reference: ${refError.message}`, { error: refError });
      }
    }
    
    // Save transcript with references
    await transcript.save();
  } catch (error) {
    logger.error(`Error saving references: ${error.message}`, { error });
  }
  
  return savedReferences;
}

/**
 * Process unprocessed transcripts
 * @param {number} limit - Maximum number of transcripts to process
 * @returns {Promise<Object>} - Processing result
 */
async function processUnprocessedTranscripts(limit = 10) {
  try {
    // Find unprocessed transcripts
    const transcripts = await Transcript.findUnprocessed(limit)
      .populate('episodeId');
    
    logger.info(`Found ${transcripts.length} unprocessed transcripts`);
    
    // Process each transcript
    const results = [];
    for (const transcript of transcripts) {
      try {
        const result = await processTranscript(transcript);
        results.push(result);
      } catch (error) {
        logger.error(`Error processing transcript ${transcript._id}: ${error.message}`, { error });
        results.push({
          success: false,
          transcriptId: transcript._id,
          error: error.message
        });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    
    return {
      success: true,
      total: transcripts.length,
      processed: successCount,
      failed: transcripts.length - successCount,
      results
    };
  } catch (error) {
    logger.error(`Error processing unprocessed transcripts: ${error.message}`, { error });
    
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  processTranscript,
  processUnprocessedTranscripts,
  extractReferencesFromTranscript,
  extractUrlReferences,
  extractEntityReferences,
  extractPaperReferences,
  extractPatternReferences
};