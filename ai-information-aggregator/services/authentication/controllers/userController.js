const User = require('../models/User');
const { ApiError } = require('../../../common/utils/errorHandler');

/**
 * Get user profile
 * @route GET /api/users/profile
 * @access Private
 */
exports.getProfile = async (req, res, next) => {
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
      profile: {
        name: user.name,
        email: user.email,
        ...user.profile
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update user profile
 * @route PUT /api/users/profile
 * @access Private
 */
exports.updateProfile = async (req, res, next) => {
  try {
    // Find user by ID
    const user = await User.findById(req.user.id);
    
    // Check if user exists
    if (!user) {
      throw new ApiError(404, 'User not found');
    }
    
    // Update basic user info
    if (req.body.name) {
      user.name = req.body.name;
    }
    
    // Update profile data
    const profileData = {};
    const allowedFields = ['bio', 'avatar', 'organization', 'jobTitle', 'location', 'website'];
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        profileData[field] = req.body[field];
      }
    });
    
    // Update profile if there are changes
    if (Object.keys(profileData).length > 0) {
      await user.updateProfile(profileData);
    } else {
      await user.save();
    }
    
    // Send response
    res.status(200).json({
      success: true,
      profile: {
        name: user.name,
        email: user.email,
        ...user.profile
      },
      message: 'Profile updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user preferences
 * @route GET /api/users/preferences
 * @access Private
 */
exports.getPreferences = async (req, res, next) => {
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
      preferences: user.preferences
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update user preferences
 * @route PUT /api/users/preferences
 * @access Private
 */
exports.updatePreferences = async (req, res, next) => {
  try {
    // Find user by ID
    const user = await User.findById(req.user.id);
    
    // Check if user exists
    if (!user) {
      throw new ApiError(404, 'User not found');
    }
    
    // Update preferences
    await user.updatePreferences(req.body);
    
    // Send response
    res.status(200).json({
      success: true,
      preferences: user.preferences,
      message: 'Preferences updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user notification settings
 * @route GET /api/users/notifications
 * @access Private
 */
exports.getNotificationSettings = async (req, res, next) => {
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
      notifications: user.notifications
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update user notification settings
 * @route PUT /api/users/notifications
 * @access Private
 */
exports.updateNotificationSettings = async (req, res, next) => {
  try {
    // Find user by ID
    const user = await User.findById(req.user.id);
    
    // Check if user exists
    if (!user) {
      throw new ApiError(404, 'User not found');
    }
    
    // Update notification settings
    await user.updateNotificationSettings(req.body);
    
    // Send response
    res.status(200).json({
      success: true,
      notifications: user.notifications,
      message: 'Notification settings updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all users (admin only)
 * @route GET /api/users
 * @access Private/Admin
 */
exports.getAllUsers = async (req, res, next) => {
  try {
    // Get pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Find users with pagination
    const users = await User.find({ active: true })
      .select('-__v')
      .skip(skip)
      .limit(limit);
    
    // Count total users
    const total = await User.countDocuments({ active: true });
    
    // Send response
    res.status(200).json({
      success: true,
      count: users.length,
      total,
      pagination: {
        page,
        limit,
        pages: Math.ceil(total / limit)
      },
      users
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user by ID (admin only)
 * @route GET /api/users/:id
 * @access Private/Admin
 */
exports.getUserById = async (req, res, next) => {
  try {
    // Find user by ID
    const user = await User.findOne({ _id: req.params.id, active: true });
    
    // Check if user exists
    if (!user) {
      throw new ApiError(404, 'User not found');
    }
    
    // Send response
    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update user (admin only)
 * @route PUT /api/users/:id
 * @access Private/Admin
 */
exports.updateUser = async (req, res, next) => {
  try {
    // Find user by ID
    const user = await User.findOne({ _id: req.params.id, active: true });
    
    // Check if user exists
    if (!user) {
      throw new ApiError(404, 'User not found');
    }
    
    // Update user fields
    const allowedFields = ['name', 'role', 'emailVerified'];
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        user[field] = req.body[field];
      }
    });
    
    // Update profile if provided
    if (req.body.profile) {
      await user.updateProfile(req.body.profile);
    }
    
    // Update preferences if provided
    if (req.body.preferences) {
      await user.updatePreferences(req.body.preferences);
    }
    
    // Update notification settings if provided
    if (req.body.notifications) {
      await user.updateNotificationSettings(req.body.notifications);
    }
    
    // Save user
    await user.save();
    
    // Send response
    res.status(200).json({
      success: true,
      user,
      message: 'User updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete user (admin only)
 * @route DELETE /api/users/:id
 * @access Private/Admin
 */
exports.deleteUser = async (req, res, next) => {
  try {
    // Find user by ID
    const user = await User.findOne({ _id: req.params.id, active: true });
    
    // Check if user exists
    if (!user) {
      throw new ApiError(404, 'User not found');
    }
    
    // Soft delete user
    user.active = false;
    await user.save();
    
    // Send response
    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};