import { executeQuery } from '../../lib/database';
import { hashPassword, generateToken, generateEmailVerificationToken } from '../../lib/auth';
import { validateRegistrationData, handleApiError, ApiError } from '../../lib/validation';

/**
 * User registration endpoint
 * @route POST /api/auth/register
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
    validateRegistrationData(req.body);
    
    const { email, password, name } = req.body;
    
    // Check if user already exists
    const existingUsers = await executeQuery(
      'SELECT id FROM users WHERE email = ?',
      [email.toLowerCase()]
    );
    
    if (existingUsers.length > 0) {
      throw new ApiError('User with this email already exists', 400);
    }
    
    // Hash password
    const passwordHash = await hashPassword(password);
    
    // Generate email verification token
    const { hashedToken: emailVerificationToken } = generateEmailVerificationToken();
    
    // Create default preferences
    const defaultPreferences = {
      topics: [],
      contentVolume: 10,
      discoveryAggressiveness: 0.5,
      summaryLength: 'medium',
      digestFrequency: 'daily'
    };
    
    const defaultNotifications = {
      email: true,
      push: true,
      digest: true
    };
    
    const defaultProfile = {};
    const defaultDataRetention = {
      contentHistory: true,
      searchHistory: true,
      interactionData: true,
      usageStatistics: true
    };
    
    const defaultPrivacySettings = {
      shareUsageData: true,
      allowRecommendations: true,
      allowContentTracking: true,
      allowThirdPartySharing: false
    };
    
    // Insert new user
    const result = await executeQuery(
      `INSERT INTO users (
        email, password_hash, name, role, 
        preferences, notifications, profile, 
        data_retention, privacy_settings, 
        email_verification_token, email_verified, 
        active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        email.toLowerCase(),
        passwordHash,
        name,
        'user',
        JSON.stringify(defaultPreferences),
        JSON.stringify(defaultNotifications),
        JSON.stringify(defaultProfile),
        JSON.stringify(defaultDataRetention),
        JSON.stringify(defaultPrivacySettings),
        emailVerificationToken,
        false,
        true
      ]
    );
    
    const userId = result.insertId;
    
    // Generate JWT token
    const token = generateToken({
      id: userId,
      email: email.toLowerCase(),
      role: 'user'
    });
    
    // Return success response
    res.status(201).json({
      success: true,
      token,
      user: {
        id: userId,
        email: email.toLowerCase(),
        name,
        role: 'user',
        emailVerified: false
      },
      message: 'Registration successful. Please verify your email.'
    });
    
  } catch (error) {
    handleApiError(error, res);
  }
}