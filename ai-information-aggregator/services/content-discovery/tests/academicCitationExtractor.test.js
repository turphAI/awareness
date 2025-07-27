const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const academicCitationExtractor = require('../utils/academicCitationExtractor');
const Content = require('../models/Content');
const Reference = require('../models/Reference');
const axios = require('axios');

// Mock axios
jest.mock('axios');

describe('Academic Citation Extractor', () => {
  let mongoServer;
  
  // Connect to test database before tests
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
  });
  
  // Clear test database after tests
  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
  });
  
  // Clear collections before each test
  beforeEach(async () => {
    await Content.deleteMany({});
    await Reference.deleteMany({});
    jest.clearAllMocks();
  });
  
  describe('extractCitations', () => {
    it('should extract citations from academic paper with DOI', async () => {
      // Mock CrossRef API response
      axios.get.mockResolvedValueOnce({
        data: {
          message: {
            reference: [
              {
                'unstructured': 'Smith, J. (2020). Test paper title. Journal of Testing, 10(2), 123-145.',
                'DOI': '10.1234/test.123'
              },
              {
                'author': 'Johnson, A.',
                'year': '2019',
                'article-title': 'Another test paper',
                'journal-title': 'Conference on Testing',
                'first-page': '45',
                'last-page': '67'
              }
            ]
          }
        }
      });
      
      // Create test content
      const content = new Content({
        sourceId: new mongoose.Types.ObjectId(),
        url: 'https://example.com/paper',
        title: 'Test Academic Paper',
        type: 'paper',
        paperDOI: '10.1234/test.123',
        paperAbstract: `
          This is a test abstract with citations [1] and [Smith et al., 2020].
          Another citation is (Johnson, 2019).
        `,
        fullText: `
          This is a test paper with citations [1] and [Smith et al., 2020].
          Another citation is (Johnson, 2019).
          
          References:
          1. Smith, J. (2020). Test paper title. Journal of Testing, 10(2), 123-145.
          2. Johnson, A. (2019). Another test paper. Conference on Testing, 45-67.
        `
      });
      
      await content.save();
      
      // Extract citations
      const result = await academicCitationExtractor.extractCitations(content);
      
      // Check result
      expect(result.success).toBe(true);
      expect(result.extractedCount).toBeGreaterThan(0);
      expect(result.savedCount).toBeGreaterThan(0);
      
      // Check that references were saved
      const savedReferences = await Reference.find({ sourceContentId: content._id });
      expect(savedReferences.length).toBeGreaterThan(0);
      
      // Check that content was updated with reference IDs
      const updatedContent = await Content.findById(content._id);
      expect(updatedContent.references.length).toBeGreaterThan(0);
      
      // Check that CrossRef API was called
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('10.1234/test.123'),
        expect.any(Object)
      );
    });
    
    it('should extract citations from academic paper without DOI', async () => {
      // Create test content
      const content = new Content({
        sourceId: new mongoose.Types.ObjectId(),
        url: 'https://example.com/paper',
        title: 'Test Academic Paper',
        type: 'paper',
        paperAbstract: `
          This is a test abstract with citations [1] and [Smith et al., 2020].
          Another citation is (Johnson, 2019).
        `,
        fullText: `
          This is a test paper with citations [1] and [Smith et al., 2020].
          Another citation is (Johnson, 2019).
          
          References:
          1. Smith, J. (2020). Test paper title. Journal of Testing, 10(2), 123-145.
          2. Johnson, A. (2019). Another test paper. Conference on Testing, 45-67.
        `
      });
      
      await content.save();
      
      // Extract citations
      const result = await academicCitationExtractor.extractCitations(content);
      
      // Check result
      expect(result.success).toBe(true);
      expect(result.extractedCount).toBeGreaterThan(0);
      expect(result.savedCount).toBeGreaterThan(0);
      
      // Check that references were saved
      const savedReferences = await Reference.find({ sourceContentId: content._id });
      expect(savedReferences.length).toBeGreaterThan(0);
      
      // Check that content was updated with reference IDs
      const updatedContent = await Content.findById(content._id);
      expect(updatedContent.references.length).toBeGreaterThan(0);
      
      // Check that CrossRef API was not called
      expect(axios.get).not.toHaveBeenCalled();
    });
    
    it('should handle non-academic paper content', async () => {
      // Create test content
      const content = new Content({
        sourceId: new mongoose.Types.ObjectId(),
        url: 'https://example.com/article',
        title: 'Test Article',
        type: 'article',
        fullText: 'This is a regular article, not an academic paper.'
      });
      
      await content.save();
      
      // Extract citations
      const result = await academicCitationExtractor.extractCitations(content);
      
      // Check result
      expect(result.success).toBe(false);
      expect(result.error).toBe('Content is not an academic paper');
    });
    
    it('should handle errors gracefully', async () => {
      // Create invalid content (missing required fields)
      const content = {
        _id: new mongoose.Types.ObjectId(),
        type: 'paper',
        // Missing required fields
        save: jest.fn().mockRejectedValue(new Error('Validation error'))
      };
      
      // Extract citations
      const result = await academicCitationExtractor.extractCitations(content);
      
      // Check result
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
  
  describe('processAcademicPapers', () => {
    it('should process multiple academic papers', async () => {
      // Create test papers
      const papers = [
        new Content({
          sourceId: new mongoose.Types.ObjectId(),
          url: 'https://example.com/paper1',
          title: 'Test Paper 1',
          type: 'paper',
          processed: false,
          fullText: `
            This is a test paper with citation [1].
            
            References:
            1. Smith, J. (2020). Test paper title. Journal of Testing, 10(2), 123-145.
          `
        }),
        new Content({
          sourceId: new mongoose.Types.ObjectId(),
          url: 'https://example.com/paper2',
          title: 'Test Paper 2',
          type: 'paper',
          processed: false,
          fullText: `
            This is another test paper with citation (Johnson, 2019).
            
            References:
            Johnson, A. (2019). Another test paper. Conference on Testing, 45-67.
          `
        })
      ];
      
      await Promise.all(papers.map(paper => paper.save()));
      
      // Process papers
      const result = await academicCitationExtractor.processAcademicPapers();
      
      // Check result
      expect(result.success).toBe(true);
      expect(result.processed).toBe(2);
      expect(result.succeeded).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.totalExtracted).toBeGreaterThan(0);
      expect(result.totalSaved).toBeGreaterThan(0);
      
      // Check that references were saved
      const savedReferences = await Reference.find();
      expect(savedReferences.length).toBeGreaterThan(0);
    });
    
    it('should handle errors when processing papers', async () => {
      // Mock Content.find to return papers that will cause errors
      jest.spyOn(Content, 'find').mockResolvedValueOnce([
        {
          _id: new mongoose.Types.ObjectId(),
          type: 'paper',
          // Missing required fields
          save: jest.fn().mockRejectedValue(new Error('Validation error'))
        }
      ]);
      
      // Process papers
      const result = await academicCitationExtractor.processAcademicPapers();
      
      // Check result
      expect(result.success).toBe(true);
      expect(result.processed).toBe(1);
      expect(result.succeeded).toBe(0);
      expect(result.failed).toBe(1);
    });
  });
});