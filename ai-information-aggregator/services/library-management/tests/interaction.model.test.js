const mongoose = require('mongoose');
const Interaction = require('../models/Interaction');

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

// Clear interactions collection before each test
beforeEach(async () => {
  await Interaction.deleteMany({});
});

describe('Interaction Model', () => {
  describe('Schema', () => {
    it('should create a new view interaction successfully', async () => {
      const interactionData = {
        userId: new mongoose.Types.ObjectId(),
        contentId: new mongoose.Types.ObjectId(),
        type: 'view',
        duration: 120,
        progress: 75,
        device: 'desktop',
        platform: 'web'
      };
      
      const interaction = new Interaction(interactionData);
      const savedInteraction = await interaction.save();
      
      expect(savedInteraction._id).toBeDefined();
      expect(savedInteraction.userId.toString()).toBe(interactionData.userId.toString());
      expect(savedInteraction.contentId.toString()).toBe(interactionData.contentId.toString());
      expect(savedInteraction.type).toBe(interactionData.type);
      expect(savedInteraction.duration).toBe(interactionData.duration);
      expect(savedInteraction.progress).toBe(interactionData.progress);
      expect(savedInteraction.device).toBe(interactionData.device);
      expect(savedInteraction.platform).toBe(interactionData.platform);
      expect(savedInteraction.timestamp).toBeInstanceOf(Date);
    });
    
    it('should create a new comment interaction successfully', async () => {
      const interactionData = {
        userId: new mongoose.Types.ObjectId(),
        contentId: new mongoose.Types.ObjectId(),
        type: 'comment',
        commentText: 'This is a test comment'
      };
      
      const interaction = new Interaction(interactionData);
      const savedInteraction = await interaction.save();
      
      expect(savedInteraction._id).toBeDefined();
      expect(savedInteraction.type).toBe('comment');
      expect(savedInteraction.commentText).toBe(interactionData.commentText);
      expect(savedInteraction.commentParent).toBeNull(); // Default value
    });
    
    it('should create a new highlight interaction successfully', async () => {
      const interactionData = {
        userId: new mongoose.Types.ObjectId(),
        contentId: new mongoose.Types.ObjectId(),
        type: 'highlight',
        highlightText: 'This is a highlighted text',
        highlightPosition: {
          start: 100,
          end: 125,
          context: 'This is the context around the highlighted text'
        }
      };
      
      const interaction = new Interaction(interactionData);
      const savedInteraction = await interaction.save();
      
      expect(savedInteraction._id).toBeDefined();
      expect(savedInteraction.type).toBe('highlight');
      expect(savedInteraction.highlightText).toBe(interactionData.highlightText);
      expect(savedInteraction.highlightPosition.start).toBe(interactionData.highlightPosition.start);
      expect(savedInteraction.highlightPosition.end).toBe(interactionData.highlightPosition.end);
      expect(savedInteraction.highlightPosition.context).toBe(interactionData.highlightPosition.context);
    });
    
    it('should fail validation when required fields are missing', async () => {
      const interactionData = {
        userId: new mongoose.Types.ObjectId()
        // Missing contentId and type
      };
      
      const interaction = new Interaction(interactionData);
      
      await expect(interaction.save()).rejects.toThrow();
    });
    
    it('should fail validation when interaction type is invalid', async () => {
      const interactionData = {
        userId: new mongoose.Types.ObjectId(),
        contentId: new mongoose.Types.ObjectId(),
        type: 'invalid-type' // Invalid type
      };
      
      const interaction = new Interaction(interactionData);
      
      await expect(interaction.save()).rejects.toThrow();
    });
  });
  
  describe('Interaction Methods', () => {
    it('should update interaction metadata', async () => {
      const interaction = new Interaction({
        userId: new mongoose.Types.ObjectId(),
        contentId: new mongoose.Types.ObjectId(),
        type: 'view'
      });
      await interaction.save();
      
      const metadata = {
        referrer: 'homepage',
        sessionId: '12345',
        browser: 'chrome'
      };
      
      await interaction.updateMetadata(metadata);
      
      expect(interaction.metadata.get('referrer')).toBe('homepage');
      expect(interaction.metadata.get('sessionId')).toBe('12345');
      expect(interaction.metadata.get('browser')).toBe('chrome');
    });
    
    it('should update interaction duration', async () => {
      const interaction = new Interaction({
        userId: new mongoose.Types.ObjectId(),
        contentId: new mongoose.Types.ObjectId(),
        type: 'view'
      });
      await interaction.save();
      
      expect(interaction.duration).toBeUndefined();
      
      await interaction.updateDuration(180);
      
      expect(interaction.duration).toBe(180);
    });
    
    it('should update interaction progress', async () => {
      const interaction = new Interaction({
        userId: new mongoose.Types.ObjectId(),
        contentId: new mongoose.Types.ObjectId(),
        type: 'view'
      });
      await interaction.save();
      
      expect(interaction.progress).toBeUndefined();
      
      await interaction.updateProgress(50);
      
      expect(interaction.progress).toBe(50);
      
      // Test bounds
      await interaction.updateProgress(120);
      expect(interaction.progress).toBe(100); // Capped at 100
      
      await interaction.updateProgress(-10);
      expect(interaction.progress).toBe(0); // Minimum 0
    });
    
    it('should add comment reply', async () => {
      const userId = new mongoose.Types.ObjectId();
      const contentId = new mongoose.Types.ObjectId();
      
      const comment = new Interaction({
        userId,
        contentId,
        type: 'comment',
        commentText: 'Original comment'
      });
      await comment.save();
      
      const replyUserId = new mongoose.Types.ObjectId();
      const reply = await comment.addReply(replyUserId, 'Reply comment');
      
      expect(reply._id).toBeDefined();
      expect(reply.type).toBe('comment');
      expect(reply.commentText).toBe('Reply comment');
      expect(reply.userId.toString()).toBe(replyUserId.toString());
      expect(reply.contentId.toString()).toBe(contentId.toString());
      expect(reply.commentParent.toString()).toBe(comment._id.toString());
    });
    
    it('should throw error when adding reply to non-comment interaction', async () => {
      const interaction = new Interaction({
        userId: new mongoose.Types.ObjectId(),
        contentId: new mongoose.Types.ObjectId(),
        type: 'view'
      });
      await interaction.save();
      
      await expect(interaction.addReply(
        new mongoose.Types.ObjectId(),
        'Reply text'
      )).rejects.toThrow('Can only add replies to comments');
    });
  });
  
  describe('Static Methods', () => {
    it('should find user interactions', async () => {
      const userId1 = new mongoose.Types.ObjectId();
      const userId2 = new mongoose.Types.ObjectId();
      
      // Create test interactions
      await Promise.all([
        new Interaction({
          userId: userId1,
          contentId: new mongoose.Types.ObjectId(),
          type: 'view'
        }).save(),
        new Interaction({
          userId: userId2,
          contentId: new mongoose.Types.ObjectId(),
          type: 'save'
        }).save(),
        new Interaction({
          userId: userId1,
          contentId: new mongoose.Types.ObjectId(),
          type: 'comment',
          commentText: 'Test comment'
        }).save()
      ]);
      
      const user1Interactions = await Interaction.findByUser(userId1);
      expect(user1Interactions).toHaveLength(2);
      expect(user1Interactions[0].userId.toString()).toBe(userId1.toString());
      expect(user1Interactions[1].userId.toString()).toBe(userId1.toString());
      
      const user1Comments = await Interaction.findByUser(userId1, 'comment');
      expect(user1Comments).toHaveLength(1);
      expect(user1Comments[0].type).toBe('comment');
    });
    
    it('should find content interactions', async () => {
      const contentId1 = new mongoose.Types.ObjectId();
      const contentId2 = new mongoose.Types.ObjectId();
      
      // Create test interactions
      await Promise.all([
        new Interaction({
          userId: new mongoose.Types.ObjectId(),
          contentId: contentId1,
          type: 'view'
        }).save(),
        new Interaction({
          userId: new mongoose.Types.ObjectId(),
          contentId: contentId2,
          type: 'save'
        }).save(),
        new Interaction({
          userId: new mongoose.Types.ObjectId(),
          contentId: contentId1,
          type: 'like'
        }).save()
      ]);
      
      const content1Interactions = await Interaction.findByContent(contentId1);
      expect(content1Interactions).toHaveLength(2);
      expect(content1Interactions[0].contentId.toString()).toBe(contentId1.toString());
      expect(content1Interactions[1].contentId.toString()).toBe(contentId1.toString());
      
      const content1Likes = await Interaction.findByContent(contentId1, 'like');
      expect(content1Likes).toHaveLength(1);
      expect(content1Likes[0].type).toBe('like');
    });
    
    it('should find user-content interactions', async () => {
      const userId = new mongoose.Types.ObjectId();
      const contentId = new mongoose.Types.ObjectId();
      
      // Create test interactions
      await Promise.all([
        new Interaction({
          userId,
          contentId,
          type: 'view'
        }).save(),
        new Interaction({
          userId: new mongoose.Types.ObjectId(),
          contentId,
          type: 'save'
        }).save(),
        new Interaction({
          userId,
          contentId,
          type: 'comment',
          commentText: 'Test comment'
        }).save()
      ]);
      
      const userContentInteractions = await Interaction.findByUserAndContent(userId, contentId);
      expect(userContentInteractions).toHaveLength(2);
      expect(userContentInteractions[0].userId.toString()).toBe(userId.toString());
      expect(userContentInteractions[0].contentId.toString()).toBe(contentId.toString());
      expect(userContentInteractions[1].userId.toString()).toBe(userId.toString());
      expect(userContentInteractions[1].contentId.toString()).toBe(contentId.toString());
    });
    
    it('should find comments for content', async () => {
      const contentId = new mongoose.Types.ObjectId();
      
      // Create test interactions
      const comment1 = new Interaction({
        userId: new mongoose.Types.ObjectId(),
        contentId,
        type: 'comment',
        commentText: 'Top-level comment 1'
      });
      await comment1.save();
      
      const comment2 = new Interaction({
        userId: new mongoose.Types.ObjectId(),
        contentId,
        type: 'comment',
        commentText: 'Top-level comment 2'
      });
      await comment2.save();
      
      // Add replies
      await comment1.addReply(new mongoose.Types.ObjectId(), 'Reply to comment 1');
      await comment2.addReply(new mongoose.Types.ObjectId(), 'Reply to comment 2');
      
      // Add other interaction types
      await new Interaction({
        userId: new mongoose.Types.ObjectId(),
        contentId,
        type: 'view'
      }).save();
      
      // Find all comments
      const allComments = await Interaction.findComments(contentId);
      expect(allComments).toHaveLength(4);
      
      // Find top-level comments only
      const topLevelComments = await Interaction.findComments(contentId, true);
      expect(topLevelComments).toHaveLength(2);
      expect(topLevelComments[0].commentParent).toBeNull();
      expect(topLevelComments[1].commentParent).toBeNull();
    });
    
    it('should find comment replies', async () => {
      const contentId = new mongoose.Types.ObjectId();
      
      // Create a comment
      const comment = new Interaction({
        userId: new mongoose.Types.ObjectId(),
        contentId,
        type: 'comment',
        commentText: 'Original comment'
      });
      await comment.save();
      
      // Add replies
      await comment.addReply(new mongoose.Types.ObjectId(), 'First reply');
      await comment.addReply(new mongoose.Types.ObjectId(), 'Second reply');
      
      // Find replies
      const replies = await Interaction.findReplies(comment._id);
      expect(replies).toHaveLength(2);
      expect(replies[0].commentParent.toString()).toBe(comment._id.toString());
      expect(replies[1].commentParent.toString()).toBe(comment._id.toString());
      expect(replies[0].commentText).toBe('First reply');
      expect(replies[1].commentText).toBe('Second reply');
    });
    
    it('should find highlights for content', async () => {
      const contentId = new mongoose.Types.ObjectId();
      const userId1 = new mongoose.Types.ObjectId();
      const userId2 = new mongoose.Types.ObjectId();
      
      // Create test highlights
      await Promise.all([
        new Interaction({
          userId: userId1,
          contentId,
          type: 'highlight',
          highlightText: 'First highlight',
          highlightPosition: { start: 10, end: 25 }
        }).save(),
        new Interaction({
          userId: userId2,
          contentId,
          type: 'highlight',
          highlightText: 'Second highlight',
          highlightPosition: { start: 50, end: 65 }
        }).save(),
        new Interaction({
          userId: userId1,
          contentId,
          type: 'highlight',
          highlightText: 'Third highlight',
          highlightPosition: { start: 100, end: 115 }
        }).save()
      ]);
      
      // Find all highlights for content
      const allHighlights = await Interaction.findHighlights(contentId);
      expect(allHighlights).toHaveLength(3);
      
      // Find highlights for specific user
      const user1Highlights = await Interaction.findHighlights(contentId, userId1);
      expect(user1Highlights).toHaveLength(2);
      expect(user1Highlights[0].userId.toString()).toBe(userId1.toString());
      expect(user1Highlights[1].userId.toString()).toBe(userId1.toString());
    });
    
    it('should get interaction counts for content', async () => {
      const contentId = new mongoose.Types.ObjectId();
      
      // Create test interactions
      await Promise.all([
        new Interaction({
          userId: new mongoose.Types.ObjectId(),
          contentId,
          type: 'view'
        }).save(),
        new Interaction({
          userId: new mongoose.Types.ObjectId(),
          contentId,
          type: 'view'
        }).save(),
        new Interaction({
          userId: new mongoose.Types.ObjectId(),
          contentId,
          type: 'save'
        }).save(),
        new Interaction({
          userId: new mongoose.Types.ObjectId(),
          contentId,
          type: 'like'
        }).save(),
        new Interaction({
          userId: new mongoose.Types.ObjectId(),
          contentId,
          type: 'comment',
          commentText: 'Test comment'
        }).save()
      ]);
      
      const counts = await Interaction.getInteractionCounts(contentId);
      
      expect(counts.view).toBe(2);
      expect(counts.save).toBe(1);
      expect(counts.like).toBe(1);
      expect(counts.comment).toBe(1);
      expect(counts.share).toBe(0); // No share interactions
    });
    
    it('should get recent user activity', async () => {
      const userId = new mongoose.Types.ObjectId();
      
      // Create test interactions with different timestamps
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      
      await Promise.all([
        new Interaction({
          userId,
          contentId: new mongoose.Types.ObjectId(),
          type: 'view',
          timestamp: twoDaysAgo
        }).save(),
        new Interaction({
          userId,
          contentId: new mongoose.Types.ObjectId(),
          type: 'save',
          timestamp: oneDayAgo
        }).save(),
        new Interaction({
          userId,
          contentId: new mongoose.Types.ObjectId(),
          type: 'comment',
          commentText: 'Test comment',
          timestamp: now
        }).save()
      ]);
      
      const recentActivity = await Interaction.getRecentActivity(userId, 2);
      
      expect(recentActivity).toHaveLength(2);
      expect(recentActivity[0].type).toBe('comment'); // Most recent
      expect(recentActivity[1].type).toBe('save'); // Second most recent
    });
  });
});