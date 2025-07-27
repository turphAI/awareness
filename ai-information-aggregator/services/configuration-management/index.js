const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const createLogger = require('../../common/utils/logger');
const { errorHandler, setupUncaughtExceptionHandler, setupUnhandledRejectionHandler } = require('../../common/utils/errorHandler');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3008;

// Configure logger
const logger = createLogger('configuration-management-service');
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
  .then(() => logger.info('Connected to MongoDB'))
  .catch(err => logger.error('MongoDB connection error:', err));

// Import routes
const topicPreferenceRoutes = require('./routes/topicPreferences');
const notificationRoutes = require('./routes/notifications');
const contentVolumeRoutes = require('./routes/contentVolume');
const volumeControlRoutes = require('./routes/volumeControl');
const discoverySettingsRoutes = require('./routes/discoverySettings');
const summaryPreferencesRoutes = require('./routes/summaryPreferences');
const digestSchedulingRoutes = require('./routes/digestScheduling');

// Use routes
app.use('/api/topic-preferences', topicPreferenceRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/content-volume', contentVolumeRoutes);
app.use('/api/volume-control', volumeControlRoutes);
app.use('/api/discovery-settings', discoverySettingsRoutes);
app.use('/api/summary-preferences', summaryPreferencesRoutes);
app.use('/api/digest-scheduling', digestSchedulingRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Error handling middleware
app.use(errorHandler);

// Start server only if not in test mode
let server;
if (process.env.NODE_ENV !== 'test') {
  server = app.listen(PORT, () => {
    logger.info(`Configuration Management Service running on port ${PORT}`);
  });

  // Handle server shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    server.close(() => {
      logger.info('Process terminated');
      mongoose.connection.close(false, () => {
        process.exit(0);
      });
    });
  });
}

module.exports = { app, server };