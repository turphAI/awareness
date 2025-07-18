const User = require('../models/User');
const Credential = require('../models/Credential');
const { ApiError } = require('../../../common/utils/errorHandler');
const createLogger = require('../../../common/utils/logger');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

// Configure logger
const logger = createLogger('privacy-controller');

/**
 * Export user data
 * @route GET /api/privacy/export
 * @access Private
 */
exports.exportUserData = async (req, res, next) => {
  try {
    // Find user
    const user = await User.findById(req.user.id);
    
    if (!user) {
      throw new ApiError(404, 'User not found');
    }
    
    // Get user credentials (without sensitive data)
    const credentials = await Credential.find({ userId: user._id });
    
    // Prepare user data export
    const userData = {
      profile: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLogin: user.lastLogin
      },
      preferences: user.preferences,
      notifications: user.notifications,
      profile: user.profile,
      credentials: credentials.map(cred => ({
        id: cred._id,
        service: cred.service,
        name: cred.name,
        description: cred.description,
        createdAt: cred.createdAt,
        updatedAt: cred.updatedAt,
        lastUsed: cred.lastUsed,
        expiresAt: cred.expiresAt,
        metadata: Object.fromEntries(cred.metadata || new Map())
      }))
    };
    
    // Log action
    logger.info(`User ${user.email} exported their data`);
    
    // Send response
    res.status(200).json({
      success: true,
      data: userData
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Request account deletion
 * @route POST /api/privacy/delete-account
 * @access Private
 */
exports.requestAccountDeletion = async (req, res, next) => {
  try {
    const { password } = req.body;
    
    // Find user
    const user = await User.findById(req.user.id).select('+passwordHash');
    
    if (!user) {
      throw new ApiError(404, 'User not found');
    }
    
    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new ApiError(401, 'Invalid password');
    }
    
    // Schedule account for deletion (30 days grace period)
    const deletionDate = new Date();
    deletionDate.setDate(deletionDate.getDate() + 30);
    
    user.accountDeletionScheduled = deletionDate;
    await user.save();
    
    // Log action
    logger.info(`User ${user.email} scheduled their account for deletion on ${deletionDate}`);
    
    // Send response
    res.status(200).json({
      success: true,
      message: 'Account scheduled for deletion',
      deletionDate
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel account deletion
 * @route POST /api/privacy/cancel-deletion
 * @access Private
 */
exports.cancelAccountDeletion = async (req, res, next) => {
  try {
    // Find user
    const user = await User.findById(req.user.id);
    
    if (!user) {
      throw new ApiError(404, 'User not found');
    }
    
    // Check if account is scheduled for deletion
    if (!user.accountDeletionScheduled) {
      throw new ApiError(400, 'Account is not scheduled for deletion');
    }
    
    // Cancel deletion
    user.accountDeletionScheduled = undefined;
    await user.save();
    
    // Log action
    logger.info(`User ${user.email} canceled their account deletion`);
    
    // Send response
    res.status(200).json({
      success: true,
      message: 'Account deletion canceled'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Execute account deletion (admin only)
 * @route DELETE /api/privacy/execute-deletion/:id
 * @access Private/Admin
 */
exports.executeAccountDeletion = async (req, res, next) => {
  try {
    // Find user
    const user = await User.findById(req.params.id);
    
    if (!user) {
      throw new ApiError(404, 'User not found');
    }
    
    // Check if account is scheduled for deletion
    if (!user.accountDeletionScheduled) {
      throw new ApiError(400, 'Account is not scheduled for deletion');
    }
    
    // Check if deletion date has passed
    const now = new Date();
    if (user.accountDeletionScheduled > now) {
      throw new ApiError(400, 'Account deletion date has not yet passed');
    }
    
    // Anonymize user data
    user.email = `deleted-${user._id}@example.com`;
    user.name = 'Deleted User';
    user.passwordHash = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
    user.profile = {};
    user.preferences = {};
    user.notifications = {};
    user.active = false;
    user.accountDeletionScheduled = undefined;
    user.accountDeleted = true;
    user.accountDeletedAt = now;
    
    await user.save();
    
    // Delete or anonymize related data
    await Credential.updateMany(
      { userId: user._id },
      { active: false }
    );
    
    // Log action
    logger.info(`Admin ${req.user.email} executed account deletion for user ${req.params.id}`);
    
    // Send response
    res.status(200).json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get privacy policy
 * @route GET /api/privacy/policy
 * @access Public
 */
exports.getPrivacyPolicy = async (req, res, next) => {
  try {
    // This would typically fetch the privacy policy from a database or file
    // For now, we'll return a placeholder
    
    const privacyPolicy = {
      title: 'Privacy Policy',
      lastUpdated: '2023-01-01',
      sections: [
        {
          title: 'Introduction',
          content: 'This Privacy Policy describes how AI Information Aggregator collects, uses, and discloses your personal information.'
        },
        {
          title: 'Information We Collect',
          content: 'We collect information you provide directly to us, such as your name, email address, and preferences.'
        },
        {
          title: 'How We Use Your Information',
          content: 'We use your information to provide, maintain, and improve our services, and to personalize your experience.'
        },
        {
          title: 'Data Retention',
          content: 'We retain your information for as long as your account is active or as needed to provide you services.'
        },
        {
          title: 'Your Rights',
          content: 'You have the right to access, correct, or delete your personal information, and to export your data.'
        }
      ]
    };
    
    res.status(200).json({
      success: true,
      privacyPolicy
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get terms of service
 * @route GET /api/privacy/terms
 * @access Public
 */
exports.getTermsOfService = async (req, res, next) => {
  try {
    // This would typically fetch the terms of service from a database or file
    // For now, we'll return a placeholder
    
    const termsOfService = {
      title: 'Terms of Service',
      lastUpdated: '2023-01-01',
      sections: [
        {
          title: 'Introduction',
          content: 'These Terms of Service govern your use of AI Information Aggregator.'
        },
        {
          title: 'Account Registration',
          content: 'You must register for an account to use our services. You are responsible for maintaining the security of your account.'
        },
        {
          title: 'User Conduct',
          content: 'You agree not to use our services for any unlawful purpose or in any way that could damage or impair our services.'
        },
        {
          title: 'Intellectual Property',
          content: 'Our services and content are protected by copyright, trademark, and other laws.'
        },
        {
          title: 'Termination',
          content: 'We may terminate or suspend your account at any time for any reason.'
        }
      ]
    };
    
    res.status(200).json({
      success: true,
      termsOfService
    });
  } catch (error) {
    next(error);
  }
};