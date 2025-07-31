const mysql = require('mysql2/promise');

/**
 * Database connection configuration for PlanetScale
 */
class DatabaseConnection {
  constructor() {
    this.connection = null;
    this.pool = null;
  }

  /**
   * Initialize connection pool
   */
  async initializePool() {
    if (this.pool) {
      return this.pool;
    }

    const config = {
      host: process.env.DATABASE_HOST,
      user: process.env.DATABASE_USERNAME,
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE_NAME,
      ssl: {
        rejectUnauthorized: true
      },
      connectionLimit: 10,
      acquireTimeout: 60000,
      idleTimeout: 60000,
      enableKeepAlive: true
    };

    this.pool = mysql.createPool(config);
    
    // Test the connection
    try {
      const connection = await this.pool.getConnection();
      console.log('✅ Connected to PlanetScale database');
      connection.release();
    } catch (error) {
      console.error('❌ Failed to connect to PlanetScale database:', error.message);
      throw error;
    }

    return this.pool;
  }

  /**
   * Get a connection from the pool
   */
  async getConnection() {
    if (!this.pool) {
      await this.initializePool();
    }
    return this.pool.getConnection();
  }

  /**
   * Execute a query with parameters
   */
  async query(sql, params = []) {
    if (!this.pool) {
      await this.initializePool();
    }

    try {
      const [results] = await this.pool.execute(sql, params);
      return results;
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }

  /**
   * Execute multiple queries in a transaction
   */
  async transaction(queries) {
    const connection = await this.getConnection();
    
    try {
      await connection.beginTransaction();
      
      const results = [];
      for (const { sql, params } of queries) {
        const [result] = await connection.execute(sql, params || []);
        results.push(result);
      }
      
      await connection.commit();
      return results;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Close all connections
   */
  async close() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  /**
   * Test database connectivity
   */
  async testConnection() {
    try {
      const result = await this.query('SELECT 1 as test');
      return result.length > 0 && result[0].test === 1;
    } catch (error) {
      console.error('Database connection test failed:', error);
      return false;
    }
  }

  /**
   * Get database schema information
   */
  async getSchemaInfo() {
    try {
      const tables = await this.query(`
        SELECT TABLE_NAME, TABLE_ROWS, DATA_LENGTH, INDEX_LENGTH
        FROM information_schema.TABLES 
        WHERE TABLE_SCHEMA = ?
      `, [process.env.DATABASE_NAME]);
      
      return tables;
    } catch (error) {
      console.error('Failed to get schema info:', error);
      throw error;
    }
  }

  /**
   * Check if a table exists
   */
  async tableExists(tableName) {
    try {
      const result = await this.query(`
        SELECT COUNT(*) as count
        FROM information_schema.TABLES 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
      `, [process.env.DATABASE_NAME, tableName]);
      
      return result[0].count > 0;
    } catch (error) {
      console.error(`Failed to check if table ${tableName} exists:`, error);
      return false;
    }
  }

  /**
   * Create database tables from schema
   */
  async createTables() {
    const fs = require('fs').promises;
    const path = require('path');
    
    try {
      const schemaPath = path.join(__dirname, 'schema-planetscale.sql');
      const schema = await fs.readFile(schemaPath, 'utf8');
      
      // Split schema into individual statements
      // Remove comments first
      const cleanSchema = schema
        .split('\n')
        .filter(line => !line.trim().startsWith('--') && line.trim().length > 0)
        .join('\n');
      
      const statements = cleanSchema
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0);
      
      console.log(`Executing ${statements.length} schema statements...`);
      
      for (const statement of statements) {
        try {
          await this.query(statement);
        } catch (error) {
          // Ignore "table already exists" errors
          if (!error.message.includes('already exists')) {
            console.error('Schema statement error:', error.message);
            throw error;
          }
        }
      }
      
      console.log('✅ Database schema created successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to create database schema:', error);
      throw error;
    }
  }
}

// Create singleton instance
const dbConnection = new DatabaseConnection();

module.exports = dbConnection;