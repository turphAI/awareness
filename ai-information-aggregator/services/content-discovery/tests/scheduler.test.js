const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const scheduler = require('../utils/scheduler');
const Source = require('../../source-management/models/Source');
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

// Mock Source model
jest.mock('../../source-management/models/Source', () => ({
  findById: jest.fn(),
  findSourcesForChecking: jest.fn(),
  countDocuments: jest.fn()
}));

// Mock contentChecker
jest.mock('../utils/contentChecker', () => ({
  checkSource: jest.fn()
}));

describe('Content Discovery Scheduler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initializeQueues', () => {
    it('should initialize all queues', () => {
      scheduler.initializeQueues();
      
      // Check if Bull was called to create queues
      expect(Bull).toHaveBeenCalledTimes(4);
      expect(Bull).toHaveBeenCalledWith('hourly-content-check', expect.any(Object));
      expect(Bull).toHaveBeenCalledWith('daily-content-check', expect.any(Object));
      expect(Bull).toHaveBeenCalledWith('weekly-content-check', expect.any(Object));
      expect(Bull).toHaveBeenCalledWith('monthly-content-check', expect.any(Object));
      
      // Check if process was called for each queue
      expect(mockQueue.process).toHaveBeenCalledTimes(4);
      
      // Check if event handlers were set up
      expect(mockQueue.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockQueue.on).toHaveBeenCalledWith('failed', expect.any(Function));
      expect(mockQueue.on).toHaveBeenCalledWith('completed', expect.any(Function));
    });
  });

  describe('scheduleAllSources', () => {
    it('should schedule all sources by frequency', async () => {
      // Mock source data
      const mockHourlySources = [
        { _id: 'hourly-1' },
        { _id: 'hourly-2' }
      ];
      
      const mockDailySources = [
        { _id: 'daily-1' },
        { _id: 'daily-2' },
        { _id: 'daily-3' }
      ];
      
      const mockWeeklySources = [
        { _id: 'weekly-1' }
      ];
      
      const mockMonthlySources = [
        { _id: 'monthly-1' },
        { _id: 'monthly-2' }
      ];
      
      // Set up mock implementations
      Source.findSourcesForChecking
        .mockResolvedValueOnce(mockHourlySources)
        .mockResolvedValueOnce(mockDailySources)
        .mockResolvedValueOnce(mockWeeklySources)
        .mockResolvedValueOnce(mockMonthlySources);
      
      // Call the function
      const result = await scheduler.scheduleAllSources();
      
      // Check if queues were emptied
      expect(mockQueue.empty).toHaveBeenCalledTimes(4);
      
      // Check if sources were scheduled
      expect(mockQueue.add).toHaveBeenCalledTimes(
        mockHourlySources.length + 
        mockDailySources.length + 
        mockWeeklySources.length + 
        mockMonthlySources.length
      );
      
      // Check result
      expect(result).toEqual({
        success: true,
        scheduled: {
          hourly: mockHourlySources.length,
          daily: mockDailySources.length,
          weekly: mockWeeklySources.length,
          monthly: mockMonthlySources.length,
          total: mockHourlySources.length + mockDailySources.length + mockWeeklySources.length + mockMonthlySources.length
        }
      });
    });
    
    it('should handle errors when scheduling sources', async () => {
      // Mock error
      Source.findSourcesForChecking.mockRejectedValue(new Error('Database error'));
      
      // Call the function
      const result = await scheduler.scheduleAllSources();
      
      // Check result
      expect(result).toEqual({
        success: false,
        error: 'Database error'
      });
    });
  });

  describe('scheduleImmediateCheck', () => {
    it('should schedule an immediate check for a valid source', async () => {
      // Mock source
      const mockSource = {
        _id: 'source-1',
        name: 'Test Source',
        active: true,
        checkFrequency: 'daily'
      };
      
      // Set up mock implementation
      Source.findById.mockResolvedValue(mockSource);
      
      // Call the function
      const result = await scheduler.scheduleImmediateCheck('source-1');
      
      // Check if job was added to queue
      expect(mockQueue.add).toHaveBeenCalledWith(
        { sourceId: 'source-1' },
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
        sourceId: 'source-1',
        sourceName: 'Test Source'
      });
    });
    
    it('should return error for inactive source', async () => {
      // Mock inactive source
      const mockSource = {
        _id: 'source-1',
        name: 'Test Source',
        active: false,
        checkFrequency: 'daily'
      };
      
      // Set up mock implementation
      Source.findById.mockResolvedValue(mockSource);
      
      // Call the function
      const result = await scheduler.scheduleImmediateCheck('source-1');
      
      // Check result
      expect(result).toEqual({
        success: false,
        error: 'Source is inactive'
      });
      
      // Check that no job was added
      expect(mockQueue.add).not.toHaveBeenCalled();
    });
    
    it('should return error for non-existent source', async () => {
      // Set up mock implementation
      Source.findById.mockResolvedValue(null);
      
      // Call the function
      const result = await scheduler.scheduleImmediateCheck('source-1');
      
      // Check result
      expect(result).toEqual({
        success: false,
        error: 'Source not found'
      });
      
      // Check that no job was added
      expect(mockQueue.add).not.toHaveBeenCalled();
    });
    
    it('should handle errors when scheduling a check', async () => {
      // Mock error
      Source.findById.mockRejectedValue(new Error('Database error'));
      
      // Call the function
      const result = await scheduler.scheduleImmediateCheck('source-1');
      
      // Check result
      expect(result).toEqual({
        success: false,
        error: 'Database error'
      });
    });
  });

  describe('getQueueStats', () => {
    it('should return statistics for all queues', async () => {
      // Call the function
      const result = await scheduler.getQueueStats();
      
      // Check if queue methods were called
      expect(mockQueue.getWaitingCount).toHaveBeenCalledTimes(4);
      expect(mockQueue.getActiveCount).toHaveBeenCalledTimes(4);
      expect(mockQueue.getCompletedCount).toHaveBeenCalledTimes(4);
      expect(mockQueue.getFailedCount).toHaveBeenCalledTimes(4);
      expect(mockQueue.getDelayedCount).toHaveBeenCalledTimes(4);
      
      // Check result
      expect(result).toEqual({
        success: true,
        stats: {
          hourly: {
            waiting: 5,
            active: 2,
            completed: 10,
            failed: 1,
            delayed: 3
          },
          daily: {
            waiting: 5,
            active: 2,
            completed: 10,
            failed: 1,
            delayed: 3
          },
          weekly: {
            waiting: 5,
            active: 2,
            completed: 10,
            failed: 1,
            delayed: 3
          },
          monthly: {
            waiting: 5,
            active: 2,
            completed: 10,
            failed: 1,
            delayed: 3
          },
          total: {
            waiting: 20,
            active: 8,
            completed: 40,
            failed: 4,
            delayed: 12
          }
        }
      });
    });
    
    it('should handle errors when getting queue stats', async () => {
      // Mock error
      mockQueue.getWaitingCount.mockRejectedValue(new Error('Queue error'));
      
      // Call the function
      const result = await scheduler.getQueueStats();
      
      // Check result
      expect(result).toEqual({
        success: false,
        error: 'Queue error'
      });
    });
  });

  describe('cleanupJobs', () => {
    it('should clean up completed and failed jobs', async () => {
      // Call the function
      const result = await scheduler.cleanupJobs();
      
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
      mockQueue.clean.mockRejectedValue(new Error('Queue error'));
      
      // Call the function
      const result = await scheduler.cleanupJobs();
      
      // Check result
      expect(result).toEqual({
        success: false,
        error: 'Queue error'
      });
    });
  });

  describe('shutdown', () => {
    it('should close all queues', async () => {
      // Call the function
      await scheduler.shutdown();
      
      // Check if close was called for each queue
      expect(mockQueue.close).toHaveBeenCalledTimes(4);
    });
  });
});