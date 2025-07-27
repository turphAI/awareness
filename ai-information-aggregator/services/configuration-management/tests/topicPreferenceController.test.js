const topicPreferenceController = require('../controllers/topicPreferenceController');
const TopicPreference = require('../models/TopicPreference');
const { validationResult } = require('express-validator');

// Mock dependencies
jest.mock('../models/TopicPreference');
jest.mock('express-validator');

describe('TopicPreferenceController', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    mockReq = {
      user: { id: 'user123' },
      params: {},
      query: {},
      body: {},
      app: {
        locals: {
          logger: {
            error: jest.fn(),
            info: jest.fn(),
            debug: jest.fn()
          }
        }
      }
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    mockNext = jest.fn();

    // Mock validation result to return no errors by default
    validationResult.mockReturnValue({
      isEmpty: () => true,
      array: () => []
    });

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('getUserTopicPreferences', () => {
    test('should return user topic preferences successfully', async () => {
      const mockPreferences = [
        {
          _id: 'pref1',
          topic: 'Machine Learning',
          category: 'machine-learning',
          priority: 'high'
        },
        {
          _id: 'pref2',
          topic: 'AI Ethics',
          category: 'ethics',
          priority: 'medium'
        }
      ];

      TopicPreference.findByUser = jest.fn().mockResolvedValue(mockPreferences);

      await topicPreferenceController.getUserTopicPreferences(mockReq, mockRes);

      expect(TopicPreference.findByUser).toHaveBeenCalledWith('user123', expect.any(Object));
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockPreferences
      });
    });

    test('should handle pagination when limit is provided', async () => {
      mockReq.query = { limit: '10', page: '2' };
      
      const mockPreferences = [{ _id: 'pref1', topic: 'ML' }];
      
      TopicPreference.findByUser = jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue(mockPreferences)
        })
      });
      TopicPreference.countDocuments = jest.fn().mockResolvedValue(25);

      await topicPreferenceController.getUserTopicPreferences(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockPreferences,
        pagination: {
          page: 2,
          limit: 10,
          total: 25,
          pages: 3
        }
      });
    });

    test('should return 401 if user is not authenticated', async () => {
      mockReq.user = null;

      await topicPreferenceController.getUserTopicPreferences(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Authentication required'
      });
    });

    test('should handle database errors', async () => {
      TopicPreference.findByUser = jest.fn().mockRejectedValue(new Error('Database error'));

      await topicPreferenceController.getUserTopicPreferences(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to fetch topic preferences',
        error: 'Internal server error'
      });
    });
  });

  describe('getTopicPreference', () => {
    test('should return specific topic preference', async () => {
      mockReq.params.id = 'pref123';
      const mockPreference = {
        _id: 'pref123',
        topic: 'Machine Learning',
        category: 'machine-learning'
      };

      TopicPreference.findOne = jest.fn().mockResolvedValue(mockPreference);

      await topicPreferenceController.getTopicPreference(mockReq, mockRes);

      expect(TopicPreference.findOne).toHaveBeenCalledWith({
        _id: 'pref123',
        userId: 'user123'
      });
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockPreference
      });
    });

    test('should return 404 if preference not found', async () => {
      mockReq.params.id = 'nonexistent';
      TopicPreference.findOne = jest.fn().mockResolvedValue(null);

      await topicPreferenceController.getTopicPreference(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Topic preference not found'
      });
    });
  });

  describe('createTopicPreference', () => {
    test('should create new topic preference successfully', async () => {
      mockReq.body = {
        topic: 'Machine Learning',
        category: 'machine-learning',
        priority: 'high',
        keywords: ['ML', 'Algorithm']
      };

      const mockSavedPreference = {
        _id: 'newpref123',
        ...mockReq.body,
        userId: 'user123'
      };

      TopicPreference.findOne = jest.fn().mockResolvedValue(null); // No existing preference
      TopicPreference.prototype.save = jest.fn().mockResolvedValue(mockSavedPreference);

      await topicPreferenceController.createTopicPreference(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Topic preference created successfully',
        data: expect.any(Object)
      });
    });

    test('should return 409 if topic preference already exists', async () => {
      mockReq.body = {
        topic: 'Machine Learning',
        category: 'machine-learning'
      };

      TopicPreference.findOne = jest.fn().mockResolvedValue({ _id: 'existing' });

      await topicPreferenceController.createTopicPreference(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Topic preference already exists for this user'
      });
    });

    test('should return 400 for validation errors', async () => {
      validationResult.mockReturnValue({
        isEmpty: () => false,
        array: () => [{ msg: 'Topic is required' }]
      });

      await topicPreferenceController.createTopicPreference(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Validation failed',
        errors: [{ msg: 'Topic is required' }]
      });
    });
  });

  describe('updateTopicPreference', () => {
    test('should update topic preference successfully', async () => {
      mockReq.params.id = 'pref123';
      mockReq.body = {
        priority: 'high',
        weight: 0.9
      };

      const mockPreference = {
        _id: 'pref123',
        topic: 'Machine Learning',
        priority: 'medium',
        weight: 0.5,
        save: jest.fn().mockResolvedValue(true)
      };

      TopicPreference.findOne = jest.fn().mockResolvedValue(mockPreference);

      await topicPreferenceController.updateTopicPreference(mockReq, mockRes);

      expect(mockPreference.priority).toBe('high');
      expect(mockPreference.weight).toBe(0.9);
      expect(mockPreference.save).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Topic preference updated successfully',
        data: mockPreference
      });
    });

    test('should return 404 if preference not found', async () => {
      mockReq.params.id = 'nonexistent';
      TopicPreference.findOne = jest.fn().mockResolvedValue(null);

      await topicPreferenceController.updateTopicPreference(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Topic preference not found'
      });
    });
  });

  describe('deleteTopicPreference', () => {
    test('should delete topic preference successfully', async () => {
      mockReq.params.id = 'pref123';
      const mockPreference = { _id: 'pref123' };

      TopicPreference.findOneAndDelete = jest.fn().mockResolvedValue(mockPreference);

      await topicPreferenceController.deleteTopicPreference(mockReq, mockRes);

      expect(TopicPreference.findOneAndDelete).toHaveBeenCalledWith({
        _id: 'pref123',
        userId: 'user123'
      });
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Topic preference deleted successfully'
      });
    });

    test('should return 404 if preference not found', async () => {
      mockReq.params.id = 'nonexistent';
      TopicPreference.findOneAndDelete = jest.fn().mockResolvedValue(null);

      await topicPreferenceController.deleteTopicPreference(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Topic preference not found'
      });
    });
  });

  describe('toggleTopicPreference', () => {
    test('should toggle topic preference active status', async () => {
      mockReq.params.id = 'pref123';
      const mockPreference = {
        _id: 'pref123',
        isActive: true,
        toggleActive: jest.fn().mockResolvedValue(true)
      };

      TopicPreference.findOne = jest.fn().mockResolvedValue(mockPreference);

      await topicPreferenceController.toggleTopicPreference(mockReq, mockRes);

      expect(mockPreference.toggleActive).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Topic preference activated successfully',
        data: mockPreference
      });
    });
  });

  describe('addKeyword', () => {
    test('should add keyword to topic preference', async () => {
      mockReq.params.id = 'pref123';
      mockReq.body.keyword = 'neural network';
      
      const mockPreference = {
        _id: 'pref123',
        addKeyword: jest.fn().mockResolvedValue(true)
      };

      TopicPreference.findOne = jest.fn().mockResolvedValue(mockPreference);

      await topicPreferenceController.addKeyword(mockReq, mockRes);

      expect(mockPreference.addKeyword).toHaveBeenCalledWith('neural network');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Keyword added successfully',
        data: mockPreference
      });
    });
  });

  describe('recordFeedback', () => {
    test('should record positive feedback', async () => {
      mockReq.params.id = 'pref123';
      mockReq.body.feedback = 'positive';
      
      const mockPreference = {
        _id: 'pref123',
        addPositiveFeedback: jest.fn().mockResolvedValue(true),
        updateWeight: jest.fn().mockResolvedValue(true)
      };

      TopicPreference.findOne = jest.fn().mockResolvedValue(mockPreference);

      await topicPreferenceController.recordFeedback(mockReq, mockRes);

      expect(mockPreference.addPositiveFeedback).toHaveBeenCalled();
      expect(mockPreference.updateWeight).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Feedback recorded successfully',
        data: mockPreference
      });
    });

    test('should record negative feedback', async () => {
      mockReq.params.id = 'pref123';
      mockReq.body.feedback = 'negative';
      
      const mockPreference = {
        _id: 'pref123',
        addNegativeFeedback: jest.fn().mockResolvedValue(true),
        updateWeight: jest.fn().mockResolvedValue(true)
      };

      TopicPreference.findOne = jest.fn().mockResolvedValue(mockPreference);

      await topicPreferenceController.recordFeedback(mockReq, mockRes);

      expect(mockPreference.addNegativeFeedback).toHaveBeenCalled();
      expect(mockPreference.updateWeight).toHaveBeenCalled();
    });

    test('should return 400 for invalid feedback', async () => {
      mockReq.params.id = 'pref123';
      mockReq.body.feedback = 'invalid';
      
      const mockPreference = { _id: 'pref123' };
      TopicPreference.findOne = jest.fn().mockResolvedValue(mockPreference);

      await topicPreferenceController.recordFeedback(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Feedback must be either "positive" or "negative"'
      });
    });
  });

  describe('getUserStatistics', () => {
    test('should return user statistics', async () => {
      const mockStatistics = {
        overview: {
          totalPreferences: 10,
          activePreferences: 8,
          avgWeight: 0.7
        },
        byCategory: [
          { _id: 'machine-learning', count: 5 },
          { _id: 'ai-research', count: 3 }
        ]
      };

      TopicPreference.getUserStatistics = jest.fn().mockResolvedValue(mockStatistics);

      await topicPreferenceController.getUserStatistics(mockReq, mockRes);

      expect(TopicPreference.getUserStatistics).toHaveBeenCalledWith('user123');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockStatistics
      });
    });
  });

  describe('getTopicSuggestions', () => {
    test('should return topic suggestions', async () => {
      const mockSuggestions = [
        {
          topic: 'deep learning',
          frequency: 5,
          suggestedCategory: 'machine-learning',
          suggestedPriority: 'high'
        }
      ];

      TopicPreference.suggestTopics = jest.fn().mockResolvedValue(mockSuggestions);

      await topicPreferenceController.getTopicSuggestions(mockReq, mockRes);

      expect(TopicPreference.suggestTopics).toHaveBeenCalledWith('user123', []);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockSuggestions
      });
    });
  });

  describe('searchTopicPreferences', () => {
    test('should search topic preferences by keyword', async () => {
      mockReq.query.keyword = 'machine learning';
      const mockResults = [
        { _id: 'pref1', topic: 'Machine Learning Basics' },
        { _id: 'pref2', topic: 'Advanced ML' }
      ];

      TopicPreference.searchByKeyword = jest.fn().mockResolvedValue(mockResults);

      await topicPreferenceController.searchTopicPreferences(mockReq, mockRes);

      expect(TopicPreference.searchByKeyword).toHaveBeenCalledWith('user123', 'machine learning');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockResults
      });
    });

    test('should return 400 if keyword is missing', async () => {
      mockReq.query = {};

      await topicPreferenceController.searchTopicPreferences(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Search keyword is required'
      });
    });
  });

  describe('bulkUpdateTopicPreferences', () => {
    test('should perform bulk update successfully', async () => {
      mockReq.body.updates = [
        {
          id: 'pref1',
          updates: { priority: 'high', weight: 0.9 }
        },
        {
          id: 'pref2',
          updates: { priority: 'low' }
        }
      ];

      const mockPreference1 = {
        _id: 'pref1',
        priority: 'medium',
        weight: 0.5,
        save: jest.fn().mockResolvedValue(true)
      };

      const mockPreference2 = {
        _id: 'pref2',
        priority: 'medium',
        save: jest.fn().mockResolvedValue(true)
      };

      TopicPreference.findOne = jest.fn()
        .mockResolvedValueOnce(mockPreference1)
        .mockResolvedValueOnce(mockPreference2);

      await topicPreferenceController.bulkUpdateTopicPreferences(mockReq, mockRes);

      expect(mockPreference1.priority).toBe('high');
      expect(mockPreference1.weight).toBe(0.9);
      expect(mockPreference2.priority).toBe('low');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Bulk update completed',
        data: {
          updated: expect.any(Array),
          errors: expect.any(Array)
        }
      });
    });

    test('should handle errors in bulk update', async () => {
      mockReq.body.updates = [
        {
          id: 'nonexistent',
          updates: { priority: 'high' }
        }
      ];

      TopicPreference.findOne = jest.fn().mockResolvedValue(null);

      await topicPreferenceController.bulkUpdateTopicPreferences(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Bulk update completed',
        data: {
          updated: [],
          errors: [
            {
              id: 'nonexistent',
              error: 'Topic preference not found'
            }
          ]
        }
      });
    });
  });
});