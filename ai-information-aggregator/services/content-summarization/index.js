const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const summarizationRoutes = require('./routes/summarization');
const insightRoutes = require('./routes/insights');
const categorizationRoutes = require('./routes/categorization');
const academicRoutes = require('./routes/academic');
const newsRoutes = require('./routes/news');
const visualRoutes = require('./routes/visual');

const app = express();
const PORT = process.env.PORT || 3006;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use('/api/summarization', summarizationRoutes);
app.use('/api/insights', insightRoutes);
app.use('/api/categorization', categorizationRoutes);
app.use('/api/academic', academicRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/visual', visualRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', service: 'content-summarization' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`Content Summarization Service running on port ${PORT}`);
});

module.exports = app;