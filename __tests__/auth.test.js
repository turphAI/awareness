import { createMocks } from 'node-mocks-http';
import loginHandler from '../api/auth/login';
import registerHandler from '../api/auth/register';
import profileHandler from '../api/auth/profile';
import changePasswordHandler from '../api/auth/change-password';
import healthHandler from '../api/health';

// Mock the database module
jest.mock('../lib/database', () => ({
  executeQuery: jest.fn()
}));

// Mock the auth module
jest.mock('../lib/auth', () => ({
  authenticate: jest.fn(),
  verifyPassword: jest.fn(),
  hashPassword: jest.fn(),
  generateToken: jest.fn(),
  generateEmailVerificationToken: jest.fn()
}));

import { executeQuery } from '../lib/database';
import { authenticate, verifyPassword, hashPassword, generateToken, generateEmailVerificationToken } from '../lib/auth';

describe('Authentication API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('/api/auth/login', () => {
    test('should login user with valid credentials', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          email: 'test@example.com',
          password: 'TestPassword123'
        }
      });

      const mockUser = {
        id: 1,
        email: 'test@example.com',
        password_hash: 'hashedpassword',
        name: 'Test User',
        role: 'user',
        email_verified: true
      };

      executeQuery
        .mockResolvedValueOnce([mockUser]) // Find user
        .mockResolvedValueOnce({}); // Update last login

      verifyPassword.mockResolvedValue(true);
      generateToken.mockReturnValue('mock-jwt-token');

      await loginHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data.success).toBe(true);
      expect(data.token).toBe('mock-jwt-token');
      expect(data.user.email).toBe('test@example.com');
    });

    test('should reject invalid credentials', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          email: 'test@example.com',
          password: 'wrongpassword'
        }
      });

      executeQuery.mockResolvedValue([]); // No user found

      await loginHandler(req, res);

      expect(res._getStatusCode()).toBe(401);
      const data = JSON.parse(res._getData());
      expect(data.success).toBe(false);
      expect(data.error).toBe('Invalid credentials');
    });

    test('should reject non-POST requests', async () => {
      const { req, res } = createMocks({
        method: 'GET'
      });

      await loginHandler(req, res);

      expect(res._getStatusCode()).toBe(405);
      const data = JSON.parse(res._getData());
      expect(data.success).toBe(false);
      expect(data.error).toBe('Method not allowed');
    });
  });

  describe('/api/auth/register', () => {
    test('should register new user successfully', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          email: 'newuser@example.com',
          password: 'NewPassword123',
          name: 'New User'
        }
      });

      executeQuery
        .mockResolvedValueOnce([]) // No existing user
        .mockResolvedValueOnce({ insertId: 1 }); // Insert new user

      hashPassword.mockResolvedValue('hashedpassword');
      generateToken.mockReturnValue('mock-jwt-token');
      generateEmailVerificationToken.mockReturnValue({ hashedToken: 'hashed-verification-token' });

      await registerHandler(req, res);

      expect(res._getStatusCode()).toBe(201);
      const data = JSON.parse(res._getData());
      expect(data.success).toBe(true);
      expect(data.token).toBe('mock-jwt-token');
      expect(data.user.email).toBe('newuser@example.com');
    });

    test('should reject duplicate email', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          email: 'existing@example.com',
          password: 'Password123',
          name: 'Test User'
        }
      });

      executeQuery.mockResolvedValue([{ id: 1 }]); // Existing user found

      await registerHandler(req, res);

      expect(res._getStatusCode()).toBe(400);
      const data = JSON.parse(res._getData());
      expect(data.success).toBe(false);
      expect(data.error).toBe('User with this email already exists');
    });
  });

  describe('/api/auth/profile', () => {
    test('should get user profile when authenticated', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        headers: {
          authorization: 'Bearer valid-token'
        }
      });

      const mockUser = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        email_verified: true,
        last_login: new Date(),
        preferences: '{"topics": []}',
        notifications: '{"email": true}',
        profile: '{}',
        data_retention: '{}',
        privacy_settings: '{}',
        created_at: new Date(),
        updated_at: new Date()
      };

      authenticate.mockResolvedValue({ id: 1, email: 'test@example.com' });
      executeQuery.mockResolvedValue([mockUser]);

      await profileHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data.success).toBe(true);
      expect(data.user.email).toBe('test@example.com');
    });

    test('should reject unauthenticated requests', async () => {
      const { req, res } = createMocks({
        method: 'GET'
      });

      authenticate.mockResolvedValue(null);

      await profileHandler(req, res);

      expect(res._getStatusCode()).toBe(401);
      const data = JSON.parse(res._getData());
      expect(data.success).toBe(false);
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('/api/auth/change-password', () => {
    test('should change password successfully', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          authorization: 'Bearer valid-token'
        },
        body: {
          currentPassword: 'OldPassword123',
          newPassword: 'NewPassword123'
        }
      });

      authenticate.mockResolvedValue({ id: 1, email: 'test@example.com' });
      executeQuery
        .mockResolvedValueOnce([{ password_hash: 'oldhash' }]) // Get current password
        .mockResolvedValueOnce({}); // Update password

      verifyPassword.mockResolvedValue(true);
      hashPassword.mockResolvedValue('newhash');

      await changePasswordHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data.success).toBe(true);
      expect(data.message).toBe('Password changed successfully');
    });

    test('should reject incorrect current password', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          authorization: 'Bearer valid-token'
        },
        body: {
          currentPassword: 'WrongPassword',
          newPassword: 'NewPassword123'
        }
      });

      authenticate.mockResolvedValue({ id: 1, email: 'test@example.com' });
      executeQuery.mockResolvedValue([{ password_hash: 'oldhash' }]);
      verifyPassword.mockResolvedValue(false);

      await changePasswordHandler(req, res);

      expect(res._getStatusCode()).toBe(401);
      const data = JSON.parse(res._getData());
      expect(data.success).toBe(false);
      expect(data.error).toBe('Current password is incorrect');
    });
  });

  describe('/api/health', () => {
    test('should return healthy status', async () => {
      const { req, res } = createMocks({
        method: 'GET'
      });

      executeQuery.mockResolvedValue([{ test: 1 }]);

      await healthHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data.success).toBe(true);
      expect(data.data.status).toBe('healthy');
      expect(data.data.database).toBe('connected');
    });

    test('should return unhealthy status on database error', async () => {
      const { req, res } = createMocks({
        method: 'GET'
      });

      executeQuery.mockRejectedValue(new Error('Database connection failed'));

      await healthHandler(req, res);

      expect(res._getStatusCode()).toBe(503);
      const data = JSON.parse(res._getData());
      expect(data.success).toBe(false);
      expect(data.error).toBe('Service unavailable');
    });
  });
});