const axios = require('axios');
const cheerio = require('cheerio');
const crypto = require('crypto');
const createLogger = require('../../../common/utils/logger');
const Content = require('../models/Content');
const RssParser = require('rss-parser');

// Initialize logger
const logger = createLogger('content-checker');

// Initialize RSS parser
const rssParser = new RssParser({
  customFields: {
    item: [
      ['media:content', 'media'],
      ['content:encoded', 'contentEncoded'],
      ['dc:creator', 'creator']
    ]
  }
});

/**
 * Check a source for new content
 * @param {Object} source - Source document
 * @returns {Promise<Object>} - Result of the check
 */
async function checkSource(source) {
  logger.info(`Checking source: ${source.name} (${source._id})`);
  
  try {
    let newContent = [];
    
    // Check based on source type
    switch (source.type) {
      case 'rss':
        newContent = await checkRssSource(source);
        break;
      case 'website':
      case 'blog':
        newContent = await checkWebsiteSource(source);
        break;
      case 'podcast':
        newContent = await checkPodcastSource(source);
        break;
      case 'academic':
        newContent = await checkAcademicSource(source);
        break;
      case 'social':
        newContent = await checkSocialSource(source);
        break;
      case 'newsletter':
        // Newsletters typically require special handling and often come via email
        logger.info(`Newsletter sources not yet supported: ${source._id}`);
        break;
      default:
        logger.warn(`Unsupported source type: ${source.type} for source ${source._id}`);
    }
    
    // Update source if content was found
    if (newContent.length > 0) {
      await source.recordUpdate();
      logger.info(`Found ${newContent.length} new content items for source ${source._id}`);
      
      return {
        contentFound: true,
        newContent,
        message: `Found ${newContent.length} new content items`
      };
    } else {
      logger.info(`No new content found for source ${source._id}`);
      return {
        contentFound: false,
        newContent: [],
        message: 'No new content found'
      };
    }
  } catch (error) {
    logger.error(`Error checking source ${source._id}: ${error.message}`, { error });
    
    // Record error on source
    await source.recordError(error.message);
    
    throw error;
  }
}

/**
 * Check an RSS source for new content
 * @param {Object} source - Source document
 * @returns {Promise<Array>} - Array of new content documents
 */
async function checkRssSource(source) {
  try {
    const url = source.rssUrl || source.url;
    logger.info(`Checking RSS feed: ${url}`);
    
    // Fetch RSS feed
    const feed = await rssParser.parseURL(url);
    
    // Process feed items
    const newContent = [];
    
    for (const item of feed.items) {
      // Check if content already exists
      const existingContent = await Content.findOne({
        sourceId: source._id,
        url: item.link
      });
      
      if (!existingContent) {
        // Create new content
        const content = new Content({
          sourceId: source._id,
          url: item.link,
          title: item.title,
          author: item.creator || item.author || feed.title,
          publishDate: item.pubDate ? new Date(item.pubDate) : new Date(),
          discoveryDate: new Date(),
          type: determineContentType(item, source.type),
          categories: item.categories || source.categories,
          topics: source.tags || [],
          summary: item.contentSnippet || item.description,
          fullText: item.contentEncoded || item.content || item.description,
          processed: false
        });
        
        // Save content
        await content.save();
        
        // Add to new content array
        newContent.push(content);
        
        logger.info(`Created new content: ${content.title} (${content._id})`);
      }
    }
    
    return newContent;
  } catch (error) {
    logger.error(`Error checking RSS source ${source._id}: ${error.message}`, { error });
    throw error;
  }
}

/**
 * Check a website source for new content
 * @param {Object} source - Source document
 * @returns {Promise<Array>} - Array of new content documents
 */
async function checkWebsiteSource(source) {
  try {
    logger.info(`Checking website: ${source.url}`);
    
    // Fetch website content
    const response = await axios.get(source.url, {
      headers: {
        'User-Agent': 'AI-Information-Aggregator/1.0'
      },
      timeout: 10000 // 10 seconds timeout
    });
    
    // Parse HTML
    const $ = cheerio.load(response.data);
    
    // Get current content hash
    const contentHash = crypto.createHash('md5').update(response.data).digest('hex');
    
    // Check if content has changed
    const previousHash = source.metadata.get('contentHash');
    
    if (previousHash === contentHash) {
      logger.info(`No changes detected for website ${source._id}`);
      return [];
    }
    
    // Update content hash in source metadata
    const metadata = Object.fromEntries(source.metadata.entries());
    metadata.contentHash = contentHash;
    metadata.lastCheckedContent = new Date().toISOString();
    await source.updateMetadata(metadata);
    
    // Find potential content links
    const contentLinks = [];
    
    // Look for article links - this is a simple implementation
    // In a real system, this would be more sophisticated and customized per site
    $('a').each((i, element) => {
      const href = $(element).attr('href');
      if (href && isLikelyContentLink(href, source.url)) {
        contentLinks.push(normalizeUrl(href, source.url));
      }
    });
    
    // Process content links
    const newContent = [];
    
    for (const url of contentLinks) {
      // Check if content already exists
      const existingContent = await Content.findOne({
        sourceId: source._id,
        url
      });
      
      if (!existingContent) {
        try {
          // Fetch content page
          const contentResponse = await axios.get(url, {
            headers: {
              'User-Agent': 'AI-Information-Aggregator/1.0'
            },
            timeout: 10000 // 10 seconds timeout
          });
          
          // Parse content page
          const content$ = cheerio.load(contentResponse.data);
          
          // Extract content details - this is a simple implementation
          // In a real system, this would be more sophisticated and customized per site
          const title = content$('title').text() || content$('h1').first().text() || 'Untitled';
          const author = content$('meta[name="author"]').attr('content') || 
                        content$('.author').text() || 
                        content$('[rel="author"]').text() || 
                        'Unknown';
          
          // Try to find publication date
          let publishDate = content$('meta[property="article:published_time"]').attr('content') ||
                           content$('time').attr('datetime') ||
                           new Date();
          
          if (typeof publishDate === 'string') {
            publishDate = new Date(publishDate);
          }
          
          // Extract content text
          const contentText = extractMainContent(content$);
          
          // Create new content
          const content = new Content({
            sourceId: source._id,
            url,
            title,
            author,
            publishDate,
            discoveryDate: new Date(),
            type: 'article', // Default to article for websites
            categories: source.categories,
            topics: source.tags || [],
            summary: contentText.substring(0, 500) + (contentText.length > 500 ? '...' : ''),
            fullText: contentText,
            processed: false
          });
          
          // Save content
          await content.save();
          
          // Add to new content array
          newContent.push(content);
          
          logger.info(`Created new content: ${content.title} (${content._id})`);
        } catch (contentError) {
          logger.error(`Error fetching content from ${url}: ${contentError.message}`);
          // Continue with next content link
        }
      }
    }
    
    return newContent;
  } catch (error) {
    logger.error(`Error checking website source ${source._id}: ${error.message}`, { error });
    throw error;
  }
}

/**
 * Check a podcast source for new content
 * @param {Object} source - Source document
 * @returns {Promise<Array>} - Array of new content documents
 */
async function checkPodcastSource(source) {
  // For podcasts, we'll use the RSS checker since most podcasts have RSS feeds
  return checkRssSource(source);
}

/**
 * Check an academic source for new content
 * @param {Object} source - Source document
 * @returns {Promise<Array>} - Array of new content documents
 */
async function checkAcademicSource(source) {
  // Academic sources often require special handling and authentication
  // This is a placeholder for future implementation
  logger.info(`Academic source checking not fully implemented for source ${source._id}`);
  return [];
}

/**
 * Check a social media source for new content
 * @param {Object} source - Source document
 * @returns {Promise<Array>} - Array of new content documents
 */
async function checkSocialSource(source) {
  // Social media sources often require API access and authentication
  // This is a placeholder for future implementation
  logger.info(`Social source checking not fully implemented for source ${source._id}`);
  return [];
}

/**
 * Determine content type based on item and source type
 * @param {Object} item - RSS item
 * @param {string} sourceType - Source type
 * @returns {string} - Content type
 */
function determineContentType(item, sourceType) {
  if (sourceType === 'podcast') {
    return 'podcast';
  }
  
  if (sourceType === 'academic') {
    return 'paper';
  }
  
  if (sourceType === 'social') {
    return 'social';
  }
  
  // Check for enclosures (typically indicates podcast or video)
  if (item.enclosure) {
    const type = item.enclosure.type || '';
    if (type.startsWith('audio/')) {
      return 'podcast';
    }
    if (type.startsWith('video/')) {
      return 'video';
    }
  }
  
  // Check for media content
  if (item.media) {
    const mediaType = item.media.type || '';
    if (mediaType.startsWith('audio/')) {
      return 'podcast';
    }
    if (mediaType.startsWith('video/')) {
      return 'video';
    }
  }
  
  // Default to article
  return 'article';
}

/**
 * Check if a URL is likely to be a content link
 * @param {string} url - URL to check
 * @param {string} baseUrl - Base URL of the source
 * @returns {boolean} - Whether the URL is likely to be a content link
 */
function isLikelyContentLink(url, baseUrl) {
  // Ignore empty URLs, anchors, and external links
  if (!url || url.startsWith('#') || url.startsWith('javascript:')) {
    return false;
  }
  
  // Normalize URL for comparison
  const normalizedUrl = normalizeUrl(url, baseUrl);
  
  // Check if URL is from the same domain
  try {
    const urlObj = new URL(normalizedUrl);
    const baseUrlObj = new URL(baseUrl);
    
    if (urlObj.hostname !== baseUrlObj.hostname) {
      return false;
    }
  } catch (error) {
    return false;
  }
  
  // Check for common content patterns
  const contentPatterns = [
    /\/article\//i,
    /\/post\//i,
    /\/blog\//i,
    /\/news\//i,
    /\/\d{4}\/\d{2}\/\d{2}\//i, // Date pattern
    /\.html$/i,
    /\.php$/i
  ];
  
  // Check for common non-content patterns
  const nonContentPatterns = [
    /\/tag\//i,
    /\/category\//i,
    /\/author\//i,
    /\/search\//i,
    /\/page\//i,
    /\/wp-content\//i,
    /\/wp-includes\//i,
    /\/wp-admin\//i,
    /\/feed\//i,
    /\/rss\//i,
    /\/comments\//i,
    /\/login\//i,
    /\/register\//i,
    /\/about\//i,
    /\/contact\//i,
    /\/privacy\//i,
    /\/terms\//i
  ];
  
  // Check if URL matches any content pattern
  const isContentPattern = contentPatterns.some(pattern => pattern.test(normalizedUrl));
  
  // Check if URL matches any non-content pattern
  const isNonContentPattern = nonContentPatterns.some(pattern => pattern.test(normalizedUrl));
  
  // Return true if URL matches a content pattern and doesn't match a non-content pattern
  return isContentPattern && !isNonContentPattern;
}

/**
 * Normalize a URL
 * @param {string} url - URL to normalize
 * @param {string} baseUrl - Base URL for relative URLs
 * @returns {string} - Normalized URL
 */
function normalizeUrl(url, baseUrl) {
  try {
    // Handle relative URLs
    return new URL(url, baseUrl).href;
  } catch (error) {
    return url;
  }
}

/**
 * Extract main content from HTML
 * @param {Object} $ - Cheerio object
 * @returns {string} - Extracted content
 */
function extractMainContent($) {
  // This is a simple implementation
  // In a real system, this would be more sophisticated
  
  // Try to find main content container
  const contentSelectors = [
    'article',
    '.post-content',
    '.entry-content',
    '.content',
    '.article-content',
    '.post',
    'main',
    '#content',
    '#main'
  ];
  
  let content = '';
  
  // Try each selector
  for (const selector of contentSelectors) {
    const element = $(selector).first();
    if (element.length) {
      // Remove unwanted elements
      element.find('script, style, nav, header, footer, .comments, .sidebar').remove();
      
      content = element.text().trim();
      if (content) {
        break;
      }
    }
  }
  
  // If no content found, use body text
  if (!content) {
    $('body').find('script, style, nav, header, footer').remove();
    content = $('body').text().trim();
  }
  
  // Clean up content
  return content
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, '\n')
    .trim();
}

module.exports = {
  checkSource,
  checkRssSource,
  checkWebsiteSource,
  checkPodcastSource,
  checkAcademicSource,
  checkSocialSource
};