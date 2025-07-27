const Category = require('../models/Category');
const Source = require('../models/Source');
const createLogger = require('../../../common/utils/logger');
const { ApiError } = require('../../../common/utils/errorHandler');
const natural = require('natural');
const tokenizer = new natural.WordTokenizer();

// Configure logger
const logger = createLogger('category-controller');

// Get all categories for the authenticated user
exports.getAllCategories = async (req, res) => {
  try {
    const categories = await Category.findByUser(req.user.id);
    res.status(200).json(categories);
  } catch (error) {
    logger.error('Error fetching categories:', error);
    res.status(500).json({ message: 'Error fetching categories' });
  }
};

// Get a specific category by ID
exports.getCategoryById = async (req, res) => {
  try {
    const category = await Category.findOne({ 
      _id: req.params.id,
      $or: [
        { createdBy: req.user.id },
        { isSystem: true }
      ]
    });
    
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    res.status(200).json(category);
  } catch (error) {
    logger.error('Error fetching category:', error);
    res.status(500).json({ message: 'Error fetching category' });
  }
};

// Create a new category
exports.createCategory = async (req, res) => {
  try {
    // Check if category with the same name already exists for this user
    const existingCategory = await Category.findOne({ 
      name: req.body.name,
      $or: [
        { createdBy: req.user.id },
        { isSystem: true }
      ]
    });
    
    if (existingCategory) {
      return res.status(400).json({ message: 'Category with this name already exists' });
    }
    
    const category = new Category({
      ...req.body,
      createdBy: req.user.id,
      isSystem: false // User-created categories are never system categories
    });
    
    await category.save();
    res.status(201).json(category);
  } catch (error) {
    logger.error('Error creating category:', error);
    res.status(500).json({ message: 'Error creating category' });
  }
};

// Update a category
exports.updateCategory = async (req, res) => {
  try {
    const category = await Category.findOne({ 
      _id: req.params.id,
      createdBy: req.user.id,
      isSystem: false // System categories cannot be updated
    });
    
    if (!category) {
      return res.status(404).json({ message: 'Category not found or cannot be updated' });
    }
    
    // Check if new name conflicts with existing category
    if (req.body.name && req.body.name !== category.name) {
      const existingCategory = await Category.findOne({ 
        name: req.body.name,
        $or: [
          { createdBy: req.user.id },
          { isSystem: true }
        ],
        _id: { $ne: category._id }
      });
      
      if (existingCategory) {
        return res.status(400).json({ message: 'Category with this name already exists' });
      }
    }
    
    // Update category properties
    const allowedFields = ['name', 'description', 'color', 'parentCategory', 'keywords'];
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        category[field] = req.body[field];
      }
    });
    
    await category.save();
    res.status(200).json(category);
  } catch (error) {
    logger.error('Error updating category:', error);
    res.status(500).json({ message: 'Error updating category' });
  }
};

// Delete a category
exports.deleteCategory = async (req, res) => {
  try {
    const category = await Category.findOne({ 
      _id: req.params.id,
      createdBy: req.user.id,
      isSystem: false // System categories cannot be deleted
    });
    
    if (!category) {
      return res.status(404).json({ message: 'Category not found or cannot be deleted' });
    }
    
    // Check if category is used by any sources
    const sourcesUsingCategory = await Source.countDocuments({
      categories: category.name,
      createdBy: req.user.id,
      active: true
    });
    
    if (sourcesUsingCategory > 0) {
      return res.status(400).json({ 
        message: 'Category is in use by sources and cannot be deleted',
        sourceCount: sourcesUsingCategory
      });
    }
    
    await category.deleteOne();
    res.status(200).json({ message: 'Category deleted successfully' });
  } catch (error) {
    logger.error('Error deleting category:', error);
    res.status(500).json({ message: 'Error deleting category' });
  }
};

// Get sources in a category
exports.getCategorySources = async (req, res) => {
  try {
    const category = await Category.findOne({ 
      _id: req.params.id,
      $or: [
        { createdBy: req.user.id },
        { isSystem: true }
      ]
    });
    
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    const sources = await Source.find({
      categories: category.name,
      createdBy: req.user.id,
      active: true
    });
    
    res.status(200).json(sources);
  } catch (error) {
    logger.error('Error fetching category sources:', error);
    res.status(500).json({ message: 'Error fetching category sources' });
  }
};

// Add source to category
exports.addSourceToCategory = async (req, res) => {
  try {
    const { sourceId } = req.body;
    
    if (!sourceId) {
      return res.status(400).json({ message: 'Source ID is required' });
    }
    
    const category = await Category.findOne({ 
      _id: req.params.id,
      $or: [
        { createdBy: req.user.id },
        { isSystem: true }
      ]
    });
    
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    const source = await Source.findOne({
      _id: sourceId,
      createdBy: req.user.id,
      active: true
    });
    
    if (!source) {
      return res.status(404).json({ message: 'Source not found' });
    }
    
    // Check if source is already in this category
    if (source.categories.includes(category.name)) {
      return res.status(400).json({ message: 'Source is already in this category' });
    }
    
    // Add category to source
    source.categories.push(category.name);
    await source.save();
    
    // Increment category source count
    await category.incrementSourceCount();
    
    res.status(200).json({
      message: 'Source added to category successfully',
      source,
      category
    });
  } catch (error) {
    logger.error('Error adding source to category:', error);
    res.status(500).json({ message: 'Error adding source to category' });
  }
};

// Remove source from category
exports.removeSourceFromCategory = async (req, res) => {
  try {
    const { sourceId } = req.body;
    
    if (!sourceId) {
      return res.status(400).json({ message: 'Source ID is required' });
    }
    
    const category = await Category.findOne({ 
      _id: req.params.id,
      $or: [
        { createdBy: req.user.id },
        { isSystem: true }
      ]
    });
    
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    const source = await Source.findOne({
      _id: sourceId,
      createdBy: req.user.id,
      active: true
    });
    
    if (!source) {
      return res.status(404).json({ message: 'Source not found' });
    }
    
    // Check if source is in this category
    if (!source.categories.includes(category.name)) {
      return res.status(400).json({ message: 'Source is not in this category' });
    }
    
    // Remove category from source
    source.categories = source.categories.filter(cat => cat !== category.name);
    await source.save();
    
    // Decrement category source count
    await category.decrementSourceCount();
    
    res.status(200).json({
      message: 'Source removed from category successfully',
      source,
      category
    });
  } catch (error) {
    logger.error('Error removing source from category:', error);
    res.status(500).json({ message: 'Error removing source from category' });
  }
};

// Get subcategories
exports.getSubcategories = async (req, res) => {
  try {
    const subcategories = await Category.findByParent(req.params.id);
    res.status(200).json(subcategories);
  } catch (error) {
    logger.error('Error fetching subcategories:', error);
    res.status(500).json({ message: 'Error fetching subcategories' });
  }
};

// Suggest categories for a source
exports.suggestCategories = async (req, res) => {
  try {
    const { sourceId, url, title, description, content } = req.body;
    
    if (!sourceId && !url && !title && !description && !content) {
      return res.status(400).json({ message: 'At least one source parameter is required' });
    }
    
    let source;
    let sourceText = '';
    
    // If sourceId is provided, fetch the source
    if (sourceId) {
      source = await Source.findOne({
        _id: sourceId,
        createdBy: req.user.id,
        active: true
      });
      
      if (!source) {
        return res.status(404).json({ message: 'Source not found' });
      }
      
      sourceText = [
        source.name,
        source.description,
        source.type,
        ...source.tags
      ].filter(Boolean).join(' ');
    } else {
      // Use provided parameters
      sourceText = [title, description, content].filter(Boolean).join(' ');
      
      // If URL is provided, try to extract metadata
      if (url) {
        try {
          const UrlValidator = require('../utils/urlValidator');
          const metadata = await UrlValidator.getMetadata(url);
          
          if (!metadata.error) {
            const metadataText = [
              metadata.title,
              metadata.description,
              ...(metadata.keywords || [])
            ].filter(Boolean).join(' ');
            
            sourceText += ' ' + metadataText;
          }
        } catch (error) {
          logger.debug(`Error extracting metadata from URL: ${error.message}`);
        }
      }
    }
    
    // Get all categories for this user
    const categories = await Category.findByUser(req.user.id);
    
    // Calculate relevance scores for each category
    const suggestions = [];
    
    for (const category of categories) {
      const score = calculateCategoryRelevance(sourceText, category);
      
      if (score > 0) {
        suggestions.push({
          category,
          score
        });
      }
    }
    
    // Sort by score descending and return top 5
    const topSuggestions = suggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(suggestion => ({
        _id: suggestion.category._id,
        name: suggestion.category.name,
        description: suggestion.category.description,
        color: suggestion.category.color,
        score: suggestion.score
      }));
    
    res.status(200).json(topSuggestions);
  } catch (error) {
    logger.error('Error suggesting categories:', error);
    res.status(500).json({ message: 'Error suggesting categories' });
  }
};

// Create default system categories
exports.createDefaultCategories = async (req, res) => {
  try {
    // Only admins can create system categories
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    const defaultCategories = [
      {
        name: 'AI Research',
        description: 'Academic and research papers on artificial intelligence',
        color: '#3498db',
        keywords: ['research', 'paper', 'study', 'academic', 'ai', 'artificial intelligence', 'machine learning', 'deep learning']
      },
      {
        name: 'LLM Development',
        description: 'Large language model development and techniques',
        color: '#2ecc71',
        keywords: ['llm', 'language model', 'gpt', 'transformer', 'nlp', 'natural language processing']
      },
      {
        name: 'UX Design',
        description: 'User experience design for AI applications',
        color: '#e74c3c',
        keywords: ['ux', 'user experience', 'design', 'interface', 'ui', 'usability', 'interaction']
      },
      {
        name: 'AI Ethics',
        description: 'Ethical considerations in AI development and deployment',
        color: '#9b59b6',
        keywords: ['ethics', 'bias', 'fairness', 'transparency', 'accountability', 'responsible ai']
      },
      {
        name: 'AI Tools',
        description: 'Software tools and applications for AI development',
        color: '#f39c12',
        keywords: ['tool', 'software', 'application', 'framework', 'library', 'platform']
      },
      {
        name: 'Industry News',
        description: 'News and updates from the AI industry',
        color: '#1abc9c',
        keywords: ['news', 'announcement', 'release', 'update', 'industry', 'company', 'startup']
      },
      {
        name: 'Tutorials',
        description: 'Tutorials and guides for AI development',
        color: '#d35400',
        keywords: ['tutorial', 'guide', 'how-to', 'walkthrough', 'example', 'demo', 'lesson']
      },
      {
        name: 'Podcasts',
        description: 'AI-related podcasts and audio content',
        color: '#8e44ad',
        keywords: ['podcast', 'audio', 'interview', 'conversation', 'discussion', 'talk']
      }
    ];
    
    const results = {
      created: [],
      existing: []
    };
    
    for (const categoryData of defaultCategories) {
      // Check if category already exists
      const existingCategory = await Category.findOne({ 
        name: categoryData.name,
        isSystem: true
      });
      
      if (existingCategory) {
        results.existing.push(existingCategory.name);
        continue;
      }
      
      // Create new category
      const category = new Category({
        ...categoryData,
        createdBy: req.user.id,
        isSystem: true
      });
      
      await category.save();
      results.created.push(category.name);
    }
    
    res.status(200).json({
      message: 'Default categories processed',
      results
    });
  } catch (error) {
    logger.error('Error creating default categories:', error);
    res.status(500).json({ message: 'Error creating default categories' });
  }
};

/**
 * Calculate relevance score between source text and category
 * @param {string} sourceText - Text from source
 * @param {Object} category - Category document
 * @returns {number} - Relevance score (0-1)
 */
function calculateCategoryRelevance(sourceText, category) {
  if (!sourceText) return 0;
  
  // Tokenize source text
  const sourceTokens = tokenizer.tokenize(sourceText.toLowerCase());
  
  if (!sourceTokens.length) return 0;
  
  // Get category keywords
  const categoryKeywords = [
    category.name.toLowerCase(),
    ...(category.description ? tokenizer.tokenize(category.description.toLowerCase()) : []),
    ...(category.keywords || []).map(k => k.toLowerCase())
  ];
  
  // Count matches
  let matches = 0;
  
  for (const token of sourceTokens) {
    if (categoryKeywords.includes(token)) {
      matches++;
    }
  }
  
  // Calculate score based on matches and token counts
  const score = matches / Math.sqrt(sourceTokens.length * categoryKeywords.length);
  
  return Math.min(score, 1);
}