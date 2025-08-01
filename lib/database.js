/**
 * PlanetScale Database Connection Utility
 * Handles MySQL connections with connection pooling and error handling
 */

import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config();

// Connection pool for better performance
let connectionPool = null;

/**
 * Database configuration
 */
const dbConfig = {
  host: process.env.DATABASE_HOST,
  user: process.env.DATABASE_USERNAME, // Changed from 'username' to 'user'
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  ssl: {
    rejectUnauthorized: true
  },
  // Connection pool settings
  connectionLimit: 10,
  queueLimit: 0
};



/**
 * Create connection pool
 */
function createConnectionPool() {
  if (!connectionPool) {
    connectionPool = mysql.createPool(dbConfig);
    
    // Handle pool events
    connectionPool.on('connection', (connection) => {
      console.log('New database connection established as id ' + connection.threadId);
    });

    connectionPool.on('error', (err) => {
      console.error('Database pool error:', err);
      if (err.code === 'PROTOCOL_CONNECTION_LOST') {
        connectionPool = null;
        createConnectionPool();
      } else {
        throw err;
      }
    });
  }
  
  return connectionPool;
}

/**
 * Get database connection from pool
 */
async function getConnection() {
  try {
    if (!connectionPool) {
      createConnectionPool();
    }
    
    const connection = await connectionPool.getConnection();
    return connection;
  } catch (error) {
    console.error('Error getting database connection:', error);
    throw new Error('Database connection failed');
  }
}

/**
 * Execute a query with parameters
 * @param {string} query - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise} Query results
 */
async function executeQuery(query, params = []) {
  let connection;
  
  try {
    connection = await getConnection();
    const [results] = await connection.execute(query, params);
    return results;
  } catch (error) {
    console.error('Database query error:', error);
    console.error('Query:', query);
    console.error('Params:', params);
    throw new Error(`Database query failed: ${error.message}`);
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

/**
 * Execute multiple queries in a transaction
 * @param {Array} queries - Array of {query, params} objects
 * @returns {Promise} Transaction results
 */
async function executeTransaction(queries) {
  let connection;
  
  try {
    connection = await getConnection();
    await connection.beginTransaction();
    
    const results = [];
    for (const { query, params = [] } of queries) {
      const [result] = await connection.execute(query, params);
      results.push(result);
    }
    
    await connection.commit();
    return results;
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('Transaction error:', error);
    throw new Error(`Transaction failed: ${error.message}`);
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

/**
 * Test database connectivity
 */
async function testConnection() {
  try {
    const result = await executeQuery('SELECT 1 as test');
    console.log('Database connection test successful:', result);
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
}

/**
 * Close all connections in the pool
 */
async function closePool() {
  if (connectionPool) {
    await connectionPool.end();
    connectionPool = null;
    console.log('Database connection pool closed');
  }
}

/**
 * Helper function to build WHERE clauses
 * @param {Object} conditions - Key-value pairs for WHERE conditions
 * @returns {Object} {whereClause, params}
 */
function buildWhereClause(conditions) {
  if (!conditions || Object.keys(conditions).length === 0) {
    return { whereClause: '', params: [] };
  }
  
  const clauses = [];
  const params = [];
  
  for (const [key, value] of Object.entries(conditions)) {
    if (value !== undefined && value !== null) {
      clauses.push(`${key} = ?`);
      params.push(value);
    }
  }
  
  const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  return { whereClause, params };
}

/**
 * Helper function for pagination
 * @param {number} page - Page number (1-based)
 * @param {number} limit - Items per page
 * @returns {Object} {offset, limit}
 */
function buildPagination(page = 1, limit = 10) {
  const offset = (page - 1) * limit;
  return { offset, limit };
}

/**
 * Generic CRUD operations
 */
const crud = {
  /**
   * Create a new record
   */
  async create(table, data) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map(() => '?').join(', ');
    
    const query = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
    const result = await executeQuery(query, values);
    
    return {
      id: result.insertId,
      affectedRows: result.affectedRows
    };
  },

  /**
   * Find records by conditions
   */
  async find(table, conditions = {}, options = {}) {
    const { whereClause, params } = buildWhereClause(conditions);
    const { page, limit, orderBy = 'id', orderDir = 'ASC' } = options;
    
    let query = `SELECT * FROM ${table} ${whereClause}`;
    
    if (orderBy) {
      query += ` ORDER BY ${orderBy} ${orderDir}`;
    }
    
    if (page && limit) {
      const { offset } = buildPagination(page, limit);
      query += ` LIMIT ${limit} OFFSET ${offset}`;
      params.push(limit, offset);
    }
    
    return await executeQuery(query, params);
  },

  /**
   * Find a single record by ID
   */
  async findById(table, id) {
    const query = `SELECT * FROM ${table} WHERE id = ?`;
    const results = await executeQuery(query, [id]);
    return results[0] || null;
  },

  /**
   * Update records by conditions
   */
  async update(table, data, conditions) {
    const setClause = Object.keys(data).map(key => `${key} = ?`).join(', ');
    const { whereClause, params: whereParams } = buildWhereClause(conditions);
    
    const query = `UPDATE ${table} SET ${setClause} ${whereClause}`;
    const params = [...Object.values(data), ...whereParams];
    
    const result = await executeQuery(query, params);
    return {
      affectedRows: result.affectedRows,
      changedRows: result.changedRows
    };
  },

  /**
   * Delete records by conditions
   */
  async delete(table, conditions) {
    const { whereClause, params } = buildWhereClause(conditions);
    const query = `DELETE FROM ${table} ${whereClause}`;
    
    const result = await executeQuery(query, params);
    return {
      affectedRows: result.affectedRows
    };
  }
};

// For serverless functions, we need a simpler connection approach
export async function connectToDatabase() {
  if (!connectionPool) {
    createConnectionPool();
  }
  return connectionPool;
}

export {
  getConnection,
  executeQuery,
  executeTransaction,
  testConnection,
  closePool,
  buildWhereClause,
  buildPagination,
  crud
};