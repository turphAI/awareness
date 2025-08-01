#!/usr/bin/env node

/**
 * Database Setup Script
 * Creates all necessary tables in PlanetScale MySQL database
 */

const fs = require('fs').promises;
const path = require('path');
const { executeQuery, testConnection, closePool } = require('../lib/database');

async function setupDatabase() {
  console.log('🚀 Starting database setup...');
  
  try {
    // Test connection first
    console.log('📡 Testing database connection...');
    const connectionTest = await testConnection();
    
    if (!connectionTest) {
      throw new Error('Database connection failed');
    }
    
    console.log('✅ Database connection successful');
    
    // Read schema file
    console.log('📖 Reading database schema...');
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    const schemaContent = await fs.readFile(schemaPath, 'utf8');
    
    // Split schema into individual statements
    const statements = schemaContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      try {
        // Extract table name for logging
        const tableMatch = statement.match(/CREATE TABLE (\w+)/i);
        const tableName = tableMatch ? tableMatch[1] : `Statement ${i + 1}`;
        
        console.log(`⚡ Creating ${tableName}...`);
        await executeQuery(statement);
        console.log(`✅ ${tableName} created successfully`);
        
      } catch (error) {
        // Check if error is about table already existing
        if (error.message.includes('already exists')) {
          console.log(`⚠️  Table already exists, skipping...`);
        } else {
          console.error(`❌ Error executing statement ${i + 1}:`, error.message);
          console.error('Statement:', statement.substring(0, 100) + '...');
          throw error;
        }
      }
    }
    
    console.log('🎉 Database setup completed successfully!');
    
    // Verify tables were created
    console.log('🔍 Verifying table creation...');
    const tables = await executeQuery('SHOW TABLES');
    console.log(`✅ Created ${tables.length} tables:`);
    tables.forEach(table => {
      const tableName = Object.values(table)[0];
      console.log(`   - ${tableName}`);
    });
    
  } catch (error) {
    console.error('💥 Database setup failed:', error.message);
    process.exit(1);
  } finally {
    await closePool();
  }
}

// Run setup if called directly
if (require.main === module) {
  setupDatabase();
}

module.exports = { setupDatabase };