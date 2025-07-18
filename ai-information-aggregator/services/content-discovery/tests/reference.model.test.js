const mongoose = require('mongoose');
const Reference = require('../models/Reference');

// Connect to test database before tests
beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/test-db', {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
});

// Clear test database after tests
afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
});

// Clear references collection before each test
beforeEach(async () => {
  await Reference.deleteMany({});
});

describe('Reference Model', () => {
  describe('Schema', () => {
    it('should create a new reference successfully', async () => {
      const referenceData = {
        sourceContentId: new mongoose.Types.ObjectId(),
        referenceType: 'citation',
        title: 'Test Reference',
        url: 'https://example.com/reference',
        authors: ['Author 1', 'Author 2'],
        publishDate: new Date(),
        context: 'This is the context of the reference'
      };
      
      const reference = new Reference(referenceData);
      const savedReference = await reference.save();
      
      expect(savedReference._id).toBeDefined();
      expect(savedReference.sourceContentId.toString()).toBe(referenceData.sourceContentId.toString());
      expect(savedReference.referenceType).toBe(referenceData.referenceType);
      expect(savedReference.title).toBe(referenceData.title);
      expect(savedReference.url).toBe(referenceData.url);
      expect(savedReference.authors).toEqual(expect.arrayContaining(referenceData.authors));
      expect(savedReference.context).toBe(referenceData.context);
      expect(savedReference.resolved).toBe(false); // Default value
      expect(savedReference.targetContentId).toBeNull(); // Default value
      expect(savedReference.confidence).toBe(0.5); // Default value
    });
    
    it('should fail validation when URL is invalid', async () => {
      const referenceData = {
        sourceContentId: new mongoose.Types.ObjectId(),
        referenceType: 'link',
        url: 'invalid-url'
      };
      
      const reference = new Reference(referenceData);
      
      await expect(reference.save()).rejects.toThrow();
    });
    
    it('should fail validation when required fields are missing', async () => {
      const referenceData = {
        url: 'https://example.com/reference'
        // Missing sourceContentId and referenceType
      };
      
      const reference = new Reference(referenceData);
      
      await expect(reference.save()).rejects.toThrow();
    });
    
    it('should fail validation when reference type is invalid', async () => {
      const referenceData = {
        sourceContentId: new mongoose.Types.ObjectId(),
        referenceType: 'invalid-type', // Invalid type
        url: 'https://example.com/reference'
      };
      
      const reference = new Reference(referenceData);
      
      await expect(reference.save()).rejects.toThrow();
    });
  });
  
  describe('Reference Methods', () => {
    it('should mark reference as resolved', async () => {
      const referenceData = {
        sourceContentId: new mongoose.Types.ObjectId(),
        referenceType: 'citation',
        url: 'https://example.com/reference'
      };
      
      const reference = new Reference(referenceData);
      await reference.save();
      
      expect(reference.resolved).toBe(false);
      expect(reference.targetContentId).toBeNull();
      
      const targetContentId = new mongoose.Types.ObjectId();
      const confidence = 0.9;
      
      await reference.markAsResolved(targetContentId, confidence);
      
      expect(reference.resolved).toBe(true);
      expect(reference.targetContentId.toString()).toBe(targetContentId.toString());
      expect(reference.confidence).toBe(confidence);
      expect(reference.processingHistory).toHaveLength(1);
      expect(reference.processingHistory[0].stage).toBe('resolution');
      expect(reference.processingHistory[0].success).toBe(true);
    });
    
    it('should verify reference', async () => {
      const referenceData = {
        sourceContentId: new mongoose.Types.ObjectId(),
        referenceType: 'citation',
        url: 'https://example.com/reference'
      };
      
      const reference = new Reference(referenceData);
      await reference.save();
      
      expect(reference.verificationStatus).toBe('unverified');
      
      await reference.verify(true);
      
      expect(reference.verificationStatus).toBe('verified');
      expect(reference.processingHistory).toHaveLength(1);
      expect(reference.processingHistory[0].stage).toBe('verification');
      expect(reference.processingHistory[0].success).toBe(true);
      
      await reference.verify(false);
      
      expect(reference.verificationStatus).toBe('rejected');
      expect(reference.processingHistory).toHaveLength(2);
    });
    
    it('should update metadata', async () => {
      const referenceData = {
        sourceContentId: new mongoose.Types.ObjectId(),
        referenceType: 'citation',
        url: 'https://example.com/reference'
      };
      
      const reference = new Reference(referenceData);
      await reference.save();
      
      const metadata = {
        citationCount: '5',
        journal: 'Test Journal',
        year: '2023'
      };
      
      await reference.updateMetadata(metadata);
      
      expect(reference.metadata.get('citationCount')).toBe('5');
      expect(reference.metadata.get('journal')).toBe('Test Journal');
      expect(reference.metadata.get('year')).toBe('2023');
    });
    
    it('should record processing error', async () => {
      const referenceData = {
        sourceContentId: new mongoose.Types.ObjectId(),
        referenceType: 'citation',
        url: 'https://example.com/reference'
      };
      
      const reference = new Reference(referenceData);
      await reference.save();
      
      const errorMessage = 'Failed to resolve reference';
      await reference.recordError('resolution', errorMessage);
      
      expect(reference.processingHistory).toHaveLength(1);
      expect(reference.processingHistory[0].stage).toBe('resolution');
      expect(reference.processingHistory[0].success).toBe(false);
      expect(reference.processingHistory[0].error).toBe(errorMessage);
    });
  });
  
  describe('Static Methods', () => {
    it('should find references by source content', async () => {
      const sourceContentId1 = new mongoose.Types.ObjectId();
      const sourceContentId2 = new mongoose.Types.ObjectId();
      
      // Create test references
      await Promise.all([
        new Reference({
          sourceContentId: sourceContentId1,
          referenceType: 'citation',
          url: 'https://example.com/ref1'
        }).save(),
        new Reference({
          sourceContentId: sourceContentId2,
          referenceType: 'link',
          url: 'https://example.com/ref2'
        }).save(),
        new Reference({
          sourceContentId: sourceContentId1,
          referenceType: 'mention',
          url: 'https://example.com/ref3'
        }).save()
      ]);
      
      const source1References = await Reference.findBySourceContent(sourceContentId1);
      expect(source1References).toHaveLength(2);
      expect(source1References[0].sourceContentId.toString()).toBe(sourceContentId1.toString());
      expect(source1References[1].sourceContentId.toString()).toBe(sourceContentId1.toString());
      
      const source2References = await Reference.findBySourceContent(sourceContentId2);
      expect(source2References).toHaveLength(1);
      expect(source2References[0].sourceContentId.toString()).toBe(sourceContentId2.toString());
    });
    
    it('should find references by target content', async () => {
      const targetContentId1 = new mongoose.Types.ObjectId();
      const targetContentId2 = new mongoose.Types.ObjectId();
      
      // Create test references
      await Promise.all([
        new Reference({
          sourceContentId: new mongoose.Types.ObjectId(),
          referenceType: 'citation',
          url: 'https://example.com/ref1',
          resolved: true,
          targetContentId: targetContentId1
        }).save(),
        new Reference({
          sourceContentId: new mongoose.Types.ObjectId(),
          referenceType: 'link',
          url: 'https://example.com/ref2',
          resolved: true,
          targetContentId: targetContentId2
        }).save(),
        new Reference({
          sourceContentId: new mongoose.Types.ObjectId(),
          referenceType: 'mention',
          url: 'https://example.com/ref3',
          resolved: true,
          targetContentId: targetContentId1
        }).save()
      ]);
      
      const target1References = await Reference.findByTargetContent(targetContentId1);
      expect(target1References).toHaveLength(2);
      expect(target1References[0].targetContentId.toString()).toBe(targetContentId1.toString());
      expect(target1References[1].targetContentId.toString()).toBe(targetContentId1.toString());
      
      const target2References = await Reference.findByTargetContent(targetContentId2);
      expect(target2References).toHaveLength(1);
      expect(target2References[0].targetContentId.toString()).toBe(targetContentId2.toString());
    });
    
    it('should find unresolved references', async () => {
      // Create test references
      await Promise.all([
        new Reference({
          sourceContentId: new mongoose.Types.ObjectId(),
          referenceType: 'citation',
          url: 'https://example.com/ref1',
          resolved: false
        }).save(),
        new Reference({
          sourceContentId: new mongoose.Types.ObjectId(),
          referenceType: 'link',
          url: 'https://example.com/ref2',
          resolved: true,
          targetContentId: new mongoose.Types.ObjectId()
        }).save(),
        new Reference({
          sourceContentId: new mongoose.Types.ObjectId(),
          referenceType: 'mention',
          url: 'https://example.com/ref3',
          resolved: false
        }).save()
      ]);
      
      const unresolvedReferences = await Reference.findUnresolved();
      expect(unresolvedReferences).toHaveLength(2);
      expect(unresolvedReferences[0].resolved).toBe(false);
      expect(unresolvedReferences[1].resolved).toBe(false);
    });
    
    it('should find references by URL', async () => {
      const url = 'https://example.com/specific-reference';
      
      // Create test references
      await Promise.all([
        new Reference({
          sourceContentId: new mongoose.Types.ObjectId(),
          referenceType: 'citation',
          url: url
        }).save(),
        new Reference({
          sourceContentId: new mongoose.Types.ObjectId(),
          referenceType: 'link',
          url: 'https://example.com/other-reference'
        }).save(),
        new Reference({
          sourceContentId: new mongoose.Types.ObjectId(),
          referenceType: 'mention',
          url: url
        }).save()
      ]);
      
      const urlReferences = await Reference.findByUrl(url);
      expect(urlReferences).toHaveLength(2);
      expect(urlReferences[0].url).toBe(url);
      expect(urlReferences[1].url).toBe(url);
    });
    
    it('should find references by type', async () => {
      // Create test references
      await Promise.all([
        new Reference({
          sourceContentId: new mongoose.Types.ObjectId(),
          referenceType: 'citation',
          url: 'https://example.com/ref1'
        }).save(),
        new Reference({
          sourceContentId: new mongoose.Types.ObjectId(),
          referenceType: 'link',
          url: 'https://example.com/ref2'
        }).save(),
        new Reference({
          sourceContentId: new mongoose.Types.ObjectId(),
          referenceType: 'citation',
          url: 'https://example.com/ref3'
        }).save()
      ]);
      
      const citationReferences = await Reference.findByType('citation');
      expect(citationReferences).toHaveLength(2);
      expect(citationReferences[0].referenceType).toBe('citation');
      expect(citationReferences[1].referenceType).toBe('citation');
      
      const linkReferences = await Reference.findByType('link');
      expect(linkReferences).toHaveLength(1);
      expect(linkReferences[0].referenceType).toBe('link');
    });
    
    it('should find references by verification status', async () => {
      // Create test references
      const references = await Promise.all([
        new Reference({
          sourceContentId: new mongoose.Types.ObjectId(),
          referenceType: 'citation',
          url: 'https://example.com/ref1'
        }).save(),
        new Reference({
          sourceContentId: new mongoose.Types.ObjectId(),
          referenceType: 'link',
          url: 'https://example.com/ref2'
        }).save(),
        new Reference({
          sourceContentId: new mongoose.Types.ObjectId(),
          referenceType: 'mention',
          url: 'https://example.com/ref3'
        }).save()
      ]);
      
      // Verify some references
      await references[0].verify(true); // verified
      await references[1].verify(false); // rejected
      // references[2] remains unverified
      
      const verifiedReferences = await Reference.findByVerificationStatus('verified');
      expect(verifiedReferences).toHaveLength(1);
      expect(verifiedReferences[0].verificationStatus).toBe('verified');
      
      const rejectedReferences = await Reference.findByVerificationStatus('rejected');
      expect(rejectedReferences).toHaveLength(1);
      expect(rejectedReferences[0].verificationStatus).toBe('rejected');
      
      const unverifiedReferences = await Reference.findByVerificationStatus('unverified');
      expect(unverifiedReferences).toHaveLength(1);
      expect(unverifiedReferences[0].verificationStatus).toBe('unverified');
    });
  });
});