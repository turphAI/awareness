#!/usr/bin/env node

/**
 * Database Connection Test Script
 * Simple script to test PlanetScale database connectivity
 */

require('dotenv').config();
const dbConnection = require('../database/connection');

async function testDatabase() {
  console.log('🔍 Testing PlanetScale database connection...\n');

  try {
    // Basic connection test
    console.log('1. Testing basic connectivity...');
    const isConnected = await dbConnection.testConnection();
    
    if (!isConnected) {
      throw new Error('Basic connection test failed');
    }
    console.log('✅ Basic connection successful');

    // Test a simple query
    console.log('\n2. Testing simple query...');
    const result = await dbConnection.query('SELECT 1 as test_value');
    console.log(`✅ Query successful:`);
    console.log(`   Test value: ${result[0].test_value}`);

    // Test table existence
    console.log('\n3. Checking for required tables...');
    const tables = ['users', 'sources', 'content', 'collections'];
    
    for (const tableName of tables) {
      const exists = await dbConnection.tableExists(tableName);
      console.log(`   ${exists ? '✅' : '❌'} ${tableName}`);
    }

    // Test insert/select/delete operations
    console.log('\n4. Testing CRUD operations...');
    
    // Insert test user
    const insertResult = await dbConnection.query(`
      INSERT INTO users (email, password_hash, name) 
      VALUES (?, ?, ?)
    `, ['test@example.com', 'test_hash', 'Test User']);
    
    const userId = insertResult.insertId;
    console.log(`✅ Insert successful (ID: ${userId})`);

    // Select test user
    const selectResult = await dbConnection.query(`
      SELECT id, email, name, created_at 
      FROM users 
      WHERE id = ?
    `, [userId]);
    
    console.log(`✅ Select successful (Found: ${selectResult.length} record)`);

    // Delete test user
    await dbConnection.query('DELETE FROM users WHERE id = ?', [userId]);
    console.log('✅ Delete successful');

    console.log('\n🎉 All database tests passed!');
    console.log('\nDatabase is ready for use.');

  } catch (error) {
    console.error('\n❌ Database test failed:', error.message);
    
    if (error.code) {
      console.error(`Error code: ${error.code}`);
    }
    
    if (error.sqlMessage) {
      console.error(`SQL error: ${error.sqlMessage}`);
    }
    
    process.exit(1);
  } finally {
    await dbConnection.close();
  }
}

// Environment check
function checkEnvironment() {
  const requiredVars = [
    'DATABASE_HOST',
    'DATABASE_USERNAME', 
    'DATABASE_PASSWORD',
    'DATABASE_NAME'
  ];

  console.log('Environment variables:');
  requiredVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
      // Mask password for security
      const displayValue = varName === 'DATABASE_PASSWORD' 
        ? '*'.repeat(value.length) 
        : value;
      console.log(`   ${varName}: ${displayValue}`);
    } else {
      console.log(`   ${varName}: ❌ NOT SET`);
    }
  });
  console.log();

  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingVars.forEach(varName => {
      console.error(`   - ${varName}`);
    });
    process.exit(1);
  }
}

// Main execution
if (require.main === module) {
  console.log('PlanetScale Database Test');
  console.log('=========================\n');
  
  checkEnvironment();
  testDatabase();
}

module.exports = { testDatabase };