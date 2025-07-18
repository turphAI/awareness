const mongoose = require('mongoose');
const Collection = require('../models/Collection');

// Connect to test database before tests
beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/test-db', {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
});

// Clear test database after tests
afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
});

// Clear collections collection before each test
beforeEach(async () => {
  await Collection.deleteMany({});
});

describe('Collection Model', () => {
  describe('Schema', () => {
    it('should create a new collection successfully', async () => {
      const collectionData = {
        userId: new mongoose.Types.ObjectId(),
        name: 'Test Collection',
        description: 'A test collection',
        contentIds: [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()],
        public: true,
        tags: ['AI', 'Machine Learning']
      };
      
      const collection = new Collection(collectionData);
      const savedCollection = await collection.save();
      
      expect(savedCollection._id).toBeDefined();
      expect(savedCollection.userId.toString()).toBe(collectionData.userId.toString());
      expect(savedCollection.name).toBe(collectionData.name);
      expect(savedCollection.description).toBe(collectionData.description);
      expect(savedCollection.contentIds).toHaveLength(2);
      expect(savedCollection.public).toBe(true);
      expect(savedCollection.featured).toBe(false); // Default value
      expect(savedCollection.color).toBe('#3498db'); // Default value
      expect(savedCollection.icon).toBe('folder'); // Default value
      expect(savedCollection.tags).toEqual(expect.arrayContaining(collectionData.tags));
    });
    
    it('should fail validation when required fields are missing', async () => {
      const collectionData = {
        description: 'A test collection'
        // Missing userId and name
      };
      
      const collection = new Collection(collectionData);
      
      await expect(collection.save()).rejects.toThrow();
    });
    
    it('should enforce unique constraint on userId and name', async () => {
      const userId = new mongoose.Types.ObjectId();
      const name = 'Test Collection';
      
      // Create first collection
      await new Collection({
        userId,
        name,
        description: 'First collection'
      }).save();
      
      // Try to create second collection with same userId and name
      const duplicateCollection = new Collection({
        userId,
        name,
        description: 'Second collection'
      });
      
      await expect(duplicateCollection.save()).rejects.toThrow();
    });
  });
  
  describe('Collection Methods', () => {
    it('should add content to collection', async () => {
      const collection = new Collection({
        userId: new mongoose.Types.ObjectId(),
        name: 'Test Collection'
      });
      await collection.save();
      
      expect(collection.contentIds).toHaveLength(0);
      
      const contentId1 = new mongoose.Types.ObjectId();
      await collection.addContent(contentId1);
      
      expect(collection.contentIds).toHaveLength(1);
      expect(collection.contentIds[0].toString()).toBe(contentId1.toString());
      
      // Add multiple content IDs
      const contentId2 = new mongoose.Types.ObjectId();
      const contentId3 = new mongoose.Types.ObjectId();
      await collection.addContent([contentId2, contentId3]);
      
      expect(collection.contentIds).toHaveLength(3);
      
      // Try to add duplicate content ID
      await collection.addContent(contentId1);
      
      // Should still have 3 content IDs (no duplicates)
      expect(collection.contentIds).toHaveLength(3);
    });
    
    it('should remove content from collection', async () => {
      const contentId1 = new mongoose.Types.ObjectId();
      const contentId2 = new mongoose.Types.ObjectId();
      const contentId3 = new mongoose.Types.ObjectId();
      
      const collection = new Collection({
        userId: new mongoose.Types.ObjectId(),
        name: 'Test Collection',
        contentIds: [contentId1, contentId2, contentId3]
      });
      await collection.save();
      
      expect(collection.contentIds).toHaveLength(3);
      
      // Remove single content ID
      await collection.removeContent(contentId2);
      
      expect(collection.contentIds).toHaveLength(2);
      expect(collection.contentIds.map(id => id.toString())).not.toContain(contentId2.toString());
      
      // Remove multiple content IDs
      await collection.removeContent([contentId1, contentId3]);
      
      expect(collection.contentIds).toHaveLength(0);
    });
    
    it('should record collection view', async () => {
      const collection = new Collection({
        userId: new mongoose.Types.ObjectId(),
        name: 'Test Collection'
      });
      await collection.save();
      
      expect(collection.viewCount).toBe(0);
      expect(collection.lastViewed).toBeNull();
      
      await collection.recordView();
      
      expect(collection.viewCount).toBe(1);
      expect(collection.lastViewed).toBeInstanceOf(Date);
      
      await collection.recordView();
      
      expect(collection.viewCount).toBe(2);
    });
    
    it('should add collaborator to collection', async () => {
      const collection = new Collection({
        userId: new mongoose.Types.ObjectId(),
        name: 'Test Collection'
      });
      await collection.save();
      
      expect(collection.collaborators).toHaveLength(0);
      
      const collaboratorId = new mongoose.Types.ObjectId();
      await collection.addCollaborator(collaboratorId, 'editor');
      
      expect(collection.collaborators).toHaveLength(1);
      expect(collection.collaborators[0].userId.toString()).toBe(collaboratorId.toString());
      expect(collection.collaborators[0].role).toBe('editor');
      
      // Update existing collaborator role
      await collection.addCollaborator(collaboratorId, 'admin');
      
      expect(collection.collaborators).toHaveLength(1);
      expect(collection.collaborators[0].role).toBe('admin');
    });
    
    it('should remove collaborator from collection', async () => {
      const collaboratorId1 = new mongoose.Types.ObjectId();
      const collaboratorId2 = new mongoose.Types.ObjectId();
      
      const collection = new Collection({
        userId: new mongoose.Types.ObjectId(),
        name: 'Test Collection',
        collaborators: [
          { userId: collaboratorId1, role: 'viewer' },
          { userId: collaboratorId2, role: 'editor' }
        ]
      });
      await collection.save();
      
      expect(collection.collaborators).toHaveLength(2);
      
      await collection.removeCollaborator(collaboratorId1);
      
      expect(collection.collaborators).toHaveLength(1);
      expect(collection.collaborators[0].userId.toString()).toBe(collaboratorId2.toString());
    });
    
    it('should update collection metadata', async () => {
      const collection = new Collection({
        userId: new mongoose.Types.ObjectId(),
        name: 'Test Collection'
      });
      await collection.save();
      
      const metadata = {
        source: 'Import',
        importDate: '2023-01-01',
        category: 'Research'
      };
      
      await collection.updateMetadata(metadata);
      
      expect(collection.metadata.get('source')).toBe('Import');
      expect(collection.metadata.get('importDate')).toBe('2023-01-01');
      expect(collection.metadata.get('category')).toBe('Research');
    });
  });
  
  describe('Static Methods', () => {
    it('should find collections by user', async () => {
      const userId1 = new mongoose.Types.ObjectId();
      const userId2 = new mongoose.Types.ObjectId();
      
      // Create test collections
      await Promise.all([
        new Collection({
          userId: userId1,
          name: 'Collection 1'
        }).save(),
        new Collection({
          userId: userId2,
          name: 'Collection 2'
        }).save(),
        new Collection({
          userId: userId1,
          name: 'Collection 3'
        }).save()
      ]);
      
      const user1Collections = await Collection.findByUser(userId1);
      expect(user1Collections).toHaveLength(2);
      expect(user1Collections[0].userId.toString()).toBe(userId1.toString());
      expect(user1Collections[1].userId.toString()).toBe(userId1.toString());
      
      const user2Collections = await Collection.findByUser(userId2);
      expect(user2Collections).toHaveLength(1);
      expect(user2Collections[0].userId.toString()).toBe(userId2.toString());
    });
    
    it('should find collections by content', async () => {
      const contentId1 = new mongoose.Types.ObjectId();
      const contentId2 = new mongoose.Types.ObjectId();
      
      // Create test collections
      await Promise.all([
        new Collection({
          userId: new mongoose.Types.ObjectId(),
          name: 'Collection 1',
          contentIds: [contentId1, contentId2]
        }).save(),
        new Collection({
          userId: new mongoose.Types.ObjectId(),
          name: 'Collection 2',
          contentIds: [contentId2]
        }).save(),
        new Collection({
          userId: new mongoose.Types.ObjectId(),
          name: 'Collection 3',
          contentIds: []
        }).save()
      ]);
      
      const content1Collections = await Collection.findByContent(contentId1);
      expect(content1Collections).toHaveLength(1);
      expect(content1Collections[0].name).toBe('Collection 1');
      
      const content2Collections = await Collection.findByContent(contentId2);
      expect(content2Collections).toHaveLength(2);
    });
    
    it('should find collections by collaborator', async () => {
      const collaboratorId = new mongoose.Types.ObjectId();
      
      // Create test collections
      await Promise.all([
        new Collection({
          userId: new mongoose.Types.ObjectId(),
          name: 'Collection 1',
          collaborators: [{ userId: collaboratorId, role: 'viewer' }]
        }).save(),
        new Collection({
          userId: new mongoose.Types.ObjectId(),
          name: 'Collection 2'
        }).save(),
        new Collection({
          userId: new mongoose.Types.ObjectId(),
          name: 'Collection 3',
          collaborators: [{ userId: collaboratorId, role: 'editor' }]
        }).save()
      ]);
      
      const collaboratorCollections = await Collection.findByCollaborator(collaboratorId);
      expect(collaboratorCollections).toHaveLength(2);
      expect(collaboratorCollections[0].name).toBe('Collection 1');
      expect(collaboratorCollections[1].name).toBe('Collection 3');
    });
    
    it('should find public collections', async () => {
      // Create test collections
      await Promise.all([
        new Collection({
          userId: new mongoose.Types.ObjectId(),
          name: 'Collection 1',
          public: true,
          viewCount: 10
        }).save(),
        new Collection({
          userId: new mongoose.Types.ObjectId(),
          name: 'Collection 2',
          public: false
        }).save(),
        new Collection({
          userId: new mongoose.Types.ObjectId(),
          name: 'Collection 3',
          public: true,
          viewCount: 5
        }).save()
      ]);
      
      const publicCollections = await Collection.findPublicCollections();
      expect(publicCollections).toHaveLength(2);
      expect(publicCollections[0].name).toBe('Collection 1'); // Higher view count
      expect(publicCollections[1].name).toBe('Collection 3');
    });
    
    it('should find featured collections', async () => {
      // Create test collections
      await Promise.all([
        new Collection({
          userId: new mongoose.Types.ObjectId(),
          name: 'Collection 1',
          public: true,
          featured: true,
          viewCount: 5
        }).save(),
        new Collection({
          userId: new mongoose.Types.ObjectId(),
          name: 'Collection 2',
          public: true,
          featured: false
        }).save(),
        new Collection({
          userId: new mongoose.Types.ObjectId(),
          name: 'Collection 3',
          public: true,
          featured: true,
          viewCount: 10
        }).save()
      ]);
      
      const featuredCollections = await Collection.findFeaturedCollections();
      expect(featuredCollections).toHaveLength(2);
      expect(featuredCollections[0].name).toBe('Collection 3'); // Higher view count
      expect(featuredCollections[1].name).toBe('Collection 1');
    });
    
    it('should search collections', async () => {
      const userId = new mongoose.Types.ObjectId();
      
      // Create test collections
      await Promise.all([
        new Collection({
          userId,
          name: 'Machine Learning Collection',
          description: 'A collection about ML',
          public: true
        }).save(),
        new Collection({
          userId: new mongoose.Types.ObjectId(),
          name: 'Deep Learning Resources',
          tags: ['machine learning', 'neural networks'],
          public: true
        }).save(),
        new Collection({
          userId,
          name: 'Private AI Collection',
          description: 'Contains machine learning articles',
          public: false
        }).save()
      ]);
      
      // Search public collections only
      const publicResults = await Collection.searchCollections('machine learning');
      expect(publicResults).toHaveLength(2);
      
      // Search including private collections for user
      const allResults = await Collection.searchCollections('machine learning', true, userId);
      expect(allResults).toHaveLength(3);
      
      // Search with specific term
      const neuralResults = await Collection.searchCollections('neural');
      expect(neuralResults).toHaveLength(1);
      expect(neuralResults[0].name).toBe('Deep Learning Resources');
    });
  });
});