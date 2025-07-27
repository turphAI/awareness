const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const referenceExtractor = require('../utils/referenceExtractor');
const Content = require('../models/Content');
const Reference = require('../models/Reference');

// Mock urlValidator
jest.mock('../../source-management/utils/urlValidator', () => ({
  isValidUrl: jest.fn().mockImplementation(url => {
    return url && url.startsWith('http');
  })
}));

describe('Reference Extractor', () => {
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
  });
  
  describe('extractReferences', () => {
    it('should extract references from article content', async () => {
      // Create test content
      const content = new Content({
        sourceId: new mongoose.Types.ObjectId(),
        url: 'https://example.com/article',
        title: 'Test Article',
        type: 'article',
        fullText: `
          <p>This is a test article with <a href="https://example.com/reference1">a link</a>.</p>
          <p>According to Smith, this is important.</p>
          <p>Another <a href="https://example.com/reference2">reference</a> is here.</p>
          <blockquote>This is a quote from someone.</blockquote>
          <p>Visit https://example.com/plainurl for more information.</p>
        `
      });
      
      await content.save();
      
      // Extract references
      const result = await referenceExtractor.extractReferences(content);
      
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
      
      // Check reference types
      const linkRefs = savedReferences.filter(ref => ref.referenceType === 'link');
      const quoteRefs = savedReferences.filter(ref => ref.referenceType === 'quote');
      const mentionRefs = savedReferences.filter(ref => ref.referenceType === 'mention');
      
      expect(linkRefs.length).toBeGreaterThan(0);
      expect(quoteRefs.length).toBeGreaterThan(0);
      expect(mentionRefs.length).toBeGreaterThan(0);
    });
    
    it('should extract references from paper content', async () => {
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
      
      // Extract references
      const result = await referenceExtractor.extractReferences(content);
      
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
      
      // Check reference types
      const citationRefs = savedReferences.filter(ref => ref.referenceType === 'citation');
      expect(citationRefs.length).toBeGreaterThan(0);
      
      // Check DOI reference
      const doiRef = savedReferences.find(ref => ref.doi === content.paperDOI);
      expect(doiRef).toBeDefined();
    });
    
    it('should extract references from media content', async () => {
      // Create test content
      const content = new Content({
        sourceId: new mongoose.Types.ObjectId(),
        url: 'https://example.com/podcast',
        title: 'Test Podcast',
        type: 'podcast',
        podcastTranscript: `
          Welcome to our podcast. Today we're discussing important topics.
          According to research by Johnson, this is significant.
          Check out our website at https://example.com/podcast-site for more information.
          Our guest today is @expert_user who will share insights.
        `,
        summary: `
          In this episode, we discuss important topics with experts.
          Visit https://example.com/episode-notes for show notes.
        `
      });
      
      await content.save();
      
      // Extract references
      const result = await referenceExtractor.extractReferences(content);
      
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
      
      // Check reference types
      const linkRefs = savedReferences.filter(ref => ref.referenceType === 'link');
      const mentionRefs = savedReferences.filter(ref => ref.referenceType === 'mention');
      
      expect(linkRefs.length).toBeGreaterThan(0);
      expect(mentionRefs.length).toBeGreaterThan(0);
    });
    
    it('should extract references from social content', async () => {
      // Create test content
      const content = new Content({
        sourceId: new mongoose.Types.ObjectId(),
        url: 'https://example.com/social-post',
        title: 'Test Social Post',
        type: 'social',
        fullText: `
          Check out this interesting article: https://example.com/article
          Thanks to @user1 and @user2 for the insights!
          #AI #MachineLearning #DataScience
        `
      });
      
      await content.save();
      
      // Extract references
      const result = await referenceExtractor.extractReferences(content);
      
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
      
      // Check reference types
      const linkRefs = savedReferences.filter(ref => ref.referenceType === 'link');
      const mentionRefs = savedReferences.filter(ref => ref.referenceType === 'mention');
      const relatedRefs = savedReferences.filter(ref => ref.referenceType === 'related');
      
      expect(linkRefs.length).toBeGreaterThan(0);
      expect(mentionRefs.length).toBeGreaterThan(0);
      expect(relatedRefs.length).toBeGreaterThan(0);
    });
    
    it('should handle errors gracefully', async () => {
      // Create test content with invalid data
      const content = new Content({
        sourceId: new mongoose.Types.ObjectId(),
        url: 'https://example.com/article',
        title: 'Test Article',
        type: 'article',
        fullText: null // This will cause errors in extraction
      });
      
      await content.save();
      
      // Extract references
      const result = await referenceExtractor.extractReferences(content);
      
      // Check result - should still succeed but with 0 references
      expect(result.success).toBe(true);
      expect(result.extractedCount).toBe(0);
      expect(result.savedCount).toBe(0);
    });
  });
  
  describe('resolveReference', () => {
    it('should resolve reference by URL', async () => {
      // Create test content
      const content = new Content({
        sourceId: new mongoose.Types.ObjectId(),
        url: 'https://example.com/target-article',
        title: 'Target Article',
        type: 'article'
      });
      
      await content.save();
      
      // Create test reference
      const reference = new Reference({
        sourceContentId: new mongoose.Types.ObjectId(),
        referenceType: 'link',
        url: 'https://example.com/target-article',
        title: 'Link to Target'
      });
      
      await reference.save();
      
      // Resolve reference
      const resolved = await referenceExtractor.resolveReference(reference);
      
      // Check result
      expect(resolved).toBe(true);
      
      // Check that reference was updated
      const updatedRef = await Reference.findById(reference._id);
      expect(updatedRef.resolved).toBe(true);
      expect(updatedRef.targetContentId.toString()).toBe(content._id.toString());
      expect(updatedRef.confidence).toBe(1.0);
    });
    
    it('should resolve reference by title similarity', async () => {
      // Create test content
      const content = new Content({
        sourceId: new mongoose.Types.ObjectId(),
        url: 'https://example.com/target-article',
        title: 'Machine Learning Fundamentals',
        type: 'article'
      });
      
      await content.save();
      
      // Create test reference with similar title
      const reference = new Reference({
        sourceContentId: new mongoose.Types.ObjectId(),
        referenceType: 'citation',
        title: 'Machine Learning Fundamentals: A Comprehensive Guide'
      });
      
      await reference.save();
      
      // Resolve reference
      const resolved = await referenceExtractor.resolveReference(reference);
      
      // Check result
      expect(resolved).toBe(true);
      
      // Check that reference was updated
      const updatedRef = await Reference.findById(reference._id);
      expect(updatedRef.resolved).toBe(true);
      expect(updatedRef.targetContentId.toString()).toBe(content._id.toString());
      expect(updatedRef.confidence).toBeGreaterThan(0.8);
    });
    
    it('should not resolve reference without matching content', async () => {
      // Create test reference with no matching content
      const reference = new Reference({
        sourceContentId: new mongoose.Types.ObjectId(),
        referenceType: 'link',
        url: 'https://example.com/nonexistent-article',
        title: 'Link to Nonexistent Article'
      });
      
      await reference.save();
      
      // Resolve reference
      const resolved = await referenceExtractor.resolveReference(reference);
      
      // Check result
      expect(resolved).toBe(false);
      
      // Check that reference was not resolved
      const updatedRef = await Reference.findById(reference._id);
      expect(updatedRef.resolved).toBe(false);
      expect(updatedRef.targetContentId).toBeNull();
    });
  });
  
  describe('processUnresolvedReferences', () => {
    it('should process unresolved references', async () => {
      // Create test content
      const content = new Content({
        sourceId: new mongoose.Types.ObjectId(),
        url: 'https://example.com/target-article',
        title: 'Target Article',
        type: 'article'
      });
      
      await content.save();
      
      // Create test references
      const references = [
        new Reference({
          sourceContentId: new mongoose.Types.ObjectId(),
          referenceType: 'link',
          url: 'https://example.com/target-article',
          title: 'Link to Target'
        }),
        new Reference({
          sourceContentId: new mongoose.Types.ObjectId(),
          referenceType: 'link',
          url: 'https://example.com/nonexistent-article',
          title: 'Link to Nonexistent Article'
        })
      ];
      
      await Promise.all(references.map(ref => ref.save()));
      
      // Process unresolved references
      const result = await referenceExtractor.processUnresolvedReferences();
      
      // Check result
      expect(result.success).toBe(true);
      expect(result.processed).toBe(2);
      expect(result.resolved).toBe(1);
      
      // Check that one reference was resolved
      const resolvedRef = await Reference.findById(references[0]._id);
      expect(resolvedRef.resolved).toBe(true);
      expect(resolvedRef.targetContentId.toString()).toBe(content._id.toString());
      
      // Check that the other reference was not resolved
      const unresolvedRef = await Reference.findById(references[1]._id);
      expect(unresolvedRef.resolved).toBe(false);
      expect(unresolvedRef.targetContentId).toBeNull();
    });
  });
  
  describe('normalizeReference', () => {
    it('should normalize reference URL', async () => {
      // Create test reference with URL that needs normalization
      const reference = new Reference({
        sourceContentId: new mongoose.Types.ObjectId(),
        referenceType: 'link',
        url: 'example.com/article/?utm_source=test&utm_medium=email',
        title: 'Test Article'
      });
      
      await reference.save();
      
      // Normalize reference
      const normalizedRef = await referenceExtractor.normalizeReference(reference);
      
      // Check that URL was normalized
      expect(normalizedRef.url).toBe('https://example.com/article');
    });
    
    it('should normalize author names', async () => {
      // Create test reference with author names that need normalization
      const reference = new Reference({
        sourceContentId: new mongoose.Types.ObjectId(),
        referenceType: 'citation',
        authors: ['Smith, John', 'J. Doe', 'A. B. Johnson'],
        title: 'Test Article'
      });
      
      await reference.save();
      
      // Normalize reference
      const normalizedRef = await referenceExtractor.normalizeReference(reference);
      
      // Check that author names were normalized
      expect(normalizedRef.authors).toContain('John Smith');
      expect(normalizedRef.authors).toContain('J. Doe');
      expect(normalizedRef.authors).toContain('A. B. Johnson');
    });
    
    it('should normalize DOI', async () => {
      // Create test reference with DOI that needs normalization
      const reference = new Reference({
        sourceContentId: new mongoose.Types.ObjectId(),
        referenceType: 'citation',
        doi: 'doi: 10.1234/test.123',
        title: 'Test Article'
      });
      
      await reference.save();
      
      // Normalize reference
      const normalizedRef = await referenceExtractor.normalizeReference(reference);
      
      // Check that DOI was normalized
      expect(normalizedRef.doi).toBe('10.1234/test.123');
    });
  });
});