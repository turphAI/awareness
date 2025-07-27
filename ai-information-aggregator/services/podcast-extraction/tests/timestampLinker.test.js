/**
 * Timestamp Linker Tests
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const timestampLinker = require('../utils/timestampLinker');
const Reference = require('../../content-discovery/models/Reference');
const Episode = require('../models/Episode');
const Transcript = require('../models/Transcript');

describe('Timestamp Linker', () => {
  let mongoServer;
  
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
    // Clear database collections before each test
    await Reference.deleteMany({});
    await Episode.deleteMany({});
    await Transcript.deleteMany({});
  });
  
  describe('linkReferenceToTimestamp', () => {
    it('should link a reference to a timestamp successfully', async () => {
      // Create test episode
      const episode = new Episode({
        title: 'Test Episode',
        podcastId: new mongoose.Types.ObjectId(),
        guid: 'test-guid',
        url: 'https://example.com/episode',
        audioUrl: 'https://example.com/audio.mp3',
        publishDate: new Date(),
        duration: 3600 // 1 hour
      });
      await episode.save();
      
      // Create test reference
      const reference = new Reference({
        sourceContentId: episode._id,
        referenceType: 'mention',
        title: 'Test Paper',
        context: 'This is a great paper about AI'
      });
      await reference.save();
      
      // Link reference to timestamp
      const result = await timestampLinker.linkReferenceToTimestamp(
        reference,
        episode._id.toString(),
        '15:30',
        'Context around the reference'
      );
      
      // Verify result
      expect(result.success).toBe(true);
      expect(result.reference.contextLocation.value).toBe('15:30');
      expect(result.reference.contextLocation.type).toBe('timestamp');
      expect(result.reference.metadata.timestampSeconds).toBe(930); // 15:30 in seconds
      expect(result.playbackUrl).toContain('t=930');
    });
    
    it('should handle HH:MM:SS timestamp format', async () => {
      // Create test episode
      const episode = new Episode({
        title: 'Test Episode',
        podcastId: new mongoose.Types.ObjectId(),
        guid: 'test-guid',
        url: 'https://example.com/episode',
        audioUrl: 'https://example.com/audio.mp3',
        publishDate: new Date(),
        duration: 7200 // 2 hours
      });
      await episode.save();
      
      // Create test reference
      const reference = new Reference({
        sourceContentId: episode._id,
        referenceType: 'citation',
        title: 'Research Paper'
      });
      await reference.save();
      
      // Link reference to timestamp in HH:MM:SS format
      const result = await timestampLinker.linkReferenceToTimestamp(
        reference,
        episode._id.toString(),
        '01:15:30'
      );
      
      // Verify result
      expect(result.success).toBe(true);
      expect(result.reference.metadata.timestampSeconds).toBe(4530); // 1:15:30 in seconds
    });
    
    it('should throw error for non-existent episode', async () => {
      // Create test reference
      const reference = new Reference({
        sourceContentId: new mongoose.Types.ObjectId(),
        referenceType: 'mention',
        title: 'Test Paper'
      });
      await reference.save();
      
      // Try to link to non-existent episode
      await expect(
        timestampLinker.linkReferenceToTimestamp(
          reference,
          new mongoose.Types.ObjectId().toString(),
          '10:00'
        )
      ).rejects.toThrow('Episode');
    });
  });
  
  describe('extractTimestampFromContext', () => {
    it('should extract timestamp from transcript with HH:MM:SS format', async () => {
      const transcriptText = `
        Welcome to the show. Today we're talking about AI.
        [00:05:30] Let me mention this great paper by Smith et al.
        It's really groundbreaking work in machine learning.
        [00:10:15] Moving on to our next topic...
      `;
      
      const referenceContext = 'this great paper by Smith et al';
      
      const result = await timestampLinker.extractTimestampFromContext(
        transcriptText,
        referenceContext
      );
      
      expect(result.found).toBe(true);
      expect(result.timestamp).toBe('00:05:30');
      expect(result.confidence).toBeGreaterThan(0.5);
    });
    
    it('should extract timestamp from transcript with MM:SS format', async () => {
      const transcriptText = `
        Welcome to the show.
        5:30 So there's this paper about neural networks
        that I want to discuss today.
        10:15 Let's move on to the next topic.
      `;
      
      const referenceContext = 'paper about neural networks';
      
      const result = await timestampLinker.extractTimestampFromContext(
        transcriptText,
        referenceContext
      );
      
      expect(result.found).toBe(true);
      expect(result.timestamp).toBe('5:30');
    });
    
    it('should estimate timestamp when no explicit timestamp found', async () => {
      const transcriptText = `
        This is the beginning of the transcript.
        We talk about various topics here.
        In the middle, we mention this important research paper.
        Then we continue with other discussions.
        This is the end of the transcript.
      `;
      
      const referenceContext = 'important research paper';
      
      const result = await timestampLinker.extractTimestampFromContext(
        transcriptText,
        referenceContext
      );
      
      expect(result.found).toBe(true);
      expect(result.estimated).toBe(true);
      expect(result.confidence).toBe(0.3); // Low confidence for estimated
    });
    
    it('should return not found when context is not in transcript', async () => {
      const transcriptText = 'This is a simple transcript without the reference.';
      const referenceContext = 'non-existent reference';
      
      const result = await timestampLinker.extractTimestampFromContext(
        transcriptText,
        referenceContext
      );
      
      expect(result.found).toBe(false);
    });
  });
  
  describe('batchLinkReferences', () => {
    it('should batch link multiple references', async () => {
      // Create test episode
      const episode = new Episode({
        title: 'Test Episode',
        podcastId: new mongoose.Types.ObjectId(),
        guid: 'test-guid',
        url: 'https://example.com/episode',
        audioUrl: 'https://example.com/audio.mp3',
        publishDate: new Date(),
        duration: 3600
      });
      await episode.save();
      
      // Create test transcript
      const transcript = new Transcript({
        episodeId: episode._id,
        content: `
          [00:05:00] Welcome to the show. Today we discuss the Smith paper.
          [00:10:30] Another interesting work is the Johnson research.
          [00:15:45] Let's also mention the Brown study.
        `
      });
      await transcript.save();
      
      // Create test references
      const references = [
        new Reference({
          sourceContentId: episode._id,
          referenceType: 'mention',
          title: 'Smith Paper',
          context: 'Smith paper'
        }),
        new Reference({
          sourceContentId: episode._id,
          referenceType: 'mention',
          title: 'Johnson Research',
          context: 'Johnson research'
        }),
        new Reference({
          sourceContentId: episode._id,
          referenceType: 'mention',
          title: 'Brown Study',
          context: 'Brown study'
        })
      ];
      
      await Promise.all(references.map(ref => ref.save()));
      
      // Batch link references
      const result = await timestampLinker.batchLinkReferences(episode._id.toString(), references);
      
      // Verify result
      expect(result.success).toBe(true);
      expect(result.results.total).toBe(3);
      expect(result.results.linked + result.results.estimated).toBeGreaterThan(0);
      expect(result.results.details).toHaveLength(3);
    });
    
    it('should handle episode without transcript', async () => {
      // Create test episode without transcript
      const episode = new Episode({
        title: 'Test Episode',
        podcastId: new mongoose.Types.ObjectId(),
        guid: 'test-guid',
        url: 'https://example.com/episode',
        audioUrl: 'https://example.com/audio.mp3',
        publishDate: new Date()
      });
      await episode.save();
      
      const references = [
        new Reference({
          sourceContentId: episode._id,
          referenceType: 'mention',
          title: 'Test Paper'
        })
      ];
      
      await Promise.all(references.map(ref => ref.save()));
      
      // Try to batch link without transcript
      const result = await timestampLinker.batchLinkReferences(episode._id.toString(), references);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('transcript');
    });
  });
  
  describe('getTimestampedReferences', () => {
    it('should return timestamped references sorted by timestamp', async () => {
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
      
      // Create test references with timestamps
      const references = [
        new Reference({
          sourceContentId: episode._id,
          referenceType: 'mention',
          title: 'Second Reference',
          contextLocation: { value: '10:00', type: 'timestamp' },
          metadata: { episodeId: episode._id, timestampSeconds: 600 }
        }),
        new Reference({
          sourceContentId: episode._id,
          referenceType: 'mention',
          title: 'First Reference',
          contextLocation: { value: '05:00', type: 'timestamp' },
          metadata: { episodeId: episode._id, timestampSeconds: 300 }
        }),
        new Reference({
          sourceContentId: episode._id,
          referenceType: 'mention',
          title: 'Third Reference',
          contextLocation: { value: '15:00', type: 'timestamp' },
          metadata: { episodeId: episode._id, timestampSeconds: 900 }
        })
      ];
      
      await Promise.all(references.map(ref => ref.save()));
      
      // Get timestamped references
      const result = await timestampLinker.getTimestampedReferences(episode._id.toString());
      
      // Verify result
      expect(result).toHaveLength(3);
      expect(result[0].title).toBe('First Reference');
      expect(result[1].title).toBe('Second Reference');
      expect(result[2].title).toBe('Third Reference');
      expect(result[0].playbackUrl).toContain('t=300');
      expect(result[0].formattedTimestamp).toBe('05:00');
    });
  });
  
  describe('createReferenceTimeline', () => {
    it('should create a timeline with time segments', async () => {
      // Create test episode
      const episode = new Episode({
        title: 'Test Episode',
        podcastId: new mongoose.Types.ObjectId(),
        guid: 'test-guid',
        url: 'https://example.com/episode',
        audioUrl: 'https://example.com/audio.mp3',
        publishDate: new Date(),
        duration: 1800 // 30 minutes
      });
      await episode.save();
      
      // Create test references with timestamps in different segments
      const references = [
        new Reference({
          sourceContentId: episode._id,
          referenceType: 'mention',
          title: 'Early Reference',
          contextLocation: { value: '02:00', type: 'timestamp' },
          metadata: { episodeId: episode._id, timestampSeconds: 120 }
        }),
        new Reference({
          sourceContentId: episode._id,
          referenceType: 'mention',
          title: 'Mid Reference',
          contextLocation: { value: '08:00', type: 'timestamp' },
          metadata: { episodeId: episode._id, timestampSeconds: 480 }
        }),
        new Reference({
          sourceContentId: episode._id,
          referenceType: 'mention',
          title: 'Late Reference',
          contextLocation: { value: '15:00', type: 'timestamp' },
          metadata: { episodeId: episode._id, timestampSeconds: 900 }
        })
      ];
      
      await Promise.all(references.map(ref => ref.save()));
      
      // Create timeline
      const timeline = await timestampLinker.createReferenceTimeline(episode._id.toString());
      
      // Verify timeline
      expect(timeline.episodeId).toBe(episode._id.toString());
      expect(timeline.episodeTitle).toBe('Test Episode');
      expect(timeline.totalReferences).toBe(3);
      expect(timeline.segments).toHaveLength(3); // References in different 5-minute segments
      
      // Check first segment (0-5 minutes)
      const firstSegment = timeline.segments.find(s => s.startTime === 0);
      expect(firstSegment).toBeDefined();
      expect(firstSegment.references).toHaveLength(1);
      expect(firstSegment.references[0].title).toBe('Early Reference');
      
      // Check second segment (5-10 minutes)
      const secondSegment = timeline.segments.find(s => s.startTime === 300);
      expect(secondSegment).toBeDefined();
      expect(secondSegment.references).toHaveLength(1);
      expect(secondSegment.references[0].title).toBe('Mid Reference');
    });
  });
  
  describe('_normalizeTimestamp', () => {
    it('should normalize HH:MM:SS format', () => {
      expect(timestampLinker._normalizeTimestamp('01:30:45')).toBe(5445);
    });
    
    it('should normalize MM:SS format', () => {
      expect(timestampLinker._normalizeTimestamp('15:30')).toBe(930);
    });
    
    it('should handle numeric input', () => {
      expect(timestampLinker._normalizeTimestamp(300)).toBe(300);
    });
    
    it('should handle string numeric input', () => {
      expect(timestampLinker._normalizeTimestamp('300')).toBe(300);
    });
    
    it('should throw error for invalid format', () => {
      expect(() => timestampLinker._normalizeTimestamp('invalid')).toThrow('Invalid timestamp format');
    });
  });
  
  describe('_formatTimestamp', () => {
    it('should format seconds to HH:MM:SS when hours > 0', () => {
      expect(timestampLinker._formatTimestamp(3661)).toBe('01:01:01');
    });
    
    it('should format seconds to MM:SS when hours = 0', () => {
      expect(timestampLinker._formatTimestamp(930)).toBe('15:30');
    });
    
    it('should pad with zeros', () => {
      expect(timestampLinker._formatTimestamp(65)).toBe('01:05');
    });
  });
});