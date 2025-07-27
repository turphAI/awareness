const Content = require('../../content-discovery/models/Content');
const Collection = require('../models/Collection');
const { validationResult } = require('express-validator');

/**
 * Search Controller
 * Handles search functionality for the library management service
 */
class SearchController {
  /**
   * Search content with full-text search and advanced filtering
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async searchContent(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const {
        query,
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
        includeOutdated = false
      } = req.query;

      // Build search criteria
      const searchCriteria = {
        processed: true
      };

      // Add outdated filter
      if (!includeOutdated) {
        searchCriteria.outdated = { $ne: true };
      }

      // Full-text search
      if (query) {
        searchCriteria.$or = [
          { title: { $regex: query, $options: 'i' } },
          { summary: { $regex: query, $options: 'i' } },
          { fullText: { $regex: query, $options: 'i' } },
          { keyInsights: { $elemMatch: { $regex: query, $options: 'i' } } },
          { author: { $regex: query, $options: 'i' } }
        ];
      }

      // Type filter
      if (type) {
        const types = Array.isArray(type) ? type : [type];
        searchCriteria.type = { $in: types };
      }

      // Categories filter
      if (categories) {
        const categoryList = Array.isArray(categories) ? categories : [categories];
        searchCriteria.categories = { $in: categoryList };
      }

      // Topics filter
      if (topics) {
        const topicList = Array.isArray(topics) ? topics : [topics];
        searchCriteria.topics = { $in: topicList };
      }

      // Author filter
      if (author && !query) {
        searchCriteria.author = { $regex: author, $options: 'i' };
      }

      // Date range filter
      if (dateFrom || dateTo) {
        searchCriteria.publishDate = {};
        if (dateFrom) {
          searchCriteria.publishDate.$gte = new Date(dateFrom);
        }
        if (dateTo) {
          searchCriteria.publishDate.$lte = new Date(dateTo);
        }
      }

      // Relevance score filter
      if (relevanceMin !== undefined || relevanceMax !== undefined) {
        searchCriteria.relevanceScore = {};
        if (relevanceMin !== undefined) {
          searchCriteria.relevanceScore.$gte = parseFloat(relevanceMin);
        }
        if (relevanceMax !== undefined) {
          searchCriteria.relevanceScore.$lte = parseFloat(relevanceMax);
        }
      }

      // Build sort criteria
      const sortCriteria = {};
      switch (sortBy) {
        case 'relevance':
          sortCriteria.relevanceScore = sortOrder === 'asc' ? 1 : -1;
          break;
        case 'date':
          sortCriteria.publishDate = sortOrder === 'asc' ? 1 : -1;
          break;
        case 'title':
          sortCriteria.title = sortOrder === 'asc' ? 1 : -1;
          break;
        case 'author':
          sortCriteria.author = sortOrder === 'asc' ? 1 : -1;
          break;
        case 'readCount':
          sortCriteria.readCount = sortOrder === 'asc' ? 1 : -1;
          break;
        case 'saveCount':
          sortCriteria.saveCount = sortOrder === 'asc' ? 1 : -1;
          break;
        case 'quality':
          sortCriteria.qualityScore = sortOrder === 'asc' ? 1 : -1;
          break;
        default:
          sortCriteria.relevanceScore = -1;
      }

      // Calculate pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Execute search
      const [results, totalCount] = await Promise.all([
        Content.find(searchCriteria)
          .sort(sortCriteria)
          .skip(skip)
          .limit(parseInt(limit))
          .populate('sourceId', 'name url type')
          .populate('references', 'title url referenceType')
          .select('-fullText -processingHistory'), // Exclude large fields
        Content.countDocuments(searchCriteria)
      ]);

      // Calculate pagination info
      const totalPages = Math.ceil(totalCount / parseInt(limit));
      const hasNextPage = parseInt(page) < totalPages;
      const hasPrevPage = parseInt(page) > 1;

      res.json({
        success: true,
        data: {
          results,
          pagination: {
            currentPage: parseInt(page),
            totalPages,
            totalCount,
            hasNextPage,
            hasPrevPage,
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
      req.app.locals.logger.error('Error searching content:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Get search suggestions based on partial query
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getSearchSuggestions(req, res) {
    try {
      const { query, limit = 10 } = req.query;

      if (!query || query.length < 2) {
        return res.json({
          success: true,
          data: {
            suggestions: []
          }
        });
      }

      // Get title suggestions
      const titleSuggestions = await Content.find({
        title: { $regex: query, $options: 'i' },
        processed: true,
        outdated: { $ne: true }
      })
        .select('title')
        .limit(parseInt(limit) / 2)
        .lean();

      // Get author suggestions
      const authorSuggestions = await Content.find({
        author: { $regex: query, $options: 'i' },
        processed: true,
        outdated: { $ne: true }
      })
        .select('author')
        .limit(parseInt(limit) / 2)
        .lean();

      // Get topic suggestions
      const topicSuggestions = await Content.aggregate([
        { $match: { processed: true, outdated: { $ne: true } } },
        { $unwind: '$topics' },
        { $match: { topics: { $regex: query, $options: 'i' } } },
        { $group: { _id: '$topics', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: parseInt(limit) / 2 }
      ]);

      const suggestions = [
        ...titleSuggestions.map(item => ({
          type: 'title',
          value: item.title,
          label: item.title
        })),
        ...authorSuggestions.map(item => ({
          type: 'author',
          value: item.author,
          label: `Author: ${item.author}`
        })),
        ...topicSuggestions.map(item => ({
          type: 'topic',
          value: item._id,
          label: `Topic: ${item._id} (${item.count})`
        }))
      ];

      res.json({
        success: true,
        data: {
          suggestions: suggestions.slice(0, parseInt(limit))
        }
      });

    } catch (error) {
      req.app.locals.logger.error('Error getting search suggestions:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Get search facets for advanced filtering
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getSearchFacets(req, res) {
    try {
      const { query } = req.query;

      // Build base criteria for facet calculation
      const baseCriteria = {
        processed: true,
        outdated: { $ne: true }
      };

      // Add text search if query provided
      if (query) {
        baseCriteria.$or = [
          { title: { $regex: query, $options: 'i' } },
          { summary: { $regex: query, $options: 'i' } },
          { fullText: { $regex: query, $options: 'i' } },
          { keyInsights: { $elemMatch: { $regex: query, $options: 'i' } } },
          { author: { $regex: query, $options: 'i' } }
        ];
      }

      // Get facets using aggregation
      const facets = await Content.aggregate([
        { $match: baseCriteria },
        {
          $facet: {
            types: [
              { $group: { _id: '$type', count: { $sum: 1 } } },
              { $sort: { count: -1 } }
            ],
            categories: [
              { $unwind: '$categories' },
              { $group: { _id: '$categories', count: { $sum: 1 } } },
              { $sort: { count: -1 } },
              { $limit: 20 }
            ],
            topics: [
              { $unwind: '$topics' },
              { $group: { _id: '$topics', count: { $sum: 1 } } },
              { $sort: { count: -1 } },
              { $limit: 20 }
            ],
            authors: [
              { $match: { author: { $exists: true, $ne: null } } },
              { $group: { _id: '$author', count: { $sum: 1 } } },
              { $sort: { count: -1 } },
              { $limit: 20 }
            ],
            dateRanges: [
              {
                $group: {
                  _id: null,
                  minDate: { $min: '$publishDate' },
                  maxDate: { $max: '$publishDate' }
                }
              }
            ],
            relevanceRanges: [
              {
                $group: {
                  _id: null,
                  minRelevance: { $min: '$relevanceScore' },
                  maxRelevance: { $max: '$relevanceScore' },
                  avgRelevance: { $avg: '$relevanceScore' }
                }
              }
            ]
          }
        }
      ]);

      res.json({
        success: true,
        data: {
          facets: facets[0]
        }
      });

    } catch (error) {
      req.app.locals.logger.error('Error getting search facets:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Search within collections
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async searchCollections(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const {
        query,
        userId,
        public: isPublic,
        sortBy = 'name',
        sortOrder = 'asc',
        page = 1,
        limit = 20
      } = req.query;

      // Build search criteria
      const searchCriteria = {};

      // Full-text search
      if (query) {
        searchCriteria.$or = [
          { name: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } }
        ];
      }

      // User filter
      if (userId) {
        searchCriteria.userId = userId;
      }

      // Public filter
      if (isPublic !== undefined) {
        searchCriteria.public = isPublic === 'true';
      }

      // Build sort criteria
      const sortCriteria = {};
      switch (sortBy) {
        case 'name':
          sortCriteria.name = sortOrder === 'asc' ? 1 : -1;
          break;
        case 'created':
          sortCriteria.createdAt = sortOrder === 'asc' ? 1 : -1;
          break;
        case 'updated':
          sortCriteria.updatedAt = sortOrder === 'asc' ? 1 : -1;
          break;
        case 'contentCount':
          sortCriteria.contentCount = sortOrder === 'asc' ? 1 : -1;
          break;
        default:
          sortCriteria.name = 1;
      }

      // Calculate pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Execute search with content count
      const [results, totalCount] = await Promise.all([
        Collection.aggregate([
          { $match: searchCriteria },
          {
            $addFields: {
              contentCount: { $size: '$contentIds' }
            }
          },
          { $sort: sortCriteria },
          { $skip: skip },
          { $limit: parseInt(limit) },
          {
            $lookup: {
              from: 'users',
              localField: 'userId',
              foreignField: '_id',
              as: 'user',
              pipeline: [{ $project: { name: 1, email: 1 } }]
            }
          },
          { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } }
        ]),
        Collection.countDocuments(searchCriteria)
      ]);

      // Calculate pagination info
      const totalPages = Math.ceil(totalCount / parseInt(limit));
      const hasNextPage = parseInt(page) < totalPages;
      const hasPrevPage = parseInt(page) > 1;

      res.json({
        success: true,
        data: {
          results,
          pagination: {
            currentPage: parseInt(page),
            totalPages,
            totalCount,
            hasNextPage,
            hasPrevPage,
            limit: parseInt(limit)
          }
        }
      });

    } catch (error) {
      req.app.locals.logger.error('Error searching collections:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Advanced search with multiple criteria and aggregations
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async advancedSearch(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const {
        query,
        filters = {},
        aggregations = [],
        sortBy = 'relevance',
        sortOrder = 'desc',
        page = 1,
        limit = 20
      } = req.body;

      // Build search pipeline
      const pipeline = [];

      // Match stage
      const matchStage = {
        processed: true,
        outdated: { $ne: true }
      };

      // Add text search
      if (query) {
        matchStage.$or = [
          { title: { $regex: query, $options: 'i' } },
          { summary: { $regex: query, $options: 'i' } },
          { fullText: { $regex: query, $options: 'i' } },
          { keyInsights: { $elemMatch: { $regex: query, $options: 'i' } } },
          { author: { $regex: query, $options: 'i' } }
        ];
      }

      // Add filters
      Object.keys(filters).forEach(key => {
        const value = filters[key];
        switch (key) {
          case 'type':
            matchStage.type = Array.isArray(value) ? { $in: value } : value;
            break;
          case 'categories':
            matchStage.categories = { $in: Array.isArray(value) ? value : [value] };
            break;
          case 'topics':
            matchStage.topics = { $in: Array.isArray(value) ? value : [value] };
            break;
          case 'dateRange':
            if (value.from || value.to) {
              matchStage.publishDate = {};
              if (value.from) matchStage.publishDate.$gte = new Date(value.from);
              if (value.to) matchStage.publishDate.$lte = new Date(value.to);
            }
            break;
          case 'relevanceRange':
            if (value.min !== undefined || value.max !== undefined) {
              matchStage.relevanceScore = {};
              if (value.min !== undefined) matchStage.relevanceScore.$gte = value.min;
              if (value.max !== undefined) matchStage.relevanceScore.$lte = value.max;
            }
            break;
          case 'qualityRange':
            if (value.min !== undefined || value.max !== undefined) {
              matchStage.qualityScore = {};
              if (value.min !== undefined) matchStage.qualityScore.$gte = value.min;
              if (value.max !== undefined) matchStage.qualityScore.$lte = value.max;
            }
            break;
        }
      });

      pipeline.push({ $match: matchStage });

      // Add aggregations
      aggregations.forEach(agg => {
        switch (agg.type) {
          case 'group':
            pipeline.push({ $group: agg.config });
            break;
          case 'sort':
            pipeline.push({ $sort: agg.config });
            break;
          case 'project':
            pipeline.push({ $project: agg.config });
            break;
          case 'lookup':
            pipeline.push({ $lookup: agg.config });
            break;
        }
      });

      // Add sorting if not already added
      if (!aggregations.some(agg => agg.type === 'sort')) {
        const sortCriteria = {};
        switch (sortBy) {
          case 'relevance':
            sortCriteria.relevanceScore = sortOrder === 'asc' ? 1 : -1;
            break;
          case 'date':
            sortCriteria.publishDate = sortOrder === 'asc' ? 1 : -1;
            break;
          case 'quality':
            sortCriteria.qualityScore = sortOrder === 'asc' ? 1 : -1;
            break;
          default:
            sortCriteria.relevanceScore = -1;
        }
        pipeline.push({ $sort: sortCriteria });
      }

      // Add pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);
      pipeline.push({ $skip: skip });
      pipeline.push({ $limit: parseInt(limit) });

      // Execute search
      const results = await Content.aggregate(pipeline);

      // Get total count
      const countPipeline = pipeline.slice(0, -2); // Remove skip and limit
      countPipeline.push({ $count: 'total' });
      const countResult = await Content.aggregate(countPipeline);
      const totalCount = countResult[0]?.total || 0;

      // Calculate pagination info
      const totalPages = Math.ceil(totalCount / parseInt(limit));
      const hasNextPage = parseInt(page) < totalPages;
      const hasPrevPage = parseInt(page) > 1;

      res.json({
        success: true,
        data: {
          results,
          pagination: {
            currentPage: parseInt(page),
            totalPages,
            totalCount,
            hasNextPage,
            hasPrevPage,
            limit: parseInt(limit)
          }
        }
      });

    } catch (error) {
      req.app.locals.logger.error('Error in advanced search:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
}

module.exports = SearchController;