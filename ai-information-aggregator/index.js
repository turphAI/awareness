#!/usr/bin/env node

/**
 * AI Information Aggregator - Main Entry Point
 * 
 * This is the main entry point for the AI Information Aggregator application.
 * It starts the API Gateway which serves as the main interface for the application.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 Starting AI Information Aggregator...');
console.log('=====================================\n');

// Check if .env file exists, if not copy from .env.example
const envPath = path.join(__dirname, '.env');
const envExamplePath = path.join(__dirname, '.env.example');

if (!fs.existsSync(envPath) && fs.existsSync(envExamplePath)) {
  console.log('📝 Creating .env file from .env.example...');
  fs.copyFileSync(envExamplePath, envPath);
  console.log('✅ .env file created. Please update it with your configuration.\n');
}

// Start the API Gateway
console.log('🌐 Starting API Gateway...');
const apiGateway = spawn('node', ['api-gateway/index.js'], {
  cwd: __dirname,
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: process.env.NODE_ENV || 'development'
  }
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down AI Information Aggregator...');
  apiGateway.kill('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down AI Information Aggregator...');
  apiGateway.kill('SIGTERM');
  process.exit(0);
});

// Handle API Gateway exit
apiGateway.on('exit', (code) => {
  if (code !== 0) {
    console.error(`❌ API Gateway exited with code ${code}`);
    process.exit(code);
  }
});

apiGateway.on('error', (error) => {
  console.error('❌ Failed to start API Gateway:', error);
  process.exit(1);
});

console.log('✅ AI Information Aggregator started successfully!');
console.log('📖 API Documentation: http://localhost:3000/api-docs');
console.log('🔍 Health Check: http://localhost:3000/health');
console.log('📊 Service Status: http://localhost:3000/api/status');
console.log('\nPress Ctrl+C to stop the application.\n');