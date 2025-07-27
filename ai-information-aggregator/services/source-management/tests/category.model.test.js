const mongoose = require('mongoose');
const Category = require('../models/Category');

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

// Clear categories collection before each test
beforeEach(async () => {
  await Category.deleteMany({});
});

describe('Category Model', () => {
  describe('Schema', () => {
    it('should create a new category successfully', async () => {
      const categoryData = {
        name: 'Test Category',
        description: 'A test category',
        color: '#3498db',
        keywords: ['test', 'example'],
        createdBy: new mongoose.Types.ObjectId()
      };
      
      const category = new Category(categoryData);
      const savedCategory = await category.save();
      
      expect(savedCategory._id).toBeDefined();
      expect(savedCategory.name).toBe(categoryData.name);
      expect(savedCategory.description).toBe(categoryData.description);
      expect(savedCategory.color).toBe(categoryData.color);
      expect(savedCategory.keywords).toEqual(expect.arrayContaining(categoryData.keywords));
      expect(savedCategory.sourceCount).toBe(0); // Default value
      expect(savedCategory.isSystem).toBe(false); // Default value
    });
    
    it('should fail validation when name is missing', async () => {
      const categoryData = {
        description: 'A test category',
        createdBy: new mongoose.Types.ObjectId()
      };
      
      const category = new Category(categoryData);
      
      await expect(category.save()).rejects.toThrow();
    });
    
    it('should fail validation when color format is invalid', async () => {
      const categoryData = {
        name: 'Test Category',
        description: 'A test category',
        color: 'invalid-color',
        createdBy: new mongoose.Types.ObjectId()
      };
      
      const category = new Category(categoryData);
      
      await expect(category.save()).rejects.toThrow();
    });
    
    it('should create a category with a parent category', async () => {
      const parentData = {
        name: 'Parent Category',
        createdBy: new mongoose.Types.ObjectId()
      };
      
      const parent = new Category(parentData);
      await parent.save();
      
      const childData = {
        name: 'Child Category',
        parentCategory: parent._id,
        createdBy: new mongoose.Types.ObjectId()
      };
      
      const child = new Category(childData);
      const savedChild = await child.save();
      
      expect(savedChild.parentCategory).toEqual(parent._id);
    });
  });
  
  describe('Category Methods', () => {
    it('should increment source count', async () => {
      const categoryData = {
        name: 'Test Category',
        createdBy: new mongoose.Types.ObjectId()
      };
      
      const category = new Category(categoryData);
      await category.save();
      
      expect(category.sourceCount).toBe(0);
      
      await category.incrementSourceCount();
      
      expect(category.sourceCount).toBe(1);
    });
    
    it('should decrement source count', async () => {
      const categoryData = {
        name: 'Test Category',
        sourceCount: 2,
        createdBy: new mongoose.Types.ObjectId()
      };
      
      const category = new Category(categoryData);
      await category.save();
      
      expect(category.sourceCount).toBe(2);
      
      await category.decrementSourceCount();
      
      expect(category.sourceCount).toBe(1);
    });
    
    it('should not decrement source count below zero', async () => {
      const categoryData = {
        name: 'Test Category',
        sourceCount: 0,
        createdBy: new mongoose.Types.ObjectId()
      };
      
      const category = new Category(categoryData);
      await category.save();
      
      await category.decrementSourceCount();
      
      expect(category.sourceCount).toBe(0);
    });
  });
  
  describe('Static Methods', () => {
    it('should find categories by user', async () => {
      const userId1 = new mongoose.Types.ObjectId();
      const userId2 = new mongoose.Types.ObjectId();
      
      // Create test categories
      await Promise.all([
        new Category({
          name: 'Category 1',
          createdBy: userId1
        }).save(),
        new Category({
          name: 'Category 2',
          createdBy: userId2
        }).save(),
        new Category({
          name: 'System Category',
          createdBy: userId2,
          isSystem: true
        }).save()
      ]);
      
      const user1Categories = await Category.findByUser(userId1);
      expect(user1Categories).toHaveLength(2); // User's own + system category
      
      const user2Categories = await Category.findByUser(userId2);
      expect(user2Categories).toHaveLength(2); // User's own + system category
    });
    
    it('should find system categories', async () => {
      const userId = new mongoose.Types.ObjectId();
      
      // Create test categories
      await Promise.all([
        new Category({
          name: 'User Category 1',
          createdBy: userId
        }).save(),
        new Category({
          name: 'User Category 2',
          createdBy: userId
        }).save(),
        new Category({
          name: 'System Category 1',
          createdBy: userId,
          isSystem: true
        }).save(),
        new Category({
          name: 'System Category 2',
          createdBy: userId,
          isSystem: true
        }).save()
      ]);
      
      const systemCategories = await Category.findSystemCategories();
      expect(systemCategories).toHaveLength(2);
      expect(systemCategories[0].isSystem).toBe(true);
      expect(systemCategories[1].isSystem).toBe(true);
    });
    
    it('should find categories by parent', async () => {
      const userId = new mongoose.Types.ObjectId();
      
      // Create parent category
      const parent = await new Category({
        name: 'Parent Category',
        createdBy: userId
      }).save();
      
      // Create test categories
      await Promise.all([
        new Category({
          name: 'Child Category 1',
          parentCategory: parent._id,
          createdBy: userId
        }).save(),
        new Category({
          name: 'Child Category 2',
          parentCategory: parent._id,
          createdBy: userId
        }).save(),
        new Category({
          name: 'Unrelated Category',
          createdBy: userId
        }).save()
      ]);
      
      const childCategories = await Category.findByParent(parent._id);
      expect(childCategories).toHaveLength(2);
      expect(childCategories[0].parentCategory).toEqual(parent._id);
      expect(childCategories[1].parentCategory).toEqual(parent._id);
    });
  });
});