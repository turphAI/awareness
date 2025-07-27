const DigestDelivery = require('../utils/digestDelivery');
const DigestScheduling = require('../models/DigestScheduling');
const mongoose = require('mongoose');

describe('DigestDelivery', () => {
  let digestDelivery;
  let mockScheduling;
  let mockDigest;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/test-ai-aggregator');
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await DigestScheduling.deleteMany({});
    digestDelivery = new DigestDelivery();
    
    // Create mock scheduling
    const userId = new mongoose.Types.ObjectId();
    mockScheduling = new DigestScheduling({
      userId,
      enabled: true,
      frequency: 'daily',
      deliveryMethod: {
        email: {
          enabled: true,
          address: 'test@example.com'
        },
        inApp: {
          enabled: true
        }
      },
      formatting: {
        includeFullSummaries: true,
        includeThumbnails: true,
        includeReadingTime: true,
        groupByTopic: false,
        sortBy: 'relevance'
      }
    });

    // Create mock digest
    mockDigest = {
      title: 'Test Digest - January 1, 2023 (3 items)',
      summary: 'This digest contains 3 items including 2 articles, 1 paper.',
      content: [
        {
          id: '1',
          title: 'Test Article 1',
          author: 'Author 1',
          publishDate: '2023-01-01',
          url: 'https://example.com/article1',
          type: 'articles',
          topics: ['AI'],
          summary: 'Test summary 1',
          keyInsights: ['Insight 1', 'Insight 2'],
          readingTime: 5,
          thumbnail: 'https://example.com/thumb1.jpg'
        },
        {
          id: '2',
          title: 'Test Article 2',
          author: 'Author 2',
          publishDate: '2023-01-02',
          url: 'https://example.com/article2',
          type: 'articles',
          topics: ['ML'],
          summary: 'Test summary 2',
          keyInsights: ['Insight 3'],
          readingTime: 8
        },
        {
          id: '3',
          title: 'Test Paper 1',
          author: 'Researcher 1',
          publishDate: '2023-01-03',
          url: 'https://example.com/paper1',
          type: 'papers',
          topics: ['AI', 'Research'],
          summary: 'Test paper summary',
          readingTime: 15
        }
      ],
      totalItems: 3,
      generatedAt: new Date('2023-01-01T08:00:00Z'),
      metadata: {
        userId: userId,
        generatedAt: new Date('2023-01-01T08:00:00Z'),
        frequency: 'daily',
        contentCount: 3
      }
    };
  });

  describe('deliverDigest', () => {
    test('should deliver digest via both email and in-app when both enabled', async () => {
      const result = await digestDelivery.deliverDigest(mockDigest, mockScheduling);

      expect(result.success).toBe(true);
      expect(result.userId).toBe(mockScheduling.userId);
      expect(result.methods).toHaveLength(2);
      expect(result.errors).toHaveLength(0);

      const emailMethod = result.methods.find(m => m.method === 'email');
      const inAppMethod = result.methods.find(m => m.method === 'inApp');

      expect(emailMethod).toBeDefined();
      expect(emailMethod.success).toBe(true);
      expect(inAppMethod).toBeDefined();
      expect(inAppMethod.success).toBe(true);
    });

    test('should deliver digest via email only when in-app disabled', async () => {
      mockScheduling.deliveryMethod.inApp.enabled = false;

      const result = await digestDelivery.deliverDigest(mockDigest, mockScheduling);

      expect(result.success).toBe(true);
      expect(result.methods).toHaveLength(1);
      expect(result.methods[0].method).toBe('email');
    });

    test('should deliver digest via in-app only when email disabled', async () => {
      mockScheduling.deliveryMethod.email.enabled = false;

      const result = await digestDelivery.deliverDigest(mockDigest, mockScheduling);

      expect(result.success).toBe(true);
      expect(result.methods).toHaveLength(1);
      expect(result.methods[0].method).toBe('inApp');
    });

    test('should handle partial delivery failures', async () => {
      // Mock email service to fail
      const originalSendEmail = digestDelivery.sendEmail;
      digestDelivery.sendEmail = jest.fn().mockRejectedValue(new Error('Email service error'));

      const result = await digestDelivery.deliverDigest(mockDigest, mockScheduling);

      expect(result.success).toBe(false);
      expect(result.methods).toHaveLength(1); // Only in-app succeeded
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].method).toBe('email');

      // Restore original method
      digestDelivery.sendEmail = originalSendEmail;
    });

    test('should include delivery metadata', async () => {
      const result = await digestDelivery.deliverDigest(mockDigest, mockScheduling);

      expect(result).toHaveProperty('userId');
      expect(result).toHaveProperty('digestId');
      expect(result).toHaveProperty('deliveredAt');
      expect(result.deliveredAt).toBeInstanceOf(Date);
    });
  });

  describe('deliverViaEmail', () => {
    test('should format and send email successfully', async () => {
      const result = await digestDelivery.deliverViaEmail(mockDigest, mockScheduling);

      expect(result.success).toBe(true);
      expect(result.method).toBe('email');
      expect(result.recipient).toBe('test@example.com');
      expect(result).toHaveProperty('messageId');
      expect(result).toHaveProperty('sentAt');
    });

    test('should handle email sending errors', async () => {
      // Mock email service to fail
      const originalSendEmail = digestDelivery.sendEmail;
      digestDelivery.sendEmail = jest.fn().mockRejectedValue(new Error('SMTP error'));

      await expect(digestDelivery.deliverViaEmail(mockDigest, mockScheduling))
        .rejects.toThrow('SMTP error');

      // Restore original method
      digestDelivery.sendEmail = originalSendEmail;
    });
  });

  describe('deliverViaInApp', () => {
    test('should format and send in-app notification successfully', async () => {
      const result = await digestDelivery.deliverViaInApp(mockDigest, mockScheduling);

      expect(result.success).toBe(true);
      expect(result.method).toBe('inApp');
      expect(result.userId).toBe(mockScheduling.userId);
      expect(result).toHaveProperty('notificationId');
      expect(result).toHaveProperty('sentAt');
    });

    test('should handle notification sending errors', async () => {
      // Mock notification service to fail
      const originalSendInAppNotification = digestDelivery.sendInAppNotification;
      digestDelivery.sendInAppNotification = jest.fn().mockRejectedValue(new Error('Notification service error'));

      await expect(digestDelivery.deliverViaInApp(mockDigest, mockScheduling))
        .rejects.toThrow('Notification service error');

      // Restore original method
      digestDelivery.sendInAppNotification = originalSendInAppNotification;
    });
  });

  describe('formatEmailContent', () => {
    test('should format email content with subject, html, and text', () => {
      const emailContent = digestDelivery.formatEmailContent(mockDigest, mockScheduling);

      expect(emailContent).toHaveProperty('subject');
      expect(emailContent).toHaveProperty('html');
      expect(emailContent).toHaveProperty('text');

      expect(emailContent.subject).toContain('Test Digest');
      expect(emailContent.html).toContain('<!DOCTYPE html>');
      expect(emailContent.text).toContain('Test Digest');
    });
  });

  describe('generateEmailHTML', () => {
    test('should generate valid HTML content', () => {
      const html = digestDelivery.generateEmailHTML(mockDigest, mockScheduling);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html>');
      expect(html).toContain('</html>');
      expect(html).toContain(mockDigest.title);
      expect(html).toContain(mockDigest.summary);
      
      // Check that content items are included
      mockDigest.content.forEach(item => {
        expect(html).toContain(item.title);
        expect(html).toContain(item.url);
      });
    });

    test('should include thumbnails when enabled', () => {
      const html = digestDelivery.generateEmailHTML(mockDigest, mockScheduling);

      expect(html).toContain('https://example.com/thumb1.jpg');
      expect(html).toContain('<img');
    });

    test('should include reading time when enabled', () => {
      const html = digestDelivery.generateEmailHTML(mockDigest, mockScheduling);

      expect(html).toContain('5 min read');
      expect(html).toContain('8 min read');
      expect(html).toContain('15 min read');
    });

    test('should group content by topic when enabled', () => {
      mockScheduling.formatting.groupByTopic = true;
      
      // Modify digest to have grouped content
      const groupedDigest = {
        ...mockDigest,
        content: {
          'AI': [mockDigest.content[0], mockDigest.content[2]],
          'ML': [mockDigest.content[1]]
        }
      };

      const html = digestDelivery.generateEmailHTML(groupedDigest, mockScheduling);

      expect(html).toContain('class="topic-title">AI</h2>');
      expect(html).toContain('class="topic-title">ML</h2>');
    });
  });

  describe('generateEmailText', () => {
    test('should generate plain text content', () => {
      const text = digestDelivery.generateEmailText(mockDigest, mockScheduling);

      expect(text).toContain(mockDigest.title);
      expect(text).toContain(mockDigest.summary);
      
      // Check that content items are included
      mockDigest.content.forEach(item => {
        expect(text).toContain(item.title);
        expect(text).toContain(item.url);
      });

      // Check formatting
      expect(text).toMatch(/={50}/); // Footer separator
      expect(text).toContain('Generated:');
      expect(text).toContain('Frequency: daily');
    });

    test('should include reading time in text format', () => {
      const text = digestDelivery.generateEmailText(mockDigest, mockScheduling);

      expect(text).toContain('5 min read');
      expect(text).toContain('8 min read');
      expect(text).toContain('15 min read');
    });

    test('should group content by topic in text format', () => {
      mockScheduling.formatting.groupByTopic = true;
      
      // Modify digest to have grouped content
      const groupedDigest = {
        ...mockDigest,
        content: {
          'AI': [mockDigest.content[0], mockDigest.content[2]],
          'ML': [mockDigest.content[1]]
        }
      };

      const text = digestDelivery.generateEmailText(groupedDigest, mockScheduling);

      expect(text).toContain('AI\n--');
      expect(text).toContain('ML\n--');
    });
  });

  describe('formatInAppNotification', () => {
    test('should format in-app notification correctly', () => {
      const notification = digestDelivery.formatInAppNotification(mockDigest, mockScheduling);

      expect(notification).toHaveProperty('title');
      expect(notification).toHaveProperty('message');
      expect(notification).toHaveProperty('data');

      expect(notification.title).toBe('New Digest Available');
      expect(notification.message).toContain('daily digest');
      expect(notification.message).toContain('3 new items');

      expect(notification.data).toHaveProperty('itemCount');
      expect(notification.data).toHaveProperty('frequency');
      expect(notification.data).toHaveProperty('generatedAt');
      expect(notification.data).toHaveProperty('preview');

      expect(notification.data.itemCount).toBe(3);
      expect(notification.data.frequency).toBe('daily');
    });
  });

  describe('sendEmail', () => {
    test('should simulate email sending successfully', async () => {
      const emailData = {
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test HTML</p>',
        text: 'Test text'
      };

      const result = await digestDelivery.sendEmail(emailData);

      expect(result).toHaveProperty('messageId');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('recipient');

      expect(result.status).toBe('sent');
      expect(result.recipient).toBe('test@example.com');
      expect(result.messageId).toMatch(/^msg_/);
    });
  });

  describe('sendInAppNotification', () => {
    test('should simulate in-app notification sending successfully', async () => {
      const notificationData = {
        userId: mockScheduling.userId,
        title: 'Test Notification',
        message: 'Test message',
        data: { test: 'data' },
        type: 'digest'
      };

      const result = await digestDelivery.sendInAppNotification(notificationData);

      expect(result).toHaveProperty('notificationId');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('userId');

      expect(result.status).toBe('delivered');
      expect(result.userId).toBe(mockScheduling.userId);
      expect(result.notificationId).toMatch(/^notif_/);
    });
  });

  describe('getDeliveryStats', () => {
    test('should return delivery statistics', async () => {
      const stats = await digestDelivery.getDeliveryStats(mockScheduling.userId);

      expect(stats).toHaveProperty('userId');
      expect(stats).toHaveProperty('totalDeliveries');
      expect(stats).toHaveProperty('successfulDeliveries');
      expect(stats).toHaveProperty('failedDeliveries');
      expect(stats).toHaveProperty('lastDelivery');
      expect(stats).toHaveProperty('deliveryMethods');
      expect(stats).toHaveProperty('averageItemsPerDigest');
      expect(stats).toHaveProperty('period');

      expect(stats.userId).toBe(mockScheduling.userId);
      expect(typeof stats.totalDeliveries).toBe('number');
      expect(typeof stats.successfulDeliveries).toBe('number');
      expect(typeof stats.failedDeliveries).toBe('number');
      expect(stats.lastDelivery).toBeInstanceOf(Date);

      expect(stats.deliveryMethods).toHaveProperty('email');
      expect(stats.deliveryMethods).toHaveProperty('inApp');
      expect(stats.deliveryMethods.email).toHaveProperty('count');
      expect(stats.deliveryMethods.email).toHaveProperty('successRate');
    });

    test('should accept period parameter', async () => {
      const stats = await digestDelivery.getDeliveryStats(mockScheduling.userId, { period: '7d' });

      expect(stats.period).toBe('7d');
    });
  });

  describe('Service Dependencies', () => {
    test('should set service dependencies', () => {
      const mockServices = {
        emailService: { mock: 'email' },
        notificationService: { mock: 'notification' }
      };

      digestDelivery.setServices(mockServices);

      expect(digestDelivery.emailService).toBe(mockServices.emailService);
      expect(digestDelivery.notificationService).toBe(mockServices.notificationService);
    });
  });

  describe('Error Handling', () => {
    test('should handle missing digest data gracefully', async () => {
      const invalidDigest = null;

      await expect(digestDelivery.deliverDigest(invalidDigest, mockScheduling))
        .rejects.toThrow();
    });

    test('should handle missing scheduling data gracefully', async () => {
      const invalidScheduling = null;

      await expect(digestDelivery.deliverDigest(mockDigest, invalidScheduling))
        .rejects.toThrow();
    });
  });
});