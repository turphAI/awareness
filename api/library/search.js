/**
 * Library Search API - Serverless function for content and collection search
 * Handles full-text search with advanced filtering and faceted search
 */

import { executeQuery } from '../../lib/database.js';
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
        return await searchContent(req, res, user);
      case 'POST':
        return await advancedSearch(req, res, user);
      default:
        return res.status(405).json({
          success: false,
          error: 'Method not allowed'
        });
    }
  } catch (error) {
    console.error('Search API Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}

/**
 * Search content with full-text search and filtering
 */
async function searchContent(req, res, user) {
  const {
    q: query,
    type,
    categories,
    topics,
    author,
    dateFrom,
    dateTo,
    relevanceMin,
    relevanceMax,
    sortBy = 'relevance',
    sortOrder = 'desc',
    page = 1,
    limit = 20,
    includeOutdated = false,
    searchType = 'content' // 'content' or 'collections'
  } = req.query;

  try {
    if (searchType === 'collections') {
      return await searchCollections(req, res, user);
    }

    let searchQuery = `
      SELECT 
        c.*,
        s.name as source_name,
        s.type as source_type,
        COALESCE(i.interaction_count, 0) as interaction_count,
        COALESCE(i.last_interaction, NULL) as last_interaction,
        MATCH(c.title, c.summary) AGAINST (? IN NATURAL LANGUAGE MODE) as relevance_score_text
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
    let params = [];

    // Add text search parameters
    if (query && query.trim()) {
      params.push(query.trim(), user.id);
      whereConditions.push(`(
        MATCH(c.title, c.summary) AGAINST (? IN NATURAL LANGUAGE MODE) OR
        c.title LIKE ? OR
        c.summary LIKE ? OR
        c.author LIKE ?
      )`);
      const likeQuery = `%${query.trim()}%`;
      params.push(likeQuery, likeQuery, likeQuery);
    } else {
      params.push('', user.id);
    }

    // Outdated filter
    if (!includeOutdated) {
      whereConditions.push('(c.outdated IS NULL OR c.outdated = FALSE)');
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

    // Relevance score filter
    if (relevanceMin !== undefined) {
      whereConditions.push('c.relevance_score >= ?');
      params.push(parseFloat(relevanceMin));
    }
    if (relevanceMax !== undefined) {
      whereConditions.push('c.relevance_score <= ?');
      params.push(parseFloat(relevanceMax));
    }

    if (whereConditions.length > 0) {
      searchQuery += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    // Sorting
    let orderBy;
    const sortDirection = sortOrder.toLowerCase() === 'desc' ? 'DESC' : 'ASC';
    
    switch (sortBy) {
      case 'relevance':
        if (query && query.trim()) {
          orderBy = `relevance_score_text ${sortDirection}, c.relevance_score ${sortDirection}`;
        } else {
          orderBy = `c.relevance_score ${sortDirection}`;
        }
        break;
      case 'date':
        orderBy = `c.publish_date ${sortDirection}`;
        break;
      case 'title':
        orderBy = `c.title ${sortDirection}`;
        break;
      case 'author':
        orderBy = `c.author ${sortDirection}`;
        break;
      case 'interactions':
        orderBy = `interaction_count ${sortDirection}`;
        break;
      default:
        orderBy = `c.relevance_score ${sortDirection}`;
    }

    searchQuery += ` ORDER BY ${orderBy}`;

    // Pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    searchQuery += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const results = await executeQuery(searchQuery, params);

    // Parse JSON fields
    results.forEach(item => {
      item.categories = item.categories ? JSON.parse(item.categories) : [];
      item.topics = item.topics ? JSON.parse(item.topics) : [];
      item.key_insights = item.key_insights ? JSON.parse(item.key_insights) : [];
      item.metadata = item.metadata ? JSON.parse(item.metadata) : {};
    });

    // Get total count
    let countQuery = `
      SELECT COUNT(*) as total
      FROM content c
    `;

    if (whereConditions.length > 0) {
      countQuery += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    // Remove text search and user-specific params for count
    const countParams = params.slice(query && query.trim() ? 4 : 2, -2);
    const [{ total }] = await executeQuery(countQuery, countParams);

    const totalPages = Math.ceil(total / parseInt(limit));

    return res.json({
      success: true,
      data: {
        results,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalCount: parseInt(total),
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1,
          limit: parseInt(limit)
        },
        searchCriteria: {
          query,
          type,
          categories,
          topics,
          author,
          dateFrom,
          dateTo,
          relevanceMin,
          relevanceMax,
          sortBy,
          sortOrder,
          includeOutdated
        }
      }
    });
  } catch (error) {
    console.error('Error searching content:', error);
    throw error;
  }
}

/**
 * Search collections
 */
async function searchCollections(req, res, user) {
  const {
    q: query,
    public: isPublic,
    sortBy = 'name',
    sortOrder = 'asc',
    page = 1,
    limit = 20
  } = req.query;

  try {
    let searchQuery = `
      SELECT 
        c.*,
        u.name as owner_name,
        COUNT(cc.content_id) as content_count,
        MATCH(c.name, c.description) AGAINST (? IN NATURAL LANGUAGE MODE) as relevance_score
      FROM collections c
      LEFT JOIN users u ON c.user_id = u.id
      LEFT JOIN collection_content cc ON c.id = cc.collection_id
    `;

    let whereConditions = [];
    let params = [];

    // Add text search
    if (query && query.trim()) {
      params.push(query.trim());
      whereConditions.push(`(
        MATCH(c.name, c.description) AGAINST (? IN NATURAL LANGUAGE MODE) OR
        c.name LIKE ? OR
        c.description LIKE ?
      )`);
      const likeQuery = `%${query.trim()}%`;
      params.push(likeQuery, likeQuery);
    } else {
      params.push('');
    }

    // Access control
    whereConditions.push(`(
      c.user_id = ? OR 
      c.public = TRUE OR 
      EXISTS (
        SELECT 1 FROM collection_collaborators col 
        WHERE col.collection_id = c.id AND col.user_id = ?
      )
    )`);
    params.push(user.id, user.id);

    // Public filter
    if (isPublic !== undefined) {
      whereConditions.push('c.public = ?');
      params.push(isPublic === 'true');
    }

    if (whereConditions.length > 0) {
      searchQuery += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    searchQuery += ' GROUP BY c.id';

    // Sorting
    let orderBy;
    const sortDirection = sortOrder.toLowerCase() === 'desc' ? 'DESC' : 'ASC';
    
    switch (sortBy) {
      case 'relevance':
        if (query && query.trim()) {
          orderBy = `relevance_score ${sortDirection}`;
        } else {
          orderBy = `c.name ${sortDirection}`;
        }
        break;
      case 'name':
        orderBy = `c.name ${sortDirection}`;
        break;
      case 'created':
        orderBy = `c.created_at ${sortDirection}`;
        break;
      case 'updated':
        orderBy = `c.updated_at ${sortDirection}`;
        break;
      case 'contentCount':
        orderBy = `content_count ${sortDirection}`;
        break;
      default:
        orderBy = `c.name ${sortDirection}`;
    }

    searchQuery += ` ORDER BY ${orderBy}`;

    // Pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    searchQuery += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const results = await executeQuery(searchQuery, params);

    // Parse JSON fields
    results.forEach(item => {
      item.tags = item.tags ? JSON.parse(item.tags) : [];
      item.metadata = item.metadata ? JSON.parse(item.metadata) : {};
    });

    // Get total count
    let countQuery = `
      SELECT COUNT(DISTINCT c.id) as total
      FROM collections c
    `;

    if (whereConditions.length > 0) {
      countQuery += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    const countParams = params.slice(0, -2); // Remove pagination params
    const [{ total }] = await executeQuery(countQuery, countParams);

    const totalPages = Math.ceil(total / parseInt(limit));

    return res.json({
      success: true,
      data: {
        results,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalCount: parseInt(total),
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1,
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Error searching collections:', error);
    throw error;
  }
}

/**
 * Advanced search with complex criteria
 */
async function advancedSearch(req, res, user) {
  const {
    query,
    filters = {},
    facets = false,
    sortBy = 'relevance',
    sortOrder = 'desc',
    page = 1,
    limit = 20
  } = req.body;

  try {
    // Build complex search query based on filters
    let searchQuery = `
      SELECT 
        c.*,
        s.name as source_name,
        s.type as source_type,
        COALESCE(i.interaction_count, 0) as interaction_count
      FROM content c
      LEFT JOIN sources s ON c.source_id = s.id
      LEFT JOIN (
        SELECT 
          content_id,
          COUNT(*) as interaction_count
        FROM interactions
        WHERE user_id = ?
        GROUP BY content_id
      ) i ON c.id = i.content_id
    `;

    let whereConditions = ['c.processed = TRUE'];
    let params = [user.id];

    // Apply filters
    if (query && query.trim()) {
      whereConditions.push(`(
        MATCH(c.title, c.summary) AGAINST (? IN NATURAL LANGUAGE MODE) OR
        c.title LIKE ? OR
        c.summary LIKE ?
      )`);
      const likeQuery = `%${query.trim()}%`;
      params.push(query.trim(), likeQuery, likeQuery);
    }

    // Apply additional filters
    Object.keys(filters).forEach(key => {
      const value = filters[key];
      switch (key) {
        case 'type':
          if (Array.isArray(value)) {
            whereConditions.push(`c.type IN (${value.map(() => '?').join(', ')})`);
            params.push(...value);
          } else {
            whereConditions.push('c.type = ?');
            params.push(value);
          }
          break;
        case 'categories':
          whereConditions.push('JSON_OVERLAPS(c.categories, ?)');
          params.push(JSON.stringify(Array.isArray(value) ? value : [value]));
          break;
        case 'dateRange':
          if (value.from) {
            whereConditions.push('c.publish_date >= ?');
            params.push(value.from);
          }
          if (value.to) {
            whereConditions.push('c.publish_date <= ?');
            params.push(value.to);
          }
          break;
        case 'relevanceRange':
          if (value.min !== undefined) {
            whereConditions.push('c.relevance_score >= ?');
            params.push(value.min);
          }
          if (value.max !== undefined) {
            whereConditions.push('c.relevance_score <= ?');
            params.push(value.max);
          }
          break;
      }
    });

    if (whereConditions.length > 0) {
      searchQuery += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    // Sorting
    const sortDirection = sortOrder.toLowerCase() === 'desc' ? 'DESC' : 'ASC';
    let orderBy = `c.relevance_score ${sortDirection}`;
    
    switch (sortBy) {
      case 'date':
        orderBy = `c.publish_date ${sortDirection}`;
        break;
      case 'title':
        orderBy = `c.title ${sortDirection}`;
        break;
      case 'interactions':
        orderBy = `interaction_count ${sortDirection}`;
        break;
    }

    searchQuery += ` ORDER BY ${orderBy}`;

    // Pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    searchQuery += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const results = await executeQuery(searchQuery, params);

    // Parse JSON fields
    results.forEach(item => {
      item.categories = item.categories ? JSON.parse(item.categories) : [];
      item.topics = item.topics ? JSON.parse(item.topics) : [];
      item.key_insights = item.key_insights ? JSON.parse(item.key_insights) : [];
    });

    let facetData = null;
    if (facets) {
      facetData = await getFacets(whereConditions, params.slice(0, -2));
    }

    return res.json({
      success: true,
      data: {
        results,
        facets: facetData,
        pagination: {
          currentPage: parseInt(page),
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Error in advanced search:', error);
    throw error;
  }
}

/**
 * Get search facets for filtering
 */
async function getFacets(whereConditions, params) {
  try {
    const baseQuery = `FROM content c WHERE ${whereConditions.join(' AND ')}`;

    // Get type facets
    const types = await executeQuery(`
      SELECT c.type, COUNT(*) as count 
      ${baseQuery}
      GROUP BY c.type 
      ORDER BY count DESC
    `, params);

    // Get category facets
    const categories = await executeQuery(`
      SELECT 
        JSON_UNQUOTE(JSON_EXTRACT(c.categories, CONCAT('$[', numbers.n, ']'))) as category,
        COUNT(*) as count
      ${baseQuery}
      CROSS JOIN (
        SELECT 0 as n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4
      ) numbers
      WHERE JSON_EXTRACT(c.categories, CONCAT('$[', numbers.n, ']')) IS NOT NULL
      GROUP BY category
      ORDER BY count DESC
      LIMIT 20
    `, params);

    // Get author facets
    const authors = await executeQuery(`
      SELECT c.author, COUNT(*) as count 
      ${baseQuery}
      AND c.author IS NOT NULL
      GROUP BY c.author 
      ORDER BY count DESC
      LIMIT 20
    `, params);

    return {
      types,
      categories,
      authors
    };
  } catch (error) {
    console.error('Error getting facets:', error);
    return null;
  }
}