#!/usr/bin/env node

/**
 * Simple test to verify database connection and basic operations
 */

import { executeQuery, testConnection } from '../lib/database.js';
import dotenv from 'dotenv';

dotenv.config();

async function testDatabaseConnection() {
  console.log('🔌 Testing database connection...');
  
  try {
    const isConnected = await testConnection();
    if (isConnected) {
      console.log('✅ Database connection successful');
    } else {
      console.log('❌ Database connection failed');
      return;
    }

    // Test basic query
    console.log('📊 Testing basic queries...');
    
    // Check if users table exists
    const tables = await executeQuery("SHOW TABLES LIKE 'users'");
    if (tables.length > 0) {
      console.log('✅ Users table exists');
      
      // Count users
      const [{ count }] = await executeQuery('SELECT COUNT(*) as count FROM users');
      console.log(`✅ Found ${count} users in database`);
    } else {
      console.log('❌ Users table does not exist');
    }

    // Check collections table
    const collectionTables = await executeQuery("SHOW TABLES LIKE 'collections'");
    if (collectionTables.length > 0) {
      console.log('✅ Collections table exists');
      
      const [{ count }] = await executeQuery('SELECT COUNT(*) as count FROM collections');
      console.log(`✅ Found ${count} collections in database`);
    } else {
      console.log('❌ Collections table does not exist');
    }

    console.log('🎉 Database tests completed successfully!');
  } catch (error) {
    console.error('❌ Database test failed:', error.message);
    process.exit(1);
  }
}

testDatabaseConnection();