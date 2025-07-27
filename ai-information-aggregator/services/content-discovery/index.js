const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const createLogger = require('../../common/utils/logger');
const { errorHandler, setupUncaughtExceptionHandler, setupUnhandledRejectionHandler } = require('../../common/utils/errorHandler');
const scheduler = require('./utils/scheduler');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3003;

// Configure logger
const logger = createLogger('content-discovery-service');
app.locals.logger = logger;

// Set up error handlers
setupUncaughtExceptionHandler(logger);
setupUnhandledRejectionHandler(logger);

// Middleware
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ai-aggregator', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => {
    logger.info('Connected to MongoDB');
    
    // Initialize content discovery scheduler and queues
    if (process.env.NODE_ENV !== 'test') {
      // Initialize scheduler
      scheduler.initializeQueues();
      logger.info('Content discovery scheduler initialized');
      
      // Initialize discovery queues
      const discoveryQueue = require('./utils/discoveryQueue');
      discoveryQueue.initializeQueues();
      logger.info('Content discovery queues initialized');
      
      // Schedule all sources
      scheduler.scheduleAllSources()
        .then(result => {
          if (result.success) {
            logger.info(`Scheduled ${result.scheduled.total} sources for content checking`);
          } else {
            logger.error(`Failed to schedule sources: ${result.error}`);
          }
        })
        .catch(err => {
          logger.error('Error scheduling sources:', err);
        });
    }
  })
  .catch(err => logger.error('MongoDB connection error:', err));

// Import routes
const contentRoutes = require('./routes/content');
const discoveryRoutes = require('./routes/discovery');
const referenceRoutes = require('./routes/reference');
const relevanceRoutes = require('./routes/relevance');
const academicRoutes = require('./routes/academic');

// Use routes
app.use('/api/content', contentRoutes);
app.use('/api/discovery', discoveryRoutes);
app.use('/api/references', referenceRoutes);
app.use('/api/relevance', relevanceRoutes);
app.use('/api/academic', academicRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Error handling middleware
app.use(errorHandler);

// Start server
const server = app.listen(PORT, () => {
  logger.info(`Content Discovery Service running on port ${PORT}`);
});

// Handle server shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  // Shutdown scheduler and discovery queues
  if (process.env.NODE_ENV !== 'test') {
    const discoveryQueue = require('./utils/discoveryQueue');
    
    Promise.all([
      scheduler.shutdown().catch(err => {
        logger.error('Error shutting down scheduler:', err);
      }),
      discoveryQueue.shutdown().catch(err => {
        logger.error('Error shutting down discovery queues:', err);
      })
    ])
    .then(() => {
      logger.info('All queues shut down successfully');
    })
    .finally(() => {
      // Close server and database connection
      server.close(() => {
        logger.info('HTTP server closed');
        mongoose.connection.close(false, () => {
          logger.info('MongoDB connection closed');
          process.exit(0);
        });
      });
    });
  } else {
    // In test mode, just close server and database
    server.close(() => {
      logger.info('HTTP server closed');
      mongoose.connection.close(false, () => {
        logger.info('MongoDB connection closed');
        process.exit(0);
      });
    });
  }
});

const discoveryQueue = require('./utils/discoveryQueue');
module.exports = { app, server, scheduler, discoveryQueue };