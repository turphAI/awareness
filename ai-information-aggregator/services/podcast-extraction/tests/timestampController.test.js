/**
 * Timestamp Controller Tests
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Reference = require('../../content-discovery/models/Reference');
const Episode = require('../models/Episode');
const Transcript = require('../models/Transcript');

// Mock the timestamp linker
jest.mock('../utils/timestampLinker', () => ({
  linkReferenceToTimestamp: jest.fn(),
  batchLinkReferences: jest.fn(),
  getTimestampedReferences: jest.fn(),
  createReferenceTimeline: jest.fn(),
  extractTimestampFromContext: jest.fn(),
  _generatePlaybackUrl: jest.fn(),
  _normalizeTimestamp: jest.fn()
}));

const timestampLinker = require('../utils/timestampLinker');
const timestampController = require('../controllers/timestampController');

describe('Timestamp Controller', () => {
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
    await Reference.deleteMany({});
    await Episode.deleteMany({});
    await Transcript.deleteMany({});
    
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
  
  describe('linkReferenceToTimestamp', () => {
    it('should link reference to timestamp successfully', async () => {
      // Create test reference
      const reference = new Reference({
        sourceContentId: new mongoose.Types.ObjectId(),
        referenceType: 'mention',
        title: 'Test Reference'
      });
      await reference.save();
      
      // Mock timestamp linker response
      timestampLinker.linkReferenceToTimestamp.mockResolvedValueOnce({
        success: true,
        reference: reference,
        playbackUrl: 'https://example.com/audio.mp3?t=300'
      });
      
      // Set up request
      req.params.referenceId = reference._id.toString();
      req.body = {
        episodeId: new mongoose.Types.ObjectId().toString(),
        timestamp: '05:00',
        context: 'Test context'
      };
      
      // Call controller method
      await timestampController.linkReferenceToTimestamp(req, res);
      
      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Reference linked to timestamp successfully'
      }));
      
      // Verify timestamp linker was called correctly
      expect(timestampLinker.linkReferenceToTimestamp).toHaveBeenCalledWith(
        expect.objectContaining({ _id: reference._id }),
        req.body.episodeId,
        '05:00',
        'Test context'
      );
    });
    
    it('should return 400 for invalid reference ID', async () => {
      req.params.referenceId = 'invalid-id';
      req.body = {
        episodeId: new mongoose.Types.ObjectId().toString(),
        timestamp: '05:00'
      };
      
      await timestampController.linkReferenceToTimestamp(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Invalid reference ID'
      }));
    });
    
    it('should return 400 for missing timestamp', async () => {
      req.params.referenceId = new mongoose.Types.ObjectId().toString();
      req.body = {
        episodeId: new mongoose.Types.ObjectId().toString()
        // timestamp missing
      };
      
      await timestampController.linkReferenceToTimestamp(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Timestamp is required'
      }));
    });
    
    it('should return 404 for non-existent reference', async () => {
      req.params.referenceId = new mongoose.Types.ObjectId().toString();
      req.body = {
        episodeId: new mongoose.Types.ObjectId().toString(),
        timestamp: '05:00'
      };
      
      await timestampController.linkReferenceToTimestamp(req, res);
      
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Reference not found'
      }));
    });
  });
  
  describe('batchLinkReferences', () => {
    it('should batch link references successfully', async () => {
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
      
      // Create test references
      const references = [
        new Reference({
          sourceContentId: episode._id,
          referenceType: 'mention',
          title: 'Reference 1'
        }),
        new Reference({
          sourceContentId: episode._id,
          referenceType: 'mention',
          title: 'Reference 2'
        })
      ];
      await Promise.all(references.map(ref => ref.save()));
      
      // Mock batch linking response
      timestampLinker.batchLinkReferences.mockResolvedValueOnce({
        success: true,
        results: {
          linked: 2,
          estimated: 0,
          failed: 0,
          total: 2,
          details: []
        }
      });
      
      // Set up request
      req.params.episodeId = episode._id.toString();
      
      // Call controller method
      await timestampController.batchLinkReferences(req, res);
      
      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Batch timestamp linking completed'
      }));
      
      // Verify timestamp linker was called
      expect(timestampLinker.batchLinkReferences).toHaveBeenCalledWith(
        episode._id.toString(),
        expect.arrayContaining([
          expect.objectContaining({ title: 'Reference 1' }),
          expect.objectContaining({ title: 'Reference 2' })
        ])
      );
    });
    
    it('should handle episode with no references needing linking', async () => {
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
      
      // Set up request
      req.params.episodeId = episode._id.toString();
      
      // Call controller method
      await timestampController.batchLinkReferences(req, res);
      
      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'No references found that need timestamp linking'
      }));
    });
  });
  
  describe('getTimestampedReferences', () => {
    it('should return timestamped references for an episode', async () => {
      const episodeId = new mongoose.Types.ObjectId().toString();
      
      // Mock timestamped references response
      const mockReferences = [
        {
          _id: new mongoose.Types.ObjectId(),
          title: 'Reference 1',
          timestamp: '05:00',
          playbackUrl: 'https://example.com/audio.mp3?t=300'
        },
        {
          _id: new mongoose.Types.ObjectId(),
          title: 'Reference 2',
          timestamp: '10:00',
          playbackUrl: 'https://example.com/audio.mp3?t=600'
        }
      ];
      
      timestampLinker.getTimestampedReferences.mockResolvedValueOnce(mockReferences);
      
      // Set up request
      req.params.episodeId = episodeId;
      req.query = { sortBy: 'timestamp', order: 'asc', limit: '10' };
      
      // Call controller method
      await timestampController.getTimestampedReferences(req, res);
      
      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        episodeId,
        references: mockReferences,
        total: 2
      }));
      
      // Verify timestamp linker was called with correct options
      expect(timestampLinker.getTimestampedReferences).toHaveBeenCalledWith(episodeId, {
        sortBy: 'timestamp',
        order: 'asc',
        limit: 10
      });
    });
  });
  
  describe('createReferenceTimeline', () => {
    it('should create reference timeline for an episode', async () => {
      const episodeId = new mongoose.Types.ObjectId().toString();
      
      // Mock timeline response
      const mockTimeline = {
        episodeId,
        episodeTitle: 'Test Episode',
        totalReferences: 3,
        segments: [
          {
            startTime: 0,
            endTime: 300,
            references: [{ title: 'Reference 1' }]
          },
          {
            startTime: 300,
            endTime: 600,
            references: [{ title: 'Reference 2' }, { title: 'Reference 3' }]
          }
        ]
      };
      
      timestampLinker.createReferenceTimeline.mockResolvedValueOnce(mockTimeline);
      
      // Set up request
      req.params.episodeId = episodeId;
      
      // Call controller method
      await timestampController.createReferenceTimeline(req, res);
      
      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockTimeline);
      
      // Verify timestamp linker was called
      expect(timestampLinker.createReferenceTimeline).toHaveBeenCalledWith(episodeId);
    });
  });
  
  describe('extractTimestampFromContext', () => {
    it('should extract timestamp from context successfully', async () => {
      // Mock extraction response
      timestampLinker.extractTimestampFromContext.mockResolvedValueOnce({
        found: true,
        timestamp: '05:30',
        confidence: 0.8
      });
      
      // Set up request
      req.body = {
        transcriptText: 'This is a transcript with [05:30] timestamp',
        referenceContext: 'reference context'
      };
      
      // Call controller method
      await timestampController.extractTimestampFromContext(req, res);
      
      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        found: true,
        timestamp: '05:30',
        confidence: 0.8
      }));
      
      // Verify timestamp linker was called
      expect(timestampLinker.extractTimestampFromContext).toHaveBeenCalledWith(
        'This is a transcript with [05:30] timestamp',
        'reference context'
      );
    });
    
    it('should return 400 for missing required fields', async () => {
      req.body = {
        transcriptText: 'Some text'
        // referenceContext missing
      };
      
      await timestampController.extractTimestampFromContext(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Both transcriptText and referenceContext are required'
      }));
    });
  });
  
  describe('generatePlaybackUrl', () => {
    it('should generate playback URL for a reference', async () => {
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
      
      // Create test reference with timestamp
      const reference = new Reference({
        sourceContentId: episode._id,
        referenceType: 'mention',
        title: 'Test Reference',
        contextLocation: { value: '05:00', type: 'timestamp' },
        metadata: {
          episodeId: episode._id,
          timestampSeconds: 300
        }
      });
      await reference.save();
      
      // Mock playback URL generation
      timestampLinker._generatePlaybackUrl.mockReturnValueOnce('https://example.com/audio.mp3?t=300');
      
      // Set up request
      req.params.referenceId = reference._id.toString();
      
      // Call controller method
      await timestampController.generatePlaybackUrl(req, res);
      
      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        referenceId: reference._id.toString(),
        episodeId: episode._id.toString(),
        episodeTitle: 'Test Episode',
        timestamp: '05:00',
        timestampSeconds: 300,
        playbackUrl: 'https://example.com/audio.mp3?t=300',
        audioUrl: 'https://example.com/audio.mp3'
      }));
    });
    
    it('should return 400 for reference without timestamp', async () => {
      // Create test reference without timestamp
      const reference = new Reference({
        sourceContentId: new mongoose.Types.ObjectId(),
        referenceType: 'mention',
        title: 'Test Reference'
      });
      await reference.save();
      
      // Set up request
      req.params.referenceId = reference._id.toString();
      
      // Call controller method
      await timestampController.generatePlaybackUrl(req, res);
      
      // Verify response
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Reference is not linked to an episode'
      }));
    });
  });
  
  describe('updateReferenceTimestamp', () => {
    it('should update reference timestamp successfully', async () => {
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
      
      // Create test reference
      const reference = new Reference({
        sourceContentId: episode._id,
        referenceType: 'mention',
        title: 'Test Reference',
        metadata: { episodeId: episode._id }
      });
      await reference.save();
      
      // Mock timestamp normalization
      timestampLinker._normalizeTimestamp.mockReturnValueOnce(600);
      timestampLinker._generatePlaybackUrl.mockReturnValueOnce('https://example.com/audio.mp3?t=600');
      
      // Set up request
      req.params.referenceId = reference._id.toString();
      req.body = {
        timestamp: '10:00',
        context: 'Updated context'
      };
      
      // Call controller method
      await timestampController.updateReferenceTimestamp(req, res);
      
      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Reference timestamp updated successfully'
      }));
      
      // Verify reference was updated in database
      const updatedReference = await Reference.findById(reference._id);
      expect(updatedReference.contextLocation.value).toBe('10:00');
      expect(updatedReference.contextLocation.type).toBe('timestamp');
      expect(updatedReference.context).toBe('Updated context');
    });
  });
  
  describe('removeTimestampLink', () => {
    it('should remove timestamp link from reference', async () => {
      // Create test reference with timestamp
      const reference = new Reference({
        sourceContentId: new mongoose.Types.ObjectId(),
        referenceType: 'mention',
        title: 'Test Reference',
        contextLocation: { value: '05:00', type: 'timestamp' },
        metadata: {
          episodeId: new mongoose.Types.ObjectId(),
          timestampSeconds: 300
        }
      });
      await reference.save();
      
      // Set up request
      req.params.referenceId = reference._id.toString();
      
      // Call controller method
      await timestampController.removeTimestampLink(req, res);
      
      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Timestamp link removed successfully'
      }));
      
      // Verify timestamp information was removed
      const updatedReference = await Reference.findById(reference._id);
      expect(updatedReference.contextLocation.value).toBeUndefined();
      expect(updatedReference.contextLocation.type).toBeUndefined();
      expect(updatedReference.metadata.timestampSeconds).toBeUndefined();
      expect(updatedReference.metadata.episodeId).toBeUndefined();
    });
  });
});