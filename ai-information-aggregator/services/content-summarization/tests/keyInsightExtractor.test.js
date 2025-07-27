const KeyInsightExtractor = require('../utils/keyInsightExtractor');

describe('KeyInsightExtractor', () => {
  let extractor;

  beforeEach(() => {
    extractor = new KeyInsightExtractor();
  });

  describe('extractInsights', () => {
    test('should extract insights from valid text', async () => {
      const text = `
        Artificial intelligence has revolutionized natural language processing. 
        Recent studies show that transformer models achieve 95% accuracy on comprehension tasks. 
        This breakthrough indicates that AI systems will become more capable of understanding human communication. 
        The implications for customer service and content analysis are significant.
        Companies should invest in AI training to stay competitive.
      `;

      const result = await extractor.extractInsights(text);

      expect(result).toHaveProperty('insights');
      expect(result).toHaveProperty('totalFound');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('method');
      expect(Array.isArray(result.insights)).toBe(true);
      expect(result.insights.length).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0);
    });

    test('should handle empty text input', async () => {
      await expect(extractor.extractInsights('')).rejects.toThrow('Invalid text input');
      await expect(extractor.extractInsights(null)).rejects.toThrow('Invalid text input');
      await expect(extractor.extractInsights(undefined)).rejects.toThrow('Invalid text input');
    });

    test('should handle very short text', async () => {
      const shortText = 'This is short.';
      const result = await extractor.extractInsights(shortText);

      expect(result.insights).toEqual([]);
      expect(result.totalFound).toBe(0);
      expect(result.method).toBe('insufficient_content');
    });

    test('should respect maxInsights option', async () => {
      const text = `
        First important insight about AI development.
        Second significant finding in machine learning.
        Third crucial discovery in neural networks.
        Fourth major breakthrough in deep learning.
        Fifth essential conclusion about automation.
      `;

      const result = await extractor.extractInsights(text, { maxInsights: 2 });

      expect(result.insights.length).toBeLessThanOrEqual(2);
    });

    test('should respect minConfidence option', async () => {
      const text = `
        AI shows promising results in various applications.
        Machine learning algorithms demonstrate high accuracy.
        Deep learning models achieve significant performance improvements.
      `;

      const result = await extractor.extractInsights(text, { minConfidence: 0.8 });

      result.insights.forEach(insight => {
        expect(insight.confidence).toBeGreaterThanOrEqual(0.8);
      });
    });

    test('should include context when requested', async () => {
      const text = `
        Recent research demonstrates that AI models achieve 90% accuracy.
        This finding suggests significant improvements in technology.
      `;

      const result = await extractor.extractInsights(text, { includeContext: true });

      result.insights.forEach(insight => {
        expect(insight).toHaveProperty('context');
        expect(typeof insight.context).toBe('string');
      });
    });

    test('should classify different content types', async () => {
      const academicText = `
        Our methodology involved training neural networks on large datasets.
        Results show that the proposed approach achieves 95% accuracy.
        We conclude that this method is superior to existing techniques.
      `;

      const result = await extractor.extractInsights(academicText, { contentType: 'academic' });

      expect(result.insights.length).toBeGreaterThan(0);
      expect(result.method).toMatch(/statistical|hybrid/);
    });
  });

  describe('insight structure validation', () => {
    test('should return properly structured insights', async () => {
      const text = `
        Studies show that 85% of companies are adopting AI technologies.
        This trend indicates a major shift in business operations.
        Organizations should prepare for AI integration challenges.
      `;

      const result = await extractor.extractInsights(text);

      result.insights.forEach(insight => {
        expect(insight).toHaveProperty('text');
        expect(insight).toHaveProperty('type');
        expect(insight).toHaveProperty('confidence');
        expect(insight).toHaveProperty('source');
        
        expect(typeof insight.text).toBe('string');
        expect(['fact', 'conclusion', 'implication', 'recommendation']).toContain(insight.type);
        expect(typeof insight.confidence).toBe('number');
        expect(insight.confidence).toBeGreaterThanOrEqual(0);
        expect(insight.confidence).toBeLessThanOrEqual(1);
        expect(['ai', 'statistical', 'pattern']).toContain(insight.source);
      });
    });
  });

  describe('pattern recognition', () => {
    test('should extract numerical insights', async () => {
      const text = `
        The study found that 75% of participants showed improvement.
        Performance increased by 3.5 times compared to the baseline.
        Over 1,000 companies have adopted this technology.
      `;

      const result = await extractor.extractInsights(text);
      const numericalInsights = result.insights.filter(insight => 
        /\d+/.test(insight.text)
      );

      expect(numericalInsights.length).toBeGreaterThan(0);
    });

    test('should extract causal relationships', async () => {
      const text = `
        Because of improved algorithms, accuracy has increased significantly.
        The new approach leads to better performance outcomes.
        As a result of these changes, efficiency has improved.
      `;

      const result = await extractor.extractInsights(text);
      const causalInsights = result.insights.filter(insight => 
        insight.type === 'implication' || /because|leads to|as a result/i.test(insight.text)
      );

      expect(causalInsights.length).toBeGreaterThan(0);
    });

    test('should extract comparative insights', async () => {
      const text = `
        Method A performs better than Method B in most scenarios.
        Compared to traditional approaches, AI shows superior results.
        The new system is more efficient than existing solutions.
      `;

      const result = await extractor.extractInsights(text);
      const comparativeInsights = result.insights.filter(insight => 
        /better than|compared to|more.*than/i.test(insight.text)
      );

      expect(comparativeInsights.length).toBeGreaterThan(0);
    });

    test('should extract temporal insights', async () => {
      const text = `
        In the future, AI will become more sophisticated.
        Current trends predict significant growth in automation.
        Organizations are expected to increase AI investments.
      `;

      const result = await extractor.extractInsights(text);
      const temporalInsights = result.insights.filter(insight => 
        /future|predict|expected|trend/i.test(insight.text)
      );

      expect(temporalInsights.length).toBeGreaterThan(0);
    });
  });

  describe('ranking and filtering', () => {
    test('should rank insights by confidence', async () => {
      const text = `
        Important finding: AI accuracy reaches 95% in testing.
        Minor observation: Some improvements were noted.
        Critical conclusion: This represents a major breakthrough.
        Significant result: Performance exceeded expectations.
      `;

      const result = await extractor.extractInsights(text, { maxInsights: 10 });

      // Check that insights are sorted by confidence (descending)
      for (let i = 1; i < result.insights.length; i++) {
        expect(result.insights[i-1].confidence).toBeGreaterThanOrEqual(
          result.insights[i].confidence
        );
      }
    });

    test('should filter out low-confidence insights', async () => {
      const text = `
        This might be somewhat relevant information.
        Definitely important: AI shows 90% accuracy improvement.
        Perhaps this could be useful in some cases.
        Critical finding: Performance increased significantly.
      `;

      const result = await extractor.extractInsights(text, { minConfidence: 0.7 });

      result.insights.forEach(insight => {
        expect(insight.confidence).toBeGreaterThanOrEqual(0.7);
      });
    });

    test('should remove duplicate insights', async () => {
      const text = `
        AI performance has improved significantly.
        Artificial intelligence performance has improved significantly.
        The performance of AI has shown significant improvement.
        Machine learning shows different results.
      `;

      const result = await extractor.extractInsights(text);

      // Should not have near-duplicate insights
      const insightTexts = result.insights.map(i => i.text.toLowerCase());
      const uniqueTexts = new Set(insightTexts);
      expect(uniqueTexts.size).toBe(insightTexts.length);
    });
  });

  describe('batchExtractInsights', () => {
    test('should process multiple texts', async () => {
      const texts = [
        'AI technology shows 90% accuracy in recent tests.',
        'Machine learning algorithms demonstrate significant improvements.',
        'Deep learning models achieve breakthrough performance.'
      ];

      const results = await extractor.batchExtractInsights(texts);

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(texts.length);
      
      results.forEach(result => {
        expect(result).toHaveProperty('insights');
        expect(result).toHaveProperty('totalFound');
        expect(result).toHaveProperty('confidence');
      });
    });

    test('should handle errors in batch processing', async () => {
      const texts = [
        'Valid text with meaningful content for analysis.',
        null, // This should cause an error
        'Another valid text with insights.'
      ];

      const results = await extractor.batchExtractInsights(texts);

      expect(results.length).toBe(texts.length);
      expect(results[0]).not.toHaveProperty('error');
      expect(results[1]).toHaveProperty('error');
      expect(results[2]).not.toHaveProperty('error');
    });

    test('should apply options to all texts in batch', async () => {
      const texts = [
        'First text with multiple important insights and significant findings.',
        'Second text with various crucial discoveries and major breakthroughs.'
      ];

      const results = await extractor.batchExtractInsights(texts, { 
        maxInsights: 2,
        minConfidence: 0.6 
      });

      results.forEach(result => {
        if (!result.error) {
          expect(result.insights.length).toBeLessThanOrEqual(2);
          result.insights.forEach(insight => {
            expect(insight.confidence).toBeGreaterThanOrEqual(0.6);
          });
        }
      });
    });
  });

  describe('error handling', () => {
    test('should handle invalid input gracefully', async () => {
      await expect(extractor.extractInsights(123)).rejects.toThrow();
      await expect(extractor.extractInsights({})).rejects.toThrow();
      await expect(extractor.extractInsights([])).rejects.toThrow();
    });

    test('should handle processing errors gracefully', async () => {
      // Mock a method to throw an error
      const originalMethod = extractor._extractStatisticalInsights;
      extractor._extractStatisticalInsights = jest.fn(() => {
        throw new Error('Processing error');
      });

      const text = 'Valid text for testing error handling.';
      
      // Should still return a result, possibly with fewer insights
      const result = await extractor.extractInsights(text);
      expect(result).toHaveProperty('insights');
      expect(Array.isArray(result.insights)).toBe(true);

      // Restore original method
      extractor._extractStatisticalInsights = originalMethod;
    });
  });

  describe('confidence calculation', () => {
    test('should calculate overall confidence correctly', async () => {
      const text = `
        Critical finding: AI accuracy reaches 95% in comprehensive testing.
        Important result: Performance improvements exceed all expectations.
        Significant conclusion: This represents a major technological breakthrough.
      `;

      const result = await extractor.extractInsights(text);

      expect(typeof result.confidence).toBe('number');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      
      // Should have reasonable confidence for good content
      expect(result.confidence).toBeGreaterThan(0.3);
    });

    test('should return low confidence for poor content', async () => {
      const text = 'This is just some random text without any meaningful insights or important information.';

      const result = await extractor.extractInsights(text);

      // Should have lower confidence for content without clear insights
      expect(result.confidence).toBeLessThan(0.8);
    });
  });

  describe('content type handling', () => {
    test('should handle academic content appropriately', async () => {
      const academicText = `
        Our methodology involved training convolutional neural networks on ImageNet dataset.
        Results demonstrate that our approach achieves 94.2% top-1 accuracy.
        We conclude that attention mechanisms significantly improve model performance.
      `;

      const result = await extractor.extractInsights(academicText, { 
        contentType: 'academic' 
      });

      expect(result.insights.length).toBeGreaterThan(0);
      // Academic content should produce conclusion-type insights
      const conclusions = result.insights.filter(i => i.type === 'conclusion');
      expect(conclusions.length).toBeGreaterThan(0);
    });

    test('should handle news content appropriately', async () => {
      const newsText = `
        Tech giant announces breakthrough in quantum computing.
        The new processor is 1000 times faster than current systems.
        Industry experts predict this will revolutionize computing.
      `;

      const result = await extractor.extractInsights(newsText, { 
        contentType: 'news' 
      });

      expect(result.insights.length).toBeGreaterThan(0);
      // News content should capture factual information
      const facts = result.insights.filter(i => i.type === 'fact');
      expect(facts.length).toBeGreaterThan(0);
    });

    test('should handle technical content appropriately', async () => {
      const technicalText = `
        The API supports REST endpoints with JSON payloads.
        Authentication requires OAuth 2.0 bearer tokens.
        Rate limiting is set to 1000 requests per hour.
      `;

      const result = await extractor.extractInsights(technicalText, { 
        contentType: 'technical' 
      });

      expect(result.insights.length).toBeGreaterThan(0);
      // Technical content should capture specifications and requirements
      expect(result.insights.some(i => /\d+/.test(i.text))).toBe(true);
    });
  });
});