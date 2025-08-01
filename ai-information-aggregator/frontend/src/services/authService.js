import api, { tokenManager, handleApiError } from './api';
import { centralizedApiService } from './centralizedApiService';

export const authService = {
  // Login user - now uses centralized service
  login: async (credentials) => {
    return centralizedApiService.auth.login(credentials);
  },

  // Register user - now uses centralized service
  register: async (userData) => {
    return centralizedApiService.auth.register(userData);
  },

  // Logout user - now uses centralized service
  logout: async () => {
    return centralizedApiService.auth.logout();
  },

  // Get current user profile - now uses centralized service
  getCurrentUser: async () => {
    return centralizedApiService.auth.getCurrentUser();
  },

  // Update user profile - now uses centralized service
  updateProfile: async (profileData) => {
    return centralizedApiService.auth.updateProfile(profileData);
  },

  // Change password - now uses centralized service
  changePassword: async (passwordData) => {
    return centralizedApiService.auth.changePassword(passwordData);
  },

  // Request password reset - now uses centralized service
  requestPasswordReset: async (email) => {
    return centralizedApiService.auth.requestPasswordReset(email);
  },

  // Reset password - now uses centralized service
  resetPassword: async (resetData) => {
    return centralizedApiService.auth.resetPassword(resetData);
  },

  // Check if user is authenticated - now uses centralized service
  isAuthenticated: () => {
    return centralizedApiService.auth.isAuthenticated();
  },
};