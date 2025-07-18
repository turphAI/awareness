const Credential = require('../models/Credential');
const { ApiError } = require('../../../common/utils/errorHandler');
const credentialManager = require('../utils/credentialManager');
const createLogger = require('../../../common/utils/logger');

// Configure logger
const logger = createLogger('credential-controller');

/**
 * Get master encryption key
 * @returns {string} - Master encryption key
 * @private
 */
const _getMasterKey = () => {
  const masterKey = process.env.CREDENTIAL_ENCRYPTION_KEY;
  
  if (!masterKey) {
    logger.error('CREDENTIAL_ENCRYPTION_KEY environment variable not set');
    throw new Error('Encryption key not configured');
  }
  
  return masterKey;
};

/**
 * Get all credentials for the authenticated user
 * @route GET /api/credentials
 * @access Private
 */
exports.getCredentials = async (req, res, next) => {
  try {
    const { service } = req.query;
    
    let credentials;
    
    if (service) {
      credentials = await Credential.findActiveByUserAndService(req.user.id, service);
    } else {
      credentials = await Credential.findActiveByUser(req.user.id);
    }
    
    // Remove sensitive data
    const sanitizedCredentials = credentials.map(cred => ({
      id: cred._id,
      service: cred.service,
      name: cred.name,
      description: cred.description,
      lastUsed: cred.lastUsed,
      expiresAt: cred.expiresAt,
      createdAt: cred.createdAt,
      updatedAt: cred.updatedAt,
      metadata: Object.fromEntries(cred.metadata)
    }));
    
    res.status(200).json({
      success: true,
      count: sanitizedCredentials.length,
      credentials: sanitizedCredentials
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get credential by ID
 * @route GET /api/credentials/:id
 * @access Private
 */
exports.getCredentialById = async (req, res, next) => {
  try {
    const credential = await Credential.findOne({
      _id: req.params.id,
      userId: req.user.id,
      active: true
    });
    
    if (!credential) {
      throw new ApiError(404, 'Credential not found');
    }
    
    // Remove sensitive data
    const sanitizedCredential = {
      id: credential._id,
      service: credential.service,
      name: credential.name,
      description: credential.description,
      lastUsed: credential.lastUsed,
      expiresAt: credential.expiresAt,
      createdAt: credential.createdAt,
      updatedAt: credential.updatedAt,
      metadata: Object.fromEntries(credential.metadata)
    };
    
    res.status(200).json({
      success: true,
      credential: sanitizedCredential
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new credential
 * @route POST /api/credentials
 * @access Private
 */
exports.createCredential = async (req, res, next) => {
  try {
    const { service, name, description, credentials, expiresAt, metadata } = req.body;
    
    // Check if credential with same name and service already exists
    const existingCredential = await Credential.findOne({
      userId: req.user.id,
      service,
      name,
      active: true
    });
    
    if (existingCredential) {
      throw new ApiError(400, 'Credential with this name already exists for this service');
    }
    
    // Encrypt credentials
    const masterKey = _getMasterKey();
    const encryptedData = credentialManager.encrypt(credentials, masterKey);
    
    // Create credential
    const credential = new Credential({
      userId: req.user.id,
      service,
      name,
      description,
      encryptedData,
      expiresAt: expiresAt || null
    });
    
    // Add metadata if provided
    if (metadata && typeof metadata === 'object') {
      credential.metadata = new Map(Object.entries(metadata));
    }
    
    // Save credential
    await credential.save();
    
    // Log action
    logger.info(`User ${req.user.email} created credential for service ${service}`);
    
    // Remove sensitive data
    const sanitizedCredential = {
      id: credential._id,
      service: credential.service,
      name: credential.name,
      description: credential.description,
      expiresAt: credential.expiresAt,
      createdAt: credential.createdAt,
      metadata: Object.fromEntries(credential.metadata)
    };
    
    res.status(201).json({
      success: true,
      credential: sanitizedCredential,
      message: 'Credential created successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update credential
 * @route PUT /api/credentials/:id
 * @access Private
 */
exports.updateCredential = async (req, res, next) => {
  try {
    const { name, description, credentials, expiresAt, metadata } = req.body;
    
    // Find credential
    const credential = await Credential.findOne({
      _id: req.params.id,
      userId: req.user.id,
      active: true
    });
    
    if (!credential) {
      throw new ApiError(404, 'Credential not found');
    }
    
    // Update basic fields
    if (name) credential.name = name;
    if (description !== undefined) credential.description = description;
    if (expiresAt !== undefined) credential.expiresAt = expiresAt;
    
    // Update credentials if provided
    if (credentials) {
      const masterKey = _getMasterKey();
      credential.encryptedData = credentialManager.encrypt(credentials, masterKey);
    }
    
    // Update metadata if provided
    if (metadata && typeof metadata === 'object') {
      credential.metadata = new Map(Object.entries(metadata));
    }
    
    // Save credential
    await credential.save();
    
    // Log action
    logger.info(`User ${req.user.email} updated credential for service ${credential.service}`);
    
    // Remove sensitive data
    const sanitizedCredential = {
      id: credential._id,
      service: credential.service,
      name: credential.name,
      description: credential.description,
      expiresAt: credential.expiresAt,
      createdAt: credential.createdAt,
      updatedAt: credential.updatedAt,
      metadata: Object.fromEntries(credential.metadata)
    };
    
    res.status(200).json({
      success: true,
      credential: sanitizedCredential,
      message: 'Credential updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete credential
 * @route DELETE /api/credentials/:id
 * @access Private
 */
exports.deleteCredential = async (req, res, next) => {
  try {
    // Find credential
    const credential = await Credential.findOne({
      _id: req.params.id,
      userId: req.user.id,
      active: true
    });
    
    if (!credential) {
      throw new ApiError(404, 'Credential not found');
    }
    
    // Soft delete (set active to false)
    credential.active = false;
    await credential.save();
    
    // Log action
    logger.info(`User ${req.user.email} deleted credential for service ${credential.service}`);
    
    res.status(200).json({
      success: true,
      message: 'Credential deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get decrypted credential
 * @route GET /api/credentials/:id/decrypt
 * @access Private
 */
exports.getDecryptedCredential = async (req, res, next) => {
  try {
    // Find credential
    const credential = await Credential.findOne({
      _id: req.params.id,
      userId: req.user.id,
      active: true
    });
    
    if (!credential) {
      throw new ApiError(404, 'Credential not found');
    }
    
    // Check if credential is expired
    if (credential.expiresAt && credential.expiresAt < new Date()) {
      throw new ApiError(400, 'Credential has expired');
    }
    
    // Decrypt credentials
    const masterKey = _getMasterKey();
    const decryptedCredentials = credentialManager.decrypt(credential.encryptedData, masterKey);
    
    // Record usage
    credential.lastUsed = new Date();
    await credential.save();
    
    // Log action
    logger.info(`User ${req.user.email} accessed decrypted credential for service ${credential.service}`);
    
    res.status(200).json({
      success: true,
      credential: {
        id: credential._id,
        service: credential.service,
        name: credential.name,
        credentials: decryptedCredentials
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify credential
 * @route POST /api/credentials/:id/verify
 * @access Private
 */
exports.verifyCredential = async (req, res, next) => {
  try {
    // Find credential
    const credential = await Credential.findOne({
      _id: req.params.id,
      userId: req.user.id,
      active: true
    });
    
    if (!credential) {
      throw new ApiError(404, 'Credential not found');
    }
    
    // Check if credential is expired
    if (credential.expiresAt && credential.expiresAt < new Date()) {
      throw new ApiError(400, 'Credential has expired');
    }
    
    // This is a placeholder. In a real implementation, you would verify the credential with the external service.
    // For now, we just check if we can decrypt it.
    try {
      const masterKey = _getMasterKey();
      credentialManager.decrypt(credential.encryptedData, masterKey);
      
      // Record usage
      credential.lastUsed = new Date();
      await credential.save();
      
      res.status(200).json({
        success: true,
        message: 'Credential is valid'
      });
    } catch (error) {
      throw new ApiError(400, 'Credential is invalid or corrupted');
    }
  } catch (error) {
    next(error);
  }
};