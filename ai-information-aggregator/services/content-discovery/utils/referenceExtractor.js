const cheerio = require('cheerio');
const createLogger = require('../../../common/utils/logger');
const Content = require('../models/Content');
const Reference = require('../models/Reference');
const urlValidator = require('../../source-management/utils/urlValidator');

// Initialize logger
const logger = createLogger('reference-extractor');

/**
 * Extract references from content
 * @param {Object} content - Content document
 * @returns {Promise<Object>} - Result of extraction
 */
async function extractReferences(content) {
  logger.info(`Extracting references from content: ${content._id}`);
  
  try {
    // Extract references based on content type
    let extractedReferences = [];
    
    switch (content.type) {
      case 'article':
      case 'blog':
        extractedReferences = await extractArticleReferences(content);
        break;
      case 'paper':
        extractedReferences = await extractPaperReferences(content);
        break;
      case 'podcast':
      case 'video':
        extractedReferences = await extractMediaReferences(content);
        break;
      case 'social':
        extractedReferences = await extractSocialReferences(content);
        break;
      default:
        logger.info(`Unsupported content type for reference extraction: ${content.type}`);
    }
    
    // Save extracted references
    const savedReferences = [];
    for (const ref of extractedReferences) {
      try {
        // Check if reference already exists
        const existingRef = await Reference.findOne({
          sourceContentId: content._id,
          url: ref.url
        });
        
        if (!existingRef) {
          // Create new reference
          const reference = new Reference({
            sourceContentId: content._id,
            ...ref
          });
          
          // Save reference
          const savedRef = await reference.save();
          savedReferences.push(savedRef);
          
          // Add reference to content
          content.references.push(savedRef._id);
        } else {
          // Update existing reference if needed
          let updated = false;
          
          if (ref.title && !existingRef.title) {
            existingRef.title = ref.title;
            updated = true;
          }
          
          if (ref.authors && ref.authors.length > 0 && (!existingRef.authors || existingRef.authors.length === 0)) {
            existingRef.authors = ref.authors;
            updated = true;
          }
          
          if (ref.publishDate && !existingRef.publishDate) {
            existingRef.publishDate = ref.publishDate;
            updated = true;
          }
          
          if (updated) {
            await existingRef.save();
          }
          
          savedReferences.push(existingRef);
        }
      } catch (refError) {
        logger.error(`Error saving reference: ${refError.message}`, { error: refError });
      }
    }
    
    // Save content with references
    await content.save();
    
    return {
      success: true,
      extractedCount: extractedReferences.length,
      savedCount: savedReferences.length,
      references: savedReferences
    };
  } catch (error) {
    logger.error(`Error extracting references from content ${content._id}: ${error.message}`, { error });
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Extract references from article content
 * @param {Object} content - Content document
 * @returns {Promise<Array>} - Array of extracted references
 */
async function extractArticleReferences(content) {
  const references = [];
  
  try {
    // Extract links from HTML content
    if (content.fullText) {
      // Parse HTML
      const $ = cheerio.load(content.fullText);
      
      // Extract links
      $('a').each((i, element) => {
        const href = $(element).attr('href');
        const text = $(element).text().trim();
        
        if (href && isValidUrl(href)) {
          references.push({
            referenceType: 'link',
            url: href,
            title: text || extractTitleFromUrl(href),
            context: extractLinkContext($, element),
            contextLocation: {
              value: i.toString(),
              type: 'paragraph'
            },
            extractionMethod: 'automatic'
          });
        }
      });
      
      // Extract citations
      $('blockquote, q, cite').each((i, element) => {
        const text = $(element).text().trim();
        const cite = $(element).attr('cite');
        
        if (text) {
          references.push({
            referenceType: 'quote',
            url: cite && isValidUrl(cite) ? cite : null,
            quoteText: text,
            context: extractQuoteContext($, element),
            contextLocation: {
              value: i.toString(),
              type: 'paragraph'
            },
            extractionMethod: 'automatic'
          });
        }
      });
    }
    
    // Extract URLs from text content
    if (content.fullText) {
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const textContent = stripHtml(content.fullText);
      const matches = textContent.match(urlRegex);
      
      if (matches) {
        for (const url of matches) {
          // Check if URL is already in references
          const alreadyExtracted = references.some(ref => ref.url === url);
          
          if (!alreadyExtracted && isValidUrl(url)) {
            references.push({
              referenceType: 'link',
              url: url,
              title: extractTitleFromUrl(url),
              context: extractUrlContext(textContent, url),
              contextLocation: {
                value: 'text',
                type: 'paragraph'
              },
              extractionMethod: 'automatic'
            });
          }
        }
      }
    }
    
    // Extract mentions (e.g., "according to X")
    if (content.fullText) {
      const mentionPatterns = [
        /according to ([^,.]+)/gi,
        /([^,.]+) reported/gi,
        /([^,.]+) states/gi,
        /([^,.]+) claims/gi,
        /([^,.]+) suggests/gi,
        /([^,.]+) found/gi,
        /study by ([^,.]+)/gi,
        /research by ([^,.]+)/gi,
        /([^,.]+)'s research/gi,
        /([^,.]+)'s study/gi
      ];
      
      const textContent = stripHtml(content.fullText);
      
      for (const pattern of mentionPatterns) {
        const matches = [...textContent.matchAll(pattern)];
        
        for (const match of matches) {
          const mentionedEntity = match[1].trim();
          
          // Avoid short or common words
          if (mentionedEntity.length > 3 && !isCommonWord(mentionedEntity)) {
            references.push({
              referenceType: 'mention',
              title: mentionedEntity,
              context: extractMentionContext(textContent, match[0]),
              contextLocation: {
                value: 'text',
                type: 'paragraph'
              },
              extractionMethod: 'automatic'
            });
          }
        }
      }
    }
  } catch (error) {
    logger.error(`Error extracting article references: ${error.message}`, { error });
  }
  
  return references;
}

/**
 * Extract references from academic paper content
 * @param {Object} content - Content document
 * @returns {Promise<Array>} - Array of extracted references
 */
async function extractPaperReferences(content) {
  const references = [];
  
  try {
    // Extract DOI
    if (content.paperDOI) {
      references.push({
        referenceType: 'citation',
        url: `https://doi.org/${content.paperDOI}`,
        title: content.title,
        authors: content.paperAuthors ? content.paperAuthors.map(author => author.name) : [],
        publishDate: content.publishDate,
        doi: content.paperDOI,
        citationStyle: 'doi',
        extractionMethod: 'automatic'
      });
    }
    
    // Extract citations from paper abstract or full text
    const textToSearch = content.paperAbstract || content.fullText;
    
    if (textToSearch) {
      // Look for citation patterns like [1], [Smith et al., 2020], (Author, Year)
      const citationPatterns = [
        /\[(\d+)\]/g, // [1]
        /\[([^,]+) et al\.,? (\d{4})\]/gi, // [Smith et al., 2020]
        /\(([^,]+),? (\d{4})\)/gi, // (Smith, 2020)
        /\(([^,]+) et al\.,? (\d{4})\)/gi // (Smith et al., 2020)
      ];
      
      for (const pattern of citationPatterns) {
        const matches = [...textToSearch.matchAll(pattern)];
        
        for (const match of matches) {
          let citationText;
          
          if (match[0].startsWith('[') && match[0].includes('et al.')) {
            citationText = `${match[1]} et al., ${match[2]}`;
          } else if (match[0].startsWith('(') && match[0].includes('et al.')) {
            citationText = `${match[1]} et al., ${match[2]}`;
          } else if (match[0].startsWith('(') && !match[0].includes('et al.')) {
            citationText = `${match[1]}, ${match[2]}`;
          } else {
            citationText = match[1];
          }
          
          references.push({
            referenceType: 'citation',
            citationText: match[0],
            title: citationText,
            context: extractCitationContext(textToSearch, match[0]),
            contextLocation: {
              value: 'text',
              type: 'paragraph'
            },
            extractionMethod: 'automatic'
          });
        }
      }
      
      // Look for reference section
      const referenceSection = extractReferenceSection(textToSearch);
      
      if (referenceSection) {
        const referenceEntries = parseReferenceSection(referenceSection);
        
        for (const entry of referenceEntries) {
          references.push({
            referenceType: 'citation',
            citationText: entry,
            title: extractTitleFromCitation(entry),
            authors: extractAuthorsFromCitation(entry),
            publishDate: extractYearFromCitation(entry),
            doi: extractDoiFromCitation(entry),
            url: extractUrlFromCitation(entry),
            extractionMethod: 'automatic'
          });
        }
      }
    }
  } catch (error) {
    logger.error(`Error extracting paper references: ${error.message}`, { error });
  }
  
  return references;
}

/**
 * Extract references from media content (podcast, video)
 * @param {Object} content - Content document
 * @returns {Promise<Array>} - Array of extracted references
 */
async function extractMediaReferences(content) {
  const references = [];
  
  try {
    // Extract from transcript if available
    const transcript = content.podcastTranscript || content.videoTranscript;
    
    if (transcript) {
      // Extract URLs
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const matches = transcript.match(urlRegex);
      
      if (matches) {
        for (const url of matches) {
          if (isValidUrl(url)) {
            references.push({
              referenceType: 'link',
              url: url,
              title: extractTitleFromUrl(url),
              context: extractUrlContext(transcript, url),
              contextLocation: {
                value: transcript.indexOf(url).toString(),
                type: 'timestamp'
              },
              extractionMethod: 'automatic'
            });
          }
        }
      }
      
      // Extract mentions
      const mentionPatterns = [
        /according to ([^,.]+)/gi,
        /([^,.]+) reported/gi,
        /([^,.]+) states/gi,
        /([^,.]+) claims/gi,
        /([^,.]+) suggests/gi,
        /([^,.]+) found/gi,
        /study by ([^,.]+)/gi,
        /research by ([^,.]+)/gi,
        /([^,.]+)'s research/gi,
        /([^,.]+)'s study/gi
      ];
      
      for (const pattern of mentionPatterns) {
        const patternMatches = [...transcript.matchAll(pattern)];
        
        for (const match of patternMatches) {
          const mentionedEntity = match[1].trim();
          
          // Avoid short or common words
          if (mentionedEntity.length > 3 && !isCommonWord(mentionedEntity)) {
            references.push({
              referenceType: 'mention',
              title: mentionedEntity,
              context: extractMentionContext(transcript, match[0]),
              contextLocation: {
                value: transcript.indexOf(match[0]).toString(),
                type: 'timestamp'
              },
              extractionMethod: 'automatic'
            });
          }
        }
      }
    }
    
    // Extract from description or summary
    if (content.summary) {
      // Extract URLs
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const matches = content.summary.match(urlRegex);
      
      if (matches) {
        for (const url of matches) {
          // Check if URL is already in references
          const alreadyExtracted = references.some(ref => ref.url === url);
          
          if (!alreadyExtracted && isValidUrl(url)) {
            references.push({
              referenceType: 'link',
              url: url,
              title: extractTitleFromUrl(url),
              context: extractUrlContext(content.summary, url),
              contextLocation: {
                value: 'description',
                type: 'section'
              },
              extractionMethod: 'automatic'
            });
          }
        }
      }
    }
  } catch (error) {
    logger.error(`Error extracting media references: ${error.message}`, { error });
  }
  
  return references;
}

/**
 * Extract references from social media content
 * @param {Object} content - Content document
 * @returns {Promise<Array>} - Array of extracted references
 */
async function extractSocialReferences(content) {
  const references = [];
  
  try {
    // Extract from full text
    if (content.fullText) {
      // Extract URLs
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const matches = content.fullText.match(urlRegex);
      
      if (matches) {
        for (const url of matches) {
          if (isValidUrl(url)) {
            references.push({
              referenceType: 'link',
              url: url,
              title: extractTitleFromUrl(url),
              context: extractUrlContext(content.fullText, url),
              contextLocation: {
                value: 'post',
                type: 'section'
              },
              extractionMethod: 'automatic'
            });
          }
        }
      }
      
      // Extract mentions (@username)
      const mentionRegex = /@([a-zA-Z0-9_]+)/g;
      const mentionMatches = [...content.fullText.matchAll(mentionRegex)];
      
      for (const match of mentionMatches) {
        const username = match[1].trim();
        
        references.push({
          referenceType: 'mention',
          title: `@${username}`,
          context: extractMentionContext(content.fullText, match[0]),
          contextLocation: {
            value: 'post',
            type: 'section'
          },
          extractionMethod: 'automatic'
        });
      }
      
      // Extract hashtags (#topic)
      const hashtagRegex = /#([a-zA-Z0-9_]+)/g;
      const hashtagMatches = [...content.fullText.matchAll(hashtagRegex)];
      
      for (const match of hashtagMatches) {
        const hashtag = match[1].trim();
        
        references.push({
          referenceType: 'related',
          title: `#${hashtag}`,
          context: extractMentionContext(content.fullText, match[0]),
          contextLocation: {
            value: 'post',
            type: 'section'
          },
          extractionMethod: 'automatic'
        });
      }
    }
  } catch (error) {
    logger.error(`Error extracting social references: ${error.message}`, { error });
  }
  
  return references;
}

/**
 * Process unresolved references
 * @param {number} limit - Maximum number of references to process
 * @returns {Promise<Object>} - Result of processing
 */
async function processUnresolvedReferences(limit = 100) {
  logger.info(`Processing up to ${limit} unresolved references`);
  
  try {
    // Get unresolved references
    const unresolvedRefs = await Reference.findUnresolved(limit);
    
    logger.info(`Found ${unresolvedRefs.length} unresolved references`);
    
    let resolvedCount = 0;
    
    for (const ref of unresolvedRefs) {
      try {
        // Try to resolve reference
        const resolved = await resolveReference(ref);
        
        if (resolved) {
          resolvedCount++;
        }
      } catch (refError) {
        logger.error(`Error resolving reference ${ref._id}: ${refError.message}`, { error: refError });
        
        // Record error
        await ref.recordError('resolution', refError.message);
      }
    }
    
    return {
      success: true,
      processed: unresolvedRefs.length,
      resolved: resolvedCount
    };
  } catch (error) {
    logger.error(`Error processing unresolved references: ${error.message}`, { error });
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Resolve a reference
 * @param {Object} reference - Reference document
 * @returns {Promise<boolean>} - Whether the reference was resolved
 */
async function resolveReference(reference) {
  logger.info(`Resolving reference: ${reference._id}`);
  
  try {
    // If reference already has a URL, try to find matching content
    if (reference.url) {
      // Check if content with this URL exists
      const matchingContent = await Content.findOne({ url: reference.url });
      
      if (matchingContent) {
        // Mark reference as resolved
        await reference.markAsResolved(matchingContent._id, 1.0);
        logger.info(`Resolved reference ${reference._id} to content ${matchingContent._id}`);
        return true;
      }
      
      // If URL is valid but no matching content, we might want to fetch it later
      if (isValidUrl(reference.url)) {
        // For now, just update confidence
        reference.confidence = 0.7;
        await reference.save();
      }
    }
    
    // If reference has a DOI, try to find matching content
    if (reference.doi) {
      const matchingContent = await Content.findOne({ paperDOI: reference.doi });
      
      if (matchingContent) {
        // Mark reference as resolved
        await reference.markAsResolved(matchingContent._id, 1.0);
        logger.info(`Resolved reference ${reference._id} to content ${matchingContent._id} by DOI`);
        return true;
      }
    }
    
    // If reference has a title, try to find matching content
    if (reference.title) {
      // Search for content with similar title
      const matchingContent = await Content.findOne({
        title: { $regex: escapeRegExp(reference.title), $options: 'i' }
      });
      
      if (matchingContent) {
        // Calculate confidence based on title similarity
        const confidence = calculateTitleSimilarity(reference.title, matchingContent.title);
        
        if (confidence > 0.8) {
          // Mark reference as resolved
          await reference.markAsResolved(matchingContent._id, confidence);
          logger.info(`Resolved reference ${reference._id} to content ${matchingContent._id} by title with confidence ${confidence}`);
          return true;
        }
      }
    }
    
    // If reference has authors and year, try to find matching content
    if (reference.authors && reference.authors.length > 0 && reference.publishDate) {
      const year = new Date(reference.publishDate).getFullYear();
      
      // Search for content with matching author and year
      const matchingContents = await Content.find({
        $or: [
          { author: { $in: reference.authors.map(author => new RegExp(escapeRegExp(author), 'i')) } },
          { 'paperAuthors.name': { $in: reference.authors.map(author => new RegExp(escapeRegExp(author), 'i')) } }
        ],
        publishDate: {
          $gte: new Date(`${year}-01-01`),
          $lte: new Date(`${year}-12-31`)
        }
      });
      
      if (matchingContents.length === 1) {
        // Mark reference as resolved
        await reference.markAsResolved(matchingContents[0]._id, 0.9);
        logger.info(`Resolved reference ${reference._id} to content ${matchingContents[0]._id} by author and year`);
        return true;
      } else if (matchingContents.length > 1 && reference.title) {
        // If multiple matches, use title to disambiguate
        let bestMatch = null;
        let bestConfidence = 0;
        
        for (const content of matchingContents) {
          const confidence = calculateTitleSimilarity(reference.title, content.title);
          
          if (confidence > bestConfidence && confidence > 0.6) {
            bestMatch = content;
            bestConfidence = confidence;
          }
        }
        
        if (bestMatch) {
          // Mark reference as resolved
          await reference.markAsResolved(bestMatch._id, bestConfidence);
          logger.info(`Resolved reference ${reference._id} to content ${bestMatch._id} by author, year, and title with confidence ${bestConfidence}`);
          return true;
        }
      }
    }
    
    // If we couldn't resolve the reference, update its processing history
    reference.processingHistory.push({
      stage: 'resolution',
      timestamp: new Date(),
      success: false,
      error: 'Could not find matching content'
    });
    
    await reference.save();
    logger.info(`Could not resolve reference ${reference._id}`);
    
    return false;
  } catch (error) {
    logger.error(`Error resolving reference ${reference._id}: ${error.message}`, { error });
    throw error;
  }
}

/**
 * Normalize references
 * @param {Object} reference - Reference document
 * @returns {Promise<Object>} - Normalized reference
 */
async function normalizeReference(reference) {
  try {
    // Clone reference to avoid modifying the original
    const normalized = { ...reference.toObject() };
    
    // Normalize URL
    if (normalized.url) {
      normalized.url = normalizeUrl(normalized.url);
    }
    
    // Normalize authors
    if (normalized.authors && normalized.authors.length > 0) {
      normalized.authors = normalized.authors.map(author => normalizeAuthorName(author));
    }
    
    // Normalize title
    if (normalized.title) {
      normalized.title = normalized.title.trim();
    }
    
    // Normalize DOI
    if (normalized.doi) {
      normalized.doi = normalizeDoi(normalized.doi);
    }
    
    // Update reference with normalized values
    Object.assign(reference, normalized);
    await reference.save();
    
    return reference;
  } catch (error) {
    logger.error(`Error normalizing reference ${reference._id}: ${error.message}`, { error });
    throw error;
  }
}

/**
 * Normalize URL
 * @param {string} url - URL to normalize
 * @returns {string} - Normalized URL
 */
function normalizeUrl(url) {
  try {
    // Remove trailing slashes
    let normalized = url.trim().replace(/\/+$/, '');
    
    // Ensure URL has protocol
    if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
      normalized = 'https://' + normalized;
    }
    
    // Remove common tracking parameters
    try {
      const urlObj = new URL(normalized);
      const params = new URLSearchParams(urlObj.search);
      
      const trackingParams = [
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
        'fbclid', 'gclid', 'ocid', 'ncid', 'ref', 'source'
      ];
      
      let modified = false;
      for (const param of trackingParams) {
        if (params.has(param)) {
          params.delete(param);
          modified = true;
        }
      }
      
      if (modified) {
        const newSearch = params.toString();
        urlObj.search = newSearch ? `?${newSearch}` : '';
        normalized = urlObj.toString();
      }
    } catch (urlError) {
      // If URL parsing fails, return the original normalized URL
      logger.warn(`Error parsing URL for normalization: ${urlError.message}`);
    }
    
    return normalized;
  } catch (error) {
    logger.error(`Error normalizing URL: ${error.message}`, { error });
    return url;
  }
}

/**
 * Normalize author name
 * @param {string} author - Author name to normalize
 * @returns {string} - Normalized author name
 */
function normalizeAuthorName(author) {
  try {
    // Trim whitespace
    let normalized = author.trim();
    
    // Handle "Last, First" format
    if (normalized.includes(',')) {
      const parts = normalized.split(',').map(part => part.trim());
      if (parts.length === 2) {
        normalized = `${parts[1]} ${parts[0]}`;
      }
    }
    
    // Handle "First Initial. Last" format
    const initialMatch = normalized.match(/^([A-Z])\.?\s+([A-Za-z-]+)$/);
    if (initialMatch) {
      normalized = `${initialMatch[1]}. ${initialMatch[2]}`;
    }
    
    // Handle multiple initials
    const multiInitialMatch = normalized.match(/^([A-Z]\.)\s+([A-Z]\.)\s+([A-Za-z-]+)$/);
    if (multiInitialMatch) {
      normalized = `${multiInitialMatch[1]} ${multiInitialMatch[2]} ${multiInitialMatch[3]}`;
    }
    
    return normalized;
  } catch (error) {
    logger.error(`Error normalizing author name: ${error.message}`, { error });
    return author;
  }
}

/**
 * Normalize DOI
 * @param {string} doi - DOI to normalize
 * @returns {string} - Normalized DOI
 */
function normalizeDoi(doi) {
  try {
    // Trim whitespace
    let normalized = doi.trim();
    
    // Remove "doi:" or "DOI:" prefix
    normalized = normalized.replace(/^(doi|DOI):\s*/i, '');
    
    // Remove "https://doi.org/" prefix
    normalized = normalized.replace(/^https?:\/\/doi\.org\//i, '');
    
    return normalized;
  } catch (error) {
    logger.error(`Error normalizing DOI: ${error.message}`, { error });
    return doi;
  }
}

/**
 * Check if a URL is valid
 * @param {string} url - URL to check
 * @returns {boolean} - Whether the URL is valid
 */
function isValidUrl(url) {
  return urlValidator.isValidUrl(url);
}

/**
 * Extract title from URL
 * @param {string} url - URL to extract title from
 * @returns {string} - Extracted title
 */
function extractTitleFromUrl(url) {
  try {
    // Parse URL
    const urlObj = new URL(url);
    
    // Extract path segments
    const pathSegments = urlObj.pathname.split('/').filter(segment => segment);
    
    // Use last path segment as title
    if (pathSegments.length > 0) {
      const lastSegment = pathSegments[pathSegments.length - 1];
      
      // Remove file extension and convert dashes/underscores to spaces
      return lastSegment
        .replace(/\.(html|php|aspx|jsp)$/, '')
        .replace(/[-_]/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2') // Split camelCase
        .trim();
    }
    
    // If no path segments, use hostname
    return urlObj.hostname;
  } catch (error) {
    logger.error(`Error extracting title from URL: ${error.message}`, { error });
    return url;
  }
}

/**
 * Extract link context
 * @param {Object} $ - Cheerio object
 * @param {Object} element - Link element
 * @returns {string} - Extracted context
 */
function extractLinkContext($, element) {
  try {
    // Get parent paragraph or div
    const parent = $(element).closest('p, div');
    
    if (parent.length) {
      // Get text of parent
      return parent.text().trim().substring(0, 500);
    }
    
    // If no parent, get surrounding text
    const html = $.html();
    const elementHtml = $.html(element);
    const elementIndex = html.indexOf(elementHtml);
    
    if (elementIndex >= 0) {
      // Get 100 characters before and after the element
      const start = Math.max(0, elementIndex - 100);
      const end = Math.min(html.length, elementIndex + elementHtml.length + 100);
      
      return stripHtml(html.substring(start, end)).trim();
    }
    
    return '';
  } catch (error) {
    logger.error(`Error extracting link context: ${error.message}`, { error });
    return '';
  }
}

/**
 * Extract quote context
 * @param {Object} $ - Cheerio object
 * @param {Object} element - Quote element
 * @returns {string} - Extracted context
 */
function extractQuoteContext($, element) {
  try {
    // Get next element (potential attribution)
    const next = $(element).next();
    
    if (next.length) {
      return next.text().trim().substring(0, 500);
    }
    
    // If no next element, get parent
    const parent = $(element).parent();
    
    if (parent.length) {
      // Get text after the quote
      const parentHtml = parent.html();
      const elementHtml = $.html(element);
      const elementIndex = parentHtml.indexOf(elementHtml);
      
      if (elementIndex >= 0) {
        const afterQuote = parentHtml.substring(elementIndex + elementHtml.length);
        return stripHtml(afterQuote).trim().substring(0, 500);
      }
    }
    
    return '';
  } catch (error) {
    logger.error(`Error extracting quote context: ${error.message}`, { error });
    return '';
  }
}

/**
 * Extract URL context
 * @param {string} text - Text containing URL
 * @param {string} url - URL to extract context for
 * @returns {string} - Extracted context
 */
function extractUrlContext(text, url) {
  try {
    const urlIndex = text.indexOf(url);
    
    if (urlIndex >= 0) {
      // Get 100 characters before and after the URL
      const start = Math.max(0, urlIndex - 100);
      const end = Math.min(text.length, urlIndex + url.length + 100);
      
      return text.substring(start, end).trim();
    }
    
    return '';
  } catch (error) {
    logger.error(`Error extracting URL context: ${error.message}`, { error });
    return '';
  }
}

/**
 * Extract mention context
 * @param {string} text - Text containing mention
 * @param {string} mention - Mention to extract context for
 * @returns {string} - Extracted context
 */
function extractMentionContext(text, mention) {
  try {
    const mentionIndex = text.indexOf(mention);
    
    if (mentionIndex >= 0) {
      // Get 100 characters before and after the mention
      const start = Math.max(0, mentionIndex - 100);
      const end = Math.min(text.length, mentionIndex + mention.length + 100);
      
      return text.substring(start, end).trim();
    }
    
    return '';
  } catch (error) {
    logger.error(`Error extracting mention context: ${error.message}`, { error });
    return '';
  }
}

/**
 * Extract citation context
 * @param {string} text - Text containing citation
 * @param {string} citation - Citation to extract context for
 * @returns {string} - Extracted context
 */
function extractCitationContext(text, citation) {
  try {
    const citationIndex = text.indexOf(citation);
    
    if (citationIndex >= 0) {
      // Get 100 characters before and after the citation
      const start = Math.max(0, citationIndex - 100);
      const end = Math.min(text.length, citationIndex + citation.length + 100);
      
      return text.substring(start, end).trim();
    }
    
    return '';
  } catch (error) {
    logger.error(`Error extracting citation context: ${error.message}`, { error });
    return '';
  }
}

/**
 * Extract reference section from text
 * @param {string} text - Text to extract reference section from
 * @returns {string} - Extracted reference section
 */
function extractReferenceSection(text) {
  try {
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
      const regex = new RegExp(`${header}[\\s\\n]*`, 'i');
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
  } catch (error) {
    logger.error(`Error extracting reference section: ${error.message}`, { error });
    return '';
  }
}

/**
 * Parse reference section into individual references
 * @param {string} referenceSection - Reference section text
 * @returns {Array} - Array of reference strings
 */
function parseReferenceSection(referenceSection) {
  try {
    // Split by numbered references
    const numberedRegex = /^\s*\[\d+\]|\s*\d+\.\s+/gm;
    if (numberedRegex.test(referenceSection)) {
      return referenceSection
        .split(/\s*\[\d+\]|\s*\d+\.\s+/)
        .filter(ref => ref.trim().length > 0);
    }
    
    // Split by author-year references
    const authorYearRegex = /^\s*[A-Z][a-z]+,\s+[A-Z]\.\s+\(\d{4}\)/gm;
    if (authorYearRegex.test(referenceSection)) {
      return referenceSection
        .split(/\n\s*[A-Z][a-z]+,\s+[A-Z]\.\s+\(\d{4}\)/)
        .filter(ref => ref.trim().length > 0);
    }
    
    // Split by newlines if no other pattern is found
    return referenceSection
      .split(/\n\s*\n/)
      .filter(ref => ref.trim().length > 0);
  } catch (error) {
    logger.error(`Error parsing reference section: ${error.message}`, { error });
    return [];
  }
}

/**
 * Extract title from citation
 * @param {string} citation - Citation text
 * @returns {string} - Extracted title
 */
function extractTitleFromCitation(citation) {
  try {
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
    
    return '';
  } catch (error) {
    logger.error(`Error extracting title from citation: ${error.message}`, { error });
    return '';
  }
}

/**
 * Extract authors from citation
 * @param {string} citation - Citation text
 * @returns {Array} - Array of author names
 */
function extractAuthorsFromCitation(citation) {
  try {
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
    
    return [];
  } catch (error) {
    logger.error(`Error extracting authors from citation: ${error.message}`, { error });
    return [];
  }
}

/**
 * Extract year from citation
 * @param {string} citation - Citation text
 * @returns {Date|null} - Extracted year as Date object or null
 */
function extractYearFromCitation(citation) {
  try {
    // Look for year in parentheses
    const yearMatch = citation.match(/\((\d{4})\)/);
    if (yearMatch) {
      return new Date(`${yearMatch[1]}-01-01`);
    }
    
    // Look for year after author
    const authorYearMatch = citation.match(/[A-Z][a-z]+,\s+[A-Z]\.\s+(\d{4})/);
    if (authorYearMatch) {
      return new Date(`${authorYearMatch[1]}-01-01`);
    }
    
    return null;
  } catch (error) {
    logger.error(`Error extracting year from citation: ${error.message}`, { error });
    return null;
  }
}

/**
 * Extract DOI from citation
 * @param {string} citation - Citation text
 * @returns {string} - Extracted DOI
 */
function extractDoiFromCitation(citation) {
  try {
    // Look for DOI
    const doiMatch = citation.match(/doi:?\s*([^\s]+)/i);
    if (doiMatch) {
      return doiMatch[1].trim();
    }
    
    // Look for DOI URL
    const doiUrlMatch = citation.match(/https?:\/\/doi\.org\/([^\s]+)/i);
    if (doiUrlMatch) {
      return doiUrlMatch[1].trim();
    }
    
    return '';
  } catch (error) {
    logger.error(`Error extracting DOI from citation: ${error.message}`, { error });
    return '';
  }
}

/**
 * Extract URL from citation
 * @param {string} citation - Citation text
 * @returns {string} - Extracted URL
 */
function extractUrlFromCitation(citation) {
  try {
    // Look for URL
    const urlMatch = citation.match(/https?:\/\/[^\s]+/);
    if (urlMatch) {
      return urlMatch[0].trim();
    }
    
    return '';
  } catch (error) {
    logger.error(`Error extracting URL from citation: ${error.message}`, { error });
    return '';
  }
}

/**
 * Strip HTML tags from text
 * @param {string} html - HTML text
 * @returns {string} - Text without HTML tags
 */
function stripHtml(html) {
  try {
    return html
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  } catch (error) {
    logger.error(`Error stripping HTML: ${error.message}`, { error });
    return html;
  }
}

/**
 * Check if a word is a common word
 * @param {string} word - Word to check
 * @returns {boolean} - Whether the word is common
 */
function isCommonWord(word) {
  const commonWords = [
    'the', 'a', 'an', 'and', 'or', 'but', 'for', 'nor', 'on', 'at', 'to', 'by', 'in',
    'this', 'that', 'these', 'those', 'it', 'they', 'we', 'you', 'he', 'she', 'him', 'her',
    'his', 'hers', 'its', 'their', 'our', 'your', 'who', 'what', 'where', 'when', 'why', 'how',
    'all', 'any', 'both', 'each', 'few', 'many', 'some', 'such', 'no', 'nor', 'not', 'only',
    'own', 'same', 'so', 'than', 'too', 'very', 'can', 'will', 'just', 'should', 'now'
  ];
  
  return commonWords.includes(word.toLowerCase());
}

/**
 * Escape special characters in a string for use in a regular expression
 * @param {string} string - String to escape
 * @returns {string} - Escaped string
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Calculate similarity between two titles
 * @param {string} title1 - First title
 * @param {string} title2 - Second title
 * @returns {number} - Similarity score (0-1)
 */
function calculateTitleSimilarity(title1, title2) {
  try {
    // Normalize titles
    const normalizedTitle1 = title1.toLowerCase().trim();
    const normalizedTitle2 = title2.toLowerCase().trim();
    
    // If titles are identical, return 1
    if (normalizedTitle1 === normalizedTitle2) {
      return 1;
    }
    
    // If one title contains the other, return 0.9
    if (normalizedTitle1.includes(normalizedTitle2) || normalizedTitle2.includes(normalizedTitle1)) {
      return 0.9;
    }
    
    // Calculate Levenshtein distance
    const distance = levenshteinDistance(normalizedTitle1, normalizedTitle2);
    const maxLength = Math.max(normalizedTitle1.length, normalizedTitle2.length);
    
    // Convert distance to similarity score
    return 1 - (distance / maxLength);
  } catch (error) {
    logger.error(`Error calculating title similarity: ${error.message}`, { error });
    return 0;
  }
}

/**
 * Calculate Levenshtein distance between two strings
 * @param {string} s1 - First string
 * @param {string} s2 - Second string
 * @returns {number} - Levenshtein distance
 */
function levenshteinDistance(s1, s2) {
  const m = s1.length;
  const n = s2.length;
  
  // Create distance matrix
  const d = Array(m + 1).fill().map(() => Array(n + 1).fill(0));
  
  // Initialize first row and column
  for (let i = 0; i <= m; i++) {
    d[i][0] = i;
  }
  
  for (let j = 0; j <= n; j++) {
    d[0][j] = j;
  }
  
  // Fill in the rest of the matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      
      d[i][j] = Math.min(
        d[i - 1][j] + 1, // deletion
        d[i][j - 1] + 1, // insertion
        d[i - 1][j - 1] + cost // substitution
      );
    }
  }
  
  return d[m][n];
}

module.exports = {
  extractReferences,
  extractArticleReferences,
  extractPaperReferences,
  extractMediaReferences,
  extractSocialReferences,
  processUnresolvedReferences,
  resolveReference,
  normalizeReference
};