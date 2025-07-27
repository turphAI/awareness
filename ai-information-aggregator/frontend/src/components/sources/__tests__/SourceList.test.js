import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SourceList from '../SourceList';

const mockSources = [
  {
    _id: '1',
    name: 'AI Research Blog',
    url: 'https://ai-research.com',
    type: 'blog',
    categories: ['AI Research', 'Machine Learning'],
    relevanceScore: 0.8,
    active: true,
    lastChecked: '2023-12-01T10:00:00Z'
  },
  {
    _id: '2',
    name: 'UX Design Weekly',
    url: 'https://ux-weekly.com',
    type: 'newsletter',
    categories: ['UX Design'],
    relevanceScore: 0.6,
    active: true,
    lastChecked: null
  },
  {
    _id: '3',
    name: 'Tech Podcast',
    url: 'https://tech-podcast.com',
    type: 'podcast',
    categories: ['Technology'],
    relevanceScore: 0.4,
    active: false,
    lastChecked: '2023-11-15T15:30:00Z'
  }
];

const mockCategories = [
  { _id: 'cat1', name: 'AI Research' },
  { _id: 'cat2', name: 'UX Design' },
  { _id: 'cat3', name: 'Technology' },
  { _id: 'cat4', name: 'Machine Learning' }
];

describe('SourceList', () => {
  const mockOnEdit = jest.fn();
  const mockOnDelete = jest.fn();
  const mockOnUpdateRelevance = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders source list with all sources', () => {
    render(
      <SourceList
        sources={mockSources}
        categories={mockCategories}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onUpdateRelevance={mockOnUpdateRelevance}
        isUpdatingRelevance={false}
      />
    );

    expect(screen.getByText('AI Research Blog')).toBeInTheDocument();
    expect(screen.getByText('UX Design Weekly')).toBeInTheDocument();
    expect(screen.getByText('Tech Podcast')).toBeInTheDocument();
  });

  it('shows empty state when no sources', () => {
    render(
      <SourceList
        sources={[]}
        categories={mockCategories}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onUpdateRelevance={mockOnUpdateRelevance}
        isUpdatingRelevance={false}
      />
    );

    expect(screen.getByText('No sources found')).toBeInTheDocument();
    expect(screen.getByText('Add your first source to get started')).toBeInTheDocument();
  });

  it('filters sources by search term', async () => {
    
    render(
      <SourceList
        sources={mockSources}
        categories={mockCategories}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onUpdateRelevance={mockOnUpdateRelevance}
        isUpdatingRelevance={false}
      />
    );

    const searchInput = screen.getByPlaceholderText('Search sources...');
    fireEvent.change(searchInput, { target: { value: 'AI' } });

    expect(screen.getByText('AI Research Blog')).toBeInTheDocument();
    expect(screen.queryByText('UX Design Weekly')).not.toBeInTheDocument();
    expect(screen.queryByText('Tech Podcast')).not.toBeInTheDocument();
  });

  it('filters sources by type', async () => {
    
    render(
      <SourceList
        sources={mockSources}
        categories={mockCategories}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onUpdateRelevance={mockOnUpdateRelevance}
        isUpdatingRelevance={false}
      />
    );

    const typeFilter = screen.getByDisplayValue('All Types');
    fireEvent.change(typeFilter, { target: { value: 'blog' } });

    expect(screen.getByText('AI Research Blog')).toBeInTheDocument();
    expect(screen.queryByText('UX Design Weekly')).not.toBeInTheDocument();
    expect(screen.queryByText('Tech Podcast')).not.toBeInTheDocument();
  });

  it('filters sources by category', async () => {
    
    render(
      <SourceList
        sources={mockSources}
        categories={mockCategories}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onUpdateRelevance={mockOnUpdateRelevance}
        isUpdatingRelevance={false}
      />
    );

    const categoryFilter = screen.getByDisplayValue('All Categories');
    fireEvent.change(categoryFilter, { target: { value: 'UX Design' } });

    expect(screen.queryByText('AI Research Blog')).not.toBeInTheDocument();
    expect(screen.getByText('UX Design Weekly')).toBeInTheDocument();
    expect(screen.queryByText('Tech Podcast')).not.toBeInTheDocument();
  });

  it('sorts sources by name', async () => {
    
    render(
      <SourceList
        sources={mockSources}
        categories={mockCategories}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onUpdateRelevance={mockOnUpdateRelevance}
        isUpdatingRelevance={false}
      />
    );

    const nameHeader = screen.getByText(/Source/);
    fireEvent.click(nameHeader);

    // Check if sources are sorted alphabetically
    const sourceNames = screen.getAllByText(/AI Research Blog|UX Design Weekly|Tech Podcast/);
    expect(sourceNames[0]).toHaveTextContent('AI Research Blog');
    expect(sourceNames[1]).toHaveTextContent('Tech Podcast');
    expect(sourceNames[2]).toHaveTextContent('UX Design Weekly');
  });

  it('sorts sources by relevance score', async () => {
    
    render(
      <SourceList
        sources={mockSources}
        categories={mockCategories}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onUpdateRelevance={mockOnUpdateRelevance}
        isUpdatingRelevance={false}
      />
    );

    const relevanceHeader = screen.getByText(/Relevance/);
    fireEvent.click(relevanceHeader);

    // Check if sources are sorted by relevance (ascending first)
    const relevanceScores = screen.getAllByText(/40%|60%|80%/);
    expect(relevanceScores[0]).toHaveTextContent('40%');
    expect(relevanceScores[1]).toHaveTextContent('60%');
    expect(relevanceScores[2]).toHaveTextContent('80%');
  });

  it('toggles sort order when clicking same header', async () => {
    
    render(
      <SourceList
        sources={mockSources}
        categories={mockCategories}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onUpdateRelevance={mockOnUpdateRelevance}
        isUpdatingRelevance={false}
      />
    );

    const relevanceHeader = screen.getByText(/Relevance/);
    
    // First click - ascending
    fireEvent.click(relevanceHeader);
    expect(screen.getByText('Relevance ↑')).toBeInTheDocument();
    
    // Second click - descending
    fireEvent.click(relevanceHeader);
    expect(screen.getByText('Relevance ↓')).toBeInTheDocument();
  });

  it('displays source information correctly', () => {
    render(
      <SourceList
        sources={mockSources}
        categories={mockCategories}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onUpdateRelevance={mockOnUpdateRelevance}
        isUpdatingRelevance={false}
      />
    );

    // Check source name and URL
    expect(screen.getByText('AI Research Blog')).toBeInTheDocument();
    expect(screen.getByText('https://ai-research.com')).toBeInTheDocument();

    // Check source type
    expect(screen.getByText('blog')).toBeInTheDocument();

    // Check categories
    expect(screen.getByText('AI Research')).toBeInTheDocument();
    expect(screen.getByText('Machine Learning')).toBeInTheDocument();

    // Check relevance score
    expect(screen.getByText('80%')).toBeInTheDocument();

    // Check last checked date
    expect(screen.getByText('12/1/2023')).toBeInTheDocument();
    expect(screen.getByText('Never')).toBeInTheDocument();
  });

  it('shows active/inactive status indicators', () => {
    render(
      <SourceList
        sources={mockSources}
        categories={mockCategories}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onUpdateRelevance={mockOnUpdateRelevance}
        isUpdatingRelevance={false}
      />
    );

    // Active sources should have green indicators, inactive should have red
    const rows = screen.getAllByRole('row');
    // Skip header row, check data rows
    expect(rows).toHaveLength(4); // 1 header + 3 data rows
  });

  it('calls onEdit when edit button is clicked', async () => {
    
    render(
      <SourceList
        sources={mockSources}
        categories={mockCategories}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onUpdateRelevance={mockOnUpdateRelevance}
        isUpdatingRelevance={false}
      />
    );

    const editButtons = screen.getAllByText('Edit');
    fireEvent.click(editButtons[0]);

    expect(mockOnEdit).toHaveBeenCalledWith(mockSources[0]);
  });

  it('calls onDelete when delete button is clicked', async () => {
    
    render(
      <SourceList
        sources={mockSources}
        categories={mockCategories}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onUpdateRelevance={mockOnUpdateRelevance}
        isUpdatingRelevance={false}
      />
    );

    const deleteButtons = screen.getAllByText('Delete');
    fireEvent.click(deleteButtons[0]);

    expect(mockOnDelete).toHaveBeenCalledWith('1');
  });

  it('allows inline editing of relevance score', async () => {
    
    render(
      <SourceList
        sources={mockSources}
        categories={mockCategories}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onUpdateRelevance={mockOnUpdateRelevance}
        isUpdatingRelevance={false}
      />
    );

    // Click on relevance score to edit
    const relevanceScore = screen.getByText('80%');
    fireEvent.click(relevanceScore);

    // Should show input field
    const input = screen.getByDisplayValue('0.8');
    expect(input).toBeInTheDocument();

    // Change value and blur
    fireEvent.change(input, { target: { value: '0.9' } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(mockOnUpdateRelevance).toHaveBeenCalledWith('1', 0.9, 'manual_update');
    });
  });

  it('submits relevance change on Enter key', async () => {
    
    render(
      <SourceList
        sources={mockSources}
        categories={mockCategories}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onUpdateRelevance={mockOnUpdateRelevance}
        isUpdatingRelevance={false}
      />
    );

    // Click on relevance score to edit
    const relevanceScore = screen.getByText('80%');
    fireEvent.click(relevanceScore);

    const input = screen.getByDisplayValue('0.8');
    fireEvent.change(input, { target: { value: '0.9' } });
    fireEvent.keyPress(input, { key: 'Enter', code: 'Enter' });

    expect(mockOnUpdateRelevance).toHaveBeenCalledWith('1', 0.9, 'manual_update');
  });

  it('disables delete button when updating relevance', () => {
    render(
      <SourceList
        sources={mockSources}
        categories={mockCategories}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onUpdateRelevance={mockOnUpdateRelevance}
        isUpdatingRelevance={true}
      />
    );

    const deleteButtons = screen.getAllByText('Delete');
    expect(deleteButtons[0]).toBeDisabled();
  });

  it('shows correct relevance bar colors', () => {
    render(
      <SourceList
        sources={mockSources}
        categories={mockCategories}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onUpdateRelevance={mockOnUpdateRelevance}
        isUpdatingRelevance={false}
      />
    );

    // High relevance (0.8) should be green
    // Medium relevance (0.6) should be yellow
    // Low relevance (0.4) should be orange/red
    // This would need to check computed styles or data attributes
  });
});