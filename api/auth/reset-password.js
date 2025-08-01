const { executeQuery } = require('../../lib/database');
const { 
  handleCors, 
  isValidPassword,
  hashPassword
} = require('../../lib/auth');

// Reset password endpoint for Vercel deployment
export default async function handler(req, res) {
  // Handle CORS
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    });
  }

  try {
    const { token, newPassword } = req.body;

    // Validation
    if (!token || !newPassword) {
      return res.status(400).json({ 
        success: false, 
        error: 'Reset token and new password are required' 
      });
    }

    if (!isValidPassword(newPassword)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Password must be at least 8 characters with uppercase, lowercase, and number' 
      });
    }

    // Find user with valid reset token
    const users = await executeQuery(
      `SELECT id, email FROM users 
       WHERE password_reset_token = ? 
       AND password_reset_expires > NOW()`,
      [token]
    );

    if (users.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired reset token'
      });
    }

    const user = users[0];

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update password and clear reset token
    await executeQuery(
      `UPDATE users SET 
        password_hash = ?, 
        password_reset_token = NULL, 
        password_reset_expires = NULL,
        updated_at = NOW()
       WHERE id = ?`,
      [newPasswordHash, user.id]
    );

    return res.status(200).json({
      success: true,
      message: 'Password reset successfully'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}