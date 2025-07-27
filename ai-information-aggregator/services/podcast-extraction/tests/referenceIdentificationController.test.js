/**
 * Reference Identification Controller Tests
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Transcript = require('../models/Transcript');
const Episode = require('../models/Episode');
const Reference = require('../../content-discovery/models/Reference');

// Mock dependencies
jest.mock('../utils/referenceIdentifier', () => ({
  identifyReferences: jest.fn()
}));
const referenceIdentifier = require('../utils/referenceIdentifier');

jest.mock('../utils/sourceLocator', () => ({
  locateSource: jest.fn()
}));
const sourceLocator = require('../utils/sourceLocator');

// Import controller after mocks are set up
const referenceIdentificationController = require('../controllers/referenceIdentificationController');

describe('Reference Identification Controller', () => {
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
    await Transcript.deleteMany({});
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
  
  describe('processTranscript', () => {
    it('should process transcript and extract references', async () => {
      // Create test episode and transcript
      const episode = new Episode({
        title: 'Test Episode',
        podcastId: new mongoose.Types.ObjectId()
      });
      await episode.save();
      
      const transcript = new Transcript({
        episodeId: episode._id,
        content: 'This is a test transcript with references to papers.',
        processed: false
      });
      await transcript.save();
      
      // Mock reference identification
      const mockReferences = [
        {
          type: 'mention',
          title: 'Paper 1',
          authors: ['Author 1'],
          timestamp: '00:05:30'
        },
        {
          type: 'citation',
          title: 'Paper 2',
          authors: ['Author 2'],
          timestamp: '00:10:15'
        }
      ];
      referenceIdentifier.identifyReferences.mockResolvedValueOnce(mockReferences);
      
      // Set up request
      req.params.transcriptId = transcript._id.toString();
      
      // Call controller method
      await referenceIdentificationController.processTranscript(req, res);
      
      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Transcript processed successfully',
        referencesFound: 2
      }));
      
      // Verify transcript was updated
      const updatedTranscript = await Transcript.findById(transcript._id);
      expect(updatedTranscript.processed).toBe(true);
      expect(updatedTranscript.referenceCount).toBe(2);
      
      // Verify references were created
      const references = await Reference.find({ sourceContentId: episode._id });
      expect(references).toHaveLength(2);
      expect(references[0].title).toBe('Paper 1');
      expect(references[1].title).toBe('Paper 2');
    });
    
    it('should return 404 for non-existent transcript', async () => {
      // Set up request with non-existent ID
      req.params.transcriptId = new mongoose.Types.ObjectId().toString();
      
      // Call controller method
      await referenceIdentificationController.processTranscript(req, res);
      
      // Verify response
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Transcript not found'
      }));
    });
    
    it('should return 400 for invalid transcript ID', async () => {
      // Set up request with invalid ID
      req.params.transcriptId = 'invalid-id';
      
      // Call controller method
      await referenceIdentificationController.processTranscript(req, res);
      
      // Verify response
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Invalid transcript ID'
      }));
    });
  });
  
  describe('locateSource', () => {
    it('should locate source for a reference successfully', async () => {
      // Create test reference
      const reference = new Reference({
        title: 'Test Reference',
        authors: ['Test Author'],
        sourceContentId: new mongoose.Types.ObjectId(),
        resolved: false
      });
      await reference.save();
      
      // Mock source location with success
      sourceLocator.locateSource.mockResolvedValueOnce({
        found: true,
        sourceType: 'existing',
        source: {
          _id: new mongoose.Types.ObjectId(),
          title: 'Located Source',
          url: 'https://example.com/source'
        }
      });
      
      // Set up request
      req.params.referenceId = reference._id.toString();
      
      // Call controller method
      await referenceIdentificationController.locateSource(req, res);
      
      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Source located successfully'
      }));
      
      // Verify reference was updated
      const updatedReference = await Reference.findById(reference._id);
      expect(updatedReference.resolved).toBe(true);
      expect(updatedReference.targetContentId).toBeDefined();
    });
    
    it('should queue reference for manual resolution when source not found', async () => {
      // Create test reference
      const reference = new Reference({
        title: 'Test Reference',
        authors: ['Test Author'],
        sourceContentId: new mongoose.Types.ObjectId(),
        resolved: false
      });
      await reference.save();
      
      // Mock source location with failure
      sourceLocator.locateSource.mockResolvedValueOnce({
        found: false,
        message: 'Source not found automatically, queued for manual resolution'
      });
      
      // Set up request
      req.params.referenceId = reference._id.toString();
      
      // Call controller method
      await referenceIdentificationController.locateSource(req, res);
      
      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Source not found automatically, queued for manual resolution'
      }));
      
      // Verify reference was updated
      const updatedReference = await Reference.findById(reference._id);
      expect(updatedReference.needsManualResolution).toBe(true);
      expect(updatedReference.resolutionAttempts).toBe(1);
    });
    
    it('should return 404 for non-existent reference', async () => {
      // Set up request with non-existent ID
      req.params.referenceId = new mongoose.Types.ObjectId().toString();
      
      // Call controller method
      await referenceIdentificationController.locateSource(req, res);
      
      // Verify response
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Reference not found'
      }));
    });
  });
  
  describe('batchLocateSources', () => {
    it('should process multiple references for an episode', async () => {
      // Create test episode
      const episode = new Episode({
        title: 'Test Episode',
        podcastId: new mongoose.Types.ObjectId()
      });
      await episode.save();
      
      // Create test references
      const references = [
        new Reference({
          title: 'Reference 1',
          sourceContentId: episode._id,
          resolved: false
        }),
        new Reference({
          title: 'Reference 2',
          sourceContentId: episode._id,
          resolved: false
        }),
        new Reference({
          title: 'Reference 3',
          sourceContentId: episode._id,
          resolved: false
        })
      ];
      
      await Promise.all(references.map(ref => ref.save()));
      
      // Mock source location with mixed results
      sourceLocator.locateSource
        .mockResolvedValueOnce({
          found: true,
          sourceType: 'existing',
          source: { _id: new mongoose.Types.ObjectId() }
        })
        .mockResolvedValueOnce({
          found: false,
          message: 'Source not found'
        })
        .mockResolvedValueOnce({
          found: true,
          sourceType: 'new',
          source: { url: 'https://example.com/new' }
        });
      
      // Set up request
      req.params.episodeId = episode._id.toString();
      
      // Call controller method
      await referenceIdentificationController.batchLocateSources(req, res);
      
      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Batch source location completed',
        results: expect.objectContaining({
          resolved: 2,
          manualResolution: 1,
          total: 3
        })
      }));
      
      // Verify references were updated
      const updatedReferences = await Reference.find({ sourceContentId: episode._id });
      expect(updatedReferences.filter(ref => ref.resolved)).toHaveLength(2);
      expect(updatedReferences.filter(ref => ref.needsManualResolution)).toHaveLength(1);
      
      // Verify episode was updated
      const updatedEpisode = await Episode.findById(episode._id);
      expect(updatedEpisode.referencesResolved).toBe(2);
      expect(updatedEpisode.referencesNeedingManualResolution).toBe(1);
    });
    
    it('should return appropriate message when no unresolved references exist', async () => {
      // Create test episode
      const episode = new Episode({
        title: 'Test Episode',
        podcastId: new mongoose.Types.ObjectId()
      });
      await episode.save();
      
      // Set up request
      req.params.episodeId = episode._id.toString();
      
      // Call controller method
      await referenceIdentificationController.batchLocateSources(req, res);
      
      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'No unresolved references found for this episode',
        resolved: 0,
        total: 0
      }));
    });
  });
  
  describe('manuallyResolveReference', () => {
    it('should manually resolve a reference', async () => {
      // Create test reference
      const reference = new Reference({
        title: 'Test Reference',
        authors: ['Test Author'],
        sourceContentId: new mongoose.Types.ObjectId(),
        resolved: false,
        needsManualResolution: true
      });
      await reference.save();
      
      // Set up request
      req.params.referenceId = reference._id.toString();
      req.body = {
        url: 'https://example.com/manual',
        title: 'Updated Title',
        authors: ['Updated Author'],
        publishDate: '2023-05-15'
      };
      
      // Call controller method
      await referenceIdentificationController.manuallyResolveReference(req, res);
      
      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Reference manually resolved successfully'
      }));
      
      // Verify reference was updated
      const updatedReference = await Reference.findById(reference._id);
      expect(updatedReference.resolved).toBe(true);
      expect(updatedReference.needsManualResolution).toBe(false);
      expect(updatedReference.manuallyResolved).toBe(true);
      expect(updatedReference.url).toBe('https://example.com/manual');
      expect(updatedReference.title).toBe('Updated Title');
      expect(updatedReference.authors).toEqual(['Updated Author']);
      expect(updatedReference.publishDate).toBeInstanceOf(Date);
    });
  });
  
  describe('getReferencesNeedingResolution', () => {
    it('should return references needing manual resolution', async () => {
      // Create test references
      const references = [
        new Reference({
          title: 'Reference 1',
          sourceContentId: new mongoose.Types.ObjectId(),
          needsManualResolution: true,
          resolutionAttempts: 3
        }),
        new Reference({
          title: 'Reference 2',
          sourceContentId: new mongoose.Types.ObjectId(),
          needsManualResolution: true,
          resolutionAttempts: 2
        }),
        new Reference({
          title: 'Reference 3',
          sourceContentId: new mongoose.Types.ObjectId(),
          needsManualResolution: true,
          resolutionAttempts: 1
        }),
        new Reference({
          title: 'Reference 4',
          sourceContentId: new mongoose.Types.ObjectId(),
          needsManualResolution: false
        })
      ];
      
      await Promise.all(references.map(ref => ref.save()));
      
      // Set up request
      req.query = { limit: '2', skip: '0' };
      
      // Call controller method
      await referenceIdentificationController.getReferencesNeedingResolution(req, res);
      
      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        references: expect.arrayContaining([
          expect.objectContaining({ title: 'Reference 1' }),
          expect.objectContaining({ title: 'Reference 2' })
        ]),
        total: 3,
        limit: 2,
        skip: 0
      }));
      
      // Verify sorting (by resolutionAttempts descending)
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.references[0].title).toBe('Reference 1');
      expect(responseData.references[1].title).toBe('Reference 2');
    });
  });
});