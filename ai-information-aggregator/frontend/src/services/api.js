import axios from 'axios';

// Determine API base URL based on environment
const getApiBaseUrl = () => {
  // Use environment variable if available
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  
  // In production (Vercel), use relative path
  if (process.env.NODE_ENV === 'production') {
    return '/api';
  }
  
  // In development, default to localhost
  return 'http://localhost:3000/api';
};

const API_BASE_URL = getApiBaseUrl();

// Only log in development
if (process.env.NODE_ENV === 'development') {
  console.log('API Base URL:', API_BASE_URL);
}

// Create axios instance with serverless-optimized configuration
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 second timeout for serverless functions
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token management
const TOKEN_KEY = 'auth_token';

export const tokenManager = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  setToken: (token) => localStorage.setItem(TOKEN_KEY, token),
  removeToken: () => localStorage.removeItem(TOKEN_KEY),
  isTokenValid: () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return false;
    
    try {
      // Basic JWT validation - check if token is expired
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  }
};

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = tokenManager.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle auth errors and serverless-specific issues
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle timeout errors (common with cold starts)
    if (error.code === 'ECONNABORTED' && error.message.includes('timeout')) {
      console.warn('Request timeout - this might be due to serverless cold start');
    }
    
    // Handle authentication errors
    if (error.response?.status === 401) {
      const isAuthEndpoint = error.config?.url?.includes('/auth/');
      const isTokenError = error.response?.data?.error === 'Token expired' || 
                          error.response?.data?.error === 'Invalid token' ||
                          error.response?.data?.error === 'Authentication required';
      
      // Only redirect if it's clearly an authentication issue, not a missing endpoint
      if (isAuthEndpoint || isTokenError) {
        tokenManager.removeToken();
        window.location.href = '/login';
      }
    }
    
    // Handle serverless function errors
    if (error.response?.status === 500) {
      console.error('Server error - this might be a serverless function issue:', error.response?.data);
    }
    
    return Promise.reject(error);
  }
);

// Utility function to handle API errors consistently
export const handleApiError = (error) => {
  if (error.code === 'ECONNABORTED') {
    return 'Request timeout. Please try again.';
  }
  
  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  
  if (error.response?.data?.error) {
    return error.response.data.error;
  }
  
  if (error.response?.status === 404) {
    return 'Resource not found';
  }
  
  if (error.response?.status === 500) {
    return 'Server error. Please try again later.';
  }
  
  return error.message || 'An unexpected error occurred';
};

// Loading state management
class LoadingManager {
  constructor() {
    this.loadingStates = new Map();
    this.listeners = new Set();
  }

  setLoading(key, isLoading) {
    this.loadingStates.set(key, isLoading);
    this.notifyListeners();
  }

  isLoading(key) {
    return this.loadingStates.get(key) || false;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notifyListeners() {
    this.listeners.forEach(listener => listener(this.loadingStates));
  }
}

export const loadingManager = new LoadingManager();

// Centralized API service class
class ApiService {
  constructor() {
    this.api = api;
  }

  // Generic request method with loading state management
  async request(method, url, data = null, options = {}) {
    const loadingKey = `${method.toUpperCase()}_${url}`;
    
    try {
      loadingManager.setLoading(loadingKey, true);
      
      const config = {
        method,
        url,
        ...options
      };

      if (data) {
        if (method.toLowerCase() === 'get') {
          config.params = data;
        } else {
          config.data = data;
        }
      }

      const response = await this.api(config);
      return response.data;
    } catch (error) {
      throw error;
    } finally {
      loadingManager.setLoading(loadingKey, false);
    }
  }

  // HTTP method shortcuts
  async get(url, params = null, options = {}) {
    return this.request('GET', url, params, options);
  }

  async post(url, data = null, options = {}) {
    return this.request('POST', url, data, options);
  }

  async put(url, data = null, options = {}) {
    return this.request('PUT', url, data, options);
  }

  async patch(url, data = null, options = {}) {
    return this.request('PATCH', url, data, options);
  }

  async delete(url, data = null, options = {}) {
    return this.request('DELETE', url, data, options);
  }

  // Batch requests
  async batch(requests) {
    const promises = requests.map(({ method, url, data, options }) => 
      this.request(method, url, data, options).catch(error => ({ error }))
    );
    
    return Promise.all(promises);
  }

  // Upload file
  async upload(url, file, onProgress = null) {
    const formData = new FormData();
    formData.append('file', file);

    const options = {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    };

    if (onProgress) {
      options.onUploadProgress = (progressEvent) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(percentCompleted);
      };
    }

    return this.post(url, formData, options);
  }

  // Check if endpoint is available
  async healthCheck(endpoint = '/health') {
    try {
      await this.get(endpoint);
      return true;
    } catch {
      return false;
    }
  }
}

// Create singleton instance
export const apiService = new ApiService();

export default api;