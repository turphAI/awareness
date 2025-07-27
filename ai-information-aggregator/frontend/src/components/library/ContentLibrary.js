import React, { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import styled from 'styled-components';
import api from '../../services/api';
import ContentList from './ContentList';
import ContentDetail from './ContentDetail';
import LibraryFilters from './LibraryFilters';
import SearchBar from './SearchBar';

const LibraryContainer = styled.div`
  display: flex;
  height: calc(100vh - 80px);
  background: #f8f9fa;
`;

const LeftPanel = styled.div`
  width: 350px;
  background: white;
  border-right: 1px solid #dee2e6;
  display: flex;
  flex-direction: column;
`;

const RightPanel = styled.div`
  flex: 1;
  background: white;
  overflow: hidden;
`;

const LibraryHeader = styled.div`
  padding: 20px;
  border-bottom: 1px solid #dee2e6;
  background: white;
`;

const LibraryTitle = styled.h1`
  color: #333;
  margin: 0 0 10px 0;
  font-size: 24px;
`;

const LibrarySubtitle = styled.p`
  color: #666;
  margin: 0;
  font-size: 14px;
`;

const FilterSection = styled.div`
  padding: 20px;
  border-bottom: 1px solid #dee2e6;
`;

const ContentSection = styled.div`
  flex: 1;
  overflow-y: auto;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #666;
  text-align: center;
  padding: 40px;
`;

const EmptyStateIcon = styled.div`
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
`;

const EmptyStateTitle = styled.h3`
  margin: 0 0 8px 0;
  color: #333;
`;

const EmptyStateText = styled.p`
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
`;

const LoadingSpinner = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
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

const ContentLibrary = () => {
  const [selectedContent, setSelectedContent] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    type: '',
    category: '',
    dateRange: '',
    sortBy: 'relevance',
    sortOrder: 'desc'
  });

  // Fetch library content
  const { data: libraryData, isLoading, error, refetch } = useQuery(
    ['library-content', searchQuery, filters],
    () => fetchLibraryContent({ search: searchQuery, ...filters }),
    {
      keepPreviousData: true,
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  );

  // Fetch library statistics
  const { data: stats } = useQuery(
    'library-stats',
    fetchLibraryStats,
    {
      staleTime: 10 * 60 * 1000, // 10 minutes
    }
  );

  const handleSearch = (query) => {
    setSearchQuery(query);
    setSelectedContent(null); // Clear selection when searching
  };

  const handleFilterChange = (newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setSelectedContent(null); // Clear selection when filtering
  };

  const handleContentSelect = (content) => {
    setSelectedContent(content);
    // Record interaction
    recordInteraction(content.id, 'view');
  };

  const handleContentInteraction = async (contentId, interactionType) => {
    try {
      await recordInteraction(contentId, interactionType);
      // Refetch to update any changes
      refetch();
    } catch (error) {
      console.error('Failed to record interaction:', error);
    }
  };

  const recordInteraction = async (contentId, type) => {
    await api.post('/interactions', {
      contentId,
      type
    });
  };

  const renderContent = () => {
    if (isLoading) {
      return <LoadingSpinner>Loading library content...</LoadingSpinner>;
    }

    if (error) {
      return <ErrorMessage>Failed to load library content. Please try again.</ErrorMessage>;
    }

    if (!libraryData?.content?.length) {
      return (
        <EmptyState>
          <EmptyStateIcon>📚</EmptyStateIcon>
          <EmptyStateTitle>No content found</EmptyStateTitle>
          <EmptyStateText>
            {searchQuery || Object.values(filters).some(f => f) 
              ? 'Try adjusting your search or filters to find content.'
              : 'Your library is empty. Content will appear here as it\'s discovered and processed.'
            }
          </EmptyStateText>
        </EmptyState>
      );
    }

    return (
      <ContentList
        content={libraryData.content}
        selectedContent={selectedContent}
        onContentSelect={handleContentSelect}
        onContentInteraction={handleContentInteraction}
      />
    );
  };

  return (
    <LibraryContainer>
      <LeftPanel>
        <LibraryHeader>
          <LibraryTitle>Content Library</LibraryTitle>
          <LibrarySubtitle>
            {stats?.totalItems || 0} items • {stats?.newToday || 0} new today
          </LibrarySubtitle>
        </LibraryHeader>
        
        <FilterSection>
          <SearchBar
            value={searchQuery}
            onChange={handleSearch}
            placeholder="Search content..."
          />
          <LibraryFilters
            filters={filters}
            onChange={handleFilterChange}
            stats={stats}
          />
        </FilterSection>
        
        <ContentSection>
          {renderContent()}
        </ContentSection>
      </LeftPanel>
      
      <RightPanel>
        {selectedContent ? (
          <ContentDetail
            content={selectedContent}
            onInteraction={handleContentInteraction}
          />
        ) : (
          <EmptyState>
            <EmptyStateIcon>👈</EmptyStateIcon>
            <EmptyStateTitle>Select content to view details</EmptyStateTitle>
            <EmptyStateText>
              Choose an item from the library to see its full details, summary, and related content.
            </EmptyStateText>
          </EmptyState>
        )}
      </RightPanel>
    </LibraryContainer>
  );
};

// API functions
const fetchLibraryContent = async (params) => {
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) queryParams.append(key, value);
  });
  
  const response = await api.get(`/library/content?${queryParams}`);
  return response.data;
};

const fetchLibraryStats = async () => {
  const response = await api.get('/library/stats');
  return response.data;
};

export default ContentLibrary;