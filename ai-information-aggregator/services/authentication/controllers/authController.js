const User = require('../models/User');
const { ApiError } = require('../../../common/utils/errorHandler');
const crypto = require('crypto');
const emailService = require('../utils/emailService');
const createLogger = require('../../../common/utils/logger');

// Configure logger
const logger = createLogger('auth-controller');

/**
 * Register a new user
 * @route POST /api/auth/register
 * @access Public
 */
exports.register = async (req, res, next) => {
  try {
    const { email, password, name } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      throw new ApiError(400, 'User with this email already exists');
    }
    
    // Create new user
    const user = new User({
      email,
      passwordHash: password, // Will be hashed by pre-save hook
      name
    });
    
    // Generate email verification token
    const verificationToken = user.generateEmailVerificationToken();
    
    // Save user
    await user.save();
    
    // Send verification email
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const emailSent = await emailService.sendVerificationEmail(user, verificationToken, baseUrl);
    
    if (!emailSent) {
      logger.warn(`Failed to send verification email to ${user.email}`);
    }
    
    // Generate auth token
    const token = user.generateAuthToken();
    
    // Send response
    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified: user.emailVerified
      },
      message: 'Registration successful. Please verify your email.'
    });
    
    // Send welcome email asynchronously (don't wait for it)
    emailService.sendWelcomeEmail(user).catch(err => {
      logger.error(`Failed to send welcome email to ${user.email}:`, err);
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Login user
 * @route POST /api/auth/login
 * @access Public
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
    
    // Check if user exists
    if (!user) {
      throw new ApiError(401, 'Invalid credentials');
    }
    
    // Check if user is active
    if (!user.active) {
      throw new ApiError(401, 'Account is deactivated');
    }
    
    // Check if password matches
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new ApiError(401, 'Invalid credentials');
    }
    
    // Update last login
    user.lastLogin = Date.now();
    await user.save();
    
    // Generate auth token
    const token = user.generateAuthToken();
    
    // Send response
    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified: user.emailVerified
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user
 * @route GET /api/auth/me
 * @access Private
 */
exports.getMe = async (req, res, next) => {
  try {
    // Find user by ID
    const user = await User.findById(req.user.id);
    
    // Check if user exists
    if (!user) {
      throw new ApiError(404, 'User not found');
    }
    
    // Send response
    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified: user.emailVerified,
        preferences: user.preferences,
        notifications: user.notifications,
        profile: user.profile,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Logout user
 * @route POST /api/auth/logout
 * @access Private
 */
exports.logout = async (req, res, next) => {
  try {
    // JWT is stateless, so we can't invalidate it server-side
    // Client should remove the token from storage
    
    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Forgot password
 * @route POST /api/auth/forgot-password
 * @access Public
 */
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    
    // Find user by email
    const user = await User.findByEmail(email);
    
    // Always return success even if user not found (security)
    if (!user) {
      return res.status(200).json({
        success: true,
        message: 'Password reset email sent if account exists'
      });
    }
    
    // Generate reset token
    const resetToken = user.generatePasswordResetToken();
    await user.save();
    
    // Send password reset email
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const emailSent = await emailService.sendPasswordResetEmail(user, resetToken, baseUrl);
    
    if (!emailSent) {
      logger.warn(`Failed to send password reset email to ${user.email}`);
    }
    
    // Send response
    res.status(200).json({
      success: true,
      message: 'Password reset email sent'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reset password
 * @route POST /api/auth/reset-password/:token
 * @access Public
 */
exports.resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body;
    
    // Find user by reset token
    const user = await User.findByResetToken(token);
    
    // Check if user exists
    if (!user) {
      throw new ApiError(400, 'Invalid or expired token');
    }
    
    // Update password
    user.passwordHash = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();
    
    // Generate auth token
    const authToken = user.generateAuthToken();
    
    // Send response
    res.status(200).json({
      success: true,
      token: authToken,
      message: 'Password reset successful'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify email
 * @route GET /api/auth/verify-email/:token
 * @access Public
 */
exports.verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.params;
    
    // Find user by verification token
    const user = await User.findByVerificationToken(token);
    
    // Check if user exists
    if (!user) {
      throw new ApiError(400, 'Invalid or expired token');
    }
    
    // Update user
    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    await user.save();
    
    // Send response
    res.status(200).json({
      success: true,
      message: 'Email verified successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Change password
 * @route POST /api/auth/change-password
 * @access Private
 */
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    // Find user by ID
    const user = await User.findById(req.user.id).select('+passwordHash');
    
    // Check if user exists
    if (!user) {
      throw new ApiError(404, 'User not found');
    }
    
    // Check if current password matches
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      throw new ApiError(401, 'Current password is incorrect');
    }
    
    // Update password
    user.passwordHash = newPassword;
    await user.save();
    
    // Send response
    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    next(error);
  }
};