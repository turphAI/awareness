// Jest setup file
const { TextEncoder, TextDecoder } = require('util');

// Polyfill for Node.js compatibility
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock MessagePort if not available
if (typeof global.MessagePort === 'undefined') {
  global.MessagePort = class MessagePort {
    constructor() {}
    postMessage() {}
    close() {}
  };
}

// Mock Blob if not available
if (typeof global.Blob === 'undefined') {
  global.Blob = class Blob {
    constructor(chunks, options) {
      this.size = 0;
      this.type = options?.type || '';
    }
  };
}

// Mock ReadableStream if not available
if (typeof global.ReadableStream === 'undefined') {
  global.ReadableStream = class ReadableStream {
    constructor() {}
  };
}

// Mock fetch if not available
if (typeof global.fetch === 'undefined') {
  global.fetch = jest.fn();
}

// Set up test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.MONGO_TEST_URI = 'mongodb://localhost:27017/ai-aggregator-test';

// Set mongoose strictQuery to false to avoid deprecation warning
const mongoose = require('mongoose');
mongoose.set('strictQuery', false);