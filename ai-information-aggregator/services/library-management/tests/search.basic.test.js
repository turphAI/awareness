const SearchController = require('../controllers/searchController');
const Content = require('../../content-discovery/models/Content');
const Collection = require('../models/Collection');

// Mock the models
jest.mock('../../content-discovery/models/Content');
jest.mock('../models/Collection');

describe('Search Controller - Basic Tests', () => {
  let mockReq, mockRes;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock request object
    mockReq = {
      query: {},
      body: {},
      app: {
        locals: {
          logger: {
            error: jest.fn(),
            debug: jest.fn(),
            info: jest.fn()
          }
        }
      }
    };

    // Mock response object
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
  });

  describe('searchContent', () => {
    it('should handle basic content search', async () => {
      // Mock validation result
      const mockValidationResult = {
        isEmpty: jest.fn().mockReturnValue(true)
      };
      
      // Mock express-validator
      jest.doMock('express-validator', () => ({
        validationResult: jest.fn().mockReturnValue(mockValidationResult)
      }));

      // Mock Content.find chain
      const mockFind = jest.fn().mockReturnThis();
      const mockSort = jest.fn().mockReturnThis();
      const mockSkip = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockReturnThis();
      const mockPopulate = jest.fn().mockReturnThis();
      const mockSelect = jest.fn().mockResolvedValue([
        {
          _id: '507f1f77bcf86cd799439011',
          title: 'Test Article',
          author: 'Test Author',
          type: 'article',
          relevanceScore: 0.8
        }
      ]);

      Content.find = mockFind;
      mockFind.mockReturnValue({
        sort: mockSort,
        skip: mockSkip,
        limit: mockLimit,
        populate: mockPopulate,
        select: mockSelect
      });
      
      mockSort.mockReturnValue({
        skip: mockSkip,
        limit: mockLimit,
        populate: mockPopulate,
        select: mockSelect
      });
      
      mockSkip.mockReturnValue({
        limit: mockLimit,
        populate: mockPopulate,
        select: mockSelect
      });
      
      mockLimit.mockReturnValue({
        populate: mockPopulate,
        select: mockSelect
      });
      
      mockPopulate.mockReturnValue({
        populate: mockPopulate,
        select: mockSelect
      });

      Content.countDocuments = jest.fn().mockResolvedValue(1);

      mockReq.query = { query: 'test' };

      await SearchController.searchContent(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          results: expect.any(Array),
          pagination: expect.objectContaining({
            currentPage: 1,
            totalCount: 1
          })
        })
      });
    });

    it('should handle validation errors', async () => {
      // Mock validation result with errors
      const mockValidationResult = {
        isEmpty: jest.fn().mockReturnValue(false),
        array: jest.fn().mockReturnValue([
          { msg: 'Invalid query parameter' }
        ])
      };
      
      jest.doMock('express-validator', () => ({
        validationResult: jest.fn().mockReturnValue(mockValidationResult)
      }));

      await SearchController.searchContent(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Validation failed',
        errors: expect.any(Array)
      });
    });

    it('should handle database errors', async () => {
      // Mock validation result
      const mockValidationResult = {
        isEmpty: jest.fn().mockReturnValue(true)
      };
      
      jest.doMock('express-validator', () => ({
        validationResult: jest.fn().mockReturnValue(mockValidationResult)
      }));

      // Mock Content.find to throw error
      Content.find = jest.fn().mockImplementation(() => {
        throw new Error('Database error');
      });

      await SearchController.searchContent(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Internal server error',
        error: undefined // In test environment, error details are hidden
      });
    });
  });

  describe('getSearchSuggestions', () => {
    it('should return empty suggestions for short query', async () => {
      mockReq.query = { query: 'a' };

      await SearchController.getSearchSuggestions(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          suggestions: []
        }
      });
    });

    it('should return suggestions for valid query', async () => {
      mockReq.query = { query: 'machine learning' };

      // Mock Content queries
      Content.find = jest.fn()
        .mockResolvedValueOnce([{ title: 'Machine Learning Basics' }])
        .mockResolvedValueOnce([{ author: 'ML Expert' }]);

      Content.aggregate = jest.fn().mockResolvedValue([
        { _id: 'machine learning', count: 5 }
      ]);

      await SearchController.getSearchSuggestions(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          suggestions: expect.any(Array)
        }
      });
    });
  });

  describe('getSearchFacets', () => {
    it('should return search facets', async () => {
      const mockFacets = [{
        types: [{ _id: 'article', count: 10 }],
        categories: [{ _id: 'AI', count: 15 }],
        topics: [{ _id: 'machine learning', count: 8 }],
        authors: [{ _id: 'John Doe', count: 3 }],
        dateRanges: [{ _id: null, minDate: new Date(), maxDate: new Date() }],
        relevanceRanges: [{ _id: null, minRelevance: 0.1, maxRelevance: 1.0 }]
      }];

      Content.aggregate = jest.fn().mockResolvedValue(mockFacets);

      await SearchController.getSearchFacets(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          facets: mockFacets[0]
        }
      });
    });
  });

  describe('searchCollections', () => {
    it('should search collections successfully', async () => {
      // Mock validation result
      const mockValidationResult = {
        isEmpty: jest.fn().mockReturnValue(true)
      };
      
      jest.doMock('express-validator', () => ({
        validationResult: jest.fn().mockReturnValue(mockValidationResult)
      }));

      const mockCollections = [
        {
          _id: '507f1f77bcf86cd799439011',
          name: 'AI Collection',
          description: 'Collection about AI',
          contentCount: 5
        }
      ];

      Collection.aggregate = jest.fn().mockResolvedValue(mockCollections);
      Collection.countDocuments = jest.fn().mockResolvedValue(1);

      mockReq.query = { query: 'AI' };

      await SearchController.searchCollections(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          results: mockCollections,
          pagination: expect.objectContaining({
            totalCount: 1
          })
        })
      });
    });
  });

  describe('advancedSearch', () => {
    it('should perform advanced search', async () => {
      // Mock validation result
      const mockValidationResult = {
        isEmpty: jest.fn().mockReturnValue(true)
      };
      
      jest.doMock('express-validator', () => ({
        validationResult: jest.fn().mockReturnValue(mockValidationResult)
      }));

      const mockResults = [
        {
          _id: '507f1f77bcf86cd799439011',
          title: 'Advanced AI Article',
          relevanceScore: 0.9
        }
      ];

      Content.aggregate = jest.fn()
        .mockResolvedValueOnce(mockResults)
        .mockResolvedValueOnce([{ total: 1 }]);

      mockReq.body = {
        query: 'artificial intelligence',
        filters: {
          type: ['article'],
          relevanceRange: { min: 0.8 }
        }
      };

      await SearchController.advancedSearch(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          results: mockResults,
          pagination: expect.objectContaining({
            totalCount: 1
          })
        })
      });
    });
  });
});