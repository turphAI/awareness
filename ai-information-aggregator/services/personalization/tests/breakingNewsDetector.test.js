const BreakingNewsDetector = require('../utils/breakingNewsDetector');

describe('BreakingNewsDetector', () => {
  let detector;
  let mockContent;
  let mockUserProfile;

  beforeEach(() => {
    detector = new BreakingNewsDetector();
    
    mockContent = {
      id: 'content1',
      title: 'Breaking: Major earthquake hits California',
      description: 'A 7.2 magnitude earthquake has struck Southern California, causing widespread damage',
      content: 'Emergency services are responding to reports of collapsed buildings...',
      topics: ['earthquake', 'california', 'emergency'],
      categories: ['news', 'disaster'],
      publishedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
      source: {
        name: 'Reuters',
        credibilityScore: 0.95
      },
      metrics: {
        likes: 500,
        shares: 200,
        comments: 150,
        views: 10000
      }
    };

    mockUserProfile = {
      topics: [
        { topic: 'earthquake', weight: 0.8, interactionCount: 10 },
        { topic: 'california', weight: 0.6, interactionCount: 5 }
      ],
      categories: [
        { category: 'news', weight: 0.9, interactionCount: 20 }
      ]
    };
  });

  describe('analyzeContent', () => {
    it('should analyze content and return comprehensive breaking news analysis', async () => {
      const analysis = await detector.analyzeContent(mockContent);

      expect(analysis).toHaveProperty('contentId', 'content1');
      expect(analysis).toHaveProperty('timestamp');
      expect(analysis).toHaveProperty('scores');
      expect(analysis).toHaveProperty('factors');
      expect(analysis).toHaveProperty('priority');
      expect(analysis).toHaveProperty('isBreakingNews');
      expect(analysis).toHaveProperty('confidence');
      expect(analysis).toHaveProperty('recommendedActions');

      expect(analysis.scores).toHaveProperty('velocity');
      expect(analysis.scores).toHaveProperty('engagement');
      expect(analysis.scores).toHaveProperty('keywords');
      expect(analysis.scores).toHaveProperty('source');
      expect(analysis.scores).toHaveProperty('recency');
      expect(analysis.scores).toHaveProperty('uniqueness');

      expect(analysis.compositeScore).toBeGreaterThan(0);
      expect(analysis.isBreakingNews).toBe(true); // Should be true due to keywords and source
    });

    it('should handle content without breaking news indicators', async () => {
      const normalContent = {
        id: 'content2',
        title: 'Regular tech article about programming',
        description: 'A tutorial on JavaScript functions',
        topics: ['programming', 'javascript'],
        categories: ['technology'],
        publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        source: { name: 'TechBlog', credibilityScore: 0.6 }
      };

      const analysis = await detector.analyzeContent(normalContent);

      expect(analysis.isBreakingNews).toBe(false);
      expect(analysis.priority).toBe('normal');
      expect(analysis.scores.keywords).toBe(0); // No breaking keywords
    });

    it('should handle analysis errors gracefully', async () => {
      const invalidContent = null;

      await expect(detector.analyzeContent(invalidContent))
        .rejects.toThrow('Failed to analyze content for breaking news');
    });
  });

  describe('calculateVelocityScore', () => {
    it('should return high score for topics with many recent articles', () => {
      // Add related content to tracker
      const relatedContent = Array(12).fill(null).map((_, i) => ({
        contentId: `related${i}`,
        timestamp: new Date(Date.now() - i * 5 * 60 * 1000) // Every 5 minutes
      }));

      detector.contentTracker.set('earthquake', relatedContent);

      const score = detector.calculateVelocityScore(mockContent, {});
      expect(score).toBe(1.0); // Should be maximum due to high velocity
    });

    it('should return zero for content without topics', () => {
      const contentWithoutTopics = { ...mockContent, topics: [] };
      const score = detector.calculateVelocityScore(contentWithoutTopics, {});
      expect(score).toBe(0);
    });

    it('should return proportional score for medium velocity', () => {
      const relatedContent = Array(3).fill(null).map((_, i) => ({
        contentId: `related${i}`,
        timestamp: new Date(Date.now() - i * 10 * 60 * 1000)
      }));

      detector.contentTracker.set('earthquake', relatedContent);

      const score = detector.calculateVelocityScore(mockContent, {});
      expect(score).toBe(0.6); // Should match medium threshold
    });
  });

  describe('calculateEngagementScore', () => {
    it('should calculate high engagement score for viral content', () => {
      const viralContent = {
        ...mockContent,
        publishedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
        metrics: {
          likes: 2000,
          shares: 1000,
          comments: 500
        }
      };

      const score = detector.calculateEngagementScore(viralContent, {});
      expect(score).toBeGreaterThan(0.8);
    });

    it('should return zero for content without engagement metrics', () => {
      const contentWithoutMetrics = { ...mockContent, metrics: undefined };
      const score = detector.calculateEngagementScore(contentWithoutMetrics, {});
      expect(score).toBe(0);
    });

    it('should factor in content age for engagement velocity', () => {
      const oldContent = {
        ...mockContent,
        publishedAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
        metrics: { likes: 100, shares: 50, comments: 25 }
      };

      const recentContent = {
        ...mockContent,
        publishedAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
        metrics: { likes: 100, shares: 50, comments: 25 }
      };

      const oldScore = detector.calculateEngagementScore(oldContent, {});
      const recentScore = detector.calculateEngagementScore(recentContent, {});

      expect(recentScore).toBeGreaterThan(oldScore);
    });
  });

  describe('calculateKeywordScore', () => {
    it('should return high score for content with breaking news keywords', () => {
      const score = detector.calculateKeywordScore(mockContent);
      expect(score).toBeGreaterThan(0.2); // Should detect "breaking" keyword
    });

    it('should return zero for content without breaking keywords', () => {
      const normalContent = {
        title: 'How to learn programming',
        description: 'A guide for beginners',
        content: 'Programming is a valuable skill...'
      };

      const score = detector.calculateKeywordScore(normalContent);
      expect(score).toBe(0);
    });

    it('should give higher scores for urgent keywords', () => {
      const urgentContent = {
        title: 'URGENT ALERT: Emergency evacuation ordered',
        description: 'Breaking news: immediate action required'
      };

      const score = detector.calculateKeywordScore(urgentContent);
      expect(score).toBeGreaterThan(0.5);
    });

    it('should provide bonus for multiple keyword matches', () => {
      const multiKeywordContent = {
        title: 'Breaking: Urgent alert - Emergency developing',
        description: 'Live updates on the situation'
      };

      const score = detector.calculateKeywordScore(multiKeywordContent);
      expect(score).toBeGreaterThan(0.8);
    });
  });

  describe('calculateSourceScore', () => {
    it('should return high score for credible news sources', () => {
      const score = detector.calculateSourceScore(mockContent);
      expect(score).toBe(1.0); // Reuters should get maximum score
    });

    it('should return default score for unknown sources', () => {
      const unknownSourceContent = {
        ...mockContent,
        source: { name: 'Unknown Blog' }
      };

      const score = detector.calculateSourceScore(unknownSourceContent);
      expect(score).toBe(0.5); // Default score
    });

    it('should use credibility score when available', () => {
      const customSourceContent = {
        ...mockContent,
        source: { name: 'Custom Source', credibilityScore: 0.75 }
      };

      const score = detector.calculateSourceScore(customSourceContent);
      expect(score).toBe(0.75);
    });

    it('should handle content without source information', () => {
      const noSourceContent = { ...mockContent, source: undefined };
      const score = detector.calculateSourceScore(noSourceContent);
      expect(score).toBe(0.5);
    });
  });

  describe('calculateRecencyScore', () => {
    it('should return maximum score for very recent content', () => {
      const veryRecentContent = {
        ...mockContent,
        publishedAt: new Date(Date.now() - 5 * 60 * 1000) // 5 minutes ago
      };

      const score = detector.calculateRecencyScore(veryRecentContent);
      expect(score).toBe(1.0);
    });

    it('should return lower scores for older content', () => {
      const oldContent = {
        ...mockContent,
        publishedAt: new Date(Date.now() - 25 * 60 * 60 * 1000) // 25 hours ago
      };

      const score = detector.calculateRecencyScore(oldContent);
      expect(score).toBe(0.1);
    });

    it('should handle content without publish date', () => {
      const noDateContent = { ...mockContent, publishedAt: undefined, createdAt: undefined };
      // Should use current time, resulting in maximum recency
      const score = detector.calculateRecencyScore(noDateContent);
      expect(score).toBe(1.0);
    });
  });

  describe('calculateUniquenessScore', () => {
    it('should return high score for unique topics', () => {
      const uniqueContent = {
        ...mockContent,
        topics: ['unique-topic-never-seen-before']
      };

      const score = detector.calculateUniquenessScore(uniqueContent, {});
      expect(score).toBe(1.0); // Should be completely unique
    });

    it('should return lower score for common topics', () => {
      // Add similar content to tracker
      const similarContent = {
        contentId: 'similar1',
        timestamp: new Date(),
        topics: ['earthquake', 'california']
      };

      detector.contentTracker.set('earthquake', [similarContent]);

      const score = detector.calculateUniquenessScore(mockContent, {});
      expect(score).toBeLessThan(1.0);
    });

    it('should return neutral score for content without topics', () => {
      const noTopicsContent = { ...mockContent, topics: [] };
      const score = detector.calculateUniquenessScore(noTopicsContent, {});
      expect(score).toBe(0.5);
    });
  });

  describe('determinePriority', () => {
    it('should return critical for very high scores', () => {
      const priority = detector.determinePriority(0.95, { keywords: 0.9 });
      expect(priority).toBe('critical');
    });

    it('should return high for high scores', () => {
      const priority = detector.determinePriority(0.75, { velocity: 0.85 });
      expect(priority).toBe('high');
    });

    it('should return medium for moderate scores', () => {
      const priority = detector.determinePriority(0.55, { keywords: 0.3 });
      expect(priority).toBe('medium');
    });

    it('should return normal for low scores', () => {
      const priority = detector.determinePriority(0.3, { keywords: 0.1 });
      expect(priority).toBe('normal');
    });
  });

  describe('shouldNotifyUser', () => {
    it('should recommend notification for relevant breaking news', async () => {
      const analysis = {
        isBreakingNews: true,
        priority: 'high',
        compositeScore: 0.8
      };

      const decision = await detector.shouldNotifyUser('user123', mockContent, analysis, mockUserProfile);

      expect(decision.shouldNotify).toBe(true);
      expect(decision.notificationType).toBe('email');
      expect(decision.reason).toContain('relevant to user');
    });

    it('should not notify for non-breaking news', async () => {
      const analysis = {
        isBreakingNews: false,
        priority: 'normal',
        compositeScore: 0.4
      };

      const decision = await detector.shouldNotifyUser('user123', mockContent, analysis, mockUserProfile);

      expect(decision.shouldNotify).toBe(false);
      expect(decision.reason).toBe('Content not classified as breaking news');
    });

    it('should not notify if content is not relevant to user', async () => {
      const irrelevantContent = {
        ...mockContent,
        topics: ['sports', 'football'],
        categories: ['sports']
      };

      const analysis = {
        isBreakingNews: true,
        priority: 'high',
        compositeScore: 0.8
      };

      const decision = await detector.shouldNotifyUser('user123', irrelevantContent, analysis, mockUserProfile);

      expect(decision.shouldNotify).toBe(false);
      expect(decision.reason).toBe('Content not relevant to user interests');
    });

    it('should respect notification cooldown', async () => {
      // Add recent notification to history
      const recentNotification = {
        timestamp: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
        content: { topics: ['earthquake'] }
      };

      detector.notificationHistory.set('user123', [recentNotification]);

      const analysis = {
        isBreakingNews: true,
        priority: 'high',
        compositeScore: 0.8
      };

      const decision = await detector.shouldNotifyUser('user123', mockContent, analysis, mockUserProfile);

      expect(decision.shouldNotify).toBe(false);
      expect(decision.cooldownActive).toBe(true);
      expect(decision.reason).toBe('Notification cooldown active');
    });

    it('should recommend push notifications for critical news', async () => {
      const analysis = {
        isBreakingNews: true,
        priority: 'critical',
        compositeScore: 0.95
      };

      const decision = await detector.shouldNotifyUser('user123', mockContent, analysis, mockUserProfile);

      expect(decision.shouldNotify).toBe(true);
      expect(decision.notificationType).toBe('push');
    });
  });

  describe('sendNotification', () => {
    it('should create and send notification successfully', async () => {
      const analysis = {
        priority: 'high',
        compositeScore: 0.8
      };

      const result = await detector.sendNotification('user123', mockContent, analysis, 'email');

      expect(result.success).toBe(true);
      expect(result.notification).toHaveProperty('id');
      expect(result.notification).toHaveProperty('title');
      expect(result.notification).toHaveProperty('message');
      expect(result.notification.delivered).toBe(true);
      expect(result.deliveryMethod).toBe('email');
    });

    it('should generate appropriate notification titles', async () => {
      const criticalAnalysis = { priority: 'critical' };
      const highAnalysis = { priority: 'high' };
      const normalAnalysis = { priority: 'normal' };

      const criticalResult = await detector.sendNotification('user123', mockContent, criticalAnalysis, 'push');
      const highResult = await detector.sendNotification('user123', mockContent, highAnalysis, 'email');
      const normalResult = await detector.sendNotification('user123', mockContent, normalAnalysis, 'in-app');

      expect(criticalResult.notification.title).toContain('🚨 URGENT:');
      expect(highResult.notification.title).toContain('⚡ Breaking:');
      expect(normalResult.notification.title).not.toContain('🚨');
    });
  });

  describe('calculateUserRelevance', () => {
    it('should return high relevance for matching user interests', () => {
      const relevance = detector.calculateUserRelevance(mockContent, mockUserProfile);
      expect(relevance).toBeGreaterThan(0.6); // Should match earthquake and california topics
    });

    it('should return low relevance for non-matching content', () => {
      const irrelevantContent = {
        topics: ['sports', 'football'],
        categories: ['entertainment']
      };

      const relevance = detector.calculateUserRelevance(irrelevantContent, mockUserProfile);
      expect(relevance).toBe(0); // No matches
    });

    it('should return neutral relevance for missing profile or topics', () => {
      const relevance1 = detector.calculateUserRelevance(mockContent, null);
      const relevance2 = detector.calculateUserRelevance({ topics: [] }, mockUserProfile);

      expect(relevance1).toBe(0.5);
      expect(relevance2).toBe(0);
    });
  });

  describe('generateNotificationTitle', () => {
    it('should generate appropriate titles for different priorities', () => {
      const criticalTitle = detector.generateNotificationTitle(mockContent, { priority: 'critical' });
      const highTitle = detector.generateNotificationTitle(mockContent, { priority: 'high' });
      const normalTitle = detector.generateNotificationTitle(mockContent, { priority: 'normal' });

      expect(criticalTitle).toContain('🚨 URGENT:');
      expect(highTitle).toContain('⚡ Breaking:');
      expect(normalTitle).not.toContain('🚨');
      expect(normalTitle).not.toContain('⚡');
    });
  });

  describe('generateNotificationMessage', () => {
    it('should generate message from content description', () => {
      const message = detector.generateNotificationMessage(mockContent, { priority: 'high' });
      expect(message).toContain('magnitude earthquake');
    });

    it('should truncate long descriptions', () => {
      const longContent = {
        ...mockContent,
        description: 'A'.repeat(150) // Very long description
      };

      const message = detector.generateNotificationMessage(longContent, { priority: 'high' });
      expect(message.length).toBeLessThanOrEqual(103); // 100 chars + "..."
      expect(message).toContain('...');
    });

    it('should provide fallback for content without description', () => {
      const noDescContent = { ...mockContent, description: undefined, summary: undefined };
      const message = detector.generateNotificationMessage(noDescContent, { priority: 'high' });
      expect(message).toBe('Breaking news update available');
    });
  });

  describe('configuration and statistics', () => {
    it('should return current detection configuration', () => {
      const config = detector.getDetectionConfig();
      expect(config).toHaveProperty('velocityThresholds');
      expect(config).toHaveProperty('engagementThresholds');
      expect(config).toHaveProperty('breakingKeywords');
      expect(config).toHaveProperty('sourceWeights');
    });

    it('should update detection configuration', () => {
      const newConfig = {
        breakingNewsThreshold: 0.8,
        notificationCooldown: 60
      };

      detector.updateDetectionConfig(newConfig);
      const config = detector.getDetectionConfig();

      expect(config.breakingNewsThreshold).toBe(0.8);
      expect(config.notificationCooldown).toBe(60);
    });

    it('should return breaking news statistics', () => {
      // Add some test data
      detector.contentTracker.set('topic1', []);
      detector.notificationHistory.set('user1', [
        { priority: 'critical' },
        { priority: 'high' }
      ]);

      const stats = detector.getStatistics();

      expect(stats).toHaveProperty('totalTrackedTopics', 1);
      expect(stats).toHaveProperty('totalNotificationsSent', 2);
      expect(stats).toHaveProperty('notificationsByPriority');
      expect(stats).toHaveProperty('activeUsers', 1);
      expect(stats.notificationsByPriority.critical).toBe(1);
      expect(stats.notificationsByPriority.high).toBe(1);
    });

    it('should clear tracking data', () => {
      // Add some data
      detector.contentTracker.set('topic1', []);
      detector.notificationHistory.set('user1', []);

      detector.clearTrackingData();

      expect(detector.contentTracker.size).toBe(0);
      expect(detector.notificationHistory.size).toBe(0);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle content with missing fields gracefully', async () => {
      const incompleteContent = {
        id: 'incomplete',
        title: 'Test'
        // Missing many fields
      };

      const analysis = await detector.analyzeContent(incompleteContent);
      expect(analysis).toHaveProperty('contentId', 'incomplete');
      expect(analysis.isBreakingNews).toBe(false);
    });

    it('should handle very old content', () => {
      const veryOldContent = {
        ...mockContent,
        publishedAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) // 1 year ago
      };

      const recencyScore = detector.calculateRecencyScore(veryOldContent);
      expect(recencyScore).toBe(0.1);
    });

    it('should handle content with no engagement metrics', () => {
      const noEngagementContent = { ...mockContent, metrics: {} };
      const engagementScore = detector.calculateEngagementScore(noEngagementContent, {});
      expect(engagementScore).toBe(0);
    });
  });
});