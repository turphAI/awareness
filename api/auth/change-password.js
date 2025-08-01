const { executeQuery } = require('../../lib/database');
const { 
  handleCors, 
  requireAuth,
  isValidPassword,
  hashPassword,
  comparePassword
} = require('../../lib/auth');

// Change password endpoint for Vercel deployment
export default async function handler(req, res) {
  // Handle CORS
  if (handleCors(req, res)) return;

  if (req.method !== 'PUT') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    });
  }

  // Require authentication
  return requireAuth(async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;

      // Validation
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ 
          success: false, 
          error: 'Current password and new password are required' 
        });
      }

      if (!isValidPassword(newPassword)) {
        return res.status(400).json({ 
          success: false, 
          error: 'New password must be at least 8 characters with uppercase, lowercase, and number' 
        });
      }

      // Get current password hash
      const users = await executeQuery(
        'SELECT password_hash FROM users WHERE id = ?',
        [req.user.id]
      );

      if (users.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      // Verify current password
      const isValidCurrentPassword = await comparePassword(currentPassword, users[0].password_hash);
      if (!isValidCurrentPassword) {
        return res.status(400).json({
          success: false,
          error: 'Current password is incorrect'
        });
      }

      // Hash new password
      const newPasswordHash = await hashPassword(newPassword);

      // Update password
      await executeQuery(
        'UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?',
        [newPasswordHash, req.user.id]
      );

      return res.status(200).json({
        success: true,
        message: 'Password changed successfully'
      });

    } catch (error) {
      console.error('Change password error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  })(req, res);
}