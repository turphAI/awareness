const { executeQuery } = require('../../lib/database');
const { 
  handleCors, 
  requireAuth,
  isValidEmail,
  hashPassword,
  comparePassword
} = require('../../lib/auth');

// Profile management endpoint for Vercel deployment
export default async function handler(req, res) {
  // Handle CORS
  if (handleCors(req, res)) return;

  // Require authentication for all profile operations
  return requireAuth(async (req, res) => {
    try {
      if (req.method === 'GET') {
        // Get user profile
        const users = await executeQuery(
          `SELECT 
            id, email, name, role, bio, avatar, organization, 
            job_title, location, website, preferences, notifications,
            email_verified, last_login, login_count, created_at
          FROM users WHERE id = ?`,
          [req.user.id]
        );

        if (users.length === 0) {
          return res.status(404).json({
            success: false,
            error: 'User not found'
          });
        }

        const user = users[0];
        
        // Parse JSON fields
        user.preferences = user.preferences ? JSON.parse(user.preferences) : {};
        user.notifications = user.notifications ? JSON.parse(user.notifications) : {};

        return res.status(200).json({
          success: true,
          user
        });
      }

      if (req.method === 'PUT') {
        // Update user profile
        const { 
          name, bio, avatar, organization, job_title, 
          location, website, preferences, notifications 
        } = req.body;

        const updates = [];
        const values = [];

        if (name !== undefined) {
          if (name.trim().length < 2) {
            return res.status(400).json({
              success: false,
              error: 'Name must be at least 2 characters long'
            });
          }
          updates.push('name = ?');
          values.push(name.trim());
        }

        if (bio !== undefined) {
          updates.push('bio = ?');
          values.push(bio);
        }

        if (avatar !== undefined) {
          updates.push('avatar = ?');
          values.push(avatar);
        }

        if (organization !== undefined) {
          updates.push('organization = ?');
          values.push(organization);
        }

        if (job_title !== undefined) {
          updates.push('job_title = ?');
          values.push(job_title);
        }

        if (location !== undefined) {
          updates.push('location = ?');
          values.push(location);
        }

        if (website !== undefined) {
          updates.push('website = ?');
          values.push(website);
        }

        if (preferences !== undefined) {
          updates.push('preferences = ?');
          values.push(JSON.stringify(preferences));
        }

        if (notifications !== undefined) {
          updates.push('notifications = ?');
          values.push(JSON.stringify(notifications));
        }

        if (updates.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'No valid fields to update'
          });
        }

        updates.push('updated_at = NOW()');
        values.push(req.user.id);

        await executeQuery(
          `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
          values
        );

        // Get updated user
        const updatedUsers = await executeQuery(
          `SELECT 
            id, email, name, role, bio, avatar, organization, 
            job_title, location, website, preferences, notifications,
            email_verified, last_login, login_count, created_at, updated_at
          FROM users WHERE id = ?`,
          [req.user.id]
        );

        const updatedUser = updatedUsers[0];
        updatedUser.preferences = updatedUser.preferences ? JSON.parse(updatedUser.preferences) : {};
        updatedUser.notifications = updatedUser.notifications ? JSON.parse(updatedUser.notifications) : {};

        return res.status(200).json({
          success: true,
          message: 'Profile updated successfully',
          user: updatedUser
        });
      }

      return res.status(405).json({
        success: false,
        error: 'Method not allowed'
      });

    } catch (error) {
      console.error('Profile error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  })(req, res);
}