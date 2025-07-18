const mongoose = require('mongoose');
const request = require('supertest');
const { app } = require('../index');
const User = require('../models/User');
const emailService = require('../utils/emailService');

// Mock email service
jest.mock('../utils/emailService', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
  sendWelcomeEmail: jest.fn().mockResolvedValue(true)
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

// Clear users collection before each test
beforeEach(async () => {
  await User.deleteMany({});
  jest.clearAllMocks();
});

describe('Authentication Controller', () => {
  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'Password123!',
        confirmPassword: 'Password123!'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.user.name).toBe(userData.name);
      expect(response.body.user.emailVerified).toBe(false);

      // Check if user was saved to database
      const user = await User.findOne({ email: userData.email });
      expect(user).toBeDefined();
      expect(user.name).toBe(userData.name);
      expect(user.emailVerificationToken).toBeDefined();

      // Check if verification email was sent
      expect(emailService.sendVerificationEmail).toHaveBeenCalledTimes(1);
      expect(emailService.sendVerificationEmail).toHaveBeenCalledWith(
        expect.objectContaining({ email: userData.email }),
        expect.any(String),
        expect.any(String)
      );

      // Check if welcome email was sent
      expect(emailService.sendWelcomeEmail).toHaveBeenCalledTimes(1);
      expect(emailService.sendWelcomeEmail).toHaveBeenCalledWith(
        expect.objectContaining({ email: userData.email })
      );
    });

    it('should return error if user already exists', async () => {
      // Create a user first
      await User.create({
        name: 'Existing User',
        email: 'existing@example.com',
        passwordHash: 'hashedpassword'
      });

      const userData = {
        name: 'Test User',
        email: 'existing@example.com',
        password: 'Password123!',
        confirmPassword: 'Password123!'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBeUndefined();
      expect(response.body.message).toBe('User with this email already exists');

      // Check that no email was sent
      expect(emailService.sendVerificationEmail).not.toHaveBeenCalled();
      expect(emailService.sendWelcomeEmail).not.toHaveBeenCalled();
    });

    it('should return error if validation fails', async () => {
      const userData = {
        name: 'Test User',
        email: 'invalid-email',
        password: 'short',
        confirmPassword: 'different'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBeUndefined();
      expect(response.body.message).toBeDefined();

      // Check that no email was sent
      expect(emailService.sendVerificationEmail).not.toHaveBeenCalled();
      expect(emailService.sendWelcomeEmail).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login user successfully', async () => {
      // Create a user first
      const user = new User({
        name: 'Test User',
        email: 'test@example.com',
        passwordHash: 'Password123!'
      });
      await user.save();

      const loginData = {
        email: 'test@example.com',
        password: 'Password123!'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe(loginData.email);
    });

    it('should return error if user does not exist', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: 'Password123!'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.success).toBeUndefined();
      expect(response.body.message).toBe('Invalid credentials');
    });

    it('should return error if password is incorrect', async () => {
      // Create a user first
      const user = new User({
        name: 'Test User',
        email: 'test@example.com',
        passwordHash: 'Password123!'
      });
      await user.save();

      const loginData = {
        email: 'test@example.com',
        password: 'WrongPassword123!'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.success).toBeUndefined();
      expect(response.body.message).toBe('Invalid credentials');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user', async () => {
      // Create a user first
      const user = new User({
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

      const token = loginResponse.body.token;

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe(user.email);
      expect(response.body.user.name).toBe(user.name);
    });

    it('should return error if not authenticated', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body.success).toBeUndefined();
      expect(response.body.message).toBe('Not authorized to access this route');
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    it('should send password reset email for existing user', async () => {
      // Create a user first
      const user = new User({
        name: 'Test User',
        email: 'test@example.com',
        passwordHash: 'Password123!'
      });
      await user.save();

      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'test@example.com' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Password reset email sent');

      // Check if reset token was generated
      const updatedUser = await User.findById(user._id);
      expect(updatedUser.resetPasswordToken).toBeDefined();
      expect(updatedUser.resetPasswordExpire).toBeDefined();

      // Check if password reset email was sent
      expect(emailService.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
      expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        expect.objectContaining({ email: user.email }),
        expect.any(String),
        expect.any(String)
      );
    });

    it('should return success even if user does not exist (security)', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Password reset email sent if account exists');

      // Check that no email was sent
      expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/auth/reset-password/:token', () => {
    it('should reset password with valid token', async () => {
      // Create a user first
      const user = new User({
        name: 'Test User',
        email: 'test@example.com',
        passwordHash: 'Password123!'
      });
      
      // Generate reset token
      const resetToken = user.generatePasswordResetToken();
      await user.save();

      const response = await request(app)
        .post(`/api/auth/reset-password/${resetToken}`)
        .send({
          password: 'NewPassword123!',
          confirmPassword: 'NewPassword123!'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.message).toBe('Password reset successful');

      // Check if password was updated
      const updatedUser = await User.findById(user._id).select('+passwordHash');
      const isMatch = await updatedUser.comparePassword('NewPassword123!');
      expect(isMatch).toBe(true);

      // Check if reset token was cleared
      expect(updatedUser.resetPasswordToken).toBeUndefined();
      expect(updatedUser.resetPasswordExpire).toBeUndefined();
    });

    it('should return error with invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password/invalidtoken')
        .send({
          password: 'NewPassword123!',
          confirmPassword: 'NewPassword123!'
        })
        .expect(400);

      expect(response.body.success).toBeUndefined();
      expect(response.body.message).toBe('Invalid or expired token');
    });
  });

  describe('GET /api/auth/verify-email/:token', () => {
    it('should verify email with valid token', async () => {
      // Create a user first
      const user = new User({
        name: 'Test User',
        email: 'test@example.com',
        passwordHash: 'Password123!',
        emailVerified: false
      });
      
      // Generate verification token
      const verificationToken = user.generateEmailVerificationToken();
      await user.save();

      const response = await request(app)
        .get(`/api/auth/verify-email/${verificationToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Email verified successfully');

      // Check if email was verified
      const updatedUser = await User.findById(user._id);
      expect(updatedUser.emailVerified).toBe(true);
      expect(updatedUser.emailVerificationToken).toBeUndefined();
    });

    it('should return error with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/verify-email/invalidtoken')
        .expect(400);

      expect(response.body.success).toBeUndefined();
      expect(response.body.message).toBe('Invalid or expired token');
    });
  });

  describe('POST /api/auth/change-password', () => {
    it('should change password for authenticated user', async () => {
      // Create a user first
      const user = new User({
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

      const token = loginResponse.body.token;

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'Password123!',
          password: 'NewPassword123!',
          confirmPassword: 'NewPassword123!'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Password changed successfully');

      // Check if password was updated
      const updatedUser = await User.findById(user._id).select('+passwordHash');
      const isMatch = await updatedUser.comparePassword('NewPassword123!');
      expect(isMatch).toBe(true);
    });

    it('should return error if current password is incorrect', async () => {
      // Create a user first
      const user = new User({
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

      const token = loginResponse.body.token;

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'WrongPassword123!',
          password: 'NewPassword123!',
          confirmPassword: 'NewPassword123!'
        })
        .expect(401);

      expect(response.body.success).toBeUndefined();
      expect(response.body.message).toBe('Current password is incorrect');
    });

    it('should return error if not authenticated', async () => {
      const response = await request(app)
        .post('/api/auth/change-password')
        .send({
          currentPassword: 'Password123!',
          password: 'NewPassword123!',
          confirmPassword: 'NewPassword123!'
        })
        .expect(401);

      expect(response.body.success).toBeUndefined();
      expect(response.body.message).toBe('Not authorized to access this route');
    });
  });
});