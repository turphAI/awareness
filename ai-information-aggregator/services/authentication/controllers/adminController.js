const User = require('../models/User');
const { ApiError } = require('../../../common/utils/errorHandler');
const { ROLES, getRoles } = require('../utils/roles');
const createLogger = require('../../../common/utils/logger');

// Configure logger
const logger = createLogger('admin-controller');

/**
 * Get all users
 * @route GET /api/admin/users
 * @access Private/Admin
 */
exports.getAllUsers = async (req, res, next) => {
  try {
    // Get pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Get filter parameters
    const role = req.query.role;
    const search = req.query.search;
    
    // Build filter
    const filter = {};
    
    if (role && Object.values(ROLES).includes(role)) {
      filter.role = role;
    }
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Find users with pagination
    const users = await User.find(filter)
      .select('-passwordHash -resetPasswordToken -resetPasswordExpire -emailVerificationToken')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });
    
    // Count total users
    const total = await User.countDocuments(filter);
    
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
 * Get user by ID
 * @route GET /api/admin/users/:id
 * @access Private/Admin
 */
exports.getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-passwordHash -resetPasswordToken -resetPasswordExpire -emailVerificationToken');
    
    if (!user) {
      throw new ApiError(404, 'User not found');
    }
    
    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update user
 * @route PUT /api/admin/users/:id
 * @access Private/Admin
 */
exports.updateUser = async (req, res, next) => {
  try {
    // Find user
    const user = await User.findById(req.params.id);
    
    if (!user) {
      throw new ApiError(404, 'User not found');
    }
    
    // Update allowed fields
    const allowedFields = ['name', 'emailVerified', 'active'];
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        user[field] = req.body[field];
      }
    });
    
    // Save user
    await user.save();
    
    // Log action
    logger.info(`User ${req.user.email} (${req.user.role}) updated user ${user.email}`);
    
    // Send response
    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
        active: user.active,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      },
      message: 'User updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete user
 * @route DELETE /api/admin/users/:id
 * @access Private/Admin
 */
exports.deleteUser = async (req, res, next) => {
  try {
    // Find user
    const user = await User.findById(req.params.id);
    
    if (!user) {
      throw new ApiError(404, 'User not found');
    }
    
    // Prevent deleting self
    if (user._id.toString() === req.user.id.toString()) {
      throw new ApiError(400, 'You cannot delete your own account');
    }
    
    // Soft delete (set active to false)
    user.active = false;
    await user.save();
    
    // Log action
    logger.info(`User ${req.user.email} (${req.user.role}) deleted user ${user.email}`);
    
    // Send response
    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all roles
 * @route GET /api/admin/roles
 * @access Private/Admin
 */
exports.getAllRoles = async (req, res, next) => {
  try {
    const roles = getRoles();
    
    res.status(200).json({
      success: true,
      roles
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update user role
 * @route PUT /api/admin/users/:id/role
 * @access Private/Admin
 */
exports.updateUserRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    
    // Validate role
    if (!role || !Object.values(ROLES).includes(role)) {
      throw new ApiError(400, 'Invalid role');
    }
    
    // Find user
    const user = await User.findById(req.params.id);
    
    if (!user) {
      throw new ApiError(404, 'User not found');
    }
    
    // Prevent changing own role
    if (user._id.toString() === req.user.id.toString()) {
      throw new ApiError(400, 'You cannot change your own role');
    }
    
    // Update role
    user.role = role;
    await user.save();
    
    // Log action
    logger.info(`User ${req.user.email} (${req.user.role}) updated role of user ${user.email} to ${role}`);
    
    // Send response
    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      message: 'User role updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get system metrics
 * @route GET /api/admin/system/metrics
 * @access Private/Admin
 */
exports.getSystemMetrics = async (req, res, next) => {
  try {
    // Get user counts
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ active: true });
    const verifiedUsers = await User.countDocuments({ emailVerified: true });
    
    // Get role counts
    const usersByRole = await User.aggregate([
      { $match: { active: true } },
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);
    
    const roleCounts = {};
    usersByRole.forEach(item => {
      roleCounts[item._id] = item.count;
    });
    
    // Get registration metrics
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const usersToday = await User.countDocuments({
      createdAt: { $gte: today }
    });
    
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);
    last7Days.setHours(0, 0, 0, 0);
    
    const usersLast7Days = await User.countDocuments({
      createdAt: { $gte: last7Days }
    });
    
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);
    last30Days.setHours(0, 0, 0, 0);
    
    const usersLast30Days = await User.countDocuments({
      createdAt: { $gte: last30Days }
    });
    
    // Send response
    res.status(200).json({
      success: true,
      metrics: {
        users: {
          total: totalUsers,
          active: activeUsers,
          verified: verifiedUsers,
          byRole: roleCounts
        },
        registrations: {
          today: usersToday,
          last7Days: usersLast7Days,
          last30Days: usersLast30Days
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get system logs
 * @route GET /api/admin/system/logs
 * @access Private/Admin
 */
exports.getSystemLogs = async (req, res, next) => {
  try {
    // This is a placeholder. In a real implementation, you would fetch logs from a logging service.
    res.status(200).json({
      success: true,
      message: 'System logs functionality not implemented yet'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update system settings
 * @route POST /api/admin/system/settings
 * @access Private/Admin
 */
exports.updateSystemSettings = async (req, res, next) => {
  try {
    // This is a placeholder. In a real implementation, you would update system settings.
    res.status(200).json({
      success: true,
      message: 'System settings functionality not implemented yet'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get pending content
 * @route GET /api/admin/content/pending
 * @access Private/Admin,Moderator
 */
exports.getPendingContent = async (req, res, next) => {
  try {
    // This is a placeholder. In a real implementation, you would fetch pending content.
    res.status(200).json({
      success: true,
      message: 'Pending content functionality not implemented yet'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Approve content
 * @route PUT /api/admin/content/:id/approve
 * @access Private/Admin,Moderator
 */
exports.approveContent = async (req, res, next) => {
  try {
    // This is a placeholder. In a real implementation, you would approve content.
    res.status(200).json({
      success: true,
      message: 'Content approval functionality not implemented yet'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reject content
 * @route PUT /api/admin/content/:id/reject
 * @access Private/Admin,Moderator
 */
exports.rejectContent = async (req, res, next) => {
  try {
    // This is a placeholder. In a real implementation, you would reject content.
    res.status(200).json({
      success: true,
      message: 'Content rejection functionality not implemented yet'
    });
  } catch (error) {
    next(error);
  }
};