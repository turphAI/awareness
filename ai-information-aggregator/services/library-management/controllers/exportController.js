const ExportManager = require('../utils/exportManager');
const Collection = require('../models/Collection');
const ContentMetadata = require('../models/ContentMetadata');
const Content = require('../../content-discovery/models/Content');
const { validationResult } = require('express-validator');

/**
 * Export Controller
 * Handles content export functionality
 */
class ExportController {
  constructor() {
    this.exportManager = new ExportManager();
  }

  /**
   * Export content by IDs
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async exportContentByIds(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const {
        contentIds,
        format = 'json',
        citationStyle = 'apa',
        includeMetadata = true,
        includeFullText = false,
        includeReferences = true,
        filename
      } = req.body;

      // Fetch content data
      const content = await Content.find({
        _id: { $in: contentIds }
      }).populate('references');

      if (content.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No content found for the provided IDs'
        });
      }

      // Export content
      const exportResult = await this.exportManager.exportContent(content, {
        format,
        citationStyle,
        includeMetadata,
        includeFullText,
        includeReferences,
        filename
      });

      // Set appropriate headers
      const suggestedFilename = filename || `content_export_${Date.now()}.${exportResult.extension}`;
      
      res.set({
        'Content-Type': exportResult.mimeType,
        'Content-Disposition': `attachment; filename="${suggestedFilename}"`,
        'Content-Length': exportResult.size
      });

      res.status(200).send(exportResult.data);

    } catch (error) {
      req.app.locals.logger.error('Error exporting content by IDs:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to export content',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Export collection content
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async exportCollection(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { collectionId } = req.params;
      const {
        format = 'json',
        citationStyle = 'apa',
        includeMetadata = true,
        includeFullText = false,
        includeReferences = true,
        filename
      } = req.body;

      // Fetch collection
      const collection = await Collection.findById(collectionId);
      if (!collection) {
        return res.status(404).json({
          success: false,
          message: 'Collection not found'
        });
      }

      // Check if user has access to collection
      const userId = req.user?.id;
      const hasAccess = collection.public || 
                       collection.userId.toString() === userId ||
                       collection.collaborators.some(c => c.userId.toString() === userId);

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this collection'
        });
      }

      // Fetch content from collection
      const content = await Content.find({
        _id: { $in: collection.contentIds }
      }).populate('references');

      if (content.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No content found in this collection'
        });
      }

      // Export content
      const exportResult = await this.exportManager.exportContent(content, {
        format,
        citationStyle,
        includeMetadata,
        includeFullText,
        includeReferences,
        filename
      });

      // Set appropriate headers
      const suggestedFilename = filename || `${collection.name.replace(/[^a-zA-Z0-9]/g, '_')}_export_${Date.now()}.${exportResult.extension}`;
      
      res.set({
        'Content-Type': exportResult.mimeType,
        'Content-Disposition': `attachment; filename="${suggestedFilename}"`,
        'Content-Length': exportResult.size
      });

      res.status(200).send(exportResult.data);

    } catch (error) {
      req.app.locals.logger.error('Error exporting collection:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to export collection',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Export search results
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async exportSearchResults(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const {
        query,
        filters = {},
        format = 'json',
        citationStyle = 'apa',
        includeMetadata = true,
        includeFullText = false,
        includeReferences = true,
        limit = 100,
        filename
      } = req.body;

      // Build search query
      const searchQuery = {
        processed: true,
        ...filters
      };

      if (query) {
        searchQuery.$or = [
          { title: { $regex: query, $options: 'i' } },
          { summary: { $regex: query, $options: 'i' } },
          { keyInsights: { $elemMatch: { $regex: query, $options: 'i' } } }
        ];
      }

      // Fetch content
      const content = await Content.find(searchQuery)
        .populate('references')
        .limit(limit)
        .sort({ relevanceScore: -1, publishDate: -1 });

      if (content.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No content found matching the search criteria'
        });
      }

      // Export content
      const exportResult = await this.exportManager.exportContent(content, {
        format,
        citationStyle,
        includeMetadata,
        includeFullText,
        includeReferences,
        filename
      });

      // Set appropriate headers
      const suggestedFilename = filename || `search_results_export_${Date.now()}.${exportResult.extension}`;
      
      res.set({
        'Content-Type': exportResult.mimeType,
        'Content-Disposition': `attachment; filename="${suggestedFilename}"`,
        'Content-Length': exportResult.size
      });

      res.status(200).send(exportResult.data);

    } catch (error) {
      req.app.locals.logger.error('Error exporting search results:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to export search results',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Export user's saved content
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async exportUserSavedContent(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const {
        format = 'json',
        citationStyle = 'apa',
        includeMetadata = true,
        includeFullText = false,
        includeReferences = true,
        limit = 1000,
        filename
      } = req.body;

      // Find user's saved content
      const content = await Content.find({
        'userInteractions': {
          $elemMatch: {
            userId,
            interactionType: 'save'
          }
        }
      })
        .populate('references')
        .limit(limit)
        .sort({ 'userInteractions.timestamp': -1 });

      if (content.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No saved content found'
        });
      }

      // Export content
      const exportResult = await this.exportManager.exportContent(content, {
        format,
        citationStyle,
        includeMetadata,
        includeFullText,
        includeReferences,
        filename
      });

      // Set appropriate headers
      const suggestedFilename = filename || `saved_content_export_${Date.now()}.${exportResult.extension}`;
      
      res.set({
        'Content-Type': exportResult.mimeType,
        'Content-Disposition': `attachment; filename="${suggestedFilename}"`,
        'Content-Length': exportResult.size
      });

      res.status(200).send(exportResult.data);

    } catch (error) {
      req.app.locals.logger.error('Error exporting user saved content:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to export saved content',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Get export options
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getExportOptions(req, res) {
    try {
      const options = {
        supportedFormats: this.exportManager.getSupportedFormats(),
        supportedCitationStyles: this.exportManager.getSupportedCitationStyles(),
        formatDescriptions: {
          json: 'JavaScript Object Notation - structured data format',
          csv: 'Comma Separated Values - spreadsheet compatible',
          bibtex: 'BibTeX format for LaTeX bibliography management',
          ris: 'Research Information Systems format',
          markdown: 'Markdown format for documentation',
          html: 'HTML format for web viewing'
        },
        citationStyleDescriptions: {
          apa: 'American Psychological Association style',
          mla: 'Modern Language Association style',
          chicago: 'Chicago Manual of Style',
          ieee: 'Institute of Electrical and Electronics Engineers style',
          harvard: 'Harvard referencing style'
        }
      };

      res.status(200).json({
        success: true,
        data: options
      });

    } catch (error) {
      req.app.locals.logger.error('Error getting export options:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get export options',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Preview export (returns first few items without triggering download)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async previewExport(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const {
        contentIds,
        format = 'json',
        citationStyle = 'apa',
        includeMetadata = true,
        includeFullText = false,
        includeReferences = true,
        previewLimit = 3
      } = req.body;

      // Fetch limited content data
      const content = await Content.find({
        _id: { $in: contentIds }
      })
        .populate('references')
        .limit(previewLimit);

      if (content.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No content found for preview'
        });
      }

      // Generate preview
      const exportResult = await this.exportManager.exportContent(content, {
        format,
        citationStyle,
        includeMetadata,
        includeFullText,
        includeReferences
      });

      res.status(200).json({
        success: true,
        data: {
          preview: exportResult.data,
          metadata: exportResult.metadata,
          totalItemsToExport: contentIds.length,
          previewItemCount: content.length
        }
      });

    } catch (error) {
      req.app.locals.logger.error('Error generating export preview:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate export preview',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
}

module.exports = new ExportController();