const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Mock environment variables
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_EXPIRATION = '1h';

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

// Clear users collection before each test
beforeEach(async () => {
  await User.deleteMany({});
});

describe('User Model', () => {
  describe('Schema', () => {
    it('should create a new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        passwordHash: 'password123',
        name: 'Test User'
      };
      
      const user = new User(userData);
      const savedUser = await user.save();
      
      expect(savedUser._id).toBeDefined();
      expect(savedUser.email).toBe(userData.email);
      expect(savedUser.name).toBe(userData.name);
      expect(savedUser.role).toBe('user'); // Default role
      expect(savedUser.emailVerified).toBe(false); // Default verification status
      expect(savedUser.active).toBe(true); // Default active status
    });
    
    it('should fail validation when email is invalid', async () => {
      const userData = {
        email: 'invalid-email',
        passwordHash: 'password123',
        name: 'Test User'
      };
      
      const user = new User(userData);
      
      await expect(user.save()).rejects.toThrow();
    });
    
    it('should fail validation when required fields are missing', async () => {
      const userData = {
        email: 'test@example.com'
        // Missing passwordHash and name
      };
      
      const user = new User(userData);
      
      await expect(user.save()).rejects.toThrow();
    });
  });
  
  describe('Password Hashing', () => {
    it('should hash password before saving', async () => {
      const userData = {
        email: 'test@example.com',
        passwordHash: 'password123',
        name: 'Test User'
      };
      
      const user = new User(userData);
      await user.save();
      
      // Password should be hashed
      expect(user.passwordHash).not.toBe('password123');
      
      // Should be a valid bcrypt hash
      const isValidHash = /^\$2[ayb]\$[0-9]{2}\$[A-Za-z0-9./]{53}$/.test(user.passwordHash);
      expect(isValidHash).toBe(true);
    });
    
    it('should correctly compare passwords', async () => {
      const userData = {
        email: 'test@example.com',
        passwordHash: 'password123',
        name: 'Test User'
      };
      
      const user = new User(userData);
      await user.save();
      
      // Correct password should match
      const isMatch = await user.comparePassword('password123');
      expect(isMatch).toBe(true);
      
      // Incorrect password should not match
      const isNotMatch = await user.comparePassword('wrongpassword');
      expect(isNotMatch).toBe(false);
    });
  });
  
  describe('Token Generation', () => {
    it('should generate a valid JWT token', async () => {
      const userData = {
        email: 'test@example.com',
        passwordHash: 'password123',
        name: 'Test User'
      };
      
      const user = new User(userData);
      await user.save();
      
      const token = user.generateAuthToken();
      expect(token).toBeDefined();
      
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      expect(decoded.id).toEqual(user._id.toString());
      expect(decoded.role).toBe(user.role);
    });
    
    it('should generate a password reset token', async () => {
      const userData = {
        email: 'test@example.com',
        passwordHash: 'password123',
        name: 'Test User'
      };
      
      const user = new User(userData);
      await user.save();
      
      const resetToken = user.generatePasswordResetToken();
      expect(resetToken).toBeDefined();
      expect(user.resetPasswordToken).toBeDefined();
      expect(user.resetPasswordExpire).toBeDefined();
      
      // Token expiration should be in the future
      expect(user.resetPasswordExpire).toBeInstanceOf(Date);
      expect(user.resetPasswordExpire.getTime()).toBeGreaterThan(Date.now());
    });
    
    it('should generate an email verification token', async () => {
      const userData = {
        email: 'test@example.com',
        passwordHash: 'password123',
        name: 'Test User'
      };
      
      const user = new User(userData);
      await user.save();
      
      const verificationToken = user.generateEmailVerificationToken();
      expect(verificationToken).toBeDefined();
      expect(user.emailVerificationToken).toBeDefined();
    });
  });
  
  describe('User Methods', () => {
    it('should update user preferences', async () => {
      const userData = {
        email: 'test@example.com',
        passwordHash: 'password123',
        name: 'Test User'
      };
      
      const user = new User(userData);
      await user.save();
      
      const newPreferences = {
        topics: ['AI', 'Machine Learning'],
        contentVolume: 20,
        summaryLength: 'long'
      };
      
      await user.updatePreferences(newPreferences);
      
      expect(user.preferences.topics).toEqual(newPreferences.topics);
      expect(user.preferences.contentVolume).toBe(newPreferences.contentVolume);
      expect(user.preferences.summaryLength).toBe(newPreferences.summaryLength);
      
      // Other preferences should remain unchanged
      expect(user.preferences.digestFrequency).toBe('daily');
    });
    
    it('should update notification settings', async () => {
      const userData = {
        email: 'test@example.com',
        passwordHash: 'password123',
        name: 'Test User'
      };
      
      const user = new User(userData);
      await user.save();
      
      const newSettings = {
        email: false,
        push: false
      };
      
      await user.updateNotificationSettings(newSettings);
      
      expect(user.notifications.email).toBe(false);
      expect(user.notifications.push).toBe(false);
      
      // Other settings should remain unchanged
      expect(user.notifications.digest).toBe(true);
    });
    
    it('should update user profile', async () => {
      const userData = {
        email: 'test@example.com',
        passwordHash: 'password123',
        name: 'Test User'
      };
      
      const user = new User(userData);
      await user.save();
      
      const profileData = {
        bio: 'Test bio',
        organization: 'Test Org',
        jobTitle: 'Developer'
      };
      
      await user.updateProfile(profileData);
      
      expect(user.profile.bio).toBe(profileData.bio);
      expect(user.profile.organization).toBe(profileData.organization);
      expect(user.profile.jobTitle).toBe(profileData.jobTitle);
    });
  });
  
  describe('Static Methods', () => {
    it('should find user by email', async () => {
      const userData = {
        email: 'test@example.com',
        passwordHash: 'password123',
        name: 'Test User'
      };
      
      await new User(userData).save();
      
      const foundUser = await User.findByEmail('test@example.com');
      expect(foundUser).toBeDefined();
      expect(foundUser.email).toBe(userData.email);
      
      // Should be case insensitive
      const foundUserCaseInsensitive = await User.findByEmail('TEST@example.com');
      expect(foundUserCaseInsensitive).toBeDefined();
      
      // Should not find inactive users
      await User.findByIdAndUpdate(foundUser._id, { active: false });
      const inactiveUser = await User.findByEmail('test@example.com');
      expect(inactiveUser).toBeNull();
    });
    
    it('should find user by reset token', async () => {
      const userData = {
        email: 'test@example.com',
        passwordHash: 'password123',
        name: 'Test User'
      };
      
      const user = new User(userData);
      const resetToken = user.generatePasswordResetToken();
      await user.save();
      
      const foundUser = await User.findByResetToken(resetToken);
      expect(foundUser).toBeDefined();
      expect(foundUser.email).toBe(userData.email);
      
      // Should not find user with expired token
      await User.findByIdAndUpdate(user._id, { resetPasswordExpire: Date.now() - 1000 });
      const expiredUser = await User.findByResetToken(resetToken);
      expect(expiredUser).toBeNull();
    });
    
    it('should find user by verification token', async () => {
      const userData = {
        email: 'test@example.com',
        passwordHash: 'password123',
        name: 'Test User'
      };
      
      const user = new User(userData);
      const verificationToken = user.generateEmailVerificationToken();
      await user.save();
      
      const foundUser = await User.findByVerificationToken(verificationToken);
      expect(foundUser).toBeDefined();
      expect(foundUser.email).toBe(userData.email);
    });
  });
});