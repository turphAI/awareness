import React, { useState } from 'react';
import { useQuery } from 'react-query';
import styled from 'styled-components';
import api from '../../services/api';

const DetailContainer = styled.div`
  height: 100%;
  overflow-y: auto;
  background: white;
`;

const DetailHeader = styled.div`
  padding: 30px;
  border-bottom: 1px solid #dee2e6;
  background: #f8f9fa;
`;

const DetailTitle = styled.h1`
  margin: 0 0 12px 0;
  font-size: 24px;
  font-weight: 600;
  color: #333;
  line-height: 1.3;
`;

const DetailMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: center;
  margin-bottom: 16px;
`;

const MetaItem = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: #666;
`;

const MetaLabel = styled.span`
  font-weight: 500;
`;

const MetaValue = styled.span`
  color: #333;
`;

const RelevanceScore = styled.div`
  background: ${props => {
    if (props.score >= 0.8) return '#28a745';
    if (props.score >= 0.6) return '#ffc107';
    return '#6c757d';
  }};
  color: white;
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: bold;
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
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
`;

const TagsContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const Tag = styled.span`
  background: #f1f3f4;
  color: #5f6368;
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 500;
`;

const ActionBar = styled.div`
  display: flex;
  gap: 12px;
  margin-top: 16px;
`;

const ActionButton = styled.button`
  padding: 8px 16px;
  border: 1px solid #007bff;
  background: ${props => props.primary ? '#007bff' : 'white'};
  color: ${props => props.primary ? 'white' : '#007bff'};
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background: ${props => props.primary ? '#0056b3' : '#f8f9fa'};
    border-color: ${props => props.primary ? '#0056b3' : '#0056b3'};
  }
`;

const DetailContent = styled.div`
  padding: 30px;
`;

const SectionTitle = styled.h2`
  margin: 0 0 16px 0;
  font-size: 18px;
  font-weight: 600;
  color: #333;
`;

const SummaryText = styled.div`
  font-size: 16px;
  line-height: 1.6;
  color: #333;
  margin-bottom: 24px;
`;

const KeyInsights = styled.div`
  margin-bottom: 24px;
`;

const InsightsList = styled.ul`
  margin: 0;
  padding-left: 20px;
`;

const InsightItem = styled.li`
  margin-bottom: 8px;
  font-size: 14px;
  line-height: 1.5;
  color: #333;
`;

const VisualElements = styled.div`
  margin-bottom: 24px;
`;

const VisualItem = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 8px;
`;

const VisualThumbnail = styled.div`
  width: 60px;
  height: 40px;
  background: #dee2e6;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
`;

const VisualDescription = styled.div`
  flex: 1;
  font-size: 14px;
  color: #333;
`;

const RelatedContent = styled.div`
  border-top: 1px solid #dee2e6;
  padding-top: 24px;
`;

const RelatedItem = styled.div`
  display: flex;
  gap: 12px;
  padding: 12px;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  margin-bottom: 12px;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background: #f8f9fa;
    border-color: #007bff;
  }
`;

const RelatedItemContent = styled.div`
  flex: 1;
`;

const RelatedItemTitle = styled.h4`
  margin: 0 0 4px 0;
  font-size: 14px;
  font-weight: 600;
  color: #333;
`;

const RelatedItemMeta = styled.div`
  font-size: 12px;
  color: #666;
  margin-bottom: 4px;
`;

const RelatedItemSummary = styled.p`
  margin: 0;
  font-size: 12px;
  color: #666;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const ConnectionType = styled.div`
  font-size: 10px;
  color: #007bff;
  font-weight: 600;
  text-transform: uppercase;
  margin-top: 4px;
`;

const LoadingSpinner = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 40px;
  color: #666;
`;

const ErrorMessage = styled.div`
  color: #dc3545;
  text-align: center;
  padding: 20px;
  background: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 4px;
  margin: 20px;
`;

const ContentDetail = ({ content, onInteraction }) => {
  const [activeTab, setActiveTab] = useState('summary');

  // Fetch related content
  const { data: relatedContent, isLoading: relatedLoading } = useQuery(
    ['related-content', content.id],
    () => fetchRelatedContent(content.id),
    {
      enabled: !!content.id,
      staleTime: 10 * 60 * 1000, // 10 minutes
    }
  );

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleActionClick = (action) => {
    onInteraction(content.id, action);
  };

  const handleRelatedItemClick = (relatedItem) => {
    // This would typically navigate to the related content
    onInteraction(relatedItem.id, 'view');
  };

  const renderVisualElements = () => {
    if (!content.visualElements?.length) return null;

    return (
      <VisualElements>
        <SectionTitle>Visual Elements</SectionTitle>
        {content.visualElements.map((visual, index) => (
          <VisualItem key={index}>
            <VisualThumbnail>
              {visual.type === 'image' ? '🖼️' : '📊'}
            </VisualThumbnail>
            <VisualDescription>{visual.description}</VisualDescription>
          </VisualItem>
        ))}
      </VisualElements>
    );
  };

  const renderRelatedContent = () => {
    if (relatedLoading) {
      return <LoadingSpinner>Loading related content...</LoadingSpinner>;
    }

    if (!relatedContent?.length) {
      return <p style={{ color: '#666', fontStyle: 'italic' }}>No related content found.</p>;
    }

    return (
      <div>
        {relatedContent.map(item => (
          <RelatedItem
            key={item.id}
            onClick={() => handleRelatedItemClick(item)}
          >
            <RelatedItemContent>
              <RelatedItemTitle>{item.title}</RelatedItemTitle>
              <RelatedItemMeta>
                {item.author} • {formatDate(item.publishDate)}
              </RelatedItemMeta>
              <RelatedItemSummary>{item.summary}</RelatedItemSummary>
              <ConnectionType>{item.connectionType}</ConnectionType>
            </RelatedItemContent>
          </RelatedItem>
        ))}
      </div>
    );
  };

  return (
    <DetailContainer>
      <DetailHeader>
        <DetailTitle>{content.title}</DetailTitle>
        
        <DetailMeta>
          <MetaItem>
            <MetaLabel>Author:</MetaLabel>
            <MetaValue>{content.author || 'Unknown'}</MetaValue>
          </MetaItem>
          <MetaItem>
            <MetaLabel>Published:</MetaLabel>
            <MetaValue>{formatDate(content.publishDate)}</MetaValue>
          </MetaItem>
          <TypeBadge type={content.type}>{content.type}</TypeBadge>
          <RelevanceScore score={content.relevanceScore}>
            {Math.round(content.relevanceScore * 100)}% relevant
          </RelevanceScore>
        </DetailMeta>

        {content.topics?.length > 0 && (
          <TagsContainer>
            {content.topics.map(topic => (
              <Tag key={topic}>{topic}</Tag>
            ))}
          </TagsContainer>
        )}

        <ActionBar>
          <ActionButton
            primary
            onClick={() => handleActionClick('view')}
          >
            Read Full Article
          </ActionButton>
          <ActionButton onClick={() => handleActionClick('save')}>
            Save to Collection
          </ActionButton>
          <ActionButton onClick={() => handleActionClick('share')}>
            Share
          </ActionButton>
        </ActionBar>
      </DetailHeader>

      <DetailContent>
        <div>
          <SectionTitle>Summary</SectionTitle>
          <SummaryText>{content.summary}</SummaryText>
        </div>

        {content.keyInsights?.length > 0 && (
          <KeyInsights>
            <SectionTitle>Key Insights</SectionTitle>
            <InsightsList>
              {content.keyInsights.map((insight, index) => (
                <InsightItem key={index}>{insight}</InsightItem>
              ))}
            </InsightsList>
          </KeyInsights>
        )}

        {renderVisualElements()}

        <RelatedContent>
          <SectionTitle>Related Content</SectionTitle>
          {renderRelatedContent()}
        </RelatedContent>
      </DetailContent>
    </DetailContainer>
  );
};

// API function
const fetchRelatedContent = async (contentId) => {
  const response = await api.get(`/library/content/${contentId}/related`);
  return response.data;
};

export default ContentDetail;