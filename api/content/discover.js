import { connectToDatabase } from '../../lib/database.js';
import { authenticate } from '../../lib/auth.js';

// Content discovery utilities
import axios from 'axios';
import * as cheerio from 'cheerio';
import crypto from 'crypto';
import Parser from 'rss-parser';

const rssParser = new Parser({
  customFields: {
    item: [
      ['media:content', 'media'],
      ['content:encoded', 'contentEncoded'],
      ['dc:creator', 'creator']
    ]
  }
});

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
      const { sourceId, immediate = false } = req.body;

      if (!sourceId) {
        return res.status(400).json({
          success: false,
          error: 'Source ID is required'
        });
      }

      // Get source
      const [sources] = await db.execute(
        'SELECT * FROM sources WHERE id = ? AND created_by = ?',
        [sourceId, user.id]
      );

      if (sources.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Source not found'
        });
      }

      const source = sources[0];

      if (!source.active) {
        return res.status(400).json({
          success: false,
          error: 'Source is inactive'
        });
      }

      // Check source for new content
      const result = await checkSource(source, db);

      return res.json({
        success: true,
        message: result.message,
        contentFound: result.contentFound,
        newContentCount: result.newContent.length,
        newContent: result.newContent.map(content => ({
          id: content.id,
          title: content.title,
          url: content.url,
          type: content.type,
          publish_date: content.publish_date
        }))
      });
    }

    if (req.method === 'GET') {
      // Get discovery status
      const { sourceId } = req.query;

      if (sourceId) {
        // Get status for specific source
        const [sources] = await db.execute(
          'SELECT * FROM sources WHERE id = ? AND created_by = ?',
          [sourceId, user.id]
        );

        if (sources.length === 0) {
          return res.status(404).json({
            success: false,
            error: 'Source not found'
          });
        }

        const source = sources[0];

        // Get content counts for this source
        const [contentCounts] = await db.execute(
          'SELECT COUNT(*) as total, SUM(processed) as processed FROM content WHERE source_id = ?',
          [sourceId]
        );

        return res.json({
          success: true,
          source: {
            id: source.id,
            name: source.name,
            url: source.url,
            type: source.type,
            active: source.active,
            last_checked: source.last_checked,
            last_updated: source.last_updated,
            error_count: source.error_count,
            last_error: source.last_error
          },
          content: {
            total: contentCounts[0].total,
            processed: contentCounts[0].processed,
            unprocessed: contentCounts[0].total - contentCounts[0].processed
          }
        });
      } else {
        // Get overall discovery status
        const [sourceCounts] = await db.execute(
          'SELECT COUNT(*) as total, SUM(active) as active, SUM(CASE WHEN error_count > 0 THEN 1 ELSE 0 END) as with_errors FROM sources WHERE created_by = ?',
          [user.id]
        );

        const [contentCounts] = await db.execute(
          `SELECT 
            COUNT(*) as total, 
            SUM(processed) as processed,
            SUM(CASE WHEN discovery_date >= DATE_SUB(NOW(), INTERVAL 1 DAY) THEN 1 ELSE 0 END) as last_day
          FROM content c 
          JOIN sources s ON c.source_id = s.id 
          WHERE s.created_by = ?`,
          [user.id]
        );

        return res.json({
          success: true,
          sources: {
            total: sourceCounts[0].total,
            active: sourceCounts[0].active,
            withErrors: sourceCounts[0].with_errors
          },
          content: {
            total: contentCounts[0].total,
            processed: contentCounts[0].processed,
            unprocessed: contentCounts[0].total - contentCounts[0].processed,
            lastDay: contentCounts[0].last_day
          }
        });
      }
    }

    res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    });

  } catch (error) {
    console.error('Content discovery error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      details: error.message 
    });
  }
}

/**
 * Check a source for new content
 */
async function checkSource(source, db) {
  console.log(`Checking source: ${source.name} (${source.id})`);
  
  try {
    let newContent = [];
    
    // Check based on source type
    switch (source.type) {
      case 'rss':
        newContent = await checkRssSource(source, db);
        break;
      case 'website':
      case 'blog':
        newContent = await checkWebsiteSource(source, db);
        break;
      case 'podcast':
        newContent = await checkPodcastSource(source, db);
        break;
      default:
        console.warn(`Unsupported source type: ${source.type} for source ${source.id}`);
    }
    
    // Update source last_checked timestamp
    await db.execute(
      'UPDATE sources SET last_checked = NOW() WHERE id = ?',
      [source.id]
    );
    
    // Update source if content was found
    if (newContent.length > 0) {
      await db.execute(
        'UPDATE sources SET last_updated = NOW(), content_count = content_count + ? WHERE id = ?',
        [newContent.length, source.id]
      );
      
      console.log(`Found ${newContent.length} new content items for source ${source.id}`);
      
      return {
        contentFound: true,
        newContent,
        message: `Found ${newContent.length} new content items`
      };
    } else {
      console.log(`No new content found for source ${source.id}`);
      return {
        contentFound: false,
        newContent: [],
        message: 'No new content found'
      };
    }
  } catch (error) {
    console.error(`Error checking source ${source.id}: ${error.message}`, error);
    
    // Record error on source
    await db.execute(
      'UPDATE sources SET error_count = error_count + 1, last_error = ? WHERE id = ?',
      [error.message, source.id]
    );
    
    throw error;
  }
}

/**
 * Check an RSS source for new content
 */
async function checkRssSource(source, db) {
  try {
    const url = source.url;
    console.log(`Checking RSS feed: ${url}`);
    
    // Fetch RSS feed
    const feed = await rssParser.parseURL(url);
    
    // Process feed items
    const newContent = [];
    
    for (const item of feed.items) {
      // Check if content already exists
      const [existing] = await db.execute(
        'SELECT id FROM content WHERE source_id = ? AND url = ?',
        [source.id, item.link]
      );
      
      if (existing.length === 0) {
        // Create new content
        const [result] = await db.execute(
          `INSERT INTO content (
            source_id, url, title, author, publish_date, discovery_date, 
            type, categories, topics, summary, full_text, processed
          ) VALUES (?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, FALSE)`,
          [
            source.id,
            item.link,
            item.title,
            item.creator || item.author || feed.title,
            item.pubDate ? new Date(item.pubDate) : new Date(),
            determineContentType(item, source.type),
            JSON.stringify(source.categories || []),
            JSON.stringify(source.tags || []),
            item.contentSnippet || item.description,
            item.contentEncoded || item.content || item.description
          ]
        );
        
        const contentId = result.insertId;
        
        // Add to new content array
        newContent.push({
          id: contentId,
          title: item.title,
          url: item.link,
          type: determineContentType(item, source.type),
          publish_date: item.pubDate ? new Date(item.pubDate) : new Date()
        });
        
        console.log(`Created new content: ${item.title} (${contentId})`);
      }
    }
    
    return newContent;
  } catch (error) {
    console.error(`Error checking RSS source ${source.id}: ${error.message}`, error);
    throw error;
  }
}

/**
 * Check a website source for new content
 */
async function checkWebsiteSource(source, db) {
  try {
    console.log(`Checking website: ${source.url}`);
    
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
    const [metadata] = await db.execute(
      'SELECT metadata FROM sources WHERE id = ?',
      [source.id]
    );
    
    const sourceMetadata = metadata[0]?.metadata ? JSON.parse(metadata[0].metadata) : {};
    const previousHash = sourceMetadata.contentHash;
    
    if (previousHash === contentHash) {
      console.log(`No changes detected for website ${source.id}`);
      return [];
    }
    
    // Update content hash in source metadata
    sourceMetadata.contentHash = contentHash;
    sourceMetadata.lastCheckedContent = new Date().toISOString();
    
    await db.execute(
      'UPDATE sources SET metadata = ? WHERE id = ?',
      [JSON.stringify(sourceMetadata), source.id]
    );
    
    // Find potential content links
    const contentLinks = [];
    
    // Look for article links - this is a simple implementation
    $('a').each((i, element) => {
      const href = $(element).attr('href');
      if (href && isLikelyContentLink(href, source.url)) {
        contentLinks.push(normalizeUrl(href, source.url));
      }
    });
    
    // Process content links (limit to prevent overwhelming)
    const newContent = [];
    const maxLinks = 10; // Limit to prevent timeout
    
    for (let i = 0; i < Math.min(contentLinks.length, maxLinks); i++) {
      const url = contentLinks[i];
      
      // Check if content already exists
      const [existing] = await db.execute(
        'SELECT id FROM content WHERE source_id = ? AND url = ?',
        [source.id, url]
      );
      
      if (existing.length === 0) {
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
          
          // Extract content details
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
          const [result] = await db.execute(
            `INSERT INTO content (
              source_id, url, title, author, publish_date, discovery_date, 
              type, categories, topics, summary, full_text, processed
            ) VALUES (?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, FALSE)`,
            [
              source.id,
              url,
              title,
              author,
              publishDate,
              'article', // Default to article for websites
              JSON.stringify(source.categories || []),
              JSON.stringify(source.tags || []),
              contentText.substring(0, 500) + (contentText.length > 500 ? '...' : ''),
              contentText
            ]
          );
          
          const contentId = result.insertId;
          
          // Add to new content array
          newContent.push({
            id: contentId,
            title,
            url,
            type: 'article',
            publish_date: publishDate
          });
          
          console.log(`Created new content: ${title} (${contentId})`);
        } catch (contentError) {
          console.error(`Error fetching content from ${url}: ${contentError.message}`);
          // Continue with next content link
        }
      }
    }
    
    return newContent;
  } catch (error) {
    console.error(`Error checking website source ${source.id}: ${error.message}`, error);
    throw error;
  }
}

/**
 * Check a podcast source for new content
 */
async function checkPodcastSource(source, db) {
  // For podcasts, we'll use the RSS checker since most podcasts have RSS feeds
  return checkRssSource(source, db);
}

/**
 * Determine content type based on item and source type
 */
function determineContentType(item, sourceType) {
  if (sourceType === 'podcast') {
    return 'podcast';
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
 */
function extractMainContent($) {
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