# Authentication API Documentation

This document describes the authentication serverless functions for the Vercel deployment.

## Overview

The authentication system provides JWT-based authentication with secure password handling and user profile management. All functions are designed to work as Vercel serverless functions with PlanetScale MySQL database.

## Environment Variables

The following environment variables are required:

```bash
# Database Configuration
DATABASE_HOST=your-planetscale-host
DATABASE_USERNAME=your-planetscale-username
DATABASE_PASSWORD=your-planetscale-password
DATABASE_NAME=your-database-name

# JWT Configuration
JWT_SECRET=your-super-secure-jwt-secret-key
JWT_EXPIRATION=7d

# Application
NODE_ENV=production
```

## API Endpoints

### POST /api/auth/register

Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123",
  "name": "John Doe"
}
```

**Response (201):**
```json
{
  "success": true,
  "token": "jwt-token-here",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user",
    "emailVerified": false
  },
  "message": "Registration successful. Please verify your email."
}
```

**Error Response (400):**
```json
{
  "success": false,
  "error": "User with this email already exists"
}
```

### POST /api/auth/login

Authenticate a user and return a JWT token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123"
}
```

**Response (200):**
```json
{
  "success": true,
  "token": "jwt-token-here",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user",
    "emailVerified": true
  }
}
```

**Error Response (401):**
```json
{
  "success": false,
  "error": "Invalid credentials"
}
```

### GET /api/auth/profile

Get the current user's profile information.

**Headers:**
```
Authorization: Bearer jwt-token-here
```

**Response (200):**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user",
    "emailVerified": true,
    "lastLogin": "2024-01-15T10:30:00Z",
    "preferences": {
      "topics": [],
      "contentVolume": 10,
      "discoveryAggressiveness": 0.5,
      "summaryLength": "medium",
      "digestFrequency": "daily"
    },
    "notifications": {
      "email": true,
      "push": true,
      "digest": true
    },
    "profile": {},
    "dataRetention": {
      "contentHistory": true,
      "searchHistory": true,
      "interactionData": true,
      "usageStatistics": true
    },
    "privacySettings": {
      "shareUsageData": true,
      "allowRecommendations": true,
      "allowContentTracking": true,
      "allowThirdPartySharing": false
    },
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

### PUT /api/auth/profile

Update the current user's profile information.

**Headers:**
```
Authorization: Bearer jwt-token-here
```

**Request Body:**
```json
{
  "name": "Updated Name",
  "preferences": {
    "topics": ["technology", "science"],
    "contentVolume": 15,
    "summaryLength": "long"
  },
  "notifications": {
    "email": false,
    "push": true,
    "digest": true
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Profile updated successfully"
}
```

### POST /api/auth/change-password

Change the current user's password.

**Headers:**
```
Authorization: Bearer jwt-token-here
```

**Request Body:**
```json
{
  "currentPassword": "OldPassword123",
  "newPassword": "NewSecurePassword456"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

**Error Response (401):**
```json
{
  "success": false,
  "error": "Current password is incorrect"
}
```

### GET /api/health

Health check endpoint to verify API and database connectivity.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-15T10:30:00Z",
    "database": "connected",
    "environment": "production"
  }
}
```

**Error Response (503):**
```json
{
  "success": false,
  "error": "Service unavailable",
  "details": {
    "database": "disconnected",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

## Authentication Flow

1. **Registration**: User registers with email, password, and name
2. **Login**: User authenticates with email and password, receives JWT token
3. **Authenticated Requests**: Include JWT token in Authorization header
4. **Token Validation**: Server validates JWT token for protected endpoints

## Security Features

- **Password Hashing**: Uses bcrypt with salt rounds of 12
- **JWT Tokens**: Secure token generation with configurable expiration
- **Input Validation**: Comprehensive validation for all user inputs
- **SQL Injection Protection**: Parameterized queries for all database operations
- **Error Handling**: Consistent error responses without sensitive information leakage

## Password Requirements

- Minimum 8 characters
- At least one lowercase letter
- At least one uppercase letter
- At least one number

## Database Schema

The authentication system uses the following MySQL tables:

### users table
```sql
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(50) NOT NULL,
    role ENUM('user', 'admin', 'editor', 'moderator') DEFAULT 'user',
    preferences JSON DEFAULT NULL,
    notifications JSON DEFAULT NULL,
    profile JSON DEFAULT NULL,
    email_verification_token VARCHAR(255) DEFAULT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    last_login DATETIME DEFAULT CURRENT_TIMESTAMP,
    active BOOLEAN DEFAULT TRUE,
    data_retention JSON DEFAULT NULL,
    privacy_settings JSON DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

## Testing

The authentication system includes comprehensive tests:

- Unit tests for all endpoints
- Integration tests for complete authentication flow
- Error handling tests
- Security validation tests

Run tests with:
```bash
npm run test:auth
```

## Deployment

The authentication functions are designed to work seamlessly with Vercel's serverless platform:

1. Functions auto-scale based on demand
2. Database connections are optimized for serverless environments
3. Environment variables are securely managed through Vercel
4. HTTPS is automatically provided by Vercel's edge network

## Error Codes

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 201 | Created (registration) |
| 400 | Bad Request (validation errors) |
| 401 | Unauthorized (invalid credentials/token) |
| 404 | Not Found (user not found) |
| 405 | Method Not Allowed |
| 500 | Internal Server Error |
| 503 | Service Unavailable (database issues) |