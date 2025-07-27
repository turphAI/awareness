import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import styled from 'styled-components';
import sourceService from '../../services/sourceService';
import categoryService from '../../services/categoryService';
import SourceForm from './SourceForm';
import SourceList from './SourceList';
import CategoryManager from './CategoryManager';

const Container = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
`;

const Header = styled.div`
  display: flex;
  justify-content: between;
  align-items: center;
  margin-bottom: 30px;
  flex-wrap: wrap;
  gap: 20px;
`;

const Title = styled.h1`
  color: #333;
  margin: 0;
  font-size: 28px;
`;

const Actions = styled.div`
  display: flex;
  gap: 10px;
  align-items: center;
`;

const Button = styled.button`
  background-color: ${props => props.variant === 'secondary' ? '#6c757d' : '#007bff'};
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.2s;

  &:hover {
    background-color: ${props => props.variant === 'secondary' ? '#5a6268' : '#0056b3'};
  }

  &:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }
`;

const TabContainer = styled.div`
  border-bottom: 1px solid #e0e0e0;
  margin-bottom: 20px;
`;

const TabList = styled.div`
  display: flex;
  gap: 0;
`;

const Tab = styled.button`
  background: none;
  border: none;
  padding: 12px 24px;
  cursor: pointer;
  font-weight: 500;
  color: ${props => props.active ? '#007bff' : '#666'};
  border-bottom: 2px solid ${props => props.active ? '#007bff' : 'transparent'};
  transition: all 0.2s;

  &:hover {
    color: #007bff;
    background-color: #f8f9fa;
  }
`;

const Content = styled.div`
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  padding: 20px;
`;

const ErrorMessage = styled.div`
  background-color: #f8d7da;
  color: #721c24;
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 20px;
  border: 1px solid #f5c6cb;
`;

const LoadingSpinner = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
  
  &::after {
    content: '';
    width: 40px;
    height: 40px;
    border: 4px solid #f3f3f3;
    border-top: 4px solid #007bff;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const Stats = styled.div`
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
  flex-wrap: wrap;
`;

const StatCard = styled.div`
  background: #f8f9fa;
  padding: 15px;
  border-radius: 6px;
  text-align: center;
  min-width: 120px;
`;

const StatNumber = styled.div`
  font-size: 24px;
  font-weight: bold;
  color: #007bff;
`;

const StatLabel = styled.div`
  font-size: 14px;
  color: #666;
  margin-top: 5px;
`;

const SourceManagement = () => {
  const [activeTab, setActiveTab] = useState('sources');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSource, setEditingSource] = useState(null);
  const [error, setError] = useState(null);
  
  const queryClient = useQueryClient();

  // Fetch sources
  const { 
    data: sources = [], 
    isLoading: sourcesLoading 
  } = useQuery('sources', sourceService.getAllSources, {
    onError: (err) => setError(err.response?.data?.message || 'Failed to load sources')
  });

  // Fetch categories
  const { 
    data: categories = [], 
    isLoading: categoriesLoading 
  } = useQuery('categories', categoryService.getAllCategories, {
    onError: (err) => setError(err.response?.data?.message || 'Failed to load categories')
  });

  // Create source mutation
  const createSourceMutation = useMutation(sourceService.createSource, {
    onSuccess: () => {
      queryClient.invalidateQueries('sources');
      setShowAddForm(false);
      setError(null);
    },
    onError: (err) => setError(err.response?.data?.message || 'Failed to create source')
  });

  // Update source mutation
  const updateSourceMutation = useMutation(
    ({ id, data }) => sourceService.updateSource(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('sources');
        setEditingSource(null);
        setError(null);
      },
      onError: (err) => setError(err.response?.data?.message || 'Failed to update source')
    }
  );

  // Delete source mutation
  const deleteSourceMutation = useMutation(sourceService.deleteSource, {
    onSuccess: () => {
      queryClient.invalidateQueries('sources');
      setError(null);
    },
    onError: (err) => setError(err.response?.data?.message || 'Failed to delete source')
  });

  // Update relevance mutation
  const updateRelevanceMutation = useMutation(
    ({ id, score, reason }) => sourceService.updateRelevance(id, score, reason),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('sources');
        setError(null);
      },
      onError: (err) => setError(err.response?.data?.message || 'Failed to update relevance')
    }
  );

  const handleCreateSource = (sourceData) => {
    createSourceMutation.mutate(sourceData);
  };

  const handleUpdateSource = (sourceData) => {
    if (editingSource) {
      updateSourceMutation.mutate({ id: editingSource._id, data: sourceData });
    }
  };

  const handleDeleteSource = (sourceId) => {
    if (window.confirm('Are you sure you want to delete this source?')) {
      deleteSourceMutation.mutate(sourceId);
    }
  };

  const handleUpdateRelevance = (sourceId, score, reason) => {
    updateRelevanceMutation.mutate({ id: sourceId, score, reason });
  };

  const handleEditSource = (source) => {
    setEditingSource(source);
    setShowAddForm(true);
  };

  const handleCancelEdit = () => {
    setEditingSource(null);
    setShowAddForm(false);
  };

  // Calculate statistics
  const stats = {
    total: sources.length,
    active: sources.filter(s => s.active).length,
    byType: sources.reduce((acc, source) => {
      acc[source.type] = (acc[source.type] || 0) + 1;
      return acc;
    }, {}),
    avgRelevance: sources.length > 0 
      ? (sources.reduce((sum, s) => sum + s.relevanceScore, 0) / sources.length).toFixed(2)
      : 0
  };

  if (sourcesLoading || categoriesLoading) {
    return <LoadingSpinner />;
  }

  return (
    <Container>
      <Header>
        <Title>Source Management</Title>
        <Actions>
          <Button onClick={() => setShowAddForm(true)}>
            Add Source
          </Button>
          <Button variant="secondary">
            Import Sources
          </Button>
        </Actions>
      </Header>

      {error && (
        <ErrorMessage>
          {error}
          <button 
            onClick={() => setError(null)}
            style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            ×
          </button>
        </ErrorMessage>
      )}

      <Stats>
        <StatCard>
          <StatNumber>{stats.total}</StatNumber>
          <StatLabel>Total Sources</StatLabel>
        </StatCard>
        <StatCard>
          <StatNumber>{stats.active}</StatNumber>
          <StatLabel>Active Sources</StatLabel>
        </StatCard>
        <StatCard>
          <StatNumber>{stats.avgRelevance}</StatNumber>
          <StatLabel>Avg Relevance</StatLabel>
        </StatCard>
        <StatCard>
          <StatNumber>{Object.keys(stats.byType).length}</StatNumber>
          <StatLabel>Source Types</StatLabel>
        </StatCard>
      </Stats>

      <TabContainer>
        <TabList>
          <Tab 
            active={activeTab === 'sources'} 
            onClick={() => setActiveTab('sources')}
          >
            Sources
          </Tab>
          <Tab 
            active={activeTab === 'categories'} 
            onClick={() => setActiveTab('categories')}
          >
            Categories
          </Tab>
        </TabList>
      </TabContainer>

      <Content>
        {showAddForm && (
          <SourceForm
            source={editingSource}
            categories={categories}
            onSubmit={editingSource ? handleUpdateSource : handleCreateSource}
            onCancel={handleCancelEdit}
            isLoading={createSourceMutation.isLoading || updateSourceMutation.isLoading}
          />
        )}

        {!showAddForm && activeTab === 'sources' && (
          <SourceList
            sources={sources}
            categories={categories}
            onEdit={handleEditSource}
            onDelete={handleDeleteSource}
            onUpdateRelevance={handleUpdateRelevance}
            isUpdatingRelevance={updateRelevanceMutation.isLoading}
          />
        )}

        {!showAddForm && activeTab === 'categories' && (
          <CategoryManager
            categories={categories}
            sources={sources}
          />
        )}
      </Content>
    </Container>
  );
};

export default SourceManagement;