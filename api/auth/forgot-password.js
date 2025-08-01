const { executeQuery } = require('../../lib/database');
const { 
  handleCors, 
  isValidEmail,
  generateRandomToken
} = require('../../lib/auth');

// Forgot password endpoint for Vercel deployment
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
    const { email } = req.body;

    // Validation
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email is required' 
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid email format' 
      });
    }

    // Check if user exists
    const users = await executeQuery(
      'SELECT id, email, name FROM users WHERE email = ?',
      [email.toLowerCase()]
    );

    // Always return success to prevent email enumeration
    if (users.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent'
      });
    }

    const user = users[0];

    // Generate reset token
    const resetToken = generateRandomToken();
    const resetExpires = new Date(Date.now() + 3600000); // 1 hour from now

    // Save reset token
    await executeQuery(
      'UPDATE users SET password_reset_token = ?, password_reset_expires = ? WHERE id = ?',
      [resetToken, resetExpires, user.id]
    );

    // TODO: Send password reset email
    // For now, we'll just log the token for development
    if (process.env.NODE_ENV === 'development') {
      console.log(`Password reset token for ${user.email}: ${resetToken}`);
    }

    return res.status(200).json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent',
      // Include token in development mode only
      ...(process.env.NODE_ENV === 'development' && { resetToken })
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}