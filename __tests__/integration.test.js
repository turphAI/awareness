import { createMocks } from 'node-mocks-http';
import loginHandler from '../api/auth/login';
import registerHandler from '../api/auth/register';
import profileHandler from '../api/auth/profile';
import healthHandler from '../api/health';

// Mock the database module for integration tests
jest.mock('../lib/database', () => ({
  executeQuery: jest.fn()
}));

import { executeQuery } from '../lib/database';

describe('Authentication Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('complete authentication flow', async () => {
    // 1. Register a new user
    const { req: registerReq, res: registerRes } = createMocks({
      method: 'POST',
      body: {
        email: 'integration@example.com',
        password: 'IntegrationTest123',
        name: 'Integration Test User'
      }
    });

    executeQuery
      .mockResolvedValueOnce([]) // No existing user
      .mockResolvedValueOnce({ insertId: 1 }); // Insert new user

    await registerHandler(registerReq, registerRes);

    expect(registerRes._getStatusCode()).toBe(201);
    const registerData = JSON.parse(registerRes._getData());
    expect(registerData.success).toBe(true);
    expect(registerData.token).toBeDefined();
    expect(registerData.user.email).toBe('integration@example.com');

    // 2. Login with the registered user
    const { req: loginReq, res: loginRes } = createMocks({
      method: 'POST',
      body: {
        email: 'integration@example.com',
        password: 'IntegrationTest123'
      }
    });

    const mockUser = {
      id: 1,
      email: 'integration@example.com',
      password_hash: '$2a$12$hashedpassword',
      name: 'Integration Test User',
      role: 'user',
      email_verified: false
    };

    executeQuery
      .mockResolvedValueOnce([mockUser]) // Find user
      .mockResolvedValueOnce({}); // Update last login

    // Mock bcrypt comparison to return true
    const bcrypt = require('bcryptjs');
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

    // Mock JWT generation
    const jwt = require('jsonwebtoken');
    jest.spyOn(jwt, 'sign').mockReturnValue('mock-login-token');

    await loginHandler(loginReq, loginRes);

    expect(loginRes._getStatusCode()).toBe(200);
    const loginData = JSON.parse(loginRes._getData());
    expect(loginData.success).toBe(true);
    expect(loginData.token).toBeDefined();
    expect(loginData.user.email).toBe('integration@example.com');

    // 3. Access profile with the token
    const { req: profileReq, res: profileRes } = createMocks({
      method: 'GET',
      headers: {
        authorization: `Bearer ${loginData.token}`
      }
    });

    // Mock JWT verification for profile access
    jest.spyOn(jwt, 'verify').mockReturnValue({ id: 1, email: 'integration@example.com' });

    const mockUserProfile = {
      id: 1,
      email: 'integration@example.com',
      name: 'Integration Test User',
      role: 'user',
      email_verified: false,
      last_login: new Date(),
      preferences: '{"topics": []}',
      notifications: '{"email": true}',
      profile: '{}',
      data_retention: '{}',
      privacy_settings: '{}',
      created_at: new Date(),
      updated_at: new Date()
    };

    executeQuery.mockResolvedValueOnce([mockUserProfile]);

    await profileHandler(profileReq, profileRes);

    expect(profileRes._getStatusCode()).toBe(200);
    const profileData = JSON.parse(profileRes._getData());
    expect(profileData.success).toBe(true);
    expect(profileData.user.email).toBe('integration@example.com');
    expect(profileData.user.preferences).toBeDefined();
  });

  test('health check endpoint', async () => {
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

  test('error handling across endpoints', async () => {
    // Test database error handling
    executeQuery.mockRejectedValue(new Error('Database connection failed'));

    const { req: healthReq, res: healthRes } = createMocks({
      method: 'GET'
    });

    await healthHandler(healthReq, healthRes);

    expect(healthRes._getStatusCode()).toBe(503);
    const healthData = JSON.parse(healthRes._getData());
    expect(healthData.success).toBe(false);
    expect(healthData.error).toBe('Service unavailable');

    // Test invalid login
    const { req: loginReq, res: loginRes } = createMocks({
      method: 'POST',
      body: {
        email: 'nonexistent@example.com',
        password: 'wrongpassword'
      }
    });

    executeQuery.mockResolvedValue([]); // No user found

    await loginHandler(loginReq, loginRes);

    expect(loginRes._getStatusCode()).toBe(401);
    const loginData = JSON.parse(loginRes._getData());
    expect(loginData.success).toBe(false);
    expect(loginData.error).toBe('Invalid credentials');
  });
});