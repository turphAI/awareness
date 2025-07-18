const Source = require('../models/Source');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

// Get all sources for the authenticated user
exports.getAllSources = async (req, res) => {
  try {
    const sources = await Source.findActiveByUser(req.user.id);
    res.status(200).json(sources);
  } catch (error) {
    logger.error('Error fetching sources:', error);
    res.status(500).json({ message: 'Error fetching sources' });
  }
};

// Get a specific source by ID
exports.getSourceById = async (req, res) => {
  try {
    const source = await Source.findOne({ 
      _id: req.params.id, 
      createdBy: req.user.id,
      active: true 
    });
    
    if (!source) {
      return res.status(404).json({ message: 'Source not found' });
    }
    
    res.status(200).json(source);
  } catch (error) {
    logger.error('Error fetching source:', error);
    res.status(500).json({ message: 'Error fetching source' });
  }
};

// Create a new source
exports.createSource = async (req, res) => {
  try {
    // Check if source with the same URL already exists
    const existingSource = await Source.findOne({ 
      url: req.body.url,
      createdBy: req.user.id,
      active: true
    });
    
    if (existingSource) {
      return res.status(400).json({ message: 'Source with this URL already exists' });
    }
    
    const source = new Source({
      ...req.body,
      createdBy: req.user.id
    });
    
    await source.save();
    res.status(201).json(source);
  } catch (error) {
    logger.error('Error creating source:', error);
    res.status(500).json({ message: 'Error creating source' });
  }
};

// Update a source
exports.updateSource = async (req, res) => {
  try {
    const source = await Source.findOne({ 
      _id: req.params.id, 
      createdBy: req.user.id,
      active: true 
    });
    
    if (!source) {
      return res.status(404).json({ message: 'Source not found' });
    }
    
    // Update source properties
    Object.keys(req.body).forEach(key => {
      source[key] = req.body[key];
    });
    
    await source.save();
    res.status(200).json(source);
  } catch (error) {
    logger.error('Error updating source:', error);
    res.status(500).json({ message: 'Error updating source' });
  }
};

// Delete a source (set active to false)
exports.deleteSource = async (req, res) => {
  try {
    const source = await Source.findOne({ 
      _id: req.params.id, 
      createdBy: req.user.id,
      active: true 
    });
    
    if (!source) {
      return res.status(404).json({ message: 'Source not found' });
    }
    
    source.active = false;
    await source.save();
    
    res.status(200).json({ message: 'Source deleted successfully' });
  } catch (error) {
    logger.error('Error deleting source:', error);
    res.status(500).json({ message: 'Error deleting source' });
  }
};

// Update source relevance score
exports.updateRelevance = async (req, res) => {
  try {
    const { score } = req.body;
    
    if (score === undefined || score < 0 || score > 1) {
      return res.status(400).json({ message: 'Invalid relevance score' });
    }
    
    const source = await Source.findOne({ 
      _id: req.params.id, 
      createdBy: req.user.id,
      active: true 
    });
    
    if (!source) {
      return res.status(404).json({ message: 'Source not found' });
    }
    
    await source.updateRelevance(score);
    res.status(200).json(source);
  } catch (error) {
    logger.error('Error updating source relevance:', error);
    res.status(500).json({ message: 'Error updating source relevance' });
  }
};

// Get sources by type
exports.getSourcesByType = async (req, res) => {
  try {
    const sources = await Source.find({ 
      type: req.params.type,
      createdBy: req.user.id,
      active: true 
    });
    
    res.status(200).json(sources);
  } catch (error) {
    logger.error('Error fetching sources by type:', error);
    res.status(500).json({ message: 'Error fetching sources by type' });
  }
};

// Get sources by category
exports.getSourcesByCategory = async (req, res) => {
  try {
    const sources = await Source.find({ 
      categories: req.params.category,
      createdBy: req.user.id,
      active: true 
    });
    
    res.status(200).json(sources);
  } catch (error) {
    logger.error('Error fetching sources by category:', error);
    res.status(500).json({ message: 'Error fetching sources by category' });
  }
};