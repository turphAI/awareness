import axios from 'axios';

// Determine API base URL based on environment
const getApiBaseUrl = () => {
  // In production (Vercel), use relative path
  if (process.env.NODE_ENV === 'production') {
    return '/api';
  }
  
  // In development, use environment variable or localhost
  return process.env.REACT_APP_API_URL || 'http://localhost:3000/api';
};

const API_BASE_URL = getApiBaseUrl();
console.log('API Base URL:', API_BASE_URL);

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
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

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only redirect on 401 if it's an auth-related endpoint or if the error message indicates invalid token
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
    return Promise.reject(error);
  }
);

export default api;