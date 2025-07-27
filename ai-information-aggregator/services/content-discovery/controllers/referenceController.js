const createLogger = require('../../../common/utils/logger');
const Content = require('../models/Content');
const Reference = require('../models/Reference');
const referenceExtractor = require('../utils/referenceExtractor');

// Initialize logger
const logger = createLogger('reference-controller');

/**
 * Extract references from content
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function extractContentReferences(req, res, next) {
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
    
    // Extract references
    const result = await referenceExtractor.extractReferences(content);
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: `Error extracting references: ${result.error}`
      });
    }
    
    res.status(200).json({
      success: true,
      message: `Extracted ${result.extractedCount} references, saved ${result.savedCount}`,
      extractedCount: result.extractedCount,
      savedCount: result.savedCount,
      references: result.references.map(ref => ({
        id: ref._id,
        type: ref.referenceType,
        title: ref.title,
        url: ref.url,
        resolved: ref.resolved,
        targetContentId: ref.targetContentId
      }))
    });
  } catch (error) {
    logger.error(`Error extracting content references: ${error.message}`, { error });
    next(error);
  }
}

/**
 * Process unresolved references
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function processUnresolvedReferences(req, res, next) {
  try {
    const { limit = 100 } = req.query;
    
    // Process unresolved references
    const result = await referenceExtractor.processUnresolvedReferences(parseInt(limit));
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: `Error processing unresolved references: ${result.error}`
      });
    }
    
    res.status(200).json({
      success: true,
      message: `Processed ${result.processed} references, resolved ${result.resolved}`,
      processed: result.processed,
      resolved: result.resolved
    });
  } catch (error) {
    logger.error(`Error processing unresolved references: ${error.message}`, { error });
    next(error);
  }
}

/**
 * Resolve a reference
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function resolveReference(req, res, next) {
  try {
    const { referenceId } = req.params;
    const { targetContentId, confidence = 1.0 } = req.body;
    
    if (!referenceId) {
      return res.status(400).json({
        success: false,
        message: 'Reference ID is required'
      });
    }
    
    if (!targetContentId) {
      return res.status(400).json({
        success: false,
        message: 'Target content ID is required'
      });
    }
    
    // Get reference
    const reference = await Reference.findById(referenceId);
    
    if (!reference) {
      return res.status(404).json({
        success: false,
        message: 'Reference not found'
      });
    }
    
    // Get target content
    const targetContent = await Content.findById(targetContentId);
    
    if (!targetContent) {
      return res.status(404).json({
        success: false,
        message: 'Target content not found'
      });
    }
    
    // Mark reference as resolved
    await reference.markAsResolved(targetContentId, confidence);
    
    res.status(200).json({
      success: true,
      message: 'Reference resolved',
      reference: {
        id: reference._id,
        type: reference.referenceType,
        title: reference.title,
        url: reference.url,
        resolved: reference.resolved,
        targetContentId: reference.targetContentId,
        confidence: reference.confidence
      }
    });
  } catch (error) {
    logger.error(`Error resolving reference: ${error.message}`, { error });
    next(error);
  }
}

/**
 * Verify a reference
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function verifyReference(req, res, next) {
  try {
    const { referenceId } = req.params;
    const { isValid } = req.body;
    
    if (!referenceId) {
      return res.status(400).json({
        success: false,
        message: 'Reference ID is required'
      });
    }
    
    if (isValid === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Validation status (isValid) is required'
      });
    }
    
    // Get reference
    const reference = await Reference.findById(referenceId);
    
    if (!reference) {
      return res.status(404).json({
        success: false,
        message: 'Reference not found'
      });
    }
    
    // Verify reference
    await reference.verify(isValid);
    
    res.status(200).json({
      success: true,
      message: `Reference ${isValid ? 'verified' : 'rejected'}`,
      reference: {
        id: reference._id,
        type: reference.referenceType,
        title: reference.title,
        url: reference.url,
        verificationStatus: reference.verificationStatus
      }
    });
  } catch (error) {
    logger.error(`Error verifying reference: ${error.message}`, { error });
    next(error);
  }
}

/**
 * Normalize a reference
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function normalizeReference(req, res, next) {
  try {
    const { referenceId } = req.params;
    
    if (!referenceId) {
      return res.status(400).json({
        success: false,
        message: 'Reference ID is required'
      });
    }
    
    // Get reference
    const reference = await Reference.findById(referenceId);
    
    if (!reference) {
      return res.status(404).json({
        success: false,
        message: 'Reference not found'
      });
    }
    
    // Normalize reference
    const normalizedRef = await referenceExtractor.normalizeReference(reference);
    
    res.status(200).json({
      success: true,
      message: 'Reference normalized',
      reference: {
        id: normalizedRef._id,
        type: normalizedRef.referenceType,
        title: normalizedRef.title,
        url: normalizedRef.url,
        authors: normalizedRef.authors,
        doi: normalizedRef.doi
      }
    });
  } catch (error) {
    logger.error(`Error normalizing reference: ${error.message}`, { error });
    next(error);
  }
}

/**
 * Get references by source content
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function getReferencesBySourceContent(req, res, next) {
  try {
    const { contentId } = req.params;
    
    if (!contentId) {
      return res.status(400).json({
        success: false,
        message: 'Content ID is required'
      });
    }
    
    // Get references
    const references = await Reference.findBySourceContent(contentId);
    
    res.status(200).json({
      success: true,
      count: references.length,
      references
    });
  } catch (error) {
    logger.error(`Error getting references by source content: ${error.message}`, { error });
    next(error);
  }
}

/**
 * Get references by target content
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function getReferencesByTargetContent(req, res, next) {
  try {
    const { contentId } = req.params;
    
    if (!contentId) {
      return res.status(400).json({
        success: false,
        message: 'Content ID is required'
      });
    }
    
    // Get references
    const references = await Reference.findByTargetContent(contentId);
    
    res.status(200).json({
      success: true,
      count: references.length,
      references
    });
  } catch (error) {
    logger.error(`Error getting references by target content: ${error.message}`, { error });
    next(error);
  }
}

/**
 * Get unresolved references
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function getUnresolvedReferences(req, res, next) {
  try {
    const { limit = 100 } = req.query;
    
    // Get unresolved references
    const references = await Reference.findUnresolved(parseInt(limit));
    
    res.status(200).json({
      success: true,
      count: references.length,
      references
    });
  } catch (error) {
    logger.error(`Error getting unresolved references: ${error.message}`, { error });
    next(error);
  }
}

/**
 * Get references by type
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function getReferencesByType(req, res, next) {
  try {
    const { type } = req.params;
    
    if (!type) {
      return res.status(400).json({
        success: false,
        message: 'Reference type is required'
      });
    }
    
    // Get references
    const references = await Reference.findByType(type);
    
    res.status(200).json({
      success: true,
      count: references.length,
      references
    });
  } catch (error) {
    logger.error(`Error getting references by type: ${error.message}`, { error });
    next(error);
  }
}

/**
 * Get references by verification status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function getReferencesByVerificationStatus(req, res, next) {
  try {
    const { status } = req.params;
    
    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Verification status is required'
      });
    }
    
    // Get references
    const references = await Reference.findByVerificationStatus(status);
    
    res.status(200).json({
      success: true,
      count: references.length,
      references
    });
  } catch (error) {
    logger.error(`Error getting references by verification status: ${error.message}`, { error });
    next(error);
  }
}

module.exports = {
  extractContentReferences,
  processUnresolvedReferences,
  resolveReference,
  verifyReference,
  normalizeReference,
  getReferencesBySourceContent,
  getReferencesByTargetContent,
  getUnresolvedReferences,
  getReferencesByType,
  getReferencesByVerificationStatus
};