const ExportManager = require('../utils/exportManager');

describe('ExportManager', () => {
  let exportManager;
  let mockContent;

  beforeEach(() => {
    exportManager = new ExportManager();
    
    mockContent = [
      {
        _id: '507f1f77bcf86cd799439011',
        title: 'Understanding AI Ethics',
        author: 'Dr. Jane Smith',
        url: 'https://example.com/ai-ethics',
        publishDate: new Date('2023-01-15'),
        discoveryDate: new Date('2023-01-16'),
        type: 'article',
        categories: ['AI', 'Ethics'],
        topics: ['Machine Learning', 'Bias'],
        summary: 'A comprehensive overview of ethical considerations in AI development.',
        keyInsights: [
          'AI systems can perpetuate existing biases',
          'Transparency is crucial for ethical AI'
        ],
        relevanceScore: 0.85,
        qualityScore: 0.9,
        readingTime: 15,
        wordCount: 3000,
        language: 'en',
        processed: true,
        outdated: false,
        readCount: 42,
        saveCount: 15,
        shareCount: 8
      },
      {
        _id: '507f1f77bcf86cd799439012',
        title: 'Large Language Models: A Survey',
        author: 'Prof. John Doe, Dr. Alice Johnson',
        url: 'https://example.com/llm-survey',
        publishDate: new Date('2023-02-20'),
        discoveryDate: new Date('2023-02-21'),
        type: 'paper',
        categories: ['AI', 'NLP'],
        topics: ['Language Models', 'Transformers'],
        summary: 'A comprehensive survey of recent advances in large language models.',
        keyInsights: [
          'Transformer architecture revolutionized NLP',
          'Scale is a key factor in model performance'
        ],
        relevanceScore: 0.95,
        qualityScore: 0.88,
        readingTime: 45,
        wordCount: 9000,
        language: 'en',
        processed: true,
        outdated: false,
        readCount: 128,
        saveCount: 67,
        shareCount: 23,
        paperDOI: '10.1000/182',
        paperAbstract: 'This paper surveys recent advances in large language models...',
        paperCitations: 156,
        paperAuthors: [
          { name: 'Prof. John Doe', affiliation: 'MIT' },
          { name: 'Dr. Alice Johnson', affiliation: 'Stanford' }
        ]
      }
    ];
  });

  describe('Constructor', () => {
    test('should initialize with supported formats and citation styles', () => {
      expect(exportManager.supportedFormats).toContain('json');
      expect(exportManager.supportedFormats).toContain('csv');
      expect(exportManager.supportedFormats).toContain('bibtex');
      expect(exportManager.citationStyles).toContain('apa');
      expect(exportManager.citationStyles).toContain('mla');
    });
  });

  describe('exportContent', () => {
    test('should export content in JSON format', async () => {
      const result = await exportManager.exportContent(mockContent, {
        format: 'json',
        citationStyle: 'apa'
      });

      expect(result.metadata.format).toBe('json');
      expect(result.metadata.citationStyle).toBe('apa');
      expect(result.metadata.itemCount).toBe(2);
      expect(typeof result.data).toBe('string');
      
      const parsedData = JSON.parse(result.data);
      expect(parsedData).toHaveLength(2);
      expect(parsedData[0].title).toBe('Understanding AI Ethics');
    });

    test('should export content in CSV format', async () => {
      const result = await exportManager.exportContent(mockContent, {
        format: 'csv',
        citationStyle: 'apa'
      });

      expect(result.metadata.format).toBe('csv');
      expect(result.extension).toBe('csv');
      expect(result.mimeType).toBe('text/csv');
      expect(result.data).toContain('title,author,url');
      expect(result.data).toContain('Understanding AI Ethics');
    });

    test('should export content in BibTeX format', async () => {
      const result = await exportManager.exportContent(mockContent, {
        format: 'bibtex',
        citationStyle: 'apa'
      });

      expect(result.metadata.format).toBe('bibtex');
      expect(result.extension).toBe('bib');
      expect(result.mimeType).toBe('application/x-bibtex');
      expect(result.data).toContain('@article{item1,');
      expect(result.data).toContain('title={Understanding AI Ethics}');
    });

    test('should export content in RIS format', async () => {
      const result = await exportManager.exportContent(mockContent, {
        format: 'ris',
        citationStyle: 'apa'
      });

      expect(result.metadata.format).toBe('ris');
      expect(result.extension).toBe('ris');
      expect(result.mimeType).toBe('application/x-research-info-systems');
      expect(result.data).toContain('TY  - JOUR');
      expect(result.data).toContain('TI  - Understanding AI Ethics');
    });

    test('should export content in Markdown format', async () => {
      const result = await exportManager.exportContent(mockContent, {
        format: 'markdown',
        citationStyle: 'apa'
      });

      expect(result.metadata.format).toBe('markdown');
      expect(result.extension).toBe('md');
      expect(result.mimeType).toBe('text/markdown');
      expect(result.data).toContain('# Exported Content');
      expect(result.data).toContain('## 1. Understanding AI Ethics');
    });

    test('should export content in HTML format', async () => {
      const result = await exportManager.exportContent(mockContent, {
        format: 'html',
        citationStyle: 'apa'
      });

      expect(result.metadata.format).toBe('html');
      expect(result.extension).toBe('html');
      expect(result.mimeType).toBe('text/html');
      expect(result.data).toContain('<!DOCTYPE html>');
      expect(result.data).toContain('<title>Exported Content');
    });

    test('should throw error for unsupported format', async () => {
      await expect(
        exportManager.exportContent(mockContent, { format: 'unsupported' })
      ).rejects.toThrow('Unsupported export format: unsupported');
    });

    test('should throw error for unsupported citation style', async () => {
      await expect(
        exportManager.exportContent(mockContent, { citationStyle: 'unsupported' })
      ).rejects.toThrow('Unsupported citation style: unsupported');
    });
  });

  describe('prepareContentData', () => {
    test('should prepare content data with all options', async () => {
      const prepared = await exportManager.prepareContentData(mockContent, {
        includeMetadata: true,
        includeFullText: false,
        includeReferences: true,
        citationStyle: 'apa'
      });

      expect(prepared).toHaveLength(2);
      expect(prepared[0]).toHaveProperty('id');
      expect(prepared[0]).toHaveProperty('title');
      expect(prepared[0]).toHaveProperty('citation');
      expect(prepared[0]).toHaveProperty('metadata');
      expect(prepared[0]).not.toHaveProperty('fullText');
    });

    test('should include full text when requested', async () => {
      const contentWithFullText = [
        { ...mockContent[0], fullText: 'This is the full text content...' }
      ];

      const prepared = await exportManager.prepareContentData(contentWithFullText, {
        includeFullText: true,
        citationStyle: 'apa'
      });

      expect(prepared[0]).toHaveProperty('fullText');
      expect(prepared[0].fullText).toBe('This is the full text content...');
    });

    test('should include paper-specific metadata', async () => {
      const prepared = await exportManager.prepareContentData([mockContent[1]], {
        includeMetadata: true,
        citationStyle: 'apa'
      });

      expect(prepared[0].metadata).toHaveProperty('paperSpecific');
      expect(prepared[0].metadata.paperSpecific).toHaveProperty('doi');
      expect(prepared[0].metadata.paperSpecific).toHaveProperty('abstract');
    });
  });

  describe('generateCitation', () => {
    test('should generate APA citation', () => {
      const citation = exportManager.generateCitation(mockContent[0], 'apa');
      expect(citation).toContain('Dr. Jane Smith (2023)');
      expect(citation).toContain('Understanding AI Ethics');
      expect(citation).toContain('Retrieved from');
    });

    test('should generate MLA citation', () => {
      const citation = exportManager.generateCitation(mockContent[0], 'mla');
      expect(citation).toContain('Dr. Jane Smith');
      expect(citation).toContain('"Understanding AI Ethics."');
      expect(citation).toContain('Web.');
    });

    test('should generate Chicago citation', () => {
      const citation = exportManager.generateCitation(mockContent[0], 'chicago');
      expect(citation).toContain('Dr. Jane Smith');
      expect(citation).toContain('"Understanding AI Ethics."');
      expect(citation).toContain('Accessed');
    });

    test('should generate IEEE citation', () => {
      const citation = exportManager.generateCitation(mockContent[0], 'ieee');
      expect(citation).toContain('Dr. Jane Smith');
      expect(citation).toContain('"Understanding AI Ethics,"');
      expect(citation).toContain('[Online]. Available:');
    });

    test('should generate Harvard citation', () => {
      const citation = exportManager.generateCitation(mockContent[0], 'harvard');
      expect(citation).toContain('Dr. Jane Smith 2023');
      expect(citation).toContain("'Understanding AI Ethics'");
      expect(citation).toContain('viewed');
    });

    test('should handle paper with DOI in APA style', () => {
      const citation = exportManager.generateCitation(mockContent[1], 'apa');
      expect(citation).toContain('https://doi.org/10.1000/182');
      expect(citation).not.toContain('Retrieved from');
    });

    test('should handle missing author', () => {
      const contentWithoutAuthor = { ...mockContent[0], author: null };
      const citation = exportManager.generateCitation(contentWithoutAuthor, 'apa');
      expect(citation).toContain('Unknown Author');
    });

    test('should handle missing publish date', () => {
      const contentWithoutDate = { ...mockContent[0], publishDate: null };
      const citation = exportManager.generateCitation(contentWithoutDate, 'apa');
      expect(citation).toContain('(n.d.)');
    });
  });

  describe('getBibTeXEntryType', () => {
    test('should return correct BibTeX entry types', () => {
      expect(exportManager.getBibTeXEntryType('article')).toBe('article');
      expect(exportManager.getBibTeXEntryType('paper')).toBe('article');
      expect(exportManager.getBibTeXEntryType('book')).toBe('book');
      expect(exportManager.getBibTeXEntryType('podcast')).toBe('misc');
      expect(exportManager.getBibTeXEntryType('unknown')).toBe('misc');
    });
  });

  describe('getRISEntryType', () => {
    test('should return correct RIS entry types', () => {
      expect(exportManager.getRISEntryType('article')).toBe('JOUR');
      expect(exportManager.getRISEntryType('paper')).toBe('JOUR');
      expect(exportManager.getRISEntryType('book')).toBe('BOOK');
      expect(exportManager.getRISEntryType('podcast')).toBe('SOUND');
      expect(exportManager.getRISEntryType('video')).toBe('VIDEO');
      expect(exportManager.getRISEntryType('unknown')).toBe('GEN');
    });
  });

  describe('escapeHtml', () => {
    test('should escape HTML special characters', () => {
      const input = '<script>alert("test")</script> & "quotes"';
      const escaped = exportManager.escapeHtml(input);
      expect(escaped).toBe('&lt;script&gt;alert(&quot;test&quot;)&lt;/script&gt; &amp; &quot;quotes&quot;');
    });

    test('should handle non-string input', () => {
      expect(exportManager.escapeHtml(123)).toBe(123);
      expect(exportManager.escapeHtml(null)).toBe(null);
    });
  });

  describe('getSupportedFormats', () => {
    test('should return array of supported formats', () => {
      const formats = exportManager.getSupportedFormats();
      expect(Array.isArray(formats)).toBe(true);
      expect(formats).toContain('json');
      expect(formats).toContain('csv');
      expect(formats).toContain('bibtex');
    });
  });

  describe('getSupportedCitationStyles', () => {
    test('should return array of supported citation styles', () => {
      const styles = exportManager.getSupportedCitationStyles();
      expect(Array.isArray(styles)).toBe(true);
      expect(styles).toContain('apa');
      expect(styles).toContain('mla');
      expect(styles).toContain('chicago');
    });
  });

  describe('CSV Export Edge Cases', () => {
    test('should handle empty content array', async () => {
      const result = await exportManager.exportToCSV([]);
      expect(result.data).toBe('');
      expect(result.size).toBe(0);
    });

    test('should handle content with special characters in CSV', async () => {
      const specialContent = [{
        title: 'Title with "quotes" and, commas',
        summary: 'Summary with\nnewlines'
      }];

      const result = await exportManager.exportToCSV(specialContent);
      expect(result.data).toContain('"Title with ""quotes"" and, commas"');
      expect(result.data).toContain('"Summary with\nnewlines"');
    });

    test('should handle arrays in CSV export', async () => {
      const contentWithArrays = [{
        title: 'Test Title',
        categories: ['AI', 'ML', 'Ethics'],
        topics: ['Deep Learning']
      }];

      const result = await exportManager.exportToCSV(contentWithArrays);
      expect(result.data).toContain('AI; ML; Ethics');
      expect(result.data).toContain('Deep Learning');
    });
  });

  describe('Format-specific Content Handling', () => {
    test('should handle podcast-specific fields in metadata', async () => {
      const podcastContent = [{
        ...mockContent[0],
        type: 'podcast',
        podcastEpisodeNumber: 42,
        podcastDuration: 3600
      }];

      const prepared = await exportManager.prepareContentData(podcastContent, {
        includeMetadata: true,
        citationStyle: 'apa'
      });

      expect(prepared[0].metadata).toHaveProperty('podcastSpecific');
      expect(prepared[0].metadata.podcastSpecific.episodeNumber).toBe(42);
      expect(prepared[0].metadata.podcastSpecific.duration).toBe(3600);
    });

    test('should handle video-specific fields in metadata', async () => {
      const videoContent = [{
        ...mockContent[0],
        type: 'video',
        videoDuration: 1800
      }];

      const prepared = await exportManager.prepareContentData(videoContent, {
        includeMetadata: true,
        citationStyle: 'apa'
      });

      expect(prepared[0].metadata).toHaveProperty('videoSpecific');
      expect(prepared[0].metadata.videoSpecific.duration).toBe(1800);
    });
  });
});