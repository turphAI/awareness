// Mock dependencies
jest.mock('mongoose', () => ({
  Schema: jest.fn().mockImplementation(() => ({
    index: jest.fn().mockReturnThis(),
    methods: {},
    statics: {}
  })),
  model: jest.fn().mockReturnValue({})
}));

jest.mock('../../../common/utils/logger', () => {
  return jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }));
});

jest.mock('../../../common/utils/errorHandler', () => ({
  ApiError: class ApiError extends Error {
    constructor(statusCode, message) {
      super(message);
      this.statusCode = statusCode;
    }
  }
}));

jest.mock('../models/Source');
jest.mock('../utils/urlValidator');
jest.mock('../utils/relevanceRating');

const sourceController = require('../controllers/sourceController');
const Source = require('../models/Source');
const UrlValidator = require('../utils/urlValidator');
const relevanceRating = require('../utils/relevanceRating');

describe('Source Controller', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      user: { id: 'user123' }
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('validateUrl', () => {
    it('should return 400 if URL is missing', async () => {
      await sourceController.validateUrl(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'URL is required' });
    });

    it('should return 400 if source with URL already exists', async () => {
      req.body.url = 'https://example.com';
      Source.findOne.mockResolvedValue({ _id: 'source123' });

      await sourceController.validateUrl(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Source with this URL already exists',
        sourceId: 'source123'
      });
    });

    it('should return 400 if URL is invalid', async () => {
      req.body.url = 'https://example.com';
      Source.findOne.mockResolvedValue(null);
      UrlValidator.validateAndExtractSourceInfo.mockResolvedValue({
        valid: false,
        error: 'Invalid URL'
      });

      await sourceController.validateUrl(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Invalid URL',
        error: 'Invalid URL'
      });
    });

    it('should return 200 with source info if URL is valid', async () => {
      req.body.url = 'https://example.com';
      Source.findOne.mockResolvedValue(null);
      const sourceInfo = {
        valid: true,
        url: 'https://example.com',
        name: 'Example',
        type: 'website'
      };
      UrlValidator.validateAndExtractSourceInfo.mockResolvedValue(sourceInfo);

      await sourceController.validateUrl(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(sourceInfo);
    });

    it('should handle errors gracefully', async () => {
      req.body.url = 'https://example.com';
      Source.findOne.mockRejectedValue(new Error('Database error'));

      await sourceController.validateUrl(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Error validating URL' });
    });
  });

  describe('checkUrlReachability', () => {
    it('should return 400 if URL is missing', async () => {
      await sourceController.checkUrlReachability(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'URL is required' });
    });

    it('should return reachability status', async () => {
      req.body.url = 'https://example.com';
      UrlValidator.isReachable.mockResolvedValue(true);

      await sourceController.checkUrlReachability(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        url: 'https://example.com',
        reachable: true
      });
    });

    it('should handle errors gracefully', async () => {
      req.body.url = 'https://example.com';
      UrlValidator.isReachable.mockRejectedValue(new Error('Network error'));

      await sourceController.checkUrlReachability(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Error checking URL reachability' });
    });
  });

  describe('getUrlMetadata', () => {
    it('should return 400 if URL is missing', async () => {
      await sourceController.getUrlMetadata(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'URL is required' });
    });

    it('should return 400 if metadata has error', async () => {
      req.body.url = 'https://example.com';
      UrlValidator.getMetadata.mockResolvedValue({
        error: 'Metadata error'
      });

      await sourceController.getUrlMetadata(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Error fetching metadata',
        error: 'Metadata error'
      });
    });

    it('should return metadata if successful', async () => {
      req.body.url = 'https://example.com';
      const metadata = {
        title: 'Example',
        description: 'Example website'
      };
      UrlValidator.getMetadata.mockResolvedValue(metadata);

      await sourceController.getUrlMetadata(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(metadata);
    });

    it('should handle errors gracefully', async () => {
      req.body.url = 'https://example.com';
      UrlValidator.getMetadata.mockRejectedValue(new Error('Network error'));

      await sourceController.getUrlMetadata(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Error getting URL metadata' });
    });
  });

  describe('findRssFeed', () => {
    it('should return 400 if URL is missing', async () => {
      await sourceController.findRssFeed(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'URL is required' });
    });

    it('should return RSS feed URL if found', async () => {
      req.body.url = 'https://example.com';
      UrlValidator.findRssFeed.mockResolvedValue('https://example.com/feed');

      await sourceController.findRssFeed(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        url: 'https://example.com',
        rssUrl: 'https://example.com/feed'
      });
    });

    it('should return null if RSS feed not found', async () => {
      req.body.url = 'https://example.com';
      UrlValidator.findRssFeed.mockResolvedValue(null);

      await sourceController.findRssFeed(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        url: 'https://example.com',
        rssUrl: null
      });
    });

    it('should handle errors gracefully', async () => {
      req.body.url = 'https://example.com';
      UrlValidator.findRssFeed.mockRejectedValue(new Error('Network error'));

      await sourceController.findRssFeed(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Error finding RSS feed' });
    });
  });

  describe('bulkImportSources', () => {
    it('should return 400 if sources array is missing or empty', async () => {
      await sourceController.bulkImportSources(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Sources array is required' });

      req.body.sources = [];
      await sourceController.bulkImportSources(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Sources array is required' });
    });

    it('should import valid sources and report failures', async () => {
      req.body.sources = [
        { url: 'https://example1.com', name: 'Example 1', type: 'website' },
        { url: 'https://example2.com', name: 'Example 2', type: 'blog' },
        { url: 'https://example3.com', name: 'Example 3', type: 'podcast' }
      ];

      // Mock first source already exists
      Source.findOne.mockImplementation(async (query) => {
        if (query.url === 'https://example1.com') {
          return { _id: 'existing1' };
        }
        return null;
      });

      // Mock save for new sources
      const mockSave = jest.fn().mockResolvedValue(true);
      Source.mockImplementation((data) => {
        return {
          ...data,
          _id: data.url === 'https://example2.com' ? 'new1' : 'new2',
          save: mockSave
        };
      });

      await sourceController.bulkImportSources(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        successful: [
          { url: 'https://example2.com', id: 'new1' },
          { url: 'https://example3.com', id: 'new2' }
        ],
        failed: [
          { url: 'https://example1.com', error: 'Source with this URL already exists' }
        ]
      });
      expect(mockSave).toHaveBeenCalledTimes(2);
    });

    it('should handle errors gracefully', async () => {
      req.body.sources = [{ url: 'https://example.com' }];
      Source.findOne.mockRejectedValue(new Error('Database error'));

      await sourceController.bulkImportSources(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Error bulk importing sources' });
    });
  });
});
  de
scribe('updateRelevance', () => {
    it('should return 400 if score is invalid', async () => {
      req.body.score = 1.5;
      req.params.id = 'source123';
      
      await sourceController.updateRelevance(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid relevance score' });
      
      req.body.score = -0.5;
      await sourceController.updateRelevance(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid relevance score' });
    });
    
    it('should return 404 if source is not found', async () => {
      req.body.score = 0.8;
      req.params.id = 'source123';
      Source.findOne.mockResolvedValue(null);
      
      await sourceController.updateRelevance(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Source not found' });
    });
    
    it('should update relevance score and return updated source', async () => {
      req.body.score = 0.8;
      req.body.reason = 'manual_quality_assessment';
      req.params.id = 'source123';
      
      const mockUpdateRelevance = jest.fn().mockResolvedValue(true);
      const mockSource = {
        _id: 'source123',
        name: 'Test Source',
        relevanceScore: 0.5,
        updateRelevance: mockUpdateRelevance
      };
      
      Source.findOne.mockResolvedValue(mockSource);
      
      await sourceController.updateRelevance(req, res);
      
      expect(mockUpdateRelevance).toHaveBeenCalledWith(0.8, {
        reason: 'manual_quality_assessment',
        userId: 'user123'
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockSource);
    });
    
    it('should handle errors gracefully', async () => {
      req.body.score = 0.8;
      req.params.id = 'source123';
      Source.findOne.mockRejectedValue(new Error('Database error'));
      
      await sourceController.updateRelevance(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Error updating source relevance' });
    });
  });
  
  describe('adjustRelevanceByInteraction', () => {
    it('should return 400 if interaction type is invalid', async () => {
      req.body.interactionType = 'invalid';
      req.params.id = 'source123';
      
      await sourceController.adjustRelevanceByInteraction(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid interaction type' });
      
      req.body.interactionType = null;
      await sourceController.adjustRelevanceByInteraction(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid interaction type' });
    });
    
    it('should return 404 if source is not found', async () => {
      req.body.interactionType = 'view';
      req.params.id = 'source123';
      Source.findOne.mockResolvedValue(null);
      
      await sourceController.adjustRelevanceByInteraction(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Source not found' });
    });
    
    it('should adjust relevance score and return updated source', async () => {
      req.body.interactionType = 'share';
      req.body.weight = 0.2;
      req.params.id = 'source123';
      
      const mockAdjustRelevance = jest.fn().mockResolvedValue(true);
      const mockSource = {
        _id: 'source123',
        name: 'Test Source',
        relevanceScore: 0.5,
        adjustRelevanceByInteraction: mockAdjustRelevance
      };
      
      Source.findOne.mockResolvedValue(mockSource);
      
      await sourceController.adjustRelevanceByInteraction(req, res);
      
      expect(mockAdjustRelevance).toHaveBeenCalledWith('share', 'user123', 0.2);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockSource);
    });
    
    it('should handle errors gracefully', async () => {
      req.body.interactionType = 'view';
      req.params.id = 'source123';
      Source.findOne.mockRejectedValue(new Error('Database error'));
      
      await sourceController.adjustRelevanceByInteraction(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Error adjusting source relevance' });
    });
  });
  
  describe('getRelevanceHistory', () => {
    it('should return 404 if source is not found', async () => {
      req.params.id = 'source123';
      Source.findOne.mockResolvedValue(null);
      
      await sourceController.getRelevanceHistory(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Source not found' });
    });
    
    it('should return relevance history', async () => {
      req.params.id = 'source123';
      
      const mockHistory = [
        { score: 0.5, date: '2023-01-01T00:00:00.000Z', reason: 'initial' },
        { score: 0.6, date: '2023-01-02T00:00:00.000Z', reason: 'manual_update' }
      ];
      
      const mockSource = {
        _id: 'source123',
        name: 'Test Source',
        relevanceScore: 0.6,
        metadata: new Map([
          ['relevanceHistory', JSON.stringify(mockHistory)],
          ['priorityLevel', 'high']
        ])
      };
      
      Source.findOne.mockResolvedValue(mockSource);
      
      await sourceController.getRelevanceHistory(req, res);
      
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        sourceId: 'source123',
        currentScore: 0.6,
        priorityLevel: 'high',
        history: mockHistory
      });
    });
    
    it('should handle empty history', async () => {
      req.params.id = 'source123';
      
      const mockSource = {
        _id: 'source123',
        name: 'Test Source',
        relevanceScore: 0.5,
        metadata: new Map()
      };
      
      Source.findOne.mockResolvedValue(mockSource);
      
      await sourceController.getRelevanceHistory(req, res);
      
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        sourceId: 'source123',
        currentScore: 0.5,
        priorityLevel: 'medium',
        history: []
      });
    });
    
    it('should handle errors gracefully', async () => {
      req.params.id = 'source123';
      Source.findOne.mockRejectedValue(new Error('Database error'));
      
      await sourceController.getRelevanceHistory(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Error fetching relevance history' });
    });
  });
  
  describe('calculateRecommendedScore', () => {
    it('should return 400 if factors are invalid', async () => {
      req.body.factors = null;
      
      await sourceController.calculateRecommendedScore(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid factors object' });
    });
    
    it('should calculate and return recommended score', async () => {
      req.body.factors = {
        values: {
          userRating: 0.8,
          contentQuality: 0.7
        }
      };
      
      relevanceRating.calculateRelevanceScore.mockReturnValue(0.75);
      relevanceRating.calculatePriorityLevel.mockReturnValue('high');
      relevanceRating.getRecommendedCheckFrequency.mockReturnValue('daily');
      
      await sourceController.calculateRecommendedScore(req, res);
      
      expect(relevanceRating.calculateRelevanceScore).toHaveBeenCalledWith(req.body.factors);
      expect(relevanceRating.calculatePriorityLevel).toHaveBeenCalledWith(0.75);
      expect(relevanceRating.getRecommendedCheckFrequency).toHaveBeenCalledWith(0.75);
      
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        recommendedScore: 0.75,
        priorityLevel: 'high',
        recommendedCheckFrequency: 'daily'
      });
    });
    
    it('should handle errors gracefully', async () => {
      req.body.factors = { values: {} };
      relevanceRating.calculateRelevanceScore.mockImplementation(() => {
        throw new Error('Calculation error');
      });
      
      await sourceController.calculateRecommendedScore(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Error calculating recommended score' });
    });
  });
  
  describe('decayRelevanceScores', () => {
    it('should return 403 if user is not admin', async () => {
      req.user.isAdmin = false;
      
      await sourceController.decayRelevanceScores(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Unauthorized' });
    });
    
    it('should decay scores for specific sources', async () => {
      req.user.isAdmin = true;
      req.body.decayRate = 0.02;
      req.body.sourceIds = ['source1', 'source2'];
      
      const mockSource1 = {
        _id: 'source1',
        name: 'Source 1',
        relevanceScore: 0.8,
        decayRelevanceScore: jest.fn().mockResolvedValue({ _id: 'source1', relevanceScore: 0.7 })
      };
      
      const mockSource2 = {
        _id: 'source2',
        name: 'Source 2',
        relevanceScore: 0.6,
        decayRelevanceScore: jest.fn().mockResolvedValue({ _id: 'source2', relevanceScore: 0.6 })
      };
      
      Source.find.mockResolvedValue([mockSource1, mockSource2]);
      
      await sourceController.decayRelevanceScores(req, res);
      
      expect(Source.find).toHaveBeenCalledWith({
        _id: { $in: ['source1', 'source2'] },
        active: true
      });
      
      expect(mockSource1.decayRelevanceScore).toHaveBeenCalledWith(0.02);
      expect(mockSource2.decayRelevanceScore).toHaveBeenCalledWith(0.02);
      
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        processed: 2,
        updated: 1,
        details: [
          { sourceId: 'source1', name: 'Source 1', oldScore: 0.8, newScore: 0.7 }
        ]
      });
    });
    
    it('should decay scores for all outdated sources', async () => {
      req.user.isAdmin = true;
      req.body.decayRate = 0.01;
      
      const mockSource1 = {
        _id: 'source1',
        name: 'Source 1',
        relevanceScore: 0.8,
        decayRelevanceScore: jest.fn().mockResolvedValue({ _id: 'source1', relevanceScore: 0.76 })
      };
      
      const mockSource2 = {
        _id: 'source2',
        name: 'Source 2',
        relevanceScore: 0.6,
        decayRelevanceScore: jest.fn().mockResolvedValue({ _id: 'source2', relevanceScore: 0.57 })
      };
      
      Source.find.mockResolvedValue([mockSource1, mockSource2]);
      
      await sourceController.decayRelevanceScores(req, res);
      
      expect(Source.find).toHaveBeenCalledWith({
        active: true,
        lastUpdated: { $lt: expect.any(Date) }
      });
      
      expect(mockSource1.decayRelevanceScore).toHaveBeenCalledWith(0.01);
      expect(mockSource2.decayRelevanceScore).toHaveBeenCalledWith(0.01);
      
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        processed: 2,
        updated: 2,
        details: [
          { sourceId: 'source1', name: 'Source 1', oldScore: 0.8, newScore: 0.76 },
          { sourceId: 'source2', name: 'Source 2', oldScore: 0.6, newScore: 0.57 }
        ]
      });
    });
    
    it('should handle errors gracefully', async () => {
      req.user.isAdmin = true;
      Source.find.mockRejectedValue(new Error('Database error'));
      
      await sourceController.decayRelevanceScores(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Error decaying relevance scores' });
    });
  });