/**
 * Interactions API - Serverless function for tracking user interactions with content
 * Handles recording and retrieving user interaction data for analytics
 */

import { executeQuery, executeTransaction } from '../../lib/database.js';
import { authenticate } from '../../lib/auth.js';

export default async function handler(req, res) {
  try {
    // Authentication
    const user = await authenticate(req);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    const { method } = req;

    switch (method) {
      case 'POST':
        return await recordInteraction(req, res, user);
      case 'GET':
        return await getInteractions(req, res, user);
      default:
        return res.status(405).json({
          success: false,
          error: 'Method not allowed'
        });
    }
  } catch (error) {
    console.error('Interactions API Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}

/**
 * Record a user interaction with content
 */
async function recordInteraction(req, res, user) {
  const {
    contentId,
    type,
    duration,
    value,
    metadata = {}
  } = req.body;

  // Validation
  if (!contentId || !type) {
    return res.status(400).json({
      success: false,
      error: 'contentId and type are required'
    });
  }

  const validTypes = ['view', 'like', 'save', 'share', 'comment', 'rate'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({
      success: false,
      error: `Invalid interaction type. Must be one of: ${validTypes.join(', ')}`
    });
  }

  try {
    // Verify content exists
    const [content] = await executeQuery(
      'SELECT id FROM content WHERE id = ?',
      [contentId]
    );

    if (!content) {
      return res.status(404).json({
        success: false,
        error: 'Content not found'
      });
    }

    // Record interaction
    const result = await executeQuery(`
      INSERT INTO interactions (user_id, content_id, type, duration, value)
      VALUES (?, ?, ?, ?, ?)
    `, [
      user.id,
      contentId,
      type,
      duration || null,
      value || null
    ]);

    // Update content interaction counts (for caching)
    await executeQuery(`
      UPDATE content 
      SET 
        view_count = COALESCE(view_count, 0) + CASE WHEN ? = 'view' THEN 1 ELSE 0 END,
        like_count = COALESCE(like_count, 0) + CASE WHEN ? = 'like' THEN 1 ELSE 0 END,
        save_count = COALESCE(save_count, 0) + CASE WHEN ? = 'save' THEN 1 ELSE 0 END,
        share_count = COALESCE(share_count, 0) + CASE WHEN ? = 'share' THEN 1 ELSE 0 END
      WHERE id = ?
    `, [type, type, type, type, contentId]);

    return res.status(201).json({
      success: true,
      message: 'Interaction recorded successfully',
      data: {
        id: result.insertId,
        contentId,
        type,
        duration,
        value,
        timestamp: new Date()
      }
    });
  } catch (error) {
    console.error('Error recording interaction:', error);
    throw error;
  }
}

/**
 * Get user interactions with optional filtering
 */
async function getInteractions(req, res, user) {
  const {
    contentId,
    type,
    dateFrom,
    dateTo,
    limit = 50,
    offset = 0,
    analytics = false
  } = req.query;

  try {
    if (analytics === 'true') {
      return await getInteractionAnalytics(req, res, user);
    }

    let query = `
      SELECT 
        i.*,
        c.title as content_title,
        c.url as content_url,
        c.type as content_type
      FROM interactions i
      LEFT JOIN content c ON i.content_id = c.id
      WHERE i.user_id = ?
    `;

    let params = [user.id];

    // Content filter
    if (contentId) {
      query += ' AND i.content_id = ?';
      params.push(contentId);
    }

    // Type filter
    if (type) {
      const types = Array.isArray(type) ? type : [type];
      query += ` AND i.type IN (${types.map(() => '?').join(', ')})`;
      params.push(...types);
    }

    // Date range filter
    if (dateFrom) {
      query += ' AND i.created_at >= ?';
      params.push(dateFrom);
    }
    if (dateTo) {
      query += ' AND i.created_at <= ?';
      params.push(dateTo);
    }

    query += ' ORDER BY i.created_at DESC';

    // Pagination
    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const interactions = await executeQuery(query, params);

    // Get total count
    let countQuery = `
      SELECT COUNT(*) as total
      FROM interactions i
      WHERE i.user_id = ?
    `;

    let countParams = [user.id];

    if (contentId) {
      countQuery += ' AND i.content_id = ?';
      countParams.push(contentId);
    }

    if (type) {
      const types = Array.isArray(type) ? type : [type];
      countQuery += ` AND i.type IN (${types.map(() => '?').join(', ')})`;
      countParams.push(...types);
    }

    if (dateFrom) {
      countQuery += ' AND i.created_at >= ?';
      countParams.push(dateFrom);
    }
    if (dateTo) {
      countQuery += ' AND i.created_at <= ?';
      countParams.push(dateTo);
    }

    const [{ total }] = await executeQuery(countQuery, countParams);

    return res.json({
      success: true,
      data: {
        interactions,
        pagination: {
          total: parseInt(total),
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: parseInt(total) > parseInt(offset) + parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Error getting interactions:', error);
    throw error;
  }
}

/**
 * Get interaction analytics and statistics
 */
async function getInteractionAnalytics(req, res, user) {
  const {
    period = '30d', // '7d', '30d', '90d', '1y'
    contentId
  } = req.query;

  try {
    // Calculate date range
    let dateFrom;
    switch (period) {
      case '7d':
        dateFrom = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        dateFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        dateFrom = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        dateFrom = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        dateFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    let baseCondition = 'WHERE i.user_id = ? AND i.created_at >= ?';
    let baseParams = [user.id, dateFrom.toISOString()];

    if (contentId) {
      baseCondition += ' AND i.content_id = ?';
      baseParams.push(contentId);
    }

    // Get interaction counts by type
    const interactionCounts = await executeQuery(`
      SELECT 
        i.type,
        COUNT(*) as count,
        AVG(i.duration) as avg_duration
      FROM interactions i
      ${baseCondition}
      GROUP BY i.type
      ORDER BY count DESC
    `, baseParams);

    // Get daily interaction trends
    const dailyTrends = await executeQuery(`
      SELECT 
        DATE(i.created_at) as date,
        i.type,
        COUNT(*) as count
      FROM interactions i
      ${baseCondition}
      GROUP BY DATE(i.created_at), i.type
      ORDER BY date DESC, type
    `, baseParams);

    // Get most interacted content
    const topContent = await executeQuery(`
      SELECT 
        c.id,
        c.title,
        c.url,
        c.type as content_type,
        COUNT(i.id) as interaction_count,
        COUNT(DISTINCT i.type) as interaction_types
      FROM interactions i
      JOIN content c ON i.content_id = c.id
      ${baseCondition}
      GROUP BY c.id, c.title, c.url, c.type
      ORDER BY interaction_count DESC
      LIMIT 10
    `, baseParams);

    // Get reading patterns (for view interactions)
    const readingPatterns = await executeQuery(`
      SELECT 
        HOUR(i.created_at) as hour,
        COUNT(*) as count,
        AVG(i.duration) as avg_duration
      FROM interactions i
      ${baseCondition} AND i.type = 'view'
      GROUP BY HOUR(i.created_at)
      ORDER BY hour
    `, baseParams);

    // Get content type preferences
    const contentTypePreferences = await executeQuery(`
      SELECT 
        c.type as content_type,
        COUNT(i.id) as interaction_count,
        AVG(i.duration) as avg_duration
      FROM interactions i
      JOIN content c ON i.content_id = c.id
      ${baseCondition}
      GROUP BY c.type
      ORDER BY interaction_count DESC
    `, baseParams);

    // Calculate summary statistics
    const [summary] = await executeQuery(`
      SELECT 
        COUNT(*) as total_interactions,
        COUNT(DISTINCT i.content_id) as unique_content,
        COUNT(DISTINCT DATE(i.created_at)) as active_days,
        AVG(i.duration) as avg_session_duration,
        SUM(CASE WHEN i.type = 'view' THEN 1 ELSE 0 END) as total_views,
        SUM(CASE WHEN i.type = 'save' THEN 1 ELSE 0 END) as total_saves,
        SUM(CASE WHEN i.type = 'share' THEN 1 ELSE 0 END) as total_shares,
        SUM(CASE WHEN i.type = 'like' THEN 1 ELSE 0 END) as total_likes
      FROM interactions i
      ${baseCondition}
    `, baseParams);

    return res.json({
      success: true,
      data: {
        period,
        summary,
        interactionCounts,
        dailyTrends,
        topContent,
        readingPatterns,
        contentTypePreferences
      }
    });
  } catch (error) {
    console.error('Error getting interaction analytics:', error);
    throw error;
  }
}