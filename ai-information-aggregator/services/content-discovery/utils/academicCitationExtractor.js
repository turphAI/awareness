const createLogger = require('../../../common/utils/logger');
const cheerio = require('cheerio');
const axios = require('axios');
const Content = require('../models/Content');
const Reference = require('../models/Reference');

// Initialize logger
const logger = createLogger('academic-citation-extractor');

/**
 * Extract citations from academic paper
 * @param {Object} content - Content document
 * @returns {Promise<Object>} - Result of extraction
 */
async function extractCitations(content) {
  logger.info(`Extracting citations from academic paper: ${content._id}`);
  
  try {
    // Check if content is an academic paper
    if (content.type !== 'paper') {
      logger.warn(`Content ${content._id} is not an academic paper`);
      return {
        success: false,
        error: 'Content is not an academic paper',
        contentId: content._id
      };
    }
    
    // Extract citations based on available content
    let citations = [];
    
    // If we have a DOI, try to fetch metadata from external APIs
    if (content.paperDOI) {
      try {
        const doiCitations = await extractCitationsFromDOI(content.paperDOI);
        citations = [...citations, ...doiCitations];
      } catch (doiError) {
        logger.error(`Error extracting citations from DOI: ${doiError.message}`, { error: doiError });
      }
    }
    
    // Extract citations from abstract
    if (content.paperAbstract) {
      const abstractCitations = extractCitationsFromText(content.paperAbstract);
      citations = [...citations, ...abstractCitations];
    }
    
    // Extract citations from full text
    if (content.fullText) {
      const fullTextCitations = extractCitationsFromText(content.fullText);
      citations = [...citations, ...fullTextCitations];
      
      // Extract reference section
      const referenceSection = extractReferenceSection(content.fullText);
      if (referenceSection) {
        const referenceSectionCitations = parseReferenceSection(referenceSection);
        citations = [...citations, ...referenceSectionCitations];
      }
    }
    
    // Deduplicate citations
    const uniqueCitations = deduplicateCitations(citations);
    
    // Save citations as references
    const savedReferences = [];
    for (const citation of uniqueCitations) {
      try {
        // Check if reference already exists
        const existingRef = await Reference.findOne({
          sourceContentId: content._id,
          citationText: citation.text
        });
        
        if (!existingRef) {
          // Create new reference
          const reference = new Reference({
            sourceContentId: content._id,
            referenceType: 'citation',
            title: citation.title || extractTitleFromCitation(citation.text),
            authors: citation.authors || extractAuthorsFromCitation(citation.text),
            publishDate: citation.year ? new Date(`${citation.year}-01-01`) : null,
            doi: citation.doi,
            url: citation.url,
            citationText: citation.text,
            citationStyle: citation.style || 'unknown',
            context: citation.context,
            extractionMethod: 'automatic'
          });
          
          // Save reference
          const savedRef = await reference.save();
          savedReferences.push(savedRef);
          
          // Add reference to content
          content.references.push(savedRef._id);
        } else {
          // Update existing reference if needed
          let updated = false;
          
          if (citation.doi && !existingRef.doi) {
            existingRef.doi = citation.doi;
            updated = true;
          }
          
          if (citation.url && !existingRef.url) {
            existingRef.url = citation.url;
            updated = true;
          }
          
          if (citation.title && !existingRef.title) {
            existingRef.title = citation.title;
            updated = true;
          }
          
          if (citation.authors && citation.authors.length > 0 && (!existingRef.authors || existingRef.authors.length === 0)) {
            existingRef.authors = citation.authors;
            updated = true;
          }
          
          if (citation.year && !existingRef.publishDate) {
            existingRef.publishDate = new Date(`${citation.year}-01-01`);
            updated = true;
          }
          
          if (updated) {
            await existingRef.save();
          }
          
          savedReferences.push(existingRef);
        }
      } catch (refError) {
        logger.error(`Error saving citation reference: ${refError.message}`, { error: refError });
      }
    }
    
    // Save content with references
    await content.save();
    
    // Update content processing history
    content.processingHistory.push({
      stage: 'citation-extraction',
      timestamp: new Date(),
      success: true,
      metadata: new Map([
        ['extractedCount', uniqueCitations.length.toString()],
        ['savedCount', savedReferences.length.toString()]
      ])
    });
    
    await content.save();
    
    return {
      success: true,
      contentId: content._id,
      extractedCount: uniqueCitations.length,
      savedCount: savedReferences.length,
      references: savedReferences.map(ref => ({
        id: ref._id,
        type: ref.referenceType,
        title: ref.title,
        authors: ref.authors,
        doi: ref.doi,
        url: ref.url
      }))
    };
  } catch (error) {
    logger.error(`Error extracting citations from paper ${content._id}: ${error.message}`, { error });
    
    return {
      success: false,
      contentId: content._id,
      error: error.message
    };
  }
}

/**
 * Extract citations from DOI using external APIs
 * @param {string} doi - DOI of the paper
 * @returns {Promise<Array>} - Array of extracted citations
 */
async function extractCitationsFromDOI(doi) {
  try {
    // Normalize DOI
    const normalizedDOI = doi.replace(/^(https?:\/\/)?(dx\.)?doi\.org\//i, '');
    
    // Try to fetch from CrossRef API
    const crossRefURL = `https://api.crossref.org/works/${encodeURIComponent(normalizedDOI)}`;
    const response = await axios.get(crossRefURL, {
      headers: {
        'User-Agent': 'AI-Information-Aggregator/1.0 (mailto:info@example.com)'
      }
    });
    
    if (response.data && response.data.message) {
      const data = response.data.message;
      const citations = [];
      
      // Extract references if available
      if (data.reference && Array.isArray(data.reference)) {
        for (const ref of data.reference) {
          const citation = {
            text: ref['unstructured'] || formatCitationFromCrossRef(ref),
            doi: ref.DOI,
            url: ref.DOI ? `https://doi.org/${ref.DOI}` : null,
            title: ref['article-title'] || ref.title,
            authors: ref.author ? [ref.author] : [],
            year: ref.year,
            style: 'crossref',
            context: 'From CrossRef API'
          };
          
          citations.push(citation);
        }
      }
      
      return citations;
    }
    
    return [];
  } catch (error) {
    logger.error(`Error fetching citations from DOI ${doi}: ${error.message}`, { error });
    return [];
  }
}

/**
 * Format citation from CrossRef reference data
 * @param {Object} ref - CrossRef reference object
 * @returns {string} - Formatted citation text
 */
function formatCitationFromCrossRef(ref) {
  const parts = [];
  
  if (ref.author) {
    parts.push(ref.author);
  }
  
  if (ref.year) {
    parts.push(`(${ref.year})`);
  }
  
  if (ref['article-title'] || ref.title) {
    parts.push(`"${ref['article-title'] || ref.title}"`);
  }
  
  if (ref['journal-title']) {
    parts.push(ref['journal-title']);
  }
  
  if (ref.volume) {
    parts.push(`Vol. ${ref.volume}`);
  }
  
  if (ref.issue) {
    parts.push(`Issue ${ref.issue}`);
  }
  
  if (ref['first-page'] && ref['last-page']) {
    parts.push(`pp. ${ref['first-page']}-${ref['last-page']}`);
  } else if (ref['first-page']) {
    parts.push(`p. ${ref['first-page']}`);
  }
  
  if (ref.DOI) {
    parts.push(`DOI: ${ref.DOI}`);
  }
  
  return parts.join(', ');
}

/**
 * Extract citations from text
 * @param {string} text - Text to extract citations from
 * @returns {Array} - Array of extracted citations
 */
function extractCitationsFromText(text) {
  const citations = [];
  
  // Extract inline citations like [1], [Smith et al., 2020], (Author, 2019)
  const inlineCitationPatterns = [
    { pattern: /\[(\d+)\]/g, style: 'numeric' },
    { pattern: /\[([^,]+) et al\.,? (\d{4})\]/gi, style: 'author-year' },
    { pattern: /\(([^,]+),? (\d{4}[a-z]?)\)/gi, style: 'author-year' },
    { pattern: /\(([^,]+) et al\.,? (\d{4}[a-z]?)\)/gi, style: 'author-year' }
  ];
  
  for (const { pattern, style } of inlineCitationPatterns) {
    const matches = [...text.matchAll(pattern)];
    
    for (const match of matches) {
      let citationText;
      let authors = [];
      let year = null;
      
      if (style === 'numeric') {
        citationText = `[${match[1]}]`;
      } else if (style === 'author-year') {
        if (match[0].includes('et al.')) {
          citationText = `${match[1]} et al., ${match[2]}`;
          authors = [`${match[1]} et al.`];
        } else {
          citationText = `${match[1]}, ${match[2]}`;
          authors = [match[1]];
        }
        year = match[2].substring(0, 4);
      }
      
      // Get context around the citation
      const context = extractCitationContext(text, match[0]);
      
      citations.push({
        text: citationText,
        authors,
        year,
        style,
        context
      });
    }
  }
  
  return citations;
}

/**
 * Extract reference section from text
 * @param {string} text - Text to extract reference section from
 * @returns {string} - Extracted reference section
 */
function extractReferenceSection(text) {
  // Look for reference section headers
  const referenceHeaders = [
    'References',
    'Bibliography',
    'Works Cited',
    'Literature Cited',
    'Sources',
    'Citations'
  ];
  
  for (const header of referenceHeaders) {
    const regex = new RegExp(`\\n\\s*${header}\\s*\\n`, 'i');
    const match = text.match(regex);
    
    if (match) {
      const startIndex = match.index + match[0].length;
      
      // Look for next section header or end of text
      const nextSectionRegex = /\n\s*[A-Z][A-Za-z\s]+\s*\n/;
      const nextMatch = text.substring(startIndex).match(nextSectionRegex);
      
      if (nextMatch) {
        return text.substring(startIndex, startIndex + nextMatch.index).trim();
      } else {
        return text.substring(startIndex).trim();
      }
    }
  }
  
  return '';
}

/**
 * Parse reference section into individual citations
 * @param {string} referenceSection - Reference section text
 * @returns {Array} - Array of citation objects
 */
function parseReferenceSection(referenceSection) {
  const citations = [];
  
  // Try different patterns to split references
  let referenceEntries = [];
  
  // Try numbered references like [1] or 1.
  const numberedRegex = /^\s*(?:\[\d+\]|\d+\.)\s+/gm;
  if (numberedRegex.test(referenceSection)) {
    referenceEntries = referenceSection.split(/\n\s*(?:\[\d+\]|\d+\.)\s+/).filter(entry => entry.trim().length > 0);
    
    // Add back the numbers that were removed in the split
    const numbers = referenceSection.match(/\s*(?:\[\d+\]|\d+\.)\s+/g) || [];
    referenceEntries = referenceEntries.map((entry, i) => {
      return (i < numbers.length ? numbers[i].trim() + ' ' : '') + entry.trim();
    });
  } else {
    // Try author-year pattern
    const authorYearRegex = /^\s*[A-Z][a-z]+,\s+[A-Z]\.\s+\(\d{4}\)/gm;
    if (authorYearRegex.test(referenceSection)) {
      referenceEntries = referenceSection.split(/\n\s*(?=[A-Z][a-z]+,\s+[A-Z]\.\s+\(\d{4}\))/).filter(entry => entry.trim().length > 0);
    } else {
      // Fall back to splitting by double newlines
      referenceEntries = referenceSection.split(/\n\s*\n/).filter(entry => entry.trim().length > 0);
    }
  }
  
  // Process each reference entry
  for (const entry of referenceEntries) {
    const trimmedEntry = entry.trim();
    if (trimmedEntry.length === 0) continue;
    
    // Extract DOI if present
    const doiMatch = trimmedEntry.match(/\b(?:doi|DOI):\s*([^\s,]+)/i) || 
                     trimmedEntry.match(/\bhttps?:\/\/(?:dx\.)?doi\.org\/([^\s,]+)/i);
    const doi = doiMatch ? doiMatch[1] : null;
    
    // Extract URL if present
    const urlMatch = trimmedEntry.match(/\bhttps?:\/\/(?!(?:dx\.)?doi\.org)[^\s,]+/i);
    const url = urlMatch ? urlMatch[0] : (doi ? `https://doi.org/${doi}` : null);
    
    // Extract year if present
    const yearMatch = trimmedEntry.match(/\b(19|20)\d{2}[a-z]?\b/);
    const year = yearMatch ? yearMatch[0].substring(0, 4) : null;
    
    // Extract authors
    const authors = extractAuthorsFromCitation(trimmedEntry);
    
    // Extract title
    const title = extractTitleFromCitation(trimmedEntry);
    
    citations.push({
      text: trimmedEntry,
      doi,
      url,
      title,
      authors,
      year,
      style: 'reference-list',
      context: 'From reference section'
    });
  }
  
  return citations;
}

/**
 * Extract citation context
 * @param {string} text - Text containing citation
 * @param {string} citation - Citation to extract context for
 * @returns {string} - Extracted context
 */
function extractCitationContext(text, citation) {
  const citationIndex = text.indexOf(citation);
  
  if (citationIndex >= 0) {
    // Get 100 characters before and after the citation
    const start = Math.max(0, citationIndex - 100);
    const end = Math.min(text.length, citationIndex + citation.length + 100);
    
    return text.substring(start, end).trim();
  }
  
  return '';
}

/**
 * Extract title from citation
 * @param {string} citation - Citation text
 * @returns {string} - Extracted title
 */
function extractTitleFromCitation(citation) {
  // Look for title in quotes
  const quoteMatch = citation.match(/"([^"]+)"|"([^"]+)"|'([^']+)'/);
  if (quoteMatch) {
    return quoteMatch[1] || quoteMatch[2] || quoteMatch[3];
  }
  
  // Look for title after author and year
  const authorYearMatch = citation.match(/[A-Z][a-z]+,\s+[A-Z]\.\s+\(\d{4}\)\.\s+([^\.]+)/);
  if (authorYearMatch) {
    return authorYearMatch[1].trim();
  }
  
  // Look for title after a number (for numbered references)
  const numberedMatch = citation.match(/^\s*(?:\[\d+\]|\d+\.)\s+([^\.]+)/);
  if (numberedMatch) {
    return numberedMatch[1].trim();
  }
  
  return '';
}

/**
 * Extract authors from citation
 * @param {string} citation - Citation text
 * @returns {Array} - Array of author names
 */
function extractAuthorsFromCitation(citation) {
  // Look for authors before year
  const authorMatch = citation.match(/^([^(]+)\(\d{4}\)/);
  if (authorMatch) {
    const authorText = authorMatch[1].trim();
    
    // Split multiple authors
    if (authorText.includes(',') && authorText.includes('&')) {
      return authorText
        .split(/,|\s+&\s+/)
        .map(author => author.trim())
        .filter(author => author.length > 0);
    } else if (authorText.includes('and')) {
      return authorText
        .split(/\s+and\s+/)
        .map(author => author.trim())
        .filter(author => author.length > 0);
    } else {
      return [authorText];
    }
  }
  
  // Look for authors at beginning of citation
  const nameMatch = citation.match(/^([A-Z][a-z]+,\s+[A-Z]\.)/);
  if (nameMatch) {
    return [nameMatch[1].trim()];
  }
  
  // Look for multiple authors in standard format
  const multipleAuthorsMatch = citation.match(/^([A-Z][a-z]+(?:,\s+[A-Z]\.)+(?:,\s+(?:and\s+)?[A-Z][a-z]+(?:,\s+[A-Z]\.)+)*)/);
  if (multipleAuthorsMatch) {
    return multipleAuthorsMatch[1]
      .split(/,\s+and\s+|,\s+/)
      .map(author => author.trim())
      .filter(author => author.length > 0 && /[A-Z]/.test(author));
  }
  
  return [];
}

/**
 * Deduplicate citations
 * @param {Array} citations - Array of citation objects
 * @returns {Array} - Deduplicated array of citation objects
 */
function deduplicateCitations(citations) {
  const uniqueCitations = [];
  const seenTexts = new Set();
  const seenDOIs = new Set();
  
  for (const citation of citations) {
    // Skip if we've seen this exact citation text before
    if (seenTexts.has(citation.text)) {
      continue;
    }
    
    // Skip if we've seen this DOI before
    if (citation.doi && seenDOIs.has(citation.doi)) {
      continue;
    }
    
    // Add to unique citations
    uniqueCitations.push(citation);
    
    // Mark as seen
    seenTexts.add(citation.text);
    if (citation.doi) {
      seenDOIs.add(citation.doi);
    }
  }
  
  return uniqueCitations;
}

/**
 * Process academic papers for citation extraction
 * @param {number} limit - Maximum number of papers to process
 * @returns {Promise<Object>} - Processing result
 */
async function processAcademicPapers(limit = 50) {
  try {
    // Find unprocessed academic papers
    const papers = await Content.find({
      type: 'paper',
      processed: false
    }).limit(limit);
    
    logger.info(`Found ${papers.length} unprocessed academic papers`);
    
    // Process each paper
    const results = [];
    for (const paper of papers) {
      try {
        const result = await extractCitations(paper);
        results.push(result);
      } catch (paperError) {
        logger.error(`Error processing paper ${paper._id}: ${paperError.message}`, { error: paperError });
        results.push({
          success: false,
          contentId: paper._id,
          error: paperError.message
        });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    const totalExtracted = results.reduce((sum, r) => sum + (r.extractedCount || 0), 0);
    const totalSaved = results.reduce((sum, r) => sum + (r.savedCount || 0), 0);
    
    return {
      success: true,
      processed: papers.length,
      succeeded: successCount,
      failed: papers.length - successCount,
      totalExtracted,
      totalSaved
    };
  } catch (error) {
    logger.error(`Error processing academic papers: ${error.message}`, { error });
    
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  extractCitations,
  processAcademicPapers
};