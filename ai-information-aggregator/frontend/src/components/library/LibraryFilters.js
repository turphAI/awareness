import React from 'react';
import styled from 'styled-components';

const FiltersContainer = styled.div`
  margin-top: 20px;
`;

const FilterGroup = styled.div`
  margin-bottom: 16px;
`;

const FilterLabel = styled.label`
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: #495057;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
`;

const FilterSelect = styled.select`
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  font-size: 14px;
  background: white;
  color: #495057;
  
  &:focus {
    outline: none;
    border-color: #007bff;
    box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.1);
  }
`;

const FilterCheckboxGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const CheckboxItem = styled.label`
  display: flex;
  align-items: center;
  font-size: 14px;
  color: #495057;
  cursor: pointer;
  
  input {
    margin-right: 8px;
  }
`;

const FilterStats = styled.div`
  font-size: 12px;
  color: #6c757d;
  margin-left: auto;
`;

const SortControls = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 8px;
`;

const SortButton = styled.button`
  flex: 1;
  padding: 6px 8px;
  border: 1px solid #dee2e6;
  background: ${props => props.active ? '#007bff' : 'white'};
  color: ${props => props.active ? 'white' : '#495057'};
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  
  &:hover {
    background: ${props => props.active ? '#0056b3' : '#f8f9fa'};
  }
`;

const ClearFiltersButton = styled.button`
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #dee2e6;
  background: white;
  color: #6c757d;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  margin-top: 16px;
  
  &:hover {
    background: #f8f9fa;
    color: #495057;
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const LibraryFilters = ({ filters, onChange, stats = {} }) => {
  const handleFilterChange = (key, value) => {
    onChange({ [key]: value });
  };

  const handleClearFilters = () => {
    onChange({
      type: '',
      category: '',
      dateRange: '',
      sortBy: 'relevance',
      sortOrder: 'desc'
    });
  };

  const hasActiveFilters = Object.values(filters).some(value => 
    value && value !== 'relevance' && value !== 'desc'
  );

  return (
    <FiltersContainer>
      <FilterGroup>
        <FilterLabel htmlFor="type-filter">Content Type</FilterLabel>
        <FilterSelect
          id="type-filter"
          value={filters.type}
          onChange={(e) => handleFilterChange('type', e.target.value)}
        >
          <option value="">All Types</option>
          <option value="article">Articles ({stats.articles || 0})</option>
          <option value="paper">Academic Papers ({stats.papers || 0})</option>
          <option value="podcast">Podcasts ({stats.podcasts || 0})</option>
          <option value="video">Videos ({stats.videos || 0})</option>
          <option value="social">Social Posts ({stats.social || 0})</option>
        </FilterSelect>
      </FilterGroup>

      <FilterGroup>
        <FilterLabel htmlFor="category-filter">Category</FilterLabel>
        <FilterSelect
          id="category-filter"
          value={filters.category}
          onChange={(e) => handleFilterChange('category', e.target.value)}
        >
          <option value="">All Categories</option>
          <option value="machine-learning">Machine Learning</option>
          <option value="natural-language-processing">NLP</option>
          <option value="computer-vision">Computer Vision</option>
          <option value="ai-ethics">AI Ethics</option>
          <option value="llm">Large Language Models</option>
          <option value="generative-ai">Generative AI</option>
          <option value="robotics">Robotics</option>
          <option value="ai-research">AI Research</option>
        </FilterSelect>
      </FilterGroup>

      <FilterGroup>
        <FilterLabel htmlFor="date-filter">Date Range</FilterLabel>
        <FilterSelect
          id="date-filter"
          value={filters.dateRange}
          onChange={(e) => handleFilterChange('dateRange', e.target.value)}
        >
          <option value="">All Time</option>
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="quarter">Last 3 Months</option>
          <option value="year">This Year</option>
        </FilterSelect>
      </FilterGroup>

      <FilterGroup>
        <FilterLabel>Sort By</FilterLabel>
        <FilterSelect
          value={filters.sortBy}
          onChange={(e) => handleFilterChange('sortBy', e.target.value)}
        >
          <option value="relevance">Relevance</option>
          <option value="date">Date</option>
          <option value="title">Title</option>
          <option value="author">Author</option>
          <option value="interactions">Popularity</option>
        </FilterSelect>
        
        <SortControls>
          <SortButton
            active={filters.sortOrder === 'desc'}
            onClick={() => handleFilterChange('sortOrder', 'desc')}
          >
            Desc
          </SortButton>
          <SortButton
            active={filters.sortOrder === 'asc'}
            onClick={() => handleFilterChange('sortOrder', 'asc')}
          >
            Asc
          </SortButton>
        </SortControls>
      </FilterGroup>

      <ClearFiltersButton
        onClick={handleClearFilters}
        disabled={!hasActiveFilters}
      >
        Clear All Filters
      </ClearFiltersButton>
    </FiltersContainer>
  );
};

export default LibraryFilters;