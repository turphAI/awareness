const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

// Import personalization components
const InterestModeler = require('./utils/interestModeler');
const RelevanceScorer = require('./utils/relevanceScorer');
const InteractionLearner = require('./utils/interactionLearner');
const BreakingNewsDetector = require('./utils/breakingNewsDetector');
const FocusAreaManager = require('./utils/focusAreaManager');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Initialize personalization services
const interestModeler = new InterestModeler();
const relevanceScorer = new RelevanceScorer();
const interactionLearner = new InteractionLearner();
const breakingNewsDetector = new BreakingNewsDetector();
const focusAreaManager = new FocusAreaManager();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'personalization-service',
    timestamp: new Date().toISOString(),
    components: {
      interestModeler: 'active',
      relevanceScorer: 'active',
      interactionLearner: 'active',
      breakingNewsDetector: 'active',
      focusAreaManager: 'active'
    }
  });
});

// Service info endpoint
app.get('/info', (req, res) => {
  res.json({
    name: 'AI Information Aggregator - Personalization Service',
    version: '1.0.0',
    description: 'Provides personalized content recommendations and user interest modeling',
    features: [
      'User interest modeling and profiling',
      'Content relevance scoring and ranking',
      'Interaction-based learning and adaptation',
      'Breaking news detection and notifications',
      'Focus area management and content filtering'
    ],
    endpoints: {
      health: '/health',
      info: '/info'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: 'The requested endpoint does not exist'
  });
});

// Start server
if (require.main === module) {
  app.listen(port, () => {
    console.log(`Personalization service running on port ${port}`);
    console.log(`Health check: http://localhost:${port}/health`);
    console.log(`Service info: http://localhost:${port}/info`);
  });
}

module.exports = {
  app,
  interestModeler,
  relevanceScorer,
  interactionLearner,
  breakingNewsDetector,
  focusAreaManager
};