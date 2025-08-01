/**
 * Library Content API - Serverless function for content management in collections
 * Handles adding/removing content from collections and content operations
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
        return await manageCollectionContent(req, res, user);
      case 'GET':
        return await getContent(req, res, user);
      default:
        return res.status(405).json({
          success: false,
          error: 'Method not allowed'
        });
    }
  } catch (error) {
    console.error('Library Content API Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}

/**
 * Get content with optional filtering
 */
async function getContent(req, res, user) {
  const {
    collectionId,
    type,
    categories,
    topics,
    author,
    dateFrom,
    dateTo,
    sortBy = 'publish_date',
    sortOrder = 'desc',
    limit = 20,
    offset = 0
  } = req.query;

  try {
    let query = `
      SELECT 
        c.*,
        s.name as source_name,
        s.type as source_type,
        COALESCE(i.interaction_count, 0) as interaction_count,
        COALESCE(i.last_interaction, NULL) as last_interaction
      FROM content c
      LEFT JOIN sources s ON c.source_id = s.id
      LEFT JOIN (
        SELECT 
          content_id,
          COUNT(*) as interaction_count,
          MAX(created_at) as last_interaction
        FROM interactions
        WHERE user_id = ?
        GROUP BY content_id
      ) i ON c.id = i.content_id
    `;

    let whereConditions = ['c.processed = TRUE'];
    let params = [user.id];

    // Collection filter
    if (collectionId) {
      query = `
        SELECT 
          c.*,
          s.name as source_name,
          s.type as source_type,
          cc.added_at as added_to_collection,
          COALESCE(i.interaction_count, 0) as interaction_count,
          COALESCE(i.last_interaction, NULL) as last_interaction
        FROM collection_content cc
        JOIN content c ON cc.content_id = c.id
        LEFT JOIN sources s ON c.source_id = s.id
        LEFT JOIN (
          SELECT 
            content_id,
            COUNT(*) as interaction_count,
            MAX(created_at) as last_interaction
          FROM interactions
          WHERE user_id = ?
          GROUP BY content_id
        ) i ON c.id = i.content_id
      `;
      whereConditions.push('cc.collection_id = ?');
      params.push(collectionId);
    }

    // Type filter
    if (type) {
      const types = Array.isArray(type) ? type : [type];
      whereConditions.push(`c.type IN (${types.map(() => '?').join(', ')})`);
      params.push(...types);
    }

    // Categories filter
    if (categories) {
      const categoryList = Array.isArray(categories) ? categories : [categories];
      whereConditions.push(`JSON_OVERLAPS(c.categories, ?)`);
      params.push(JSON.stringify(categoryList));
    }

    // Topics filter
    if (topics) {
      const topicList = Array.isArray(topics) ? topics : [topics];
      whereConditions.push(`JSON_OVERLAPS(c.topics, ?)`);
      params.push(JSON.stringify(topicList));
    }

    // Author filter
    if (author) {
      whereConditions.push('c.author LIKE ?');
      params.push(`%${author}%`);
    }

    // Date range filter
    if (dateFrom) {
      whereConditions.push('c.publish_date >= ?');
      params.push(dateFrom);
    }
    if (dateTo) {
      whereConditions.push('c.publish_date <= ?');
      params.push(dateTo);
    }

    if (whereConditions.length > 0) {
      query += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    // Sorting
    const validSortFields = ['publish_date', 'discovery_date', 'title', 'relevance_score', 'added_to_collection'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'publish_date';
    const sortDirection = sortOrder.toLowerCase() === 'desc' ? 'DESC' : 'ASC';
    
    query += ` ORDER BY c.${sortField} ${sortDirection}`;

    // Pagination
    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const content = await executeQuery(query, params);

    // Parse JSON fields
    content.forEach(item => {
      item.categories = item.categories ? JSON.parse(item.categories) : [];
      item.topics = item.topics ? JSON.parse(item.topics) : [];
      item.key_insights = item.key_insights ? JSON.parse(item.key_insights) : [];
      item.metadata = item.metadata ? JSON.parse(item.metadata) : {};
    });

    // Get total count
    let countQuery = `SELECT COUNT(*) as total FROM content c`;
    let countParams = [];

    if (collectionId) {
      countQuery = `
        SELECT COUNT(*) as total 
        FROM collection_content cc
        JOIN content c ON cc.content_id = c.id
      `;
    }

    const countConditions = whereConditions.filter(condition => 
      !condition.includes('interaction_count') && !condition.includes('last_interaction')
    );
    
    if (countConditions.length > 0) {
      countQuery += ` WHERE ${countConditions.join(' AND ')}`;
      countParams = params.slice(1, -2); // Remove user.id and pagination params
      if (collectionId) {
        countParams = [collectionId, ...countParams.slice(1)];
      }
    }

    const [{ total }] = await executeQuery(countQuery, countParams);

    return res.json({
      success: true,
      data: {
        content,
        pagination: {
          total: parseInt(total),
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: parseInt(total) > parseInt(offset) + parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Error getting content:', error);
    throw error;
  }
}

/**
 * Manage collection content (add/remove)
 */
async function manageCollectionContent(req, res, user) {
  const { action, collectionId, contentIds } = req.body;

  if (!action || !collectionId || !contentIds || !Array.isArray(contentIds)) {
    return res.status(400).json({
      success: false,
      error: 'Action, collectionId, and contentIds array are required'
    });
  }

  if (!['add', 'remove'].includes(action)) {
    return res.status(400).json({
      success: false,
      error: 'Action must be "add" or "remove"'
    });
  }

  try {
    // Check collection permissions
    const canModify = await checkCollectionPermission(user.id, collectionId, ['owner', 'editor', 'admin']);
    if (!canModify) {
      return res.status(403).json({
        success: false,
        error: 'Permission denied to modify this collection'
      });
    }

    if (action === 'add') {
      return await addContentToCollection(req, res, user, collectionId, contentIds);
    } else {
      return await removeContentFromCollection(req, res, user, collectionId, contentIds);
    }
  } catch (error) {
    console.error('Error managing collection content:', error);
    throw error;
  }
}

/**
 * Add content to collection
 */
async function addContentToCollection(req, res, user, collectionId, contentIds) {
  try {
    // Verify content exists
    const existingContent = await executeQuery(`
      SELECT id FROM content WHERE id IN (${contentIds.map(() => '?').join(', ')})
    `, contentIds);

    const existingIds = existingContent.map(c => c.id);
    const missingIds = contentIds.filter(id => !existingIds.includes(parseInt(id)));

    if (missingIds.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Content not found: ${missingIds.join(', ')}`
      });
    }

    // Check which content is already in collection
    const alreadyInCollection = await executeQuery(`
      SELECT content_id FROM collection_content 
      WHERE collection_id = ? AND content_id IN (${contentIds.map(() => '?').join(', ')})
    `, [collectionId, ...contentIds]);

    const alreadyInIds = alreadyInCollection.map(c => c.content_id);
    const newContentIds = contentIds.filter(id => !alreadyInIds.includes(parseInt(id)));

    if (newContentIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'All content is already in the collection'
      });
    }

    // Add new content to collection
    const insertQueries = newContentIds.map(contentId => ({
      query: 'INSERT INTO collection_content (collection_id, content_id) VALUES (?, ?)',
      params: [collectionId, contentId]
    }));

    await executeTransaction(insertQueries);

    return res.json({
      success: true,
      message: `Added ${newContentIds.length} items to collection`,
      data: {
        added: newContentIds,
        skipped: alreadyInIds
      }
    });
  } catch (error) {
    console.error('Error adding content to collection:', error);
    throw error;
  }
}

/**
 * Remove content from collection
 */
async function removeContentFromCollection(req, res, user, collectionId, contentIds) {
  try {
    const result = await executeQuery(`
      DELETE FROM collection_content 
      WHERE collection_id = ? AND content_id IN (${contentIds.map(() => '?').join(', ')})
    `, [collectionId, ...contentIds]);

    return res.json({
      success: true,
      message: `Removed ${result.affectedRows} items from collection`,
      data: {
        removed: result.affectedRows
      }
    });
  } catch (error) {
    console.error('Error removing content from collection:', error);
    throw error;
  }
}

/**
 * Check if user has specific permissions on collection
 */
async function checkCollectionPermission(userId, collectionId, allowedRoles = []) {
  const [collection] = await executeQuery(
    'SELECT user_id FROM collections WHERE id = ?',
    [collectionId]
  );

  if (!collection) return false;

  // Owner has all permissions
  if (collection.user_id === userId && allowedRoles.includes('owner')) {
    return true;
  }

  // Check collaborator permissions
  const [collaborator] = await executeQuery(`
    SELECT role FROM collection_collaborators 
    WHERE collection_id = ? AND user_id = ?
  `, [collectionId, userId]);

  return collaborator && allowedRoles.includes(collaborator.role);
}