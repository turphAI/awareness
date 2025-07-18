const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const proxy = require('express-http-proxy');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Authentication middleware
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (err) {
        return res.sendStatus(403);
      }

      req.user = user;
      next();
    });
  } else {
    res.sendStatus(401);
  }
};

// Public routes
app.use('/api/auth', proxy('http://authentication-service:3001'));

// Protected routes
app.use('/api/sources', authenticateJWT, proxy('http://source-management-service:3002'));
app.use('/api/content', authenticateJWT, proxy('http://content-discovery-service:3003'));
app.use('/api/podcasts', authenticateJWT, proxy('http://podcast-extraction-service:3004'));
app.use('/api/summaries', authenticateJWT, proxy('http://content-summarization-service:3005'));
app.use('/api/personalization', authenticateJWT, proxy('http://personalization-service:3006'));
app.use('/api/library', authenticateJWT, proxy('http://library-management-service:3007'));
app.use('/api/config', authenticateJWT, proxy('http://configuration-management-service:3008'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Start server
app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
});