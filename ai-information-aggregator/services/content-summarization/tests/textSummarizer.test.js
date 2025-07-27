const TextSummarizer = require('../utils/textSummarizer');

// Mock OpenAI
jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn()
      }
    }
  }))
}));

describe('TextSummarizer', () => {
  let textSummarizer;
  let mockOpenAI;

  beforeEach(() => {
    textSummarizer = new TextSummarizer();
    mockOpenAI = textSummarizer.openai;
    
    // Reset environment variables
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('summarizeText', () => {
    const sampleText = `
      Artificial Intelligence has revolutionized many industries in recent years. 
      Machine learning algorithms can now process vast amounts of data to identify patterns and make predictions. 
      Natural language processing enables computers to understand and generate human language. 
      Computer vision allows machines to interpret and analyze visual information. 
      These technologies are being applied in healthcare, finance, transportation, and many other sectors. 
      The future of AI looks promising with continued advancements in deep learning and neural networks.
    `;

    test('should summarize text with default options', async () => {
      const result = await textSummarizer.summarizeText(sampleText);

      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('originalLength');
      expect(result).toHaveProperty('summaryLength');
      expect(result).toHaveProperty('compressionRatio');
      expect(result).toHaveProperty('method');
      expect(result).toHaveProperty('confidence');

      expect(typeof result.summary).toBe('string');
      expect(result.summary.length).toBeGreaterThan(0);
      expect(result.originalLength).toBeGreaterThan(result.summaryLength);
      expect(result.compressionRatio).toBeLessThan(1);
    });

    test('should use AI summarization when API key is available', async () => {
      process.env.OPENAI_API_KEY = 'test-key';
      
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: 'AI has revolutionized industries through machine learning and natural language processing.'
          }
        }]
      });

      const result = await textSummarizer.summarizeText(sampleText);

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalled();
      expect(result.method).toBe('ai_based');
      expect(result.confidence).toBe(0.9);
    });

    test('should fallback to extractive summarization when AI fails', async () => {
      process.env.OPENAI_API_KEY = 'test-key';
      
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API Error'));

      const result = await textSummarizer.summarizeText(sampleText);

      expect(result.method).toBe('extractive');
      expect(result.confidence).toBe(0.7);
    });

    test('should handle different length options', async () => {
      const briefResult = await textSummarizer.summarizeText(sampleText, { length: 'brief' });
      const detailedResult = await textSummarizer.summarizeText(sampleText, { length: 'detailed' });

      expect(briefResult.summaryLength).toBeLessThan(detailedResult.summaryLength);
    });

    test('should handle different detail options', async () => {
      process.env.OPENAI_API_KEY = 'test-key';
      
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: 'Test summary'
          }
        }]
      });

      await textSummarizer.summarizeText(sampleText, { detail: 'brief' });
      await textSummarizer.summarizeText(sampleText, { detail: 'balanced' });
      await textSummarizer.summarizeText(sampleText, { detail: 'detailed' });

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(3);
    });

    test('should return original text when too short to summarize', async () => {
      const shortText = 'This is a very short text.';
      const result = await textSummarizer.summarizeText(shortText);

      expect(result.summary).toBe(shortText);
      expect(result.compressionRatio).toBe(1.0);
      expect(result.method).toBe('no_summarization_needed');
    });

    test('should handle invalid input', async () => {
      await expect(textSummarizer.summarizeText(null)).rejects.toThrow('Invalid text input');
      await expect(textSummarizer.summarizeText('')).rejects.toThrow('Invalid text input');
      await expect(textSummarizer.summarizeText(123)).rejects.toThrow('Invalid text input');
    });

    test('should preprocess text correctly', async () => {
      const messyText = `
        This   text    has    irregular     spacing.
        It also has special characters: @#$%^&*()
        And should be cleaned up properly.
      `;

      const result = await textSummarizer.summarizeText(messyText);

      expect(result.summary).not.toContain('   '); // Multiple spaces should be normalized
      expect(result).toHaveProperty('summary');
    });
  });

  describe('batchSummarize', () => {
    const sampleTexts = [
      'First text about artificial intelligence and machine learning applications.',
      'Second text discussing natural language processing and computer vision.',
      'Third text exploring deep learning and neural network architectures.'
    ];

    test('should summarize multiple texts', async () => {
      const results = await textSummarizer.batchSummarize(sampleTexts);

      expect(Array.isArray(results)).toBe(true);
      expect(results).toHaveLength(3);
      
      results.forEach(result => {
        expect(result).toHaveProperty('summary');
        expect(result).toHaveProperty('originalLength');
        expect(result).toHaveProperty('summaryLength');
      });
    });

    test('should handle errors in batch processing', async () => {
      const textsWithError = [
        'Valid text for summarization.',
        null, // This will cause an error
        'Another valid text.'
      ];

      const results = await textSummarizer.batchSummarize(textsWithError);

      expect(results).toHaveLength(3);
      expect(results[0]).toHaveProperty('summary');
      expect(results[1]).toHaveProperty('error');
      expect(results[2]).toHaveProperty('summary');
    });

    test('should apply same options to all texts in batch', async () => {
      const options = { length: 'brief', detail: 'brief' };
      const results = await textSummarizer.batchSummarize(sampleTexts, options);

      results.forEach(result => {
        if (!result.error) {
          expect(result.summaryLength).toBeLessThan(100); // Brief summaries should be short
        }
      });
    });
  });

  describe('private methods', () => {
    test('should calculate word count correctly', () => {
      const text = 'This is a test with five words.';
      const wordCount = textSummarizer._getWordCount(text);
      expect(wordCount).toBe(7); // Corrected expected count
    });

    test('should get correct max tokens for different lengths', () => {
      expect(textSummarizer._getMaxTokens('brief')).toBe(100);
      expect(textSummarizer._getMaxTokens('medium')).toBe(250);
      expect(textSummarizer._getMaxTokens('detailed')).toBe(600);
      expect(textSummarizer._getMaxTokens('unknown')).toBe(250); // default
    });

    test('should preprocess text correctly', () => {
      const messyText = '  This   has    extra   spaces   and @#$ special chars  ';
      const cleaned = textSummarizer._preprocessText(messyText);
      
      expect(cleaned).toBe('This has extra spaces and special chars'); // Should normalize multiple spaces
      expect(cleaned.trim()).toBe(cleaned); // No leading/trailing spaces
    });

    test('should extract sentences correctly', () => {
      const text = 'This is a longer first sentence with more than twenty characters. This is the second sentence with enough length. This is the third sentence that also meets the minimum length requirement.';
      const sentences = textSummarizer._extractSentences(text);
      
      expect(Array.isArray(sentences)).toBe(true);
      expect(sentences.length).toBeGreaterThan(0);
      sentences.forEach(sentence => {
        expect(sentence).toHaveProperty('text');
        expect(sentence).toHaveProperty('position');
        expect(sentence).toHaveProperty('length');
      });
    });

    test('should calculate word frequency correctly', () => {
      const tokens = ['test', 'word', 'test', 'example', 'word', 'test'];
      const freq = textSummarizer._calculateWordFrequency(tokens);
      
      expect(freq.test).toBe(3);
      expect(freq.word).toBe(2);
      expect(freq.exampl).toBe(1); // 'example' gets stemmed to 'exampl'
    });

    test('should score sentences appropriately', () => {
      const sentences = [
        { text: 'This is an important sentence with key information about machine learning algorithms.', position: 0, length: 80 },
        { text: 'This sentence has numbers like 42 and statistics about performance metrics.', position: 1, length: 75 },
        { text: 'Regular sentence without any special features or keywords mentioned here.', position: 2, length: 70 }
      ];
      
      const fullText = sentences.map(s => s.text).join(' ');
      const scored = textSummarizer._scoreSentences(sentences, fullText);
      
      expect(scored.length).toBe(3);
      expect(scored[0]).toHaveProperty('score');
      expect(scored[1]).toHaveProperty('score');
      expect(scored[2]).toHaveProperty('score');
    });
  });

  describe('configuration and options', () => {
    test('should handle custom temperature settings', async () => {
      process.env.OPENAI_API_KEY = 'test-key';
      
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: 'Test summary'
          }
        }]
      });

      const sampleText = 'This is a much longer test text for temperature configuration that has enough content to trigger AI summarization instead of returning the original text unchanged. ' +
        'It contains multiple sentences with various topics and information. ' +
        'Machine learning algorithms are becoming increasingly sophisticated. ' +
        'Natural language processing enables computers to understand human language. ' +
        'Deep learning networks can process complex patterns in data. ' +
        'This text should be long enough to trigger summarization instead of returning unchanged.';
      
      await textSummarizer.summarizeText(sampleText, { temperature: 0.8 });

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.8
        })
      );
    });

    test('should build appropriate prompts for different detail levels', () => {
      const text = 'Sample text';
      const briefPrompt = textSummarizer._buildSummarizationPrompt(text, { detail: 'brief' });
      const detailedPrompt = textSummarizer._buildSummarizationPrompt(text, { detail: 'detailed' });

      expect(briefPrompt).toContain('very concise');
      expect(detailedPrompt).toContain('comprehensive');
    });
  });

  describe('error handling', () => {
    test('should handle OpenAI API errors gracefully', async () => {
      process.env.OPENAI_API_KEY = 'test-key';
      
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('Rate limit exceeded'));

      const longText = 'This is a much longer test text for error handling that should definitely trigger the AI summarization path and then fallback to extractive summarization when the API fails. ' +
        'It contains multiple sentences with various topics and information. ' +
        'Machine learning algorithms are becoming increasingly sophisticated. ' +
        'Natural language processing enables computers to understand human language. ' +
        'Deep learning networks can process complex patterns in data. ' +
        'This text should be long enough to trigger summarization instead of returning unchanged.';
      
      const result = await textSummarizer.summarizeText(longText);

      expect(result.method).toBe('extractive'); // Should fallback
      expect(result).toHaveProperty('summary');
    });

    test('should handle missing OpenAI configuration', async () => {
      delete process.env.OPENAI_API_KEY;

      const longText = 'This is a much longer test text without API key that should trigger extractive summarization since AI is not available. ' +
        'It contains multiple sentences with various topics and information. ' +
        'Machine learning algorithms are becoming increasingly sophisticated. ' +
        'Natural language processing enables computers to understand human language. ' +
        'Deep learning networks can process complex patterns in data. ' +
        'This text should be long enough to trigger summarization instead of returning unchanged.';
      
      const result = await textSummarizer.summarizeText(longText);

      expect(result.method).toBe('extractive');
      expect(result).toHaveProperty('summary');
    });

    test('should handle malformed API responses', async () => {
      process.env.OPENAI_API_KEY = 'test-key';
      
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [] // Empty choices array
      });

      const longText = 'This is a much longer test text for malformed response that should trigger AI summarization and then fallback when the response is malformed. ' +
        'It contains multiple sentences with various topics and information. ' +
        'Machine learning algorithms are becoming increasingly sophisticated. ' +
        'Natural language processing enables computers to understand human language. ' +
        'Deep learning networks can process complex patterns in data. ' +
        'This text should be long enough to trigger summarization instead of returning unchanged.';
      
      const result = await textSummarizer.summarizeText(longText);

      expect(result.method).toBe('extractive'); // Should fallback
    });
  });
});