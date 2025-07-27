const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const referenceIdentifier = require('../utils/referenceIdentifier');
const Transcript = require('../models/Transcript');
const Episode = require('../models/Episode');
const Reference = require('../../content-discovery/models/Reference');
const Content = require('../../content-discovery/models/Content');

// Mock dependencies
jest.mock('../../../common/utils/logger', () => {
  return () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  });
});

describe('Reference Identifier', () => {
  let mongoServer;
  
  // Set up MongoDB Memory Server
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri(), {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
  });
  
  // Clean up after tests
  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });
  
  // Clear database between tests
  beforeEach(async () => {
    await Transcript.deleteMany({});
    await Episode.deleteMany({});
    await Reference.deleteMany({});
    await Content.deleteMany({});
  });
  
  describe('extractUrlReferences', () => {
    test('should extract URLs from text', () => {
      // Arrange
      const text = 'Check out this website https://example.com and also visit http://test.org/page';
      const segments = [
        { text: 'Check out this website https://example.com', startTime: 10, endTime: 15 },
        { text: 'and also visit http://test.org/page', startTime: 16, endTime: 20 }
      ];
      
      // Act
      const result = referenceIdentifier.extractUrlReferences(text, segments);
      
      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].url).toBe('https://example.com');
      expect(result[0].referenceType).toBe('link');
      expect(result[0].contextLocation.value).toBe('10');
      expect(result[1].url).toBe('http://test.org/page');
      expect(result[1].contextLocation.value).toBe('16');
    });
    
    test('should return empty array when no URLs are found', () => {
      // Arrange
      const text = 'This text contains no URLs';
      const segments = [{ text, startTime: 10, endTime: 15 }];
      
      // Act
      const result = referenceIdentifier.extractUrlReferences(text, segments);
      
      // Assert
      expect(result).toHaveLength(0);
    });
  });
  
  describe('extractEntityReferences', () => {
    test('should extract named entities from text', () => {
      // Arrange
      const text = 'John Smith published a paper about AI. Google Research also released a study.';
      const segments = [
        { text: 'John Smith published a paper about AI.', startTime: 10, endTime: 15 },
        { text: 'Google Research also released a study.', startTime: 16, endTime: 20 }
      ];
      
      // Act
      const result = referenceIdentifier.extractEntityReferences(text, segments);
      
      // Assert
      expect(result.length).toBeGreaterThan(0);
      expect(result.some(ref => ref.title === 'John Smith')).toBe(true);
      expect(result.some(ref => ref.title === 'Google Research')).toBe(true);
      expect(result.every(ref => ref.referenceType === 'mention')).toBe(true);
    });
  });
  
  describe('extractPaperReferences', () => {
    test('should extract paper references from text', () => {
      // Arrange
      const text = 'The paper titled "A Framework for AI Research" discusses important concepts. Another study called "Machine Learning Applications" was published last year.';
      const segments = [
        { text: 'The paper titled "A Framework for AI Research" discusses important concepts.', startTime: 10, endTime: 15 },
        { text: 'Another study called "Machine Learning Applications" was published last year.', startTime: 16, endTime: 20 }
      ];
      
      // Act
      const result = referenceIdentifier.extractPaperReferences(text, segments);
      
      // Assert
      expect(result.length).toBeGreaterThan(0);
      expect(result.some(ref => ref.title === 'A Framework for AI Research')).toBe(true);
      expect(result.some(ref => ref.title === 'Machine Learning Applications')).toBe(true);
      expect(result.every(ref => ref.referenceType === 'citation')).toBe(true);
    });
  });
  
  describe('extractPatternReferences', () => {
    test('should extract pattern-based references from text', () => {
      // Arrange
      const text = 'According to Stanford University, AI adoption is increasing. Research by MIT shows similar trends.';
      const segments = [
        { text: 'According to Stanford University, AI adoption is increasing.', startTime: 10, endTime: 15 },
        { text: 'Research by MIT shows similar trends.', startTime: 16, endTime: 20 }
      ];
      
      // Act
      const result = referenceIdentifier.extractPatternReferences(text, segments);
      
      // Assert
      expect(result.length).toBeGreaterThan(0);
      expect(result.some(ref => ref.title === 'Stanford University')).toBe(true);
      expect(result.some(ref => ref.title === 'MIT')).toBe(true);
      expect(result.every(ref => ref.referenceType === 'mention')).toBe(true);
    });
  });
  
  describe('processTranscript', () => {
    test('should process transcript and save references', async () => {
      // Arrange
      // Create content
      const content = new Content({
        title: 'Test Podcast Episode',
        url: 'https://example.com/podcast/1',
        type: 'podcast'
      });
      await content.save();
      
      // Create podcast
      const podcast = new mongoose.Types.ObjectId();
      
      // Create episode
      const episode = new Episode({
        podcastId: podcast,
        contentId: content._id,
        title: 'Test Episode',
        description: 'Test description',
        guid: 'test-guid',
        url: 'https://example.com/podcast/1',
        audioUrl: 'https://example.com/podcast/1.mp3',
        publishDate: new Date()
      });
      await episode.save();
      
      // Create transcript
      const transcript = new Transcript({
        episodeId: episode._id,
        fullText: 'According to Stanford University, AI adoption is increasing. Check out https://ai.stanford.edu for more information. The paper titled "A Framework for AI Research" discusses important concepts.',
        segments: [
          { text: 'According to Stanford University, AI adoption is increasing.', startTime: 10, endTime: 15 },
          { text: 'Check out https://ai.stanford.edu for more information.', startTime: 16, endTime: 20 },
          { text: 'The paper titled "A Framework for AI Research" discusses important concepts.', startTime: 21, endTime: 25 }
        ]
      });
      await transcript.save();
      
      // Act
      const result = await referenceIdentifier.processTranscript(transcript);
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.extractedCount).toBeGreaterThan(0);
      expect(result.savedCount).toBeGreaterThan(0);
      
      // Check that references were saved to database
      const savedReferences = await Reference.find({ sourceContentId: content._id });
      expect(savedReferences.length).toBeGreaterThan(0);
      
      // Check that transcript was updated with references
      const updatedTranscript = await Transcript.findById(transcript._id);
      expect(updatedTranscript.references.length).toBeGreaterThan(0);
      expect(updatedTranscript.processingHistory.length).toBeGreaterThan(0);
      expect(updatedTranscript.processingHistory[0].stage).toBe('reference-extraction');
      expect(updatedTranscript.processingHistory[0].success).toBe(true);
    });
    
    test('should handle errors gracefully', async () => {
      // Arrange
      // Create invalid transcript (no episodeId)
      const transcript = new Transcript({
        fullText: 'Test transcript',
        segments: []
      });
      await transcript.save();
      
      // Act
      const result = await referenceIdentifier.processTranscript(transcript);
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});