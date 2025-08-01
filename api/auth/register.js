import { executeQuery } from '../../lib/database.js';
import { 
  handleCors, 
  isValidEmail, 
  isValidPassword,
  hashPassword, 
  generateToken,
  generateRandomToken
} from '../../lib/auth.js';

// Register endpoint for Vercel deployment
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
    const { email, password, name } = req.body;

    // Validation
    if (!email || !password || !name) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email, password, and name are required' 
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid email format' 
      });
    }

    if (!isValidPassword(password)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Password must be at least 8 characters with uppercase, lowercase, and number' 
      });
    }

    if (name.trim().length < 2) {
      return res.status(400).json({ 
        success: false, 
        error: 'Name must be at least 2 characters long' 
      });
    }

    // Check if user already exists
    const existingUsers = await executeQuery(
      'SELECT id FROM users WHERE email = ?',
      [email.toLowerCase()]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'User with this email already exists'
      });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Generate email verification token
    const emailVerificationToken = generateRandomToken();

    // Create user
    const result = await executeQuery(
      `INSERT INTO users (
        email, password_hash, name, email_verification_token,
        preferences, notifications, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [
        email.toLowerCase(),
        passwordHash,
        name.trim(),
        emailVerificationToken,
        JSON.stringify({
          topics: [],
          contentVolume: 10,
          discoveryAggressiveness: 0.5,
          summaryLength: 'medium',
          digestFrequency: 'daily'
        }),
        JSON.stringify({
          email: true,
          push: true,
          digest: true
        })
      ]
    );

    const userId = result.insertId;

    // Create default user settings
    await Promise.all([
      // Topic preferences
      executeQuery(
        'INSERT INTO topic_preferences (user_id, topic, interest_level, priority) VALUES (?, ?, ?, ?)',
        [userId, 'technology', 0.7, 1]
      ),
      // Content volume settings
      executeQuery(
        'INSERT INTO content_volume_settings (user_id, daily_limit, weekly_limit) VALUES (?, ?, ?)',
        [userId, 10, 70]
      ),
      // Discovery settings
      executeQuery(
        'INSERT INTO discovery_settings (user_id, aggressiveness) VALUES (?, ?)',
        [userId, 0.5]
      ),
      // Summary preferences
      executeQuery(
        'INSERT INTO summary_preferences (user_id, length) VALUES (?, ?)',
        [userId, 'medium']
      ),
      // Digest scheduling
      executeQuery(
        'INSERT INTO digest_scheduling (user_id, frequency) VALUES (?, ?)',
        [userId, 'daily']
      ),
      // Notification settings
      executeQuery(
        'INSERT INTO notification_settings (user_id) VALUES (?)',
        [userId]
      ),
      // Interest profile
      executeQuery(
        'INSERT INTO interest_profiles (user_id, topics, sources, content_types) VALUES (?, ?, ?, ?)',
        [userId, JSON.stringify([]), JSON.stringify([]), JSON.stringify([])]
      )
    ]);

    // TODO: Send verification email
    // For now, we'll auto-verify for development
    if (process.env.NODE_ENV === 'development') {
      await executeQuery(
        'UPDATE users SET email_verified = TRUE WHERE id = ?',
        [userId]
      );
    }

    // Generate JWT token
    const user = {
      id: userId,
      email: email.toLowerCase(),
      name: name.trim(),
      role: 'user'
    };
    const token = generateToken(user);

    // Return success response
    return res.status(201).json({
      success: true,
      message: 'Registration successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      token,
      emailVerificationRequired: process.env.NODE_ENV !== 'development'
    });

  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}