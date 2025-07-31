const express = require('express');
const { login, register, getProfile, updateProfile, logout } = require('../controllers/authController');
const { authenticateJWT } = require('../middleware/auth');

const router = express.Router();

// Public routes
router.post('/login', login);
router.post('/register', register);

// Protected routes
router.get('/profile', authenticateJWT, getProfile);
router.put('/profile', authenticateJWT, updateProfile);
router.post('/logout', authenticateJWT, logout);

module.exports = router;