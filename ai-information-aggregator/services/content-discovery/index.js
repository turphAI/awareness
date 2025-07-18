const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const createLogger = require('../../common/utils/logger');
const { errorHandler, setupUncaughtExceptionHandler, setupUnhandledRejectionHandler } = require('../../common/utils/errorHandler');

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
  .then(() => logger.info('Connected to MongoDB'))
  .catch(err => logger.error('MongoDB connection error:', err));

// Import routes
const contentRoutes = require('./routes/content');
const discoveryRoutes = require('./routes/discovery');

// Use routes
app.use('/api/content', contentRoutes);
app.use('/api/discovery', discoveryRoutes);

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
  server.close(() => {
    logger.info('Process terminated');
    mongoose.connection.close(false, () => {
      process.exit(0);
    });
  });
});

module.exports = { app, server };