const ContentCategorizer = require('../utils/contentCategorizer');

describe('ContentCategorizer', () => {
  let categorizer;

  beforeEach(() => {
    categorizer = new ContentCategorizer();
  });

  describe('Constructor and Initialization', () => {
    test('should initialize with predefined categories', () => {
      expect(categorizer.categories).toBeDefined();
      expect(Object.keys(categorizer.categories)).toContain('machine-learning');
      expect(Object.keys(categorizer.categories)).toContain('large-language-models');
      expect(Object.keys(categorizer.categories)).toContain('ai-ethics');
    });

    test('should initialize TF-IDF with category keywords', () => {
      expect(categorizer.tfidf).toBeDefined();
      expect(categorizer.tfidf.documents.length).toBeGreaterThan(0);
    });
  });

  describe('categorizeContent', () => {
    test('should categorize machine learning content correctly', async () => {
      const text = 'This paper presents a new neural network architecture for deep learning. The model uses supervised learning with training data to improve accuracy.';
      
      const result = await categorizer.categorizeContent(text);
      
      expect(result.categories).toBeDefined();
      expect(result.categories.length).toBeGreaterThan(0);
      expect(result.primaryCategory).toBe('machine-learning');
      expect(result.categories[0].category).toBe('machine-learning');
      expect(result.categories[0].score).toBeGreaterThan(0);
      expect(result.categories[0].confidence).toBeDefined();
    });

    test('should categorize LLM content correctly', async () => {
      const text = 'GPT-4 is a large language model that uses transformer architecture. The LLM shows impressive performance in natural language processing tasks.';
      
      const result = await categorizer.categorizeContent(text);
      
      expect(result.primaryCategory).toBe('large-language-models');
      expect(result.categories.some(cat => cat.category === 'large-language-models')).toBe(true);
      expect(result.categories.some(cat => cat.category === 'natural-language-processing')).toBe(true);
    });

    test('should categorize AI ethics content correctly', async () => {
      const text = 'This study examines bias in AI systems and discusses responsible AI development. The research focuses on fairness and transparency in machine learning models.';
      
      const result = await categorizer.categorizeContent(text);
      
      expect(result.categories.some(cat => cat.category === 'ai-ethics')).toBe(true);
      expect(result.categories.some(cat => cat.category === 'machine-learning')).toBe(true);
    });

    test('should handle multi-label categorization', async () => {
      const text = 'This research paper presents a new deep learning framework for computer vision. The neural network architecture improves object detection accuracy using convolutional layers.';
      
      const result = await categorizer.categorizeContent(text);
      
      expect(result.categories.length).toBeGreaterThan(1);
      expect(result.categories.some(cat => cat.category === 'machine-learning')).toBe(true);
      expect(result.categories.some(cat => cat.category === 'computer-vision')).toBe(true);
      expect(result.categories.some(cat => cat.category === 'research')).toBe(true);
    });

    test('should respect threshold parameter', async () => {
      const text = 'This is a general technology article about software development.';
      
      const resultLowThreshold = await categorizer.categorizeContent(text, { threshold: 0.01 });
      const resultHighThreshold = await categorizer.categorizeContent(text, { threshold: 0.5 });
      
      expect(resultLowThreshold.categories.length).toBeGreaterThanOrEqual(resultHighThreshold.categories.length);
    });

    test('should respect maxCategories parameter', async () => {
      const text = 'This comprehensive AI research covers machine learning, deep learning, neural networks, computer vision, and natural language processing applications.';
      
      const result = await categorizer.categorizeContent(text, { maxCategories: 3 });
      
      expect(result.categories.length).toBeLessThanOrEqual(3);
    });

    test('should include scores when requested', async () => {
      const text = 'Machine learning and deep learning research paper.';
      
      const resultWithScores = await categorizer.categorizeContent(text, { includeScores: true });
      const resultWithoutScores = await categorizer.categorizeContent(text, { includeScores: false });
      
      expect(resultWithScores.categories[0].score).toBeDefined();
      expect(resultWithoutScores.categories[0].score).toBeUndefined();
    });

    test('should handle empty text', async () => {
      await expect(categorizer.categorizeContent('')).rejects.toThrow('Valid text content is required');
      await expect(categorizer.categorizeContent(null)).rejects.toThrow('Valid text content is required');
      await expect(categorizer.categorizeContent(undefined)).rejects.toThrow('Valid text content is required');
    });

    test('should handle non-string input', async () => {
      await expect(categorizer.categorizeContent(123)).rejects.toThrow('Valid text content is required');
      await expect(categorizer.categorizeContent({})).rejects.toThrow('Valid text content is required');
    });

    test('should provide confidence levels', async () => {
      const text = 'This is a comprehensive machine learning and deep learning research paper with neural networks.';
      
      const result = await categorizer.categorizeContent(text);
      
      expect(result.categories[0].confidence).toMatch(/^(high|medium|low|very-low)$/);
    });

    test('should disable NLP when useNLP is false', async () => {
      const text = 'Machine learning research paper.';
      
      const resultWithNLP = await categorizer.categorizeContent(text, { useNLP: true });
      const resultWithoutNLP = await categorizer.categorizeContent(text, { useNLP: false });
      
      expect(resultWithNLP).toBeDefined();
      expect(resultWithoutNLP).toBeDefined();
      // Both should work, but may have different scores
    });
  });

  describe('batchCategorize', () => {
    test('should categorize multiple texts', async () => {
      const texts = [
        'Machine learning and neural networks research.',
        'Large language models like GPT and BERT.',
        'Computer vision and image recognition systems.'
      ];
      
      const results = await categorizer.batchCategorize(texts);
      
      expect(results).toHaveLength(3);
      expect(results[0].index).toBe(0);
      expect(results[0].categories).toBeDefined();
      expect(results[0].primaryCategory).toBe('machine-learning');
      
      expect(results[1].index).toBe(1);
      expect(results[1].primaryCategory).toBe('large-language-models');
      
      expect(results[2].index).toBe(2);
      expect(results[2].primaryCategory).toBe('computer-vision');
    });

    test('should handle errors in batch processing', async () => {
      const texts = [
        'Valid machine learning text.',
        null, // This will cause an error
        'Another valid AI research text.'
      ];
      
      const results = await categorizer.batchCategorize(texts);
      
      expect(results).toHaveLength(3);
      expect(results[0].error).toBeUndefined();
      expect(results[1].error).toBeDefined();
      expect(results[2].error).toBeUndefined();
    });

    test('should handle non-array input', async () => {
      await expect(categorizer.batchCategorize('not an array')).rejects.toThrow('Texts must be an array');
    });

    test('should handle empty array', async () => {
      const results = await categorizer.batchCategorize([]);
      expect(results).toHaveLength(0);
    });
  });

  describe('preprocessText', () => {
    test('should convert to lowercase', () => {
      const result = categorizer.preprocessText('MACHINE LEARNING');
      expect(result).toBe('machine learning');
    });

    test('should remove special characters', () => {
      const result = categorizer.preprocessText('AI/ML & Deep-Learning!');
      expect(result).toBe('ai ml deep-learning');
    });

    test('should normalize whitespace', () => {
      const result = categorizer.preprocessText('machine   learning\n\ndeep    learning');
      expect(result).toBe('machine learning deep learning');
    });

    test('should handle empty string', () => {
      const result = categorizer.preprocessText('');
      expect(result).toBe('');
    });
  });

  describe('categorizeByKeywords', () => {
    test('should find exact keyword matches', () => {
      const text = 'machine learning neural network';
      const scores = categorizer.categorizeByKeywords(text);
      
      expect(scores['machine-learning']).toBeGreaterThan(0);
      expect(scores['computer-vision']).toBe(0);
    });

    test('should find phrase matches', () => {
      const text = 'large language model research';
      const scores = categorizer.categorizeByKeywords(text);
      
      expect(scores['large-language-models']).toBeGreaterThan(0);
    });

    test('should handle stemming', () => {
      const text = 'training models algorithms';
      const scores = categorizer.categorizeByKeywords(text);
      
      expect(scores['machine-learning']).toBeGreaterThan(0);
    });
  });

  describe('getConfidenceLevel', () => {
    test('should return correct confidence levels', () => {
      expect(categorizer.getConfidenceLevel(0.8)).toBe('high');
      expect(categorizer.getConfidenceLevel(0.5)).toBe('medium');
      expect(categorizer.getConfidenceLevel(0.2)).toBe('low');
      expect(categorizer.getConfidenceLevel(0.05)).toBe('very-low');
    });
  });

  describe('getCategories', () => {
    test('should return all available categories', () => {
      const categories = categorizer.getCategories();
      
      expect(categories).toBeDefined();
      expect(categories['machine-learning']).toBeDefined();
      expect(categories['machine-learning'].name).toBe('Machine Learning');
      expect(categories['machine-learning'].keywords).toBeDefined();
      expect(categories['machine-learning'].weight).toBeDefined();
    });
  });

  describe('addCategory', () => {
    test('should add new category successfully', () => {
      const categoryName = 'quantum-computing';
      const keywords = ['quantum', 'qubit', 'quantum computing', 'quantum algorithm'];
      
      categorizer.addCategory(categoryName, keywords, 1.1);
      
      expect(categorizer.categories[categoryName]).toBeDefined();
      expect(categorizer.categories[categoryName].keywords).toEqual(keywords);
      expect(categorizer.categories[categoryName].weight).toBe(1.1);
    });

    test('should handle invalid inputs', () => {
      expect(() => categorizer.addCategory('', ['keyword'])).toThrow();
      expect(() => categorizer.addCategory('test', [])).toThrow();
      expect(() => categorizer.addCategory('test', 'not-array')).toThrow();
    });

    test('should reinitialize TF-IDF after adding category', () => {
      const originalDocCount = categorizer.tfidf.documents.length;
      
      categorizer.addCategory('test-category', ['test', 'keyword']);
      
      expect(categorizer.tfidf.documents.length).toBe(originalDocCount + 1);
    });
  });

  describe('removeCategory', () => {
    test('should remove existing category', () => {
      const categoryName = 'test-category';
      categorizer.addCategory(categoryName, ['test']);
      
      expect(categorizer.categories[categoryName]).toBeDefined();
      
      categorizer.removeCategory(categoryName);
      
      expect(categorizer.categories[categoryName]).toBeUndefined();
    });

    test('should handle non-existent category', () => {
      expect(() => categorizer.removeCategory('non-existent')).not.toThrow();
    });
  });

  describe('Integration Tests', () => {
    test('should categorize real AI research abstract', async () => {
      const abstract = `
        We present a novel approach to few-shot learning using transformer-based architectures. 
        Our method leverages attention mechanisms to improve performance on natural language processing tasks. 
        The model demonstrates significant improvements over baseline approaches on benchmark datasets, 
        achieving state-of-the-art results in text classification and named entity recognition. 
        We evaluate our approach on multiple datasets and provide comprehensive analysis of the results.
      `;
      
      const result = await categorizer.categorizeContent(abstract, { threshold: 0.05 });
      
      expect(result.categories.length).toBeGreaterThan(0);
      expect(result.categories.some(cat => cat.category === 'machine-learning' || cat.category === 'natural-language-processing' || cat.category === 'research')).toBe(true);
      expect(result.primaryCategory).toBeDefined();
    });

    test('should categorize AI ethics article', async () => {
      const article = `
        The rapid advancement of artificial intelligence raises important questions about bias, 
        fairness, and accountability in automated decision-making systems. This paper examines 
        the ethical implications of AI deployment in sensitive domains such as healthcare and 
        criminal justice. We propose a framework for responsible AI development that emphasizes 
        transparency, explainability, and human oversight. Our approach addresses key challenges 
        in ensuring AI systems are fair, unbiased, and aligned with human values.
      `;
      
      const result = await categorizer.categorizeContent(article, { threshold: 0.05 });
      
      expect(result.categories.some(cat => cat.category === 'ai-ethics')).toBe(true);
      expect(result.primaryCategory).toBeDefined();
    });

    test('should handle mixed content types', async () => {
      const mixedContent = `
        This business report analyzes the market impact of large language models like ChatGPT. 
        Companies are investing heavily in AI tools and frameworks such as TensorFlow and PyTorch. 
        The regulatory landscape is evolving with new policies governing AI deployment. 
        Computer vision applications are seeing significant growth in the automotive industry.
      `;
      
      const result = await categorizer.categorizeContent(mixedContent, { threshold: 0.05 });
      
      expect(result.categories.length).toBeGreaterThan(1);
      expect(result.categories.some(cat => 
        cat.category === 'business-strategy' || 
        cat.category === 'large-language-models' || 
        cat.category === 'tools-frameworks' || 
        cat.category === 'regulation-policy'
      )).toBe(true);
    });
  });

  describe('Performance Tests', () => {
    test('should handle large text efficiently', async () => {
      const largeText = 'machine learning neural network deep learning '.repeat(1000);
      
      const startTime = Date.now();
      const result = await categorizer.categorizeContent(largeText);
      const endTime = Date.now();
      
      expect(result.categories).toBeDefined();
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('should handle batch processing efficiently', async () => {
      const texts = Array(50).fill('machine learning and artificial intelligence research');
      
      const startTime = Date.now();
      const results = await categorizer.batchCategorize(texts);
      const endTime = Date.now();
      
      expect(results).toHaveLength(50);
      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });

  describe('Edge Cases', () => {
    test('should handle text with only stop words', async () => {
      const text = 'the and or but if then when where';
      
      const result = await categorizer.categorizeContent(text);
      
      expect(result.categories).toBeDefined();
      expect(result.primaryCategory).toBeNull();
    });

    test('should handle text with numbers and symbols', async () => {
      const text = '123 machine learning 456 neural network !@# deep learning $%^';
      
      const result = await categorizer.categorizeContent(text);
      
      expect(result.categories.length).toBeGreaterThan(0);
      expect(result.primaryCategory).toBe('machine-learning');
    });

    test('should handle very short text', async () => {
      const text = 'AI';
      
      const result = await categorizer.categorizeContent(text);
      
      expect(result.categories).toBeDefined();
      expect(result.metadata.textLength).toBe(2);
    });

    test('should handle text with repeated words', async () => {
      const text = 'machine machine machine learning learning learning';
      
      const result = await categorizer.categorizeContent(text);
      
      expect(result.categories.length).toBeGreaterThan(0);
      expect(result.primaryCategory).toBe('machine-learning');
    });
  });
});