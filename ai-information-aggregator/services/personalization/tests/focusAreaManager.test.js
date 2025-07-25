const FocusAreaManager = require('../utils/focusAreaManager');

describe('FocusAreaManager', () => {
  let manager;
  let mockFocusAreaData;
  let mockContent;

  beforeEach(() => {
    manager = new FocusAreaManager();
    
    mockFocusAreaData = {
      name: 'AI & Machine Learning',
      description: 'Focus on artificial intelligence and machine learning developments',
      topics: ['artificial intelligence', 'machine learning', 'deep learning'],
      categories: ['technology', 'research'],
      keywords: ['AI', 'ML', 'neural networks', 'algorithms'],
      sourceTypes: ['academic', 'news'],
      priority: 'high'
    };

    mockContent = [
      {
        id: 'content1',
        title: 'New AI breakthrough in neural networks',
        description: 'Researchers develop advanced machine learning algorithms',
        topics: ['artificial intelligence', 'neural networks'],
        categories: ['technology'],
        sourceType: 'academic'
      },
      {
        id: 'content2',
        title: 'Sports news update',
        description: 'Latest scores from the championship',
        topics: ['sports', 'football'],
        categories: ['sports'],
        sourceType: 'news'
      },
      {
        id: 'content3',
        title: 'Machine learning applications in healthcare',
        description: 'How ML is transforming medical diagnosis',
        topics: ['machine learning', 'healthcare'],
        categories: ['technology', 'health'],
        sourceType: 'blog'
      }
    ];
  });

  describe('createFocusArea', () => {
    it('should create a new focus area successfully', async () => {
      const focusArea = await manager.createFocusArea('user123', mockFocusAreaData);

      expect(focusArea).toHaveProperty('id');
      expect(focusArea).toHaveProperty('userId', 'user123');
      expect(focusArea).toHaveProperty('name', mockFocusAreaData.name);
      expect(focusArea).toHaveProperty('topics', mockFocusAreaData.topics);
      expect(focusArea).toHaveProperty('isActive', true);
      expect(focusArea).toHaveProperty('createdAt');
      expect(focusArea).toHaveProperty('contentCount', 0);
    });

    it('should enforce maximum focus areas limit', async () => {
      // Create maximum number of focus areas
      for (let i = 0; i < 10; i++) {
        await manager.createFocusArea('user123', {
          ...mockFocusAreaData,
          name: `Focus Area ${i}`
        });
      }

      // Try to create one more
      await expect(manager.createFocusArea('user123', mockFocusAreaData))
        .rejects.toThrow('Maximum focus areas limit (10) reached');
    });

    it('should validate focus area data', async () => {
      const invalidData = { ...mockFocusAreaData, name: '' };
      
      await expect(manager.createFocusArea('user123', invalidData))
        .rejects.toThrow('Focus area name is required');
    });

    it('should handle creation errors gracefully', async () => {
      await expect(manager.createFocusArea('user123', null))
        .rejects.toThrow('Failed to create focus area');
    });
  });

  describe('createFromTemplate', () => {
    it('should create focus area from template', async () => {
      const focusArea = await manager.createFromTemplate('user123', 'technology');

      expect(focusArea.name).toBe('Technology');
      expect(focusArea.topics).toContain('artificial intelligence');
      expect(focusArea.categories).toContain('technology');
    });

    it('should merge template with customizations', async () => {
      const customizations = {
        name: 'Custom Tech Focus',
        topics: ['blockchain'],
        priority: 'low'
      };

      const focusArea = await manager.createFromTemplate('user123', 'technology', customizations);

      expect(focusArea.name).toBe('Custom Tech Focus');
      expect(focusArea.topics).toContain('artificial intelligence'); // From template
      expect(focusArea.topics).toContain('blockchain'); // From customization
      expect(focusArea.priority).toBe('low');
    });

    it('should handle invalid template ID', async () => {
      await expect(manager.createFromTemplate('user123', 'invalid-template'))
        .rejects.toThrow('Focus area template \'invalid-template\' not found');
    });
  });

  describe('updateFocusArea', () => {
    it('should update existing focus area', async () => {
      const focusArea = await manager.createFocusArea('user123', mockFocusAreaData);
      
      const updates = {
        name: 'Updated AI Focus',
        priority: 'medium',
        topics: ['artificial intelligence', 'robotics']
      };

      const updatedFocusArea = await manager.updateFocusArea('user123', focusArea.id, updates);

      expect(updatedFocusArea.name).toBe('Updated AI Focus');
      expect(updatedFocusArea.priority).toBe('medium');
      expect(updatedFocusArea.topics).toEqual(['artificial intelligence', 'robotics']);
      expect(updatedFocusArea.updatedAt).toBeInstanceOf(Date);
    });

    it('should handle non-existent focus area', async () => {
      await expect(manager.updateFocusArea('user123', 'invalid-id', { name: 'Test' }))
        .rejects.toThrow('Focus area not found');
    });

    it('should validate update data', async () => {
      const focusArea = await manager.createFocusArea('user123', mockFocusAreaData);
      
      await expect(manager.updateFocusArea('user123', focusArea.id, { name: '' }))
        .rejects.toThrow('Focus area name is required');
    });
  });

  describe('deleteFocusArea', () => {
    it('should delete focus area successfully', async () => {
      const focusArea = await manager.createFocusArea('user123', mockFocusAreaData);
      
      const result = await manager.deleteFocusArea('user123', focusArea.id);
      expect(result).toBe(true);

      const focusAreas = await manager.getFocusAreas('user123');
      expect(focusAreas).toHaveLength(0);
    });

    it('should remove from active filters when deleted', async () => {
      const focusArea = await manager.createFocusArea('user123', mockFocusAreaData);
      await manager.setActiveFilters('user123', [focusArea.id]);
      
      await manager.deleteFocusArea('user123', focusArea.id);
      
      const activeFilters = await manager.getActiveFilters('user123');
      expect(activeFilters).toHaveLength(0);
    });

    it('should handle non-existent focus area', async () => {
      await expect(manager.deleteFocusArea('user123', 'invalid-id'))
        .rejects.toThrow('Focus area not found');
    });
  });

  describe('getFocusAreas', () => {
    it('should return all focus areas for user', async () => {
      await manager.createFocusArea('user123', mockFocusAreaData);
      await manager.createFocusArea('user123', { ...mockFocusAreaData, name: 'Second Focus' });

      const focusAreas = await manager.getFocusAreas('user123');
      expect(focusAreas).toHaveLength(2);
    });

    it('should return empty array for user with no focus areas', async () => {
      const focusAreas = await manager.getFocusAreas('newuser');
      expect(focusAreas).toEqual([]);
    });
  });

  describe('getFocusArea', () => {
    it('should return specific focus area', async () => {
      const created = await manager.createFocusArea('user123', mockFocusAreaData);
      const retrieved = await manager.getFocusArea('user123', created.id);

      expect(retrieved.id).toBe(created.id);
      expect(retrieved.name).toBe(created.name);
    });

    it('should handle non-existent focus area', async () => {
      await expect(manager.getFocusArea('user123', 'invalid-id'))
        .rejects.toThrow('Focus area not found');
    });
  });

  describe('setActiveFilters', () => {
    it('should set active filters successfully', async () => {
      const focusArea1 = await manager.createFocusArea('user123', mockFocusAreaData);
      const focusArea2 = await manager.createFocusArea('user123', { ...mockFocusAreaData, name: 'Second' });

      const activeFilters = await manager.setActiveFilters('user123', [focusArea1.id, focusArea2.id]);

      expect(activeFilters).toHaveLength(2);
      expect(activeFilters.map(fa => fa.id)).toContain(focusArea1.id);
      expect(activeFilters.map(fa => fa.id)).toContain(focusArea2.id);
    });

    it('should validate focus area IDs', async () => {
      await expect(manager.setActiveFilters('user123', ['invalid-id']))
        .rejects.toThrow('Invalid focus area IDs: invalid-id');
    });

    it('should ignore inactive focus areas', async () => {
      const focusArea = await manager.createFocusArea('user123', mockFocusAreaData);
      await manager.updateFocusArea('user123', focusArea.id, { isActive: false });

      await expect(manager.setActiveFilters('user123', [focusArea.id]))
        .rejects.toThrow('Invalid focus area IDs');
    });
  });

  describe('getActiveFilters', () => {
    it('should return active filters', async () => {
      const focusArea = await manager.createFocusArea('user123', mockFocusAreaData);
      await manager.setActiveFilters('user123', [focusArea.id]);

      const activeFilters = await manager.getActiveFilters('user123');
      expect(activeFilters).toHaveLength(1);
      expect(activeFilters[0].id).toBe(focusArea.id);
    });

    it('should return empty array when no active filters', async () => {
      const activeFilters = await manager.getActiveFilters('user123');
      expect(activeFilters).toEqual([]);
    });
  });

  describe('filterContent', () => {
    it('should filter content based on active focus areas', async () => {
      const focusArea = await manager.createFocusArea('user123', mockFocusAreaData);
      await manager.setActiveFilters('user123', [focusArea.id]);

      const filteredContent = await manager.filterContent('user123', mockContent);

      expect(filteredContent.length).toBeLessThan(mockContent.length);
      expect(filteredContent[0]).toHaveProperty('focusAreaMatches');
      expect(filteredContent[0]).toHaveProperty('focusAreaScore');
      expect(filteredContent[0].focusAreaScore).toBeGreaterThan(0);
    });

    it('should return all content when no active filters', async () => {
      const filteredContent = await manager.filterContent('user123', mockContent);

      expect(filteredContent).toHaveLength(mockContent.length);
      filteredContent.forEach(content => {
        expect(content.focusAreaScore).toBe(0);
        expect(content.focusAreaMatches).toEqual([]);
      });
    });

    it('should sort content by focus area score', async () => {
      const focusArea = await manager.createFocusArea('user123', mockFocusAreaData);
      await manager.setActiveFilters('user123', [focusArea.id]);

      const filteredContent = await manager.filterContent('user123', mockContent);

      // Check that content is sorted by score (descending)
      for (let i = 1; i < filteredContent.length; i++) {
        expect(filteredContent[i-1].focusAreaScore).toBeGreaterThanOrEqual(filteredContent[i].focusAreaScore);
      }
    });

    it('should update focus area statistics', async () => {
      const focusArea = await manager.createFocusArea('user123', mockFocusAreaData);
      await manager.setActiveFilters('user123', [focusArea.id]);

      await manager.filterContent('user123', mockContent);

      const updatedFocusArea = await manager.getFocusArea('user123', focusArea.id);
      expect(updatedFocusArea.contentCount).toBeGreaterThan(0);
      expect(updatedFocusArea.lastMatchedAt).toBeInstanceOf(Date);
    });
  });

  describe('calculateFocusAreaMatch', () => {
    it('should calculate comprehensive match scores', () => {
      const focusArea = {
        id: 'test',
        topics: ['artificial intelligence'],
        categories: ['technology'],
        keywords: ['AI', 'neural'],
        sourceTypes: ['academic']
      };

      const content = mockContent[0]; // AI content

      const match = manager.calculateFocusAreaMatch(content, focusArea);

      expect(match).toHaveProperty('score');
      expect(match).toHaveProperty('breakdown');
      expect(match).toHaveProperty('matchedElements');
      expect(match.score).toBeGreaterThan(0);
      expect(match.breakdown.topicMatch).toBeGreaterThan(0);
      expect(match.breakdown.categoryMatch).toBeGreaterThan(0);
      expect(match.breakdown.sourceTypeMatch).toBe(1.0);
    });

    it('should return zero score for non-matching content', () => {
      const focusArea = {
        id: 'test',
        topics: ['sports'],
        categories: ['entertainment'],
        keywords: ['game', 'score'],
        sourceTypes: ['blog']
      };

      const content = mockContent[0]; // AI content

      const match = manager.calculateFocusAreaMatch(content, focusArea);
      expect(match.score).toBe(0);
    });
  });

  describe('calculateArrayMatch', () => {
    it('should calculate exact matches', () => {
      const contentArray = ['artificial intelligence', 'machine learning'];
      const focusArray = ['artificial intelligence', 'deep learning'];

      const result = manager.calculateArrayMatch(contentArray, focusArray);

      expect(result.score).toBeGreaterThan(0);
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].content).toBe('artificial intelligence');
    });

    it('should handle partial matches', () => {
      const contentArray = ['machine learning'];
      const focusArray = ['machine learning algorithms'];

      const result = manager.calculateArrayMatch(contentArray, focusArray);

      expect(result.score).toBeGreaterThan(0);
      expect(result.matches).toHaveLength(1);
    });

    it('should return zero for no matches', () => {
      const contentArray = ['sports'];
      const focusArray = ['technology'];

      const result = manager.calculateArrayMatch(contentArray, focusArray);

      expect(result.score).toBe(0);
      expect(result.matches).toHaveLength(0);
    });
  });

  describe('calculateKeywordMatch', () => {
    it('should find keywords in content text', () => {
      const content = {
        title: 'AI breakthrough in neural networks',
        description: 'Machine learning algorithms improve'
      };
      const keywords = ['AI', 'neural', 'algorithms'];

      const result = manager.calculateKeywordMatch(content, keywords);

      expect(result.score).toBeGreaterThan(0);
      expect(result.matches).toContain('AI');
      expect(result.matches).toContain('neural');
      expect(result.matches).toContain('algorithms');
    });

    it('should be case insensitive', () => {
      const content = { title: 'ai and machine learning' };
      const keywords = ['AI', 'MACHINE'];

      const result = manager.calculateKeywordMatch(content, keywords);

      expect(result.score).toBeGreaterThan(0);
      expect(result.matches).toContain('AI');
      expect(result.matches).toContain('MACHINE');
    });

    it('should return zero for no keyword matches', () => {
      const content = { title: 'Sports news update' };
      const keywords = ['AI', 'technology'];

      const result = manager.calculateKeywordMatch(content, keywords);

      expect(result.score).toBe(0);
      expect(result.matches).toHaveLength(0);
    });
  });

  describe('getFocusAreaAnalytics', () => {
    it('should return comprehensive analytics', async () => {
      const focusArea1 = await manager.createFocusArea('user123', mockFocusAreaData);
      const focusArea2 = await manager.createFocusArea('user123', { ...mockFocusAreaData, name: 'Second', priority: 'low' });
      await manager.setActiveFilters('user123', [focusArea1.id]);

      const analytics = await manager.getFocusAreaAnalytics('user123');

      expect(analytics).toHaveProperty('totalFocusAreas', 2);
      expect(analytics).toHaveProperty('activeFocusAreas', 1);
      expect(analytics).toHaveProperty('focusAreaStats');
      expect(analytics).toHaveProperty('priorityDistribution');
      expect(analytics).toHaveProperty('activitySummary');

      expect(analytics.focusAreaStats).toHaveLength(2);
      expect(analytics.priorityDistribution.high).toBe(1);
      expect(analytics.priorityDistribution.low).toBe(1);
    });

    it('should handle user with no focus areas', async () => {
      const analytics = await manager.getFocusAreaAnalytics('newuser');

      expect(analytics.totalFocusAreas).toBe(0);
      expect(analytics.activeFocusAreas).toBe(0);
      expect(analytics.focusAreaStats).toEqual([]);
    });
  });

  describe('suggestFocusAreas', () => {
    it('should suggest focus areas based on interaction history', async () => {
      const interactionHistory = [
        {
          type: 'save',
          content: {
            topics: ['artificial intelligence', 'machine learning'],
            categories: ['technology']
          }
        },
        {
          type: 'like',
          content: {
            topics: ['deep learning', 'neural networks'],
            categories: ['technology']
          }
        },
        {
          type: 'share',
          content: {
            topics: ['blockchain', 'cryptocurrency'],
            categories: ['finance']
          }
        }
      ];

      const suggestions = await manager.suggestFocusAreas('user123', interactionHistory);

      expect(suggestions).toBeInstanceOf(Array);
      expect(suggestions.length).toBeGreaterThan(0);
      
      suggestions.forEach(suggestion => {
        expect(suggestion).toHaveProperty('name');
        expect(suggestion).toHaveProperty('topics');
        expect(suggestion).toHaveProperty('reason');
        expect(suggestion).toHaveProperty('confidence');
      });
    });

    it('should return template suggestions for users with no history', async () => {
      const suggestions = await manager.suggestFocusAreas('user123', []);

      expect(suggestions).toBeInstanceOf(Array);
      expect(suggestions.length).toBeGreaterThan(0);
      
      suggestions.forEach(suggestion => {
        expect(suggestion).toHaveProperty('templateId');
        expect(suggestion.reason).toBe('Popular focus area');
      });
    });

    it('should filter out existing focus areas', async () => {
      // Create existing focus area
      await manager.createFocusArea('user123', {
        name: 'Existing AI Focus',
        topics: ['artificial intelligence']
      });

      const interactionHistory = [
        {
          type: 'save',
          content: {
            topics: ['artificial intelligence'],
            categories: ['technology']
          }
        }
      ];

      const suggestions = await manager.suggestFocusAreas('user123', interactionHistory);

      // Should not suggest focus areas that overlap with existing ones
      const hasAIOverlap = suggestions.some(suggestion => 
        suggestion.topics.some(topic => topic.toLowerCase().includes('artificial intelligence'))
      );
      expect(hasAIOverlap).toBe(false);
    });
  });

  describe('string matching and similarity', () => {
    it('should match exact strings', () => {
      expect(manager.isStringMatch('artificial intelligence', 'artificial intelligence')).toBe(true);
    });

    it('should match partial strings', () => {
      expect(manager.isStringMatch('machine learning', 'machine')).toBe(true);
      expect(manager.isStringMatch('AI', 'artificial intelligence')).toBe(false); // Too different
    });

    it('should calculate string similarity', () => {
      const similarity1 = manager.calculateStringSimilarity('machine learning', 'machine learning algorithms');
      const similarity2 = manager.calculateStringSimilarity('sports', 'technology');

      expect(similarity1).toBeGreaterThan(0.5);
      expect(similarity2).toBe(0);
    });
  });

  describe('validation', () => {
    it('should validate focus area name', () => {
      expect(() => manager.validateFocusAreaData({ name: '' }))
        .toThrow('Focus area name is required');

      expect(() => manager.validateFocusAreaData({ name: 'a' }))
        .toThrow('Focus area name must be between 2 and 100 characters');

      expect(() => manager.validateFocusAreaData({ name: 'a'.repeat(101) }))
        .toThrow('Focus area name must be between 2 and 100 characters');
    });

    it('should validate array fields', () => {
      expect(() => manager.validateFocusAreaData({ name: 'Test', topics: 'not-array' }))
        .toThrow('Topics must be an array');

      expect(() => manager.validateFocusAreaData({ name: 'Test', categories: 'not-array' }))
        .toThrow('Categories must be an array');

      expect(() => manager.validateFocusAreaData({ name: 'Test', keywords: 'not-array' }))
        .toThrow('Keywords must be an array');
    });

    it('should validate priority', () => {
      expect(() => manager.validateFocusAreaData({ name: 'Test', priority: 'invalid' }))
        .toThrow('Priority must be one of: high, medium, low');
    });
  });

  describe('configuration and templates', () => {
    it('should return available templates', () => {
      const templates = manager.getAvailableTemplates();
      
      expect(templates).toHaveProperty('technology');
      expect(templates).toHaveProperty('business');
      expect(templates).toHaveProperty('science');
      expect(templates).toHaveProperty('health');
      
      expect(templates.technology).toHaveProperty('name');
      expect(templates.technology).toHaveProperty('topics');
    });

    it('should get and update filter configuration', () => {
      const originalConfig = manager.getFilterConfig();
      expect(originalConfig).toHaveProperty('minimumPassScore');
      expect(originalConfig).toHaveProperty('weights');

      const newConfig = { minimumPassScore: 0.5 };
      manager.updateFilterConfig(newConfig);

      const updatedConfig = manager.getFilterConfig();
      expect(updatedConfig.minimumPassScore).toBe(0.5);
    });

    it('should clear all data', () => {
      manager.focusAreas.set('user123', [{ id: 'test' }]);
      manager.contentFilters.set('user123', ['test']);

      manager.clearAllData();

      expect(manager.focusAreas.size).toBe(0);
      expect(manager.contentFilters.size).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle content without topics or categories', async () => {
      const focusArea = await manager.createFocusArea('user123', mockFocusAreaData);
      await manager.setActiveFilters('user123', [focusArea.id]);

      const contentWithoutTopics = [{
        id: 'content1',
        title: 'Test content',
        description: 'No topics or categories'
      }];

      const filteredContent = await manager.filterContent('user123', contentWithoutTopics);
      expect(filteredContent).toHaveLength(0); // Should be filtered out
    });

    it('should handle focus areas without topics or categories', async () => {
      const minimalFocusArea = {
        name: 'Minimal Focus',
        keywords: ['test']
      };

      const focusArea = await manager.createFocusArea('user123', minimalFocusArea);
      expect(focusArea.topics).toEqual([]);
      expect(focusArea.categories).toEqual([]);
    });

    it('should handle empty interaction history gracefully', async () => {
      const patterns = manager.analyzeInteractionPatterns([]);
      expect(patterns.totalInteractions).toBe(0);
      expect(patterns.topTopics).toEqual({});
    });
  });
});