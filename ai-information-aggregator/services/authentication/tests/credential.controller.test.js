const mongoose = require('mongoose');
const request = require('supertest');
const { app } = require('../index');
const User = require('../models/User');
const Credential = require('../models/Credential');
const credentialManager = require('../utils/credentialManager');

// Mock environment variables
process.env.CREDENTIAL_ENCRYPTION_KEY = 'test-master-key-that-is-at-least-32-characters';

// Mock credential manager
jest.mock('../utils/credentialManager', () => ({
  encrypt: jest.fn().mockReturnValue({
    version: 1,
    salt: 'mock-salt',
    iv: 'mock-iv',
    tag: 'mock-tag',
    encrypted: 'mock-encrypted-data'
  }),
  decrypt: jest.fn().mockReturnValue({
    username: 'testuser',
    password: 'testpassword'
  })
}));

// Connect to test database before tests
beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/test-db', {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
});

// Clear test database after tests
afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
});

// Clear collections before each test
beforeEach(async () => {
  await User.deleteMany({});
  await Credential.deleteMany({});
  jest.clearAllMocks();
});

describe('Credential Controller', () => {
  let user, token;
  
  // Create a user and get token before each test
  beforeEach(async () => {
    // Create a user
    user = new User({
      name: 'Test User',
      email: 'test@example.com',
      passwordHash: 'Password123!'
    });
    await user.save();
    
    // Login to get token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'Password123!'
      });
    
    token = loginResponse.body.token;
  });
  
  describe('POST /api/credentials', () => {
    it('should create a new credential successfully', async () => {
      const credentialData = {
        service: 'test-service',
        name: 'Test Credential',
        description: 'A test credential',
        credentials: {
          username: 'testuser',
          password: 'testpassword'
        }
      };
      
      const response = await request(app)
        .post('/api/credentials')
        .set('Authorization', `Bearer ${token}`)
        .send(credentialData)
        .expect(201);
      
      expect(response.body.success).toBe(true);
      expect(response.body.credential).toBeDefined();
      expect(response.body.credential.service).toBe(credentialData.service);
      expect(response.body.credential.name).toBe(credentialData.name);
      expect(response.body.credential.description).toBe(credentialData.description);
      
      // Check if credential was saved to database
      const credential = await Credential.findOne({ service: credentialData.service });
      expect(credential).toBeDefined();
      expect(credential.userId.toString()).toBe(user._id.toString());
      
      // Check if encryption was called
      expect(credentialManager.encrypt).toHaveBeenCalledTimes(1);
      expect(credentialManager.encrypt).toHaveBeenCalledWith(
        credentialData.credentials,
        process.env.CREDENTIAL_ENCRYPTION_KEY
      );
    });
    
    it('should return error if credential with same name already exists', async () => {
      // Create a credential first
      await Credential.create({
        userId: user._id,
        service: 'test-service',
        name: 'Test Credential',
        encryptedData: {
          version: 1,
          salt: 'mock-salt',
          iv: 'mock-iv',
          tag: 'mock-tag',
          encrypted: 'mock-encrypted-data'
        }
      });
      
      const credentialData = {
        service: 'test-service',
        name: 'Test Credential', // Same name
        credentials: {
          username: 'testuser',
          password: 'testpassword'
        }
      };
      
      const response = await request(app)
        .post('/api/credentials')
        .set('Authorization', `Bearer ${token}`)
        .send(credentialData)
        .expect(400);
      
      expect(response.body.success).toBeUndefined();
      expect(response.body.message).toBe('Credential with this name already exists for this service');
    });
    
    it('should return error if validation fails', async () => {
      const credentialData = {
        // Missing required fields
        service: 'test-service'
      };
      
      const response = await request(app)
        .post('/api/credentials')
        .set('Authorization', `Bearer ${token}`)
        .send(credentialData)
        .expect(400);
      
      expect(response.body.success).toBeUndefined();
      expect(response.body.message).toBeDefined();
    });
  });
  
  describe('GET /api/credentials', () => {
    it('should get all credentials for the authenticated user', async () => {
      // Create credentials
      await Credential.create([
        {
          userId: user._id,
          service: 'service1',
          name: 'Credential 1',
          description: 'First credential',
          encryptedData: {
            version: 1,
            salt: 'mock-salt',
            iv: 'mock-iv',
            tag: 'mock-tag',
            encrypted: 'mock-encrypted-data'
          }
        },
        {
          userId: user._id,
          service: 'service2',
          name: 'Credential 2',
          description: 'Second credential',
          encryptedData: {
            version: 1,
            salt: 'mock-salt',
            iv: 'mock-iv',
            tag: 'mock-tag',
            encrypted: 'mock-encrypted-data'
          }
        },
        {
          userId: new mongoose.Types.ObjectId(), // Different user
          service: 'service3',
          name: 'Credential 3',
          encryptedData: {
            version: 1,
            salt: 'mock-salt',
            iv: 'mock-iv',
            tag: 'mock-tag',
            encrypted: 'mock-encrypted-data'
          }
        }
      ]);
      
      const response = await request(app)
        .get('/api/credentials')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(2); // Only user's credentials
      expect(response.body.credentials).toHaveLength(2);
      expect(response.body.credentials[0].service).toBe('service1');
      expect(response.body.credentials[1].service).toBe('service2');
      
      // Check that sensitive data is not returned
      expect(response.body.credentials[0].encryptedData).toBeUndefined();
    });
    
    it('should filter credentials by service', async () => {
      // Create credentials
      await Credential.create([
        {
          userId: user._id,
          service: 'service1',
          name: 'Credential 1',
          encryptedData: {
            version: 1,
            salt: 'mock-salt',
            iv: 'mock-iv',
            tag: 'mock-tag',
            encrypted: 'mock-encrypted-data'
          }
        },
        {
          userId: user._id,
          service: 'service2',
          name: 'Credential 2',
          encryptedData: {
            version: 1,
            salt: 'mock-salt',
            iv: 'mock-iv',
            tag: 'mock-tag',
            encrypted: 'mock-encrypted-data'
          }
        }
      ]);
      
      const response = await request(app)
        .get('/api/credentials?service=service1')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(1);
      expect(response.body.credentials).toHaveLength(1);
      expect(response.body.credentials[0].service).toBe('service1');
    });
  });
  
  describe('GET /api/credentials/:id', () => {
    it('should get credential by ID', async () => {
      // Create a credential
      const credential = await Credential.create({
        userId: user._id,
        service: 'test-service',
        name: 'Test Credential',
        description: 'A test credential',
        encryptedData: {
          version: 1,
          salt: 'mock-salt',
          iv: 'mock-iv',
          tag: 'mock-tag',
          encrypted: 'mock-encrypted-data'
        }
      });
      
      const response = await request(app)
        .get(`/api/credentials/${credential._id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.credential).toBeDefined();
      expect(response.body.credential.service).toBe('test-service');
      expect(response.body.credential.name).toBe('Test Credential');
      expect(response.body.credential.description).toBe('A test credential');
      
      // Check that sensitive data is not returned
      expect(response.body.credential.encryptedData).toBeUndefined();
    });
    
    it('should return error if credential not found', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      
      const response = await request(app)
        .get(`/api/credentials/${nonExistentId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
      
      expect(response.body.success).toBeUndefined();
      expect(response.body.message).toBe('Credential not found');
    });
  });
  
  describe('GET /api/credentials/:id/decrypt', () => {
    it('should get decrypted credential', async () => {
      // Create a credential
      const credential = await Credential.create({
        userId: user._id,
        service: 'test-service',
        name: 'Test Credential',
        encryptedData: {
          version: 1,
          salt: 'mock-salt',
          iv: 'mock-iv',
          tag: 'mock-tag',
          encrypted: 'mock-encrypted-data'
        }
      });
      
      const response = await request(app)
        .get(`/api/credentials/${credential._id}/decrypt`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.credential).toBeDefined();
      expect(response.body.credential.service).toBe('test-service');
      expect(response.body.credential.name).toBe('Test Credential');
      expect(response.body.credential.credentials).toBeDefined();
      expect(response.body.credential.credentials.username).toBe('testuser');
      expect(response.body.credential.credentials.password).toBe('testpassword');
      
      // Check if decryption was called
      expect(credentialManager.decrypt).toHaveBeenCalledTimes(1);
      expect(credentialManager.decrypt).toHaveBeenCalledWith(
        expect.objectContaining({
          version: 1,
          salt: 'mock-salt',
          iv: 'mock-iv',
          tag: 'mock-tag',
          encrypted: 'mock-encrypted-data'
        }),
        process.env.CREDENTIAL_ENCRYPTION_KEY
      );
      
      // Check if usage was recorded
      const updatedCredential = await Credential.findById(credential._id);
      expect(updatedCredential.lastUsed).toBeDefined();
    });
    
    it('should return error if credential not found', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      
      const response = await request(app)
        .get(`/api/credentials/${nonExistentId}/decrypt`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
      
      expect(response.body.success).toBeUndefined();
      expect(response.body.message).toBe('Credential not found');
    });
    
    it('should return error if credential is expired', async () => {
      // Create an expired credential
      const credential = await Credential.create({
        userId: user._id,
        service: 'test-service',
        name: 'Test Credential',
        encryptedData: {
          version: 1,
          salt: 'mock-salt',
          iv: 'mock-iv',
          tag: 'mock-tag',
          encrypted: 'mock-encrypted-data'
        },
        expiresAt: new Date(Date.now() - 1000) // Expired
      });
      
      const response = await request(app)
        .get(`/api/credentials/${credential._id}/decrypt`)
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
      
      expect(response.body.success).toBeUndefined();
      expect(response.body.message).toBe('Credential has expired');
    });
  });
  
  describe('PUT /api/credentials/:id', () => {
    it('should update credential', async () => {
      // Create a credential
      const credential = await Credential.create({
        userId: user._id,
        service: 'test-service',
        name: 'Test Credential',
        description: 'Original description',
        encryptedData: {
          version: 1,
          salt: 'mock-salt',
          iv: 'mock-iv',
          tag: 'mock-tag',
          encrypted: 'mock-encrypted-data'
        }
      });
      
      const updateData = {
        name: 'Updated Credential',
        description: 'Updated description',
        credentials: {
          username: 'newuser',
          password: 'newpassword'
        }
      };
      
      const response = await request(app)
        .put(`/api/credentials/${credential._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updateData)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.credential).toBeDefined();
      expect(response.body.credential.name).toBe('Updated Credential');
      expect(response.body.credential.description).toBe('Updated description');
      
      // Check if credential was updated in database
      const updatedCredential = await Credential.findById(credential._id);
      expect(updatedCredential.name).toBe('Updated Credential');
      expect(updatedCredential.description).toBe('Updated description');
      
      // Check if encryption was called
      expect(credentialManager.encrypt).toHaveBeenCalledTimes(1);
      expect(credentialManager.encrypt).toHaveBeenCalledWith(
        updateData.credentials,
        process.env.CREDENTIAL_ENCRYPTION_KEY
      );
    });
    
    it('should return error if credential not found', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      
      const response = await request(app)
        .put(`/api/credentials/${nonExistentId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Updated Credential'
        })
        .expect(404);
      
      expect(response.body.success).toBeUndefined();
      expect(response.body.message).toBe('Credential not found');
    });
  });
  
  describe('DELETE /api/credentials/:id', () => {
    it('should delete credential', async () => {
      // Create a credential
      const credential = await Credential.create({
        userId: user._id,
        service: 'test-service',
        name: 'Test Credential',
        encryptedData: {
          version: 1,
          salt: 'mock-salt',
          iv: 'mock-iv',
          tag: 'mock-tag',
          encrypted: 'mock-encrypted-data'
        }
      });
      
      const response = await request(app)
        .delete(`/api/credentials/${credential._id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Credential deleted successfully');
      
      // Check if credential was soft deleted
      const deletedCredential = await Credential.findById(credential._id);
      expect(deletedCredential.active).toBe(false);
    });
    
    it('should return error if credential not found', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      
      const response = await request(app)
        .delete(`/api/credentials/${nonExistentId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
      
      expect(response.body.success).toBeUndefined();
      expect(response.body.message).toBe('Credential not found');
    });
  });
});