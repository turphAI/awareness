import React, { useState } from 'react';
import styled from 'styled-components';
import { 
  useApi, 
  useMutation, 
  useLoadingStates, 
  useSources, 
  useCategories, 
  useContent, 
  useCollections 
} from '../hooks/useApi';
import { centralizedApiService } from '../services/centralizedApiService';

const Container = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
`;

const Section = styled.div`
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  padding: 20px;
  margin-bottom: 20px;
`;

const SectionTitle = styled.h2`
  color: #333;
  margin-bottom: 15px;
  border-bottom: 2px solid #007bff;
  padding-bottom: 10px;
`;

const Button = styled.button`
  background-color: ${props => props.variant === 'secondary' ? '#6c757d' : '#007bff'};
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
  margin: 5px;
  font-weight: 500;
  transition: background-color 0.2s;

  &:hover:not(:disabled) {
    background-color: ${props => props.variant === 'secondary' ? '#5a6268' : '#0056b3'};
  }

  &:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }
`;

const LoadingIndicator = styled.div`
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid #f3f3f3;
  border-top: 2px solid #007bff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-left: 10px;

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const ErrorMessage = styled.div`
  background-color: #f8d7da;
  color: #721c24;
  padding: 12px;
  border-radius: 4px;
  margin: 10px 0;
  border: 1px solid #f5c6cb;
`;

const SuccessMessage = styled.div`
  background-color: #d4edda;
  color: #155724;
  padding: 12px;
  border-radius: 4px;
  margin: 10px 0;
  border: 1px solid #c3e6cb;
`;

const DataDisplay = styled.pre`
  background: #f8f9fa;
  padding: 15px;
  border-radius: 4px;
  border: 1px solid #e9ecef;
  overflow-x: auto;
  font-size: 12px;
  max-height: 300px;
  overflow-y: auto;
`;

const LoadingStatesList = styled.div`
  background: #f8f9fa;
  padding: 15px;
  border-radius: 4px;
  border: 1px solid #e9ecef;
  max-height: 200px;
  overflow-y: auto;
`;

const LoadingStateItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 5px 0;
  border-bottom: 1px solid #e9ecef;

  &:last-child {
    border-bottom: none;
  }
`;

const StatusBadge = styled.span`
  background: ${props => props.loading ? '#ffc107' : '#28a745'};
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: bold;
`;

/**
 * Demo component showcasing the centralized API service features
 */
const ApiServiceDemo = () => {
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  // Loading states hook
  const { loadingStates, isLoading } = useLoadingStates();

  // Custom hooks for different resources
  const {
    sources,
    loading: sourcesLoading,
    error: sourcesError,
    refetch: refetchSources,
    createSource,
    updateSource,
    deleteSource,
    createLoading,
    updateLoading,
    deleteLoading
  } = useSources();

  const {
    categories,
    loading: categoriesLoading,
    error: categoriesError,
    refetch: refetchCategories
  } = useCategories();

  const {
    content,
    loading: contentLoading,
    error: contentError,
    refetch: refetchContent,
    searchContent,
    searchLoading,
    searchResults
  } = useContent();

  const {
    collections,
    loading: collectionsLoading,
    error: collectionsError,
    refetch: refetchCollections
  } = useCollections();

  // Manual API calls using the centralized service
  const healthCheckMutation = useMutation(
    () => centralizedApiService.utils.healthCheck(),
    {
      onSuccess: (result) => {
        setMessage(`Health check ${result ? 'passed' : 'failed'}`);
        setMessageType(result ? 'success' : 'error');
      },
      onError: (error) => {
        setMessage(`Health check failed: ${error.message}`);
        setMessageType('error');
      }
    }
  );

  const batchRequestMutation = useMutation(
    () => {
      const requests = [
        { method: 'GET', url: '/sources' },
        { method: 'GET', url: '/categories' },
        { method: 'GET', url: '/content' }
      ];
      return centralizedApiService.apiService.batch(requests);
    },
    {
      onSuccess: (results) => {
        setMessage(`Batch request completed. ${results.filter(r => !r.error).length}/${results.length} successful`);
        setMessageType('success');
      },
      onError: (error) => {
        setMessage(`Batch request failed: ${error.message}`);
        setMessageType('error');
      }
    }
  );

  // Test functions
  const handleCreateTestSource = async () => {
    try {
      await createSource({
        name: `Test Source ${Date.now()}`,
        url: `https://example.com/test-${Date.now()}`,
        category: 'test',
        type: 'blog'
      });
      setMessage('Test source created successfully!');
      setMessageType('success');
    } catch (error) {
      setMessage(`Failed to create test source: ${error.message}`);
      setMessageType('error');
    }
  };

  const handleSearchContent = async () => {
    try {
      await searchContent({
        query: 'artificial intelligence',
        limit: 5
      });
      setMessage('Content search completed!');
      setMessageType('success');
    } catch (error) {
      setMessage(`Search failed: ${error.message}`);
      setMessageType('error');
    }
  };

  const clearMessage = () => {
    setMessage('');
    setMessageType('');
  };

  return (
    <Container>
      <h1>Centralized API Service Demo</h1>
      
      {message && (
        <div>
          {messageType === 'success' ? (
            <SuccessMessage>
              {message}
              <button onClick={clearMessage} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
            </SuccessMessage>
          ) : (
            <ErrorMessage>
              {message}
              <button onClick={clearMessage} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
            </ErrorMessage>
          )}
        </div>
      )}

      {/* Loading States Section */}
      <Section>
        <SectionTitle>Global Loading States</SectionTitle>
        <p>This shows all active loading states across the application:</p>
        <LoadingStatesList>
          {Array.from(loadingStates.entries()).map(([key, loading]) => (
            <LoadingStateItem key={key}>
              <span>{key}</span>
              <StatusBadge loading={loading}>
                {loading ? 'Loading' : 'Idle'}
              </StatusBadge>
            </LoadingStateItem>
          ))}
          {loadingStates.size === 0 && (
            <div style={{ textAlign: 'center', color: '#666', fontStyle: 'italic' }}>
              No active loading states
            </div>
          )}
        </LoadingStatesList>
      </Section>

      {/* Utility Functions Section */}
      <Section>
        <SectionTitle>Utility Functions</SectionTitle>
        <div>
          <Button 
            onClick={() => healthCheckMutation.mutate()}
            disabled={healthCheckMutation.loading}
          >
            Health Check
            {healthCheckMutation.loading && <LoadingIndicator />}
          </Button>
          
          <Button 
            onClick={() => batchRequestMutation.mutate()}
            disabled={batchRequestMutation.loading}
          >
            Batch Request Test
            {batchRequestMutation.loading && <LoadingIndicator />}
          </Button>
        </div>
        
        {(healthCheckMutation.data || batchRequestMutation.data) && (
          <DataDisplay>
            {JSON.stringify({
              healthCheck: healthCheckMutation.data,
              batchResults: batchRequestMutation.data
            }, null, 2)}
          </DataDisplay>
        )}
      </Section>

      {/* Sources Section */}
      <Section>
        <SectionTitle>Sources Management</SectionTitle>
        <div>
          <Button onClick={refetchSources} disabled={sourcesLoading}>
            Refresh Sources
            {sourcesLoading && <LoadingIndicator />}
          </Button>
          
          <Button 
            onClick={handleCreateTestSource}
            disabled={createLoading}
          >
            Create Test Source
            {createLoading && <LoadingIndicator />}
          </Button>
        </div>
        
        {sourcesError && <ErrorMessage>{sourcesError}</ErrorMessage>}
        
        <DataDisplay>
          {JSON.stringify({
            count: sources?.length || 0,
            loading: sourcesLoading,
            sources: sources?.slice(0, 3) || [] // Show first 3 sources
          }, null, 2)}
        </DataDisplay>
      </Section>

      {/* Categories Section */}
      <Section>
        <SectionTitle>Categories Management</SectionTitle>
        <div>
          <Button onClick={refetchCategories} disabled={categoriesLoading}>
            Refresh Categories
            {categoriesLoading && <LoadingIndicator />}
          </Button>
        </div>
        
        {categoriesError && <ErrorMessage>{categoriesError}</ErrorMessage>}
        
        <DataDisplay>
          {JSON.stringify({
            count: categories?.length || 0,
            loading: categoriesLoading,
            categories: categories?.slice(0, 3) || [] // Show first 3 categories
          }, null, 2)}
        </DataDisplay>
      </Section>

      {/* Content Section */}
      <Section>
        <SectionTitle>Content Management</SectionTitle>
        <div>
          <Button onClick={refetchContent} disabled={contentLoading}>
            Refresh Content
            {contentLoading && <LoadingIndicator />}
          </Button>
          
          <Button 
            onClick={handleSearchContent}
            disabled={searchLoading}
          >
            Search Content
            {searchLoading && <LoadingIndicator />}
          </Button>
        </div>
        
        {contentError && <ErrorMessage>{contentError}</ErrorMessage>}
        
        <DataDisplay>
          {JSON.stringify({
            content: {
              count: content?.length || 0,
              loading: contentLoading,
              items: content?.slice(0, 2) || []
            },
            search: {
              loading: searchLoading,
              results: searchResults?.slice(0, 2) || []
            }
          }, null, 2)}
        </DataDisplay>
      </Section>

      {/* Collections Section */}
      <Section>
        <SectionTitle>Collections Management</SectionTitle>
        <div>
          <Button onClick={refetchCollections} disabled={collectionsLoading}>
            Refresh Collections
            {collectionsLoading && <LoadingIndicator />}
          </Button>
        </div>
        
        {collectionsError && <ErrorMessage>{collectionsError}</ErrorMessage>}
        
        <DataDisplay>
          {JSON.stringify({
            count: collections?.length || 0,
            loading: collectionsLoading,
            collections: collections?.slice(0, 3) || [] // Show first 3 collections
          }, null, 2)}
        </DataDisplay>
      </Section>

      {/* API Service Information */}
      <Section>
        <SectionTitle>API Service Information</SectionTitle>
        <DataDisplay>
          {JSON.stringify({
            baseURL: process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:3000/api',
            environment: process.env.NODE_ENV,
            authenticated: centralizedApiService.auth.isAuthenticated(),
            availableServices: [
              'auth',
              'sources', 
              'content',
              'categories',
              'collections',
              'configuration',
              'utils'
            ]
          }, null, 2)}
        </DataDisplay>
      </Section>
    </Container>
  );
};

export default ApiServiceDemo;