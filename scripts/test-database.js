#!/usr/bin/env node

/**
 * Database Test Script
 * Tests database connectivity and basic CRUD operations
 */

const { executeQuery, testConnection, closePool, crud } = require('../lib/database');

async function testDatabase() {
  console.log('🧪 Starting database tests...');
  
  try {
    // Test 1: Basic connectivity
    console.log('\n📡 Test 1: Database connectivity');
    const connectionTest = await testConnection();
    
    if (!connectionTest) {
      throw new Error('Database connection failed');
    }
    console.log('✅ Database connection successful');
    
    // Test 2: List tables
    console.log('\n📋 Test 2: List database tables');
    const tables = await executeQuery('SHOW TABLES');
    console.log(`✅ Found ${tables.length} tables:`);
    tables.forEach(table => {
      const tableName = Object.values(table)[0];
      console.log(`   - ${tableName}`);
    });
    
    // Test 3: Test CRUD operations on users table
    console.log('\n👤 Test 3: CRUD operations on users table');
    
    // Create test user
    const testUser = {
      email: 'test@example.com',
      password_hash: 'hashed_password_123',
      name: 'Test User',
      preferences: JSON.stringify({
        topics: ['technology', 'science'],
        contentVolume: 15,
        summaryLength: 'medium'
      }),
      notifications: JSON.stringify({
        email: true,
        push: false,
        digest: true
      })
    };
    
    console.log('   Creating test user...');
    const createResult = await crud.create('users', testUser);
    console.log(`   ✅ User created with ID: ${createResult.id}`);
    
    // Read test user
    console.log('   Reading test user...');
    const foundUser = await crud.findById('users', createResult.id);
    console.log(`   ✅ User found: ${foundUser.name} (${foundUser.email})`);
    
    // Update test user
    console.log('   Updating test user...');
    const updateResult = await crud.update(
      'users',
      { name: 'Updated Test User' },
      { id: createResult.id }
    );
    console.log(`   ✅ User updated (${updateResult.affectedRows} rows affected)`);
    
    // Verify update
    const updatedUser = await crud.findById('users', createResult.id);
    console.log(`   ✅ Update verified: ${updatedUser.name}`);
    
    // Delete test user
    console.log('   Deleting test user...');
    const deleteResult = await crud.delete('users', { id: createResult.id });
    console.log(`   ✅ User deleted (${deleteResult.affectedRows} rows affected)`);
    
    // Test 4: Test JSON field operations
    console.log('\n🔧 Test 4: JSON field operations');
    
    // Create user with complex JSON data
    const jsonTestUser = {
      email: 'json-test@example.com',
      password_hash: 'hashed_password_456',
      name: 'JSON Test User',
      preferences: JSON.stringify({
        topics: ['ai', 'machine-learning', 'data-science'],
        contentVolume: 25,
        discoveryAggressiveness: 0.7,
        summaryLength: 'long',
        digestFrequency: 'weekly'
      }),
      notifications: JSON.stringify({
        email: true,
        push: true,
        digest: false
      })
    };
    
    const jsonUser = await crud.create('users', jsonTestUser);
    console.log(`   ✅ JSON test user created with ID: ${jsonUser.id}`);
    
    // Query JSON fields
    const jsonQuery = `
      SELECT 
        id, 
        name, 
        JSON_EXTRACT(preferences, '$.topics') as topics,
        JSON_EXTRACT(preferences, '$.contentVolume') as content_volume,
        JSON_EXTRACT(notifications, '$.email') as email_notifications
      FROM users 
      WHERE id = ?
    `;
    
    const jsonResult = await executeQuery(jsonQuery, [jsonUser.id]);
    console.log('   ✅ JSON field extraction successful:');
    console.log(`      Topics: ${jsonResult[0].topics}`);
    console.log(`      Content Volume: ${jsonResult[0].content_volume}`);
    console.log(`      Email Notifications: ${jsonResult[0].email_notifications}`);
    
    // Clean up JSON test user
    await crud.delete('users', { id: jsonUser.id });
    console.log('   ✅ JSON test user cleaned up');
    
    // Test 5: Test foreign key relationships
    console.log('\n🔗 Test 5: Foreign key relationships');
    
    // Create test user for relationship test
    const relationUser = await crud.create('users', {
      email: 'relation-test@example.com',
      password_hash: 'hashed_password_789',
      name: 'Relation Test User'
    });
    
    // Create test source
    const testSource = {
      url: 'https://example.com/test-source',
      name: 'Test Source',
      description: 'A test source for relationship testing',
      type: 'website',
      categories: JSON.stringify(['technology', 'news']),
      created_by: relationUser.id
    };
    
    const sourceResult = await crud.create('sources', testSource);
    console.log(`   ✅ Test source created with ID: ${sourceResult.id}`);
    
    // Create test content
    const testContent = {
      source_id: sourceResult.id,
      url: 'https://example.com/test-article',
      title: 'Test Article',
      type: 'article',
      categories: JSON.stringify(['technology']),
      summary: 'This is a test article summary'
    };
    
    const contentResult = await crud.create('content', testContent);
    console.log(`   ✅ Test content created with ID: ${contentResult.id}`);
    
    // Test JOIN query
    const joinQuery = `
      SELECT 
        c.id as content_id,
        c.title,
        s.name as source_name,
        u.name as creator_name
      FROM content c
      JOIN sources s ON c.source_id = s.id
      JOIN users u ON s.created_by = u.id
      WHERE c.id = ?
    `;
    
    const joinResult = await executeQuery(joinQuery, [contentResult.id]);
    console.log('   ✅ JOIN query successful:');
    console.log(`      Content: ${joinResult[0].title}`);
    console.log(`      Source: ${joinResult[0].source_name}`);
    console.log(`      Creator: ${joinResult[0].creator_name}`);
    
    // Clean up relationship test data
    await crud.delete('content', { id: contentResult.id });
    await crud.delete('sources', { id: sourceResult.id });
    await crud.delete('users', { id: relationUser.id });
    console.log('   ✅ Relationship test data cleaned up');
    
    console.log('\n🎉 All database tests passed successfully!');
    
  } catch (error) {
    console.error('\n💥 Database test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    await closePool();
  }
}

// Run tests if called directly
if (require.main === module) {
  testDatabase();
}

module.exports = { testDatabase };