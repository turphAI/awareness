/**
 * Show Notes Analyzer Tests
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const showNotesAnalyzer = require('../utils/showNotesAnalyzer');
const Reference = require('../../content-discovery/models/Reference');
const Episode = require('../models/Episode');

describe('Show Notes Analyzer', () => {
  let mongoServer;
  
  beforeAll(async () => {
    // Set up in-memory MongoDB server
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
  });
  
  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });
  
  beforeEach(async () => {
    // Clear database collections before each test
    await Reference.deleteMany({});
    await Episode.deleteMany({});
  });
  
  describe('parseShowNotes', () => {
    it('should extract URLs from show notes', () => {
      const showNotes = `
        Check out this great paper: https://arxiv.org/abs/2301.12345
        Also see: https://example.com/article
        And this one: http://research.example.org/paper.pdf
      `;
      
      const references = showNotesAnalyzer.parseShowNotes(showNotes);
      
      const urlRefs = references.filter(ref => ref.type === 'link');
      expect(urlRefs).toHaveLength(3);
      expect(urlRefs[0].url).toBe('https://arxiv.org/abs/2301.12345');
      expect(urlRefs[1].url).toBe('https://example.com/article');
      expect(urlRefs[2].url).toBe('http://research.example.org/paper.pdf');
    });
    
    it('should extract quoted titles', () => {
      const showNotes = `
        We discuss "Attention Is All You Need" in this episode.
        Also mentioned: "Deep Learning for Natural Language Processing"
        Short quote: "Hi" should be ignored.
      `;
      
      const references = showNotesAnalyzer.parseShowNotes(showNotes);
      
      const citationRefs = references.filter(ref => ref.type === 'citation');
      expect(citationRefs).toHaveLength(2);
      expect(citationRefs[0].title).toBe('Attention Is All You Need');
      expect(citationRefs[1].title).toBe('Deep Learning for Natural Language Processing');
    });
    
    it('should extract author patterns', () => {
      const showNotes = `
        This paper by John Smith is interesting.
        The study by Jane Doe and Bob Wilson shows great results.
        Research by Alice Johnson demonstrates new techniques.
      `;
      
      const references = showNotesAnalyzer.parseShowNotes(showNotes);
      
      const mentionRefs = references.filter(ref => ref.type === 'mention');
      expect(mentionRefs).toHaveLength(3);
      expect(mentionRefs[0].authors).toEqual(['John Smith']);
      expect(mentionRefs[1].authors).toEqual(['Jane Doe', 'Bob Wilson']);
      expect(mentionRefs[2].authors).toEqual(['Alice Johnson']);
    });
    
    it('should extract DOI references', () => {
      const showNotes = `
        See the paper at doi: 10.1038/nature12373
        Also check doi:10.1126/science.1234567
      `;
      
      const references = showNotesAnalyzer.parseShowNotes(showNotes);
      
      const doiRefs = references.filter(ref => 
        ref.metadata && ref.metadata.doi
      );
      expect(doiRefs).toHaveLength(2);
      expect(doiRefs[0].url).toBe('https://doi.org/10.1038/nature12373');
      expect(doiRefs[1].url).toBe('https://doi.org/10.1126/science.1234567');
    });
    
    it('should extract arXiv references', () => {
      const showNotes = `
        Check out arxiv: 2301.12345
        Also see arxiv:1706.03762
      `;
      
      const references = showNotesAnalyzer.parseShowNotes(showNotes);
      
      const arxivRefs = references.filter(ref => 
        ref.metadata && ref.metadata.arxivId
      );
      expect(arxivRefs).toHaveLength(2);
      expect(arxivRefs[0].url).toBe('https://arxiv.org/abs/2301.12345');
      expect(arxivRefs[1].url).toBe('https://arxiv.org/abs/1706.03762');
    });
    
    it('should handle empty or invalid show notes', () => {
      expect(showNotesAnalyzer.parseShowNotes('')).toEqual([]);
      expect(showNotesAnalyzer.parseShowNotes(null)).toEqual([]);
      expect(showNotesAnalyzer.parseShowNotes(undefined)).toEqual([]);
      expect(showNotesAnalyzer.parseShowNotes(123)).toEqual([]);
    });
  });
  
  describe('crossReferenceWithTranscript', () => {
    it('should find matches between show notes and transcript references', async () => {
      // Create test episode
      const episode = new Episode({
        title: 'Test Episode',
        podcastId: new mongoose.Types.ObjectId(),
        guid: 'test-guid',
        url: 'https://example.com/episode',
        audioUrl: 'https://example.com/audio.mp3',
        publishDate: new Date()
      });
      await episode.save();
      
      // Create transcript references
      const transcriptRefs = [
        new Reference({
          sourceContentId: episode._id,
          referenceType: 'mention',
          title: 'Attention Is All You Need',
          authors: ['Vaswani', 'Shazeer'],
          url: 'https://arxiv.org/abs/1706.03762'
        }),
        new Reference({
          sourceContentId: episode._id,
          referenceType: 'citation',
          title: 'BERT Paper',
          authors: ['Devlin']
        })
      ];
      
      await Promise.all(transcriptRefs.map(ref => ref.save()));
      
      // Create show notes references
      const showNotesRefs = [
        {
          type: 'citation',
          title: 'Attention Is All You Need',
          authors: ['Vaswani', 'Shazeer'],
          url: 'https://arxiv.org/abs/1706.03762',
          context: 'Great paper on transformers'
        },
        {
          type: 'link',
          title: 'New Research',
          url: 'https://example.com/new-paper',
          context: 'Check this out'
        }
      ];
      
      const result = await showNotesAnalyzer.crossReferenceWithTranscript(
        episode._id.toString(),
        showNotesRefs
      );
      
      expect(result.summary.totalTranscriptReferences).toBe(2);
      expect(result.summary.totalShowNotesReferences).toBe(2);
      expect(result.summary.matchedReferences).toBe(1);
      expect(result.summary.newReferences).toBe(1);
      expect(result.summary.transcriptOnlyReferences).toBe(1);
      
      expect(result.matched).toHaveLength(1);
      expect(result.matched[0].matchType).toBe('exact_url');
      
      expect(result.newFromShowNotes).toHaveLength(1);
      expect(result.newFromShowNotes[0].title).toBe('New Research');
      
      expect(result.transcriptOnly).toHaveLength(1);
      expect(result.transcriptOnly[0].title).toBe('BERT Paper');
    });
    
    it('should handle episode with no transcript references', async () => {
      // Create test episode
      const episode = new Episode({
        title: 'Test Episode',
        podcastId: new mongoose.Types.ObjectId(),
        guid: 'test-guid',
        url: 'https://example.com/episode',
        audioUrl: 'https://example.com/audio.mp3',
        publishDate: new Date()
      });
      await episode.save();
      
      const showNotesRefs = [
        {
          type: 'link',
          title: 'Test Link',
          url: 'https://example.com/test',
          context: 'Test context'
        }
      ];
      
      const result = await showNotesAnalyzer.crossReferenceWithTranscript(
        episode._id.toString(),
        showNotesRefs
      );
      
      expect(result.summary.totalTranscriptReferences).toBe(0);
      expect(result.summary.totalShowNotesReferences).toBe(1);
      expect(result.summary.matchedReferences).toBe(0);
      expect(result.summary.newReferences).toBe(1);
      expect(result.summary.transcriptOnlyReferences).toBe(0);
    });
  });
  
  describe('analyzeEpisodeShowNotes', () => {
    it('should analyze episode with show notes successfully', async () => {
      // Create test episode with show notes
      const episode = new Episode({
        title: 'Test Episode',
        podcastId: new mongoose.Types.ObjectId(),
        guid: 'test-guid',
        url: 'https://example.com/episode',
        audioUrl: 'https://example.com/audio.mp3',
        publishDate: new Date(),
        showNotes: `
          In this episode we discuss:
          - "Attention Is All You Need" by Vaswani et al.
          - Check out https://arxiv.org/abs/1706.03762
          - Also see doi: 10.1038/nature12373
        `
      });
      await episode.save();
      
      // Create existing transcript reference
      const transcriptRef = new Reference({
        sourceContentId: episode._id,
        referenceType: 'mention',
        title: 'Attention Is All You Need',
        authors: ['Vaswani']
      });
      await transcriptRef.save();
      
      const result = await showNotesAnalyzer.analyzeEpisodeShowNotes(episode._id.toString());
      
      expect(result.success).toBe(true);
      expect(result.hasShowNotes).toBe(true);
      expect(result.extractedReferences.length).toBeGreaterThan(0);
      expect(result.crossReference.summary.matchedReferences).toBeGreaterThan(0);
      expect(result.savedNewReferences.length).toBeGreaterThan(0);
    });
    
    it('should handle episode without show notes', async () => {
      // Create test episode without show notes
      const episode = new Episode({
        title: 'Test Episode',
        podcastId: new mongoose.Types.ObjectId(),
        guid: 'test-guid',
        url: 'https://example.com/episode',
        audioUrl: 'https://example.com/audio.mp3',
        publishDate: new Date()
      });
      await episode.save();
      
      const result = await showNotesAnalyzer.analyzeEpisodeShowNotes(episode._id.toString());
      
      expect(result.success).toBe(false);
      expect(result.hasShowNotes).toBe(false);
      expect(result.message).toBe('Episode has no show notes');
    });
    
    it('should handle non-existent episode', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      
      await expect(
        showNotesAnalyzer.analyzeEpisodeShowNotes(nonExistentId)
      ).rejects.toThrow('Episode');
    });
  });
  
  describe('_calculateSimilarityScore', () => {
    it('should give high score for exact URL match', () => {
      const ref1 = {
        url: 'https://example.com/paper',
        title: 'Test Paper',
        authors: ['Smith']
      };
      
      const ref2 = {
        url: 'https://example.com/paper',
        title: 'Different Title',
        authors: ['Jones']
      };
      
      const score = showNotesAnalyzer._calculateSimilarityScore(ref1, ref2);
      expect(score).toBeGreaterThan(0.5);
    });
    
    it('should give high score for similar titles', () => {
      const ref1 = {
        title: 'Attention Is All You Need',
        authors: ['Vaswani']
      };
      
      const ref2 = {
        title: 'Attention Is All You Need',
        authors: ['Vaswani', 'Shazeer']
      };
      
      const score = showNotesAnalyzer._calculateSimilarityScore(ref1, ref2);
      expect(score).toBeGreaterThan(0.6);
    });
    
    it('should give low score for different references', () => {
      const ref1 = {
        title: 'Paper A',
        authors: ['Smith'],
        url: 'https://example.com/a'
      };
      
      const ref2 = {
        title: 'Paper B',
        authors: ['Jones'],
        url: 'https://example.com/b'
      };
      
      const score = showNotesAnalyzer._calculateSimilarityScore(ref1, ref2);
      expect(score).toBeLessThan(0.3);
    });
  });
  
  describe('_calculateTextSimilarity', () => {
    it('should calculate similarity for identical texts', () => {
      const text1 = 'This is a test document';
      const text2 = 'This is a test document';
      
      const similarity = showNotesAnalyzer._calculateTextSimilarity(text1, text2);
      expect(similarity).toBe(1);
    });
    
    it('should calculate similarity for partially similar texts', () => {
      const text1 = 'This is a test document about machine learning';
      const text2 = 'This is a different document about machine learning';
      
      const similarity = showNotesAnalyzer._calculateTextSimilarity(text1, text2);
      expect(similarity).toBeGreaterThan(0.5);
      expect(similarity).toBeLessThan(1);
    });
    
    it('should return 0 for completely different texts', () => {
      const text1 = 'Machine learning algorithms';
      const text2 = 'Cooking recipes today';
      
      const similarity = showNotesAnalyzer._calculateTextSimilarity(text1, text2);
      expect(similarity).toBeLessThan(0.2);
    });
    
    it('should handle empty or null texts', () => {
      expect(showNotesAnalyzer._calculateTextSimilarity('', 'test')).toBe(0);
      expect(showNotesAnalyzer._calculateTextSimilarity('test', '')).toBe(0);
      expect(showNotesAnalyzer._calculateTextSimilarity(null, 'test')).toBe(0);
      expect(showNotesAnalyzer._calculateTextSimilarity('test', null)).toBe(0);
    });
  });
  
  describe('_authorsAreSimilar', () => {
    it('should match identical author names', () => {
      expect(showNotesAnalyzer._authorsAreSimilar('John Smith', 'John Smith')).toBe(true);
    });
    
    it('should match when one name contains the other', () => {
      expect(showNotesAnalyzer._authorsAreSimilar('Smith', 'John Smith')).toBe(true);
      expect(showNotesAnalyzer._authorsAreSimilar('John Smith', 'Smith')).toBe(true);
    });
    
    it('should match same last names', () => {
      expect(showNotesAnalyzer._authorsAreSimilar('John Smith', 'Jane Smith')).toBe(true);
      expect(showNotesAnalyzer._authorsAreSimilar('A. Smith', 'B. Smith')).toBe(true);
    });
    
    it('should not match different authors', () => {
      expect(showNotesAnalyzer._authorsAreSimilar('John Smith', 'Jane Doe')).toBe(false);
      expect(showNotesAnalyzer._authorsAreSimilar('Smith', 'Jones')).toBe(false);
    });
    
    it('should handle empty or null authors', () => {
      expect(showNotesAnalyzer._authorsAreSimilar('', 'Smith')).toBe(false);
      expect(showNotesAnalyzer._authorsAreSimilar('Smith', '')).toBe(false);
      expect(showNotesAnalyzer._authorsAreSimilar(null, 'Smith')).toBe(false);
      expect(showNotesAnalyzer._authorsAreSimilar('Smith', null)).toBe(false);
    });
  });
  
  describe('_urlsAreSimilar', () => {
    it('should match identical URLs', () => {
      const url1 = 'https://example.com/paper';
      const url2 = 'https://example.com/paper';
      
      expect(showNotesAnalyzer._urlsAreSimilar(url1, url2)).toBe(true);
    });
    
    it('should match URLs with different protocols', () => {
      const url1 = 'http://example.com/paper';
      const url2 = 'https://example.com/paper';
      
      expect(showNotesAnalyzer._urlsAreSimilar(url1, url2)).toBe(true);
    });
    
    it('should match URLs with and without www', () => {
      const url1 = 'https://www.example.com/paper';
      const url2 = 'https://example.com/paper';
      
      expect(showNotesAnalyzer._urlsAreSimilar(url1, url2)).toBe(true);
    });
    
    it('should not match different URLs', () => {
      const url1 = 'https://example.com/paper1';
      const url2 = 'https://example.com/paper2';
      
      expect(showNotesAnalyzer._urlsAreSimilar(url1, url2)).toBe(false);
    });
  });
  
  describe('_looksLikeTitle', () => {
    it('should identify valid titles', () => {
      expect(showNotesAnalyzer._looksLikeTitle('Attention Is All You Need')).toBe(true);
      expect(showNotesAnalyzer._looksLikeTitle('Deep Learning for Natural Language Processing')).toBe(true);
      expect(showNotesAnalyzer._looksLikeTitle('BERT: Pre-training of Deep Bidirectional Transformers')).toBe(true);
    });
    
    it('should reject invalid titles', () => {
      expect(showNotesAnalyzer._looksLikeTitle('short')).toBe(false);
      expect(showNotesAnalyzer._looksLikeTitle('this is a sentence. with punctuation in middle')).toBe(false);
      expect(showNotesAnalyzer._looksLikeTitle('all lowercase text here')).toBe(false);
      expect(showNotesAnalyzer._looksLikeTitle('A'.repeat(250))).toBe(false); // Too long
    });
  });
});