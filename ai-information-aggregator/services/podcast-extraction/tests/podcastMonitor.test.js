const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const podcastMonitor = require('../utils/podcastMonitor');
const Podcast = require('../models/Podcast');
const Episode = require('../models/Episode');
const Bull = require('bull');
const RssParser = require('rss-parser');

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

// Mock RssParser
jest.mock('rss-parser');

// Mock Podcast model
jest.mock('../models/Podcast', () => ({
  findById: jest.fn(),
  findOne: jest.fn(),
  countDocuments: jest.fn()
}));

// Mock Episode model
jest.mock('../models/Episode', () => ({
  findOne: jest.fn(),
  countDocuments: jest.fn()
}));

// Mock Source model
jest.mock('../../source-management/models/Source', () => ({
  find: jest.fn()
}));

describe('Podcast Monitor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should initialize all queues', () => {
      podcastMonitor.initialize();
      
      // Check if Bull was called to create queues
      expect(Bull).toHaveBeenCalledTimes(3);
      expect(Bull).toHaveBeenCalledWith('hourly-podcast-check', expect.any(Object));
      expect(Bull).toHaveBeenCalledWith('daily-podcast-check', expect.any(Object));
      expect(Bull).toHaveBeenCalledWith('weekly-podcast-check', expect.any(Object));
      
      // Check if process was called for each queue
      expect(mockQueue.process).toHaveBeenCalledTimes(3);
      
      // Check if event handlers were set up
      expect(mockQueue.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockQueue.on).toHaveBeenCalledWith('failed', expect.any(Function));
      expect(mockQueue.on).toHaveBeenCalledWith('completed', expect.any(Function));
    });
  });

  describe('checkPodcastFeed', () => {
    it('should check podcast feed and find new episodes', async () => {
      // Mock podcast
      const mockPodcast = {
        _id: 'podcast-1',
        feedUrl: 'https://example.com/feed.xml',
        recordCheck: jest.fn().mockResolvedValue(true),
        recordUpdate: jest.fn().mockResolvedValue(true),
        recordError: jest.fn().mockResolvedValue(true)
      };
      
      // Mock RSS feed
      const mockFeed = {
        title: 'Test Podcast',
        description: 'Test Description',
        items: [
          {
            title: 'Episode 1',
            description: 'Episode 1 description',
            guid: 'episode-1',
            link: 'https://example.com/episode-1',
            pubDate: new Date().toISOString(),
            enclosure: {
              url: 'https://example.com/episode-1.mp3'
            }
          },
          {
            title: 'Episode 2',
            description: 'Episode 2 description',
            guid: 'episode-2',
            link: 'https://example.com/episode-2',
            pubDate: new Date().toISOString(),
            enclosure: {
              url: 'https://example.com/episode-2.mp3'
            }
          }
        ]
      };
      
      // Mock RssParser
      RssParser.prototype.parseURL = jest.fn().mockResolvedValue(mockFeed);
      
      // Mock Episode.findOne to return null (no existing episodes)
      Episode.findOne.mockResolvedValue(null);
      
      // Mock Episode constructor and save method
      const mockEpisodeSave = jest.fn().mockResolvedValue(true);
      global.Episode = jest.fn().mockImplementation(() => ({
        save: mockEpisodeSave
      }));
      
      // Check podcast feed
      const result = await podcastMonitor.checkPodcastFeed(mockPodcast);
      
      // Check if RSS parser was called
      expect(RssParser.prototype.parseURL).toHaveBeenCalledWith(mockPodcast.feedUrl);
      
      // Check if Episode.findOne was called for each item
      expect(Episode.findOne).toHaveBeenCalledTimes(2);
      
      // Check if Episode constructor was called for each item
      expect(global.Episode).toHaveBeenCalledTimes(2);
      
      // Check if save was called for each episode
      expect(mockEpisodeSave).toHaveBeenCalledTimes(2);
      
      // Check if podcast.recordUpdate was called
      expect(mockPodcast.recordUpdate).toHaveBeenCalled();
      
      // Check result
      expect(result.newEpisodes).toHaveLength(2);
      expect(result.message).toBe('Found 2 new episodes');
    });
    
    it('should handle errors when checking podcast feed', async () => {
      // Mock podcast
      const mockPodcast = {
        _id: 'podcast-1',
        feedUrl: 'https://example.com/feed.xml',
        recordCheck: jest.fn().mockResolvedValue(true),
        recordError: jest.fn().mockResolvedValue(true)
      };
      
      // Mock RssParser to throw error
      RssParser.prototype.parseURL = jest.fn().mockRejectedValue(new Error('Feed error'));
      
      // Check podcast feed
      await expect(podcastMonitor.checkPodcastFeed(mockPodcast)).rejects.toThrow('Feed error');
      
      // Check if podcast.recordError was called
      expect(mockPodcast.recordError).toHaveBeenCalledWith('Feed error');
    });
  });

  describe('startMonitoring', () => {
    it('should start monitoring podcasts', async () => {
      // Mock podcast sources
      const mockSources = [
        {
          _id: 'source-1',
          name: 'Test Podcast 1',
          description: 'Test Description 1',
          rssUrl: 'https://example.com/feed1.xml',
          url: 'https://example.com/podcast1',
          categories: ['Technology'],
          checkFrequency: 'daily',
          active: true
        },
        {
          _id: 'source-2',
          name: 'Test Podcast 2',
          description: 'Test Description 2',
          rssUrl: 'https://example.com/feed2.xml',
          url: 'https://example.com/podcast2',
          categories: ['Business'],
          checkFrequency: 'weekly',
          active: true
        }
      ];
      
      // Mock Source.find
      const Source = require('../../source-management/models/Source');
      Source.find.mockResolvedValue(mockSources);
      
      // Mock Podcast.findOne to return null (no existing podcasts)
      Podcast.findOne.mockResolvedValue(null);
      
      // Mock Podcast constructor and save method
      const mockPodcastSave = jest.fn().mockResolvedValue(true);
      global.Podcast = jest.fn().mockImplementation(() => ({
        _id: 'new-podcast-id',
        save: mockPodcastSave
      }));
      
      // Start monitoring
      const result = await podcastMonitor.startMonitoring();
      
      // Check if Source.find was called
      expect(Source.find).toHaveBeenCalledWith({
        type: 'podcast',
        active: true
      });
      
      // Check if Podcast.findOne was called for each source
      expect(Podcast.findOne).toHaveBeenCalledTimes(2);
      
      // Check if Podcast constructor was called for each source
      expect(global.Podcast).toHaveBeenCalledTimes(2);
      
      // Check if save was called for each podcast
      expect(mockPodcastSave).toHaveBeenCalledTimes(2);
      
      // Check if queue.add was called for each podcast
      expect(mockQueue.add).toHaveBeenCalledTimes(2);
      
      // Check result
      expect(result.success).toBe(true);
      expect(result.podcastCount).toBe(2);
    });
    
    it('should handle errors when starting monitoring', async () => {
      // Mock Source.find to throw error
      const Source = require('../../source-management/models/Source');
      Source.find.mockRejectedValue(new Error('Database error'));
      
      // Start monitoring
      const result = await podcastMonitor.startMonitoring();
      
      // Check result
      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });

  describe('scheduleImmediateCheck', () => {
    it('should schedule immediate check for a podcast', async () => {
      // Mock podcast
      const mockPodcast = {
        _id: 'podcast-1',
        title: 'Test Podcast',
        checkFrequency: 'daily',
        active: true
      };
      
      // Mock Podcast.findById
      Podcast.findById.mockResolvedValue(mockPodcast);
      
      // Schedule immediate check
      const result = await podcastMonitor.scheduleImmediateCheck('podcast-1');
      
      // Check if Podcast.findById was called
      expect(Podcast.findById).toHaveBeenCalledWith('podcast-1');
      
      // Check if queue.add was called
      expect(mockQueue.add).toHaveBeenCalledWith(
        { podcastId: 'podcast-1' },
        expect.objectContaining({
          removeOnComplete: true,
          removeOnFail: false,
          attempts: 3
        })
      );
      
      // Check result
      expect(result.success).toBe(true);
      expect(result.jobId).toBe('mock-job-id');
      expect(result.podcastId).toBe('podcast-1');
      expect(result.podcastTitle).toBe('Test Podcast');
    });
    
    it('should handle inactive podcasts', async () => {
      // Mock inactive podcast
      const mockPodcast = {
        _id: 'podcast-1',
        title: 'Test Podcast',
        active: false
      };
      
      // Mock Podcast.findById
      Podcast.findById.mockResolvedValue(mockPodcast);
      
      // Schedule immediate check
      const result = await podcastMonitor.scheduleImmediateCheck('podcast-1');
      
      // Check result
      expect(result.success).toBe(false);
      expect(result.error).toBe('Podcast is inactive');
      
      // Check that queue.add was not called
      expect(mockQueue.add).not.toHaveBeenCalled();
    });
    
    it('should handle non-existent podcasts', async () => {
      // Mock Podcast.findById to return null
      Podcast.findById.mockResolvedValue(null);
      
      // Schedule immediate check
      const result = await podcastMonitor.scheduleImmediateCheck('podcast-1');
      
      // Check result
      expect(result.success).toBe(false);
      expect(result.error).toBe('Podcast not found');
      
      // Check that queue.add was not called
      expect(mockQueue.add).not.toHaveBeenCalled();
    });
  });

  describe('getQueueStats', () => {
    it('should return statistics for all queues', async () => {
      // Get queue stats
      const result = await podcastMonitor.getQueueStats();
      
      // Check if queue methods were called
      expect(mockQueue.getWaitingCount).toHaveBeenCalledTimes(3);
      expect(mockQueue.getActiveCount).toHaveBeenCalledTimes(3);
      expect(mockQueue.getCompletedCount).toHaveBeenCalledTimes(3);
      expect(mockQueue.getFailedCount).toHaveBeenCalledTimes(3);
      expect(mockQueue.getDelayedCount).toHaveBeenCalledTimes(3);
      
      // Check result
      expect(result.success).toBe(true);
      expect(result.stats).toHaveProperty('hourly');
      expect(result.stats).toHaveProperty('daily');
      expect(result.stats).toHaveProperty('weekly');
      expect(result.stats).toHaveProperty('total');
      
      // Check total stats
      expect(result.stats.total.waiting).toBe(15); // 5 * 3
      expect(result.stats.total.active).toBe(6); // 2 * 3
      expect(result.stats.total.completed).toBe(30); // 10 * 3
      expect(result.stats.total.failed).toBe(3); // 1 * 3
      expect(result.stats.total.delayed).toBe(9); // 3 * 3
    });
  });

  describe('cleanupJobs', () => {
    it('should clean up completed and failed jobs', async () => {
      // Clean up jobs
      const result = await podcastMonitor.cleanupJobs();
      
      // Check if clean was called for each queue
      expect(mockQueue.clean).toHaveBeenCalledTimes(6);
      
      // Check result
      expect(result.success).toBe(true);
      expect(result.message).toBe('Cleaned up completed and failed jobs');
    });
  });

  describe('shutdown', () => {
    it('should close all queues', async () => {
      // Shutdown
      await podcastMonitor.shutdown();
      
      // Check if close was called for each queue
      expect(mockQueue.close).toHaveBeenCalledTimes(3);
    });
  });
});