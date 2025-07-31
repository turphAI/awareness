import { executeQuery } from '../../lib/database';
import { verifyPassword, generateToken } from '../../lib/auth';
import { validateLoginData, handleApiError, ApiError } from '../../lib/validation';

/**
 * User login endpoint
 * @route POST /api/auth/login
 * @access Public
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
    // Validate request data
    validateLoginData(req.body);
    
    const { email, password } = req.body;
    
    // Find user by email
    const users = await executeQuery(
      'SELECT id, email, password_hash, name, role, email_verified, active, last_login FROM users WHERE email = ? AND active = TRUE',
      [email.toLowerCase()]
    );
    
    if (users.length === 0) {
      throw new ApiError('Invalid credentials', 401);
    }
    
    const user = users[0];
    
    // Verify password
    const isValidPassword = await verifyPassword(password, user.password_hash);
    if (!isValidPassword) {
      throw new ApiError('Invalid credentials', 401);
    }
    
    // Update last login
    await executeQuery(
      'UPDATE users SET last_login = NOW() WHERE id = ?',
      [user.id]
    );
    
    // Generate JWT token
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role
    });
    
    // Return success response
    res.status(200).json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified: user.email_verified
      }
    });
    
  } catch (error) {
    handleApiError(error, res);
  }
}