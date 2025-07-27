import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useQuery } from 'react-query';
import api from '../services/api';
import styled from 'styled-components';

const DashboardContainer = styled.div`
  padding: 20px 0;
`;

const WelcomeSection = styled.div`
  background: white;
  padding: 30px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  margin-bottom: 30px;
`;

const WelcomeTitle = styled.h1`
  color: #333;
  margin-bottom: 10px;
`;

const WelcomeText = styled.p`
  color: #666;
  font-size: 16px;
  line-height: 1.5;
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
`;

const StatCard = styled.div`
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  text-align: center;
`;

const StatNumber = styled.div`
  font-size: 32px;
  font-weight: bold;
  color: #007bff;
  margin-bottom: 5px;
`;

const StatLabel = styled.div`
  color: #666;
  font-size: 14px;
`;

const FilterSection = styled.div`
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  margin-bottom: 20px;
`;

const FilterGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
  align-items: end;
`;

const FilterGroup = styled.div`
  display: flex;
  flex-direction: column;
`;

const FilterLabel = styled.label`
  font-size: 14px;
  font-weight: 500;
  color: #333;
  margin-bottom: 5px;
`;

const FilterSelect = styled.select`
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  background: white;
  
  &:focus {
    outline: none;
    border-color: #007bff;
  }
`;

const FilterButton = styled.button`
  padding: 8px 16px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  
  &:hover {
    background: #0056b3;
  }
  
  &:disabled {
    background: #ccc;
    cursor: not-allowed;
  }
`;

const ContentSection = styled.div`
  background: white;
  padding: 30px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  margin-bottom: 20px;
`;

const SectionTitle = styled.h2`
  color: #333;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const SortSelect = styled.select`
  padding: 6px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  background: white;
`;

const ContentGrid = styled.div`
  display: grid;
  gap: 20px;
`;

const ContentCard = styled.div`
  border: 1px solid #eee;
  border-radius: 8px;
  padding: 20px;
  transition: box-shadow 0.2s;
  
  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
`;

const ContentHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 10px;
`;

const ContentTitle = styled.h3`
  color: #333;
  margin: 0;
  font-size: 18px;
  line-height: 1.3;
  flex: 1;
`;

const ContentMeta = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  margin-left: 15px;
`;

const RelevanceScore = styled.div`
  background: ${props => props.score >= 0.8 ? '#28a745' : props.score >= 0.6 ? '#ffc107' : '#6c757d'};
  color: white;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: bold;
  margin-bottom: 5px;
`;

const ContentDate = styled.div`
  color: #666;
  font-size: 12px;
`;

const ContentSummary = styled.p`
  color: #666;
  margin: 10px 0;
  line-height: 1.5;
`;

const ContentFooter = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 15px;
`;

const ContentTags = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;

const Tag = styled.span`
  background: #f8f9fa;
  color: #495057;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  border: 1px solid #dee2e6;
`;

const ContentActions = styled.div`
  display: flex;
  gap: 10px;
`;

const ActionButton = styled.button`
  padding: 6px 12px;
  border: 1px solid #007bff;
  background: ${props => props.primary ? '#007bff' : 'white'};
  color: ${props => props.primary ? 'white' : '#007bff'};
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  
  &:hover {
    background: ${props => props.primary ? '#0056b3' : '#f8f9fa'};
  }
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
  margin: 20px 0;
`;

const PlaceholderText = styled.p`
  color: #666;
  font-style: italic;
  text-align: center;
  padding: 40px 20px;
`;

const BreakingNewsAlert = styled.div`
  background: linear-gradient(135deg, #ff6b6b, #ee5a24);
  color: white;
  padding: 15px 20px;
  border-radius: 8px;
  margin-bottom: 20px;
  box-shadow: 0 4px 12px rgba(238, 90, 36, 0.3);
`;

const BreakingNewsTitle = styled.h3`
  margin: 0 0 5px 0;
  font-size: 16px;
`;

const BreakingNewsText = styled.p`
  margin: 0;
  font-size: 14px;
  opacity: 0.9;
`;

const Dashboard = () => {
  const { user } = useAuth();
  const [filters, setFilters] = useState({
    topic: '',
    sourceType: '',
    timePeriod: 'today',
    sortBy: 'relevance'
  });

  // Fetch dashboard data
  const { data: dashboardData, isLoading, error, refetch } = useQuery(
    ['dashboard', filters],
    () => fetchDashboardData(filters),
    {
      refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
      staleTime: 2 * 60 * 1000, // Consider data stale after 2 minutes
    }
  );

  // Fetch dashboard statistics
  const { data: stats } = useQuery(
    'dashboard-stats',
    fetchDashboardStats,
    {
      refetchInterval: 10 * 60 * 1000, // Refetch every 10 minutes
    }
  );

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleApplyFilters = () => {
    refetch();
  };

  const handleContentInteraction = async (contentId, interactionType) => {
    try {
      await api.post('/interactions', {
        contentId,
        type: interactionType
      });
      // Refetch to update personalization
      refetch();
    } catch (error) {
      console.error('Failed to record interaction:', error);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 48) return 'Yesterday';
    return date.toLocaleDateString();
  };

  const renderContent = () => {
    if (isLoading) {
      return <LoadingSpinner>Loading your personalized content...</LoadingSpinner>;
    }

    if (error) {
      return <ErrorMessage>Failed to load dashboard content. Please try again.</ErrorMessage>;
    }

    if (!dashboardData?.content?.length) {
      return (
        <PlaceholderText>
          No content available yet. Add some sources to start discovering relevant AI/LLM content!
        </PlaceholderText>
      );
    }

    return (
      <ContentGrid>
        {dashboardData.content.map(item => (
          <ContentCard key={item.id}>
            <ContentHeader>
              <ContentTitle>{item.title}</ContentTitle>
              <ContentMeta>
                <RelevanceScore score={item.relevanceScore}>
                  {Math.round(item.relevanceScore * 100)}%
                </RelevanceScore>
                <ContentDate>{formatDate(item.publishDate)}</ContentDate>
              </ContentMeta>
            </ContentHeader>
            
            <ContentSummary>{item.summary}</ContentSummary>
            
            <ContentFooter>
              <ContentTags>
                {item.topics?.slice(0, 3).map(topic => (
                  <Tag key={topic}>{topic}</Tag>
                ))}
                <Tag>{item.type}</Tag>
              </ContentTags>
              
              <ContentActions>
                <ActionButton 
                  onClick={() => handleContentInteraction(item.id, 'view')}
                  primary
                >
                  Read
                </ActionButton>
                <ActionButton 
                  onClick={() => handleContentInteraction(item.id, 'save')}
                >
                  Save
                </ActionButton>
              </ContentActions>
            </ContentFooter>
          </ContentCard>
        ))}
      </ContentGrid>
    );
  };

  return (
    <DashboardContainer>
      <WelcomeSection>
        <WelcomeTitle>Welcome back, {user?.name}!</WelcomeTitle>
        <WelcomeText>
          Stay up to date with the latest AI and LLM developments. 
          Your personalized dashboard shows the most relevant content based on your interests and preferences.
        </WelcomeText>
      </WelcomeSection>

      {dashboardData?.breakingNews && (
        <BreakingNewsAlert>
          <BreakingNewsTitle>🚨 Breaking News</BreakingNewsTitle>
          <BreakingNewsText>{dashboardData.breakingNews}</BreakingNewsText>
        </BreakingNewsAlert>
      )}

      <StatsGrid>
        <StatCard>
          <StatNumber>{stats?.sourcesMonitored || 0}</StatNumber>
          <StatLabel>Sources Monitored</StatLabel>
        </StatCard>
        <StatCard>
          <StatNumber>{stats?.articlesToday || 0}</StatNumber>
          <StatLabel>Articles Today</StatLabel>
        </StatCard>
        <StatCard>
          <StatNumber>{stats?.savedItems || 0}</StatNumber>
          <StatLabel>Saved Items</StatLabel>
        </StatCard>
        <StatCard>
          <StatNumber>{stats?.collections || 0}</StatNumber>
          <StatLabel>Collections</StatLabel>
        </StatCard>
      </StatsGrid>

      <FilterSection>
        <FilterGrid>
          <FilterGroup>
            <FilterLabel htmlFor="topic-filter">Topic</FilterLabel>
            <FilterSelect
              id="topic-filter"
              value={filters.topic}
              onChange={(e) => handleFilterChange('topic', e.target.value)}
            >
              <option value="">All Topics</option>
              <option value="machine-learning">Machine Learning</option>
              <option value="natural-language-processing">NLP</option>
              <option value="computer-vision">Computer Vision</option>
              <option value="ai-ethics">AI Ethics</option>
              <option value="llm">Large Language Models</option>
              <option value="generative-ai">Generative AI</option>
            </FilterSelect>
          </FilterGroup>
          
          <FilterGroup>
            <FilterLabel htmlFor="source-type-filter">Source Type</FilterLabel>
            <FilterSelect
              id="source-type-filter"
              value={filters.sourceType}
              onChange={(e) => handleFilterChange('sourceType', e.target.value)}
            >
              <option value="">All Sources</option>
              <option value="academic">Academic Papers</option>
              <option value="blog">Blog Posts</option>
              <option value="news">News Articles</option>
              <option value="podcast">Podcasts</option>
              <option value="video">Videos</option>
            </FilterSelect>
          </FilterGroup>
          
          <FilterGroup>
            <FilterLabel htmlFor="time-period-filter">Time Period</FilterLabel>
            <FilterSelect
              id="time-period-filter"
              value={filters.timePeriod}
              onChange={(e) => handleFilterChange('timePeriod', e.target.value)}
            >
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="all">All Time</option>
            </FilterSelect>
          </FilterGroup>
          
          <FilterButton onClick={handleApplyFilters} disabled={isLoading}>
            Apply Filters
          </FilterButton>
        </FilterGrid>
      </FilterSection>

      <ContentSection>
        <SectionTitle>
          Today's Highlights
          <SortSelect
            value={filters.sortBy}
            onChange={(e) => handleFilterChange('sortBy', e.target.value)}
          >
            <option value="relevance">Sort by Relevance</option>
            <option value="recency">Sort by Recency</option>
            <option value="popularity">Sort by Popularity</option>
          </SortSelect>
        </SectionTitle>
        {renderContent()}
      </ContentSection>
    </DashboardContainer>
  );
};

// API functions
const fetchDashboardData = async (filters) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.append(key, value);
  });
  
  const response = await api.get(`/dashboard/content?${params}`);
  return response.data;
};

const fetchDashboardStats = async () => {
  const response = await api.get('/dashboard/stats');
  return response.data;
};

export default Dashboard;