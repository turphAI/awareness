const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require('../index');
const DigestScheduling = require('../models/DigestScheduling');

// Mock the auth middleware
jest.mock('../middleware/auth', () => (req, res, next) => {
  req.user = { id: 'test-user-id' };
  next();
});

describe('DigestSchedulingController', () => {
  let testUserId;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/test-ai-aggregator');
    testUserId = new mongoose.Types.ObjectId();
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await DigestScheduling.deleteMany({});
  });

  describe('GET /api/digest-scheduling/:userId', () => {
    test('should get digest scheduling settings for user', async () => {
      const response = await request(app)
        .get(`/api/digest-scheduling/${testUserId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('userId');
      expect(response.body.data).toHaveProperty('enabled');
      expect(response.body.data).toHaveProperty('frequency');
      expect(response.body.data).toHaveProperty('deliveryTime');
      expect(response.body.data).toHaveProperty('contentSelection');
      expect(response.body.data).toHaveProperty('formatting');
      expect(response.body.data).toHaveProperty('deliveryMethod');
    });

    test('should return 400 for missing userId', async () => {
      const response = await request(app)
        .get('/api/digest-scheduling/')
        .expect(404);
    });
  });

  describe('PUT /api/digest-scheduling/:userId', () => {
    test('should update digest scheduling settings', async () => {
      const updateData = {
        enabled: false,
        frequency: 'weekly',
        deliveryTime: {
          hour: 10,
          minute: 30,
          timezone: 'EST'
        },
        weeklySettings: {
          dayOfWeek: 2
        }
      };

      const response = await request(app)
        .put(`/api/digest-scheduling/${testUserId}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.enabled).toBe(false);
      expect(response.body.data.frequency).toBe('weekly');
      expect(response.body.data.deliveryTime.hour).toBe(10);
      expect(response.body.data.deliveryTime.minute).toBe(30);
      expect(response.body.data.weeklySettings.dayOfWeek).toBe(2);
    });

    test('should return validation errors for invalid data', async () => {
      const invalidData = {
        frequency: 'invalid-frequency'
      };

      const response = await request(app)
        .put(`/api/digest-scheduling/${testUserId}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid scheduling data');
    });

    test('should return 400 for missing userId', async () => {
      const response = await request(app)
        .put('/api/digest-scheduling/')
        .send({})
        .expect(404);
    });
  });

  describe('PUT /api/digest-scheduling/:userId/toggle', () => {
    test('should enable digest scheduling', async () => {
      const response = await request(app)
        .put(`/api/digest-scheduling/${testUserId}/toggle`)
        .send({ enabled: true })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.enabled).toBe(true);
      expect(response.body.data.nextDelivery).toBeTruthy();
      expect(response.body.message).toContain('enabled');
    });

    test('should disable digest scheduling', async () => {
      const response = await request(app)
        .put(`/api/digest-scheduling/${testUserId}/toggle`)
        .send({ enabled: false })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.enabled).toBe(false);
      expect(response.body.data.nextDelivery).toBeNull();
      expect(response.body.message).toContain('disabled');
    });

    test('should return 400 for invalid enabled value', async () => {
      const response = await request(app)
        .put(`/api/digest-scheduling/${testUserId}/toggle`)
        .send({ enabled: 'invalid' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('boolean');
    });
  });

  describe('PUT /api/digest-scheduling/:userId/frequency', () => {
    test('should update delivery frequency to weekly', async () => {
      const response = await request(app)
        .put(`/api/digest-scheduling/${testUserId}/frequency`)
        .send({ 
          frequency: 'weekly',
          weeklySettings: { dayOfWeek: 3 }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.frequency).toBe('weekly');
      expect(response.body.data.weeklySettings.dayOfWeek).toBe(3);
    });

    test('should update delivery frequency to monthly', async () => {
      const response = await request(app)
        .put(`/api/digest-scheduling/${testUserId}/frequency`)
        .send({ 
          frequency: 'monthly',
          monthlySettings: { dayOfMonth: 15 }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.frequency).toBe('monthly');
      expect(response.body.data.monthlySettings.dayOfMonth).toBe(15);
    });

    test('should return 400 for invalid frequency', async () => {
      const response = await request(app)
        .put(`/api/digest-scheduling/${testUserId}/frequency`)
        .send({ frequency: 'invalid' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid frequency');
    });

    test('should return 400 for missing frequency', async () => {
      const response = await request(app)
        .put(`/api/digest-scheduling/${testUserId}/frequency`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('required');
    });
  });

  describe('PUT /api/digest-scheduling/:userId/delivery-time', () => {
    test('should update delivery time', async () => {
      const response = await request(app)
        .put(`/api/digest-scheduling/${testUserId}/delivery-time`)
        .send({ 
          hour: 14,
          minute: 30,
          timezone: 'PST'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.deliveryTime.hour).toBe(14);
      expect(response.body.data.deliveryTime.minute).toBe(30);
      expect(response.body.data.deliveryTime.timezone).toBe('PST');
    });

    test('should return 400 for invalid hour', async () => {
      const response = await request(app)
        .put(`/api/digest-scheduling/${testUserId}/delivery-time`)
        .send({ hour: 25 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Hour must be between 0 and 23');
    });

    test('should return 400 for invalid minute', async () => {
      const response = await request(app)
        .put(`/api/digest-scheduling/${testUserId}/delivery-time`)
        .send({ minute: 60 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Minute must be between 0 and 59');
    });
  });

  describe('PUT /api/digest-scheduling/:userId/content-selection', () => {
    test('should update content selection criteria', async () => {
      const contentSelection = {
        maxItems: 15,
        prioritizeBreakingNews: false,
        includePersonalizedContent: true,
        contentTypes: {
          articles: true,
          papers: false,
          podcasts: true,
          videos: false,
          social: false
        },
        topicFilters: ['AI', 'ML'],
        sourceFilters: [new mongoose.Types.ObjectId()]
      };

      const response = await request(app)
        .put(`/api/digest-scheduling/${testUserId}/content-selection`)
        .send(contentSelection)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.contentSelection.maxItems).toBe(15);
      expect(response.body.data.contentSelection.prioritizeBreakingNews).toBe(false);
      expect(response.body.data.contentSelection.contentTypes.articles).toBe(true);
      expect(response.body.data.contentSelection.contentTypes.papers).toBe(false);
      expect(response.body.data.contentSelection.topicFilters).toEqual(['AI', 'ML']);
    });

    test('should return validation errors for invalid maxItems', async () => {
      const response = await request(app)
        .put(`/api/digest-scheduling/${testUserId}/content-selection`)
        .send({ maxItems: 100 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid content selection configuration');
    });
  });

  describe('PUT /api/digest-scheduling/:userId/formatting', () => {
    test('should update formatting preferences', async () => {
      const formatting = {
        includeFullSummaries: false,
        includeThumbnails: true,
        includeReadingTime: false,
        groupByTopic: true,
        sortBy: 'popularity'
      };

      const response = await request(app)
        .put(`/api/digest-scheduling/${testUserId}/formatting`)
        .send(formatting)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.formatting.includeFullSummaries).toBe(false);
      expect(response.body.data.formatting.includeThumbnails).toBe(true);
      expect(response.body.data.formatting.sortBy).toBe('popularity');
    });
  });

  describe('PUT /api/digest-scheduling/:userId/delivery-method', () => {
    test('should update delivery method settings', async () => {
      const deliveryMethod = {
        email: {
          enabled: true,
          address: 'test@example.com'
        },
        inApp: {
          enabled: false
        }
      };

      const response = await request(app)
        .put(`/api/digest-scheduling/${testUserId}/delivery-method`)
        .send(deliveryMethod)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.deliveryMethod.email.enabled).toBe(true);
      expect(response.body.data.deliveryMethod.email.address).toBe('test@example.com');
      expect(response.body.data.deliveryMethod.inApp.enabled).toBe(false);
    });

    test('should return validation error when no delivery method enabled', async () => {
      const deliveryMethod = {
        email: { enabled: false },
        inApp: { enabled: false }
      };

      const response = await request(app)
        .put(`/api/digest-scheduling/${testUserId}/delivery-method`)
        .send(deliveryMethod)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid delivery method configuration');
    });
  });

  describe('GET /api/digest-scheduling/:userId/next-delivery', () => {
    test('should get next delivery time', async () => {
      const response = await request(app)
        .get(`/api/digest-scheduling/${testUserId}/next-delivery`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('nextDelivery');
      expect(response.body.data).toHaveProperty('enabled');
      expect(response.body.data).toHaveProperty('frequency');
      expect(response.body.data).toHaveProperty('deliveryTime');
    });
  });

  describe('POST /api/digest-scheduling/:userId/mark-completed', () => {
    test('should mark delivery as completed', async () => {
      const response = await request(app)
        .post(`/api/digest-scheduling/${testUserId}/mark-completed`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('lastDelivery');
      expect(response.body.data).toHaveProperty('nextDelivery');
      expect(response.body.message).toContain('completed');
    });
  });

  describe('GET /api/digest-scheduling/:userId/content-criteria', () => {
    test('should get content selection criteria', async () => {
      const response = await request(app)
        .get(`/api/digest-scheduling/${testUserId}/content-criteria`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('maxItems');
      expect(response.body.data).toHaveProperty('prioritizeBreakingNews');
      expect(response.body.data).toHaveProperty('contentTypes');
      expect(response.body.data).toHaveProperty('sortBy');
    });
  });

  describe('GET /api/digest-scheduling/:userId/formatting-preferences', () => {
    test('should get formatting preferences', async () => {
      const response = await request(app)
        .get(`/api/digest-scheduling/${testUserId}/formatting-preferences`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('includeFullSummaries');
      expect(response.body.data).toHaveProperty('includeThumbnails');
      expect(response.body.data).toHaveProperty('groupByTopic');
      expect(response.body.data).toHaveProperty('sortBy');
    });
  });

  describe('DELETE /api/digest-scheduling/:userId', () => {
    test('should reset scheduling to defaults', async () => {
      // First create a custom scheduling
      await request(app)
        .put(`/api/digest-scheduling/${testUserId}`)
        .send({ frequency: 'weekly' });

      // Then reset it
      const response = await request(app)
        .delete(`/api/digest-scheduling/${testUserId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.frequency).toBe('daily'); // Back to default
      expect(response.body.message).toContain('reset to defaults');
    });
  });

  describe('GET /api/digest-scheduling/frequency-options/info', () => {
    test('should get frequency options', async () => {
      const response = await request(app)
        .get('/api/digest-scheduling/frequency-options/info')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('daily');
      expect(response.body.data).toHaveProperty('weekly');
      expect(response.body.data).toHaveProperty('bi-weekly');
      expect(response.body.data).toHaveProperty('monthly');
      
      expect(response.body.data.daily).toHaveProperty('name');
      expect(response.body.data.daily).toHaveProperty('description');
      expect(response.body.data.daily).toHaveProperty('settings');
    });
  });

  describe('GET /api/digest-scheduling/ready-for-delivery/list', () => {
    test('should get schedules ready for delivery', async () => {
      // Create a schedule ready for delivery
      const readyScheduling = new DigestScheduling({
        userId: testUserId,
        enabled: true,
        nextDelivery: new Date(Date.now() - 1000) // 1 second ago
      });
      await readyScheduling.save();

      const response = await request(app)
        .get('/api/digest-scheduling/ready-for-delivery/list')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.count).toBe(1);
      expect(response.body.data[0].userId.toString()).toBe(testUserId.toString());
    });

    test('should return empty array when no schedules ready', async () => {
      const response = await request(app)
        .get('/api/digest-scheduling/ready-for-delivery/list')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.count).toBe(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors gracefully', async () => {
      // Mock a database error
      jest.spyOn(DigestScheduling, 'getOrCreateForUser').mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .get(`/api/digest-scheduling/${testUserId}`)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Failed to get digest scheduling');

      // Restore the mock
      DigestScheduling.getOrCreateForUser.mockRestore();
    });
  });
});