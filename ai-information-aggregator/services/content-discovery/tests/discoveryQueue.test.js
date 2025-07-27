const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const discoveryQueue = require('../utils/discoveryQueue');
const Content = require('../models/Content');
const Bull = require('bull');

// Mock Bull queue
jest.mock('bull');

// Mock queue methods
const mockQueue = {
  process: jest.fn(),
  on: jest.fn(),
  add: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
  empty: jest.fn().mockResolvedValue(true),
  getWaitingCount: jest.fn().mockResolvedValue(5),
  getActiveCount: jest.fn().mockResolvedValue(2),
  getCompletedCount: jest.fn().mockResolvedValue(10),
  getFailedCount: jest.fn().mockResolvedValue(1),
  getDelayedCount: jest.fn().mockResolvedValue(3),
  clean: jest.fn().mockResolvedValue(true),
  close: jest.fn().mockResolvedValue(true)
};

// Set up Bull mock implementation
Bull.mockImplementation(() => mockQueue);

// Mock Content model
jest.mock('../models/Content', () => ({
  findById: jest.fn(),
  find: jest.fn()
}));

// Mock Reference model
jest.mock('../models/Reference', () => ({}));

// Mock referenceExtractor
jest.mock('../utils/referenceExtractor', () => ({
  extractReferences: jest.fn(),
  processUnresolvedReferences: jest.fn()
}));

// Mock relevanceAssessor
jest.mock('../utils/relevanceAssessor', () => ({
  assessContentRelevance: jest.fn()
}));

describe('Discovery Queue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initializeQueues', () => {
    it('should initialize all queues', () => {
      discoveryQueue.initializeQueues();
      
      // Check if Bull was called to create queues
      expect(Bull).toHaveBeenCalledTimes(4);
      expect(Bull).toHaveBeenCalledWith('content-processing', expect.any(Object));
      expect(Bull).toHaveBeenCalledWith('reference-extraction', expect.any(Object));
      expect(Bull).toHaveBeenCalledWith('reference-resolution', expect.any(Object));
      expect(Bull).toHaveBeenCalledWith('relevance-assessment', expect.any(Object));
      
      // Check if process was called for each queue
      expect(mockQueue.process).toHaveBeenCalledTimes(4);
      
      // Check if event handlers were set up
      expect(mockQueue.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockQueue.on).toHaveBeenCalledWith('failed', expect.any(Function));
      expect(mockQueue.on).toHaveBeenCalledWith('completed', expect.any(Function));
    });
  });

  describe('queueContentProcessing', () => {
    it('should add content to processing queue', async () => {
      const contentId = 'test-content-id';
      const options = { userInterests: ['AI'] };
      
      const result = await discoveryQueue.queueContentProcessing(contentId, options);
      
      // Check if job was added to queue
      expect(mockQueue.add).toHaveBeenCalledWith(
        { contentId, options },
        expect.objectContaining({
          removeOnComplete: true,
          removeOnFail: false,
          attempts: 3
        })
      );
      
      // Check result
      expect(result).toEqual({
        success: true,
        jobId: 'mock-job-id',
        contentId
      });
    });
    
    it('should handle errors when adding to queue', async () => {
      const contentId = 'test-content-id';
      
      // Mock error
      mockQueue.add.mockRejectedValueOnce(new Error('Queue error'));
      
      const result = await discoveryQueue.queueContentProcessing(contentId);
      
      // Check result
      expect(result).toEqual({
        success: false,
        contentId,
        error: 'Queue error'
      });
    });
  });

  describe('queueReferenceExtraction', () => {
    it('should add content to reference extraction queue', async () => {
      const contentId = 'test-content-id';
      
      const result = await discoveryQueue.queueReferenceExtraction(contentId);
      
      // Check if job was added to queue
      expect(mockQueue.add).toHaveBeenCalledWith(
        { contentId },
        expect.objectContaining({
          removeOnComplete: true,
          removeOnFail: false,
          attempts: 3
        })
      );
      
      // Check result
      expect(result).toEqual({
        success: true,
        jobId: 'mock-job-id',
        contentId
      });
    });
  });

  describe('queueReferenceResolution', () => {
    it('should add reference resolution to queue', async () => {
      const limit = 50;
      
      const result = await discoveryQueue.queueReferenceResolution(limit);
      
      // Check if job was added to queue
      expect(mockQueue.add).toHaveBeenCalledWith(
        { limit },
        expect.objectContaining({
          removeOnComplete: true,
          removeOnFail: false,
          attempts: 3
        })
      );
      
      // Check result
      expect(result).toEqual({
        success: true,
        jobId: 'mock-job-id',
        limit
      });
    });
  });

  describe('queueRelevanceAssessment', () => {
    it('should add content to relevance assessment queue', async () => {
      const contentId = 'test-content-id';
      const options = { userInterests: ['AI'] };
      
      const result = await discoveryQueue.queueRelevanceAssessment(contentId, options);
      
      // Check if job was added to queue
      expect(mockQueue.add).toHaveBeenCalledWith(
        { contentId, options },
        expect.objectContaining({
          removeOnComplete: true,
          removeOnFail: false,
          attempts: 3
        })
      );
      
      // Check result
      expect(result).toEqual({
        success: true,
        jobId: 'mock-job-id',
        contentId
      });
    });
  });

  describe('processNewContent', () => {
    it('should queue content for processing', async () => {
      const contentId = 'test-content-id';
      
      // Mock queueContentProcessing
      const mockResult = {
        success: true,
        jobId: 'mock-job-id',
        contentId
      };
      
      // Use the real implementation but with mocked dependencies
      const result = await discoveryQueue.processNewContent(contentId);
      
      // Check if content was queued for processing
      expect(mockQueue.add).toHaveBeenCalled();
      
      // Check result
      expect(result).toEqual({
        success: true,
        contentId,
        message: 'Content queued for processing',
        jobId: 'mock-job-id'
      });
    });
  });

  describe('processUnprocessedContent', () => {
    it('should queue unprocessed content for processing', async () => {
      const limit = 50;
      
      // Mock unprocessed content
      const mockContent = [
        { _id: 'content-1' },
        { _id: 'content-2' }
      ];
      
      Content.find.mockResolvedValueOnce(mockContent);
      
      // Use the real implementation but with mocked dependencies
      const result = await discoveryQueue.processUnprocessedContent(limit);
      
      // Check if Content.find was called correctly
      expect(Content.find).toHaveBeenCalledWith({ processed: false });
      
      // Check if content was queued for processing
      expect(mockQueue.add).toHaveBeenCalledTimes(2);
      
      // Check result
      expect(result).toEqual({
        success: true,
        total: 2,
        queued: 2,
        failed: 0
      });
    });
    
    it('should handle errors when finding unprocessed content', async () => {
      // Mock error
      Content.find.mockRejectedValueOnce(new Error('Database error'));
      
      const result = await discoveryQueue.processUnprocessedContent();
      
      // Check result
      expect(result).toEqual({
        success: false,
        error: 'Database error'
      });
    });
  });

  describe('getQueueStats', () => {
    it('should return statistics for all queues', async () => {
      const result = await discoveryQueue.getQueueStats();
      
      // Check if queue methods were called
      expect(mockQueue.getWaitingCount).toHaveBeenCalledTimes(4);
      expect(mockQueue.getActiveCount).toHaveBeenCalledTimes(4);
      expect(mockQueue.getCompletedCount).toHaveBeenCalledTimes(4);
      expect(mockQueue.getFailedCount).toHaveBeenCalledTimes(4);
      expect(mockQueue.getDelayedCount).toHaveBeenCalledTimes(4);
      
      // Check result structure
      expect(result.success).toBe(true);
      expect(result.stats).toHaveProperty('contentProcessing');
      expect(result.stats).toHaveProperty('referenceExtraction');
      expect(result.stats).toHaveProperty('referenceResolution');
      expect(result.stats).toHaveProperty('relevanceAssessment');
      expect(result.stats).toHaveProperty('total');
    });
  });

  describe('cleanupJobs', () => {
    it('should clean up completed and failed jobs', async () => {
      const result = await discoveryQueue.cleanupJobs();
      
      // Check if clean was called for each queue
      expect(mockQueue.clean).toHaveBeenCalledTimes(8);
      
      // Check result
      expect(result).toEqual({
        success: true,
        message: 'Cleaned up completed and failed jobs'
      });
    });
    
    it('should handle errors when cleaning up jobs', async () => {
      // Mock error
      mockQueue.clean.mockRejectedValueOnce(new Error('Queue error'));
      
      const result = await discoveryQueue.cleanupJobs();
      
      // Check result
      expect(result).toEqual({
        success: false,
        error: 'Queue error'
      });
    });
  });

  describe('shutdown', () => {
    it('should close all queues', async () => {
      await discoveryQueue.shutdown();
      
      // Check if close was called for each queue
      expect(mockQueue.close).toHaveBeenCalledTimes(4);
    });
  });
});