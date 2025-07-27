const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const redis = require('redis');

let mongoServer;
let redisClient;

// Global test setup
beforeAll(async () => {
  // Start in-memory MongoDB
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  // Start Redis client for testing
  redisClient = redis.createClient({
    host: 'localhost',
    port: 6379,
  });
  
  await redisClient.connect();
});

// Global test teardown
afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
  await redisClient.quit();
});

// Clean up between tests
beforeEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
  
  await redisClient.flushAll();
});

module.exports = {
  getMongoUri: () => mongoServer.getUri(),
  getRedisClient: () => redisClient,
};