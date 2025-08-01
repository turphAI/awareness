const { executeQuery } = require('../../lib/database');
const { 
  handleCors, 
  requireAuth
} = require('../../lib/auth');

// Sources management endpoint for Vercel deployment
export default async function handler(req, res) {
  // Handle CORS
  if (handleCors(req, res)) return;

  // Require authentication for all source operations
  return requireAuth(async (req, res) => {
    try {
      if (req.method === 'GET') {
        // Get all sources for the authenticated user
        const sources = await executeQuery(
          `SELECT 
            id, url, name, description, type, categories, tags,
            relevance_score, check_frequency, last_checked, last_updated,
            requires_authentication, active, content_count, error_count,
            last_error, created_at, updated_at
          FROM sources 
          WHERE created_by = ? AND active = TRUE
          ORDER BY name ASC`,
          [req.user.id]
        );

        // Parse JSON fields
        const parsedSources = sources.map(source => ({
          ...source,
          categories: source.categories ? JSON.parse(source.categories) : [],
          tags: source.tags ? JSON.parse(source.tags) : []
        }));

        return res.status(200).json({
          success: true,
          data: parsedSources
        });
      }

      if (req.method === 'POST') {
        const { 
          name, url, description, type, categories, tags,
          relevance_score, check_frequency, requires_authentication
        } = req.body;

        // Validation
        if (!name || !url || !type) {
          return res.status(400).json({
            success: false,
            error: 'Name, URL, and type are required'
          });
        }

        // Validate URL format
        try {
          new URL(url);
        } catch (error) {
          return res.status(400).json({
            success: false,
            error: 'Invalid URL format'
          });
        }

        // Validate type
        const validTypes = ['website', 'blog', 'academic', 'podcast', 'social', 'newsletter', 'rss'];
        if (!validTypes.includes(type)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid source type'
          });
        }

        // Check if source with same URL already exists for this user
        const existingSources = await executeQuery(
          'SELECT id FROM sources WHERE url = ? AND created_by = ? AND active = TRUE',
          [url, req.user.id]
        );

        if (existingSources.length > 0) {
          return res.status(409).json({
            success: false,
            error: 'Source with this URL already exists'
          });
        }

        // Create new source
        const result = await executeQuery(
          `INSERT INTO sources (
            url, name, description, type, categories, tags,
            relevance_score, check_frequency, requires_authentication,
            created_by, discovery_date, active, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), TRUE, NOW())`,
          [
            url,
            name.trim(),
            description || null,
            type,
            JSON.stringify(categories || []),
            JSON.stringify(tags || []),
            relevance_score || 0.5,
            check_frequency || 'daily',
            requires_authentication || false,
            req.user.id
          ]
        );

        // Get the created source
        const createdSources = await executeQuery(
          `SELECT 
            id, url, name, description, type, categories, tags,
            relevance_score, check_frequency, requires_authentication,
            active, created_at
          FROM sources WHERE id = ?`,
          [result.insertId]
        );

        const createdSource = createdSources[0];
        createdSource.categories = createdSource.categories ? JSON.parse(createdSource.categories) : [];
        createdSource.tags = createdSource.tags ? JSON.parse(createdSource.tags) : [];

        return res.status(201).json({
          success: true,
          data: createdSource,
          message: 'Source created successfully'
        });
      }

      return res.status(405).json({
        success: false,
        error: 'Method not allowed'
      });

    } catch (error) {
      console.error('Sources API error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  })(req, res);
}