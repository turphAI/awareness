import { executeQuery } from '../lib/database';

/**
 * Health check endpoint
 * @route GET /api/health
 * @access Public
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  try {
    // Test database connection
    const result = await executeQuery('SELECT 1 as test');
    const dbHealthy = result.length > 0 && result[0].test === 1;
    
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: dbHealthy ? 'connected' : 'disconnected',
      environment: process.env.NODE_ENV || 'development'
    };
    
    return res.status(200).json({
      success: true,
      data: health
    });
    
  } catch (error) {
    console.error('Health check failed:', error);
    
    return res.status(503).json({
      success: false,
      error: 'Service unavailable',
      details: {
        database: 'disconnected',
        timestamp: new Date().toISOString()
      }
    });
  }
}