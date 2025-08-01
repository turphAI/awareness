import { useState, useEffect, useCallback } from 'react';
import { centralizedApiService } from '../services/centralizedApiService';

/**
 * Custom hook for API calls with loading states and error handling
 * @param {Function} apiCall - The API function to call
 * @param {Array} dependencies - Dependencies for the API call
 * @param {Object} options - Options for the hook
 * @returns {Object} - { data, loading, error, refetch, mutate }
 */
export const useApi = (apiCall, dependencies = [], options = {}) => {
  const {
    immediate = true,
    onSuccess,
    onError,
    initialData = null
  } = options;

  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);

  const execute = useCallback(async (...args) => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await apiCall(...args);
      setData(result);
      
      if (onSuccess) {
        onSuccess(result);
      }
      
      return result;
    } catch (err) {
      const errorMessage = err.message || 'An error occurred';
      setError(errorMessage);
      
      if (onError) {
        onError(err);
      }
      
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiCall, onSuccess, onError]);

  const refetch = useCallback(() => {
    return execute();
  }, [execute]);

  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, dependencies);

  return {
    data,
    loading,
    error,
    refetch,
    mutate: execute
  };
};

/**
 * Hook for mutation operations (POST, PUT, DELETE)
 * @param {Function} mutationFn - The mutation function
 * @param {Object} options - Options for the mutation
 * @returns {Object} - { mutate, loading, error, data }
 */
export const useMutation = (mutationFn, options = {}) => {
  const {
    onSuccess,
    onError,
    onSettled
  } = options;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const mutate = useCallback(async (variables) => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await mutationFn(variables);
      setData(result);
      
      if (onSuccess) {
        onSuccess(result, variables);
      }
      
      return result;
    } catch (err) {
      const errorMessage = err.message || 'An error occurred';
      setError(errorMessage);
      
      if (onError) {
        onError(err, variables);
      }
      
      throw err;
    } finally {
      setLoading(false);
      
      if (onSettled) {
        onSettled(data, error);
      }
    }
  }, [mutationFn, onSuccess, onError, onSettled, data, error]);

  return {
    mutate,
    loading,
    error,
    data,
    reset: () => {
      setData(null);
      setError(null);
      setLoading(false);
    }
  };
};

/**
 * Hook for managing loading states across the application
 * @returns {Object} - { loadingStates, isLoading }
 */
export const useLoadingStates = () => {
  const [loadingStates, setLoadingStates] = useState(new Map());

  useEffect(() => {
    const unsubscribe = centralizedApiService.utils.subscribeToLoading((states) => {
      setLoadingStates(new Map(states));
    });

    return unsubscribe;
  }, []);

  const isLoading = useCallback((key) => {
    return loadingStates.get(key) || false;
  }, [loadingStates]);

  return {
    loadingStates,
    isLoading
  };
};

/**
 * Hook for authentication-related API calls
 * @returns {Object} - Authentication methods and state
 */
export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        if (centralizedApiService.auth.isAuthenticated()) {
          const userData = await centralizedApiService.auth.getCurrentUser();
          setUser(userData);
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        setIsAuthenticated(false);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = useMutation(centralizedApiService.auth.login, {
    onSuccess: (result) => {
      setUser(result.user);
      setIsAuthenticated(true);
    }
  });

  const register = useMutation(centralizedApiService.auth.register, {
    onSuccess: (result) => {
      setUser(result.user);
      setIsAuthenticated(true);
    }
  });

  const logout = useMutation(centralizedApiService.auth.logout, {
    onSuccess: () => {
      setUser(null);
      setIsAuthenticated(false);
    }
  });

  const updateProfile = useMutation(centralizedApiService.auth.updateProfile, {
    onSuccess: (result) => {
      setUser(result);
    }
  });

  return {
    user,
    isAuthenticated,
    loading,
    login: login.mutate,
    register: register.mutate,
    logout: logout.mutate,
    updateProfile: updateProfile.mutate,
    loginLoading: login.loading,
    registerLoading: register.loading,
    logoutLoading: logout.loading,
    updateProfileLoading: updateProfile.loading,
    loginError: login.error,
    registerError: register.error,
    logoutError: logout.error,
    updateProfileError: updateProfile.error
  };
};

/**
 * Hook for source management
 * @returns {Object} - Source management methods and state
 */
export const useSources = () => {
  const {
    data: sources,
    loading,
    error,
    refetch
  } = useApi(centralizedApiService.sources.getAll, [], {
    initialData: []
  });

  const createSource = useMutation(centralizedApiService.sources.create, {
    onSuccess: () => refetch()
  });

  const updateSource = useMutation(
    ({ id, data }) => centralizedApiService.sources.update(id, data),
    {
      onSuccess: () => refetch()
    }
  );

  const deleteSource = useMutation(centralizedApiService.sources.delete, {
    onSuccess: () => refetch()
  });

  const updateRelevance = useMutation(
    ({ id, score, reason }) => centralizedApiService.sources.updateRelevance(id, score, reason),
    {
      onSuccess: () => refetch()
    }
  );

  return {
    sources,
    loading,
    error,
    refetch,
    createSource: createSource.mutate,
    updateSource: updateSource.mutate,
    deleteSource: deleteSource.mutate,
    updateRelevance: updateRelevance.mutate,
    createLoading: createSource.loading,
    updateLoading: updateSource.loading,
    deleteLoading: deleteSource.loading,
    relevanceLoading: updateRelevance.loading,
    createError: createSource.error,
    updateError: updateSource.error,
    deleteError: deleteSource.error,
    relevanceError: updateRelevance.error
  };
};

/**
 * Hook for category management
 * @returns {Object} - Category management methods and state
 */
export const useCategories = () => {
  const {
    data: categories,
    loading,
    error,
    refetch
  } = useApi(centralizedApiService.categories.getAll, [], {
    initialData: []
  });

  const createCategory = useMutation(centralizedApiService.categories.create, {
    onSuccess: () => refetch()
  });

  const updateCategory = useMutation(
    ({ id, data }) => centralizedApiService.categories.update(id, data),
    {
      onSuccess: () => refetch()
    }
  );

  const deleteCategory = useMutation(centralizedApiService.categories.delete, {
    onSuccess: () => refetch()
  });

  return {
    categories,
    loading,
    error,
    refetch,
    createCategory: createCategory.mutate,
    updateCategory: updateCategory.mutate,
    deleteCategory: deleteCategory.mutate,
    createLoading: createCategory.loading,
    updateLoading: updateCategory.loading,
    deleteLoading: deleteCategory.loading,
    createError: createCategory.error,
    updateError: updateCategory.error,
    deleteError: deleteCategory.error
  };
};

/**
 * Hook for content management
 * @param {Object} params - Query parameters for content
 * @returns {Object} - Content management methods and state
 */
export const useContent = (params = {}) => {
  const {
    data: content,
    loading,
    error,
    refetch
  } = useApi(
    () => centralizedApiService.content.getUserContent(params),
    [JSON.stringify(params)],
    { initialData: [] }
  );

  const createContent = useMutation(centralizedApiService.content.create, {
    onSuccess: () => refetch()
  });

  const updateContent = useMutation(
    ({ id, data }) => centralizedApiService.content.update(id, data),
    {
      onSuccess: () => refetch()
    }
  );

  const deleteContent = useMutation(centralizedApiService.content.delete, {
    onSuccess: () => refetch()
  });

  const searchContent = useMutation(centralizedApiService.content.search);

  return {
    content,
    loading,
    error,
    refetch,
    createContent: createContent.mutate,
    updateContent: updateContent.mutate,
    deleteContent: deleteContent.mutate,
    searchContent: searchContent.mutate,
    createLoading: createContent.loading,
    updateLoading: updateContent.loading,
    deleteLoading: deleteContent.loading,
    searchLoading: searchContent.loading,
    createError: createContent.error,
    updateError: updateContent.error,
    deleteError: deleteContent.error,
    searchError: searchContent.error,
    searchResults: searchContent.data
  };
};

/**
 * Hook for collection management
 * @returns {Object} - Collection management methods and state
 */
export const useCollections = () => {
  const {
    data: collections,
    loading,
    error,
    refetch
  } = useApi(centralizedApiService.collections.getUserCollections, [], {
    initialData: []
  });

  const createCollection = useMutation(centralizedApiService.collections.create, {
    onSuccess: () => refetch()
  });

  const updateCollection = useMutation(
    ({ id, data }) => centralizedApiService.collections.update(id, data),
    {
      onSuccess: () => refetch()
    }
  );

  const deleteCollection = useMutation(centralizedApiService.collections.delete, {
    onSuccess: () => refetch()
  });

  return {
    collections,
    loading,
    error,
    refetch,
    createCollection: createCollection.mutate,
    updateCollection: updateCollection.mutate,
    deleteCollection: deleteCollection.mutate,
    createLoading: createCollection.loading,
    updateLoading: updateCollection.loading,
    deleteLoading: deleteCollection.loading,
    createError: createCollection.error,
    updateError: updateCollection.error,
    deleteError: deleteCollection.error
  };
};

export default {
  useApi,
  useMutation,
  useLoadingStates,
  useAuth,
  useSources,
  useCategories,
  useContent,
  useCollections
};