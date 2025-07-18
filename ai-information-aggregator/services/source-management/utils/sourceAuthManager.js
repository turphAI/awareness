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

const createLogger = require('../../../common/utils/logger');
const credentialManager = require('../../authentication/utils/credentialManager');

// Configure logger
const logger = createLogger('source-auth-manager');

/**
 * Source Authentication Manager
 * Handles authentication sessions for protected sources
 */
class SourceAuthManager {
  constructor() {
    this.sessions = new Map();
    this.sessionTTL = 3600000; // 1 hour in milliseconds
  }

  /**
   * Get master encryption key
   * @returns {string} - Master encryption key
   * @private
   */
  _getMasterKey() {
    const masterKey = process.env.CREDENTIAL_ENCRYPTION_KEY;
    
    if (!masterKey) {
      logger.error('CREDENTIAL_ENCRYPTION_KEY environment variable not set');
      throw new Error('Encryption key not configured');
    }
    
    return masterKey;
  }

  /**
   * Create authentication session for a source
   * @param {Object} source - Source document
   * @param {Object} credentials - Optional credentials to use instead of stored ones
   * @returns {Object} - Session information
   */
  async createSession(source, credentials = null) {
    try {
      if (!source.requiresAuthentication) {
        logger.warn(`Attempted to create session for non-authenticated source: ${source.name}`);
        return { success: false, error: 'Source does not require authentication' };
      }

      // Get credentials from source or use provided ones
      let authCredentials = credentials;
      if (!authCredentials) {
        if (!source.credentials.encrypted || !source.credentials.iv) {
          logger.error(`No credentials found for source: ${source.name}`);
          return { success: false, error: 'No credentials found for source' };
        }

        try {
          // Decrypt stored credentials
          authCredentials = source.decryptCredentials();
        } catch (error) {
          logger.error(`Failed to decrypt credentials for source: ${source.name}`, error);
          return { success: false, error: 'Failed to decrypt credentials' };
        }
      }

      // Determine authentication type based on source type
      const authType = this._getAuthTypeForSource(source);
      
      // Authenticate based on type
      const sessionData = await this._authenticateByType(source, authCredentials, authType);
      
      if (!sessionData.success) {
        return sessionData;
      }

      // Store session with expiration
      const sessionId = this._generateSessionId();
      const expiresAt = Date.now() + this.sessionTTL;
      
      this.sessions.set(sessionId, {
        sourceId: source._id.toString(),
        authType,
        data: sessionData.data,
        expiresAt
      });

      // Return session info
      return {
        success: true,
        sessionId,
        expiresAt: new Date(expiresAt),
        authType
      };
    } catch (error) {
      logger.error(`Error creating session for source: ${source.name}`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get authentication session
   * @param {string} sessionId - Session ID
   * @returns {Object|null} - Session data or null if not found/expired
   */
  getSession(sessionId) {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return null;
    }

    // Check if session is expired
    if (session.expiresAt < Date.now()) {
      this.sessions.delete(sessionId);
      return null;
    }

    return session;
  }

  /**
   * Refresh authentication session
   * @param {string} sessionId - Session ID
   * @param {Object} source - Source document
   * @returns {Object} - Updated session information
   */
  async refreshSession(sessionId, source) {
    const session = this.getSession(sessionId);
    
    if (!session) {
      logger.warn(`Attempted to refresh non-existent session: ${sessionId}`);
      return { success: false, error: 'Session not found or expired' };
    }

    if (session.sourceId !== source._id.toString()) {
      logger.warn(`Session source ID mismatch: ${session.sourceId} vs ${source._id}`);
      return { success: false, error: 'Session source mismatch' };
    }

    try {
      // Refresh session based on auth type
      const refreshed = await this._refreshSessionByType(source, session);
      
      if (!refreshed.success) {
        return refreshed;
      }

      // Update session data and expiration
      const expiresAt = Date.now() + this.sessionTTL;
      
      this.sessions.set(sessionId, {
        ...session,
        data: refreshed.data || session.data,
        expiresAt
      });

      return {
        success: true,
        sessionId,
        expiresAt: new Date(expiresAt),
        authType: session.authType
      };
    } catch (error) {
      logger.error(`Error refreshing session for source: ${source.name}`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete authentication session
   * @param {string} sessionId - Session ID
   * @returns {boolean} - Whether session was deleted
   */
  deleteSession(sessionId) {
    return this.sessions.delete(sessionId);
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions() {
    const now = Date.now();
    let expiredCount = 0;
    
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.expiresAt < now) {
        this.sessions.delete(sessionId);
        expiredCount++;
      }
    }
    
    if (expiredCount > 0) {
      logger.info(`Cleaned up ${expiredCount} expired sessions`);
    }
    
    return expiredCount;
  }

  /**
   * Get authentication headers for a session
   * @param {string} sessionId - Session ID
   * @returns {Object|null} - Authentication headers or null if session not found
   */
  getAuthHeaders(sessionId) {
    const session = this.getSession(sessionId);
    
    if (!session) {
      return null;
    }

    // Generate headers based on auth type
    switch (session.authType) {
      case 'basic':
        return {
          Authorization: `Basic ${session.data.token}`
        };
      case 'bearer':
        return {
          Authorization: `Bearer ${session.data.token}`
        };
      case 'api_key':
        return {
          [session.data.headerName || 'X-API-Key']: session.data.apiKey
        };
      case 'cookie':
        return {
          Cookie: session.data.cookies
        };
      default:
        return {};
    }
  }

  /**
   * Determine authentication type for a source
   * @param {Object} source - Source document
   * @returns {string} - Authentication type
   * @private
   */
  _getAuthTypeForSource(source) {
    // Check if auth type is specified in metadata
    if (source.metadata && source.metadata.has('authType')) {
      return source.metadata.get('authType');
    }

    // Default auth types based on source type
    const defaultAuthTypes = {
      academic: 'cookie',
      blog: 'basic',
      podcast: 'api_key',
      social: 'oauth',
      website: 'basic'
    };

    return defaultAuthTypes[source.type] || 'basic';
  }

  /**
   * Authenticate based on auth type
   * @param {Object} source - Source document
   * @param {Object} credentials - Authentication credentials
   * @param {string} authType - Authentication type
   * @returns {Object} - Authentication result
   * @private
   */
  async _authenticateByType(source, credentials, authType) {
    switch (authType) {
      case 'basic':
        return this._authenticateBasic(source, credentials);
      case 'bearer':
        return this._authenticateBearer(source, credentials);
      case 'api_key':
        return this._authenticateApiKey(source, credentials);
      case 'cookie':
        return this._authenticateCookie(source, credentials);
      case 'oauth':
        return this._authenticateOAuth(source, credentials);
      default:
        logger.error(`Unsupported auth type: ${authType}`);
        return { success: false, error: 'Unsupported authentication type' };
    }
  }

  /**
   * Refresh session based on auth type
   * @param {Object} source - Source document
   * @param {Object} session - Session data
   * @returns {Object} - Refresh result
   * @private
   */
  async _refreshSessionByType(source, session) {
    switch (session.authType) {
      case 'basic':
        // Basic auth doesn't need refresh
        return { success: true };
      case 'bearer':
        return this._refreshBearerToken(source, session);
      case 'api_key':
        // API key doesn't need refresh
        return { success: true };
      case 'cookie':
        return this._refreshCookieSession(source, session);
      case 'oauth':
        return this._refreshOAuthToken(source, session);
      default:
        logger.error(`Unsupported auth type for refresh: ${session.authType}`);
        return { success: false, error: 'Unsupported authentication type' };
    }
  }

  /**
   * Authenticate with basic auth
   * @param {Object} source - Source document
   * @param {Object} credentials - Authentication credentials
   * @returns {Object} - Authentication result
   * @private
   */
  async _authenticateBasic(source, credentials) {
    try {
      if (!credentials.username || !credentials.password) {
        return { success: false, error: 'Username and password required' };
      }

      // Create basic auth token
      const token = Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64');
      
      // Test authentication if login URL is provided
      if (source.metadata && source.metadata.has('loginUrl')) {
        const loginUrl = source.metadata.get('loginUrl');
        
        try {
          const response = await axios.get(loginUrl, {
            headers: {
              Authorization: `Basic ${token}`
            },
            validateStatus: status => status < 400
          });
          
          if (response.status >= 400) {
            return { success: false, error: `Authentication failed with status ${response.status}` };
          }
        } catch (error) {
          logger.error(`Basic auth test failed for source: ${source.name}`, error);
          return { success: false, error: 'Authentication test failed' };
        }
      }

      return {
        success: true,
        data: { token }
      };
    } catch (error) {
      logger.error(`Basic auth error for source: ${source.name}`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Authenticate with bearer token
   * @param {Object} source - Source document
   * @param {Object} credentials - Authentication credentials
   * @returns {Object} - Authentication result
   * @private
   */
  async _authenticateBearer(source, credentials) {
    try {
      // Check if we already have a token
      if (credentials.token) {
        return {
          success: true,
          data: {
            token: credentials.token,
            expiresAt: credentials.expiresAt || null,
            refreshToken: credentials.refreshToken || null
          }
        };
      }

      // Check if we need to get a token from an auth endpoint
      if (!credentials.clientId || !credentials.clientSecret) {
        return { success: false, error: 'Client ID and secret required' };
      }

      if (!source.metadata || !source.metadata.has('tokenUrl')) {
        return { success: false, error: 'Token URL not specified' };
      }

      const tokenUrl = source.metadata.get('tokenUrl');
      
      try {
        const response = await axios.post(tokenUrl, {
          grant_type: 'client_credentials',
          client_id: credentials.clientId,
          client_secret: credentials.clientSecret,
          scope: credentials.scope || ''
        });

        if (!response.data.access_token) {
          return { success: false, error: 'No access token in response' };
        }

        // Calculate expiration time
        const expiresIn = response.data.expires_in || 3600;
        const expiresAt = Date.now() + (expiresIn * 1000);

        return {
          success: true,
          data: {
            token: response.data.access_token,
            expiresAt,
            refreshToken: response.data.refresh_token || null
          }
        };
      } catch (error) {
        logger.error(`Bearer token request failed for source: ${source.name}`, error);
        return { success: false, error: 'Token request failed' };
      }
    } catch (error) {
      logger.error(`Bearer auth error for source: ${source.name}`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Authenticate with API key
   * @param {Object} source - Source document
   * @param {Object} credentials - Authentication credentials
   * @returns {Object} - Authentication result
   * @private
   */
  async _authenticateApiKey(source, credentials) {
    try {
      if (!credentials.apiKey) {
        return { success: false, error: 'API key required' };
      }

      // Get header name from metadata or use default
      const headerName = source.metadata && source.metadata.has('apiKeyHeader')
        ? source.metadata.get('apiKeyHeader')
        : 'X-API-Key';

      // Test authentication if test URL is provided
      if (source.metadata && source.metadata.has('apiTestUrl')) {
        const testUrl = source.metadata.get('apiTestUrl');
        
        try {
          const headers = {};
          headers[headerName] = credentials.apiKey;
          
          const response = await axios.get(testUrl, {
            headers,
            validateStatus: status => status < 400
          });
          
          if (response.status >= 400) {
            return { success: false, error: `API key test failed with status ${response.status}` };
          }
        } catch (error) {
          logger.error(`API key test failed for source: ${source.name}`, error);
          return { success: false, error: 'API key test failed' };
        }
      }

      return {
        success: true,
        data: {
          apiKey: credentials.apiKey,
          headerName
        }
      };
    } catch (error) {
      logger.error(`API key auth error for source: ${source.name}`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Authenticate with cookie-based session
   * @param {Object} source - Source document
   * @param {Object} credentials - Authentication credentials
   * @returns {Object} - Authentication result
   * @private
   */
  async _authenticateCookie(source, credentials) {
    try {
      if (!credentials.username || !credentials.password) {
        return { success: false, error: 'Username and password required' };
      }

      if (!source.metadata || !source.metadata.has('loginUrl')) {
        return { success: false, error: 'Login URL not specified' };
      }

      const loginUrl = source.metadata.get('loginUrl');
      const formData = new URLSearchParams();
      
      // Get form field names from metadata or use defaults
      const usernameField = source.metadata.has('usernameField')
        ? source.metadata.get('usernameField')
        : 'username';
      
      const passwordField = source.metadata.has('passwordField')
        ? source.metadata.get('passwordField')
        : 'password';
      
      formData.append(usernameField, credentials.username);
      formData.append(passwordField, credentials.password);
      
      // Add any additional form fields from metadata
      if (source.metadata.has('additionalFormFields')) {
        try {
          const additionalFields = JSON.parse(source.metadata.get('additionalFormFields'));
          
          for (const [key, value] of Object.entries(additionalFields)) {
            formData.append(key, value);
          }
        } catch (error) {
          logger.warn(`Failed to parse additional form fields for source: ${source.name}`, error);
        }
      }
      
      try {
        const response = await axios.post(loginUrl, formData, {
          maxRedirects: 5,
          validateStatus: status => status < 400
        });
        
        if (response.status >= 400) {
          return { success: false, error: `Login failed with status ${response.status}` };
        }
        
        // Extract cookies from response
        const cookies = response.headers['set-cookie'];
        
        if (!cookies || cookies.length === 0) {
          return { success: false, error: 'No cookies received from login' };
        }
        
        return {
          success: true,
          data: {
            cookies: cookies.join('; ')
          }
        };
      } catch (error) {
        logger.error(`Cookie auth failed for source: ${source.name}`, error);
        return { success: false, error: 'Login failed' };
      }
    } catch (error) {
      logger.error(`Cookie auth error for source: ${source.name}`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Authenticate with OAuth
   * @param {Object} source - Source document
   * @param {Object} credentials - Authentication credentials
   * @returns {Object} - Authentication result
   * @private
   */
  async _authenticateOAuth(source, credentials) {
    // OAuth implementation would be more complex and typically requires user interaction
    // This is a simplified version that assumes we already have tokens
    try {
      if (!credentials.accessToken) {
        return { success: false, error: 'Access token required' };
      }

      return {
        success: true,
        data: {
          token: credentials.accessToken,
          refreshToken: credentials.refreshToken || null,
          expiresAt: credentials.expiresAt || null
        }
      };
    } catch (error) {
      logger.error(`OAuth auth error for source: ${source.name}`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Refresh bearer token
   * @param {Object} source - Source document
   * @param {Object} session - Session data
   * @returns {Object} - Refresh result
   * @private
   */
  async _refreshBearerToken(source, session) {
    try {
      // Check if token is expired
      if (!session.data.expiresAt || session.data.expiresAt > Date.now()) {
        return { success: true };
      }

      // Check if we have a refresh token
      if (!session.data.refreshToken) {
        // Need to re-authenticate
        const credentials = source.decryptCredentials();
        return this._authenticateBearer(source, credentials);
      }

      if (!source.metadata || !source.metadata.has('tokenUrl')) {
        return { success: false, error: 'Token URL not specified' };
      }

      const tokenUrl = source.metadata.get('tokenUrl');
      const credentials = source.decryptCredentials();
      
      try {
        const response = await axios.post(tokenUrl, {
          grant_type: 'refresh_token',
          refresh_token: session.data.refreshToken,
          client_id: credentials.clientId,
          client_secret: credentials.clientSecret
        });

        if (!response.data.access_token) {
          return { success: false, error: 'No access token in response' };
        }

        // Calculate expiration time
        const expiresIn = response.data.expires_in || 3600;
        const expiresAt = Date.now() + (expiresIn * 1000);

        return {
          success: true,
          data: {
            token: response.data.access_token,
            expiresAt,
            refreshToken: response.data.refresh_token || session.data.refreshToken
          }
        };
      } catch (error) {
        logger.error(`Bearer token refresh failed for source: ${source.name}`, error);
        
        // Fall back to re-authentication
        const credentials = source.decryptCredentials();
        return this._authenticateBearer(source, credentials);
      }
    } catch (error) {
      logger.error(`Bearer token refresh error for source: ${source.name}`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Refresh cookie session
   * @param {Object} source - Source document
   * @param {Object} session - Session data
   * @returns {Object} - Refresh result
   * @private
   */
  async _refreshCookieSession(source, session) {
    try {
      // For cookie sessions, we need to check if the session is still valid
      if (!source.metadata || !source.metadata.has('sessionCheckUrl')) {
        // No way to check, assume it's still valid
        return { success: true };
      }

      const checkUrl = source.metadata.get('sessionCheckUrl');
      
      try {
        const response = await axios.get(checkUrl, {
          headers: {
            Cookie: session.data.cookies
          },
          validateStatus: status => true
        });
        
        // Check if session is still valid based on status code
        if (response.status < 400) {
          return { success: true };
        }
        
        // Session expired, need to re-authenticate
        const credentials = source.decryptCredentials();
        return this._authenticateCookie(source, credentials);
      } catch (error) {
        logger.error(`Cookie session check failed for source: ${source.name}`, error);
        
        // Fall back to re-authentication
        const credentials = source.decryptCredentials();
        return this._authenticateCookie(source, credentials);
      }
    } catch (error) {
      logger.error(`Cookie session refresh error for source: ${source.name}`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Refresh OAuth token
   * @param {Object} source - Source document
   * @param {Object} session - Session data
   * @returns {Object} - Refresh result
   * @private
   */
  async _refreshOAuthToken(source, session) {
    try {
      // Check if token is expired
      if (!session.data.expiresAt || session.data.expiresAt > Date.now()) {
        return { success: true };
      }

      // Check if we have a refresh token
      if (!session.data.refreshToken) {
        return { success: false, error: 'No refresh token available' };
      }

      if (!source.metadata || !source.metadata.has('tokenUrl')) {
        return { success: false, error: 'Token URL not specified' };
      }

      const tokenUrl = source.metadata.get('tokenUrl');
      const credentials = source.decryptCredentials();
      
      try {
        const response = await axios.post(tokenUrl, {
          grant_type: 'refresh_token',
          refresh_token: session.data.refreshToken,
          client_id: credentials.clientId,
          client_secret: credentials.clientSecret
        });

        if (!response.data.access_token) {
          return { success: false, error: 'No access token in response' };
        }

        // Calculate expiration time
        const expiresIn = response.data.expires_in || 3600;
        const expiresAt = Date.now() + (expiresIn * 1000);

        return {
          success: true,
          data: {
            token: response.data.access_token,
            expiresAt,
            refreshToken: response.data.refresh_token || session.data.refreshToken
          }
        };
      } catch (error) {
        logger.error(`OAuth token refresh failed for source: ${source.name}`, error);
        return { success: false, error: 'Token refresh failed' };
      }
    } catch (error) {
      logger.error(`OAuth token refresh error for source: ${source.name}`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate a unique session ID
   * @returns {string} - Session ID
   * @private
   */
  _generateSessionId() {
    return require('crypto').randomBytes(16).toString('hex');
  }
}

// Create singleton instance
const sourceAuthManager = new SourceAuthManager();

// Set up periodic cleanup of expired sessions
const cleanupInterval = setInterval(() => {
  sourceAuthManager.cleanupExpiredSessions();
}, 300000); // Run every 5 minutes

// Add a method for testing to inject mock axios
sourceAuthManager._setAxiosForTesting = function(mockAxios) {
  axios = mockAxios;
};

// Add a method to clear the cleanup interval (for testing)
sourceAuthManager._clearCleanupInterval = function() {
  clearInterval(cleanupInterval);
};

module.exports = sourceAuthManager;