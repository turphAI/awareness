#!/usr/bin/env node

/**
 * Development Startup Script
 * 
 * This script starts the AI Information Aggregator in development mode.
 * It checks for required services and provides helpful information.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const net = require('net');

console.log('🚀 AI Information Aggregator - Development Mode');
console.log('===============================================\n');

// Check if .env file exists
const envPath = path.join(__dirname, '.env');
const envExamplePath = path.join(__dirname, '.env.example');

if (!fs.existsSync(envPath) && fs.existsSync(envExamplePath)) {
  console.log('📝 Creating .env file from .env.example...');
  fs.copyFileSync(envExamplePath, envPath);
  console.log('✅ .env file created. Please update it with your configuration.\n');
}

// Function to check if a port is open
function checkPort(port, host = 'localhost') {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    
    socket.setTimeout(1000);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    
    socket.on('error', () => {
      resolve(false);
    });
    
    socket.connect(port, host);
  });
}

async function checkServices() {
  console.log('🔍 Checking required services...\n');
  
  const mongoRunning = await checkPort(27017);
  const redisRunning = await checkPort(6379);
  
  console.log(`MongoDB (port 27017): ${mongoRunning ? '✅ Running' : '❌ Not running'}`);
  console.log(`Redis (port 6379): ${redisRunning ? '✅ Running' : '❌ Not running'}\n`);
  
  if (!mongoRunning || !redisRunning) {
    console.log('⚠️  Some services are not running. You have a few options:\n');
    
    if (!mongoRunning) {
      console.log('📦 MongoDB options:');
      console.log('   • Install locally: brew install mongodb-community (macOS) or apt-get install mongodb (Ubuntu)');
      console.log('   • Use Docker: docker run -d -p 27017:27017 --name mongodb mongo:latest');
      console.log('   • Use MongoDB Atlas (cloud): https://www.mongodb.com/atlas\n');
    }
    
    if (!redisRunning) {
      console.log('📦 Redis options:');
      console.log('   • Install locally: brew install redis (macOS) or apt-get install redis-server (Ubuntu)');
      console.log('   • Use Docker: docker run -d -p 6379:6379 --name redis redis:latest');
      console.log('   • Use Redis Cloud: https://redis.com/redis-enterprise-cloud/\n');
    }
    
    console.log('🐳 Or start all services with Docker Compose:');
    console.log('   docker-compose up -d\n');
    
    console.log('⚡ Starting API Gateway anyway (some features may not work)...\n');
  }
}

async function startApplication() {
  await checkServices();
  
  console.log('🔨 Building React frontend...');
  
  // Build the React frontend first
  const buildProcess = spawn('npm', ['run', 'build'], {
    cwd: path.join(__dirname, 'frontend'),
    stdio: 'inherit'
  });

  buildProcess.on('exit', (code) => {
    if (code !== 0) {
      console.error(`❌ Frontend build failed with code ${code}`);
      process.exit(code);
    }
    
    console.log('✅ Frontend built successfully!');
    console.log('🌐 Starting API Gateway...');
    
    // Start the API Gateway with nodemon for development
    const apiGateway = spawn('npx', ['nodemon', 'index.js'], {
      cwd: path.join(__dirname, 'api-gateway'),
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'development'
      }
    });

    // Handle process termination
    const cleanup = () => {
      console.log('\n🛑 Shutting down AI Information Aggregator...');
      apiGateway.kill('SIGINT');
      process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

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

    // Give it a moment to start
    setTimeout(() => {
      console.log('\n✅ Development server started!');
      console.log('🌍 Application (Login Page): http://localhost:3000');
      console.log('📖 API Documentation: http://localhost:3000/api-docs');
      console.log('🔍 Health Check: http://localhost:3000/health');
      console.log('📊 Service Status: http://localhost:3000/api/status');
      console.log('\n💡 The API server will automatically restart when you make backend changes.');
      console.log('💡 To rebuild the frontend, run: npm run build (in the frontend directory)');
      console.log('Press Ctrl+C to stop the application.\n');
    }, 2000);
  });

  buildProcess.on('error', (error) => {
    console.error('❌ Failed to build frontend:', error);
    process.exit(1);
  });
}

startApplication().catch(console.error);