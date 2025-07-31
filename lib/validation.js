/**
 * API Error class for consistent error handling
 */
export class ApiError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'ApiError';
  }
}

/**
 * Validate email format
 */
export function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate password strength
 */
export function validatePassword(password) {
  if (!password || password.length < 8) {
    throw new ApiError('Password must be at least 8 characters long', 400);
  }
  
  if (!/(?=.*[a-z])/.test(password)) {
    throw new ApiError('Password must contain at least one lowercase letter', 400);
  }
  
  if (!/(?=.*[A-Z])/.test(password)) {
    throw new ApiError('Password must contain at least one uppercase letter', 400);
  }
  
  if (!/(?=.*\d)/.test(password)) {
    throw new ApiError('Password must contain at least one number', 400);
  }
  
  return true;
}

/**
 * Validate user registration data
 */
export function validateRegistrationData(data) {
  const { email, password, name } = data;
  
  if (!email || !password || !name) {
    throw new ApiError('Email, password, and name are required', 400);
  }
  
  if (!validateEmail(email)) {
    throw new ApiError('Please provide a valid email address', 400);
  }
  
  validatePassword(password);
  
  if (name.length < 2 || name.length > 50) {
    throw new ApiError('Name must be between 2 and 50 characters', 400);
  }
  
  return true;
}

/**
 * Validate login data
 */
export function validateLoginData(data) {
  const { email, password } = data;
  
  if (!email || !password) {
    throw new ApiError('Email and password are required', 400);
  }
  
  if (!validateEmail(email)) {
    throw new ApiError('Please provide a valid email address', 400);
  }
  
  return true;
}

/**
 * Handle API errors consistently
 */
export function handleApiError(error, res) {
  console.error('API Error:', error);

  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({
      success: false,
      error: error.message
    });
  }

  // Handle specific database errors
  if (error.code === 'ER_DUP_ENTRY') {
    return res.status(400).json({
      success: false,
      error: 'User with this email already exists'
    });
  }

  return res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
}