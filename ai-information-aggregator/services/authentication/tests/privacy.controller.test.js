const mongoose = require('mongoose');
const request = require('supertest');
const { app } = require('../index');
const User = require('../models/User');
const Credential = require('../models/Credential');

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
});

describe('Privacy Controller', () => {
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
  
  describe('GET /api/privacy/export', () => {
    it('should export user data', async () => {
      // Create some credentials for the user
      await Credential.create({
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
        .get('/api/privacy/export')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.profile).toBeDefined();
      expect(response.body.data.profile.email).toBe(user.email);
      expect(response.body.data.preferences).toBeDefined();
      expect(response.body.data.credentials).toBeDefined();
      expect(response.body.data.credentials).toHaveLength(1);
      expect(response.body.data.credentials[0].service).toBe('test-service');
      
      // Check that sensitive data is not included
      expect(response.body.data.profile.passwordHash).toBeUndefined();
      expect(response.body.data.credentials[0].encryptedData).toBeUndefined();
    });
    
    it('should return error if not authenticated', async () => {
      const response = await request(app)
        .get('/api/privacy/export')
        .expect(401);
      
      expect(response.body.success).toBeUndefined();
      expect(response.body.message).toBe('Not authorized to access this route');
    });
  });
  
  describe('POST /api/privacy/delete-account', () => {
    it('should schedule account for deletion', async () => {
      const response = await request(app)
        .post('/api/privacy/delete-account')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: 'Password123!' })
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Account scheduled for deletion');
      expect(response.body.deletionDate).toBeDefined();
      
      // Check if account is scheduled for deletion
      const updatedUser = await User.findById(user._id);
      expect(updatedUser.accountDeletionScheduled).toBeDefined();
      
      // Check that deletion date is about 30 days in the future
      const deletionDate = new Date(updatedUser.accountDeletionScheduled);
      const now = new Date();
      const daysDiff = Math.round((deletionDate - now) / (1000 * 60 * 60 * 24));
      expect(daysDiff).toBeCloseTo(30, 1);
    });
    
    it('should return error if password is incorrect', async () => {
      const response = await request(app)
        .post('/api/privacy/delete-account')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: 'WrongPassword123!' })
        .expect(401);
      
      expect(response.body.success).toBeUndefined();
      expect(response.body.message).toBe('Invalid password');
      
      // Check that account is not scheduled for deletion
      const updatedUser = await User.findById(user._id);
      expect(updatedUser.accountDeletionScheduled).toBeNull();
    });
  });
  
  describe('POST /api/privacy/cancel-deletion', () => {
    it('should cancel scheduled account deletion', async () => {
      // Schedule account for deletion first
      user.accountDeletionScheduled = new Date();
      await user.save();
      
      const response = await request(app)
        .post('/api/privacy/cancel-deletion')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Account deletion canceled');
      
      // Check if account deletion is canceled
      const updatedUser = await User.findById(user._id);
      expect(updatedUser.accountDeletionScheduled).toBeUndefined();
    });
    
    it('should return error if account is not scheduled for deletion', async () => {
      const response = await request(app)
        .post('/api/privacy/cancel-deletion')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
      
      expect(response.body.success).toBeUndefined();
      expect(response.body.message).toBe('Account is not scheduled for deletion');
    });
  });
  
  describe('GET /api/privacy/policy', () => {
    it('should return privacy policy', async () => {
      const response = await request(app)
        .get('/api/privacy/policy')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.privacyPolicy).toBeDefined();
      expect(response.body.privacyPolicy.title).toBe('Privacy Policy');
      expect(response.body.privacyPolicy.sections).toBeDefined();
      expect(response.body.privacyPolicy.sections.length).toBeGreaterThan(0);
    });
  });
  
  describe('GET /api/privacy/terms', () => {
    it('should return terms of service', async () => {
      const response = await request(app)
        .get('/api/privacy/terms')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.termsOfService).toBeDefined();
      expect(response.body.termsOfService.title).toBe('Terms of Service');
      expect(response.body.termsOfService.sections).toBeDefined();
      expect(response.body.termsOfService.sections.length).toBeGreaterThan(0);
    });
  });
  
  describe('DELETE /api/privacy/execute-deletion/:id', () => {
    let adminUser, adminToken;
    
    beforeEach(async () => {
      // Create an admin user
      adminUser = new User({
        name: 'Admin User',
        email: 'admin@example.com',
        passwordHash: 'Password123!',
        role: 'admin'
      });
      await adminUser.save();
      
      // Login as admin
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@example.com',
          password: 'Password123!'
        });
      
      adminToken = loginResponse.body.token;
      
      // Schedule user account for deletion in the past
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      user.accountDeletionScheduled = pastDate;
      await user.save();
    });
    
    it('should execute account deletion', async () => {
      const response = await request(app)
        .delete(`/api/privacy/execute-deletion/${user._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Account deleted successfully');
      
      // Check if account is marked as deleted
      const updatedUser = await User.findById(user._id);
      expect(updatedUser.accountDeleted).toBe(true);
      expect(updatedUser.active).toBe(false);
      expect(updatedUser.email).not.toBe(user.email);
      expect(updatedUser.name).toBe('Deleted User');
    });
    
    it('should return error if account is not scheduled for deletion', async () => {
      // Remove deletion schedule
      user.accountDeletionScheduled = undefined;
      await user.save();
      
      const response = await request(app)
        .delete(`/api/privacy/execute-deletion/${user._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
      
      expect(response.body.success).toBeUndefined();
      expect(response.body.message).toBe('Account is not scheduled for deletion');
    });
    
    it('should return error if deletion date has not passed', async () => {
      // Set deletion date to future
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      user.accountDeletionScheduled = futureDate;
      await user.save();
      
      const response = await request(app)
        .delete(`/api/privacy/execute-deletion/${user._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
      
      expect(response.body.success).toBeUndefined();
      expect(response.body.message).toBe('Account deletion date has not yet passed');
    });
    
    it('should return error if not admin', async () => {
      const response = await request(app)
        .delete(`/api/privacy/execute-deletion/${user._id}`)
        .set('Authorization', `Bearer ${token}`) // Regular user token
        .expect(403);
      
      expect(response.body.success).toBeUndefined();
      expect(response.body.message).toBe('You do not have permission to access this resource');
    });
  });
});