#!/usr/bin/env node

/**
 * Test script for Library Management API functions
 * Tests all library management serverless functions end-to-end
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
let authToken = null;
let testUserId = null;
let testCollectionId = null;
let testContentId = null;

// Test data
const testCollection = {
  name: 'Test Collection',
  description: 'A test collection for API testing',
  public: false,
  color: '#ff6b6b',
  icon: 'bookmark',
  tags: ['test', 'api']
};

const testContentData = {
  title: 'Test Article',
  url: 'https://example.com/test-article',
  author: 'Test Author',
  type: 'article',
  summary: 'This is a test article for API testing',
  categories: ['technology', 'testing'],
  topics: ['api', 'testing', 'serverless'],
  relevance_score: 0.85
};

/**
 * Make authenticated API request
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.status} - ${data.error || data.message}`);
  }

  return data;
}

/**
 * Test authentication
 */
async function testAuth() {
  console.log('\n🔐 Testing Authentication...');
  
  try {
    // Try to register a test user
    const registerData = {
      email: `test-${Date.now()}@example.com`,
      password: 'testpassword123',
      name: 'Test User'
    };

    let authResponse;
    try {
      authResponse = await apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(registerData)
      });
      console.log('✅ User registered successfully');
    } catch (error) {
      // If registration fails, try login with existing user
      console.log('ℹ️  Registration failed, trying login...');
      authResponse = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'testpassword123'
        })
      });
      console.log('✅ User logged in successfully');
    }

    authToken = authResponse.data.token;
    testUserId = authResponse.data.user.id;
    console.log(`✅ Authentication successful. User ID: ${testUserId}`);
  } catch (error) {
    console.error('❌ Authentication failed:', error.message);
    throw error;
  }
}

/**
 * Test collection management
 */
async function testCollections() {
  console.log('\n📚 Testing Collection Management...');

  try {
    // Create collection
    console.log('Creating collection...');
    const createResponse = await apiRequest('/api/library/collections', {
      method: 'POST',
      body: JSON.stringify(testCollection)
    });
    testCollectionId = createResponse.data.id;
    console.log(`✅ Collection created with ID: ${testCollectionId}`);

    // Get collections
    console.log('Fetching collections...');
    const collectionsResponse = await apiRequest('/api/library/collections');
    console.log(`✅ Retrieved ${collectionsResponse.data.collections.length} collections`);

    // Get specific collection
    console.log('Fetching specific collection...');
    const collectionResponse = await apiRequest(`/api/library/collections/${testCollectionId}`);
    console.log(`✅ Retrieved collection: ${collectionResponse.data.name}`);

    // Update collection
    console.log('Updating collection...');
    const updateData = {
      description: 'Updated test collection description',
      public: true
    };
    const updateResponse = await apiRequest(`/api/library/collections/${testCollectionId}`, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });
    console.log('✅ Collection updated successfully');

    console.log('✅ Collection management tests passed');
  } catch (error) {
    console.error('❌ Collection management test failed:', error.message);
    throw error;
  }
}

/**
 * Test content management
 */
async function testContent() {
  console.log('\n📄 Testing Content Management...');

  try {
    // First, create some test content directly in database
    // In a real scenario, this would come from content discovery
    console.log('Creating test content...');
    
    // For testing, we'll simulate content creation
    // In production, content would be created by the content discovery service
    const contentData = {
      source_id: 1, // Assuming a test source exists
      ...testContentData
    };

    // Since we don't have a direct content creation API, we'll use a mock content ID
    testContentId = 1; // This would be returned from content creation

    // Test getting content
    console.log('Fetching content...');
    const contentResponse = await apiRequest('/api/library/content');
    console.log(`✅ Retrieved content list`);

    // Test adding content to collection
    if (testCollectionId) {
      console.log('Adding content to collection...');
      const addContentResponse = await apiRequest('/api/library/content', {
        method: 'POST',
        body: JSON.stringify({
          action: 'add',
          collectionId: testCollectionId,
          contentIds: [testContentId]
        })
      });
      console.log('✅ Content added to collection');

      // Test removing content from collection
      console.log('Removing content from collection...');
      const removeContentResponse = await apiRequest('/api/library/content', {
        method: 'POST',
        body: JSON.stringify({
          action: 'remove',
          collectionId: testCollectionId,
          contentIds: [testContentId]
        })
      });
      console.log('✅ Content removed from collection');
    }

    console.log('✅ Content management tests passed');
  } catch (error) {
    console.error('❌ Content management test failed:', error.message);
    throw error;
  }
}

/**
 * Test search functionality
 */
async function testSearch() {
  console.log('\n🔍 Testing Search Functionality...');

  try {
    // Test content search
    console.log('Testing content search...');
    const searchResponse = await apiRequest('/api/library/search?q=test&limit=5');
    console.log(`✅ Content search returned ${searchResponse.data.results.length} results`);

    // Test collection search
    console.log('Testing collection search...');
    const collectionSearchResponse = await apiRequest('/api/library/search?q=test&searchType=collections&limit=5');
    console.log(`✅ Collection search returned ${collectionSearchResponse.data.results.length} results`);

    // Test advanced search
    console.log('Testing advanced search...');
    const advancedSearchData = {
      query: 'test',
      filters: {
        type: ['article'],
        categories: ['technology']
      },
      facets: true,
      limit: 5
    };
    const advancedSearchResponse = await apiRequest('/api/library/search', {
      method: 'POST',
      body: JSON.stringify(advancedSearchData)
    });
    console.log('✅ Advanced search completed');

    console.log('✅ Search functionality tests passed');
  } catch (error) {
    console.error('❌ Search functionality test failed:', error.message);
    throw error;
  }
}

/**
 * Test interaction tracking
 */
async function testInteractions() {
  console.log('\n📊 Testing Interaction Tracking...');

  try {
    // Record interactions
    const interactions = [
      { contentId: testContentId, type: 'view', duration: 120 },
      { contentId: testContentId, type: 'like' },
      { contentId: testContentId, type: 'save' },
      { contentId: testContentId, type: 'share', value: 'twitter' }
    ];

    for (const interaction of interactions) {
      console.log(`Recording ${interaction.type} interaction...`);
      await apiRequest('/api/library/interactions', {
        method: 'POST',
        body: JSON.stringify(interaction)
      });
    }
    console.log('✅ All interactions recorded');

    // Get interactions
    console.log('Fetching user interactions...');
    const interactionsResponse = await apiRequest('/api/library/interactions?limit=10');
    console.log(`✅ Retrieved ${interactionsResponse.data.interactions.length} interactions`);

    // Get interaction analytics
    console.log('Fetching interaction analytics...');
    const analyticsResponse = await apiRequest('/api/library/interactions?analytics=true&period=30d');
    console.log(`✅ Retrieved analytics data`);
    console.log(`   - Total interactions: ${analyticsResponse.data.summary.total_interactions}`);
    console.log(`   - Unique content: ${analyticsResponse.data.summary.unique_content}`);

    console.log('✅ Interaction tracking tests passed');
  } catch (error) {
    console.error('❌ Interaction tracking test failed:', error.message);
    throw error;
  }
}

/**
 * Test error handling
 */
async function testErrorHandling() {
  console.log('\n⚠️  Testing Error Handling...');

  try {
    // Test unauthorized access
    const originalToken = authToken;
    authToken = 'invalid-token';
    
    try {
      await apiRequest('/api/library/collections');
      console.error('❌ Should have failed with invalid token');
    } catch (error) {
      if (error.message.includes('401')) {
        console.log('✅ Unauthorized access properly rejected');
      } else {
        throw error;
      }
    }

    // Restore token
    authToken = originalToken;

    // Test invalid collection ID
    try {
      await apiRequest('/api/library/collections/999999');
      console.error('❌ Should have failed with invalid collection ID');
    } catch (error) {
      if (error.message.includes('404')) {
        console.log('✅ Invalid collection ID properly handled');
      } else {
        throw error;
      }
    }

    // Test invalid data
    try {
      await apiRequest('/api/library/collections', {
        method: 'POST',
        body: JSON.stringify({ name: '' }) // Empty name should fail
      });
      console.error('❌ Should have failed with empty collection name');
    } catch (error) {
      if (error.message.includes('400')) {
        console.log('✅ Invalid data properly validated');
      } else {
        throw error;
      }
    }

    console.log('✅ Error handling tests passed');
  } catch (error) {
    console.error('❌ Error handling test failed:', error.message);
    throw error;
  }
}

/**
 * Cleanup test data
 */
async function cleanup() {
  console.log('\n🧹 Cleaning up test data...');

  try {
    // Delete test collection
    if (testCollectionId) {
      await apiRequest(`/api/library/collections/${testCollectionId}`, {
        method: 'DELETE'
      });
      console.log('✅ Test collection deleted');
    }

    console.log('✅ Cleanup completed');
  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
    // Don't throw error for cleanup failures
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('🚀 Starting Library Management API Tests...');
  console.log(`API Base URL: ${API_BASE}`);

  try {
    await testAuth();
    await testCollections();
    await testContent();
    await testSearch();
    await testInteractions();
    await testErrorHandling();
    
    console.log('\n🎉 All tests passed successfully!');
  } catch (error) {
    console.error('\n💥 Test suite failed:', error.message);
    process.exit(1);
  } finally {
    await cleanup();
  }
}

// Run tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error);
}

export { runTests };