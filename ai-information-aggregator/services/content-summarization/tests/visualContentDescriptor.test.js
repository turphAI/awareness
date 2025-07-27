const VisualContentDescriptor = require('../utils/visualContentDescriptor');
const axios = require('axios');

// Mock axios
jest.mock('axios');
const mockedAxios = axios;

// Mock OpenAI
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn()
      }
    }
  }));
});

describe('VisualContentDescriptor', () => {
  let descriptor;
  let mockOpenAI;

  beforeEach(() => {
    // Reset environment
    delete process.env.OPENAI_API_KEY;
    
    descriptor = new VisualContentDescriptor();
    
    // Mock OpenAI instance
    mockOpenAI = {
      chat: {
        completions: {
          create: jest.fn()
        }
      }
    };
    
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with default settings', () => {
      expect(descriptor.relevanceThreshold).toBe(0.6);
      expect(descriptor.maxImageSize).toBe(20 * 1024 * 1024);
      expect(descriptor.supportedFormats).toContain('image/jpeg');
      expect(descriptor.supportedFormats).toContain('image/png');
    });

    it('should initialize OpenAI when API key is available', () => {
      process.env.OPENAI_API_KEY = 'test-key';
      const descriptorWithAI = new VisualContentDescriptor();
      expect(descriptorWithAI.openai).toBeDefined();
    });

    it('should not initialize OpenAI when API key is missing', () => {
      expect(descriptor.openai).toBeNull();
    });
  });

  describe('analyzeVisualContent', () => {
    const mockImageData = {
      base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
      mimeType: 'image/png'
    };

    it('should analyze visual content with base64 input', async () => {
      const result = await descriptor.analyzeVisualContent(mockImageData);
      
      expect(result).toHaveProperty('description');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('metadata');
      expect(result.metadata.mimeType).toBe('image/png');
    });

    it('should analyze visual content with URL input', async () => {
      const mockResponse = {
        data: Buffer.from('fake-image-data'),
        headers: { 'content-type': 'image/jpeg' }
      };
      
      mockedAxios.get.mockResolvedValue(mockResponse);
      
      const result = await descriptor.analyzeVisualContent('https://example.com/image.jpg');
      
      expect(result).toHaveProperty('description');
      expect(result).toHaveProperty('confidence');
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://example.com/image.jpg',
        expect.objectContaining({
          responseType: 'arraybuffer',
          timeout: 30000
        })
      );
    });

    it('should include relevance assessment by default', async () => {
      const result = await descriptor.analyzeVisualContent(mockImageData);
      
      expect(result.relevanceAssessment).toBeDefined();
      expect(result.relevanceAssessment).toHaveProperty('overallRelevance');
      expect(result.relevanceAssessment).toHaveProperty('isRelevant');
      expect(result.relevanceAssessment.method).toBe('keyword');
    });

    it('should skip relevance assessment when disabled', async () => {
      const result = await descriptor.analyzeVisualContent(mockImageData, {
        includeRelevanceAssessment: false
      });
      
      expect(result.relevanceAssessment).toBeNull();
    });

    it('should handle AI-powered description when OpenAI is available', async () => {
      process.env.OPENAI_API_KEY = 'test-key';
      descriptor = new VisualContentDescriptor();
      descriptor.openai = mockOpenAI;
      
      mockOpenAI.chat.completions.create
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify({
                description: 'A test image showing AI concepts',
                confidence: 0.9,
                keyElements: ['neural network', 'diagram'],
                textContent: 'AI Model',
                technicalElements: ['architecture diagram']
              })
            }
          }]
        })
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify({
                overallRelevance: 0.8,
                focusAreaRelevance: { ai: 0.9, technology: 0.7 },
                relevantElements: ['neural network', 'AI'],
                reasoning: 'Image contains AI-related technical diagrams'
              })
            }
          }]
        });
      
      const result = await descriptor.analyzeVisualContent(mockImageData);
      
      expect(result.description).toBe('A test image showing AI concepts');
      expect(result.confidence).toBe(0.9);
      expect(result.relevanceAssessment.overallRelevance).toBe(0.8);
      expect(result.relevanceAssessment.method).toBe('ai');
    });

    it('should handle errors gracefully', async () => {
      const result = await descriptor.analyzeVisualContent(null);
      
      expect(result.error).toBeDefined();
      expect(result.description).toBeNull();
      expect(result.confidence).toBe(0);
    });

    it('should validate image format', async () => {
      const invalidImageData = {
        base64: 'invalid-data',
        mimeType: 'text/plain'
      };
      
      const result = await descriptor.analyzeVisualContent(invalidImageData);
      
      expect(result.error).toContain('Unsupported image format');
    });

    it('should validate image size', async () => {
      const largeImageData = {
        base64: 'a'.repeat(30 * 1024 * 1024), // 30MB of data
        mimeType: 'image/jpeg'
      };
      
      const result = await descriptor.analyzeVisualContent(largeImageData);
      
      expect(result.error).toContain('Image too large');
    });

    it('should handle different detail levels', async () => {
      const briefResult = await descriptor.analyzeVisualContent(mockImageData, {
        detailLevel: 'brief'
      });
      
      const detailedResult = await descriptor.analyzeVisualContent(mockImageData, {
        detailLevel: 'detailed'
      });
      
      expect(briefResult.metadata.detailLevel).toBe('brief');
      expect(detailedResult.metadata.detailLevel).toBe('detailed');
    });

    it('should use custom focus areas', async () => {
      const customFocusAreas = ['robotics', 'automation'];
      
      const result = await descriptor.analyzeVisualContent(mockImageData, {
        focusAreas: customFocusAreas
      });
      
      expect(result.metadata.focusAreas).toEqual(customFocusAreas);
    });
  });

  describe('batchAnalyzeVisualContent', () => {
    const mockImageData1 = {
      base64: 'data1',
      mimeType: 'image/png'
    };
    
    const mockImageData2 = {
      base64: 'data2',
      mimeType: 'image/jpeg'
    };

    it('should analyze multiple images', async () => {
      const results = await descriptor.batchAnalyzeVisualContent([
        mockImageData1,
        mockImageData2
      ]);
      
      expect(results).toHaveLength(2);
      expect(results[0].index).toBe(0);
      expect(results[1].index).toBe(1);
      expect(results[0]).toHaveProperty('description');
      expect(results[1]).toHaveProperty('description');
    });

    it('should handle mixed success and failure', async () => {
      const results = await descriptor.batchAnalyzeVisualContent([
        mockImageData1,
        null, // This will cause an error
        mockImageData2
      ]);
      
      expect(results).toHaveLength(3);
      expect(results[0].error).toBeUndefined();
      expect(results[1].error).toBeDefined();
      expect(results[2].error).toBeUndefined();
    });

    it('should reject batches that are too large', async () => {
      const largeArray = new Array(15).fill(mockImageData1);
      
      await expect(descriptor.batchAnalyzeVisualContent(largeArray))
        .rejects.toThrow('Maximum 10 images allowed per batch');
    });

    it('should reject non-array input', async () => {
      await expect(descriptor.batchAnalyzeVisualContent('not-an-array'))
        .rejects.toThrow('Image inputs must be an array');
    });
  });

  describe('_assessRelevance', () => {
    it('should perform keyword-based relevance assessment', async () => {
      const description = 'This image shows a neural network architecture diagram with AI components';
      const focusAreas = ['ai', 'machine learning'];
      
      const result = await descriptor._assessRelevance(description, focusAreas);
      
      expect(result.overallRelevance).toBeGreaterThan(0);
      expect(result.focusAreaRelevance.ai).toBeGreaterThan(0);
      expect(result.relevantElements).toContain('ai');
      expect(result.relevantElements).toContain('neural network');
      expect(result.method).toBe('keyword');
    });

    it('should detect low relevance content', async () => {
      const description = 'This image shows a cat sitting on a chair';
      const focusAreas = ['ai', 'machine learning'];
      
      const result = await descriptor._assessRelevance(description, focusAreas);
      
      expect(result.overallRelevance).toBeLessThanOrEqual(0.1);
      expect(result.isRelevant).toBe(false);
    });

    it('should use AI assessment when available', async () => {
      descriptor.openai = mockOpenAI;
      
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              overallRelevance: 0.85,
              focusAreaRelevance: { ai: 0.9, technology: 0.8 },
              relevantElements: ['neural network', 'AI model'],
              reasoning: 'Image contains technical AI diagrams'
            })
          }
        }]
      });
      
      const result = await descriptor._assessRelevance(
        'AI neural network diagram',
        ['ai', 'technology']
      );
      
      expect(result.overallRelevance).toBe(0.85);
      expect(result.method).toBe('ai');
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalled();
    });

    it('should fallback to keyword assessment on AI error', async () => {
      descriptor.openai = mockOpenAI;
      
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API Error'));
      
      const result = await descriptor._assessRelevance(
        'artificial intelligence neural network',
        ['ai']
      );
      
      expect(result.method).toBe('keyword');
      expect(result.overallRelevance).toBeGreaterThan(0);
    });
  });

  describe('_generateDescription', () => {
    const mockImageData = {
      base64: 'test-data',
      mimeType: 'image/png'
    };

    it('should generate fallback description when AI unavailable', async () => {
      const result = await descriptor._generateDescription(mockImageData, 'medium', '');
      
      expect(result.text).toContain('Visual content description not available');
      expect(result.confidence).toBe(0);
      expect(result.method).toBe('fallback');
    });

    it('should generate AI description when available', async () => {
      descriptor.openai = mockOpenAI;
      
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              description: 'A detailed AI architecture diagram',
              confidence: 0.9,
              keyElements: ['neural layers', 'connections'],
              textContent: 'Deep Learning Model',
              technicalElements: ['architecture']
            })
          }
        }]
      });
      
      const result = await descriptor._generateDescription(mockImageData, 'detailed', 'AI research');
      
      expect(result.text).toBe('A detailed AI architecture diagram');
      expect(result.confidence).toBe(0.9);
      expect(result.method).toBe('ai');
      expect(result.keyElements).toContain('neural layers');
    });

    it('should handle AI errors gracefully', async () => {
      descriptor.openai = mockOpenAI;
      
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API Error'));
      
      const result = await descriptor._generateDescription(mockImageData, 'medium', '');
      
      expect(result.text).toContain('AI description unavailable');
      expect(result.method).toBe('fallback');
    });
  });

  describe('_fetchImageFromUrl', () => {
    it('should fetch image from URL successfully', async () => {
      const mockResponse = {
        data: Buffer.from('image-data'),
        headers: { 'content-type': 'image/jpeg' }
      };
      
      mockedAxios.get.mockResolvedValue(mockResponse);
      
      const result = await descriptor._fetchImageFromUrl('https://example.com/image.jpg');
      
      expect(result.base64).toBeDefined();
      expect(result.mimeType).toBe('image/jpeg');
      expect(result.url).toBe('https://example.com/image.jpg');
    });

    it('should handle fetch errors', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Network error'));
      
      await expect(descriptor._fetchImageFromUrl('https://example.com/image.jpg'))
        .rejects.toThrow('Failed to fetch image from URL');
    });

    it('should use default mime type when not provided', async () => {
      const mockResponse = {
        data: Buffer.from('image-data'),
        headers: {}
      };
      
      mockedAxios.get.mockResolvedValue(mockResponse);
      
      const result = await descriptor._fetchImageFromUrl('https://example.com/image.jpg');
      
      expect(result.mimeType).toBe('image/jpeg');
    });
  });

  describe('_validateImage', () => {
    it('should validate correct image data', () => {
      const validImageData = {
        base64: 'valid-data',
        mimeType: 'image/png',
        size: 1024
      };
      
      expect(() => descriptor._validateImage(validImageData)).not.toThrow();
    });

    it('should reject missing base64 data', () => {
      const invalidImageData = {
        mimeType: 'image/png'
      };
      
      expect(() => descriptor._validateImage(invalidImageData))
        .toThrow('Invalid image data: base64 content required');
    });

    it('should reject unsupported formats', () => {
      const invalidImageData = {
        base64: 'data',
        mimeType: 'image/bmp'
      };
      
      expect(() => descriptor._validateImage(invalidImageData))
        .toThrow('Unsupported image format');
    });

    it('should reject oversized images', () => {
      const oversizedImageData = {
        base64: 'data',
        mimeType: 'image/png',
        size: 25 * 1024 * 1024 // 25MB
      };
      
      expect(() => descriptor._validateImage(oversizedImageData))
        .toThrow('Image too large');
    });

    it('should calculate size from base64 when size not provided', () => {
      const imageData = {
        base64: 'a'.repeat(1000),
        mimeType: 'image/png'
      };
      
      expect(() => descriptor._validateImage(imageData)).not.toThrow();
    });
  });

  describe('_keywordBasedRelevance', () => {
    it('should identify AI-related content', () => {
      const description = 'This neural network uses artificial intelligence and machine learning algorithms';
      const focusAreas = ['ai', 'machine learning'];
      
      const result = descriptor._keywordBasedRelevance(description, focusAreas);
      
      expect(result.overallRelevance).toBeGreaterThanOrEqual(0.5);
      expect(result.focusAreaRelevance.ai).toBeGreaterThan(0);
      expect(result.focusAreaRelevance['machine learning']).toBeGreaterThan(0);
      expect(result.isRelevant).toBe(result.overallRelevance >= descriptor.relevanceThreshold);
    });

    it('should identify non-relevant content', () => {
      const description = 'A beautiful sunset over the ocean with birds flying';
      const focusAreas = ['ai', 'technology'];
      
      const result = descriptor._keywordBasedRelevance(description, focusAreas);
      
      expect(result.overallRelevance).toBe(0);
      expect(result.isRelevant).toBe(false);
    });

    it('should handle custom focus areas', () => {
      const description = 'Research paper about data analysis and statistics';
      const focusAreas = ['research', 'data'];
      
      const result = descriptor._keywordBasedRelevance(description, focusAreas);
      
      expect(result.overallRelevance).toBeGreaterThan(0);
      expect(result.relevantElements).toContain('research');
      expect(result.relevantElements).toContain('data');
    });

    it('should be case insensitive', () => {
      const description = 'ARTIFICIAL INTELLIGENCE and MACHINE LEARNING';
      const focusAreas = ['ai', 'machine learning'];
      
      const result = descriptor._keywordBasedRelevance(description, focusAreas);
      
      expect(result.overallRelevance).toBeGreaterThan(0);
    });
  });

  describe('getConfig', () => {
    it('should return configuration options', () => {
      const config = descriptor.getConfig();
      
      expect(config).toHaveProperty('detailLevels');
      expect(config).toHaveProperty('supportedFormats');
      expect(config).toHaveProperty('maxImageSize');
      expect(config).toHaveProperty('relevanceThreshold');
      expect(config).toHaveProperty('defaultFocusAreas');
      expect(config).toHaveProperty('limits');
      expect(config).toHaveProperty('aiAvailable');
      
      expect(config.detailLevels).toContain('brief');
      expect(config.detailLevels).toContain('medium');
      expect(config.detailLevels).toContain('detailed');
      expect(config.aiAvailable).toBe(false);
    });

    it('should indicate AI availability when configured', () => {
      process.env.OPENAI_API_KEY = 'test-key';
      const descriptorWithAI = new VisualContentDescriptor();
      
      const config = descriptorWithAI.getConfig();
      expect(config.aiAvailable).toBe(true);
    });
  });

  describe('setRelevanceThreshold', () => {
    it('should update relevance threshold', () => {
      descriptor.setRelevanceThreshold(0.8);
      expect(descriptor.relevanceThreshold).toBe(0.8);
    });

    it('should reject invalid thresholds', () => {
      expect(() => descriptor.setRelevanceThreshold(-0.1))
        .toThrow('Relevance threshold must be between 0.0 and 1.0');
      
      expect(() => descriptor.setRelevanceThreshold(1.1))
        .toThrow('Relevance threshold must be between 0.0 and 1.0');
    });

    it('should accept boundary values', () => {
      expect(() => descriptor.setRelevanceThreshold(0.0)).not.toThrow();
      expect(() => descriptor.setRelevanceThreshold(1.0)).not.toThrow();
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete workflow with AI', async () => {
      process.env.OPENAI_API_KEY = 'test-key';
      descriptor = new VisualContentDescriptor();
      descriptor.openai = mockOpenAI;
      
      // Mock AI responses
      mockOpenAI.chat.completions.create
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify({
                description: 'AI research diagram showing neural network architecture',
                confidence: 0.95,
                keyElements: ['neural network', 'layers', 'connections'],
                textContent: 'Deep Learning Architecture',
                technicalElements: ['CNN', 'RNN', 'attention mechanism']
              })
            }
          }]
        })
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify({
                overallRelevance: 0.9,
                focusAreaRelevance: { ai: 0.95, 'machine learning': 0.85 },
                relevantElements: ['neural network', 'deep learning', 'architecture'],
                reasoning: 'Image clearly shows AI/ML technical concepts and architecture'
              })
            }
          }]
        });
      
      const imageData = {
        base64: 'valid-image-data',
        mimeType: 'image/png'
      };
      
      const result = await descriptor.analyzeVisualContent(imageData, {
        detailLevel: 'detailed',
        focusAreas: ['ai', 'machine learning'],
        contextText: 'Research paper figure'
      });
      
      expect(result.description).toContain('neural network architecture');
      expect(result.confidence).toBe(0.95);
      expect(result.relevanceAssessment.overallRelevance).toBe(0.9);
      expect(result.relevanceAssessment.isRelevant).toBe(true);
      expect(result.metadata.detailLevel).toBe('detailed');
    });

    it('should handle complete workflow without AI', async () => {
      const imageData = {
        base64: 'valid-image-data',
        mimeType: 'image/jpeg'
      };
      
      const result = await descriptor.analyzeVisualContent(imageData, {
        contextText: 'AI research diagram with neural networks and machine learning'
      });
      
      expect(result.description).toContain('Visual content description not available');
      expect(result.relevanceAssessment.method).toBe('keyword');
      expect(result.relevanceAssessment.overallRelevance).toBeGreaterThan(0);
    });
  });
});