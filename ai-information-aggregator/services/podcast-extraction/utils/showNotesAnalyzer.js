/**
 * Show Notes Analyzer Utility
 * 
 * Responsible for parsing podcast show notes and cross-referencing them
 * with extracted references from transcripts.
 */

const logger = require('../../../common/utils/logger');
const Reference = require('../../content-discovery/models/Reference');
const Episode = require('../models/Episode');

class ShowNotesAnalyzer {
  /**
   * Parse show notes to extract references
   * @param {string} showNotes - The show notes text
   * @returns {Array} - Array of extracted references
   */
  parseShowNotes(showNotes) {
    try {
      if (!showNotes || typeof showNotes !== 'string') {
        return [];
      }

      const references = [];
      
      // Extract URLs
      const urlReferences = this._extractUrls(showNotes);
      references.push(...urlReferences);
      
      // Extract structured references (papers, articles, etc.)
      const structuredReferences = this._extractStructuredReferences(showNotes);
      references.push(...structuredReferences);
      
      // Extract mentions and citations
      const mentionReferences = this._extractMentions(showNotes);
      references.push(...mentionReferences);
      
      logger.info(`Extracted ${references.length} references from show notes`);
      
      return references;
    } catch (error) {
      logger.error(`Error parsing show notes: ${error.message}`, { error });
      return [];
    }
  }
  
  /**
   * Cross-reference show notes references with transcript references
   * @param {string} episodeId - The episode ID
   * @param {Array} showNotesReferences - References extracted from show notes
   * @returns {Promise<Object>} - Cross-reference results
   */
  async crossReferenceWithTranscript(episodeId, showNotesReferences) {
    try {
      logger.info(`Cross-referencing show notes with transcript for episode ${episodeId}`);
      
      // Get existing references from transcript
      const transcriptReferences = await Reference.find({ 
        sourceContentId: episodeId 
      });
      
      const results = {
        matched: [],
        newFromShowNotes: [],
        transcriptOnly: [],
        summary: {
          totalTranscriptReferences: transcriptReferences.length,
          totalShowNotesReferences: showNotesReferences.length,
          matchedReferences: 0,
          newReferences: 0,
          transcriptOnlyReferences: 0
        }
      };
      
      // Find matches between show notes and transcript references
      for (const showNotesRef of showNotesReferences) {
        const match = this._findMatchingReference(showNotesRef, transcriptReferences);
        
        if (match) {
          results.matched.push({
            showNotesReference: showNotesRef,
            transcriptReference: match,
            matchType: match.matchType,
            confidence: match.confidence
          });
          results.summary.matchedReferences++;
        } else {
          results.newFromShowNotes.push(showNotesRef);
          results.summary.newReferences++;
        }
      }
      
      // Find transcript references that don't have show notes matches
      for (const transcriptRef of transcriptReferences) {
        const hasMatch = results.matched.some(m => 
          m.transcriptReference.reference._id.toString() === transcriptRef._id.toString()
        );
        
        if (!hasMatch) {
          results.transcriptOnly.push(transcriptRef);
          results.summary.transcriptOnlyReferences++;
        }
      }
      
      logger.info(`Cross-reference completed: ${results.summary.matchedReferences} matched, ${results.summary.newReferences} new from show notes`);
      
      return results;
    } catch (error) {
      logger.error(`Error cross-referencing show notes: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Analyze show notes for an episode
   * @param {string} episodeId - The episode ID
   * @returns {Promise<Object>} - Analysis results
   */
  async analyzeEpisodeShowNotes(episodeId) {
    try {
      logger.info(`Analyzing show notes for episode ${episodeId}`);
      
      const episode = await Episode.findById(episodeId);
      if (!episode) {
        throw new Error(`Episode ${episodeId} not found`);
      }
      
      if (!episode.showNotes) {
        return {
          success: false,
          message: 'Episode has no show notes',
          hasShowNotes: false
        };
      }
      
      // Parse show notes
      const showNotesReferences = this.parseShowNotes(episode.showNotes);
      
      // Cross-reference with transcript
      const crossReferenceResults = await this.crossReferenceWithTranscript(
        episodeId, 
        showNotesReferences
      );
      
      // Save new references found in show notes
      const savedNewReferences = [];
      for (const newRef of crossReferenceResults.newFromShowNotes) {
        try {
          const reference = new Reference({
            sourceContentId: episodeId,
            referenceType: newRef.type,
            title: newRef.title,
            url: newRef.url,
            authors: newRef.authors,
            context: newRef.context,
            extractionMethod: 'automatic',
            metadata: {
              ...newRef.metadata,
              extractedFrom: 'show_notes'
            }
          });
          
          await reference.save();
          savedNewReferences.push(reference);
        } catch (error) {
          logger.error(`Error saving show notes reference: ${error.message}`);
        }
      }
      
      // Update matched references with show notes information
      const updatedReferences = [];
      for (const match of crossReferenceResults.matched) {
        try {
          const transcriptRef = match.transcriptReference.reference;
          
          // Enhance transcript reference with show notes data
          const updates = {
            'metadata.showNotesMatch': true,
            'metadata.showNotesConfidence': match.confidence,
            'metadata.showNotesMatchType': match.matchType
          };
          
          // Add additional information from show notes if available
          if (match.showNotesReference.url && !transcriptRef.url) {
            updates.url = match.showNotesReference.url;
          }
          
          if (match.showNotesReference.authors && match.showNotesReference.authors.length > 0) {
            updates.authors = match.showNotesReference.authors;
          }
          
          const updatedRef = await Reference.findByIdAndUpdate(
            transcriptRef._id,
            { $set: updates },
            { new: true }
          );
          
          updatedReferences.push(updatedRef);
        } catch (error) {
          logger.error(`Error updating matched reference: ${error.message}`);
        }
      }
      
      return {
        success: true,
        hasShowNotes: true,
        showNotesLength: episode.showNotes.length,
        extractedReferences: showNotesReferences,
        crossReference: crossReferenceResults,
        savedNewReferences,
        updatedReferences,
        summary: {
          ...crossReferenceResults.summary,
          newReferencesSaved: savedNewReferences.length,
          referencesUpdated: updatedReferences.length
        }
      };
    } catch (error) {
      logger.error(`Error analyzing episode show notes: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Extract URLs from show notes
   * @param {string} showNotes - The show notes text
   * @returns {Array} - Array of URL references
   * @private
   */
  _extractUrls(showNotes) {
    const urlPattern = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/gi;
    const urls = showNotes.match(urlPattern) || [];
    
    return urls.map(url => {
      // Clean up URL (remove trailing punctuation)
      const cleanUrl = url.replace(/[.,;:!?)\]}]+$/, '');
      
      // Try to extract context around the URL
      const urlIndex = showNotes.indexOf(url);
      const contextStart = Math.max(0, urlIndex - 100);
      const contextEnd = Math.min(showNotes.length, urlIndex + url.length + 100);
      const context = showNotes.substring(contextStart, contextEnd).trim();
      
      return {
        type: 'link',
        url: cleanUrl,
        title: this._extractTitleFromContext(context, url),
        context: context,
        metadata: {
          extractedFrom: 'show_notes',
          originalUrl: url
        }
      };
    });
  }
  
  /**
   * Extract structured references (papers, articles, etc.)
   * @param {string} showNotes - The show notes text
   * @returns {Array} - Array of structured references
   * @private
   */
  _extractStructuredReferences(showNotes) {
    const references = [];
    
    // Pattern for paper/article titles in quotes
    const quotedTitlePattern = /"([^"]{10,200})"/g;
    let match;
    
    while ((match = quotedTitlePattern.exec(showNotes)) !== null) {
      const title = match[1];
      
      // Skip if it looks like a quote rather than a title
      if (this._looksLikeTitle(title)) {
        const context = this._extractContextAroundMatch(showNotes, match.index, match[0].length);
        const authors = this._extractAuthorsFromContext(context);
        
        references.push({
          type: 'citation',
          title: title,
          authors: authors,
          context: context,
          metadata: {
            extractedFrom: 'show_notes',
            extractionMethod: 'quoted_title'
          }
        });
      }
    }
    
    // Pattern for "Paper by Author" or "Study by Author"
    const authorPattern = /(paper|study|article|research)\s+by\s+([^.,\n]{3,50})/gi;
    
    while ((match = authorPattern.exec(showNotes)) !== null) {
      const type = match[1].toLowerCase();
      const author = match[2].trim();
      const context = this._extractContextAroundMatch(showNotes, match.index, match[0].length);
      
      references.push({
        type: 'mention',
        title: `${type.charAt(0).toUpperCase() + type.slice(1)} by ${author}`,
        authors: [author],
        context: context,
        metadata: {
          extractedFrom: 'show_notes',
          extractionMethod: 'author_pattern'
        }
      });
    }
    
    return references;
  }
  
  /**
   * Extract mentions and citations
   * @param {string} showNotes - The show notes text
   * @returns {Array} - Array of mention references
   * @private
   */
  _extractMentions(showNotes) {
    const references = [];
    
    // Pattern for DOI mentions
    const doiPattern = /doi:\s*([^\s,\n]+)/gi;
    let match;
    
    while ((match = doiPattern.exec(showNotes)) !== null) {
      const doi = match[1];
      const context = this._extractContextAroundMatch(showNotes, match.index, match[0].length);
      
      references.push({
        type: 'citation',
        title: `DOI: ${doi}`,
        url: `https://doi.org/${doi}`,
        context: context,
        metadata: {
          extractedFrom: 'show_notes',
          doi: doi,
          extractionMethod: 'doi_pattern'
        }
      });
    }
    
    // Pattern for arXiv mentions
    const arxivPattern = /arxiv:\s*([^\s,\n]+)/gi;
    
    while ((match = arxivPattern.exec(showNotes)) !== null) {
      const arxivId = match[1];
      const context = this._extractContextAroundMatch(showNotes, match.index, match[0].length);
      
      references.push({
        type: 'citation',
        title: `arXiv: ${arxivId}`,
        url: `https://arxiv.org/abs/${arxivId}`,
        context: context,
        metadata: {
          extractedFrom: 'show_notes',
          arxivId: arxivId,
          extractionMethod: 'arxiv_pattern'
        }
      });
    }
    
    return references;
  }
  
  /**
   * Find matching reference between show notes and transcript
   * @param {Object} showNotesRef - Reference from show notes
   * @param {Array} transcriptRefs - References from transcript
   * @returns {Object|null} - Matching reference or null
   * @private
   */
  _findMatchingReference(showNotesRef, transcriptRefs) {
    let bestMatch = null;
    let bestScore = 0;
    
    for (const transcriptRef of transcriptRefs) {
      const score = this._calculateSimilarityScore(showNotesRef, transcriptRef);
      
      if (score > bestScore && score > 0.6) { // Minimum threshold for match
        bestMatch = {
          reference: transcriptRef,
          confidence: score,
          matchType: this._determineMatchType(showNotesRef, transcriptRef, score)
        };
        bestScore = score;
      }
    }
    
    return bestMatch;
  }
  
  /**
   * Calculate similarity score between two references
   * @param {Object} ref1 - First reference
   * @param {Object} ref2 - Second reference
   * @returns {number} - Similarity score (0-1)
   * @private
   */
  _calculateSimilarityScore(ref1, ref2) {
    let score = 0;
    let factors = 0;
    
    // URL match (highest weight)
    if (ref1.url && ref2.url) {
      factors++;
      if (ref1.url === ref2.url) {
        score += 0.5;
      } else if (this._urlsAreSimilar(ref1.url, ref2.url)) {
        score += 0.3;
      }
    }
    
    // Title similarity
    if (ref1.title && ref2.title) {
      factors++;
      const titleSimilarity = this._calculateTextSimilarity(ref1.title, ref2.title);
      score += titleSimilarity * 0.3;
    }
    
    // Author similarity
    if (ref1.authors && ref2.authors && ref1.authors.length > 0 && ref2.authors.length > 0) {
      factors++;
      const authorSimilarity = this._calculateAuthorSimilarity(ref1.authors, ref2.authors);
      score += authorSimilarity * 0.2;
    }
    
    // Context similarity (lower weight)
    if (ref1.context && ref2.context) {
      factors++;
      const contextSimilarity = this._calculateTextSimilarity(ref1.context, ref2.context);
      score += contextSimilarity * 0.1;
    }
    
    return factors > 0 ? score / factors : 0;
  }
  
  /**
   * Calculate text similarity using simple word overlap
   * @param {string} text1 - First text
   * @param {string} text2 - Second text
   * @returns {number} - Similarity score (0-1)
   * @private
   */
  _calculateTextSimilarity(text1, text2) {
    if (!text1 || !text2) return 0;
    
    const words1 = text1.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const words2 = text2.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    
    if (words1.length === 0 || words2.length === 0) return 0;
    
    const intersection = words1.filter(word => words2.includes(word));
    const union = [...new Set([...words1, ...words2])];
    
    return intersection.length / union.length;
  }
  
  /**
   * Calculate author similarity
   * @param {Array} authors1 - First author list
   * @param {Array} authors2 - Second author list
   * @returns {number} - Similarity score (0-1)
   * @private
   */
  _calculateAuthorSimilarity(authors1, authors2) {
    if (!authors1 || !authors2 || authors1.length === 0 || authors2.length === 0) {
      return 0;
    }
    
    let matches = 0;
    
    for (const author1 of authors1) {
      for (const author2 of authors2) {
        if (this._authorsAreSimilar(author1, author2)) {
          matches++;
          break;
        }
      }
    }
    
    return matches / Math.max(authors1.length, authors2.length);
  }
  
  /**
   * Check if two authors are similar
   * @param {string} author1 - First author
   * @param {string} author2 - Second author
   * @returns {boolean} - Whether authors are similar
   * @private
   */
  _authorsAreSimilar(author1, author2) {
    if (!author1 || !author2) return false;
    
    const name1 = author1.toLowerCase().trim();
    const name2 = author2.toLowerCase().trim();
    
    // Exact match
    if (name1 === name2) return true;
    
    // Check if one contains the other (for cases like "Smith" vs "John Smith")
    if (name1.includes(name2) || name2.includes(name1)) return true;
    
    // Check last name similarity
    const lastName1 = name1.split(' ').pop();
    const lastName2 = name2.split(' ').pop();
    
    return lastName1 === lastName2 && lastName1.length > 2;
  }
  
  /**
   * Check if URLs are similar
   * @param {string} url1 - First URL
   * @param {string} url2 - Second URL
   * @returns {boolean} - Whether URLs are similar
   * @private
   */
  _urlsAreSimilar(url1, url2) {
    if (!url1 || !url2) return false;
    
    // Remove protocol and www
    const clean1 = url1.replace(/^https?:\/\/(www\.)?/, '').toLowerCase();
    const clean2 = url2.replace(/^https?:\/\/(www\.)?/, '').toLowerCase();
    
    return clean1 === clean2;
  }
  
  /**
   * Determine match type between references
   * @param {Object} showNotesRef - Show notes reference
   * @param {Object} transcriptRef - Transcript reference
   * @param {number} score - Similarity score
   * @returns {string} - Match type
   * @private
   */
  _determineMatchType(showNotesRef, transcriptRef, score) {
    if (showNotesRef.url && transcriptRef.url && showNotesRef.url === transcriptRef.url) {
      return 'exact_url';
    }
    
    if (score > 0.9) {
      return 'high_confidence';
    } else if (score > 0.8) {
      return 'medium_confidence';
    } else {
      return 'low_confidence';
    }
  }
  
  /**
   * Extract title from context around URL
   * @param {string} context - Context text
   * @param {string} url - The URL
   * @returns {string} - Extracted title or URL
   * @private
   */
  _extractTitleFromContext(context, url) {
    // Look for text before the URL that might be a title
    const urlIndex = context.indexOf(url);
    const beforeUrl = context.substring(0, urlIndex).trim();
    
    // Look for quoted text or text after common patterns
    const patterns = [
      /"([^"]+)"/,
      /:\s*([^:\n]{10,100})\s*$/,
      /\-\s*([^\-\n]{10,100})\s*$/
    ];
    
    for (const pattern of patterns) {
      const match = beforeUrl.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    
    // Fallback to URL
    return url;
  }
  
  /**
   * Check if text looks like a title
   * @param {string} text - Text to check
   * @returns {boolean} - Whether text looks like a title
   * @private
   */
  _looksLikeTitle(text) {
    // Basic heuristics for title detection
    if (text.length < 10 || text.length > 200) return false;
    
    // Should have some capitalized words
    const words = text.split(/\s+/);
    const capitalizedWords = words.filter(word => /^[A-Z]/.test(word));
    
    if (capitalizedWords.length < 2) return false;
    
    // Should not be a sentence (no ending punctuation in middle)
    if (text.includes('. ') || text.includes('? ') || text.includes('! ')) return false;
    
    return true;
  }
  
  /**
   * Extract context around a match
   * @param {string} text - Full text
   * @param {number} index - Match index
   * @param {number} length - Match length
   * @returns {string} - Context
   * @private
   */
  _extractContextAroundMatch(text, index, length) {
    const contextRadius = 150;
    const start = Math.max(0, index - contextRadius);
    const end = Math.min(text.length, index + length + contextRadius);
    
    return text.substring(start, end).trim();
  }
  
  /**
   * Extract authors from context
   * @param {string} context - Context text
   * @returns {Array} - Array of authors
   * @private
   */
  _extractAuthorsFromContext(context) {
    const authorPatterns = [
      /by\s+([^.,\n]{3,50})/i,
      /author[s]?:\s*([^.,\n]{3,50})/i,
      /\-\s*([A-Z][a-z]+\s+[A-Z][a-z]+)/
    ];
    
    for (const pattern of authorPatterns) {
      const match = context.match(pattern);
      if (match && match[1]) {
        const author = match[1].trim();
        // Split multiple authors if separated by "and" or "&"
        return author.split(/\s+(?:and|&)\s+/).map(a => a.trim());
      }
    }
    
    return [];
  }
}

module.exports = new ShowNotesAnalyzer();