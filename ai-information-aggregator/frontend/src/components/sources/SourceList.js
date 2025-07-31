import React, { useState } from 'react';
import styled from 'styled-components';

const Container = styled.div`
  width: 100%;
`;

const Controls = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 10px;
`;

const SearchInput = styled.input`
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  min-width: 250px;
  
  &:focus {
    outline: none;
    border-color: #007bff;
    box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
  }
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

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

const TableHeader = styled.thead`
  background: #f8f9fa;
`;

const TableRow = styled.tr`
  border-bottom: 1px solid #e0e0e0;
  
  &:hover {
    background: #f8f9fa;
  }
`;

const TableHeaderCell = styled.th`
  padding: 12px;
  text-align: left;
  font-weight: 600;
  color: #333;
  cursor: ${props => props.sortable ? 'pointer' : 'default'};
  
  &:hover {
    background: ${props => props.sortable ? '#e9ecef' : 'transparent'};
  }
`;

const TableCell = styled.td`
  padding: 12px;
  vertical-align: top;
`;

const SourceName = styled.div`
  font-weight: 500;
  color: #333;
  margin-bottom: 4px;
`;

const SourceUrl = styled.div`
  font-size: 12px;
  color: #666;
  word-break: break-all;
`;

const SourceType = styled.span`
  background: #e9ecef;
  color: #495057;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  text-transform: capitalize;
`;

const CategoryTags = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
`;

const CategoryTag = styled.span`
  background: #007bff;
  color: white;
  padding: 2px 6px;
  border-radius: 10px;
  font-size: 11px;
`;

const RelevanceContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const RelevanceBar = styled.div`
  width: 60px;
  height: 8px;
  background: #e9ecef;
  border-radius: 4px;
  overflow: hidden;
`;

const RelevanceFill = styled.div`
  height: 100%;
  background: ${props => {
    if (props.score >= 0.8) return '#28a745';
    if (props.score >= 0.6) return '#ffc107';
    if (props.score >= 0.4) return '#fd7e14';
    return '#dc3545';
  }};
  width: ${props => props.score * 100}%;
  transition: width 0.3s ease;
`;

const RelevanceScore = styled.span`
  font-size: 12px;
  color: #666;
  min-width: 30px;
`;

const RelevanceInput = styled.input`
  width: 60px;
  padding: 2px 4px;
  border: 1px solid #ddd;
  border-radius: 2px;
  font-size: 12px;
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 5px;
`;

const ActionButton = styled.button`
  padding: 4px 8px;
  border: none;
  border-radius: 3px;
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.2s;
  
  ${props => {
    switch (props.variant) {
      case 'edit':
        return `
          background: #007bff;
          color: white;
          &:hover { background: #0056b3; }
        `;
      case 'delete':
        return `
          background: #dc3545;
          color: white;
          &:hover { background: #c82333; }
        `;
      default:
        return `
          background: #6c757d;
          color: white;
          &:hover { background: #5a6268; }
        `;
    }
  }}
  
  &:disabled {
    background: #ccc;
    cursor: not-allowed;
  }
`;

const StatusIndicator = styled.div`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${props => props.active ? '#28a745' : '#dc3545'};
  display: inline-block;
  margin-right: 8px;
`;

const LastChecked = styled.div`
  font-size: 12px;
  color: #666;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 40px;
  color: #666;
`;

const SourceList = ({ 
  sources, 
  categories, 
  onEdit, 
  onDelete, 
  onUpdateRelevance, 
  isUpdatingRelevance 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [editingRelevance, setEditingRelevance] = useState(null);

  // Filter and sort sources
  const filteredSources = sources
    .filter(source => {
      const matchesSearch = source.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           source.url.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = typeFilter === 'all' || source.type === typeFilter;
      const matchesCategory = categoryFilter === 'all' || 
                             source.categories.includes(categoryFilter);
      
      return matchesSearch && matchesType && matchesCategory;
    })
    .sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];
      
      if (sortBy === 'relevanceScore') {
        aValue = parseFloat(aValue);
        bValue = parseFloat(bValue);
      } else if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const handleRelevanceEdit = (sourceId, currentScore) => {
    setEditingRelevance({ sourceId, score: currentScore });
  };

  const handleRelevanceSubmit = (sourceId, newScore) => {
    const score = parseFloat(newScore);
    if (score >= 0 && score <= 1) {
      onUpdateRelevance(sourceId, score, 'manual_update');
    }
    setEditingRelevance(null);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString();
  };

  const getSourceTypes = () => {
    const types = [...new Set(sources.map(s => s.type))];
    return types.sort();
  };

  const getCategoryNames = () => {
    return categories.map(c => c.name).sort();
  };

  if (sources.length === 0) {
    return (
      <EmptyState>
        <h3>No sources found</h3>
        <p>Add your first source to get started</p>
      </EmptyState>
    );
  }

  return (
    <Container>
      <Controls>
        <SearchInput
          type="text"
          placeholder="Search sources..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        
        <div style={{ display: 'flex', gap: '10px' }}>
          <FilterSelect
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">All Types</option>
            {getSourceTypes().map(type => (
              <option key={type} value={type}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </option>
            ))}
          </FilterSelect>
          
          <FilterSelect
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all">All Categories</option>
            {getCategoryNames().map(category => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </FilterSelect>
        </div>
      </Controls>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHeaderCell 
              sortable 
              onClick={() => handleSort('name')}
            >
              Source {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
            </TableHeaderCell>
            <TableHeaderCell 
              sortable 
              onClick={() => handleSort('type')}
            >
              Type {sortBy === 'type' && (sortOrder === 'asc' ? '↑' : '↓')}
            </TableHeaderCell>
            <TableHeaderCell>Categories</TableHeaderCell>
            <TableHeaderCell 
              sortable 
              onClick={() => handleSort('relevanceScore')}
            >
              Relevance {sortBy === 'relevanceScore' && (sortOrder === 'asc' ? '↑' : '↓')}
            </TableHeaderCell>
            <TableHeaderCell 
              sortable 
              onClick={() => handleSort('lastChecked')}
            >
              Last Checked {sortBy === 'lastChecked' && (sortOrder === 'asc' ? '↑' : '↓')}
            </TableHeaderCell>
            <TableHeaderCell>Actions</TableHeaderCell>
          </TableRow>
        </TableHeader>
        <tbody>
          {filteredSources.map(source => (
            <TableRow key={source._id}>
              <TableCell>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <StatusIndicator active={source.active} />
                  <div>
                    <SourceName>{source.name}</SourceName>
                    <SourceUrl>{source.url}</SourceUrl>
                  </div>
                </div>
              </TableCell>
              
              <TableCell>
                <SourceType>{source.type}</SourceType>
              </TableCell>
              
              <TableCell>
                <CategoryTags>
                  {source.categories.map(category => (
                    <CategoryTag key={category}>{category}</CategoryTag>
                  ))}
                </CategoryTags>
              </TableCell>
              
              <TableCell>
                <RelevanceContainer>
                  <RelevanceBar>
                    <RelevanceFill score={source.relevanceScore} />
                  </RelevanceBar>
                  {editingRelevance?.sourceId === source._id ? (
                    <RelevanceInput
                      type="number"
                      min="0"
                      max="1"
                      step="0.1"
                      value={editingRelevance?.score || 0}
                      onChange={(e) => setEditingRelevance({
                        ...editingRelevance,
                        score: e.target.value
                      })}
                      onBlur={() => handleRelevanceSubmit(source._id, editingRelevance?.score || 0)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleRelevanceSubmit(source._id, editingRelevance?.score || 0);
                        }
                      }}
                      autoFocus
                    />
                  ) : (
                    <RelevanceScore
                      onClick={() => handleRelevanceEdit(source._id, source.relevanceScore)}
                      style={{ cursor: 'pointer' }}
                    >
                      {(source.relevanceScore * 100).toFixed(0)}%
                    </RelevanceScore>
                  )}
                </RelevanceContainer>
              </TableCell>
              
              <TableCell>
                <LastChecked>{formatDate(source.lastChecked)}</LastChecked>
              </TableCell>
              
              <TableCell>
                <ActionButtons>
                  <ActionButton
                    variant="edit"
                    onClick={() => onEdit(source)}
                  >
                    Edit
                  </ActionButton>
                  <ActionButton
                    variant="delete"
                    onClick={() => onDelete(source._id)}
                    disabled={isUpdatingRelevance}
                  >
                    Delete
                  </ActionButton>
                </ActionButtons>
              </TableCell>
            </TableRow>
          ))}
        </tbody>
      </Table>
    </Container>
  );
};

export default SourceList;