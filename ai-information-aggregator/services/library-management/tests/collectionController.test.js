const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Collection = require('../models/Collection');
const jwt = require('jsonwebtoken');

// Mock the app to avoid server startup issues
const express = require('express');
const collectionRoutes = require('../routes/collections');

const app = express();
app.use(express.json());
app.use('/api/collections', collectionRoutes);

describe('Collection Controller', () => {
  let mongoServer;
  let authToken;
  let userId;
  let testCollection;

  beforeAll(async () => {
    // Start in-memory MongoDB instance
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    
    // Connect to the in-memory database
    await mongoose.connect(mongoUri);

    // Create test user and auth token
    userId = new mongoose.Types.ObjectId();
    authToken = jwt.sign(
      { userId: userId.toString() },
      process.env.JWT_SECRET || 'fallback-secret-key'
    );
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear collections before each test
    await Collection.deleteMany({});

    // Create a test collection
    testCollection = new Collection({
      userId,
      name: 'Test Collection',
      description: 'A test collection',
      public: false,
      contentIds: [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()]
    });
    await testCollection.save();
  });

  describe('POST /api/collections', () => {
    it('should create a new collection successfully', async () => {
      const collectionData = {
        name: 'New Collection',
        description: 'A new test collection',
        public: true,
        color: '#ff0000',
        tags: ['test', 'new']
      };

      const response = await request(app)
        .post('/api/collections')
        .set('Authorization', `Bearer ${authToken}`)
        .send(collectionData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Collection created successfully');
      expect(response.body.data.name).toBe(collectionData.name);
      expect(response.body.data.description).toBe(collectionData.description);
      expect(response.body.data.public).toBe(true);
      expect(response.body.data.userId.toString()).toBe(userId.toString());
    });

    it('should fail to create collection with duplicate name', async () => {
      const collectionData = {
        name: 'Test Collection', // Same as existing collection
        description: 'Duplicate name test'
      };

      const response = await request(app)
        .post('/api/collections')
        .set('Authorization', `Bearer ${authToken}`)
        .send(collectionData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Collection with this name already exists');
    });

    it('should fail to create collection without authentication', async () => {
      const collectionData = {
        name: 'Unauthorized Collection'
      };

      const response = await request(app)
        .post('/api/collections')
        .send(collectionData)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should fail to create collection with invalid data', async () => {
      const collectionData = {
        name: '', // Empty name
        color: 'invalid-color'
      };

      const response = await request(app)
        .post('/api/collections')
        .set('Authorization', `Bearer ${authToken}`)
        .send(collectionData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('GET /api/collections', () => {
    it('should get user collections successfully', async () => {
      const response = await request(app)
        .get('/api/collections')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.collections).toHaveLength(1);
      expect(response.body.data.collections[0].name).toBe('Test Collection');
      expect(response.body.data.pagination).toBeDefined();
    });

    it('should support pagination', async () => {
      // Create additional collections
      for (let i = 0; i < 5; i++) {
        await new Collection({
          userId,
          name: `Collection ${i}`,
          description: `Test collection ${i}`
        }).save();
      }

      const response = await request(app)
        .get('/api/collections?limit=3&offset=2')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.collections).toHaveLength(3);
      expect(response.body.data.pagination.total).toBe(6); // 1 original + 5 new
      expect(response.body.data.pagination.hasMore).toBe(true);
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .get('/api/collections')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/collections/:collectionId', () => {
    it('should get collection by ID successfully', async () => {
      const response = await request(app)
        .get(`/api/collections/${testCollection._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Test Collection');
      expect(response.body.data.contentIds).toHaveLength(2);
    });

    it('should return 404 for non-existent collection', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      
      const response = await request(app)
        .get(`/api/collections/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Collection not found');
    });

    it('should deny access to private collection of another user', async () => {
      const otherUserId = new mongoose.Types.ObjectId();
      const otherUserToken = jwt.sign(
        { userId: otherUserId.toString() },
        process.env.JWT_SECRET || 'fallback-secret-key'
      );

      const response = await request(app)
        .get(`/api/collections/${testCollection._id}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access denied to this collection');
    });

    it('should allow access to public collection', async () => {
      // Make collection public
      testCollection.public = true;
      await testCollection.save();

      const otherUserId = new mongoose.Types.ObjectId();
      const otherUserToken = jwt.sign(
        { userId: otherUserId.toString() },
        process.env.JWT_SECRET || 'fallback-secret-key'
      );

      const response = await request(app)
        .get(`/api/collections/${testCollection._id}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Test Collection');
    });
  });

  describe('PUT /api/collections/:collectionId', () => {
    it('should update collection successfully', async () => {
      const updates = {
        name: 'Updated Collection',
        description: 'Updated description',
        public: true,
        color: '#00ff00'
      };

      const response = await request(app)
        .put(`/api/collections/${testCollection._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updates)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Collection updated successfully');
      expect(response.body.data.name).toBe('Updated Collection');
      expect(response.body.data.public).toBe(true);
    });

    it('should fail to update with duplicate name', async () => {
      // Create another collection
      await new Collection({
        userId,
        name: 'Another Collection',
        description: 'Another test collection'
      }).save();

      const updates = {
        name: 'Another Collection' // Duplicate name
      };

      const response = await request(app)
        .put(`/api/collections/${testCollection._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updates)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Collection with this name already exists');
    });

    it('should deny update access to non-owner', async () => {
      const otherUserId = new mongoose.Types.ObjectId();
      const otherUserToken = jwt.sign(
        { userId: otherUserId.toString() },
        process.env.JWT_SECRET || 'fallback-secret-key'
      );

      const updates = { name: 'Unauthorized Update' };

      const response = await request(app)
        .put(`/api/collections/${testCollection._id}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send(updates)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Permission denied to update this collection');
    });
  });

  describe('DELETE /api/collections/:collectionId', () => {
    it('should delete collection successfully', async () => {
      const response = await request(app)
        .delete(`/api/collections/${testCollection._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Collection deleted successfully');

      // Verify collection is deleted
      const deletedCollection = await Collection.findById(testCollection._id);
      expect(deletedCollection).toBeNull();
    });

    it('should deny delete access to non-owner', async () => {
      const otherUserId = new mongoose.Types.ObjectId();
      const otherUserToken = jwt.sign(
        { userId: otherUserId.toString() },
        process.env.JWT_SECRET || 'fallback-secret-key'
      );

      const response = await request(app)
        .delete(`/api/collections/${testCollection._id}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Only collection owner can delete the collection');
    });

    it('should return 404 for non-existent collection', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      
      const response = await request(app)
        .delete(`/api/collections/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Collection not found');
    });
  });

  describe('POST /api/collections/:collectionId/content', () => {
    it('should add content to collection successfully', async () => {
      const newContentIds = [
        new mongoose.Types.ObjectId(),
        new mongoose.Types.ObjectId()
      ];

      const response = await request(app)
        .post(`/api/collections/${testCollection._id}/content`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ contentIds: newContentIds })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Content added to collection successfully');

      // Verify content was added
      const updatedCollection = await Collection.findById(testCollection._id);
      expect(updatedCollection.contentIds).toHaveLength(4); // 2 original + 2 new
    });

    it('should not add duplicate content', async () => {
      const existingContentId = testCollection.contentIds[0];

      const response = await request(app)
        .post(`/api/collections/${testCollection._id}/content`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ contentIds: [existingContentId] })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify no duplicates were added
      const updatedCollection = await Collection.findById(testCollection._id);
      expect(updatedCollection.contentIds).toHaveLength(2); // Still 2
    });

    it('should deny content addition to non-authorized user', async () => {
      const otherUserId = new mongoose.Types.ObjectId();
      const otherUserToken = jwt.sign(
        { userId: otherUserId.toString() },
        process.env.JWT_SECRET || 'fallback-secret-key'
      );

      const newContentIds = [new mongoose.Types.ObjectId()];

      const response = await request(app)
        .post(`/api/collections/${testCollection._id}/content`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({ contentIds: newContentIds })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Permission denied to add content to this collection');
    });
  });

  describe('DELETE /api/collections/:collectionId/content', () => {
    it('should remove content from collection successfully', async () => {
      const contentToRemove = [testCollection.contentIds[0]];

      const response = await request(app)
        .delete(`/api/collections/${testCollection._id}/content`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ contentIds: contentToRemove })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Content removed from collection successfully');

      // Verify content was removed
      const updatedCollection = await Collection.findById(testCollection._id);
      expect(updatedCollection.contentIds).toHaveLength(1);
    });

    it('should deny content removal to non-authorized user', async () => {
      const otherUserId = new mongoose.Types.ObjectId();
      const otherUserToken = jwt.sign(
        { userId: otherUserId.toString() },
        process.env.JWT_SECRET || 'fallback-secret-key'
      );

      const contentToRemove = [testCollection.contentIds[0]];

      const response = await request(app)
        .delete(`/api/collections/${testCollection._id}/content`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({ contentIds: contentToRemove })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Permission denied to remove content from this collection');
    });
  });

  describe('POST /api/collections/:collectionId/collaborators', () => {
    it('should add collaborator successfully', async () => {
      const collaboratorUserId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .post(`/api/collections/${testCollection._id}/collaborators`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ 
          collaboratorUserId: collaboratorUserId.toString(),
          role: 'editor'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Collaborator added successfully');

      // Verify collaborator was added
      const updatedCollection = await Collection.findById(testCollection._id);
      expect(updatedCollection.collaborators).toHaveLength(1);
      expect(updatedCollection.collaborators[0].role).toBe('editor');
    });

    it('should deny collaborator addition to non-owner', async () => {
      const otherUserId = new mongoose.Types.ObjectId();
      const otherUserToken = jwt.sign(
        { userId: otherUserId.toString() },
        process.env.JWT_SECRET || 'fallback-secret-key'
      );

      const collaboratorUserId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .post(`/api/collections/${testCollection._id}/collaborators`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({ 
          collaboratorUserId: collaboratorUserId.toString(),
          role: 'viewer'
        })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Permission denied to add collaborators');
    });
  });

  describe('DELETE /api/collections/:collectionId/collaborators/:collaboratorUserId', () => {
    beforeEach(async () => {
      // Add a collaborator to test removal
      const collaboratorUserId = new mongoose.Types.ObjectId();
      await testCollection.addCollaborator(collaboratorUserId, 'editor');
    });

    it('should remove collaborator successfully', async () => {
      const collaboratorUserId = testCollection.collaborators[0].userId;

      const response = await request(app)
        .delete(`/api/collections/${testCollection._id}/collaborators/${collaboratorUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Collaborator removed successfully');

      // Verify collaborator was removed
      const updatedCollection = await Collection.findById(testCollection._id);
      expect(updatedCollection.collaborators).toHaveLength(0);
    });

    it('should deny collaborator removal to non-owner', async () => {
      const otherUserId = new mongoose.Types.ObjectId();
      const otherUserToken = jwt.sign(
        { userId: otherUserId.toString() },
        process.env.JWT_SECRET || 'fallback-secret-key'
      );

      const collaboratorUserId = testCollection.collaborators[0].userId;

      const response = await request(app)
        .delete(`/api/collections/${testCollection._id}/collaborators/${collaboratorUserId}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Permission denied to remove collaborators');
    });
  });

  describe('GET /api/collections/search', () => {
    beforeEach(async () => {
      // Create additional collections for search testing
      await new Collection({
        userId,
        name: 'AI Research Collection',
        description: 'Collection about artificial intelligence research',
        tags: ['ai', 'research'],
        public: true
      }).save();

      await new Collection({
        userId,
        name: 'Machine Learning Papers',
        description: 'Papers about machine learning algorithms',
        tags: ['ml', 'papers'],
        public: false
      }).save();
    });

    it('should search collections successfully', async () => {
      const response = await request(app)
        .get('/api/collections/search?query=AI')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.collections.length).toBeGreaterThan(0);
      expect(response.body.data.pagination).toBeDefined();
    });

    it('should require search query', async () => {
      const response = await request(app)
        .get('/api/collections/search')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Search query is required');
    });
  });

  describe('GET /api/collections/public', () => {
    beforeEach(async () => {
      // Create public collections
      await new Collection({
        userId,
        name: 'Public Collection 1',
        description: 'First public collection',
        public: true,
        featured: true,
        viewCount: 100
      }).save();

      await new Collection({
        userId,
        name: 'Public Collection 2',
        description: 'Second public collection',
        public: true,
        viewCount: 50
      }).save();
    });

    it('should get public collections successfully', async () => {
      const response = await request(app)
        .get('/api/collections/public')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.collections.length).toBeGreaterThan(0);
      expect(response.body.data.pagination).toBeDefined();
    });

    it('should get featured collections', async () => {
      const response = await request(app)
        .get('/api/collections/public?featured=true')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.collections.length).toBeGreaterThan(0);
      expect(response.body.data.collections[0].featured).toBe(true);
    });

    it('should get popular collections', async () => {
      const response = await request(app)
        .get('/api/collections/public?popular=true')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.collections.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/collections/content/:contentId', () => {
    let contentId;

    beforeEach(async () => {
      contentId = testCollection.contentIds[0];
      
      // Create another collection with the same content
      await new Collection({
        userId,
        name: 'Another Collection',
        description: 'Another collection with same content',
        contentIds: [contentId]
      }).save();
    });

    it('should get collections containing specific content', async () => {
      const response = await request(app)
        .get(`/api/collections/content/${contentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(2); // Both collections contain this content
    });

    it('should return empty array for content not in any collection', async () => {
      const nonExistentContentId = new mongoose.Types.ObjectId();
      
      const response = await request(app)
        .get(`/api/collections/content/${nonExistentContentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(0);
    });
  });

  describe('PUT /api/collections/:collectionId/metadata', () => {
    it('should update collection metadata successfully', async () => {
      const metadata = {
        customField1: 'value1',
        customField2: { nested: 'value2' },
        customField3: ['array', 'value']
      };

      const response = await request(app)
        .put(`/api/collections/${testCollection._id}/metadata`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ metadata })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Collection metadata updated successfully');

      // Verify metadata was updated
      const updatedCollection = await Collection.findById(testCollection._id);
      expect(updatedCollection.metadata.get('customField1')).toBe('value1');
      expect(updatedCollection.metadata.get('customField2')).toEqual({ nested: 'value2' });
    });

    it('should deny metadata update to non-authorized user', async () => {
      const otherUserId = new mongoose.Types.ObjectId();
      const otherUserToken = jwt.sign(
        { userId: otherUserId.toString() },
        process.env.JWT_SECRET || 'fallback-secret-key'
      );

      const metadata = { customField: 'value' };

      const response = await request(app)
        .put(`/api/collections/${testCollection._id}/metadata`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({ metadata })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Permission denied to update collection metadata');
    });
  });
});