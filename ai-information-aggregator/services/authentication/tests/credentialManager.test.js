const credentialManager = require('../utils/credentialManager');

describe('Credential Manager', () => {
  const testMasterKey = 'test-master-key-that-is-at-least-32-characters';
  
  describe('Encryption and Decryption', () => {
    it('should encrypt and decrypt credentials correctly', () => {
      // Test credentials
      const credentials = {
        username: 'testuser',
        password: 'testpassword',
        apiKey: 'testapikey123'
      };
      
      // Encrypt credentials
      const encrypted = credentialManager.encrypt(credentials, testMasterKey);
      
      // Check encrypted data structure
      expect(encrypted).toHaveProperty('version', 1);
      expect(encrypted).toHaveProperty('salt');
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('tag');
      expect(encrypted).toHaveProperty('encrypted');
      
      // Decrypt credentials
      const decrypted = credentialManager.decrypt(encrypted, testMasterKey);
      
      // Check decrypted data
      expect(decrypted).toEqual(credentials);
    });
    
    it('should throw error when decrypting with wrong master key', () => {
      // Test credentials
      const credentials = {
        username: 'testuser',
        password: 'testpassword'
      };
      
      // Encrypt credentials
      const encrypted = credentialManager.encrypt(credentials, testMasterKey);
      
      // Try to decrypt with wrong master key
      expect(() => {
        credentialManager.decrypt(encrypted, 'wrong-master-key');
      }).toThrow('Failed to decrypt credentials');
    });
    
    it('should throw error when decrypting corrupted data', () => {
      // Test credentials
      const credentials = {
        username: 'testuser',
        password: 'testpassword'
      };
      
      // Encrypt credentials
      const encrypted = credentialManager.encrypt(credentials, testMasterKey);
      
      // Corrupt encrypted data
      const corrupted = {
        ...encrypted,
        encrypted: encrypted.encrypted.substring(0, encrypted.encrypted.length - 10) + 'corrupted'
      };
      
      // Try to decrypt corrupted data
      expect(() => {
        credentialManager.decrypt(corrupted, testMasterKey);
      }).toThrow('Failed to decrypt credentials');
    });
  });
  
  describe('Master Key Generation', () => {
    it('should generate a secure random master key', () => {
      const masterKey = credentialManager.generateMasterKey();
      
      // Check key format (hex string)
      expect(typeof masterKey).toBe('string');
      expect(masterKey).toMatch(/^[0-9a-f]{64}$/);
      
      // Generate another key and check that it's different
      const anotherKey = credentialManager.generateMasterKey();
      expect(masterKey).not.toBe(anotherKey);
    });
  });
  
  describe('Value Hashing', () => {
    it('should hash values consistently', () => {
      const value = 'test-value';
      
      // Hash value
      const hash1 = credentialManager.hashValue(value);
      const hash2 = credentialManager.hashValue(value);
      
      // Check hash format (hex string)
      expect(typeof hash1).toBe('string');
      expect(hash1).toMatch(/^[0-9a-f]{64}$/);
      
      // Check that hashing is consistent
      expect(hash1).toBe(hash2);
      
      // Check that different values produce different hashes
      const differentHash = credentialManager.hashValue('different-value');
      expect(hash1).not.toBe(differentHash);
    });
    
    it('should correctly compare value with hash', () => {
      const value = 'test-value';
      const hash = credentialManager.hashValue(value);
      
      // Check correct value
      expect(credentialManager.compareHash(value, hash)).toBe(true);
      
      // Check incorrect value
      expect(credentialManager.compareHash('wrong-value', hash)).toBe(false);
    });
  });
});