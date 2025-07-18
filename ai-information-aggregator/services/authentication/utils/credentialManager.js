const crypto = require('crypto');
const createLogger = require('../../../common/utils/logger');

// Configure logger
const logger = createLogger('credential-manager');

/**
 * Credential Manager for secure storage and retrieval of credentials
 */
class CredentialManager {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32; // 256 bits
    this.ivLength = 16; // 128 bits
    this.tagLength = 16; // 128 bits
    this.saltLength = 64;
    this.iterations = 10000;
    this.digest = 'sha512';
  }

  /**
   * Get encryption key from master key and salt
   * @param {string} masterKey - Master encryption key
   * @param {Buffer} salt - Salt for key derivation
   * @returns {Buffer} - Derived key
   * @private
   */
  _getDerivedKey(masterKey, salt) {
    return crypto.pbkdf2Sync(
      masterKey,
      salt,
      this.iterations,
      this.keyLength,
      this.digest
    );
  }

  /**
   * Encrypt credentials
   * @param {Object} credentials - Credentials to encrypt
   * @param {string} masterKey - Master encryption key
   * @returns {Object} - Encrypted credentials
   */
  encrypt(credentials, masterKey) {
    try {
      // Generate random salt
      const salt = crypto.randomBytes(this.saltLength);
      
      // Derive key from master key and salt
      const key = this._getDerivedKey(masterKey, salt);
      
      // Generate random IV
      const iv = crypto.randomBytes(this.ivLength);
      
      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, key, iv);
      
      // Convert credentials to JSON string
      const data = JSON.stringify(credentials);
      
      // Encrypt data
      const encrypted = Buffer.concat([
        cipher.update(data, 'utf8'),
        cipher.final()
      ]);
      
      // Get authentication tag
      const tag = cipher.getAuthTag();
      
      // Return encrypted data with metadata
      return {
        version: 1, // For future versioning
        salt: salt.toString('hex'),
        iv: iv.toString('hex'),
        tag: tag.toString('hex'),
        encrypted: encrypted.toString('hex')
      };
    } catch (error) {
      logger.error('Encryption error:', error);
      throw new Error('Failed to encrypt credentials');
    }
  }

  /**
   * Decrypt credentials
   * @param {Object} encryptedData - Encrypted credentials
   * @param {string} masterKey - Master encryption key
   * @returns {Object} - Decrypted credentials
   */
  decrypt(encryptedData, masterKey) {
    try {
      // Check version
      if (encryptedData.version !== 1) {
        throw new Error('Unsupported encryption version');
      }
      
      // Convert hex strings to buffers
      const salt = Buffer.from(encryptedData.salt, 'hex');
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const tag = Buffer.from(encryptedData.tag, 'hex');
      const encrypted = Buffer.from(encryptedData.encrypted, 'hex');
      
      // Derive key from master key and salt
      const key = this._getDerivedKey(masterKey, salt);
      
      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
      
      // Set authentication tag
      decipher.setAuthTag(tag);
      
      // Decrypt data
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
      ]);
      
      // Parse JSON string
      return JSON.parse(decrypted.toString('utf8'));
    } catch (error) {
      logger.error('Decryption error:', error);
      throw new Error('Failed to decrypt credentials');
    }
  }

  /**
   * Generate a secure random master key
   * @returns {string} - Hex-encoded master key
   */
  generateMasterKey() {
    return crypto.randomBytes(this.keyLength).toString('hex');
  }

  /**
   * Hash a value (e.g., for storing API keys)
   * @param {string} value - Value to hash
   * @returns {string} - Hashed value
   */
  hashValue(value) {
    return crypto
      .createHash('sha256')
      .update(value)
      .digest('hex');
  }

  /**
   * Compare a value with its hash
   * @param {string} value - Value to compare
   * @param {string} hash - Hash to compare against
   * @returns {boolean} - Whether the value matches the hash
   */
  compareHash(value, hash) {
    const valueHash = this.hashValue(value);
    return crypto.timingSafeEqual(
      Buffer.from(valueHash, 'hex'),
      Buffer.from(hash, 'hex')
    );
  }
}

// Create singleton instance
const credentialManager = new CredentialManager();

module.exports = credentialManager;