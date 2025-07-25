// Mock the InterestProfile model first
const mockFindOne = jest.fn();
const mockConstructor = jest.fn();

jest.mock('../models/InterestProfile', () => {
  const constructor = jest.fn().mockImplementation((data) => ({
    ...data,
    topics: [],
    categories: [],
    sourceTypes: [],
    explicitPreferences: data?.explicitPreferences || { topics: [], categories: [], sourceTypes: [] },
    adaptiveWeights: { explicitWeight: 0.7, implicitWeight: 0.3 },
    learningRate: 0.1,
    decayRate: 0.95,
    updateTopicInterest: jest.fn(),
    updateCategoryInterest: jest.fn(),
    updateSourceTypeInterest: jest.fn(),
    applyDecay: jest.fn(),
    getTopInterests: jest.fn(),
    save: jest.fn().mockResolvedValue(true)
  }));
  
  constructor.findOne = mockFindOne;
  return constructor;
});

const InterestModeler = require('../utils/interestModeler');
const InterestProfile = require('../models/InterestProfile');

describe('InterestModeler', () => {
  let interestModeler;
  let mockProfile;

  beforeEach(() => {
    interestModeler = new InterestModeler();
    
    // Create mock profile with methods
    mockProfile = {
      userId: 'user123',
      topics: [],
      categories: [],
      sourceTypes: [],
      explicitPreferences: {
        topics: [],
        categories: [],
        sourceTypes: []
      },
      adaptiveWeights: {
        explicitWeight: 0.7,
        implicitWeight: 0.3
      },
      learningRate: 0.1,
      decayRate: 0.95,
      updateTopicInterest: jest.fn(),
      updateCategoryInterest: jest.fn(),
      updateSourceTypeInterest: jest.fn(),
      applyDecay: jest.fn(),
      getTopInterests: jest.fn(),
      save: jest.fn().mockResolvedValue(true)
    };

    // Reset mocks
    mockFindOne.mockReset();
    InterestProfile.mockReset();
  });

  describe('initializeProfile', () => {
    it('should create new profile when none exists', async () => {
      mockFindOne.mockResolvedValue(null);
      InterestProfile.mockReturnValue(mockProfile);

      const explicitPreferences = {
        topics: ['AI', 'Machine Learning'],
        categories: ['Technology'],
        sourceTypes: ['academic']
      };

      const result = await interestModeler.initializeProfile('user123', explicitPreferences);

      expect(mockFindOne).toHaveBeenCalledWith({ userId: 'user123' });
      expect(InterestProfile).toHaveBeenCalledWith({
        userId: 'user123',
        explicitPreferences
      });
      expect(mockProfile.save).toHaveBeenCalled();
      expect(result).toBe(mockProfile);
    });

    it('should return existing profile if found', async () => {
      mockFindOne.mockResolvedValue(mockProfile);

      const result = await interestModeler.initializeProfile('user123');

      expect(mockFindOne).toHaveBeenCalledWith({ userId: 'user123' });
      expect(InterestProfile).not.toHaveBeenCalled();
      expect(result).toBe(mockProfile);
    });

    it('should handle initialization errors', async () => {
      mockFindOne.mockRejectedValue(new Error('Database error'));

      await expect(interestModeler.initializeProfile('user123'))
        .rejects.toThrow('Failed to initialize interest profile: Database error');
    });
  });

  describe('updateFromInteraction', () => {
    const interaction = { type: 'save' };
    const content = {
      topics: ['AI', 'Neural Networks'],
      categories: ['Technology', 'Research'],
      sourceType: 'academic'
    };

    it('should update profile based on interaction', async () => {
      mockFindOne.mockResolvedValue(mockProfile);

      const result = await interestModeler.updateFromInteraction('user123', interaction, content);

      expect(mockProfile.updateTopicInterest).toHaveBeenCalledWith('AI', 'positive', 0.8);
      expect(mockProfile.updateTopicInterest).toHaveBeenCalledWith('Neural Networks', 'positive', 0.8);
      expect(mockProfile.updateCategoryInterest).toHaveBeenCalledWith('Technology', 'positive', 0.8);
      expect(mockProfile.updateCategoryInterest).toHaveBeenCalledWith('Research', 'positive', 0.8);
      expect(mockProfile.updateSourceTypeInterest).toHaveBeenCalledWith('academic', 'positive', 0.8);
      expect(mockProfile.applyDecay).toHaveBeenCalled();
      expect(mockProfile.save).toHaveBeenCalled();
      expect(result).toBe(mockProfile);
    });

    it('should create profile if none exists', async () => {
      mockFindOne.mockResolvedValue(null);
      InterestProfile.mockReturnValue(mockProfile);

      const result = await interestModeler.updateFromInteraction('user123', interaction, content);

      expect(InterestProfile).toHaveBeenCalled();
      expect(result).toBe(mockProfile);
    });

    it('should handle negative interactions', async () => {
      mockFindOne.mockResolvedValue(mockProfile);
      const dismissInteraction = { type: 'dismiss' };

      await interestModeler.updateFromInteraction('user123', dismissInteraction, content);

      expect(mockProfile.updateTopicInterest).toHaveBeenCalledWith('AI', 'negative', 0.5);
    });

    it('should handle update errors', async () => {
      mockFindOne.mockRejectedValue(new Error('Database error'));

      await expect(interestModeler.updateFromInteraction('user123', interaction, content))
        .rejects.toThrow('Failed to update interest profile: Database error');
    });
  });

  describe('getProfile', () => {
    it('should return existing profile', async () => {
      mockFindOne.mockResolvedValue(mockProfile);

      const result = await interestModeler.getProfile('user123');

      expect(mockFindOne).toHaveBeenCalledWith({ userId: 'user123' });
      expect(result).toBe(mockProfile);
    });

    it('should create profile if none exists', async () => {
      mockFindOne.mockResolvedValue(null);
      InterestProfile.mockReturnValue(mockProfile);

      const result = await interestModeler.getProfile('user123');

      expect(InterestProfile).toHaveBeenCalled();
      expect(result).toBe(mockProfile);
    });

    it('should handle get profile errors', async () => {
      mockFindOne.mockRejectedValue(new Error('Database error'));

      await expect(interestModeler.getProfile('user123'))
        .rejects.toThrow('Failed to get interest profile: Database error');
    });
  });

  describe('updateExplicitPreferences', () => {
    const preferences = {
      topics: ['Deep Learning', 'NLP'],
      categories: ['AI Research'],
      sourceTypes: ['blog']
    };

    it('should update existing profile preferences', async () => {
      mockProfile.topics = [{ topic: 'AI', weight: 0.5 }];
      mockProfile.categories = [];
      mockProfile.sourceTypes = [];
      mockFindOne.mockResolvedValue(mockProfile);

      const result = await interestModeler.updateExplicitPreferences('user123', preferences);

      expect(mockProfile.explicitPreferences).toEqual(preferences);
      expect(mockProfile.save).toHaveBeenCalled();
      expect(result).toBe(mockProfile);
    });

    it('should create profile if none exists', async () => {
      mockFindOne.mockResolvedValue(null);
      InterestProfile.mockReturnValue(mockProfile);

      const result = await interestModeler.updateExplicitPreferences('user123', preferences);

      expect(InterestProfile).toHaveBeenCalled();
      expect(result).toBe(mockProfile);
    });

    it('should handle update preferences errors', async () => {
      mockFindOne.mockRejectedValue(new Error('Database error'));

      await expect(interestModeler.updateExplicitPreferences('user123', preferences))
        .rejects.toThrow('Failed to update explicit preferences: Database error');
    });
  });

  describe('getInterestSummary', () => {
    it('should return comprehensive interest summary', async () => {
      mockProfile.getTopInterests
        .mockReturnValueOnce([{ name: 'AI', weight: 0.8 }])
        .mockReturnValueOnce([{ name: 'Technology', weight: 0.7 }])
        .mockReturnValueOnce([{ name: 'academic', weight: 0.9 }]);
      
      mockProfile.topics = [{ topic: 'AI' }];
      mockProfile.categories = [{ category: 'Technology' }];
      mockProfile.sourceTypes = [{ sourceType: 'academic' }];
      mockProfile.updated = new Date();

      mockFindOne.mockResolvedValue(mockProfile);

      const result = await interestModeler.getInterestSummary('user123');

      expect(result).toEqual({
        topTopics: [{ name: 'AI', weight: 0.8 }],
        topCategories: [{ name: 'Technology', weight: 0.7 }],
        topSourceTypes: [{ name: 'academic', weight: 0.9 }],
        explicitPreferences: mockProfile.explicitPreferences,
        profileStats: {
          totalTopics: 1,
          totalCategories: 1,
          totalSourceTypes: 1,
          learningRate: 0.1,
          lastUpdated: mockProfile.updated
        }
      });
    });

    it('should handle get summary errors', async () => {
      mockFindOne.mockRejectedValue(new Error('Database error'));

      await expect(interestModeler.getInterestSummary('user123'))
        .rejects.toThrow('Failed to get interest summary: Failed to get interest profile: Database error');
    });
  });

  describe('adjustLearningParameters', () => {
    it('should adjust learning parameters', async () => {
      mockFindOne.mockResolvedValue(mockProfile);

      const parameters = {
        learningRate: 0.2,
        decayRate: 0.9,
        adaptiveWeights: {
          explicitWeight: 0.8,
          implicitWeight: 0.2
        }
      };

      const result = await interestModeler.adjustLearningParameters('user123', parameters);

      expect(mockProfile.learningRate).toBe(0.2);
      expect(mockProfile.decayRate).toBe(0.9);
      expect(mockProfile.adaptiveWeights.explicitWeight).toBe(0.8);
      expect(mockProfile.adaptiveWeights.implicitWeight).toBe(0.2);
      expect(mockProfile.save).toHaveBeenCalled();
      expect(result).toBe(mockProfile);
    });

    it('should enforce parameter bounds', async () => {
      mockFindOne.mockResolvedValue(mockProfile);

      const parameters = {
        learningRate: 0.8, // Too high
        decayRate: 0.5 // Too low
      };

      await interestModeler.adjustLearningParameters('user123', parameters);

      expect(mockProfile.learningRate).toBe(0.5); // Clamped to max
      expect(mockProfile.decayRate).toBe(0.8); // Clamped to min
    });

    it('should handle profile not found', async () => {
      mockFindOne.mockResolvedValue(null);

      await expect(interestModeler.adjustLearningParameters('user123', {}))
        .rejects.toThrow('Failed to adjust learning parameters: Profile not found');
    });
  });

  describe('getInteractionType', () => {
    it('should classify positive interactions', () => {
      expect(interestModeler.getInteractionType('save')).toBe('positive');
      expect(interestModeler.getInteractionType('share')).toBe('positive');
      expect(interestModeler.getInteractionType('like')).toBe('positive');
      expect(interestModeler.getInteractionType('view')).toBe('positive');
    });

    it('should classify negative interactions', () => {
      expect(interestModeler.getInteractionType('dismiss')).toBe('negative');
      expect(interestModeler.getInteractionType('dislike')).toBe('negative');
      expect(interestModeler.getInteractionType('report')).toBe('negative');
    });

    it('should default to positive for unknown interactions', () => {
      expect(interestModeler.getInteractionType('unknown')).toBe('positive');
    });
  });

  describe('resetProfile', () => {
    it('should reset profile while keeping explicit preferences', async () => {
      mockProfile.explicitPreferences = {
        topics: ['AI'],
        categories: ['Technology'],
        sourceTypes: ['academic']
      };
      mockProfile.topics = [{ topic: 'Old Topic', weight: 0.3 }];
      mockProfile.categories = [{ category: 'Old Category', weight: 0.4 }];
      mockProfile.sourceTypes = [{ sourceType: 'blog', weight: 0.2 }];

      mockFindOne.mockResolvedValue(mockProfile);

      const result = await interestModeler.resetProfile('user123');

      // The implementation re-adds explicit preferences, so we expect them to be there
      expect(mockProfile.topics).toEqual([{
        topic: 'AI',
        weight: 0.8,
        interactionCount: 0
      }]);
      expect(mockProfile.categories).toEqual([{
        category: 'Technology',
        weight: 0.8,
        interactionCount: 0
      }]);
      expect(mockProfile.sourceTypes).toEqual([{
        sourceType: 'academic',
        weight: 0.8,
        interactionCount: 0
      }]);
      expect(mockProfile.save).toHaveBeenCalled();
      expect(result).toBe(mockProfile);
    });

    it('should handle profile not found', async () => {
      mockFindOne.mockResolvedValue(null);

      await expect(interestModeler.resetProfile('user123'))
        .rejects.toThrow('Failed to reset profile: Profile not found');
    });
  });

  describe('interaction weights', () => {
    it('should have correct interaction weights', () => {
      expect(interestModeler.interactionWeights).toEqual({
        view: 0.1,
        save: 0.8,
        share: 0.9,
        dismiss: -0.5,
        like: 0.7,
        comment: 0.6,
        click: 0.3
      });
    });
  });
});