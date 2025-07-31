import { executeQuery } from '../../lib/database';
import { authenticate, verifyPassword, hashPassword } from '../../lib/auth';
import { handleApiError, ApiError, validatePassword } from '../../lib/validation';

/**
 * Change password endpoint
 * @route POST /api/auth/change-password
 * @access Private
 */
export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  try {
    // Authenticate user
    const user = await authenticate(req);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      throw new ApiError('Current password and new password are required', 400);
    }
    
    // Validate new password
    validatePassword(newPassword);
    
    // Get user's current password hash
    const users = await executeQuery(
      'SELECT password_hash FROM users WHERE id = ? AND active = TRUE',
      [user.id]
    );
    
    if (users.length === 0) {
      throw new ApiError('User not found', 404);
    }
    
    // Verify current password
    const isValidPassword = await verifyPassword(currentPassword, users[0].password_hash);
    if (!isValidPassword) {
      throw new ApiError('Current password is incorrect', 401);
    }
    
    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);
    
    // Update password
    await executeQuery(
      'UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?',
      [newPasswordHash, user.id]
    );
    
    return res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
    
  } catch (error) {
    handleApiError(error, res);
  }
}