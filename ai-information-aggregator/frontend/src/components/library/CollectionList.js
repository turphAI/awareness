import React from 'react';
import styled from 'styled-components';

const Container = styled.div`
  margin-top: 20px;
`;

const GridContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const ListContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 15px;
`;

const CollectionCard = styled.div`
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    border-color: #007bff;
  }
`;

const CollectionRow = styled.div`
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 20px;
  
  &:hover {
    background: #f8f9fa;
    border-color: #007bff;
  }
`;

const CollectionIcon = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 8px;
  background-color: ${props => props.color};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  flex-shrink: 0;
`;

const CollectionInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const CollectionName = styled.h3`
  margin: 0 0 8px 0;
  color: #333;
  font-size: 18px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 10px;
`;

const CollectionDescription = styled.p`
  margin: 0 0 12px 0;
  color: #666;
  font-size: 14px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const CollectionMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 15px;
  font-size: 12px;
  color: #888;
  margin-bottom: 12px;
`;

const MetaItem = styled.span`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const TagList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
`;

const Tag = styled.span`
  background: #e9ecef;
  color: #495057;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
`;

const StatusBadges = styled.div`
  display: flex;
  gap: 6px;
  margin-bottom: 12px;
`;

const Badge = styled.span`
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
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
  gap: 8px;
  opacity: 0;
  transition: opacity 0.2s;
  
  ${CollectionCard}:hover &,
  ${CollectionRow}:hover & {
    opacity: 1;
  }
`;

const ActionButton = styled.button`
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  
  ${props => props.variant === 'edit' ? `
    background: #007bff;
    color: white;
    
    &:hover {
      background: #0056b3;
    }
  ` : props.variant === 'delete' ? `
    background: #dc3545;
    color: white;
    
    &:hover {
      background: #c82333;
    }
  ` : `
    background: #6c757d;
    color: white;
    
    &:hover {
      background: #5a6268;
    }
  `}
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
    margin: 0;
    font-size: 16px;
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

const formatContentCount = (count) => {
  if (count === 0) return 'No items';
  if (count === 1) return '1 item';
  return `${count} items`;
};

const CollectionList = ({ collections, viewMode, onSelect, onEdit, onDelete }) => {
  const handleCardClick = (collection, e) => {
    // Don't trigger selection if clicking on action buttons
    if (e.target.closest('button')) {
      return;
    }
    onSelect(collection);
  };

  const handleEdit = (e, collection) => {
    e.stopPropagation();
    onEdit(collection);
  };

  const handleDelete = (e, collection) => {
    e.stopPropagation();
    onDelete(collection._id);
  };

  if (collections.length === 0) {
    return (
      <EmptyState>
        <h3>No collections found</h3>
        <p>Create your first collection to get started.</p>
      </EmptyState>
    );
  }

  const renderCollection = (collection) => {
    const contentCount = collection.contentIds?.length || 0;
    
    const collectionContent = (
      <>
        <CollectionIcon color={collection.color}>
          {collection.icon}
        </CollectionIcon>
        <CollectionInfo>
          <CollectionName>
            {collection.name}
          </CollectionName>
          {collection.description && (
            <CollectionDescription>
              {collection.description}
            </CollectionDescription>
          )}
          <CollectionMeta>
            <MetaItem>
              📊 {formatContentCount(contentCount)}
            </MetaItem>
            <MetaItem>
              👁️ {collection.viewCount || 0} views
            </MetaItem>
            <MetaItem>
              📅 {formatDate(collection.createdAt)}
            </MetaItem>
          </CollectionMeta>
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
        </CollectionInfo>
        <Actions>
          <ActionButton
            variant="edit"
            onClick={(e) => handleEdit(e, collection)}
          >
            Edit
          </ActionButton>
          <ActionButton
            variant="delete"
            onClick={(e) => handleDelete(e, collection)}
          >
            Delete
          </ActionButton>
        </Actions>
      </>
    );

    return viewMode === 'grid' ? (
      <CollectionCard
        key={collection._id}
        onClick={(e) => handleCardClick(collection, e)}
      >
        {collectionContent}
      </CollectionCard>
    ) : (
      <CollectionRow
        key={collection._id}
        onClick={(e) => handleCardClick(collection, e)}
      >
        {collectionContent}
      </CollectionRow>
    );
  };

  return (
    <Container>
      {viewMode === 'grid' ? (
        <GridContainer>
          {collections.map(renderCollection)}
        </GridContainer>
      ) : (
        <ListContainer>
          {collections.map(renderCollection)}
        </ListContainer>
      )}
    </Container>
  );
};

export default CollectionList;