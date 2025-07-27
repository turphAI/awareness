/**
 * Source Locator Utility
 * 
 * Responsible for locating original sources for references extracted from podcasts.
 * Implements search functionality and source validation.
 */

const axios = require('axios');
const mongoose = require('mongoose');
const logger = require('../../../common/utils/logger');
const Reference = require('../../content-discovery/models/Reference');
const Content = require('../../content-discovery/models/Content');
const Source = require('../../source-management/models/Source');
const discoveryQueue = require('../../content-discovery/utils/discoveryQueue');

class SourceLocator {
  /**
   * Search for the original source of a reference
   * @param {Object} reference - The reference object containing title, authors, etc.
   * @returns {Promise<Object>} - The located source or null if not found
   */
  async locateSource(reference) {
    try {
      logger.info(`Attempting to locate source for reference: ${reference.title}`);
      
      // First check if we already have this content in our database
      const existingContent = await this._findExistingContent(reference);
      if (existingContent) {
        logger.info(`Found existing content for reference: ${reference.title}`);
        return {
          found: true,
          source: existingContent,
          sourceType: 'existing'
        };
      }
      
      // Try to locate the source using different strategies
      const strategies = [
        this._searchByUrl,
        this._searchByDOI,
        this._searchByTitleAndAuthors,
        this._searchAcademicDatabases
      ];
      
      for (const strategy of strategies) {
        const result = await strategy.call(this, reference);
        if (result && result.found) {
          return result;
        }
      }
      
      // If we couldn't locate the source automatically, queue for manual resolution
      await this._queueForManualResolution(reference);
      
      return {
        found: false,
        message: 'Source not found automatically, queued for manual resolution'
      };
    } catch (error) {
      logger.error(`Error locating source: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Validate a located source
   * @param {Object} source - The source to validate
   * @returns {Promise<boolean>} - Whether the source is valid
   */
  async validateSource(source) {
    try {
      // Check if the source is accessible
      if (source.url) {
        const isAccessible = await this._checkUrlAccessibility(source.url);
        if (!isAccessible) {
          logger.warn(`Source URL is not accessible: ${source.url}`);
          return false;
        }
      }
      
      // Check if the source meets minimum metadata requirements
      if (!source.title || source.title.trim() === '') {
        logger.warn('Source validation failed: Missing title');
        return false;
      }
      
      // Additional validation logic can be added here
      
      return true;
    } catch (error) {
      logger.error(`Error validating source: ${error.message}`, { error });
      return false;
    }
  }
  
  /**
   * Find existing content in the database that matches the reference
   * @param {Object} reference - The reference to search for
   * @returns {Promise<Object|null>} - The existing content or null
   */
  async _findExistingContent(reference) {
    // Try to find by URL if available
    if (reference.url) {
      const contentByUrl = await Content.findOne({ url: reference.url });
      if (contentByUrl) return contentByUrl;
    }
    
    // Try to find by title and authors
    if (reference.title) {
      const query = { title: { $regex: new RegExp(reference.title, 'i') } };
      
      if (reference.authors && reference.authors.length > 0) {
        // If we have authors, try to match at least one
        query.author = { $regex: new RegExp(reference.authors[0], 'i') };
      }
      
      const contentByTitle = await Content.findOne(query);
      if (contentByTitle) return contentByTitle;
    }
    
    return null;
  }
  
  /**
   * Search for a source by URL
   * @param {Object} reference - The reference containing a URL
   * @returns {Promise<Object|null>} - The search result
   */
  async _searchByUrl(reference) {
    if (!reference.url) return { found: false };
    
    try {
      // Check if URL is valid and accessible
      const isAccessible = await this._checkUrlAccessibility(reference.url);
      if (!isAccessible) return { found: false };
      
      // Create a new source from the URL
      const sourceData = {
        url: reference.url,
        name: reference.title || 'Unknown Source',
        type: this._determineSourceType(reference),
        discoveredFrom: reference.sourceContentId,
        active: true
      };
      
      return {
        found: true,
        source: sourceData,
        sourceType: 'new'
      };
    } catch (error) {
      logger.error(`Error searching by URL: ${error.message}`, { error });
      return { found: false };
    }
  }
  
  /**
   * Search for a source by DOI (Digital Object Identifier)
   * @param {Object} reference - The reference potentially containing a DOI
   * @returns {Promise<Object|null>} - The search result
   */
  async _searchByDOI(reference) {
    // Extract DOI from reference if available
    const doi = this._extractDOI(reference);
    if (!doi) return { found: false };
    
    try {
      // Use DOI API to get metadata
      const response = await axios.get(`https://doi.org/${doi}`, {
        headers: { 'Accept': 'application/json' }
      });
      
      if (response.status === 200 && response.data) {
        const sourceData = {
          url: `https://doi.org/${doi}`,
          name: response.data.title || reference.title,
          type: 'academic',
          authors: response.data.author ? response.data.author.map(a => a.family + ', ' + a.given).join('; ') : '',
          publishDate: response.data.published ? new Date(response.data.published['date-parts'][0].join('-')) : null,
          discoveredFrom: reference.sourceContentId,
          active: true
        };
        
        return {
          found: true,
          source: sourceData,
          sourceType: 'new'
        };
      }
      
      return { found: false };
    } catch (error) {
      logger.error(`Error searching by DOI: ${error.message}`, { error });
      return { found: false };
    }
  }
  
  /**
   * Search for a source by title and authors
   * @param {Object} reference - The reference containing title and authors
   * @returns {Promise<Object|null>} - The search result
   */
  async _searchByTitleAndAuthors(reference) {
    if (!reference.title) return { found: false };
    
    try {
      // Use a search API to find the source
      // This is a simplified example - in a real implementation,
      // you might use Google Scholar, Semantic Scholar, or other APIs
      
      // For now, we'll just create a source with the available information
      const sourceData = {
        name: reference.title,
        type: this._determineSourceType(reference),
        authors: reference.authors ? reference.authors.join('; ') : '',
        discoveredFrom: reference.sourceContentId,
        active: true
      };
      
      return {
        found: true,
        source: sourceData,
        sourceType: 'new',
        confidence: 'low' // Low confidence since we couldn't verify with a URL
      };
    } catch (error) {
      logger.error(`Error searching by title and authors: ${error.message}`, { error });
      return { found: false };
    }
  }
  
  /**
   * Search academic databases for a reference
   * @param {Object} reference - The reference to search for
   * @returns {Promise<Object|null>} - The search result
   */
  async _searchAcademicDatabases(reference) {
    if (!reference.title || !reference.authors || reference.authors.length === 0) {
      return { found: false };
    }
    
    try {
      // This would integrate with academic APIs like:
      // - Semantic Scholar
      // - CrossRef
      // - PubMed
      // - arXiv
      
      // For this implementation, we'll simulate a search result
      // In a real implementation, you would make API calls to these services
      
      logger.info(`Simulating academic database search for: ${reference.title}`);
      
      // Simulate a 30% chance of finding the reference
      if (Math.random() > 0.7) {
        const sourceData = {
          name: reference.title,
          type: 'academic',
          url: `https://example.org/papers/${encodeURIComponent(reference.title.toLowerCase().replace(/\s+/g, '-'))}`,
          authors: reference.authors.join('; '),
          publishDate: reference.publishDate || null,
          discoveredFrom: reference.sourceContentId,
          active: true
        };
        
        return {
          found: true,
          source: sourceData,
          sourceType: 'new',
          confidence: 'medium'
        };
      }
      
      return { found: false };
    } catch (error) {
      logger.error(`Error searching academic databases: ${error.message}`, { error });
      return { found: false };
    }
  }
  
  /**
   * Queue a reference for manual resolution
   * @param {Object} reference - The reference to queue
   * @returns {Promise<void>}
   */
  async _queueForManualResolution(reference) {
    try {
      // Update the reference to indicate it needs manual resolution
      await Reference.findByIdAndUpdate(
        reference._id,
        { 
          $set: { 
            resolved: false,
            needsManualResolution: true,
            resolutionAttempts: (reference.resolutionAttempts || 0) + 1
          }
        }
      );
      
      // Add to discovery queue with high priority for manual review
      await discoveryQueue.addToQueue({
        type: 'manual_reference_resolution',
        referenceId: reference._id,
        title: reference.title,
        priority: 'high',
        addedAt: new Date()
      });
      
      logger.info(`Reference queued for manual resolution: ${reference.title}`);
    } catch (error) {
      logger.error(`Error queueing for manual resolution: ${error.message}`, { error });
      throw error;
    }
  }
  
  /**
   * Check if a URL is accessible
   * @param {string} url - The URL to check
   * @returns {Promise<boolean>} - Whether the URL is accessible
   */
  async _checkUrlAccessibility(url) {
    try {
      const response = await axios.head(url, { 
        timeout: 5000,
        validateStatus: status => status < 400
      });
      return response.status < 400;
    } catch (error) {
      logger.debug(`URL not accessible: ${url}`, { error: error.message });
      return false;
    }
  }
  
  /**
   * Extract DOI from a reference
   * @param {Object} reference - The reference to extract from
   * @returns {string|null} - The extracted DOI or null
   */
  _extractDOI(reference) {
    // Check if DOI is directly available
    if (reference.doi) return reference.doi;
    
    // Try to extract from URL
    if (reference.url) {
      const doiMatch = reference.url.match(/doi\.org\/([^\/\s]+)/i);
      if (doiMatch && doiMatch[1]) return doiMatch[1];
    }
    
    // Try to extract from context
    if (reference.context) {
      const contextDoiMatch = reference.context.match(/doi:?\s*([^\s]+)/i);
      if (contextDoiMatch && contextDoiMatch[1]) return contextDoiMatch[1];
    }
    
    return null;
  }
  
  /**
   * Determine the source type based on reference metadata
   * @param {Object} reference - The reference to analyze
   * @returns {string} - The determined source type
   */
  _determineSourceType(reference) {
    if (reference.url) {
      if (reference.url.includes('arxiv.org') || 
          reference.url.includes('doi.org') || 
          reference.url.includes('academia.edu') ||
          reference.url.includes('researchgate.net')) {
        return 'academic';
      }
      
      if (reference.url.includes('youtube.com') || 
          reference.url.includes('vimeo.com')) {
        return 'video';
      }
      
      if (reference.url.includes('twitter.com') || 
          reference.url.includes('facebook.com') ||
          reference.url.includes('linkedin.com')) {
        return 'social';
      }
      
      if (reference.url.includes('medium.com') || 
          reference.url.includes('blog.') ||
          reference.url.includes('.blog')) {
        return 'blog';
      }
    }
    
    // Default to website
    return 'website';
  }
}

module.exports = new SourceLocator();