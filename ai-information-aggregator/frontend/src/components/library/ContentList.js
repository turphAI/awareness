import React from 'react';
import styled from 'styled-components';

const ListContainer = styled.div`
  padding: 0;
`;

const ContentItem = styled.div`
  padding: 16px 20px;
  border-bottom: 1px solid #f1f3f4;
  cursor: pointer;
  transition: background-color 0.2s;
  background: ${props => props.selected ? '#f8f9ff' : 'white'};
  border-left: ${props => props.selected ? '3px solid #007bff' : '3px solid transparent'};
  
  &:hover {
    background: ${props => props.selected ? '#f8f9ff' : '#f8f9fa'};
  }
  
  &:last-child {
    border-bottom: none;
  }
`;

const ItemHeader = styled.div`
  display: flex;
  justify-content: between;
  align-items: flex-start;
  margin-bottom: 8px;
`;

const ItemTitle = styled.h3`
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #333;
  line-height: 1.3;
  flex: 1;
  margin-right: 8px;
`;

const ItemMeta = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  flex-shrink: 0;
`;

const ItemDate = styled.div`
  font-size: 11px;
  color: #6c757d;
  margin-bottom: 4px;
`;

const RelevanceScore = styled.div`
  background: ${props => {
    if (props.score >= 0.8) return '#28a745';
    if (props.score >= 0.6) return '#ffc107';
    return '#6c757d';
  }};
  color: white;
  padding: 2px 6px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: bold;
`;

const ItemSummary = styled.p`
  margin: 0 0 8px 0;
  font-size: 12px;
  color: #666;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const ItemFooter = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const ItemTags = styled.div`
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  flex: 1;
`;

const Tag = styled.span`
  background: #f1f3f4;
  color: #5f6368;
  padding: 2px 6px;
  border-radius: 8px;
  font-size: 10px;
  font-weight: 500;
`;

const TypeBadge = styled.span`
  background: ${props => {
    switch (props.type) {
      case 'paper': return '#e3f2fd';
      case 'article': return '#f3e5f5';
      case 'podcast': return '#e8f5e8';
      case 'video': return '#fff3e0';
      default: return '#f5f5f5';
    }
  }};
  color: ${props => {
    switch (props.type) {
      case 'paper': return '#1976d2';
      case 'article': return '#7b1fa2';
      case 'podcast': return '#388e3c';
      case 'video': return '#f57c00';
      default: return '#616161';
    }
  }};
  padding: 2px 6px;
  border-radius: 8px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
`;

const ItemActions = styled.div`
  display: flex;
  gap: 4px;
  margin-left: 8px;
`;

const ActionButton = styled.button`
  background: none;
  border: none;
  color: #6c757d;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  font-size: 12px;
  
  &:hover {
    background: #f8f9fa;
    color: #495057;
  }
`;

const OutdatedIndicator = styled.div`
  background: #fff3cd;
  color: #856404;
  padding: 2px 6px;
  border-radius: 8px;
  font-size: 10px;
  font-weight: 500;
  margin-left: 4px;
`;

const ContentList = ({ content, selectedContent, onContentSelect, onContentInteraction }) => {
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 48) return 'Yesterday';
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`;
    return date.toLocaleDateString();
  };

  const handleItemClick = (item) => {
    onContentSelect(item);
  };

  const handleActionClick = (e, contentId, action) => {
    e.stopPropagation(); // Prevent item selection
    onContentInteraction(contentId, action);
  };

  return (
    <ListContainer>
      {content.map(item => (
        <ContentItem
          key={item.id}
          selected={selectedContent?.id === item.id}
          onClick={() => handleItemClick(item)}
        >
          <ItemHeader>
            <ItemTitle>{item.title}</ItemTitle>
            <ItemMeta>
              <ItemDate>{formatDate(item.publishDate)}</ItemDate>
              <RelevanceScore score={item.relevanceScore}>
                {Math.round(item.relevanceScore * 100)}%
              </RelevanceScore>
            </ItemMeta>
          </ItemHeader>
          
          <ItemSummary>{item.summary}</ItemSummary>
          
          <ItemFooter>
            <ItemTags>
              <TypeBadge type={item.type}>{item.type}</TypeBadge>
              {item.topics?.slice(0, 2).map(topic => (
                <Tag key={topic}>{topic}</Tag>
              ))}
              {item.outdated && <OutdatedIndicator>Outdated</OutdatedIndicator>}
            </ItemTags>
            
            <ItemActions>
              <ActionButton
                onClick={(e) => handleActionClick(e, item.id, 'save')}
                title="Save to collection"
              >
                💾
              </ActionButton>
              <ActionButton
                onClick={(e) => handleActionClick(e, item.id, 'share')}
                title="Share"
              >
                🔗
              </ActionButton>
            </ItemActions>
          </ItemFooter>
        </ContentItem>
      ))}
    </ListContainer>
  );
};

export default ContentList;