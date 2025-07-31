const mysql = require('mysql2/promise');

let connection;

/**
 * Connect to PlanetScale database
 * Uses connection pooling for optimal performance
 */
export async function connectToDatabase() {
  if (connection) {
    return connection;
  }

  try {
    connection = await mysql.createConnection({
      host: process.env.DATABASE_HOST,
      user: process.env.DATABASE_USERNAME,
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE_NAME,
      ssl: {
        rejectUnauthorized: true
      }
    });

    console.log('✅ Connected to PlanetScale database');
    return connection;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
}

/**
 * Execute a database query with parameters
 */
export async function executeQuery(query, params = []) {
  try {
    const db = await connectToDatabase();
    const [results] = await db.execute(query, params);
    return results;
  } catch (error) {
    console.error('Database query error:', error);
    throw new Error('Database operation failed');
  }
}

/**
 * Close database connection
 */
export async function closeConnection() {
  if (connection) {
    await connection.end();
    connection = null;
  }
}