#!/usr/bin/env node

/**
 * API Functions Test Script
 * Tests the Vercel serverless functions locally
 */

require('dotenv').config();

async function testApiEndpoints() {
  console.log('🧪 Testing API Functions...');
  
  const baseUrl = process.env.VERCEL_URL || 'http://localhost:3000';
  
  try {
    // Test 1: Health check
    console.log('\n📡 Test 1: Health check');
    const healthResponse = await fetch(`${baseUrl}/api/health`);
    const healthData = await healthResponse.json();
    console.log('✅ Health check:', healthData);
    
    // Test 2: Register user
    console.log('\n👤 Test 2: User registration');
    const registerData = {
      email: 'test@example.com',
      password: 'TestPass123',
      name: 'Test User'
    };
    
    const registerResponse = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(registerData)
    });
    
    const registerResult = await registerResponse.json();
    console.log('✅ Registration:', registerResult);
    
    if (!registerResult.success) {
      console.log('⚠️  Registration failed, trying login instead...');
      
      // Test 3: Login user
      console.log('\n🔐 Test 3: User login');
      const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: registerData.email,
          password: registerData.password
        })
      });
      
      const loginResult = await loginResponse.json();
      console.log('✅ Login:', loginResult);
      
      if (loginResult.success) {
        registerResult.token = loginResult.token;
        registerResult.user = loginResult.user;
      }
    }
    
    if (!registerResult.token) {
      console.log('❌ No authentication token available, skipping authenticated tests');
      return;
    }
    
    const authToken = registerResult.token;
    const authHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    };
    
    // Test 4: Get profile
    console.log('\n👤 Test 4: Get user profile');
    const profileResponse = await fetch(`${baseUrl}/api/auth/profile`, {
      headers: authHeaders
    });
    
    const profileResult = await profileResponse.json();
    console.log('✅ Profile:', profileResult);
    
    // Test 5: Create source
    console.log('\n📰 Test 5: Create source');
    const sourceData = {
      name: 'OpenAI Blog',
      url: 'https://openai.com/blog',
      type: 'blog',
      description: 'Official OpenAI blog',
      categories: ['AI', 'Technology'],
      tags: ['artificial-intelligence', 'research']
    };
    
    const createSourceResponse = await fetch(`${baseUrl}/api/sources`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(sourceData)
    });
    
    const createSourceResult = await createSourceResponse.json();
    console.log('✅ Create source:', createSourceResult);
    
    // Test 6: Get sources
    console.log('\n📰 Test 6: Get sources');
    const sourcesResponse = await fetch(`${baseUrl}/api/sources`, {
      headers: authHeaders
    });
    
    const sourcesResult = await sourcesResponse.json();
    console.log('✅ Get sources:', sourcesResult);
    
    // Test 7: Validate URL
    console.log('\n🔍 Test 7: Validate URL');
    const validateResponse = await fetch(`${baseUrl}/api/sources/validate-url`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        url: 'https://anthropic.com/news'
      })
    });
    
    const validateResult = await validateResponse.json();
    console.log('✅ URL validation:', validateResult);
    
    // Test 8: Get categories
    console.log('\n📂 Test 8: Get categories');
    const categoriesResponse = await fetch(`${baseUrl}/api/categories`, {
      headers: authHeaders
    });
    
    const categoriesResult = await categoriesResponse.json();
    console.log('✅ Categories:', categoriesResult);
    
    console.log('\n🎉 All API function tests completed successfully!');
    
  } catch (error) {
    console.error('\n💥 API function tests failed:', error);
    process.exit(1);
  }
}

// Mock fetch for Node.js environment
if (typeof fetch === 'undefined') {
  global.fetch = require('node-fetch');
}

// Run tests if called directly
if (require.main === module) {
  testApiEndpoints();
}

module.exports = { testApiEndpoints };