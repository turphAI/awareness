const createLogger = require('../../../common/utils/logger');
const Content = require('../models/Content');
const academicCitationExtractor = require('../utils/academicCitationExtractor');

// Initialize logger
const logger = createLogger('academic-controller');

/**
 * Extract citations from academic paper
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function extractPaperCitations(req, res, next) {
  try {
    const { contentId } = req.params;
    
    if (!contentId) {
      return res.status(400).json({
        success: false,
        message: 'Content ID is required'
      });
    }
    
    // Get content
    const content = await Content.findById(contentId);
    
    if (!content) {
      return res.status(404).json({
        success: false,
        message: 'Content not found'
      });
    }
    
    // Check if content is an academic paper
    if (content.type !== 'paper') {
      return res.status(400).json({
        success: false,
        message: 'Content is not an academic paper'
      });
    }
    
    // Extract citations
    const result = await academicCitationExtractor.extractCitations(content);
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: `Error extracting citations: ${result.error}`
      });
    }
    
    res.status(200).json({
      success: true,
      message: `Extracted ${result.extractedCount} citations, saved ${result.savedCount} references`,
      extractedCount: result.extractedCount,
      savedCount: result.savedCount,
      references: result.references
    });
  } catch (error) {
    logger.error(`Error extracting paper citations: ${error.message}`, { error });
    next(error);
  }
}

/**
 * Process academic papers for citation extraction
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function processAcademicPapers(req, res, next) {
  try {
    const { limit = 50 } = req.query;
    
    // Process academic papers
    const result = await academicCitationExtractor.processAcademicPapers(parseInt(limit));
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: `Error processing academic papers: ${result.error}`
      });
    }
    
    res.status(200).json({
      success: true,
      message: `Processed ${result.processed} papers, extracted ${result.totalExtracted} citations`,
      processed: result.processed,
      succeeded: result.succeeded,
      failed: result.failed,
      totalExtracted: result.totalExtracted,
      totalSaved: result.totalSaved
    });
  } catch (error) {
    logger.error(`Error processing academic papers: ${error.message}`, { error });
    next(error);
  }
}

module.exports = {
  extractPaperCitations,
  processAcademicPapers
};