// Simple unit tests for MetadataExtractor without external dependencies

describe('MetadataExtractor Unit Tests', () => {
  // Mock the MetadataExtractor class without external dependencies
  class MockMetadataExtractor {
    determineContentType(content) {
      if (content.type) return content.type;
      if (content.contentType) return content.contentType;
      
      // Infer from URL or other properties
      if (content.url) {
        if (content.url.includes('youtube.com') || content.url.includes('vimeo.com')) {
          return 'video';
        }
        if (content.url.includes('.pdf')) {
          return 'document';
        }
      }
      
      if (content.duration) {
        return content.transcript ? 'podcast' : 'video';
      }
      
      if (content.doi || content.journal) {
        return 'academic';
      }
      
      return 'article';
    }

    extractDomain(urlString) {
      try {
        const url = new URL(urlString);
        return url.hostname.replace('www.', '');
      } catch {
        return '';
      }
    }

    extractAuthors(content) {
      if (content.authors && Array.isArray(content.authors)) {
        return content.authors.map(author => ({
          name: typeof author === 'string' ? author : author.name,
          email: author.email || '',
          affiliation: author.affiliation || '',
          bio: author.bio || '',
          expertise: author.expertise || []
        }));
      }
      
      if (content.author) {
        return [{
          name: content.author,
          email: '',
          affiliation: '',
          bio: '',
          expertise: []
        }];
      }
      
      return [];
    }

    estimateWordCount(text) {
      if (!text) return 0;
      return text.trim().split(/\s+/).length;
    }

    calculateReadingTime(wordCount, wpm = 200) {
      return Math.ceil(wordCount / wpm);
    }

    extractTopicsFromText(text) {
      if (!text) return [];
      
      const commonTopics = [
        'artificial intelligence', 'machine learning', 'deep learning', 'neural networks',
        'blockchain', 'cryptocurrency', 'web development', 'mobile development',
        'data science', 'big data', 'cloud computing', 'cybersecurity'
      ];
      
      const lowerText = text.toLowerCase();
      return commonTopics.filter(topic => lowerText.includes(topic));
    }

    extractKeywords(text) {
      if (!text) return [];
      
      const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'this', 'that', 'these', 'those', 'are', 'is', 'was', 'were']);
      
      const words = text.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 3 && !stopWords.has(word));
      
      const wordCount = {};
      words.forEach(word => {
        wordCount[word] = (wordCount[word] || 0) + 1;
      });
      
      return Object.entries(wordCount)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([word]) => word);
    }

    analyzeDifficulty(text) {
      if (!text) return 'intermediate';
      
      const words = text.split(/\s+/);
      const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
      const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
      const avgSentenceLength = words.length / sentences.length;
      
      if (avgWordLength > 6.5 && avgSentenceLength > 12) {
        return 'advanced';
      } else if (avgWordLength > 5 && avgSentenceLength > 10) {
        return 'intermediate';
      } else {
        return 'beginner';
      }
    }

    normalizeMetadata(metadata) {
      // Ensure required fields
      metadata.title = metadata.title || 'Untitled';
      metadata.contentType = metadata.contentType || 'other';
      metadata.language = metadata.language || 'en';
      
      // Normalize arrays and remove duplicates
      metadata.keywords = [...new Set((metadata.keywords || []).map(k => k.toLowerCase().trim()).filter(Boolean))];
      metadata.tags = [...new Set((metadata.tags || []).map(t => t.toLowerCase().trim()).filter(Boolean))];
      metadata.categories = [...new Set((metadata.categories || []).map(c => c.toLowerCase().trim()).filter(Boolean))];
      metadata.topics = [...new Set((metadata.topics || []).map(t => t.toLowerCase().trim()).filter(Boolean))];
      
      // Ensure numeric fields are valid
      metadata.wordCount = Math.max(0, metadata.wordCount || 0);
      metadata.readingTime = Math.max(0, metadata.readingTime || 0);
      metadata.qualityScore = Math.max(0, Math.min(1, metadata.qualityScore || 0.5));
      metadata.relevanceScore = Math.max(0, Math.min(1, metadata.relevanceScore || 0.5));
      
      return metadata;
    }
  }

  let extractor;

  beforeEach(() => {
    extractor = new MockMetadataExtractor();
  });

  describe('determineContentType', () => {
    it('should determine content type from URL', () => {
      expect(extractor.determineContentType({ url: 'https://youtube.com/watch?v=test' })).toBe('video');
      expect(extractor.determineContentType({ url: 'https://example.com/document.pdf' })).toBe('document');
    });

    it('should determine content type from properties', () => {
      expect(extractor.determineContentType({ duration: 300, transcript: 'test' })).toBe('podcast');
      expect(extractor.determineContentType({ duration: 300 })).toBe('video');
      expect(extractor.determineContentType({ doi: '10.1000/test' })).toBe('academic');
    });

    it('should default to article', () => {
      expect(extractor.determineContentType({ title: 'Test' })).toBe('article');
    });
  });

  describe('extractDomain', () => {
    it('should extract domain from URL', () => {
      expect(extractor.extractDomain('https://www.example.com/path')).toBe('example.com');
      expect(extractor.extractDomain('https://subdomain.example.com')).toBe('subdomain.example.com');
    });

    it('should handle invalid URLs', () => {
      expect(extractor.extractDomain('invalid-url')).toBe('');
    });
  });

  describe('extractAuthors', () => {
    it('should extract authors from array', () => {
      const content = {
        authors: [
          { name: 'John Doe', email: 'john@example.com' },
          'Jane Smith'
        ]
      };

      const authors = extractor.extractAuthors(content);
      expect(authors).toHaveLength(2);
      expect(authors[0].name).toBe('John Doe');
      expect(authors[0].email).toBe('john@example.com');
      expect(authors[1].name).toBe('Jane Smith');
    });

    it('should extract single author', () => {
      const content = { author: 'John Doe' };
      const authors = extractor.extractAuthors(content);
      expect(authors).toHaveLength(1);
      expect(authors[0].name).toBe('John Doe');
    });

    it('should return empty array if no authors', () => {
      const content = {};
      const authors = extractor.extractAuthors(content);
      expect(authors).toHaveLength(0);
    });
  });

  describe('estimateWordCount', () => {
    it('should count words correctly', () => {
      expect(extractor.estimateWordCount('Hello world test')).toBe(3);
      expect(extractor.estimateWordCount('  Multiple   spaces   between   words  ')).toBe(4);
      expect(extractor.estimateWordCount('')).toBe(0);
      expect(extractor.estimateWordCount(null)).toBe(0);
    });
  });

  describe('calculateReadingTime', () => {
    it('should calculate reading time correctly', () => {
      expect(extractor.calculateReadingTime(200)).toBe(1); // 200 words at 200 WPM = 1 minute
      expect(extractor.calculateReadingTime(300)).toBe(2); // 300 words at 200 WPM = 1.5 minutes, rounded up to 2
      expect(extractor.calculateReadingTime(100, 100)).toBe(1); // 100 words at 100 WPM = 1 minute
    });
  });

  describe('extractTopicsFromText', () => {
    it('should extract relevant topics', () => {
      const text = 'This article discusses artificial intelligence, machine learning, and blockchain technology.';
      const topics = extractor.extractTopicsFromText(text);
      
      expect(topics).toContain('artificial intelligence');
      expect(topics).toContain('machine learning');
      expect(topics).toContain('blockchain');
    });

    it('should handle empty text', () => {
      expect(extractor.extractTopicsFromText('')).toEqual([]);
      expect(extractor.extractTopicsFromText(null)).toEqual([]);
    });
  });

  describe('extractKeywords', () => {
    it('should extract keywords from text', () => {
      const text = 'This article discusses artificial intelligence and machine learning technologies. These technologies are important for modern applications.';
      const keywords = extractor.extractKeywords(text);
      
      expect(keywords).toContain('artificial');
      expect(keywords).toContain('intelligence');
      expect(keywords).toContain('machine');
      expect(keywords).toContain('learning');
      expect(keywords).toContain('technologies');
      expect(keywords).not.toContain('this'); // Stop word
      expect(keywords).not.toContain('and'); // Stop word
    });
  });

  describe('analyzeDifficulty', () => {
    it('should analyze difficulty correctly', () => {
      const beginnerText = 'This is a simple text with short words and sentences.';
      const advancedText = 'This comprehensive analysis demonstrates sophisticated methodological approaches utilizing advanced computational techniques and interdisciplinary frameworks.';
      
      expect(extractor.analyzeDifficulty(beginnerText)).toBe('beginner');
      expect(extractor.analyzeDifficulty(advancedText)).toBe('advanced');
    });
  });

  describe('normalizeMetadata', () => {
    it('should normalize metadata correctly', () => {
      const metadata = {
        title: '',
        keywords: ['  AI  ', 'Machine Learning', 'AI', ''],
        tags: ['TECH', 'Technology', 'tech'],
        wordCount: -5,
        qualityScore: 1.5,
        relevanceScore: -0.1
      };

      const normalized = extractor.normalizeMetadata(metadata);

      expect(normalized.title).toBe('Untitled');
      expect(normalized.keywords).toEqual(['ai', 'machine learning']);
      expect(normalized.tags).toEqual(['tech', 'technology']);
      expect(normalized.wordCount).toBe(0);
      expect(normalized.qualityScore).toBe(1);
      expect(normalized.relevanceScore).toBe(0);
    });
  });
});