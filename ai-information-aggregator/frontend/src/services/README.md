# Frontend API Service Layer

This document describes the centralized API service layer implemented for the Vercel deployment. The new architecture provides consistent error handling, loading state management, and authentication token management across all API calls.

## Architecture Overview

The API service layer consists of several key components:

1. **Base API Service** (`api.js`) - Core axios configuration and interceptors
2. **Centralized API Service** (`centralizedApiService.js`) - Main service class with all endpoints
3. **Custom Hooks** (`hooks/useApi.js`) - React hooks for API calls with loading states
4. **Individual Services** - Backward-compatible wrappers for existing code

## Key Features

### 1. Centralized Error Handling

All API errors are handled consistently through the `handleApiError` function:

```javascript
export const handleApiError = (error) => {
  if (error.code === 'ECONNABORTED') {
    return 'Request timeout. Please try again.';
  }
  
  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  
  // ... more error handling
  
  return error.message || 'An unexpected error occurred';
};
```

### 2. Loading State Management

The `LoadingManager` class tracks loading states globally:

```javascript
// Check if a specific operation is loading
const isLoading = loadingManager.isLoading('GET_/sources');

// Subscribe to loading state changes
const unsubscribe = loadingManager.subscribe((states) => {
  console.log('Loading states changed:', states);
});
```

### 3. Authentication Token Management

Enhanced token management with validation:

```javascript
export const tokenManager = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  setToken: (token) => localStorage.setItem(TOKEN_KEY, token),
  removeToken: () => localStorage.removeItem(TOKEN_KEY),
  isTokenValid: () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return false;
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  }
};
```

### 4. Serverless-Optimized Configuration

The API service is configured for Vercel serverless functions:

```javascript
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 second timeout for serverless functions
  headers: {
    'Content-Type': 'application/json',
  },
});
```

## Usage Examples

### Using the Centralized API Service

```javascript
import { centralizedApiService } from '../services/centralizedApiService';

// Authentication
const { token, user } = await centralizedApiService.auth.login({
  email: 'user@example.com',
  password: 'password'
});

// Sources
const sources = await centralizedApiService.sources.getAll();
const newSource = await centralizedApiService.sources.create({
  name: 'My Source',
  url: 'https://example.com'
});

// Content
const content = await centralizedApiService.content.search({
  query: 'artificial intelligence',
  limit: 10
});
```

### Using Custom Hooks

```javascript
import { useSources, useContent, useLoadingStates } from '../hooks/useApi';

function MyComponent() {
  // Get sources with automatic loading and error handling
  const {
    sources,
    loading,
    error,
    createSource,
    updateSource,
    deleteSource
  } = useSources();

  // Get global loading states
  const { isLoading } = useLoadingStates();

  // Handle source creation
  const handleCreateSource = async (sourceData) => {
    try {
      await createSource(sourceData);
      // Success is handled automatically
    } catch (error) {
      // Error is handled automatically
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      {sources.map(source => (
        <div key={source.id}>{source.name}</div>
      ))}
    </div>
  );
}
```

### Using the useApi Hook

```javascript
import { useApi, useMutation } from '../hooks/useApi';
import { centralizedApiService } from '../services/centralizedApiService';

function CustomComponent() {
  // Fetch data with automatic loading states
  const { data, loading, error, refetch } = useApi(
    centralizedApiService.sources.getAll,
    [], // dependencies
    {
      onSuccess: (data) => console.log('Sources loaded:', data),
      onError: (error) => console.error('Failed to load sources:', error)
    }
  );

  // Mutation for creating data
  const { mutate: createSource, loading: createLoading } = useMutation(
    centralizedApiService.sources.create,
    {
      onSuccess: () => refetch() // Refresh data after creation
    }
  );

  return (
    <div>
      <button onClick={() => createSource({ name: 'New Source' })}>
        {createLoading ? 'Creating...' : 'Create Source'}
      </button>
      {/* Render data */}
    </div>
  );
}
```

## Available Services

### Authentication (`centralizedApiService.auth`)

- `login(credentials)` - User login
- `register(userData)` - User registration
- `logout()` - User logout
- `getCurrentUser()` - Get current user profile
- `updateProfile(profileData)` - Update user profile
- `changePassword(passwordData)` - Change password
- `requestPasswordReset(email)` - Request password reset
- `resetPassword(resetData)` - Reset password
- `isAuthenticated()` - Check authentication status

### Sources (`centralizedApiService.sources`)

- `getAll()` - Get all sources
- `getById(id)` - Get source by ID
- `create(sourceData)` - Create new source
- `update(id, sourceData)` - Update source
- `delete(id)` - Delete source
- `updateRelevance(id, score, reason)` - Update relevance score
- `validateUrl(url)` - Validate URL
- `getMetadata(url)` - Get URL metadata
- `getByType(type)` - Get sources by type
- `getByCategory(category)` - Get sources by category
- `bulkImport(sources)` - Bulk import sources

### Content (`centralizedApiService.content`)

- `getById(contentId)` - Get content by ID
- `search(params)` - Search content
- `getUserContent(params)` - Get user's content
- `create(contentData)` - Create content
- `update(contentId, updateData)` - Update content
- `delete(contentId)` - Delete content
- `getMetadata(contentId)` - Get content metadata
- `getRelated(contentId, params)` - Get related content
- `getByCategory(category, params)` - Get content by category
- `getTrending(params)` - Get trending content
- `getRecent(params)` - Get recent content

### Categories (`centralizedApiService.categories`)

- `getAll()` - Get all categories
- `getById(id)` - Get category by ID
- `create(categoryData)` - Create category
- `update(id, categoryData)` - Update category
- `delete(id)` - Delete category
- `getSources(id)` - Get category sources
- `addSource(categoryId, sourceId)` - Add source to category
- `removeSource(categoryId, sourceId)` - Remove source from category
- `getSubcategories(id)` - Get subcategories
- `suggest(sourceData)` - Suggest categories

### Collections (`centralizedApiService.collections`)

- `create(collectionData)` - Create collection
- `getUserCollections(params)` - Get user collections
- `getById(collectionId)` - Get collection by ID
- `update(collectionId, updateData)` - Update collection
- `delete(collectionId)` - Delete collection
- `addContent(collectionId, contentData)` - Add content to collection
- `removeContent(collectionId, contentData)` - Remove content from collection
- `search(params)` - Search collections
- `getPublic(params)` - Get public collections
- `export(collectionId, format)` - Export collection
- `import(file, options)` - Import collection

### Configuration (`centralizedApiService.configuration`)

- `getTopicPreferences()` - Get topic preferences
- `updateTopicPreferences(preferences)` - Update topic preferences
- `getNotificationSettings()` - Get notification settings
- `updateNotificationSettings(settings)` - Update notification settings
- `getContentVolumeSettings()` - Get content volume settings
- `updateContentVolumeSettings(settings)` - Update content volume settings
- `getDiscoverySettings()` - Get discovery settings
- `updateDiscoverySettings(settings)` - Update discovery settings
- `getSummaryPreferences()` - Get summary preferences
- `updateSummaryPreferences(preferences)` - Update summary preferences
- `getDigestScheduling()` - Get digest scheduling
- `updateDigestScheduling(scheduling)` - Update digest scheduling
- `getAllSettings()` - Get all settings (batch request)

### Utilities (`centralizedApiService.utils`)

- `healthCheck()` - Check API health
- `isLoading(key)` - Check if operation is loading
- `subscribeToLoading(callback)` - Subscribe to loading changes
- `getLoadingStates()` - Get all loading states

## Custom Hooks

### `useApi(apiCall, dependencies, options)`

Generic hook for API calls with automatic loading and error handling.

**Parameters:**
- `apiCall` - Function that returns a Promise
- `dependencies` - Array of dependencies for re-fetching
- `options` - Configuration object

**Returns:**
- `data` - Response data
- `loading` - Loading state
- `error` - Error message
- `refetch` - Function to refetch data
- `mutate` - Function to execute the API call

### `useMutation(mutationFn, options)`

Hook for mutation operations (POST, PUT, DELETE).

**Parameters:**
- `mutationFn` - Function that performs the mutation
- `options` - Configuration object with callbacks

**Returns:**
- `mutate` - Function to execute the mutation
- `loading` - Loading state
- `error` - Error message
- `data` - Response data
- `reset` - Function to reset state

### Resource-Specific Hooks

- `useSources()` - Sources management
- `useCategories()` - Categories management
- `useContent(params)` - Content management
- `useCollections()` - Collections management
- `useLoadingStates()` - Global loading states

## Migration Guide

### From Individual Services

Old code:
```javascript
import sourceService from '../services/sourceService';

const sources = await sourceService.getAllSources();
```

New code:
```javascript
import { centralizedApiService } from '../services/centralizedApiService';

const sources = await centralizedApiService.sources.getAll();
```

### From React Query to Custom Hooks

Old code:
```javascript
import { useQuery, useMutation } from 'react-query';
import sourceService from '../services/sourceService';

const { data: sources, isLoading } = useQuery('sources', sourceService.getAllSources);
const createMutation = useMutation(sourceService.createSource);
```

New code:
```javascript
import { useSources } from '../hooks/useApi';

const { sources, loading, createSource } = useSources();
```

## Error Handling

All API calls automatically handle errors and provide consistent error messages. Errors are caught and transformed into user-friendly messages:

- Network timeouts → "Request timeout. Please try again."
- 404 errors → "Resource not found"
- 500 errors → "Server error. Please try again later."
- Authentication errors → Automatic token removal and redirect

## Loading States

Loading states are automatically managed and can be accessed globally:

```javascript
import { useLoadingStates } from '../hooks/useApi';

function GlobalLoadingIndicator() {
  const { loadingStates, isLoading } = useLoadingStates();
  
  const hasAnyLoading = Array.from(loadingStates.values()).some(Boolean);
  
  if (hasAnyLoading) {
    return <div>Loading...</div>;
  }
  
  return null;
}
```

## Testing

The API service layer includes comprehensive tests. Run tests with:

```bash
npm test -- --testPathPattern=centralizedApiService.test.js
```

## Best Practices

1. **Use custom hooks** for components that need API data
2. **Use the centralized service** for one-off API calls
3. **Handle errors gracefully** - errors are automatically caught and formatted
4. **Leverage loading states** - use the global loading manager for UI feedback
5. **Batch requests** when possible using `apiService.batch()`
6. **Check authentication** before making authenticated requests

## Backward Compatibility

All existing service files (`authService.js`, `sourceService.js`, etc.) have been updated to use the centralized service internally, maintaining backward compatibility with existing components while providing the benefits of the new architecture.