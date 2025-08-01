import { centralizedApiService } from '../centralizedApiService';
import { tokenManager } from '../api';

// Mock the API service
jest.mock('../api', () => ({
  apiService: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    batch: jest.fn(),
    upload: jest.fn(),
    healthCheck: jest.fn()
  },
  tokenManager: {
    getToken: jest.fn(),
    setToken: jest.fn(),
    removeToken: jest.fn(),
    isTokenValid: jest.fn()
  },
  handleApiError: jest.fn((error) => error.message || 'API Error'),
  loadingManager: {
    setLoading: jest.fn(),
    isLoading: jest.fn(),
    subscribe: jest.fn(),
    notifyListeners: jest.fn()
  }
}));

describe('CentralizedApiService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication Service', () => {
    test('login should call API and set token', async () => {
      const mockResponse = { token: 'test-token', user: { id: 1, email: 'test@example.com' } };
      const { apiService } = require('../api');
      apiService.post.mockResolvedValue(mockResponse);

      const result = await centralizedApiService.auth.login({ email: 'test@example.com', password: 'password' });

      expect(apiService.post).toHaveBeenCalledWith('/auth/login', { email: 'test@example.com', password: 'password' });
      expect(tokenManager.setToken).toHaveBeenCalledWith('test-token');
      expect(result).toEqual(mockResponse);
    });

    test('logout should call API and remove token', async () => {
      const { apiService } = require('../api');
      apiService.post.mockResolvedValue({});

      await centralizedApiService.auth.logout();

      expect(apiService.post).toHaveBeenCalledWith('/auth/logout');
      expect(tokenManager.removeToken).toHaveBeenCalled();
    });

    test('isAuthenticated should check token validity', () => {
      tokenManager.getToken.mockReturnValue('test-token');
      tokenManager.isTokenValid.mockReturnValue(true);

      const result = centralizedApiService.auth.isAuthenticated();

      expect(result).toBe(true);
      expect(tokenManager.getToken).toHaveBeenCalled();
      expect(tokenManager.isTokenValid).toHaveBeenCalled();
    });
  });

  describe('Sources Service', () => {
    test('getAll should fetch all sources', async () => {
      const mockSources = [{ id: 1, name: 'Test Source' }];
      const { apiService } = require('../api');
      apiService.get.mockResolvedValue(mockSources);

      const result = await centralizedApiService.sources.getAll();

      expect(apiService.get).toHaveBeenCalledWith('/sources');
      expect(result).toEqual(mockSources);
    });

    test('create should create a new source', async () => {
      const sourceData = { name: 'New Source', url: 'https://example.com' };
      const mockResponse = { id: 1, ...sourceData };
      const { apiService } = require('../api');
      apiService.post.mockResolvedValue(mockResponse);

      const result = await centralizedApiService.sources.create(sourceData);

      expect(apiService.post).toHaveBeenCalledWith('/sources', sourceData);
      expect(result).toEqual(mockResponse);
    });

    test('update should update an existing source', async () => {
      const sourceId = 1;
      const updateData = { name: 'Updated Source' };
      const mockResponse = { id: sourceId, ...updateData };
      const { apiService } = require('../api');
      apiService.put.mockResolvedValue(mockResponse);

      const result = await centralizedApiService.sources.update(sourceId, updateData);

      expect(apiService.put).toHaveBeenCalledWith(`/sources/${sourceId}`, updateData);
      expect(result).toEqual(mockResponse);
    });

    test('delete should delete a source', async () => {
      const sourceId = 1;
      const mockResponse = { success: true };
      const { apiService } = require('../api');
      apiService.delete.mockResolvedValue(mockResponse);

      const result = await centralizedApiService.sources.delete(sourceId);

      expect(apiService.delete).toHaveBeenCalledWith(`/sources/${sourceId}`);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('Content Service', () => {
    test('search should search content with parameters', async () => {
      const searchParams = { query: 'test', limit: 10 };
      const mockResults = [{ id: 1, title: 'Test Content' }];
      const { apiService } = require('../api');
      apiService.get.mockResolvedValue(mockResults);

      const result = await centralizedApiService.content.search(searchParams);

      expect(apiService.get).toHaveBeenCalledWith('/content/search', searchParams);
      expect(result).toEqual(mockResults);
    });

    test('getUserContent should fetch user content', async () => {
      const params = { page: 1, limit: 20 };
      const mockContent = [{ id: 1, title: 'User Content' }];
      const { apiService } = require('../api');
      apiService.get.mockResolvedValue(mockContent);

      const result = await centralizedApiService.content.getUserContent(params);

      expect(apiService.get).toHaveBeenCalledWith('/content', params);
      expect(result).toEqual(mockContent);
    });
  });

  describe('Categories Service', () => {
    test('getAll should fetch all categories', async () => {
      const mockCategories = [{ id: 1, name: 'Test Category' }];
      const { apiService } = require('../api');
      apiService.get.mockResolvedValue(mockCategories);

      const result = await centralizedApiService.categories.getAll();

      expect(apiService.get).toHaveBeenCalledWith('/categories');
      expect(result).toEqual(mockCategories);
    });

    test('create should create a new category', async () => {
      const categoryData = { name: 'New Category', description: 'Test description' };
      const mockResponse = { id: 1, ...categoryData };
      const { apiService } = require('../api');
      apiService.post.mockResolvedValue(mockResponse);

      const result = await centralizedApiService.categories.create(categoryData);

      expect(apiService.post).toHaveBeenCalledWith('/categories', categoryData);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('Collections Service', () => {
    test('getUserCollections should fetch user collections', async () => {
      const params = { page: 1 };
      const mockCollections = [{ id: 1, name: 'Test Collection' }];
      const { apiService } = require('../api');
      apiService.get.mockResolvedValue(mockCollections);

      const result = await centralizedApiService.collections.getUserCollections(params);

      expect(apiService.get).toHaveBeenCalledWith('/collections', params);
      expect(result).toEqual(mockCollections);
    });

    test('create should create a new collection', async () => {
      const collectionData = { name: 'New Collection', description: 'Test collection' };
      const mockResponse = { id: 1, ...collectionData };
      const { apiService } = require('../api');
      apiService.post.mockResolvedValue(mockResponse);

      const result = await centralizedApiService.collections.create(collectionData);

      expect(apiService.post).toHaveBeenCalledWith('/collections', collectionData);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('Configuration Service', () => {
    test('getAllSettings should batch fetch all configuration settings', async () => {
      const mockResults = [
        { topicPreferences: {} },
        { notificationSettings: {} },
        { contentVolumeSettings: {} },
        { discoverySettings: {} },
        { summaryPreferences: {} },
        { digestScheduling: {} }
      ];
      const { apiService } = require('../api');
      apiService.batch.mockResolvedValue(mockResults);

      const result = await centralizedApiService.configuration.getAllSettings();

      expect(apiService.batch).toHaveBeenCalledWith([
        { method: 'GET', url: '/configuration/topic-preferences' },
        { method: 'GET', url: '/configuration/notification-settings' },
        { method: 'GET', url: '/configuration/content-volume' },
        { method: 'GET', url: '/configuration/discovery-settings' },
        { method: 'GET', url: '/configuration/summary-preferences' },
        { method: 'GET', url: '/configuration/digest-scheduling' }
      ]);
      expect(result).toEqual({
        topicPreferences: mockResults[0],
        notificationSettings: mockResults[1],
        contentVolumeSettings: mockResults[2],
        discoverySettings: mockResults[3],
        summaryPreferences: mockResults[4],
        digestScheduling: mockResults[5]
      });
    });
  });

  describe('Utility Functions', () => {
    test('healthCheck should call API health check', async () => {
      const { apiService } = require('../api');
      apiService.healthCheck.mockResolvedValue(true);

      const result = await centralizedApiService.utils.healthCheck();

      expect(apiService.healthCheck).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle API errors consistently', async () => {
      const mockError = new Error('Network error');
      const { apiService, handleApiError } = require('../api');
      apiService.get.mockRejectedValue(mockError);
      handleApiError.mockReturnValue('Network error');

      await expect(centralizedApiService.sources.getAll()).rejects.toThrow('Network error');
      expect(handleApiError).toHaveBeenCalledWith(mockError);
    });

    test('should handle authentication errors in logout', async () => {
      const mockError = new Error('Logout failed');
      const { apiService } = require('../api');
      apiService.post.mockRejectedValue(mockError);

      // Should not throw error, just log and remove token
      await centralizedApiService.auth.logout();

      expect(tokenManager.removeToken).toHaveBeenCalled();
    });
  });
});