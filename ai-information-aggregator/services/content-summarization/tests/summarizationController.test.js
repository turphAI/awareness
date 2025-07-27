const request = require('supertest');
const express = require('express');
const SummarizationController = require('../controllers/summarizationController');

// Mock the TextSummarizer
jest.mock('../utils/textSummarizer');
const TextSummarizer = require('../utils/textSummarizer');

describe('SummarizationController', () => {
  let app;
  let controller;
  let mockTextSummarizer;

  beforeEach(() => {
    // Create mock instance
    mockTextSummarizer = {
      summarizeText: jest.fn(),
      batchSummarize: jest.fn()
    };
    
    // Mock the constructor to return our mock instance
    TextSummarizer.mockImplementation(() => mockTextSummarizer);

    controller = new SummarizationController();
    
    // Create express app for testing
    app = express();
    app.use(express.json());
    
    // Add routes
    app.post('/summarize', (req, res) => controller.summarizeText(req, res));
    app.post('/batch', (req, res) => controller.batchSummarize(req, res));
    app.get('/config', (req, res) => controller.getConfig(req, res));
    app.get('/health', (req, res) => controller.healthCheck(req, res));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /summarize', () => {
    test('should summarize text successfully', async () => {
      const mockResult = {
        summary: 'This is a test summary.',
        originalLength: 100,
        summaryLength: 25,
        compressionRatio: 0.25,
        method: 'ai_based',
        confidence: 0.9
      };

      mockTextSummarizer.summarizeText.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/summarize')
        .send({
          text: 'This is a long text that needs to be summarized for testing purposes.',
          options: { length: 'medium', detail: 'balanced' }
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult);
      expect(mockTextSummarizer.summarizeText).toHaveBeenCalledWith(
        'This is a long text that needs to be summarized for testing purposes.',
        { length: 'medium', detail: 'balanced' }
      );
    });

    test('should return 400 when text is missing', async () => {
      const response = await request(app)
        .post('/summarize')
        .send({
          options: { length: 'medium' }
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Text content is required');
    });

    test('should handle summarization errors', async () => {
      mockTextSummarizer.summarizeText.mockRejectedValue(new Error('Summarization failed'));

      const response = await request(app)
        .post('/summarize')
        .send({
          text: 'Test text'
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to summarize text');
      expect(response.body.details).toBe('Summarization failed');
    });

    test('should use default options when not provided', async () => {
      const mockResult = {
        summary: 'Test summary',
        originalLength: 50,
        summaryLength: 15,
        compressionRatio: 0.3,
        method: 'extractive',
        confidence: 0.7
      };

      mockTextSummarizer.summarizeText.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/summarize')
        .send({
          text: 'Test text without options'
        });

      expect(response.status).toBe(200);
      expect(mockTextSummarizer.summarizeText).toHaveBeenCalledWith(
        'Test text without options',
        {}
      );
    });
  });

  describe('POST /batch', () => {
    test('should batch summarize texts successfully', async () => {
      const mockResults = [
        {
          summary: 'First summary',
          originalLength: 100,
          summaryLength: 25,
          compressionRatio: 0.25,
          method: 'ai_based',
          confidence: 0.9
        },
        {
          summary: 'Second summary',
          originalLength: 80,
          summaryLength: 20,
          compressionRatio: 0.25,
          method: 'ai_based',
          confidence: 0.9
        }
      ];

      mockTextSummarizer.batchSummarize.mockResolvedValue(mockResults);

      const response = await request(app)
        .post('/batch')
        .send({
          texts: ['First text to summarize', 'Second text to summarize'],
          options: { length: 'brief' }
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toEqual(mockResults);
      expect(response.body.data.processed).toBe(2);
      expect(response.body.data.successful).toBe(2);
      expect(response.body.data.failed).toBe(0);
    });

    test('should handle batch with some failures', async () => {
      const mockResults = [
        {
          summary: 'Successful summary',
          originalLength: 100,
          summaryLength: 25,
          compressionRatio: 0.25,
          method: 'ai_based',
          confidence: 0.9
        },
        {
          error: 'Failed to process',
          originalText: 'Failed text...'
        }
      ];

      mockTextSummarizer.batchSummarize.mockResolvedValue(mockResults);

      const response = await request(app)
        .post('/batch')
        .send({
          texts: ['Successful text', 'Failed text']
        });

      expect(response.status).toBe(200);
      expect(response.body.data.processed).toBe(2);
      expect(response.body.data.successful).toBe(1);
      expect(response.body.data.failed).toBe(1);
    });

    test('should return 400 when texts array is missing', async () => {
      const response = await request(app)
        .post('/batch')
        .send({
          options: { length: 'medium' }
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Array of texts is required');
    });

    test('should return 400 when texts array is empty', async () => {
      const response = await request(app)
        .post('/batch')
        .send({
          texts: []
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Array of texts is required');
    });

    test('should return 400 when batch size exceeds limit', async () => {
      const largeBatch = new Array(51).fill('Test text');

      const response = await request(app)
        .post('/batch')
        .send({
          texts: largeBatch
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Maximum 50 texts allowed per batch');
    });

    test('should handle batch processing errors', async () => {
      mockTextSummarizer.batchSummarize.mockRejectedValue(new Error('Batch processing failed'));

      const response = await request(app)
        .post('/batch')
        .send({
          texts: ['Test text 1', 'Test text 2']
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to batch summarize texts');
    });
  });

  describe('GET /config', () => {
    test('should return configuration options', async () => {
      const response = await request(app).get('/config');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('lengthOptions');
      expect(response.body.data).toHaveProperty('detailOptions');
      expect(response.body.data).toHaveProperty('defaultOptions');
      expect(response.body.data).toHaveProperty('limits');

      expect(response.body.data.lengthOptions).toContain('brief');
      expect(response.body.data.lengthOptions).toContain('medium');
      expect(response.body.data.lengthOptions).toContain('detailed');

      expect(response.body.data.detailOptions).toContain('brief');
      expect(response.body.data.detailOptions).toContain('balanced');
      expect(response.body.data.detailOptions).toContain('detailed');

      expect(response.body.data.limits.maxBatchSize).toBe(50);
      expect(response.body.data.limits.maxTextLength).toBe(50000);
    });
  });

  describe('GET /health', () => {
    test('should return healthy status when service works', async () => {
      const mockResult = {
        summary: 'Test summary for health check',
        originalLength: 50,
        summaryLength: 15,
        compressionRatio: 0.3,
        method: 'extractive',
        confidence: 0.7
      };

      mockTextSummarizer.summarizeText.mockResolvedValue(mockResult);

      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.status).toBe('healthy');
      expect(response.body.data).toHaveProperty('testSummary');
      expect(response.body.data).toHaveProperty('method');
      expect(response.body.data).toHaveProperty('aiAvailable');
    });

    test('should return unhealthy status when service fails', async () => {
      mockTextSummarizer.summarizeText.mockRejectedValue(new Error('Service unavailable'));

      const response = await request(app).get('/health');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.status).toBe('unhealthy');
      expect(response.body.error).toBe('Service unavailable');
    });

    test('should indicate AI availability based on environment', async () => {
      const originalApiKey = process.env.OPENAI_API_KEY;
      
      // Test with API key
      process.env.OPENAI_API_KEY = 'test-key';
      
      mockTextSummarizer.summarizeText.mockResolvedValue({
        summary: 'Test',
        method: 'ai_based'
      });

      let response = await request(app).get('/health');
      expect(response.body.data.aiAvailable).toBe(true);

      // Test without API key
      delete process.env.OPENAI_API_KEY;
      
      response = await request(app).get('/health');
      expect(response.body.data.aiAvailable).toBe(false);

      // Restore original value
      if (originalApiKey) {
        process.env.OPENAI_API_KEY = originalApiKey;
      }
    });
  });

  describe('error handling', () => {
    test('should handle malformed JSON requests', async () => {
      const response = await request(app)
        .post('/summarize')
        .set('Content-Type', 'application/json')
        .send('invalid json');

      expect(response.status).toBe(400);
    });

    test('should handle unexpected errors gracefully', async () => {
      // Mock an unexpected error in the controller
      mockTextSummarizer.summarizeText.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const response = await request(app)
        .post('/summarize')
        .send({
          text: 'Test text'
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to summarize text');
    });
  });

  describe('input validation', () => {
    test('should handle various text input types', async () => {
      mockTextSummarizer.summarizeText.mockResolvedValue({
        summary: 'Test summary',
        originalLength: 10,
        summaryLength: 5,
        compressionRatio: 0.5,
        method: 'extractive',
        confidence: 0.7
      });

      // Test with normal string
      let response = await request(app)
        .post('/summarize')
        .send({ text: 'Normal text' });
      expect(response.status).toBe(200);

      // Test with empty string - should be handled by the text summarizer
      response = await request(app)
        .post('/summarize')
        .send({ text: '' });
      expect(response.status).toBe(400);

      // Test with whitespace only
      response = await request(app)
        .post('/summarize')
        .send({ text: '   ' });
      expect(response.status).toBe(400);
    });

    test('should validate options parameters', async () => {
      mockTextSummarizer.summarizeText.mockResolvedValue({
        summary: 'Test summary',
        originalLength: 10,
        summaryLength: 5,
        compressionRatio: 0.5,
        method: 'extractive',
        confidence: 0.7
      });

      const response = await request(app)
        .post('/summarize')
        .send({
          text: 'Test text',
          options: {
            length: 'medium',
            detail: 'balanced',
            temperature: 0.5,
            customOption: 'should be passed through'
          }
        });

      expect(response.status).toBe(200);
      expect(mockTextSummarizer.summarizeText).toHaveBeenCalledWith(
        'Test text',
        {
          length: 'medium',
          detail: 'balanced',
          temperature: 0.5,
          customOption: 'should be passed through'
        }
      );
    });
  });
});