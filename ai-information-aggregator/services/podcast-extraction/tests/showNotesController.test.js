/**
 * Show Notes Controller Tests
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Episode = require('../models/Episode');
const Reference = require('../../content-discovery/models/Reference');

// Mock the show notes analyzer
jest.mock('../utils/showNotesAnalyzer', () => ({
  analyzeEpisodeShowNotes: jest.fn(),
  parseShowNotes: jest.fn(),
  crossReferenceWithTranscript: jest.fn()
}));

const showNotesAnalyzer = require('../utils/showNotesAnalyzer');
const showNotesController = require('../controllers/showNotesController');

describe('Show Notes Controller', () => {
  let mongoServer;
  let req, res;
  
  beforeAll(async () => {
    // Set up in-memory MongoDB server
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
  });
  
  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });
  
  beforeEach(async () => {
    // Clear all mocks and database collections before each test
    jest.clearAllMocks();
    await Episode.deleteMany({});
    await Reference.deleteMany({});
    
    // Set up mock request and response objects
    req = {
      params: {},
      body: {},
      query: {}
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
  });
  
  describe('analyzeEpisodeShowNotes', () => {
    it('should analyze episode show notes successfully', async () => {
      const episodeId = new mongoose.Types.ObjectId().toString();
      
      // Mock analyzer response
      showNotesAnalyzer.analyzeEpisodeShowNotes.mockResolvedValueOnce({
        success: true,
        hasShowNotes: true,
        extractedReferences: [
          { type: 'link', url: 'https://example.com/paper' }
        ],
        summary: {
          totalShowNotesReferences: 1,
          matchedReferences: 0,
          newReferences: 1
        }
      });
      
      // Set up request
      req.params.episodeId = episodeId;
      
      // Call controller method
      await showNotesController.analyzeEpisodeShowNotes(req, res);
      
      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Show notes analysis completed successfully'
      }));
      
      // Verify analyzer was called
      expect(showNotesAnalyzer.analyzeEpisodeShowNotes).toHaveBeenCalledWith(episodeId);
    });
    
    it('should handle episode without show notes', async () => {
      const episodeId = new mongoose.Types.ObjectId().toString();
      
      // Mock analyzer response for no show notes
      showNotesAnalyzer.analyzeEpisodeShowNotes.mockResolvedValueOnce({
        success: false,
        hasShowNotes: false,
        message: 'Episode has no show notes'
      });
      
      // Set up request
      req.params.episodeId = episodeId;
      
      // Call controller method
      await showNotesController.analyzeEpisodeShowNotes(req, res);
      
      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Episode has no show notes',
        hasShowNotes: false
      }));
    });
    
    it('should return 400 for invalid episode ID', async () => {
      req.params.episodeId = 'invalid-id';
      
      await showNotesController.analyzeEpisodeShowNotes(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Invalid episode ID'
      }));
    });
  });
  
  describe('parseShowNotes', () => {
    it('should parse show notes successfully', async () => {
      const showNotesText = `
        Check out this paper: https://arxiv.org/abs/2301.12345
        Also see "Attention Is All You Need" by Vaswani et al.
      `;
      
      // Mock parser response
      const mockReferences = [
        {
          type: 'link',
          url: 'https://arxiv.org/abs/2301.12345',
          title: 'arXiv Paper'
        },
        {
          type: 'citation',
          title: 'Attention Is All You Need',
          authors: ['Vaswani']
        }
      ];
      
      showNotesAnalyzer.parseShowNotes.mockReturnValueOnce(mockReferences);
      
      // Set up request
      req.body.showNotes = showNotesText;
      
      // Call controller method
      await showNotesController.parseShowNotes(req, res);
      
      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Show notes parsed successfully',
        references: mockReferences,
        count: 2
      }));
      
      // Verify parser was called
      expect(showNotesAnalyzer.parseShowNotes).toHaveBeenCalledWith(showNotesText);
    });
    
    it('should return 400 for missing show notes', async () => {
      req.body = {}; // No show notes
      
      await showNotesController.parseShowNotes(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Show notes text is required'
      }));
    });
    
    it('should return 400 for invalid show notes type', async () => {
      req.body.showNotes = 123; // Not a string
      
      await showNotesController.parseShowNotes(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Show notes text is required'
      }));
    });
  });
  
  describe('crossReferenceWithTranscript', () => {
    it('should cross-reference successfully', async () => {
      const episodeId = new mongoose.Types.ObjectId().toString();
      const showNotesReferences = [
        {
          type: 'link',
          url: 'https://example.com/paper',
          title: 'Test Paper'
        }
      ];
      
      // Mock cross-reference response
      const mockResult = {
        matched: [],
        newFromShowNotes: showNotesReferences,
        transcriptOnly: [],
        summary: {
          totalTranscriptReferences: 0,
          totalShowNotesReferences: 1,
          matchedReferences: 0,
          newReferences: 1
        }
      };
      
      showNotesAnalyzer.crossReferenceWithTranscript.mockResolvedValueOnce(mockResult);
      
      // Set up request
      req.params.episodeId = episodeId;
      req.body.showNotesReferences = showNotesReferences;
      
      // Call controller method
      await showNotesController.crossReferenceWithTranscript(req, res);
      
      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Cross-reference completed successfully',
        result: mockResult
      }));
      
      // Verify analyzer was called
      expect(showNotesAnalyzer.crossReferenceWithTranscript).toHaveBeenCalledWith(
        episodeId,
        showNotesReferences
      );
    });
    
    it('should return 400 for invalid episode ID', async () => {
      req.params.episodeId = 'invalid-id';
      req.body.showNotesReferences = [];
      
      await showNotesController.crossReferenceWithTranscript(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Invalid episode ID'
      }));
    });
    
    it('should return 400 for missing show notes references', async () => {
      req.params.episodeId = new mongoose.Types.ObjectId().toString();
      req.body = {}; // No showNotesReferences
      
      await showNotesController.crossReferenceWithTranscript(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Show notes references array is required'
      }));
    });
  });
  
  describe('updateEpisodeShowNotes', () => {
    it('should update episode show notes successfully', async () => {
      // Create test episode
      const episode = new Episode({
        title: 'Test Episode',
        podcastId: new mongoose.Types.ObjectId(),
        guid: 'test-guid',
        url: 'https://example.com/episode',
        audioUrl: 'https://example.com/audio.mp3',
        publishDate: new Date()
      });
      await episode.save();
      
      const newShowNotes = 'Updated show notes with new content';
      
      // Set up request
      req.params.episodeId = episode._id.toString();
      req.body.showNotes = newShowNotes;
      
      // Call controller method
      await showNotesController.updateEpisodeShowNotes(req, res);
      
      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Episode show notes updated successfully'
      }));
      
      // Verify episode was updated in database
      const updatedEpisode = await Episode.findById(episode._id);
      expect(updatedEpisode.showNotes).toBe(newShowNotes);
    });
    
    it('should update and analyze show notes when analyze=true', async () => {
      // Create test episode
      const episode = new Episode({
        title: 'Test Episode',
        podcastId: new mongoose.Types.ObjectId(),
        guid: 'test-guid',
        url: 'https://example.com/episode',
        audioUrl: 'https://example.com/audio.mp3',
        publishDate: new Date()
      });
      await episode.save();
      
      const newShowNotes = 'Updated show notes with references';
      
      // Mock analysis result
      showNotesAnalyzer.analyzeEpisodeShowNotes.mockResolvedValueOnce({
        success: true,
        hasShowNotes: true,
        summary: { newReferences: 1 }
      });
      
      // Set up request
      req.params.episodeId = episode._id.toString();
      req.body.showNotes = newShowNotes;
      req.query.analyze = 'true';
      
      // Call controller method
      await showNotesController.updateEpisodeShowNotes(req, res);
      
      // Verify response includes analysis result
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Episode show notes updated successfully',
        analysisResult: expect.objectContaining({
          success: true
        })
      }));
      
      // Verify analyzer was called
      expect(showNotesAnalyzer.analyzeEpisodeShowNotes).toHaveBeenCalledWith(
        episode._id.toString()
      );
    });
    
    it('should return 404 for non-existent episode', async () => {
      req.params.episodeId = new mongoose.Types.ObjectId().toString();
      req.body.showNotes = 'Some show notes';
      
      await showNotesController.updateEpisodeShowNotes(req, res);
      
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Episode not found'
      }));
    });
  });
  
  describe('getShowNotesAnalysisSummary', () => {
    it('should return analysis summary for episode', async () => {
      // Create test episode
      const episode = new Episode({
        title: 'Test Episode',
        podcastId: new mongoose.Types.ObjectId(),
        guid: 'test-guid',
        url: 'https://example.com/episode',
        audioUrl: 'https://example.com/audio.mp3',
        publishDate: new Date(),
        showNotes: 'Test show notes content'
      });
      await episode.save();
      
      // Create test references
      const references = [
        new Reference({
          sourceContentId: episode._id,
          referenceType: 'mention',
          title: 'Matched Reference',
          metadata: { showNotesMatch: true, showNotesConfidence: 0.9 }
        }),
        new Reference({
          sourceContentId: episode._id,
          referenceType: 'link',
          title: 'Show Notes Only',
          metadata: { extractedFrom: 'show_notes' }
        }),
        new Reference({
          sourceContentId: episode._id,
          referenceType: 'citation',
          title: 'Transcript Only'
        })
      ];
      
      await Promise.all(references.map(ref => ref.save()));
      
      // Set up request
      req.params.episodeId = episode._id.toString();
      
      // Call controller method
      await showNotesController.getShowNotesAnalysisSummary(req, res);
      
      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        episode: expect.objectContaining({
          id: episode._id.toString(),
          title: 'Test Episode',
          hasShowNotes: true
        }),
        summary: expect.objectContaining({
          totalReferences: 3,
          showNotesMatched: 1,
          showNotesOnly: 1,
          transcriptOnly: 1
        })
      }));
    });
    
    it('should return 404 for non-existent episode', async () => {
      req.params.episodeId = new mongoose.Types.ObjectId().toString();
      
      await showNotesController.getShowNotesAnalysisSummary(req, res);
      
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Episode not found'
      }));
    });
  });
  
  describe('batchAnalyzeShowNotes', () => {
    it('should batch analyze specific episodes', async () => {
      // Create test episodes
      const episodes = [
        new Episode({
          title: 'Episode 1',
          podcastId: new mongoose.Types.ObjectId(),
          guid: 'test-guid-1',
          url: 'https://example.com/episode1',
          audioUrl: 'https://example.com/audio1.mp3',
          publishDate: new Date(),
          showNotes: 'Show notes for episode 1'
        }),
        new Episode({
          title: 'Episode 2',
          podcastId: new mongoose.Types.ObjectId(),
          guid: 'test-guid-2',
          url: 'https://example.com/episode2',
          audioUrl: 'https://example.com/audio2.mp3',
          publishDate: new Date(),
          showNotes: 'Show notes for episode 2'
        })
      ];
      
      await Promise.all(episodes.map(ep => ep.save()));
      
      // Mock analysis results
      showNotesAnalyzer.analyzeEpisodeShowNotes
        .mockResolvedValueOnce({
          success: true,
          summary: { newReferences: 1 }
        })
        .mockResolvedValueOnce({
          success: true,
          summary: { newReferences: 2 }
        });
      
      // Set up request
      req.body = {
        episodeIds: episodes.map(ep => ep._id.toString())
      };
      
      // Call controller method
      await showNotesController.batchAnalyzeShowNotes(req, res);
      
      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Batch show notes analysis completed',
        results: expect.objectContaining({
          processed: 2,
          successful: 2,
          failed: 0,
          total: 2
        })
      }));
      
      // Verify analyzer was called for each episode
      expect(showNotesAnalyzer.analyzeEpisodeShowNotes).toHaveBeenCalledTimes(2);
    });
    
    it('should handle episodes without show notes', async () => {
      // Set up request with no episodes
      req.body = { limit: 10 };
      
      // Call controller method
      await showNotesController.batchAnalyzeShowNotes(req, res);
      
      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'No episodes with show notes found',
        results: expect.objectContaining({
          processed: 0,
          successful: 0,
          failed: 0,
          total: 0
        })
      }));
    });
    
    it('should return 400 for invalid episode IDs', async () => {
      req.body = {
        episodeIds: ['invalid-id', 'another-invalid-id']
      };
      
      await showNotesController.batchAnalyzeShowNotes(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Invalid episode IDs',
        invalidIds: ['invalid-id', 'another-invalid-id']
      }));
    });
  });
});