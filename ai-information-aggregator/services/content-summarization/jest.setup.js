// Load environment variables for testing
require('dotenv').config();

// Set mock API keys for testing to avoid initialization errors
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'mock-openai-key-for-testing';
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'mock-anthropic-key-for-testing';