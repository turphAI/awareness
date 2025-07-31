#!/usr/bin/env node

/**
 * PlanetScale Database Setup Script
 * This script sets up the database connection and creates the schema
 */

require('dotenv').config();
const dbConnection = require('../database/connection');

async function setupDatabase() {
  console.log('🚀 Setting up PlanetScale database...\n');

  try {
    // Test connection
    console.log('1. Testing database connection...');
    const isConnected = await dbConnection.testConnection();
    
    if (!isConnected) {
      throw new Error('Database connection test failed');
    }
    console.log('✅ Database connection successful\n');

    // Get current schema info
    console.log('2. Checking current database schema...');
    try {
      const schemaInfo = await dbConnection.getSchemaInfo();
      console.log(`📊 Found ${schemaInfo.length} existing tables:`);
      schemaInfo.forEach(table => {
        console.log(`   - ${table.TABLE_NAME} (${table.TABLE_ROWS || 0} rows)`);
      });
      console.log();
    } catch (error) {
      console.log('   No existing tables found or unable to query schema\n');
    }

    // Create tables
    console.log('3. Creating database schema...');
    await dbConnection.createTables();
    console.log();

    // Verify tables were created
    console.log('4. Verifying table creation...');
    const requiredTables = [
      'users', 'categories', 'sources', 'content', 'content_references',
      'collections', 'collection_content', 'collection_collaborators',
      'interactions', 'digest_scheduling', 'content_volume_settings',
      'discovery_settings', 'summary_preferences', 'topic_preferences',
      'notification_settings', 'interest_profiles', 'credentials',
      'podcasts', 'podcast_episodes', 'podcast_transcripts'
    ];

    const missingTables = [];
    for (const tableName of requiredTables) {
      const exists = await dbConnection.tableExists(tableName);
      if (exists) {
        console.log(`   ✅ ${tableName}`);
      } else {
        console.log(`   ❌ ${tableName}`);
        missingTables.push(tableName);
      }
    }

    if (missingTables.length > 0) {
      throw new Error(`Missing tables: ${missingTables.join(', ')}`);
    }

    console.log('\n🎉 PlanetScale database setup completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Update your environment variables with PlanetScale credentials');
    console.log('2. Test the API functions with the new database');
    console.log('3. Migrate existing data from MongoDB (if applicable)');

  } catch (error) {
    console.error('\n❌ Database setup failed:', error.message);
    process.exit(1);
  } finally {
    await dbConnection.close();
  }
}

// Environment variable validation
function validateEnvironment() {
  const requiredVars = [
    'DATABASE_HOST',
    'DATABASE_USERNAME', 
    'DATABASE_PASSWORD',
    'DATABASE_NAME'
  ];

  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingVars.forEach(varName => {
      console.error(`   - ${varName}`);
    });
    console.error('\nPlease set these variables in your .env file or environment');
    process.exit(1);
  }

  console.log('✅ Environment variables validated\n');
}

// Main execution
if (require.main === module) {
  console.log('PlanetScale Database Setup');
  console.log('==========================\n');
  
  validateEnvironment();
  setupDatabase();
}

module.exports = { setupDatabase, validateEnvironment };