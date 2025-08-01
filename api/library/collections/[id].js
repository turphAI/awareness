/**
 * Individual Collection API - Serverless function for single collection operations
 * Handles GET, PUT, DELETE operations for specific collections
 */

import { executeQuery, executeTransaction } from '../../../lib/database.js';
import { authenticate } from '../../../lib/auth.js';

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

    const { method, query } = req;
    const collectionId = query.id;

    if (!collectionId) {
      return res.status(400).json({
        success: false,
        error: 'Collection ID is required'
      });
    }

    switch (method) {
      case 'GET':
        return await getCollection(req, res, user, collectionId);
      case 'PUT':
        return await updateCollection(req, res, user, collectionId);
      case 'DELETE':
        return await deleteCollection(req, res, user, collectionId);
      default:
        return res.status(405).json({
          success: false,
          error: 'Method not allowed'
        });
    }
  } catch (error) {
    console.error('Collection API Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}

/**
 * Get a specific collection with content and collaborators
 */
async function getCollection(req, res, user, collectionId) {
  try {
    // Get collection with owner info
    const [collection] = await executeQuery(`
      SELECT 
        c.*,
        u.name as owner_name,
        u.email as owner_email
      FROM collections c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `, [collectionId]);

    if (!collection) {
      return res.status(404).json({
        success: false,
        error: 'Collection not found'
      });
    }

    // Check access permissions
    const hasAccess = await checkCollectionAccess(user.id, collectionId, collection);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this collection'
      });
    }

    // Get collection content
    const content = await executeQuery(`
      SELECT 
        c.id,
        c.title,
        c.url,
        c.author,
        c.publish_date,
        c.type,
        c.summary,
        c.relevance_score,
        cc.added_at
      FROM collection_content cc
      JOIN content c ON cc.content_id = c.id
      WHERE cc.collection_id = ?
      ORDER BY cc.added_at DESC
    `, [collectionId]);

    // Get collaborators
    const collaborators = await executeQuery(`
      SELECT 
        col.role,
        col.added_at,
        u.id as user_id,
        u.name,
        u.email
      FROM collection_collaborators col
      JOIN users u ON col.user_id = u.id
      WHERE col.collection_id = ?
      ORDER BY col.added_at ASC
    `, [collectionId]);

    // Record view if user is not the owner
    if (collection.user_id !== user.id) {
      await executeQuery(`
        UPDATE collections 
        SET view_count = view_count + 1, last_viewed = NOW()
        WHERE id = ?
      `, [collectionId]);
    }

    // Parse JSON fields
    collection.tags = collection.tags ? JSON.parse(collection.tags) : [];
    collection.metadata = collection.metadata ? JSON.parse(collection.metadata) : {};

    return res.json({
      success: true,
      data: {
        ...collection,
        content,
        collaborators
      }
    });
  } catch (error) {
    console.error('Error getting collection:', error);
    throw error;
  }
}

/**
 * Update a collection
 */
async function updateCollection(req, res, user, collectionId) {
  const {
    name,
    description,
    public: isPublic,
    color,
    icon,
    tags,
    metadata
  } = req.body;

  try {
    // Get collection and check permissions
    const [collection] = await executeQuery(
      'SELECT * FROM collections WHERE id = ?',
      [collectionId]
    );

    if (!collection) {
      return res.status(404).json({
        success: false,
        error: 'Collection not found'
      });
    }

    const canUpdate = await checkCollectionPermission(user.id, collectionId, ['owner', 'editor', 'admin']);
    if (!canUpdate) {
      return res.status(403).json({
        success: false,
        error: 'Permission denied to update this collection'
      });
    }

    // Check for name conflicts if name is being updated
    if (name && name !== collection.name) {
      const existingCollection = await executeQuery(`
        SELECT id FROM collections 
        WHERE user_id = ? AND name = ? AND id != ?
      `, [collection.user_id, name.trim(), collectionId]);

      if (existingCollection.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'Collection with this name already exists'
        });
      }
    }

    // Build update query
    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name.trim());
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description?.trim() || null);
    }
    if (isPublic !== undefined) {
      updates.push('public = ?');
      params.push(isPublic);
    }
    if (color !== undefined) {
      updates.push('color = ?');
      params.push(color);
    }
    if (icon !== undefined) {
      updates.push('icon = ?');
      params.push(icon);
    }
    if (tags !== undefined) {
      updates.push('tags = ?');
      params.push(JSON.stringify(tags));
    }
    if (metadata !== undefined) {
      updates.push('metadata = ?');
      params.push(JSON.stringify(metadata));
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields to update'
      });
    }

    updates.push('updated_at = NOW()');
    params.push(collectionId);

    await executeQuery(`
      UPDATE collections 
      SET ${updates.join(', ')}
      WHERE id = ?
    `, params);

    // Get updated collection
    const [updatedCollection] = await executeQuery(`
      SELECT 
        c.*,
        u.name as owner_name
      FROM collections c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `, [collectionId]);

    // Parse JSON fields
    updatedCollection.tags = updatedCollection.tags ? JSON.parse(updatedCollection.tags) : [];
    updatedCollection.metadata = updatedCollection.metadata ? JSON.parse(updatedCollection.metadata) : {};

    return res.json({
      success: true,
      message: 'Collection updated successfully',
      data: updatedCollection
    });
  } catch (error) {
    console.error('Error updating collection:', error);
    throw error;
  }
}

/**
 * Delete a collection
 */
async function deleteCollection(req, res, user, collectionId) {
  try {
    // Get collection and check ownership
    const [collection] = await executeQuery(
      'SELECT user_id FROM collections WHERE id = ?',
      [collectionId]
    );

    if (!collection) {
      return res.status(404).json({
        success: false,
        error: 'Collection not found'
      });
    }

    // Only owner can delete collection
    if (collection.user_id !== user.id) {
      return res.status(403).json({
        success: false,
        error: 'Only collection owner can delete the collection'
      });
    }

    // Delete collection and related data in transaction
    await executeTransaction([
      {
        query: 'DELETE FROM collection_collaborators WHERE collection_id = ?',
        params: [collectionId]
      },
      {
        query: 'DELETE FROM collection_content WHERE collection_id = ?',
        params: [collectionId]
      },
      {
        query: 'DELETE FROM collections WHERE id = ?',
        params: [collectionId]
      }
    ]);

    return res.json({
      success: true,
      message: 'Collection deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting collection:', error);
    throw error;
  }
}

/**
 * Check if user has access to collection
 */
async function checkCollectionAccess(userId, collectionId, collection = null) {
  if (!collection) {
    const [col] = await executeQuery(
      'SELECT user_id, public FROM collections WHERE id = ?',
      [collectionId]
    );
    collection = col;
  }

  if (!collection) return false;

  // Owner has access
  if (collection.user_id === userId) return true;

  // Public collections are accessible
  if (collection.public) return true;

  // Check if user is a collaborator
  const [collaborator] = await executeQuery(`
    SELECT role FROM collection_collaborators 
    WHERE collection_id = ? AND user_id = ?
  `, [collectionId, userId]);

  return !!collaborator;
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