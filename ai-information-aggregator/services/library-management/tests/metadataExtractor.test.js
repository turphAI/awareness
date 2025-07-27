const MetadataExtractor = require('../utils/metadataExtractor');
const axios = require('axios');

// Mock axios
jest.mock('axios');
const mockedAxios = axios;

describe('MetadataExtractor', () => {
  let extractor;

  beforeEach(() => {
    extractor = new MetadataExtractor();
    jest.clearAllMocks();
  });

  describe('extractMetadata', () => {
    it('should extract basic metadata from content', async () => {
      const content = {
        title: 'Test Article',
        description: 'A test article about AI',
        url: 'https://example.com/article',
        author: 'John Doe',
        publishedAt: '2024-01-01T00:00:00Z',
        content: 'This is a test article about artificial intelligence and machine learning.'
      };

      const metadata = await extractor.extractMetadata(content);

      expect(metadata.title).toBe('Test Article');
      expect(metadata.description).toBe('A test article about AI');
      expect(metadata.contentType).toBe('article');
      expect(metadata.source.url).toBe('https://example.com/article');
      expect(metadata.source.domain).toBe('example.com');
      expect(metadata.authors).toHaveLength(1);
      expect(metadata.authors[0].name).toBe('John Doe');
      expect(metadata.publishedAt).toEqual(new Date('2024-01-01T00:00:00Z'));
      expect(metadata.wordCount).toBeGreaterThan(0);
      expect(metadata.readingTime).toBeGreaterThan(0);
      expect(metadata.processing.status).toBe('completed');
    });

    it('should determine content type correctly', async () => {
      const videoContent = {
        title: 'Test Video',
        url: 'https://youtube.com/watch?v=test',
        duration: 300
      };

      const metadata = await extractor.extractMetadata(videoContent);
      expect(metadata.contentType).toBe('video');
    });

    it('should extract topics from content', async () => {
      const content = {
        title: 'AI and Machine Learning Guide',
        content: 'This article covers artificial intelligence, machine learning, and deep learning concepts.'
      };

      const metadata = await extractor.extractMetadata(content);
      expect(metadata.topics).toContain('artificial intelligence');
      expect(metadata.topics).toContain('machine learning');
      expect(metadata.topics).toContain('deep learning');
    });

    it('should handle content with no URL', async () => {
      const content = {
        title: 'Test Content',
        description: 'Content without URL'
      };

      const metadata = await extractor.extractMetadata(content);
      expect(metadata.source.url).toBe('');
      expect(metadata.source.domain).toBe('');
    });

    it('should handle extraction errors gracefully', async () => {
      const invalidContent = null;

      await expect(extractor.extractMetadata(invalidContent)).rejects.toThrow();
    });
  });

  describe('extractWebpageMetadata', () => {
    it('should extract metadata from webpage HTML', async () => {
      const htmlContent = `
        <html>
          <head>
            <title>Test Page</title>
            <meta name="description" content="Test description">
            <meta name="keywords" content="test, webpage, metadata">
            <meta name="author" content="Jane Doe">
            <meta property="og:title" content="OG Title">
            <meta property="og:description" content="OG Description">
            <meta property="article:published_time" content="2024-01-01T00:00:00Z">
          </head>
          <body>
            <h1>Main Heading</h1>
            <h2>Sub Heading</h2>
            <img src="test.jpg" alt="Test image">
            <video src="test.mp4"></video>
            <code>console.log('test');</code>
            <table><tr><td>Test</td></tr></table>
          </body>
        </html>
      `;

      mockedAxios.get.mockResolvedValue({ data: htmlContent });

      const content = { url: 'https://example.com/test' };
      const metadata = await extractor.extractWebpageMetadata(content);

      expect(metadata.title).toBe('OG Title');
      expect(metadata.description).toBe('OG Description');
      expect(metadata.keywords).toContain('test');
      expect(metadata.keywords).toContain('webpage');
      expect(metadata.authors).toHaveLength(1);
      expect(metadata.authors[0].name).toBe('Jane Doe');
      expect(metadata.publishedAt).toEqual(new Date('2024-01-01T00:00:00Z'));
      expect(metadata.structure.hasImages).toBe(true);
      expect(metadata.structure.hasVideos).toBe(true);
      expect(metadata.structure.hasCode).toBe(true);
      expect(metadata.structure.hasTables).toBe(true);
      expect(metadata.structure.headingCount).toBe(2);
    });

    it('should handle axios errors gracefully', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Network error'));

      const content = { url: 'https://example.com/test' };
      const metadata = await extractor.extractWebpageMetadata(content);

      // Should return empty metadata object without throwing
      expect(metadata).toEqual({});
    });

    it('should skip fetching when fetchContent is false', async () => {
      const content = { url: 'https://example.com/test' };
      const options = { fetchContent: false };
      
      const metadata = await extractor.extractWebpageMetadata(content, options);

      expect(mockedAxios.get).not.toHaveBeenCalled();
      expect(metadata).toEqual({});
    });
  });

  describe('extractAcademicMetadata', () => {
    it('should extract academic paper metadata', async () => {
      const content = {
        title: 'Research Paper',
        doi: '10.1000/test.doi',
        abstract: 'This paper discusses artificial intelligence and neural networks.',
        references: [
          {
            title: 'Reference 1',
            authors: ['Author 1', 'Author 2'],
            journal: 'Test Journal',
            year: 2023,
            doi: '10.1000/ref1.doi'
          }
        ]
      };

      const metadata = await extractor.extractAcademicMetadata(content);

      expect(metadata.customFields.doi).toBe('10.1000/test.doi');
      expect(metadata.difficulty).toBe('advanced');
      expect(metadata.citations).toHaveLength(1);
      expect(metadata.citations[0].title).toBe('Reference 1');
      expect(metadata.citations[0].authors).toEqual(['Author 1', 'Author 2']);
      expect(metadata.topics).toContain('artificial intelligence');
    });
  });

  describe('extractVideoMetadata', () => {
    it('should extract video metadata', async () => {
      const content = {
        title: 'Test Video',
        duration: 600, // 10 minutes
        transcript: 'This video covers artificial intelligence and machine learning topics.',
        chapters: [
          { title: 'Introduction', start: 0 },
          { title: 'Main Content', start: 300 }
        ]
      };

      const metadata = await extractor.extractVideoMetadata(content);

      expect(metadata.customFields.duration).toBe(600);
      expect(metadata.customFields.durationMinutes).toBe(10);
      expect(metadata.readingTime).toBe(10);
      expect(metadata.structure.hasVideos).toBe(true);
      expect(metadata.structure.hasAudio).toBe(true);
      expect(metadata.structure.hasImages).toBe(true); // Videos have thumbnails
      expect(metadata.structure.sectionCount).toBe(2);
      expect(metadata.topics).toContain('artificial intelligence');
      expect(metadata.topics).toContain('machine learning');
    });
  });

  describe('extractPodcastMetadata', () => {
    it('should extract podcast metadata', async () => {
      const content = {
        title: 'Test Podcast Episode',
        duration: 3600, // 1 hour
        episodeNumber: 42,
        seasonNumber: 2,
        transcript: 'This podcast episode discusses deep learning and neural networks.',
        segments: [
          { title: 'Intro', start: 0 },
          { title: 'Main Discussion', start: 300 },
          { title: 'Outro', start: 3300 }
        ]
      };

      const metadata = await extractor.extractPodcastMetadata(content);

      expect(metadata.customFields.duration).toBe(3600);
      expect(metadata.customFields.durationMinutes).toBe(60);
      expect(metadata.customFields.episodeNumber).toBe(42);
      expect(metadata.customFields.seasonNumber).toBe(2);
      expect(metadata.readingTime).toBe(60);
      expect(metadata.structure.hasAudio).toBe(true);
      expect(metadata.structure.hasVideos).toBe(false);
      expect(metadata.structure.sectionCount).toBe(3);
      expect(metadata.topics).toContain('deep learning');
    });
  });

  describe('extractDocumentMetadata', () => {
    it('should extract document metadata', async () => {
      const content = {
        title: 'Test Document',
        pageCount: 20,
        content: 'This document contains advanced information about blockchain and cryptocurrency technologies.'
      };

      const metadata = await extractor.extractDocumentMetadata(content);

      expect(metadata.customFields.pageCount).toBe(20);
      expect(metadata.readingTime).toBe(25); // 20 pages * 250 words / 200 WPM
      expect(metadata.topics).toContain('blockchain');
      expect(metadata.topics).toContain('cryptocurrency');
      expect(metadata.difficulty).toBe('advanced');
    });
  });

  describe('utility methods', () => {
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

    describe('quality score calculations', () => {
      let metadata, content;

      beforeEach(() => {
        metadata = {
          title: 'Test Article with Good Length',
          description: 'This is a comprehensive description that provides good context about the content.',
          authors: [{ name: 'John Doe' }],
          wordCount: 1000,
          source: { credibilityScore: 0.8 },
          structure: { headingCount: 5, sectionCount: 3 },
          topics: ['ai', 'machine learning'],
          keywords: ['keyword1', 'keyword2', 'keyword3', 'keyword4', 'keyword5', 'keyword6'],
          categories: ['technology'],
          engagement: { views: 2000, likes: 100, shares: 20, comments: 10, saves: 50 },
          publishedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) // 5 days ago
        };
        content = {};
      });

      it('should calculate quality score correctly', () => {
        const score = extractor.calculateQualityScore(metadata, content);
        expect(score).toBeGreaterThan(0.5);
        expect(score).toBeLessThanOrEqual(1);
      });

      it('should calculate relevance score correctly', () => {
        const score = extractor.calculateRelevanceScore(metadata, content);
        expect(score).toBeGreaterThan(0.5);
        expect(score).toBeLessThanOrEqual(1);
      });

      it('should calculate popularity score correctly', () => {
        const score = extractor.calculatePopularityScore(metadata, content);
        expect(score).toBeGreaterThan(0.3);
        expect(score).toBeLessThanOrEqual(1);
      });

      it('should calculate freshness score correctly', () => {
        const score = extractor.calculateFreshnessScore(metadata, content);
        expect(score).toBeGreaterThan(0.5); // 5 days old should be quite fresh
        expect(score).toBeLessThanOrEqual(1);
      });
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
      expect(normalized.processing.status).toBe('completed');
    });
  });
});