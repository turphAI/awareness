/**
 * Basic Export Functionality Tests
 * Tests the core export functionality without complex dependencies
 */

describe('Export Functionality - Basic Tests', () => {
  describe('ExportManager Integration', () => {
    test('should be able to create ExportManager instance', () => {
      const ExportManager = require('../utils/exportManager');
      const exportManager = new ExportManager();
      
      expect(exportManager).toBeDefined();
      expect(exportManager.supportedFormats).toContain('json');
      expect(exportManager.citationStyles).toContain('apa');
    });

    test('should export simple content to JSON', async () => {
      const ExportManager = require('../utils/exportManager');
      const exportManager = new ExportManager();
      
      const mockContent = [{
        _id: '507f1f77bcf86cd799439011',
        title: 'Test Article',
        author: 'Test Author',
        url: 'https://example.com/test',
        publishDate: new Date('2023-01-01'),
        type: 'article',
        categories: ['AI'],
        summary: 'Test summary'
      }];

      const result = await exportManager.exportContent(mockContent, {
        format: 'json',
        citationStyle: 'apa'
      });

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('metadata');
      expect(result.metadata.format).toBe('json');
      expect(result.metadata.itemCount).toBe(1);
      
      const parsedData = JSON.parse(result.data);
      expect(parsedData).toHaveLength(1);
      expect(parsedData[0].title).toBe('Test Article');
      expect(parsedData[0].citation).toContain('Test Author');
    });

    test('should export content to CSV format', async () => {
      const ExportManager = require('../utils/exportManager');
      const exportManager = new ExportManager();
      
      const mockContent = [{
        _id: '507f1f77bcf86cd799439011',
        title: 'Test Article',
        author: 'Test Author',
        url: 'https://example.com/test',
        type: 'article'
      }];

      const result = await exportManager.exportContent(mockContent, {
        format: 'csv',
        citationStyle: 'apa'
      });

      expect(result.extension).toBe('csv');
      expect(result.mimeType).toBe('text/csv');
      expect(result.data).toContain('title,author,url');
      expect(result.data).toContain('Test Article');
    });

    test('should export content to BibTeX format', async () => {
      const ExportManager = require('../utils/exportManager');
      const exportManager = new ExportManager();
      
      const mockContent = [{
        _id: '507f1f77bcf86cd799439011',
        title: 'Test Paper',
        author: 'Dr. Test Author',
        url: 'https://example.com/paper',
        publishDate: new Date('2023-01-01'),
        type: 'paper'
      }];

      const result = await exportManager.exportContent(mockContent, {
        format: 'bibtex',
        citationStyle: 'apa'
      });

      expect(result.extension).toBe('bib');
      expect(result.mimeType).toBe('application/x-bibtex');
      expect(result.data).toContain('@article{item1,');
      expect(result.data).toContain('title={Test Paper}');
      expect(result.data).toContain('author={Dr. Test Author}');
    });

    test('should handle different citation styles', async () => {
      const ExportManager = require('../utils/exportManager');
      const exportManager = new ExportManager();
      
      const mockContent = [{
        title: 'Test Article',
        author: 'Test Author',
        url: 'https://example.com/test',
        publishDate: new Date('2023-01-01')
      }];

      // Test APA citation
      const apaCitation = exportManager.generateCitation(mockContent[0], 'apa');
      expect(apaCitation).toContain('Test Author');
      expect(apaCitation).toContain('Retrieved from');

      // Test MLA citation
      const mlaCitation = exportManager.generateCitation(mockContent[0], 'mla');
      expect(mlaCitation).toContain('Test Author');
      expect(mlaCitation).toContain('"Test Article."');
      expect(mlaCitation).toContain('Web.');

      // Test Chicago citation
      const chicagoCitation = exportManager.generateCitation(mockContent[0], 'chicago');
      expect(chicagoCitation).toContain('Test Author');
      expect(chicagoCitation).toContain('"Test Article."');
      expect(chicagoCitation).toContain('Accessed');
    });

    test('should handle content with metadata', async () => {
      const ExportManager = require('../utils/exportManager');
      const exportManager = new ExportManager();
      
      const mockContent = [{
        _id: '507f1f77bcf86cd799439011',
        title: 'Test Paper',
        author: 'Dr. Test Author',
        type: 'paper',
        relevanceScore: 0.85,
        qualityScore: 0.9,
        readingTime: 15,
        wordCount: 3000,
        paperDOI: '10.1000/test',
        paperAbstract: 'This is a test abstract',
        paperAuthors: [
          { name: 'Dr. Test Author', affiliation: 'Test University' }
        ]
      }];

      const prepared = await exportManager.prepareContentData(mockContent, {
        includeMetadata: true,
        citationStyle: 'apa'
      });

      expect(prepared[0]).toHaveProperty('metadata');
      expect(prepared[0].metadata).toHaveProperty('relevanceScore', 0.85);
      expect(prepared[0].metadata).toHaveProperty('paperSpecific');
      expect(prepared[0].metadata.paperSpecific).toHaveProperty('doi', '10.1000/test');
    });

    test('should handle empty content array', async () => {
      const ExportManager = require('../utils/exportManager');
      const exportManager = new ExportManager();
      
      const result = await exportManager.exportContent([], {
        format: 'json',
        citationStyle: 'apa'
      });

      expect(result.metadata.itemCount).toBe(0);
      const parsedData = JSON.parse(result.data);
      expect(parsedData).toHaveLength(0);
    });

    test('should handle special characters in content', async () => {
      const ExportManager = require('../utils/exportManager');
      const exportManager = new ExportManager();
      
      const mockContent = [{
        title: 'Article with "quotes" and <tags>',
        author: 'Author & Co.',
        summary: 'Summary with\nnewlines and special chars: <>&"'
      }];

      // Test HTML escaping
      const htmlResult = await exportManager.exportContent(mockContent, {
        format: 'html',
        citationStyle: 'apa'
      });
      
      expect(htmlResult.data).toContain('&quot;quotes&quot;');
      expect(htmlResult.data).toContain('&lt;tags&gt;');
      expect(htmlResult.data).toContain('&amp;');

      // Test CSV escaping
      const csvResult = await exportManager.exportContent(mockContent, {
        format: 'csv',
        citationStyle: 'apa'
      });
      
      expect(csvResult.data).toContain('"Article with ""quotes"" and <tags>"');
    });

    test('should validate supported formats and citation styles', () => {
      const ExportManager = require('../utils/exportManager');
      const exportManager = new ExportManager();
      
      const formats = exportManager.getSupportedFormats();
      const styles = exportManager.getSupportedCitationStyles();
      
      expect(formats).toEqual(['json', 'csv', 'bibtex', 'ris', 'markdown', 'html']);
      expect(styles).toEqual(['apa', 'mla', 'chicago', 'ieee', 'harvard']);
    });

    test('should throw error for unsupported format', async () => {
      const ExportManager = require('../utils/exportManager');
      const exportManager = new ExportManager();
      
      await expect(
        exportManager.exportContent([], { format: 'unsupported' })
      ).rejects.toThrow('Unsupported export format: unsupported');
    });

    test('should throw error for unsupported citation style', async () => {
      const ExportManager = require('../utils/exportManager');
      const exportManager = new ExportManager();
      
      await expect(
        exportManager.exportContent([], { citationStyle: 'unsupported' })
      ).rejects.toThrow('Unsupported citation style: unsupported');
    });
  });

  describe('Export Routes Configuration', () => {
    test('should have export routes defined', () => {
      const exportRoutes = require('../routes/export');
      expect(exportRoutes).toBeDefined();
    });

    test('should have export controller defined', () => {
      const exportController = require('../controllers/exportController');
      expect(exportController).toBeDefined();
      expect(typeof exportController.getExportOptions).toBe('function');
      expect(typeof exportController.exportContentByIds).toBe('function');
      expect(typeof exportController.exportCollection).toBe('function');
      expect(typeof exportController.exportSearchResults).toBe('function');
      expect(typeof exportController.exportUserSavedContent).toBe('function');
      expect(typeof exportController.previewExport).toBe('function');
    });
  });

  describe('Citation Generation Edge Cases', () => {
    test('should handle missing author gracefully', () => {
      const ExportManager = require('../utils/exportManager');
      const exportManager = new ExportManager();
      
      const content = {
        title: 'Test Article',
        url: 'https://example.com/test',
        publishDate: new Date('2023-01-01')
      };

      const citation = exportManager.generateCitation(content, 'apa');
      expect(citation).toContain('Unknown Author');
    });

    test('should handle missing publish date gracefully', () => {
      const ExportManager = require('../utils/exportManager');
      const exportManager = new ExportManager();
      
      const content = {
        title: 'Test Article',
        author: 'Test Author',
        url: 'https://example.com/test'
      };

      const citation = exportManager.generateCitation(content, 'apa');
      expect(citation).toContain('(n.d.)');
    });

    test('should handle paper with DOI in APA style', () => {
      const ExportManager = require('../utils/exportManager');
      const exportManager = new ExportManager();
      
      const content = {
        title: 'Test Paper',
        author: 'Test Author',
        publishDate: new Date('2023-01-01'),
        type: 'paper',
        paperDOI: '10.1000/test'
      };

      const citation = exportManager.generateCitation(content, 'apa');
      expect(citation).toContain('https://doi.org/10.1000/test');
      expect(citation).not.toContain('Retrieved from');
    });
  });

  describe('Format-specific Features', () => {
    test('should generate proper BibTeX entry types', () => {
      const ExportManager = require('../utils/exportManager');
      const exportManager = new ExportManager();
      
      expect(exportManager.getBibTeXEntryType('article')).toBe('article');
      expect(exportManager.getBibTeXEntryType('paper')).toBe('article');
      expect(exportManager.getBibTeXEntryType('book')).toBe('book');
      expect(exportManager.getBibTeXEntryType('podcast')).toBe('misc');
      expect(exportManager.getBibTeXEntryType('unknown')).toBe('misc');
    });

    test('should generate proper RIS entry types', () => {
      const ExportManager = require('../utils/exportManager');
      const exportManager = new ExportManager();
      
      expect(exportManager.getRISEntryType('article')).toBe('JOUR');
      expect(exportManager.getRISEntryType('paper')).toBe('JOUR');
      expect(exportManager.getRISEntryType('book')).toBe('BOOK');
      expect(exportManager.getRISEntryType('podcast')).toBe('SOUND');
      expect(exportManager.getRISEntryType('video')).toBe('VIDEO');
      expect(exportManager.getRISEntryType('unknown')).toBe('GEN');
    });

    test('should handle markdown export with proper formatting', async () => {
      const ExportManager = require('../utils/exportManager');
      const exportManager = new ExportManager();
      
      const mockContent = [{
        title: 'Test Article',
        author: 'Test Author',
        publishDate: new Date('2023-01-01'),
        type: 'article',
        categories: ['AI', 'ML'],
        topics: ['Deep Learning'],
        summary: 'This is a test summary',
        keyInsights: ['Insight 1', 'Insight 2'],
        url: 'https://example.com/test'
      }];

      const result = await exportManager.exportContent(mockContent, {
        format: 'markdown',
        citationStyle: 'apa'
      });

      expect(result.data).toContain('# Exported Content');
      expect(result.data).toContain('## 1. Test Article');
      expect(result.data).toContain('**Author:** Test Author');
      expect(result.data).toContain('**Categories:** AI, ML');
      expect(result.data).toContain('**Topics:** Deep Learning');
      expect(result.data).toContain('**Key Insights:**');
      expect(result.data).toContain('- Insight 1');
      expect(result.data).toContain('- Insight 2');
    });
  });
});