const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const logger = require('../utils/logger');

// Mock user database (in production, this would be a real database)
const mockUsers = [
  {
    id: '1',
    email: 'demo@example.com',
    password: '$2b$10$rOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQ', // 'password123'
    name: 'Demo User',
    role: 'user',
    createdAt: new Date('2024-01-01'),
    preferences: {
      topics: ['machine-learning', 'artificial-intelligence'],
      contentVolume: 10,
      summaryLength: 'medium'
    }
  },
  {
    id: '2',
    email: 'admin@example.com',
    password: '$2b$10$rOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQ', // 'admin123'
    name: 'Admin User',
    role: 'admin',
    createdAt: new Date('2024-01-01'),
    preferences: {
      topics: ['ai-research', 'technology'],
      contentVolume: 20,
      summaryLength: 'detailed'
    }
  }
];

const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_key_change_in_production';
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || '1d';

/**
 * Generate JWT token
 */
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email, 
      role: user.role 
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRATION }
  );
};

/**
 * Find user by email
 */
const findUserByEmail = (email) => {
  return mockUsers.find(user => user.email.toLowerCase() === email.toLowerCase());
};

/**
 * Find user by ID
 */
const findUserById = (id) => {
  return mockUsers.find(user => user.id === id);
};

/**
 * Login controller
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Email and password are required'
      });
    }

    // Find user
    const user = findUserByEmail(email);
    if (!user) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid email or password'
      });
    }

    // For demo purposes, accept 'password123' for demo@example.com and 'admin123' for admin@example.com
    const isValidPassword = (email === 'demo@example.com' && password === 'password123') ||
                           (email === 'admin@example.com' && password === 'admin123');

    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid email or password'
      });
    }

    // Generate token
    const token = generateToken(user);

    // Remove password from user object
    const { password: _, ...userWithoutPassword } = user;

    logger.info('User logged in successfully', { userId: user.id, email: user.email });

    res.json({
      message: 'Login successful',
      token,
      user: userWithoutPassword
    });

  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'An error occurred during login'
    });
  }
};

/**
 * Register controller
 */
const register = async (req, res) => {
  try {
    console.log('Registration request received:', req.body);
    const { email, password, name } = req.body;

    // Validate input
    if (!email || !password || !name) {
      console.log('Validation failed - missing fields');
      return res.status(400).json({
        error: 'Validation error',
        message: 'Email, password, and name are required'
      });
    }

    // Check if user already exists
    if (findUserByEmail(email)) {
      return res.status(409).json({
        error: 'Registration failed',
        message: 'User with this email already exists'
      });
    }

    // Create new user (in production, hash password and save to database)
    const newUser = {
      id: String(mockUsers.length + 1),
      email: email.toLowerCase(),
      password: await bcrypt.hash(password, 10),
      name,
      role: 'user',
      createdAt: new Date(),
      preferences: {
        topics: [],
        contentVolume: 10,
        summaryLength: 'medium'
      }
    };

    mockUsers.push(newUser);

    // Generate token
    const token = generateToken(newUser);

    // Remove password from user object
    const { password: _, ...userWithoutPassword } = newUser;

    logger.info('User registered successfully', { userId: newUser.id, email: newUser.email });

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: userWithoutPassword
    });

  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'An error occurred during registration'
    });
  }
};

/**
 * Get current user profile
 */
const getProfile = async (req, res) => {
  try {
    const user = findUserById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User profile not found'
      });
    }

    // Remove password from user object
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      user: userWithoutPassword
    });

  } catch (error) {
    logger.error('Get profile error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'An error occurred while fetching profile'
    });
  }
};

/**
 * Update user profile
 */
const updateProfile = async (req, res) => {
  try {
    const { name, preferences } = req.body;
    const user = findUserById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User profile not found'
      });
    }

    // Update user data
    if (name) user.name = name;
    if (preferences) user.preferences = { ...user.preferences, ...preferences };

    // Remove password from user object
    const { password: _, ...userWithoutPassword } = user;

    logger.info('User profile updated', { userId: user.id });

    res.json({
      message: 'Profile updated successfully',
      user: userWithoutPassword
    });

  } catch (error) {
    logger.error('Update profile error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'An error occurred while updating profile'
    });
  }
};

/**
 * Logout controller
 */
const logout = async (req, res) => {
  try {
    // In a real application, you might want to blacklist the token
    logger.info('User logged out', { userId: req.user?.id });
    
    res.json({
      message: 'Logout successful'
    });

  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'An error occurred during logout'
    });
  }
};

module.exports = {
  login,
  register,
  getProfile,
  updateProfile,
  logout
};