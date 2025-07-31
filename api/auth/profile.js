import { executeQuery } from '../../lib/database';
import { authenticate, hashPassword } from '../../lib/auth';
import { handleApiError, ApiError, validatePassword } from '../../lib/validation';

/**
 * User profile management endpoint
 * @route GET/PUT /api/auth/profile
 * @access Private
 */
export default async function handler(req, res) {
  try {
    // Authenticate user
    const user = await authenticate(req);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    if (req.method === 'GET') {
      // Get user profile
      const users = await executeQuery(
        `SELECT 
          id, email, name, role, email_verified, last_login, 
          preferences, notifications, profile, 
          data_retention, privacy_settings, 
          created_at, updated_at
        FROM users WHERE id = ? AND active = TRUE`,
        [user.id]
      );
      
      if (users.length === 0) {
        throw new ApiError('User not found', 404);
      }
      
      const userData = users[0];
      
      // Parse JSON fields
      const userProfile = {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        role: userData.role,
        emailVerified: userData.email_verified,
        lastLogin: userData.last_login,
        preferences: userData.preferences ? JSON.parse(userData.preferences) : {},
        notifications: userData.notifications ? JSON.parse(userData.notifications) : {},
        profile: userData.profile ? JSON.parse(userData.profile) : {},
        dataRetention: userData.data_retention ? JSON.parse(userData.data_retention) : {},
        privacySettings: userData.privacy_settings ? JSON.parse(userData.privacy_settings) : {},
        createdAt: userData.created_at,
        updatedAt: userData.updated_at
      };
      
      return res.status(200).json({
        success: true,
        user: userProfile
      });
      
    } else if (req.method === 'PUT') {
      // Update user profile
      const { 
        name, 
        preferences, 
        notifications, 
        profile, 
        dataRetention, 
        privacySettings 
      } = req.body;
      
      const updates = [];
      const values = [];
      
      if (name !== undefined) {
        if (!name || name.length < 2 || name.length > 50) {
          throw new ApiError('Name must be between 2 and 50 characters', 400);
        }
        updates.push('name = ?');
        values.push(name);
      }
      
      if (preferences !== undefined) {
        updates.push('preferences = ?');
        values.push(JSON.stringify(preferences));
      }
      
      if (notifications !== undefined) {
        updates.push('notifications = ?');
        values.push(JSON.stringify(notifications));
      }
      
      if (profile !== undefined) {
        updates.push('profile = ?');
        values.push(JSON.stringify(profile));
      }
      
      if (dataRetention !== undefined) {
        updates.push('data_retention = ?');
        values.push(JSON.stringify(dataRetention));
      }
      
      if (privacySettings !== undefined) {
        updates.push('privacy_settings = ?');
        values.push(JSON.stringify(privacySettings));
      }
      
      if (updates.length === 0) {
        throw new ApiError('No valid fields to update', 400);
      }
      
      updates.push('updated_at = NOW()');
      values.push(user.id);
      
      await executeQuery(
        `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
      
      return res.status(200).json({
        success: true,
        message: 'Profile updated successfully'
      });
      
    } else {
      return res.status(405).json({
        success: false,
        error: 'Method not allowed'
      });
    }
    
  } catch (error) {
    handleApiError(error, res);
  }
}