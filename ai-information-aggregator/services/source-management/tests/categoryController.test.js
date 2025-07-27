const categoryController = require('../controllers/categoryController');
const Category = require('../models/Category');
const Source = require('../models/Source');

// Mock dependencies
jest.mock('../models/Category');
jest.mock('../models/Source');
jest.mock('natural', () => ({
  WordTokenizer: jest.fn().mockImplementation(() => ({
    tokenize: jest.fn(text => text ? text.split(/\s+/) : [])
  }))
}));

describe('Category Controller', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      user: { id: 'user123' }
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('getAllCategories', () => {
    it('should return all categories for the user', async () => {
      const mockCategories = [
        { _id: 'cat1', name: 'Category 1' },
        { _id: 'cat2', name: 'Category 2' }
      ];
      Category.findByUser.mockResolvedValue(mockCategories);

      await categoryController.getAllCategories(req, res);
      expect(Category.findByUser).toHaveBeenCalledWith('user123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockCategories);
    });

    it('should handle errors gracefully', async () => {
      Category.findByUser.mockRejectedValue(new Error('Database error'));

      await categoryController.getAllCategories(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Error fetching categories' });
    });
  });

  describe('getCategoryById', () => {
    it('should return a category by ID', async () => {
      const mockCategory = { _id: 'cat1', name: 'Category 1' };
      req.params.id = 'cat1';
      Category.findOne.mockResolvedValue(mockCategory);

      await categoryController.getCategoryById(req, res);
      expect(Category.findOne).toHaveBeenCalledWith({
        _id: 'cat1',
        $or: [
          { createdBy: 'user123' },
          { isSystem: true }
        ]
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockCategory);
    });

    it('should return 404 if category not found', async () => {
      req.params.id = 'nonexistent';
      Category.findOne.mockResolvedValue(null);

      await categoryController.getCategoryById(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Category not found' });
    });

    it('should handle errors gracefully', async () => {
      req.params.id = 'cat1';
      Category.findOne.mockRejectedValue(new Error('Database error'));

      await categoryController.getCategoryById(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Error fetching category' });
    });
  });

  describe('createCategory', () => {
    it('should create a new category', async () => {
      req.body = {
        name: 'New Category',
        description: 'A new category',
        color: '#3498db'
      };
      Category.findOne.mockResolvedValue(null);
      
      const mockSave = jest.fn().mockResolvedValue(true);
      Category.mockImplementation(() => ({
        ...req.body,
        _id: 'newcat',
        createdBy: 'user123',
        isSystem: false,
        save: mockSave
      }));

      await categoryController.createCategory(req, res);
      expect(Category.findOne).toHaveBeenCalled();
      expect(Category).toHaveBeenCalledWith({
        ...req.body,
        createdBy: 'user123',
        isSystem: false
      });
      expect(mockSave).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should return 400 if category with name already exists', async () => {
      req.body = { name: 'Existing Category' };
      Category.findOne.mockResolvedValue({ _id: 'existingcat' });

      await categoryController.createCategory(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Category with this name already exists' });
    });

    it('should handle errors gracefully', async () => {
      req.body = { name: 'New Category' };
      Category.findOne.mockRejectedValue(new Error('Database error'));

      await categoryController.createCategory(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Error creating category' });
    });
  });

  describe('updateCategory', () => {
    it('should update an existing category', async () => {
      req.params.id = 'cat1';
      req.body = {
        name: 'Updated Category',
        description: 'Updated description'
      };
      
      const mockCategory = {
        _id: 'cat1',
        name: 'Old Category',
        description: 'Old description',
        createdBy: 'user123',
        isSystem: false,
        save: jest.fn().mockResolvedValue(true)
      };
      
      Category.findOne.mockResolvedValue(mockCategory);

      await categoryController.updateCategory(req, res);
      expect(Category.findOne).toHaveBeenCalledWith({
        _id: 'cat1',
        createdBy: 'user123',
        isSystem: false
      });
      expect(mockCategory.name).toBe('Updated Category');
      expect(mockCategory.description).toBe('Updated description');
      expect(mockCategory.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return 404 if category not found or is system category', async () => {
      req.params.id = 'cat1';
      req.body = { name: 'Updated Category' };
      Category.findOne.mockResolvedValue(null);

      await categoryController.updateCategory(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Category not found or cannot be updated' });
    });

    it('should return 400 if new name conflicts with existing category', async () => {
      req.params.id = 'cat1';
      req.body = { name: 'Conflicting Name' };
      
      const mockCategory = {
        _id: 'cat1',
        name: 'Old Category',
        createdBy: 'user123',
        isSystem: false
      };
      
      Category.findOne.mockImplementation(async (query) => {
        if (query._id) {
          return mockCategory;
        }
        if (query.name === 'Conflicting Name') {
          return { _id: 'cat2' };
        }
        return null;
      });

      await categoryController.updateCategory(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Category with this name already exists' });
    });

    it('should handle errors gracefully', async () => {
      req.params.id = 'cat1';
      req.body = { name: 'Updated Category' };
      Category.findOne.mockRejectedValue(new Error('Database error'));

      await categoryController.updateCategory(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Error updating category' });
    });
  });

  describe('deleteCategory', () => {
    it('should delete a category', async () => {
      req.params.id = 'cat1';
      
      const mockCategory = {
        _id: 'cat1',
        name: 'Category to Delete',
        createdBy: 'user123',
        isSystem: false,
        deleteOne: jest.fn().mockResolvedValue(true)
      };
      
      Category.findOne.mockResolvedValue(mockCategory);
      Source.countDocuments.mockResolvedValue(0);

      await categoryController.deleteCategory(req, res);
      expect(Category.findOne).toHaveBeenCalledWith({
        _id: 'cat1',
        createdBy: 'user123',
        isSystem: false
      });
      expect(Source.countDocuments).toHaveBeenCalled();
      expect(mockCategory.deleteOne).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'Category deleted successfully' });
    });

    it('should return 404 if category not found or is system category', async () => {
      req.params.id = 'cat1';
      Category.findOne.mockResolvedValue(null);

      await categoryController.deleteCategory(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Category not found or cannot be deleted' });
    });

    it('should return 400 if category is in use by sources', async () => {
      req.params.id = 'cat1';
      
      const mockCategory = {
        _id: 'cat1',
        name: 'Category in Use',
        createdBy: 'user123',
        isSystem: false
      };
      
      Category.findOne.mockResolvedValue(mockCategory);
      Source.countDocuments.mockResolvedValue(2);

      await categoryController.deleteCategory(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Category is in use by sources and cannot be deleted',
        sourceCount: 2
      });
    });

    it('should handle errors gracefully', async () => {
      req.params.id = 'cat1';
      Category.findOne.mockRejectedValue(new Error('Database error'));

      await categoryController.deleteCategory(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Error deleting category' });
    });
  });

  describe('suggestCategories', () => {
    it('should suggest categories based on source ID', async () => {
      req.body = { sourceId: 'source123' };
      
      const mockSource = {
        _id: 'source123',
        name: 'Test Source',
        description: 'A test source about AI',
        type: 'website',
        tags: ['ai', 'machine learning']
      };
      
      const mockCategories = [
        {
          _id: 'cat1',
          name: 'AI',
          description: 'Artificial Intelligence',
          color: '#3498db',
          keywords: ['ai', 'artificial intelligence', 'machine learning']
        },
        {
          _id: 'cat2',
          name: 'Web Development',
          description: 'Web development resources',
          color: '#2ecc71',
          keywords: ['web', 'development', 'javascript']
        }
      ];
      
      Source.findOne.mockResolvedValue(mockSource);
      Category.findByUser.mockResolvedValue(mockCategories);

      await categoryController.suggestCategories(req, res);
      expect(Source.findOne).toHaveBeenCalled();
      expect(Category.findByUser).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({ name: 'AI' })
      ]));
    });

    it('should suggest categories based on URL and content', async () => {
      req.body = {
        url: 'https://example.com',
        title: 'AI Research Paper',
        description: 'A paper about machine learning'
      };
      
      const mockCategories = [
        {
          _id: 'cat1',
          name: 'AI Research',
          description: 'AI research papers',
          color: '#3498db',
          keywords: ['ai', 'research', 'paper', 'machine learning']
        },
        {
          _id: 'cat2',
          name: 'Web Development',
          description: 'Web development resources',
          color: '#2ecc71',
          keywords: ['web', 'development', 'javascript']
        }
      ];
      
      Category.findByUser.mockResolvedValue(mockCategories);

      await categoryController.suggestCategories(req, res);
      expect(Category.findByUser).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({ name: 'AI Research' })
      ]));
    });

    it('should return 400 if no source parameters provided', async () => {
      req.body = {};

      await categoryController.suggestCategories(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'At least one source parameter is required' });
    });

    it('should return 404 if source not found', async () => {
      req.body = { sourceId: 'nonexistent' };
      Source.findOne.mockResolvedValue(null);

      await categoryController.suggestCategories(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Source not found' });
    });

    it('should handle errors gracefully', async () => {
      req.body = { sourceId: 'source123' };
      Source.findOne.mockRejectedValue(new Error('Database error'));

      await categoryController.suggestCategories(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Error suggesting categories' });
    });
  });

  describe('createDefaultCategories', () => {
    it('should create default system categories for admin users', async () => {
      req.user.isAdmin = true;
      
      // Mock Category.findOne to return null (categories don't exist)
      Category.findOne.mockResolvedValue(null);
      
      // Mock Category constructor and save method
      const mockSave = jest.fn().mockResolvedValue(true);
      Category.mockImplementation((data) => ({
        ...data,
        save: mockSave
      }));

      await categoryController.createDefaultCategories(req, res);
      expect(Category.findOne).toHaveBeenCalled();
      expect(Category).toHaveBeenCalled();
      expect(mockSave).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Default categories processed'
      }));
    });

    it('should return 403 for non-admin users', async () => {
      req.user.isAdmin = false;

      await categoryController.createDefaultCategories(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Unauthorized' });
    });

    it('should handle errors gracefully', async () => {
      req.user.isAdmin = true;
      Category.findOne.mockRejectedValue(new Error('Database error'));

      await categoryController.createDefaultCategories(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Error creating default categories' });
    });
  });
});