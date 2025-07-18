const Source = require('../models/Source');
const sourceAuthManager = require('../utils/sourceAuthManager');
const createLogger = require('../../../common/utils/logger');
const { ApiError } = require('../../../common/utils/errorHandler');

let axios;
try {
  axios = require('axios');
} catch (error) {
  // Handle case where axios is not available
  axios = {
    get: async () => { throw new Error('Axios not available'); },
    post: async () => { throw new Error('Axios not available'); }
  };
}

// Add a method for testing to inject mock axios
exports._setAxiosForTesting = function(mockAxios) {
  axios = mockAxios;
};

// Configure logger
const logger = createLogger('source-auth-controller');

/**
 * Create authentication session for a source
 * @route POST /api/sources/:id/auth/session
 * @access Private
 */
exports.createAuthSession = async (req, res, next) => {
  try {
    const source = await Source.findOne({
      _id: req.params.id,
      createdBy: req.user.id,
      active: true
    });

    if (!source) {
      throw new ApiError(404, 'Source not found');
    }

    if (!source.requiresAuthentication) {
      throw new ApiError(400, 'Source does not require authentication');
    }

    // Use provided credentials or stored ones
    const credentials = req.body.credentials || null;

    // Create session
    const session = await sourceAuthManager.createSession(source, credentials);

    if (!session.success) {
      throw new ApiError(400, session.error || 'Failed to create authentication session');
    }

    // Return session info (without sensitive data)
    res.status(200).json({
      success: true,
      sessionId: session.sessionId,
      expiresAt: session.expiresAt,
      authType: session.authType
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get authentication session status
 * @route GET /api/sources/auth/session/:sessionId
 * @access Private
 */
exports.getAuthSession = async (req, res, next) => {
  try {
    const sessionId = req.params.sessionId;
    const session = sourceAuthManager.getSession(sessionId);

    if (!session) {
      throw new ApiError(404, 'Session not found or expired');
    }

    // Check if user has access to the source
    const source = await Source.findOne({
      _id: session.sourceId,
      createdBy: req.user.id,
      active: true
    });

    if (!source) {
      throw new ApiError(403, 'Unauthorized access to session');
    }

    // Return session info (without sensitive data)
    res.status(200).json({
      success: true,
      sessionId,
      sourceId: session.sourceId,
      expiresAt: new Date(session.expiresAt),
      authType: session.authType
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Refresh authentication session
 * @route POST /api/sources/auth/session/:sessionId/refresh
 * @access Private
 */
exports.refreshAuthSession = async (req, res, next) => {
  try {
    const sessionId = req.params.sessionId;
    const session = sourceAuthManager.getSession(sessionId);

    if (!session) {
      throw new ApiError(404, 'Session not found or expired');
    }

    // Check if user has access to the source
    const source = await Source.findOne({
      _id: session.sourceId,
      createdBy: req.user.id,
      active: true
    });

    if (!source) {
      throw new ApiError(403, 'Unauthorized access to session');
    }

    // Refresh session
    const refreshed = await sourceAuthManager.refreshSession(sessionId, source);

    if (!refreshed.success) {
      throw new ApiError(400, refreshed.error || 'Failed to refresh session');
    }

    // Return updated session info
    res.status(200).json({
      success: true,
      sessionId: refreshed.sessionId,
      expiresAt: refreshed.expiresAt,
      authType: refreshed.authType
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete authentication session
 * @route DELETE /api/sources/auth/session/:sessionId
 * @access Private
 */
exports.deleteAuthSession = async (req, res, next) => {
  try {
    const sessionId = req.params.sessionId;
    const session = sourceAuthManager.getSession(sessionId);

    // If session doesn't exist, consider it already deleted
    if (!session) {
      return res.status(200).json({
        success: true,
        message: 'Session already deleted or expired'
      });
    }

    // Check if user has access to the source
    const source = await Source.findOne({
      _id: session.sourceId,
      createdBy: req.user.id,
      active: true
    });

    if (!source) {
      throw new ApiError(403, 'Unauthorized access to session');
    }

    // Delete session
    sourceAuthManager.deleteSession(sessionId);

    res.status(200).json({
      success: true,
      message: 'Session deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Store credentials for a source
 * @route POST /api/sources/:id/auth/credentials
 * @access Private
 */
exports.storeSourceCredentials = async (req, res, next) => {
  try {
    const source = await Source.findOne({
      _id: req.params.id,
      createdBy: req.user.id,
      active: true
    });

    if (!source) {
      throw new ApiError(404, 'Source not found');
    }

    const { credentials } = req.body;

    if (!credentials || typeof credentials !== 'object') {
      throw new ApiError(400, 'Valid credentials object is required');
    }

    // Update source to require authentication if not already set
    source.requiresAuthentication = true;

    // Store credentials
    await source.encryptCredentials(credentials);

    // Return success response
    res.status(200).json({
      success: true,
      message: 'Credentials stored successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Test source authentication
 * @route POST /api/sources/:id/auth/test
 * @access Private
 */
exports.testSourceAuthentication = async (req, res, next) => {
  try {
    const source = await Source.findOne({
      _id: req.params.id,
      createdBy: req.user.id,
      active: true
    });

    if (!source) {
      throw new ApiError(404, 'Source not found');
    }

    if (!source.requiresAuthentication) {
      throw new ApiError(400, 'Source does not require authentication');
    }

    // Use provided credentials or stored ones
    const credentials = req.body.credentials || null;

    // Create temporary session
    const session = await sourceAuthManager.createSession(source, credentials);

    if (!session.success) {
      throw new ApiError(400, session.error || 'Authentication failed');
    }

    // Test authentication by making a request to the source
    let testUrl = source.url;
    
    // Use test URL from metadata if available
    if (source.metadata && source.metadata.has('authTestUrl')) {
      testUrl = source.metadata.get('authTestUrl');
    }

    try {
      // Get auth headers
      const headers = sourceAuthManager.getAuthHeaders(session.sessionId);
      
      // Make test request
      const response = await axios.get(testUrl, {
        headers,
        validateStatus: status => status < 400,
        timeout: 10000 // 10 second timeout
      });

      // Clean up temporary session
      sourceAuthManager.deleteSession(session.sessionId);

      res.status(200).json({
        success: true,
        message: 'Authentication successful',
        statusCode: response.status
      });
    } catch (error) {
      // Clean up temporary session
      sourceAuthManager.deleteSession(session.sessionId);

      logger.error(`Authentication test failed for source: ${source.name}`, error);
      
      throw new ApiError(400, 'Authentication test failed: ' + (error.message || 'Unknown error'));
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Get authenticated request for a source
 * @route GET /api/sources/:id/auth/request
 * @access Private
 */
exports.getAuthenticatedRequest = async (req, res, next) => {
  try {
    const source = await Source.findOne({
      _id: req.params.id,
      createdBy: req.user.id,
      active: true
    });

    if (!source) {
      throw new ApiError(404, 'Source not found');
    }

    const { url, method = 'GET', sessionId } = req.query;

    if (!url) {
      throw new ApiError(400, 'URL parameter is required');
    }

    if (!['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())) {
      throw new ApiError(400, 'Only GET, HEAD, and OPTIONS methods are supported');
    }

    // If source doesn't require authentication, make a simple request
    if (!source.requiresAuthentication) {
      try {
        const response = await axios({
          method: method.toUpperCase(),
          url,
          timeout: 10000,
          validateStatus: status => true
        });

        return res.status(200).json({
          success: true,
          statusCode: response.status,
          headers: response.headers,
          data: response.data
        });
      } catch (error) {
        throw new ApiError(400, 'Request failed: ' + (error.message || 'Unknown error'));
      }
    }

    // Source requires authentication
    if (!sessionId) {
      throw new ApiError(400, 'Session ID is required for authenticated requests');
    }

    const session = sourceAuthManager.getSession(sessionId);

    if (!session) {
      throw new ApiError(404, 'Session not found or expired');
    }

    if (session.sourceId !== source._id.toString()) {
      throw new ApiError(400, 'Session does not match the requested source');
    }

    // Get auth headers
    const headers = sourceAuthManager.getAuthHeaders(sessionId);

    try {
      // Make authenticated request
      const response = await axios({
        method: method.toUpperCase(),
        url,
        headers,
        timeout: 10000,
        validateStatus: status => true
      });

      res.status(200).json({
        success: true,
        statusCode: response.status,
        headers: response.headers,
        data: response.data
      });
    } catch (error) {
      throw new ApiError(400, 'Authenticated request failed: ' + (error.message || 'Unknown error'));
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Update source authentication metadata
 * @route PUT /api/sources/:id/auth/metadata
 * @access Private
 */
exports.updateAuthMetadata = async (req, res, next) => {
  try {
    const source = await Source.findOne({
      _id: req.params.id,
      createdBy: req.user.id,
      active: true
    });

    if (!source) {
      throw new ApiError(404, 'Source not found');
    }

    const { metadata } = req.body;

    if (!metadata || typeof metadata !== 'object') {
      throw new ApiError(400, 'Valid metadata object is required');
    }

    // Get current metadata
    const currentMetadata = Object.fromEntries(source.metadata || new Map());
    
    // Update auth-related metadata
    const authKeys = [
      'authType',
      'loginUrl',
      'tokenUrl',
      'apiKeyHeader',
      'apiTestUrl',
      'sessionCheckUrl',
      'usernameField',
      'passwordField',
      'additionalFormFields',
      'authTestUrl'
    ];

    const updatedMetadata = { ...currentMetadata };
    
    for (const key of authKeys) {
      if (metadata[key] !== undefined) {
        updatedMetadata[key] = metadata[key];
      }
    }

    // Update source metadata
    source.metadata = new Map(Object.entries(updatedMetadata));
    await source.save();

    res.status(200).json({
      success: true,
      message: 'Authentication metadata updated successfully',
      metadata: updatedMetadata
    });
  } catch (error) {
    next(error);
  }
};