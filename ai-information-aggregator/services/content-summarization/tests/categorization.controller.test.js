const request = require('supertest');
const express = require('express');
const SummarizationController = require('../controllers/summarizationController');

// Create test app
const app = express();
app.use(express.json());

const controller = new SummarizationController();

// Add routes for testing
app.post('/categorize', (req, res) => controller.categorizeText(req, res));
app.post('/batch-categorize', (req, res) => controller.batchCategorize(req, res));
app.get('/categories', (req, res) => controller.getCategories(req, res));
app.post('/categories', (req, res) => controller.addCategory(req, res));
app.delete('/categories/:name', (req, res) => controller.removeCategory(req, res));

describe('SummarizationController - Categorization', () => {
  describe('POST /categorize', () => {
    test('should categorize machine learning content successfully', async () => {
      const response = await request(app)
        .post('/categorize')
        .send({
          text: 'This paper presents a new neural network architecture for deep learning. The model uses supervised learning with training data to improve accuracy.',
          options: { threshold: 0.1, maxCategories: 5 }
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.categories).toBeDefined();
      expect(response.body.data.categories.length).toBeGreaterThan(0);
      expect(response.body.data.primaryCategory).toBe('machine-learning');
      expect(response.body.data.categories[0].category).toBe('machine-learning');
      expect(response.body.data.categories[0].score).toBeGreaterThan(0);
      expect(response.body.data.categories[0].confidence).toBeDefined();
    });

    test('should categorize LLM content successfully', async () => {
      const response = await request(app)
        .post('/categorize')
        .send({
          text: 'GPT-4 is a large language model that uses transformer architecture. The LLM shows impressive performance in natural language processing tasks.'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.primaryCategory).toBe('large-language-models');
      expect(response.body.data.categories.some(cat => cat.category === 'large-language-models')).toBe(true);
      expect(response.body.data.categories.some(cat => cat.category === 'natural-language-processing')).toBe(true);
    });

    test('should handle multi-label categorization', async () => {
      const response = await request(app)
        .post('/categorize')
        .send({
          text: 'This research paper presents a new deep learning framework for computer vision. The neural network architecture improves object detection accuracy using convolutional layers.'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.categories.length).toBeGreaterThan(1);
      expect(response.body.data.categories.some(cat => cat.category === 'machine-learning')).toBe(true);
      expect(response.body.data.categories.some(cat => cat.category === 'computer-vision')).toBe(true);
      expect(response.body.data.categories.some(cat => cat.category === 'research')).toBe(true);
    });

    test('should respect categorization options', async () => {
      const response = await request(app)
        .post('/categorize')
        .send({
          text: 'This comprehensive AI research covers machine learning, deep learning, neural networks, computer vision, and natural language processing applications.',
          options: {
            threshold: 0.2,
            maxCategories: 3,
            includeScores: false
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.categories.length).toBeLessThanOrEqual(3);
      expect(response.body.data.categories[0].score).toBeUndefined();
    });

    test('should return 400 for empty text', async () => {
      const response = await request(app)
        .post('/categorize')
        .send({ text: '' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Text content is required');
    });

    test('should return 400 for missing text', async () => {
      const response = await request(app)
        .post('/categorize')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Text content is required');
    });

    test('should handle categorization errors gracefully', async () => {
      // Mock the categorizer to throw an error
      const originalCategorizer = controller.contentCategorizer;
      controller.contentCategorizer = {
        categorizeContent: jest.fn().mockRejectedValue(new Error('Test error'))
      };

      const response = await request(app)
        .post('/categorize')
        .send({ text: 'test text' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to categorize text');
      expect(response.body.details).toBe('Test error');

      // Restore original categorizer
      controller.contentCategorizer = originalCategorizer;
    });
  });

  describe('POST /batch-categorize', () => {
    test('should batch categorize multiple texts successfully', async () => {
      const texts = [
        'Machine learning and neural networks research.',
        'Large language models like GPT and BERT.',
        'Computer vision and image recognition systems.'
      ];

      const response = await request(app)
        .post('/batch-categorize')
        .send({ texts });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toHaveLength(3);
      expect(response.body.data.processed).toBe(3);
      expect(response.body.data.successful).toBe(3);
      expect(response.body.data.failed).toBe(0);

      expect(response.body.data.results[0].index).toBe(0);
      expect(response.body.data.results[0].primaryCategory).toBe('machine-learning');
      
      expect(response.body.data.results[1].index).toBe(1);
      expect(response.body.data.results[1].primaryCategory).toBe('large-language-models');
      
      expect(response.body.data.results[2].index).toBe(2);
      expect(response.body.data.results[2].primaryCategory).toBe('computer-vision');
    });

    test('should handle batch processing with options', async () => {
      const texts = [
        'AI research paper on machine learning',
        'Deep learning neural networks study'
      ];

      const response = await request(app)
        .post('/batch-categorize')
        .send({
          texts,
          options: { threshold: 0.2, maxCategories: 2 }
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toHaveLength(2);
      expect(response.body.data.results[0].categories.length).toBeLessThanOrEqual(2);
      expect(response.body.data.results[1].categories.length).toBeLessThanOrEqual(2);
    });

    test('should return 400 for non-array texts', async () => {
      const response = await request(app)
        .post('/batch-categorize')
        .send({ texts: 'not an array' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Array of texts is required');
    });

    test('should return 400 for empty array', async () => {
      const response = await request(app)
        .post('/batch-categorize')
        .send({ texts: [] });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Array of texts is required');
    });

    test('should return 400 for too many texts', async () => {
      const texts = Array(101).fill('test text');

      const response = await request(app)
        .post('/batch-categorize')
        .send({ texts });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Maximum 100 texts allowed per batch for categorization');
    });

    test('should handle partial failures in batch processing', async () => {
      // Mock the categorizer to fail on second text
      const originalCategorizer = controller.contentCategorizer;
      controller.contentCategorizer = {
        batchCategorize: jest.fn().mockResolvedValue([
          { index: 0, categories: [{ category: 'machine-learning', score: 0.8 }], primaryCategory: 'machine-learning' },
          { index: 1, error: 'Test error', categories: [], primaryCategory: null },
          { index: 2, categories: [{ category: 'computer-vision', score: 0.7 }], primaryCategory: 'computer-vision' }
        ])
      };

      const response = await request(app)
        .post('/batch-categorize')
        .send({
          texts: ['text1', 'text2', 'text3']
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.processed).toBe(3);
      expect(response.body.data.successful).toBe(2);
      expect(response.body.data.failed).toBe(1);

      // Restore original categorizer
      controller.contentCategorizer = originalCategorizer;
    });
  });

  describe('GET /categories', () => {
    test('should return available categories', async () => {
      const response = await request(app)
        .get('/categories');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.categories).toBeDefined();
      expect(response.body.data.count).toBeGreaterThan(0);
      expect(response.body.data.categories['machine-learning']).toBeDefined();
      expect(response.body.data.categories['machine-learning'].name).toBe('Machine Learning');
      expect(response.body.data.categories['machine-learning'].keywords).toBeDefined();
      expect(response.body.data.categories['machine-learning'].weight).toBeDefined();
    });

    test('should handle errors when getting categories', async () => {
      // Mock the categorizer to throw an error
      const originalCategorizer = controller.contentCategorizer;
      controller.contentCategorizer = {
        getCategories: jest.fn().mockImplementation(() => {
          throw new Error('Test error');
        })
      };

      const response = await request(app)
        .get('/categories');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to get categories');
      expect(response.body.details).toBe('Test error');

      // Restore original categorizer
      controller.contentCategorizer = originalCategorizer;
    });
  });

  describe('POST /categories', () => {
    test('should add custom category successfully', async () => {
      const response = await request(app)
        .post('/categories')
        .send({
          name: 'quantum-computing',
          keywords: ['quantum', 'qubit', 'quantum computing', 'quantum algorithm'],
          weight: 1.1
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('quantum-computing');
      expect(response.body.data.category.name).toBe('quantum-computing');
      expect(response.body.data.category.keywords).toEqual(['quantum', 'qubit', 'quantum computing', 'quantum algorithm']);
      expect(response.body.data.category.weight).toBe(1.1);
    });

    test('should use default weight when not provided', async () => {
      const response = await request(app)
        .post('/categories')
        .send({
          name: 'test-category',
          keywords: ['test', 'keyword']
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.category.weight).toBe(1.0);
    });

    test('should return 400 for missing name', async () => {
      const response = await request(app)
        .post('/categories')
        .send({
          keywords: ['test', 'keyword']
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Category name and keywords array are required');
    });

    test('should return 400 for missing keywords', async () => {
      const response = await request(app)
        .post('/categories')
        .send({
          name: 'test-category'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Category name and keywords array are required');
    });

    test('should return 400 for empty keywords array', async () => {
      const response = await request(app)
        .post('/categories')
        .send({
          name: 'test-category',
          keywords: []
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Category name and keywords array are required');
    });

    test('should return 400 for non-array keywords', async () => {
      const response = await request(app)
        .post('/categories')
        .send({
          name: 'test-category',
          keywords: 'not-array'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Category name and keywords array are required');
    });

    test('should handle errors when adding category', async () => {
      // Mock the categorizer to throw an error
      const originalCategorizer = controller.contentCategorizer;
      controller.contentCategorizer = {
        addCategory: jest.fn().mockImplementation(() => {
          throw new Error('Test error');
        })
      };

      const response = await request(app)
        .post('/categories')
        .send({
          name: 'test-category',
          keywords: ['test']
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to add category');
      expect(response.body.details).toBe('Test error');

      // Restore original categorizer
      controller.contentCategorizer = originalCategorizer;
    });
  });

  describe('DELETE /categories/:name', () => {
    test('should remove category successfully', async () => {
      // First add a category
      await request(app)
        .post('/categories')
        .send({
          name: 'test-category-to-remove',
          keywords: ['test', 'remove']
        });

      // Then remove it
      const response = await request(app)
        .delete('/categories/test-category-to-remove');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('test-category-to-remove');
    });

    test('should return 400 for missing category name', async () => {
      const response = await request(app)
        .delete('/categories/');

      expect(response.status).toBe(404); // Express returns 404 for missing route params
    });

    test('should handle non-existent category gracefully', async () => {
      const response = await request(app)
        .delete('/categories/non-existent-category');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('non-existent-category');
    });

    test('should handle errors when removing category', async () => {
      // Mock the categorizer to throw an error
      const originalCategorizer = controller.contentCategorizer;
      controller.contentCategorizer = {
        removeCategory: jest.fn().mockImplementation(() => {
          throw new Error('Test error');
        })
      };

      const response = await request(app)
        .delete('/categories/test-category');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to remove category');
      expect(response.body.details).toBe('Test error');

      // Restore original categorizer
      controller.contentCategorizer = originalCategorizer;
    });
  });

  describe('Integration Tests', () => {
    test('should handle complete categorization workflow', async () => {
      // 1. Get initial categories
      const categoriesResponse = await request(app)
        .get('/categories');
      
      expect(categoriesResponse.status).toBe(200);
      const initialCount = categoriesResponse.body.data.count;

      // 2. Add custom category
      await request(app)
        .post('/categories')
        .send({
          name: 'workflow-test',
          keywords: ['workflow', 'test', 'integration'],
          weight: 1.2
        });

      // 3. Verify category was added
      const updatedCategoriesResponse = await request(app)
        .get('/categories');
      
      expect(updatedCategoriesResponse.status).toBe(200);
      expect(updatedCategoriesResponse.body.data.count).toBe(initialCount + 1);
      expect(updatedCategoriesResponse.body.data.categories['workflow-test']).toBeDefined();

      // 4. Categorize text that should match the new category
      const categorizeResponse = await request(app)
        .post('/categorize')
        .send({
          text: 'This is a workflow test for integration testing of the categorization system.'
        });

      expect(categorizeResponse.status).toBe(200);
      expect(categorizeResponse.body.data.categories.some(cat => cat.category === 'workflow-test')).toBe(true);

      // 5. Remove the custom category
      const removeResponse = await request(app)
        .delete('/categories/workflow-test');

      expect(removeResponse.status).toBe(200);

      // 6. Verify category was removed
      const finalCategoriesResponse = await request(app)
        .get('/categories');
      
      expect(finalCategoriesResponse.status).toBe(200);
      expect(finalCategoriesResponse.body.data.count).toBe(initialCount);
      expect(finalCategoriesResponse.body.data.categories['workflow-test']).toBeUndefined();
    });

    test('should handle real-world AI content categorization', async () => {
      const aiResearchAbstract = `
        We present a novel approach to few-shot learning using transformer-based architectures. 
        Our method leverages attention mechanisms to improve performance on natural language processing tasks. 
        The model demonstrates significant improvements over baseline approaches on benchmark datasets, 
        achieving state-of-the-art results in text classification and named entity recognition. 
        We evaluate our approach on multiple datasets and provide comprehensive analysis of the results.
      `;

      const response = await request(app)
        .post('/categorize')
        .send({ 
          text: aiResearchAbstract,
          options: { threshold: 0.05 }
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.categories.length).toBeGreaterThan(0);
      expect(response.body.data.categories.some(cat => 
        cat.category === 'machine-learning' || 
        cat.category === 'natural-language-processing' || 
        cat.category === 'research'
      )).toBe(true);
    });

    test('should handle batch processing of diverse AI content', async () => {
      const texts = [
        'This paper discusses bias and fairness in AI systems, focusing on responsible AI development.',
        'New deep learning framework for computer vision applications in autonomous vehicles.',
        'Business analysis of the AI market and investment trends in machine learning startups.',
        'Government regulations and policies for AI governance and compliance requirements.'
      ];

      const response = await request(app)
        .post('/batch-categorize')
        .send({ texts });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toHaveLength(4);
      expect(response.body.data.successful).toBe(4);

      // Check that different content types are categorized appropriately
      expect(response.body.data.results[0].categories.some(cat => cat.category === 'ai-ethics')).toBe(true);
      expect(response.body.data.results[1].categories.some(cat => cat.category === 'computer-vision')).toBe(true);
      expect(response.body.data.results[2].categories.some(cat => cat.category === 'business-strategy')).toBe(true);
      expect(response.body.data.results[3].categories.some(cat => cat.category === 'regulation-policy')).toBe(true);
    });
  });

  describe('Performance Tests', () => {
    test('should handle large text categorization efficiently', async () => {
      const largeText = 'machine learning neural network deep learning artificial intelligence '.repeat(500);

      const startTime = Date.now();
      const response = await request(app)
        .post('/categorize')
        .send({ text: largeText });
      const endTime = Date.now();

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('should handle large batch processing efficiently', async () => {
      const texts = Array(50).fill('machine learning and artificial intelligence research');

      const startTime = Date.now();
      const response = await request(app)
        .post('/batch-categorize')
        .send({ texts });
      const endTime = Date.now();

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toHaveLength(50);
      expect(endTime - startTime).toBeLessThan(15000); // Should complete within 15 seconds
    });
  });
});