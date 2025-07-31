const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const path = require('path');
const { initializeRoutes } = require('./routes');
const { authenticateJWT } = require('./middleware/auth');
const { ipRateLimit, userRateLimit, strictRateLimit } = require('./middleware/rateLimit');
const serviceDiscovery = require('./utils/serviceDiscovery');
const logger = require('./utils/logger');
const { specs, swaggerUi } = require('./docs/swagger');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for development
}));
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Global rate limiting
app.use(ipRateLimit(
  parseInt(process.env.RATE_LIMIT_MAX) || 1000, // 1000 requests per window
  parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000 // 15 minutes
));

// Request logging middleware
app.use((req, res, next) => {
  logger.info('Incoming request', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});

// User-based rate limiting for authenticated routes
app.use('/api', userRateLimit(
  parseInt(process.env.USER_RATE_LIMIT_MAX) || 5000, // 5000 requests per user per window
  parseInt(process.env.USER_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000 // 15 minutes
));

// Strict rate limiting for sensitive endpoints (relaxed in development)
const isDevelopment = process.env.NODE_ENV === 'development';
if (!isDevelopment) {
  app.use('/api/auth/login', strictRateLimit(5, 15 * 60 * 1000)); // 5 login attempts per 15 minutes
  app.use('/api/auth/register', strictRateLimit(3, 60 * 60 * 1000)); // 3 registrations per hour
  app.use('/api/auth/forgot-password', strictRateLimit(3, 60 * 60 * 1000)); // 3 password resets per hour
} else {
  // More lenient rate limiting for development
  app.use('/api/auth/login', strictRateLimit(100, 15 * 60 * 1000)); // 100 login attempts per 15 minutes
  app.use('/api/auth/register', strictRateLimit(50, 60 * 60 * 1000)); // 50 registrations per hour
  app.use('/api/auth/forgot-password', strictRateLimit(50, 60 * 60 * 1000)); // 50 password resets per hour
}

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'AI Information Aggregator API Documentation'
}));

// Serve React frontend static files
const frontendBuildPath = path.join(__dirname, '../frontend/build');
app.use(express.static(frontendBuildPath));

// Initialize routes with authentication middleware
initializeRoutes(app, authenticateJWT);

// Health check endpoint
app.get('/health', (req, res) => {
  const serviceStatuses = serviceDiscovery.getAllServiceStatuses();
  const healthyServices = serviceDiscovery.getHealthyServices();
  const unhealthyServices = serviceDiscovery.getUnhealthyServices();
  
  const overallHealth = unhealthyServices.length === 0 ? 'healthy' : 'degraded';
  
  res.status(200).json({
    status: overallHealth,
    timestamp: new Date().toISOString(),
    services: {
      healthy: healthyServices,
      unhealthy: unhealthyServices,
      details: serviceStatuses
    }
  });
});

// Service status endpoint
app.get('/api/status', (req, res) => {
  const serviceStatuses = serviceDiscovery.getAllServiceStatuses();
  
  res.json({
    gateway: {
      status: 'healthy',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || '1.0.0'
    },
    services: serviceStatuses
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method
  });

  res.status(500).json({
    error: 'Internal server error',
    message: 'An unexpected error occurred'
  });
});

// Serve React app for all non-API routes
app.get('*', (req, res) => {
  // Don't serve React app for API routes
  if (req.path.startsWith('/api') || req.path.startsWith('/health')) {
    logger.warn('API route not found', {
      url: req.url,
      method: req.method,
      ip: req.ip
    });

    return res.status(404).json({
      error: 'Not found',
      message: 'The requested API resource was not found'
    });
  }

  // Serve React app for all other routes
  res.sendFile(path.join(frontendBuildPath, 'index.html'));
});

// Start service discovery
serviceDiscovery.startHealthChecks();

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  serviceDiscovery.stopHealthChecks();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  serviceDiscovery.stopHealthChecks();
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  logger.info(`API Gateway running on port ${PORT}`);
  console.log(`API Gateway running on port ${PORT}`);
});