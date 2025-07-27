import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import CollectionForm from './CollectionForm';
import CollectionList from './CollectionList';
import CollectionDetail from './CollectionDetail';
import collectionService from '../../services/collectionService';

const Container = styled.div`
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
`;

const Header = styled.div`
  display: flex;
  justify-content: between;
  align-items: center;
  margin-bottom: 30px;
  
  @media (max-width: 768px) {
    flex-direction: column;
    gap: 15px;
    align-items: stretch;
  }
`;

const Title = styled.h1`
  margin: 0;
  color: #333;
  font-size: 28px;
`;

const Actions = styled.div`
  display: flex;
  gap: 10px;
  
  @media (max-width: 768px) {
    justify-content: center;
  }
`;

const Button = styled.button`
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  
  ${props => props.variant === 'primary' ? `
    background-color: #007bff;
    color: white;
    
    &:hover:not(:disabled) {
      background-color: #0056b3;
      transform: translateY(-1px);
    }
  ` : `
    background-color: #f8f9fa;
    color: #333;
    border: 1px solid #dee2e6;
    
    &:hover:not(:disabled) {
      background-color: #e9ecef;
    }
  `}
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
`;

const ViewToggle = styled.div`
  display: flex;
  background: #f8f9fa;
  border-radius: 6px;
  padding: 2px;
  border: 1px solid #dee2e6;
`;

const ViewButton = styled.button`
  padding: 8px 16px;
  border: none;
  background: ${props => props.active ? '#007bff' : 'transparent'};
  color: ${props => props.active ? 'white' : '#666'};
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 14px;
  
  &:hover {
    background: ${props => props.active ? '#0056b3' : '#e9ecef'};
  }
`;

const SearchBar = styled.div`
  margin-bottom: 20px;
  display: flex;
  gap: 10px;
  align-items: center;
  
  @media (max-width: 768px) {
    flex-direction: column;
    align-items: stretch;
  }
`;

const SearchInput = styled.input`
  flex: 1;
  padding: 10px 15px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  
  &:focus {
    outline: none;
    border-color: #007bff;
    box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
  }
`;

const FilterSelect = styled.select`
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: white;
  font-size: 14px;
  min-width: 120px;
  
  &:focus {
    outline: none;
    border-color: #007bff;
  }
`;

const LoadingSpinner = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
  font-size: 16px;
  color: #666;
`;

const ErrorMessage = styled.div`
  background: #f8d7da;
  color: #721c24;
  padding: 15px;
  border-radius: 6px;
  margin-bottom: 20px;
  border: 1px solid #f5c6cb;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 60px 20px;
  color: #666;
  
  h3 {
    margin: 0 0 10px 0;
    color: #333;
  }
  
  p {
    margin: 0 0 20px 0;
    font-size: 16px;
  }
`;

const CollectionManagement = () => {
  const [collections, setCollections] = useState([]);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingCollection, setEditingCollection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'grid'
  const [filterBy, setFilterBy] = useState('all'); // 'all', 'public', 'private'

  useEffect(() => {
    loadCollections();
  }, [sortBy, filterBy]);

  const loadCollections = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = {
        sortBy,
        includeCollaborated: true
      };
      
      const response = await collectionService.getUserCollections(params);
      let collectionsData = response.data.collections;
      
      // Apply client-side filtering
      if (filterBy === 'public') {
        collectionsData = collectionsData.filter(c => c.public);
      } else if (filterBy === 'private') {
        collectionsData = collectionsData.filter(c => !c.public);
      }
      
      setCollections(collectionsData);
    } catch (err) {
      setError('Failed to load collections. Please try again.');
      console.error('Error loading collections:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCollection = () => {
    setEditingCollection(null);
    setShowForm(true);
  };

  const handleEditCollection = (collection) => {
    setEditingCollection(collection);
    setShowForm(true);
  };

  const handleDeleteCollection = async (collectionId) => {
    if (!window.confirm('Are you sure you want to delete this collection? This action cannot be undone.')) {
      return;
    }
    
    try {
      await collectionService.deleteCollection(collectionId);
      setCollections(prev => prev.filter(c => c._id !== collectionId));
      if (selectedCollection?._id === collectionId) {
        setSelectedCollection(null);
      }
    } catch (err) {
      setError('Failed to delete collection. Please try again.');
      console.error('Error deleting collection:', err);
    }
  };

  const handleFormSubmit = async (formData) => {
    try {
      setError(null);
      
      if (editingCollection) {
        const response = await collectionService.updateCollection(editingCollection._id, formData);
        setCollections(prev => prev.map(c => 
          c._id === editingCollection._id ? response.data : c
        ));
      } else {
        const response = await collectionService.createCollection(formData);
        setCollections(prev => [response.data, ...prev]);
      }
      
      setShowForm(false);
      setEditingCollection(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save collection. Please try again.');
      console.error('Error saving collection:', err);
    }
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingCollection(null);
  };

  const handleCollectionSelect = (collection) => {
    setSelectedCollection(collection);
  };

  const handleAddContentToCollection = async (collectionId, contentIds) => {
    try {
      const response = await collectionService.addContent(collectionId, { contentIds });
      setCollections(prev => prev.map(c => 
        c._id === collectionId ? response.data : c
      ));
      if (selectedCollection?._id === collectionId) {
        setSelectedCollection(response.data);
      }
    } catch (err) {
      setError('Failed to add content to collection. Please try again.');
      console.error('Error adding content:', err);
    }
  };

  const handleRemoveContentFromCollection = async (collectionId, contentIds) => {
    try {
      const response = await collectionService.removeContent(collectionId, { contentIds });
      setCollections(prev => prev.map(c => 
        c._id === collectionId ? response.data : c
      ));
      if (selectedCollection?._id === collectionId) {
        setSelectedCollection(response.data);
      }
    } catch (err) {
      setError('Failed to remove content from collection. Please try again.');
      console.error('Error removing content:', err);
    }
  };

  const filteredCollections = collections.filter(collection =>
    collection.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    collection.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    collection.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (showForm) {
    return (
      <Container>
        <CollectionForm
          collection={editingCollection}
          onSubmit={handleFormSubmit}
          onCancel={handleFormCancel}
          isLoading={false}
        />
      </Container>
    );
  }

  if (selectedCollection) {
    return (
      <Container>
        <CollectionDetail
          collection={selectedCollection}
          onBack={() => setSelectedCollection(null)}
          onEdit={() => handleEditCollection(selectedCollection)}
          onDelete={() => handleDeleteCollection(selectedCollection._id)}
          onAddContent={handleAddContentToCollection}
          onRemoveContent={handleRemoveContentFromCollection}
        />
      </Container>
    );
  }

  return (
    <Container>
      <Header>
        <Title>My Collections</Title>
        <Actions>
          <ViewToggle>
            <ViewButton 
              active={viewMode === 'list'} 
              onClick={() => setViewMode('list')}
            >
              List
            </ViewButton>
            <ViewButton 
              active={viewMode === 'grid'} 
              onClick={() => setViewMode('grid')}
            >
              Grid
            </ViewButton>
          </ViewToggle>
          <Button variant="primary" onClick={handleCreateCollection}>
            Create Collection
          </Button>
        </Actions>
      </Header>

      <SearchBar>
        <SearchInput
          type="text"
          placeholder="Search collections..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <FilterSelect value={filterBy} onChange={(e) => setFilterBy(e.target.value)}>
          <option value="all">All Collections</option>
          <option value="public">Public</option>
          <option value="private">Private</option>
        </FilterSelect>
        <FilterSelect value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="name">Sort by Name</option>
          <option value="createdAt">Sort by Date</option>
          <option value="viewCount">Sort by Views</option>
          <option value="contentIds">Sort by Content Count</option>
        </FilterSelect>
      </SearchBar>

      {error && <ErrorMessage>{error}</ErrorMessage>}

      {loading ? (
        <LoadingSpinner>Loading collections...</LoadingSpinner>
      ) : filteredCollections.length === 0 ? (
        <EmptyState>
          <h3>No collections found</h3>
          <p>
            {searchQuery 
              ? 'No collections match your search criteria.' 
              : 'You haven\'t created any collections yet.'
            }
          </p>
          {!searchQuery && (
            <Button variant="primary" onClick={handleCreateCollection}>
              Create Your First Collection
            </Button>
          )}
        </EmptyState>
      ) : (
        <CollectionList
          collections={filteredCollections}
          viewMode={viewMode}
          onSelect={handleCollectionSelect}
          onEdit={handleEditCollection}
          onDelete={handleDeleteCollection}
        />
      )}
    </Container>
  );
};

export default CollectionManagement;