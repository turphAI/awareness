import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import contentService from '../../services/contentService';

const Container = styled.div`
  max-width: 1200px;
  margin: 0 auto;
`;

const Header = styled.div`
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 30px;
  margin-bottom: 30px;
`;

const BackButton = styled.button`
  background: none;
  border: none;
  color: #007bff;
  font-size: 14px;
  cursor: pointer;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 5px;
  
  &:hover {
    text-decoration: underline;
  }
`;

const CollectionTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 15px;
`;

const CollectionIcon = styled.div`
  width: 64px;
  height: 64px;
  border-radius: 12px;
  background-color: ${props => props.color};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
`;

const TitleInfo = styled.div`
  flex: 1;
`;

const CollectionName = styled.h1`
  margin: 0 0 8px 0;
  color: #333;
  font-size: 28px;
  font-weight: 600;
`;

const CollectionMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 20px;
  font-size: 14px;
  color: #666;
  margin-bottom: 15px;
`;

const MetaItem = styled.span`
  display: flex;
  align-items: center;
  gap: 5px;
`;

const CollectionDescription = styled.p`
  margin: 0 0 20px 0;
  color: #666;
  font-size: 16px;
  line-height: 1.5;
`;

const TagList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 20px;
`;

const Tag = styled.span`
  background: #e9ecef;
  color: #495057;
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 500;
`;

const StatusBadges = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
`;

const Badge = styled.span`
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 500;
  
  ${props => props.type === 'public' ? `
    background: #d4edda;
    color: #155724;
  ` : props.type === 'featured' ? `
    background: #fff3cd;
    color: #856404;
  ` : props.type === 'private' ? `
    background: #f8d7da;
    color: #721c24;
  ` : ''}
`;

const Actions = styled.div`
  display: flex;
  gap: 10px;
  
  @media (max-width: 768px) {
    flex-direction: column;
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
    }
  ` : props.variant === 'danger' ? `
    background-color: #dc3545;
    color: white;
    
    &:hover:not(:disabled) {
      background-color: #c82333;
    }
  ` : `
    background-color: #6c757d;
    color: white;
    
    &:hover:not(:disabled) {
      background-color: #5a6268;
    }
  `}
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const ContentSection = styled.div`
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 30px;
`;

const SectionTitle = styled.h2`
  margin: 0 0 20px 0;
  color: #333;
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const ContentGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const ContentCard = styled.div`
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 15px;
  transition: all 0.2s;
  position: relative;
  
  &:hover {
    border-color: #007bff;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
`;

const ContentTitle = styled.h3`
  margin: 0 0 8px 0;
  color: #333;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.3;
`;

const ContentUrl = styled.a`
  color: #007bff;
  text-decoration: none;
  font-size: 14px;
  display: block;
  margin-bottom: 8px;
  
  &:hover {
    text-decoration: underline;
  }
`;

const ContentMeta = styled.div`
  font-size: 12px;
  color: #666;
  margin-bottom: 10px;
`;

const ContentSummary = styled.p`
  margin: 0;
  color: #666;
  font-size: 14px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const RemoveButton = styled.button`
  position: absolute;
  top: 10px;
  right: 10px;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  cursor: pointer;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
  
  ${ContentCard}:hover & {
    opacity: 1;
  }
  
  &:hover {
    background: #c82333;
  }
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

const LoadingSpinner = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
  font-size: 16px;
  color: #666;
`;

const AddContentModal = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const ModalContent = styled.div`
  background: white;
  border-radius: 8px;
  padding: 30px;
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
`;

const ModalTitle = styled.h3`
  margin: 0 0 20px 0;
  color: #333;
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 6px;
  margin-bottom: 20px;
  
  &:focus {
    outline: none;
    border-color: #007bff;
  }
`;

const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const CollectionDetail = ({ 
  collection, 
  onBack, 
  onEdit, 
  onDelete, 
  onAddContent, 
  onRemoveContent 
}) => {
  const [content, setContent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [availableContent, setAvailableContent] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadCollectionContent();
  }, [collection]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadCollectionContent = async () => {
    try {
      setLoading(true);
      if (collection.contentIds && collection.contentIds.length > 0) {
        // If contentIds are populated objects, use them directly
        if (typeof collection.contentIds[0] === 'object') {
          setContent(collection.contentIds);
        } else {
          // Otherwise fetch the content details
          const contentPromises = collection.contentIds.map(id => 
            contentService.getContent(id).catch(() => null)
          );
          const contentResults = await Promise.all(contentPromises);
          setContent(contentResults.filter(c => c !== null).map(r => r.data));
        }
      } else {
        setContent([]);
      }
    } catch (error) {
      console.error('Error loading collection content:', error);
      setContent([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddContent = async () => {
    try {
      const response = await contentService.searchContent({ 
        query: searchQuery || '',
        limit: 50 
      });
      setAvailableContent(response.data.content || []);
      setShowAddModal(true);
    } catch (error) {
      console.error('Error loading available content:', error);
    }
  };

  const handleContentSelect = async (contentItem) => {
    try {
      await onAddContent(collection._id, [contentItem._id]);
      setShowAddModal(false);
      loadCollectionContent();
    } catch (error) {
      console.error('Error adding content:', error);
    }
  };

  const handleContentRemove = async (contentId) => {
    if (!window.confirm('Remove this content from the collection?')) {
      return;
    }
    
    try {
      await onRemoveContent(collection._id, [contentId]);
      loadCollectionContent();
    } catch (error) {
      console.error('Error removing content:', error);
    }
  };

  const filteredAvailableContent = availableContent.filter(item =>
    !collection.contentIds.some(id => 
      typeof id === 'object' ? id._id === item._id : id === item._id
    )
  );

  return (
    <Container>
      <Header>
        <BackButton onClick={onBack}>
          ← Back to Collections
        </BackButton>
        
        <CollectionTitle>
          <CollectionIcon color={collection.color}>
            {collection.icon}
          </CollectionIcon>
          <TitleInfo>
            <CollectionName>{collection.name}</CollectionName>
            <CollectionMeta>
              <MetaItem>
                📊 {content.length} items
              </MetaItem>
              <MetaItem>
                👁️ {collection.viewCount || 0} views
              </MetaItem>
              <MetaItem>
                📅 Created {formatDate(collection.createdAt)}
              </MetaItem>
              {collection.lastViewed && (
                <MetaItem>
                  🕒 Last viewed {formatDate(collection.lastViewed)}
                </MetaItem>
              )}
            </CollectionMeta>
          </TitleInfo>
        </CollectionTitle>

        {collection.description && (
          <CollectionDescription>
            {collection.description}
          </CollectionDescription>
        )}

        {collection.tags && collection.tags.length > 0 && (
          <TagList>
            {collection.tags.map(tag => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </TagList>
        )}

        <StatusBadges>
          {collection.public ? (
            <Badge type="public">Public</Badge>
          ) : (
            <Badge type="private">Private</Badge>
          )}
          {collection.featured && (
            <Badge type="featured">Featured</Badge>
          )}
        </StatusBadges>

        <Actions>
          <Button variant="primary" onClick={handleAddContent}>
            Add Content
          </Button>
          <Button onClick={onEdit}>
            Edit Collection
          </Button>
          <Button variant="danger" onClick={onDelete}>
            Delete Collection
          </Button>
        </Actions>
      </Header>

      <ContentSection>
        <SectionTitle>
          Collection Content
          <span style={{ fontSize: '14px', fontWeight: 'normal', color: '#666' }}>
            {content.length} items
          </span>
        </SectionTitle>

        {loading ? (
          <LoadingSpinner>Loading content...</LoadingSpinner>
        ) : content.length === 0 ? (
          <EmptyState>
            <h3>No content in this collection</h3>
            <p>Start building your collection by adding some content.</p>
            <Button variant="primary" onClick={handleAddContent}>
              Add Content
            </Button>
          </EmptyState>
        ) : (
          <ContentGrid>
            {content.map(item => (
              <ContentCard key={item._id}>
                <RemoveButton
                  onClick={() => handleContentRemove(item._id)}
                  title="Remove from collection"
                >
                  ×
                </RemoveButton>
                <ContentTitle>{item.title}</ContentTitle>
                <ContentUrl href={item.url} target="_blank" rel="noopener noreferrer">
                  {item.url}
                </ContentUrl>
                <ContentMeta>
                  {item.publishDate && `Published ${formatDate(item.publishDate)}`}
                  {item.categories && item.categories.length > 0 && 
                    ` • ${item.categories.join(', ')}`
                  }
                </ContentMeta>
                {item.summary && (
                  <ContentSummary>{item.summary}</ContentSummary>
                )}
              </ContentCard>
            ))}
          </ContentGrid>
        )}
      </ContentSection>

      {showAddModal && (
        <AddContentModal onClick={() => setShowAddModal(false)}>
          <ModalContent onClick={(e) => e.stopPropagation()}>
            <ModalTitle>Add Content to Collection</ModalTitle>
            <SearchInput
              type="text"
              placeholder="Search content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {filteredAvailableContent.map(item => (
                <ContentCard 
                  key={item._id}
                  onClick={() => handleContentSelect(item)}
                  style={{ cursor: 'pointer', marginBottom: '10px' }}
                >
                  <ContentTitle>{item.title}</ContentTitle>
                  <ContentUrl>{item.url}</ContentUrl>
                  {item.summary && (
                    <ContentSummary>{item.summary}</ContentSummary>
                  )}
                </ContentCard>
              ))}
            </div>
            <div style={{ marginTop: '20px', textAlign: 'right' }}>
              <Button onClick={() => setShowAddModal(false)}>
                Close
              </Button>
            </div>
          </ModalContent>
        </AddContentModal>
      )}
    </Container>
  );
};

export default CollectionDetail;