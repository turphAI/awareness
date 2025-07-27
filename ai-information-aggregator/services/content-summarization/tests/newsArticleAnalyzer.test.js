const NewsArticleAnalyzer = require('../utils/newsArticleAnalyzer');

describe('NewsArticleAnalyzer', () => {
  let analyzer;

  beforeEach(() => {
    analyzer = new NewsArticleAnalyzer();
  });

  describe('analyzeSentence', () => {
    test('should classify factual sentence correctly', () => {
      const sentence = 'According to the study, 75% of participants showed improvement.';
      const result = analyzer.analyzeSentence(sentence);

      expect(result.type).toBe('fact');
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.indicators.factScore).toBeGreaterThan(0);
      expect(result.indicators.hasNumbers).toBe(true);
    });

    test('should classify opinion sentence correctly', () => {
      const sentence = 'I believe this approach might be the best solution for the problem.';
      const result = analyzer.analyzeSentence(sentence);

      expect(result.type).toBe('opinion');
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.indicators.opinionScore).toBeGreaterThan(0);
    });

    test('should classify neutral sentence correctly', () => {
      const sentence = 'The meeting was held on Tuesday morning.';
      const result = analyzer.analyzeSentence(sentence);

      expect(result.type).toBe('neutral');
      expect(result.confidence).toBeLessThanOrEqual(0.6);
    });

    test('should detect quotes as factual indicator', () => {
      const sentence = 'The CEO said "We are committed to innovation and growth."';
      const result = analyzer.analyzeSentence(sentence);

      expect(result.indicators.hasQuotes).toBe(true);
      expect(result.indicators.factScore).toBeGreaterThan(0);
    });

    test('should detect subjective language in opinions', () => {
      const sentence = 'This is an absolutely amazing and incredible breakthrough.';
      const result = analyzer.analyzeSentence(sentence);

      expect(result.indicators.subjectiveLanguage).toBeGreaterThan(0);
      expect(result.type).toBe('opinion');
    });

    test('should handle empty or very short sentences', () => {
      const sentence = 'Yes.';
      const result = analyzer.analyzeSentence(sentence);

      expect(result).toHaveProperty('type');
      expect(result).toHaveProperty('confidence');
      expect(result.sentence).toBe('Yes.');
    });
  });

  describe('detectNewsArticle', () => {
    test('should detect news article with typical indicators', () => {
      const newsText = `
        WASHINGTON, March 15 - According to Reuters, the government announced new policies today.
        Officials said the changes will take effect immediately.
        "This is a significant step forward," the spokesperson reported.
      `;
      
      const result = analyzer.detectNewsArticle(newsText);

      expect(result.isNews).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.4);
      expect(result.indicators.newsPatterns).toBeGreaterThan(0);
      expect(result.indicators.hasQuotes).toBe(true);
    });

    test('should not detect non-news content as news', () => {
      const nonNewsText = `
        This is a tutorial on how to use JavaScript.
        First, you need to understand variables and functions.
        Then you can move on to more advanced concepts.
      `;
      
      const result = analyzer.detectNewsArticle(nonNewsText);

      expect(result.isNews).toBe(false);
      expect(result.confidence).toBeLessThanOrEqual(0.4);
    });

    test('should detect dateline in news articles', () => {
      const newsWithDateline = 'NEW YORK, January 20 - Breaking news from the financial district...';
      const result = analyzer.detectNewsArticle(newsWithDateline);

      expect(result.indicators.hasDateline).toBe(true);
    });
  });

  describe('assessSourceCredibility', () => {
    test('should rate government sources highly', () => {
      const text = 'Official government data shows statistics and research findings.';
      const factOpinionRatio = { factPercentage: 80, opinionPercentage: 20 };
      
      const result = analyzer.assessSourceCredibility(text, null, 'government', factOpinionRatio);

      expect(result.score).toBeGreaterThan(0.8);
      expect(result.level).toBe('high');
      expect(result.factors.sourceType).toBe('government');
    });

    test('should rate social media sources lower', () => {
      const text = 'Just my thoughts on this topic without much evidence.';
      const factOpinionRatio = { factPercentage: 20, opinionPercentage: 80 };
      
      const result = analyzer.assessSourceCredibility(text, null, 'social_media', factOpinionRatio);

      expect(result.score).toBeLessThan(0.5);
      expect(result.level).toMatch(/low|medium/);
      expect(result.factors.sourceType).toBe('social_media');
    });

    test('should increase credibility for citations and quotes', () => {
      const textWithCitations = `
        According to the study published at https://example.com/study, researchers found significant results.
        The lead scientist stated "Our findings are conclusive."
        Multiple data sources confirm these statistics.
      `;
      const factOpinionRatio = { factPercentage: 90, opinionPercentage: 10 };
      
      const result = analyzer.assessSourceCredibility(textWithCitations, null, 'academic', factOpinionRatio);

      expect(result.factors.citations).toBeGreaterThan(0);
      expect(result.factors.quotes).toBeGreaterThan(0);
      expect(result.factors.dataReferences).toBeGreaterThan(0);
      expect(result.score).toBeGreaterThan(0.7);
    });

    test('should detect byline presence', () => {
      const textWithByline = 'By John Smith, Science Reporter\n\nThis article discusses recent developments...';
      const factOpinionRatio = { factPercentage: 60, opinionPercentage: 40 };
      
      const result = analyzer.assessSourceCredibility(textWithByline, null, 'established_media', factOpinionRatio);

      expect(result.factors.hasByline).toBe(true);
    });
  });

  describe('detectBias', () => {
    test('should detect emotional language bias', () => {
      const biasedText = `
        This is absolutely outrageous and shocking news that will devastate the community.
        The terrible decision was made by officials who clearly don't understand the situation.
      `;
      
      const result = analyzer.detectBias(biasedText);

      expect(result.biasScore).toBeGreaterThan(1);
      expect(result.level).toMatch(/medium|high/);
      expect(result.indicators.emotionalLanguage).toBeGreaterThan(0);
    });

    test('should detect loaded language bias', () => {
      const loadedText = `
        The politician slammed the opposition and completely destroyed their arguments.
        Critics were obliterated by the devastating response.
      `;
      
      const result = analyzer.detectBias(loadedText);

      expect(result.indicators.loadedLanguage).toBeGreaterThan(0);
      expect(result.biasScore).toBeGreaterThan(0.5);
    });

    test('should recognize balanced reporting', () => {
      const balancedText = `
        The proposal has supporters and critics. However, both sides agree on some points.
        Supporters claim it will help, but critics argue it may cause problems.
        Alternative views suggest a different approach might be better.
      `;
      
      const result = analyzer.detectBias(balancedText);

      expect(result.indicators.balanceIndicators).toBeGreaterThan(2);
      expect(result.biasScore).toBeLessThan(1);
    });

    test('should handle neutral text with low bias', () => {
      const neutralText = `
        The meeting was scheduled for 3 PM on Tuesday.
        Participants discussed the quarterly report and budget allocations.
        The next meeting will be held next month.
      `;
      
      const result = analyzer.detectBias(neutralText);

      expect(result.biasScore).toBeLessThan(0.5);
      expect(result.level).toBe('low');
    });
  });

  describe('assessContentQuality', () => {
    test('should rate well-structured content highly', () => {
      const qualityText = `
        This is a well-written article with proper structure and clear sentences.
        
        The content is organized into logical paragraphs with appropriate length.
        Each sentence conveys information clearly and concisely.
        
        The writing maintains professional standards throughout.
      `;
      
      const mockSentenceAnalysis = [
        { confidence: 0.8 },
        { confidence: 0.9 },
        { confidence: 0.7 },
        { confidence: 0.85 }
      ];
      
      const result = analyzer.assessContentQuality(qualityText, mockSentenceAnalysis);

      expect(result.score).toBeGreaterThan(0.5);
      expect(result.metrics.hasParagraphs).toBe(true);
      expect(result.metrics.hasProperPunctuation).toBe(true);
      expect(result.metrics.avgSentenceLength).toBeGreaterThan(5);
    });

    test('should rate poor quality content lower', () => {
      const poorText = 'bad text no punctuation very short sentences not good structure';
      
      const mockSentenceAnalysis = [
        { confidence: 0.3 },
        { confidence: 0.2 }
      ];
      
      const result = analyzer.assessContentQuality(poorText, mockSentenceAnalysis);

      expect(result.score).toBeLessThan(0.5);
      expect(result.level).toMatch(/poor|fair/);
      expect(result.metrics.hasProperPunctuation).toBe(false);
    });
  });

  describe('analyzeNewsArticle', () => {
    test('should perform complete news article analysis', async () => {
      const newsArticle = `
        BOSTON, March 15 - According to a new study published in Nature, researchers have discovered significant improvements in AI technology.
        
        The data shows a 25% increase in performance metrics compared to previous models.
        "This represents a major breakthrough in the field," said Dr. Sarah Johnson, lead researcher on the project.
        
        However, some critics argue that more extensive testing is needed before widespread adoption.
        The research team plans to conduct additional studies over the next six months.
      `;
      
      const result = await analyzer.analyzeNewsArticle(newsArticle, {
        sourceType: 'academic',
        sourceUrl: 'https://example.com/article'
      });

      expect(result).toHaveProperty('isNewsArticle');
      expect(result).toHaveProperty('factOpinionAnalysis');
      expect(result).toHaveProperty('credibilityAssessment');
      expect(result).toHaveProperty('biasAnalysis');
      expect(result).toHaveProperty('qualityIndicators');

      expect(result.isNewsArticle.isNews).toBe(true);
      expect(result.factOpinionAnalysis.ratio.total).toBeGreaterThan(0);
      expect(result.credibilityAssessment.score).toBeGreaterThan(0);
      expect(result.biasAnalysis.biasScore).toBeGreaterThanOrEqual(0);
      expect(result.qualityIndicators.score).toBeGreaterThan(0);
    });

    test('should handle analysis with minimal options', async () => {
      const simpleText = 'This is a simple news article about recent events.';
      
      const result = await analyzer.analyzeNewsArticle(simpleText);

      expect(result).toHaveProperty('isNewsArticle');
      expect(result).toHaveProperty('factOpinionAnalysis');
      expect(result.wordCount).toBeGreaterThan(0);
      expect(result.sentenceCount).toBeGreaterThan(0);
    });

    test('should handle analysis with custom options', async () => {
      const newsText = 'Breaking news: Officials announced new policies today.';
      
      const result = await analyzer.analyzeNewsArticle(newsText, {
        includeSourceCredibility: false,
        includeBiasDetection: false,
        includeFactOpinionRatio: false
      });

      expect(result).toHaveProperty('isNewsArticle');
      expect(result.factOpinionAnalysis.sentences).toBeUndefined();
    });

    test('should throw error for invalid input', async () => {
      await expect(analyzer.analyzeNewsArticle('')).rejects.toThrow('Text content is required');
      await expect(analyzer.analyzeNewsArticle(null)).rejects.toThrow('Text content is required');
      await expect(analyzer.analyzeNewsArticle('   ')).rejects.toThrow('Text content is required');
    });
  });

  describe('batchAnalyze', () => {
    test('should analyze multiple articles successfully', async () => {
      const articles = [
        'According to Reuters, the stock market rose 2% today.',
        'I think this movie is absolutely fantastic and amazing.',
        'The meeting was scheduled for next Tuesday at 3 PM.'
      ];
      
      const results = await analyzer.batchAnalyze(articles);

      expect(results).toHaveLength(3);
      expect(results[0]).toHaveProperty('index', 0);
      expect(results[0]).toHaveProperty('isNewsArticle');
      expect(results[1]).toHaveProperty('index', 1);
      expect(results[2]).toHaveProperty('index', 2);
    });

    test('should handle errors in batch processing', async () => {
      const articles = [
        'Valid news article text.',
        null, // This should cause an error
        'Another valid article.'
      ];
      
      const results = await analyzer.batchAnalyze(articles);

      expect(results).toHaveLength(3);
      expect(results[0]).not.toHaveProperty('error');
      expect(results[1]).toHaveProperty('error');
      expect(results[2]).not.toHaveProperty('error');
    });

    test('should handle custom source types in batch', async () => {
      const articles = [
        'Government announcement about new policies.',
        'Blog post with personal opinions.'
      ];
      
      const results = await analyzer.batchAnalyze(articles, {
        sourceTypes: ['government', 'blog']
      });

      expect(results).toHaveLength(2);
      expect(results[0].credibilityAssessment.factors.sourceType).toBe('government');
      expect(results[1].credibilityAssessment.factors.sourceType).toBe('blog');
    });
  });

  describe('helper methods', () => {
    test('getCredibilityLevel should return correct levels', () => {
      expect(analyzer.getCredibilityLevel(0.9)).toBe('high');
      expect(analyzer.getCredibilityLevel(0.7)).toBe('medium-high');
      expect(analyzer.getCredibilityLevel(0.5)).toBe('medium');
      expect(analyzer.getCredibilityLevel(0.3)).toBe('low-medium');
      expect(analyzer.getCredibilityLevel(0.1)).toBe('low');
    });

    test('getBiasLevel should return correct levels', () => {
      expect(analyzer.getBiasLevel(4)).toBe('high');
      expect(analyzer.getBiasLevel(2.5)).toBe('medium-high');
      expect(analyzer.getBiasLevel(1.5)).toBe('medium');
      expect(analyzer.getBiasLevel(0.7)).toBe('low-medium');
      expect(analyzer.getBiasLevel(0.3)).toBe('low');
    });

    test('getQualityLevel should return correct levels', () => {
      expect(analyzer.getQualityLevel(0.9)).toBe('excellent');
      expect(analyzer.getQualityLevel(0.7)).toBe('good');
      expect(analyzer.getQualityLevel(0.5)).toBe('fair');
      expect(analyzer.getQualityLevel(0.3)).toBe('poor');
      expect(analyzer.getQualityLevel(0.1)).toBe('very-poor');
    });
  });

  describe('edge cases', () => {
    test('should handle very long text', async () => {
      const longText = 'This is a sentence. '.repeat(1000);
      
      const result = await analyzer.analyzeNewsArticle(longText);

      expect(result).toHaveProperty('wordCount');
      expect(result.wordCount).toBeGreaterThan(3000);
      expect(result.sentenceCount).toBe(1000);
    });

    test('should handle text with special characters', async () => {
      const specialText = 'According to the study, 50% of users prefer "smart" technology over traditional methods!';
      
      const result = await analyzer.analyzeNewsArticle(specialText);

      expect(result).toHaveProperty('factOpinionAnalysis');
      expect(result.factOpinionAnalysis.ratio.total).toBe(1);
    });

    test('should handle multilingual content gracefully', async () => {
      const mixedText = 'This is English text. Esto es texto en español. Back to English.';
      
      const result = await analyzer.analyzeNewsArticle(mixedText);

      expect(result).toHaveProperty('isNewsArticle');
      expect(result.sentenceCount).toBe(3);
    });

    test('should handle empty paragraphs and whitespace', async () => {
      const messyText = `
        
        This is the first paragraph.
        
        
        This is the second paragraph after empty lines.
        
        
      `;
      
      const result = await analyzer.analyzeNewsArticle(messyText);

      expect(result).toHaveProperty('qualityIndicators');
      expect(result.qualityIndicators.metrics.hasParagraphs).toBe(true);
    });
  });
});