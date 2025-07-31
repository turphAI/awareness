// Jest setup file
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.JWT_EXPIRATION = '1h';
process.env.DATABASE_HOST = 'test-host';
process.env.DATABASE_USERNAME = 'test-user';
process.env.DATABASE_PASSWORD = 'test-password';
process.env.DATABASE_NAME = 'test-database';
process.env.NODE_ENV = 'test';