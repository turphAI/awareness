const mongoose = require('mongoose');
const DigestScheduling = require('../models/DigestScheduling');

describe('DigestScheduling Basic Integration', () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/test-ai-aggregator');
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await DigestScheduling.deleteMany({});
  });

  test('should create and configure digest scheduling for a user', async () => {
    const userId = new mongoose.Types.ObjectId();
    
    // Create initial scheduling
    let scheduling = await DigestScheduling.getOrCreateForUser(userId);
    expect(scheduling.enabled).toBe(true);
    expect(scheduling.frequency).toBe('daily');
    expect(scheduling.deliveryMethod.inApp.enabled).toBe(true);
    expect(scheduling.deliveryMethod.email.enabled).toBe(false);
    
    // Configure for weekly delivery with email
    scheduling.frequency = 'weekly';
    scheduling.weeklySettings.dayOfWeek = 1; // Monday
    scheduling.deliveryTime.hour = 9;
    scheduling.deliveryTime.minute = 0;
    scheduling.deliveryMethod.email.enabled = true;
    scheduling.deliveryMethod.email.address = 'user@example.com';
    
    // Update content selection
    scheduling.contentSelection.maxItems = 15;
    scheduling.contentSelection.contentTypes.articles = true;
    scheduling.contentSelection.contentTypes.papers = true;
    scheduling.contentSelection.contentTypes.podcasts = false;
    scheduling.contentSelection.topicFilters = ['AI', 'Machine Learning'];
    
    // Update formatting preferences
    scheduling.formatting.includeFullSummaries = false;
    scheduling.formatting.groupByTopic = true;
    scheduling.formatting.sortBy = 'recency';
    
    // Mark modified fields explicitly
    scheduling.markModified('deliveryTime');
    scheduling.markModified('deliveryMethod');
    scheduling.markModified('contentSelection');
    scheduling.markModified('formatting');
    scheduling.markModified('weeklySettings');
    
    await scheduling.save();
    
    // Verify the configuration
    const savedScheduling = await DigestScheduling.findOne({ userId });
    expect(savedScheduling.frequency).toBe('weekly');
    expect(savedScheduling.weeklySettings.dayOfWeek).toBe(1);
    expect(savedScheduling.deliveryTime.hour).toBe(9);
    expect(savedScheduling.deliveryMethod.email.address).toBe('user@example.com');
    expect(savedScheduling.contentSelection.maxItems).toBe(15);
    expect(savedScheduling.contentSelection.topicFilters).toEqual(['AI', 'Machine Learning']);
    expect(savedScheduling.formatting.sortBy).toBe('recency');
    
    // Test next delivery calculation
    const nextDelivery = savedScheduling.calculateNextDelivery();
    expect(nextDelivery).toBeInstanceOf(Date);
    expect(nextDelivery.getDay()).toBe(1); // Monday
    expect(nextDelivery.getHours()).toBe(9);
    expect(nextDelivery.getMinutes()).toBe(0);
    
    // Test content selection criteria
    const criteria = savedScheduling.getContentSelectionCriteria();
    expect(criteria.maxItems).toBe(15);
    expect(criteria.contentTypes).toEqual(['articles', 'papers']);
    expect(criteria.topicFilters).toEqual(['AI', 'Machine Learning']);
    expect(criteria.sortBy).toBe('recency');
    
    // Test formatting preferences
    const preferences = savedScheduling.getFormattingPreferences();
    expect(preferences.includeFullSummaries).toBe(false);
    expect(preferences.groupByTopic).toBe(true);
    expect(preferences.sortBy).toBe('recency');
  });

  test('should handle delivery completion and scheduling', async () => {
    const userId = new mongoose.Types.ObjectId();
    
    // Create scheduling
    let scheduling = await DigestScheduling.getOrCreateForUser(userId);
    scheduling.frequency = 'daily';
    scheduling.deliveryTime.hour = 10;
    scheduling.markModified('deliveryTime');
    await scheduling.save();
    
    const originalNextDelivery = scheduling.nextDelivery;
    
    // Mark delivery as completed
    scheduling.markDeliveryCompleted();
    await scheduling.save();
    
    // Verify last delivery was set and next delivery was updated
    expect(scheduling.lastDelivery).toBeInstanceOf(Date);
    expect(scheduling.nextDelivery).toBeInstanceOf(Date);
    expect(scheduling.nextDelivery.getTime()).toBeGreaterThan(originalNextDelivery.getTime());
  });

  test('should find schedules ready for delivery', async () => {
    const userId1 = new mongoose.Types.ObjectId();
    const userId2 = new mongoose.Types.ObjectId();
    const userId3 = new mongoose.Types.ObjectId();
    
    // Create ready schedule
    const readyScheduling = new DigestScheduling({
      userId: userId1,
      enabled: true,
      nextDelivery: new Date(Date.now() - 1000) // 1 second ago
    });
    await readyScheduling.save();
    
    // Create not ready schedule
    const notReadyScheduling = new DigestScheduling({
      userId: userId2,
      enabled: true,
      nextDelivery: new Date(Date.now() + 60000) // 1 minute from now
    });
    await notReadyScheduling.save();
    
    // Create disabled schedule
    const disabledScheduling = new DigestScheduling({
      userId: userId3,
      enabled: false,
      nextDelivery: new Date(Date.now() - 1000)
    });
    await disabledScheduling.save();
    
    // Wait a moment to ensure the ready schedule is actually ready
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Find ready schedules
    const readySchedules = await DigestScheduling.findReadyForDelivery();
    
    expect(readySchedules.length).toBeGreaterThanOrEqual(1);
    const readySchedule = readySchedules.find(s => s.userId.toString() === userId1.toString());
    expect(readySchedule).toBeDefined();
  });

  test('should validate configuration correctly', async () => {
    const userId = new mongoose.Types.ObjectId();
    const scheduling = await DigestScheduling.getOrCreateForUser(userId);
    
    // Valid configuration should have no errors
    let errors = scheduling.validateConfiguration();
    expect(errors).toHaveLength(0);
    
    // Invalid hour should produce error
    scheduling.deliveryTime.hour = 25;
    errors = scheduling.validateConfiguration();
    expect(errors).toContain('Invalid delivery hour: must be between 0 and 23');
    
    // Fix hour and test invalid minute
    scheduling.deliveryTime.hour = 8;
    scheduling.deliveryTime.minute = 60;
    errors = scheduling.validateConfiguration();
    expect(errors).toContain('Invalid delivery minute: must be between 0 and 59');
    
    // Fix minute and test invalid max items
    scheduling.deliveryTime.minute = 0;
    scheduling.contentSelection.maxItems = 100;
    errors = scheduling.validateConfiguration();
    expect(errors).toContain('Invalid max items: must be between 5 and 50');
    
    // Fix max items and test no delivery method enabled
    scheduling.contentSelection.maxItems = 20;
    scheduling.deliveryMethod.email.enabled = false;
    scheduling.deliveryMethod.inApp.enabled = false;
    errors = scheduling.validateConfiguration();
    expect(errors).toContain('At least one delivery method must be enabled');
    
    // Enable email without address
    scheduling.deliveryMethod.email.enabled = true;
    scheduling.deliveryMethod.email.address = '';
    errors = scheduling.validateConfiguration();
    expect(errors).toContain('Email address is required when email delivery is enabled');
  });

  test('should handle different frequency types correctly', async () => {
    const userId = new mongoose.Types.ObjectId();
    const scheduling = await DigestScheduling.getOrCreateForUser(userId);
    
    // Test daily frequency
    scheduling.frequency = 'daily';
    scheduling.deliveryTime.hour = 9;
    let nextDelivery = scheduling.calculateNextDelivery();
    expect(nextDelivery).toBeInstanceOf(Date);
    expect(nextDelivery.getHours()).toBe(9);
    
    // Test weekly frequency
    scheduling.frequency = 'weekly';
    scheduling.weeklySettings.dayOfWeek = 3; // Wednesday
    nextDelivery = scheduling.calculateNextDelivery();
    expect(nextDelivery).toBeInstanceOf(Date);
    expect(nextDelivery.getDay()).toBe(3);
    
    // Test monthly frequency
    scheduling.frequency = 'monthly';
    scheduling.monthlySettings.dayOfMonth = 15;
    nextDelivery = scheduling.calculateNextDelivery();
    expect(nextDelivery).toBeInstanceOf(Date);
    expect(nextDelivery.getDate()).toBe(15);
    
    // Test disabled scheduling
    scheduling.enabled = false;
    nextDelivery = scheduling.calculateNextDelivery();
    expect(nextDelivery).toBeNull();
  });
});