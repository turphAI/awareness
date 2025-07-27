const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const createLogger = require('../../common/utils/logger');
const { errorHandler, setupUncaughtExceptionHandler, setupUnhandledRejectionHandler } = require('../../common/utils/errorHandler');
const podcastMonitor = require('./utils/podcastMonitor');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3004;

// Configure logger
const logger = createLogger('podcast-extraction-service');
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
    
    // Initialize podcast monitoring system
    if (process.env.NODE_ENV !== 'test') {
      podcastMonitor.initialize();
      logger.info('Podcast monitoring system initialized');
      
      // Start monitoring podcasts
      podcastMonitor.startMonitoring()
        .then(result => {
          if (result.success) {
            logger.info(`Started monitoring ${result.podcastCount} podcasts`);
          } else {
            logger.error(`Failed to start podcast monitoring: ${result.error}`);
          }
        })
        .catch(err => {
          logger.error('Error starting podcast monitoring:', err);
        });
    }
  })
  .catch(err => logger.error('MongoDB connection error:', err));

// Import routes
const podcastRoutes = require('./routes/podcast');
const episodeRoutes = require('./routes/episode');
const transcriptRoutes = require('./routes/transcript');
const referenceRoutes = require('./routes/reference');
const timestampRoutes = require('./routes/timestamp');
const showNotesRoutes = require('./routes/showNotes');
const timestampRoutes = require('./routes/timestamp');

// Use routes
app.use('/api/podcasts', podcastRoutes);
app.use('/api/episodes', episodeRoutes);
app.use('/api/transcripts', transcriptRoutes);
app.use('/api/references', referenceRoutes);
app.use('/api/timestamps', timestampRoutes);
app.use('/api/show-notes', showNotesRoutes);
app.use('/api/timestamps', timestampRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Error handling middleware
app.use(errorHandler);

// Start server
const server = app.listen(PORT, () => {
  logger.info(`Podcast Extraction Service running on port ${PORT}`);
});

// Handle server shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  // Shutdown podcast monitor
  if (process.env.NODE_ENV !== 'test') {
    podcastMonitor.shutdown()
      .then(() => {
        logger.info('Podcast monitor shut down successfully');
      })
      .catch(err => {
        logger.error('Error shutting down podcast monitor:', err);
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

module.exports = { app, server, podcastMonitor };