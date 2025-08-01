const { executeQuery } = require('../../lib/database');
const { 
  handleCors, 
  requireAuth
} = require('../../lib/auth');

// Individual source management endpoint for Vercel deployment
export default async function handler(req, res) {
  // Handle CORS
  if (handleCors(req, res)) return;

  // Require authentication for all source operations
  return requireAuth(async (req, res) => {
    try {
      const { id } = req.query;

      // Validate ID
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          error: 'Valid source ID is required'
        });
      }

      const sourceId = parseInt(id);

      if (req.method === 'GET') {
        // Get specific source
        const sources = await executeQuery(
          `SELECT 
            id, url, name, description, type, categories, tags,
            relevance_score, check_frequency, last_checked, last_updated,
            requires_authentication, active, content_count, error_count,
            last_error, created_at, updated_at
          FROM sources 
          WHERE id = ? AND created_by = ? AND active = TRUE`,
          [sourceId, req.user.id]
        );

        if (sources.length === 0) {
          return res.status(404).json({
            success: false,
            error: 'Source not found'
          });
        }

        const source = sources[0];
        source.categories = source.categories ? JSON.parse(source.categories) : [];
        source.tags = source.tags ? JSON.parse(source.tags) : [];

        return res.status(200).json({
          success: true,
          data: source
        });
      }

      if (req.method === 'PUT') {
        // Update source
        const { 
          name, description, type, categories, tags,
          relevance_score, check_frequency, requires_authentication
        } = req.body;

        // Check if source exists and belongs to user
        const existingSources = await executeQuery(
          'SELECT id FROM sources WHERE id = ? AND created_by = ? AND active = TRUE',
          [sourceId, req.user.id]
        );

        if (existingSources.length === 0) {
          return res.status(404).json({
            success: false,
            error: 'Source not found'
          });
        }

        const updates = [];
        const values = [];

        if (name !== undefined) {
          if (!name.trim()) {
            return res.status(400).json({
              success: false,
              error: 'Name cannot be empty'
            });
          }
          updates.push('name = ?');
          values.push(name.trim());
        }

        if (description !== undefined) {
          updates.push('description = ?');
          values.push(description);
        }

        if (type !== undefined) {
          const validTypes = ['website', 'blog', 'academic', 'podcast', 'social', 'newsletter', 'rss'];
          if (!validTypes.includes(type)) {
            return res.status(400).json({
              success: false,
              error: 'Invalid source type'
            });
          }
          updates.push('type = ?');
          values.push(type);
        }

        if (categories !== undefined) {
          updates.push('categories = ?');
          values.push(JSON.stringify(categories));
        }

        if (tags !== undefined) {
          updates.push('tags = ?');
          values.push(JSON.stringify(tags));
        }

        if (relevance_score !== undefined) {
          if (relevance_score < 0 || relevance_score > 1) {
            return res.status(400).json({
              success: false,
              error: 'Relevance score must be between 0 and 1'
            });
          }
          updates.push('relevance_score = ?');
          values.push(relevance_score);
        }

        if (check_frequency !== undefined) {
          const validFrequencies = ['hourly', 'daily', 'weekly', 'monthly'];
          if (!validFrequencies.includes(check_frequency)) {
            return res.status(400).json({
              success: false,
              error: 'Invalid check frequency'
            });
          }
          updates.push('check_frequency = ?');
          values.push(check_frequency);
        }

        if (requires_authentication !== undefined) {
          updates.push('requires_authentication = ?');
          values.push(requires_authentication);
        }

        if (updates.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'No valid fields to update'
          });
        }

        updates.push('updated_at = NOW()');
        values.push(sourceId);

        await executeQuery(
          `UPDATE sources SET ${updates.join(', ')} WHERE id = ?`,
          values
        );

        // Get updated source
        const updatedSources = await executeQuery(
          `SELECT 
            id, url, name, description, type, categories, tags,
            relevance_score, check_frequency, last_checked, last_updated,
            requires_authentication, active, content_count, error_count,
            last_error, created_at, updated_at
          FROM sources WHERE id = ?`,
          [sourceId]
        );

        const updatedSource = updatedSources[0];
        updatedSource.categories = updatedSource.categories ? JSON.parse(updatedSource.categories) : [];
        updatedSource.tags = updatedSource.tags ? JSON.parse(updatedSource.tags) : [];

        return res.status(200).json({
          success: true,
          data: updatedSource,
          message: 'Source updated successfully'
        });
      }

      if (req.method === 'DELETE') {
        // Soft delete source
        const result = await executeQuery(
          'UPDATE sources SET active = FALSE, updated_at = NOW() WHERE id = ? AND created_by = ?',
          [sourceId, req.user.id]
        );

        if (result.affectedRows === 0) {
          return res.status(404).json({
            success: false,
            error: 'Source not found'
          });
        }

        return res.status(200).json({
          success: true,
          message: 'Source deleted successfully'
        });
      }

      return res.status(405).json({
        success: false,
        error: 'Method not allowed'
      });

    } catch (error) {
      console.error('Source management error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  })(req, res);
}