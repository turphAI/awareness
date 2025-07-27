const axios = require('axios');
const { URL } = require('url');
const cheerio = require('cheerio');
const createLogger = require('../../../common/utils/logger');

// Configure logger
const logger = createLogger('url-validator');

/**
 * URL Validator utility for validating and checking URLs
 */
class UrlValidator {
  /**
   * Validate URL format
   * @param {string} url - URL to validate
   * @returns {boolean} - Whether URL is valid
   */
  static isValidFormat(url) {
    try {
      new URL(url);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if URL is reachable
   * @param {string} url - URL to check
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<boolean>} - Whether URL is reachable
   */
  static async isReachable(url, timeout = 5000) {
    try {
      // Add protocol if missing
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }

      const response = await axios.head(url, {
        timeout,
        validateStatus: status => status < 500 // Accept any status code less than 500
      });

      return response.status < 400; // Consider 2xx and 3xx as success
    } catch (error) {
      logger.debug(`URL check failed for ${url}: ${error.message}`);
      return false;
    }
  }

  /**
   * Get URL metadata
   * @param {string} url - URL to check
   * @returns {Promise<Object>} - URL metadata
   */
  static async getMetadata(url) {
    try {
      // Add protocol if missing
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }

      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'AI-Information-Aggregator/1.0'
        }
      });

      const html = response.data;
      const $ = cheerio.load(html);
      
      // Extract metadata from HTML
      const title = $('title').text().trim() || $('meta[property="og:title"]').attr('content') || '';
      const description = $('meta[name="description"]').attr('content') || 
                         $('meta[property="og:description"]').attr('content') || '';
      const author = $('meta[name="author"]').attr('content') || '';
      const keywords = $('meta[name="keywords"]').attr('content') || '';
      const favicon = $('link[rel="icon"]').attr('href') || 
                     $('link[rel="shortcut icon"]').attr('href') || '';
      
      // Extract RSS feed links
      const rssLinks = [];
      $('link[type="application/rss+xml"]').each((i, el) => {
        rssLinks.push($(el).attr('href'));
      });
      
      // Extract social media links
      const socialLinks = {};
      $('a[href*="twitter.com"]').first().each((i, el) => {
        socialLinks.twitter = $(el).attr('href');
      });
      $('a[href*="facebook.com"]').first().each((i, el) => {
        socialLinks.facebook = $(el).attr('href');
      });
      $('a[href*="linkedin.com"]').first().each((i, el) => {
        socialLinks.linkedin = $(el).attr('href');
      });
      $('a[href*="github.com"]').first().each((i, el) => {
        socialLinks.github = $(el).attr('href');
      });
      
      // Extract publication date if available
      let publishDate = $('meta[property="article:published_time"]').attr('content') || 
                       $('meta[name="date"]').attr('content') || null;
      
      // Normalize favicon URL if it's relative
      if (favicon && !favicon.startsWith('http')) {
        const urlObj = new URL(url);
        const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
        if (favicon.startsWith('/')) {
          favicon = baseUrl + favicon;
        } else {
          favicon = baseUrl + '/' + favicon;
        }
      }
      
      // Normalize RSS links if they're relative
      const normalizedRssLinks = rssLinks.map(link => {
        if (!link.startsWith('http')) {
          const urlObj = new URL(url);
          const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
          if (link.startsWith('/')) {
            return baseUrl + link;
          } else {
            return baseUrl + '/' + link;
          }
        }
        return link;
      });

      const metadata = {
        status: response.status,
        contentType: response.headers['content-type'],
        lastModified: response.headers['last-modified'],
        server: response.headers['server'],
        size: response.headers['content-length'] ? parseInt(response.headers['content-length']) : null,
        title,
        description,
        author,
        keywords: keywords ? keywords.split(',').map(k => k.trim()) : [],
        favicon,
        rssLinks: normalizedRssLinks,
        socialLinks,
        publishDate,
        language: $('html').attr('lang') || null
      };

      return metadata;
    } catch (error) {
      logger.error(`Error getting URL metadata for ${url}: ${error.message}`);
      return {
        error: error.message,
        status: error.response ? error.response.status : null
      };
    }
  }

  /**
   * Detect URL type based on content and URL pattern
   * @param {string} url - URL to check
   * @returns {Promise<string>} - URL type (website, blog, academic, podcast, social, newsletter, rss)
   */
  static async detectType(url) {
    try {
      // Add protocol if missing
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }

      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();

      // Check for RSS feeds
      if (url.includes('.rss') || url.includes('/rss') || url.includes('/feed') || url.includes('atom.xml')) {
        return 'rss';
      }

      // Check for podcasts
      if (hostname.includes('podcast') || hostname.includes('anchor.fm') || hostname.includes('libsyn.com') || 
          hostname.includes('soundcloud.com') || hostname.includes('spotify.com/show')) {
        return 'podcast';
      }

      // Check for academic sources
      if (hostname.includes('arxiv.org') || hostname.includes('scholar.google.com') || 
          hostname.includes('researchgate.net') || hostname.includes('academia.edu') ||
          hostname.includes('sciencedirect.com') || hostname.includes('ieee.org') ||
          hostname.includes('acm.org') || hostname.includes('springer.com')) {
        return 'academic';
      }

      // Check for social media
      if (hostname.includes('twitter.com') || hostname.includes('x.com') || 
          hostname.includes('facebook.com') || hostname.includes('instagram.com') ||
          hostname.includes('linkedin.com') || hostname.includes('reddit.com') ||
          hostname.includes('tiktok.com') || hostname.includes('youtube.com')) {
        return 'social';
      }

      // Check for newsletters
      if (hostname.includes('substack.com') || hostname.includes('mailchimp.com') ||
          hostname.includes('revue.co') || hostname.includes('convertkit.com') ||
          url.includes('/newsletter')) {
        return 'newsletter';
      }

      // Try to determine if it's a blog by checking content
      try {
        const response = await axios.get(url, {
          timeout: 10000,
          headers: {
            'User-Agent': 'AI-Information-Aggregator/1.0'
          }
        });

        const html = response.data.toLowerCase();
        
        // Check for common blog indicators
        if (html.includes('blog') || html.includes('article') || html.includes('post') ||
            html.includes('author') || html.includes('published') || html.includes('comments')) {
          return 'blog';
        }
      } catch (error) {
        logger.debug(`Error checking content for ${url}: ${error.message}`);
      }

      // Default to website
      return 'website';
    } catch (error) {
      logger.error(`Error detecting URL type for ${url}: ${error.message}`);
      return 'website'; // Default to website
    }
  }

  /**
   * Check if URL is an RSS feed
   * @param {string} url - URL to check
   * @returns {Promise<boolean>} - Whether URL is an RSS feed
   */
  static async isRssFeed(url) {
    try {
      // Add protocol if missing
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }

      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'AI-Information-Aggregator/1.0'
        }
      });

      const contentType = response.headers['content-type'];
      const data = response.data;

      // Check content type
      if (contentType && (
          contentType.includes('application/rss+xml') ||
          contentType.includes('application/atom+xml') ||
          contentType.includes('application/xml') ||
          contentType.includes('text/xml')
      )) {
        return true;
      }

      // Check content
      if (typeof data === 'string') {
        const lowerData = data.toLowerCase();
        if ((lowerData.includes('<rss') || lowerData.includes('<feed')) &&
            (lowerData.includes('<item>') || lowerData.includes('<entry>'))) {
          return true;
        }
      }

      return false;
    } catch (error) {
      logger.debug(`Error checking if URL is RSS feed for ${url}: ${error.message}`);
      return false;
    }
  }

  /**
   * Find RSS feed URL for a website
   * @param {string} url - Website URL
   * @returns {Promise<string|null>} - RSS feed URL or null if not found
   */
  static async findRssFeed(url) {
    try {
      // Add protocol if missing
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }

      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'AI-Information-Aggregator/1.0'
        }
      });

      const html = response.data;
      const urlObj = new URL(url);
      const baseUrl = `${urlObj.protocol}//${urlObj.host}`;

      // Common RSS feed paths to check
      const commonPaths = [
        '/feed',
        '/rss',
        '/atom.xml',
        '/feed.xml',
        '/rss.xml',
        '/index.xml',
        '/feeds/posts/default',
        '/blog/feed',
        '/blog/atom',
        '/rss/all.xml'
      ];

      // Check if the page has RSS link tags
      const rssRegex = /<link[^>]*type=["'](application\/rss\+xml|application\/atom\+xml)["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
      let match;
      const feedUrls = [];

      while ((match = rssRegex.exec(html)) !== null) {
        let feedUrl = match[2];
        
        // Handle relative URLs
        if (feedUrl.startsWith('/')) {
          feedUrl = baseUrl + feedUrl;
        } else if (!feedUrl.startsWith('http')) {
          feedUrl = baseUrl + '/' + feedUrl;
        }
        
        feedUrls.push(feedUrl);
      }

      // If we found feed URLs in the HTML, return the first one
      if (feedUrls.length > 0) {
        return feedUrls[0];
      }

      // If no feed URLs found in HTML, try common paths
      for (const path of commonPaths) {
        const feedUrl = new URL(path, baseUrl).href;
        try {
          const isRss = await this.isRssFeed(feedUrl);
          if (isRss) {
            return feedUrl;
          }
        } catch (error) {
          // Continue to next path
        }
      }

      return null;
    } catch (error) {
      logger.error(`Error finding RSS feed for ${url}: ${error.message}`);
      return null;
    }
  }

  /**
   * Validate and extract comprehensive source information
   * @param {string} url - URL to validate
   * @returns {Promise<Object>} - Source information
   */
  static async validateAndExtractSourceInfo(url) {
    try {
      // Validate URL format
      if (!this.isValidFormat(url)) {
        return {
          valid: false,
          error: 'Invalid URL format'
        };
      }

      // Add protocol if missing
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }

      // Check if URL is reachable
      const isReachable = await this.isReachable(url);
      if (!isReachable) {
        return {
          valid: false,
          error: 'URL is not reachable'
        };
      }

      // Get metadata
      const metadata = await this.getMetadata(url);
      if (metadata.error) {
        return {
          valid: false,
          error: `Error fetching metadata: ${metadata.error}`
        };
      }

      // Detect source type
      const type = await this.detectType(url);

      // Check for RSS feed
      let rssUrl = null;
      if (type !== 'rss') {
        rssUrl = await this.findRssFeed(url);
      }

      // Prepare source information
      const sourceInfo = {
        valid: true,
        url,
        name: metadata.title || new URL(url).hostname,
        description: metadata.description || '',
        type,
        metadata: {
          ...metadata
        }
      };

      // Add type-specific fields
      if (type === 'rss' || rssUrl) {
        sourceInfo.rssUrl = type === 'rss' ? url : rssUrl;
      }

      if (type === 'podcast') {
        sourceInfo.podcastAuthor = metadata.author || '';
        sourceInfo.podcastLanguage = metadata.language || 'en';
      }

      if (type === 'academic') {
        const urlObj = new URL(url);
        sourceInfo.academicPublisher = metadata.author || '';
        sourceInfo.academicDomain = urlObj.hostname;
      }

      if (type === 'social') {
        const urlObj = new URL(url);
        sourceInfo.socialPlatform = this.detectSocialPlatform(urlObj.hostname);
        sourceInfo.socialUsername = this.extractSocialUsername(url);
      }

      return sourceInfo;
    } catch (error) {
      logger.error(`Error validating URL ${url}: ${error.message}`);
      return {
        valid: false,
        error: `Validation error: ${error.message}`
      };
    }
  }

  /**
   * Detect social media platform from hostname
   * @param {string} hostname - URL hostname
   * @returns {string} - Social platform name
   */
  static detectSocialPlatform(hostname) {
    if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
      return 'Twitter';
    } else if (hostname.includes('facebook.com')) {
      return 'Facebook';
    } else if (hostname.includes('instagram.com')) {
      return 'Instagram';
    } else if (hostname.includes('linkedin.com')) {
      return 'LinkedIn';
    } else if (hostname.includes('youtube.com')) {
      return 'YouTube';
    } else if (hostname.includes('tiktok.com')) {
      return 'TikTok';
    } else if (hostname.includes('reddit.com')) {
      return 'Reddit';
    } else {
      return 'Other';
    }
  }

  /**
   * Extract username from social media URL
   * @param {string} url - Social media URL
   * @returns {string} - Username
   */
  static extractSocialUsername(url) {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      
      if (urlObj.hostname.includes('twitter.com') || urlObj.hostname.includes('x.com')) {
        return pathParts[0] || '';
      } else if (urlObj.hostname.includes('facebook.com')) {
        return pathParts[0] || '';
      } else if (urlObj.hostname.includes('instagram.com')) {
        return pathParts[0] || '';
      } else if (urlObj.hostname.includes('linkedin.com')) {
        if (pathParts[0] === 'in') {
          return pathParts[1] || '';
        }
        return pathParts[0] || '';
      } else if (urlObj.hostname.includes('youtube.com')) {
        if (pathParts[0] === 'channel' || pathParts[0] === 'c' || pathParts[0] === 'user') {
          return pathParts[1] || '';
        }
        return '';
      } else if (urlObj.hostname.includes('reddit.com')) {
        if (pathParts[0] === 'r') {
          return pathParts[1] || '';
        } else if (pathParts[0] === 'user') {
          return pathParts[1] || '';
        }
        return '';
      }
      
      return pathParts[0] || '';
    } catch (error) {
      logger.error(`Error extracting social username from ${url}: ${error.message}`);
      return '';
    }
  }
}

module.exports = UrlValidator;