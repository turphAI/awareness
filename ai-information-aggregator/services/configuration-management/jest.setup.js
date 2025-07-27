// Jest setup file for Configuration Management Service

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';
process.env.MONGO_URI = 'mongodb://localhost:27017/ai-aggregator-test';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  // Uncomment to ignore specific console methods
  // log: jest.fn(),
  // debug: jest.fn(),
  // info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Global test utilities
global.createMockUser = () => ({
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
  role: 'user'
});

global.createMockRequest = (overrides = {}) => ({
  user: global.createMockUser(),
  params: {},
  query: {},
  body: {},
  headers: {},
  app: {
    locals: {
      logger: {
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn()
      }
    }
  },
  ...overrides
});

global.createMockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  return res;
};

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});