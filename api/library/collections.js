/**
 * Collections API - Serverless function for collection management
 * Handles CRUD operations for user collections
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
      case 'GET':
        return await getCollections(req, res, user);
      case 'POST':
        return await createCollection(req, res, user);
      default:
        return res.status(405).json({
          success: false,
          error: 'Method not allowed'
        });
    }
  } catch (error) {
    console.error('Collections API Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}

/**
 * Get user collections with optional filtering and pagination
 */
async function getCollections(req, res, user) {
  const {
    includeCollaborated = false,
    sortBy = 'name',
    sortOrder = 'asc',
    limit = 50,
    offset = 0,
    public: isPublic
  } = req.query;

  try {
    let query = `
      SELECT 
        c.*,
        COUNT(cc.content_id) as content_count,
        u.name as owner_name
      FROM collections c
      LEFT JOIN collection_content cc ON c.id = cc.collection_id
      LEFT JOIN users u ON c.user_id = u.id
    `;
    
    let whereConditions = [];
    let params = [];

    // Base condition - user's own collections
    if (includeCollaborated === 'true') {
      whereConditions.push(`(c.user_id = ? OR EXISTS (
        SELECT 1 FROM collection_collaborators col 
        WHERE col.collection_id = c.id AND col.user_id = ?
      ))`);
      params.push(user.id, user.id);
    } else {
      whereConditions.push('c.user_id = ?');
      params.push(user.id);
    }

    // Public filter
    if (isPublic !== undefined) {
      whereConditions.push('c.public = ?');
      params.push(isPublic === 'true');
    }

    if (whereConditions.length > 0) {
      query += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    query += ' GROUP BY c.id';

    // Sorting
    const validSortFields = ['name', 'created_at', 'updated_at', 'content_count'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'name';
    const sortDirection = sortOrder.toLowerCase() === 'desc' ? 'DESC' : 'ASC';
    
    query += ` ORDER BY ${sortField} ${sortDirection}`;

    // Pagination
    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const collections = await executeQuery(query, params);

    // Get total count
    let countQuery = `
      SELECT COUNT(DISTINCT c.id) as total
      FROM collections c
    `;
    
    if (whereConditions.length > 0) {
      countQuery += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    const countParams = params.slice(0, -2); // Remove limit and offset
    const [{ total }] = await executeQuery(countQuery, countParams);

    return res.json({
      success: true,
      data: {
        collections,
        pagination: {
          total: parseInt(total),
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: parseInt(total) > parseInt(offset) + parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Error getting collections:', error);
    throw error;
  }
}

/**
 * Create a new collection
 */
async function createCollection(req, res, user) {
  const {
    name,
    description,
    public: isPublic = false,
    color = '#3498db',
    icon = 'folder',
    tags = [],
    parent_id = null
  } = req.body;

  // Validation
  if (!name || name.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Collection name is required'
    });
  }

  if (name.length > 100) {
    return res.status(400).json({
      success: false,
      error: 'Collection name cannot exceed 100 characters'
    });
  }

  try {
    // Check if collection with same name already exists for this user
    const existingCollection = await executeQuery(
      'SELECT id FROM collections WHERE user_id = ? AND name = ?',
      [user.id, name.trim()]
    );

    if (existingCollection.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Collection with this name already exists'
      });
    }

    // Create collection
    const result = await executeQuery(`
      INSERT INTO collections (
        user_id, name, description, public, color, icon, tags, parent_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      user.id,
      name.trim(),
      description?.trim() || null,
      isPublic,
      color,
      icon,
      JSON.stringify(tags),
      parent_id
    ]);

    // Get the created collection
    const [collection] = await executeQuery(`
      SELECT 
        c.*,
        0 as content_count,
        u.name as owner_name
      FROM collections c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `, [result.insertId]);

    return res.status(201).json({
      success: true,
      message: 'Collection created successfully',
      data: collection
    });
  } catch (error) {
    console.error('Error creating collection:', error);
    throw error;
  }
}