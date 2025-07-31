// Example usage of the authentication API

class AuthService {
  constructor(baseUrl = '') {
    this.baseUrl = baseUrl;
    this.token = localStorage.getItem('authToken');
  }

  // Set authentication token
  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('authToken', token);
    } else {
      localStorage.removeItem('authToken');
    }
  }

  // Get authentication headers
  getAuthHeaders() {
    return {
      'Content-Type': 'application/json',
      ...(this.token && { Authorization: `Bearer ${this.token}` })
    };
  }

  // Register a new user
  async register(email, password, name) {
    try {
      const response = await fetch(`${this.baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name })
      });

      const data = await response.json();

      if (data.success) {
        this.setToken(data.token);
        return { success: true, user: data.user };
      } else {
        return { success: false, error: data.error };
      }
    } catch (error) {
      return { success: false, error: 'Network error' };
    }
  }

  // Login user
  async login(email, password) {
    try {
      const response = await fetch(`${this.baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (data.success) {
        this.setToken(data.token);
        return { success: true, user: data.user };
      } else {
        return { success: false, error: data.error };
      }
    } catch (error) {
      return { success: false, error: 'Network error' };
    }
  }

  // Get user profile
  async getProfile() {
    try {
      const response = await fetch(`${this.baseUrl}/api/auth/profile`, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      const data = await response.json();

      if (data.success) {
        return { success: true, user: data.user };
      } else {
        return { success: false, error: data.error };
      }
    } catch (error) {
      return { success: false, error: 'Network error' };
    }
  }

  // Update user profile
  async updateProfile(updates) {
    try {
      const response = await fetch(`${this.baseUrl}/api/auth/profile`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(updates)
      });

      const data = await response.json();

      if (data.success) {
        return { success: true, message: data.message };
      } else {
        return { success: false, error: data.error };
      }
    } catch (error) {
      return { success: false, error: 'Network error' };
    }
  }

  // Change password
  async changePassword(currentPassword, newPassword) {
    try {
      const response = await fetch(`${this.baseUrl}/api/auth/change-password`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ currentPassword, newPassword })
      });

      const data = await response.json();

      if (data.success) {
        return { success: true, message: data.message };
      } else {
        return { success: false, error: data.error };
      }
    } catch (error) {
      return { success: false, error: 'Network error' };
    }
  }

  // Logout user
  logout() {
    this.setToken(null);
    return { success: true };
  }

  // Check if user is authenticated
  isAuthenticated() {
    return !!this.token;
  }

  // Check API health
  async checkHealth() {
    try {
      const response = await fetch(`${this.baseUrl}/api/health`);
      const data = await response.json();
      return data;
    } catch (error) {
      return { success: false, error: 'Network error' };
    }
  }
}

// Usage examples:

// Initialize the auth service
const authService = new AuthService();

// Example: Register a new user
async function registerUser() {
  const result = await authService.register(
    'user@example.com',
    'SecurePassword123',
    'John Doe'
  );

  if (result.success) {
    console.log('Registration successful:', result.user);
  } else {
    console.error('Registration failed:', result.error);
  }
}

// Example: Login user
async function loginUser() {
  const result = await authService.login('user@example.com', 'SecurePassword123');

  if (result.success) {
    console.log('Login successful:', result.user);
  } else {
    console.error('Login failed:', result.error);
  }
}

// Example: Get user profile
async function getUserProfile() {
  const result = await authService.getProfile();

  if (result.success) {
    console.log('User profile:', result.user);
  } else {
    console.error('Failed to get profile:', result.error);
  }
}

// Example: Update user preferences
async function updateUserPreferences() {
  const result = await authService.updateProfile({
    preferences: {
      topics: ['technology', 'science'],
      contentVolume: 15,
      summaryLength: 'long'
    }
  });

  if (result.success) {
    console.log('Profile updated successfully');
  } else {
    console.error('Failed to update profile:', result.error);
  }
}

// Example: Change password
async function changeUserPassword() {
  const result = await authService.changePassword(
    'OldPassword123',
    'NewSecurePassword456'
  );

  if (result.success) {
    console.log('Password changed successfully');
  } else {
    console.error('Failed to change password:', result.error);
  }
}

// Example: Check authentication status
function checkAuthStatus() {
  if (authService.isAuthenticated()) {
    console.log('User is authenticated');
  } else {
    console.log('User is not authenticated');
  }
}

// Example: Logout user
function logoutUser() {
  const result = authService.logout();
  console.log('User logged out');
}

// Example: Check API health
async function checkApiHealth() {
  const result = await authService.checkHealth();
  console.log('API Health:', result);
}

// Export for use in other modules
export default AuthService;