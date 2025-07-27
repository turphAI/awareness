import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import ContentLibrary from '../ContentLibrary';
import api from '../../../services/api';

// Mock the API
jest.mock('../../../services/api');

// Mock child components
jest.mock('../ContentList', () => {
  return function MockContentList({ content, selectedContent, onContentSelect, onContentInteraction }) {
    return (
      <div data-testid="content-list">
        {content.map(item => (
          <div
            key={item.id}
            data-testid={`content-item-${item.id}`}
            onClick={() => onContentSelect(item)}
            style={{ background: selectedContent?.id === item.id ? 'blue' : 'white' }}
          >
            {item.title}
            <button onClick={(e) => {
              e.stopPropagation();
              onContentInteraction(item.id, 'save');
            }}>
              Save
            </button>
          </div>
        ))}
      </div>
    );
  };
});

jest.mock('../ContentDetail', () => {
  return function MockContentDetail({ content, onInteraction }) {
    return (
      <div data-testid="content-detail">
        <h1>{content.title}</h1>
        <button onClick={() => onInteraction(content.id, 'view')}>
          View Full
        </button>
      </div>
    );
  };
});

jest.mock('../LibraryFilters', () => {
  return function MockLibraryFilters({ filters, onChange }) {
    return (
      <div data-testid="library-filters">
        <select
          data-testid="type-filter"
          value={filters.type}
          onChange={(e) => onChange({ type: e.target.value })}
        >
          <option value="">All Types</option>
          <option value="article">Articles</option>
          <option value="paper">Papers</option>
        </select>
      </div>
    );
  };
});

jest.mock('../SearchBar', () => {
  return function MockSearchBar({ value, onChange }) {
    return (
      <input
        data-testid="search-bar"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search content..."
      />
    );
  };
});

const mockContent = [
  {
    id: '1',
    title: 'Introduction to Machine Learning',
    summary: 'A comprehensive guide to ML basics',
    type: 'article',
    relevanceScore: 0.85,
    publishDate: '2023-01-15T10:00:00Z',
    topics: ['machine-learning', 'ai']
  },
  {
    id: '2',
    title: 'Deep Learning Research Paper',
    summary: 'Latest advances in deep learning',
    type: 'paper',
    relevanceScore: 0.92,
    publishDate: '2023-01-14T15:30:00Z',
    topics: ['deep-learning', 'neural-networks']
  }
];

const mockStats = {
  totalItems: 150,
  newToday: 5,
  articles: 80,
  papers: 45,
  podcasts: 15,
  videos: 10
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  
  return ({ children }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('ContentLibrary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock successful API responses
    api.get.mockImplementation((url) => {
      if (url.includes('/library/content')) {
        return Promise.resolve({
          data: { content: mockContent }
        });
      }
      if (url.includes('/library/stats')) {
        return Promise.resolve({
          data: mockStats
        });
      }
      if (url.includes('/interactions')) {
        return Promise.resolve({ data: { success: true } });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });

    api.post.mockResolvedValue({ data: { success: true } });
  });

  it('renders library header with stats', async () => {
    render(<ContentLibrary />, { wrapper: createWrapper() });
    
    await waitFor(() => {
      expect(screen.getByText('Content Library')).toBeInTheDocument();
      expect(screen.getByText('150 items • 5 new today')).toBeInTheDocument();
    });
  });

  it('renders search bar and filters', async () => {
    render(<ContentLibrary />, { wrapper: createWrapper() });
    
    await waitFor(() => {
      expect(screen.getByTestId('search-bar')).toBeInTheDocument();
      expect(screen.getByTestId('library-filters')).toBeInTheDocument();
    });
  });

  it('displays content list when data is loaded', async () => {
    render(<ContentLibrary />, { wrapper: createWrapper() });
    
    await waitFor(() => {
      expect(screen.getByTestId('content-list')).toBeInTheDocument();
      expect(screen.getByText('Introduction to Machine Learning')).toBeInTheDocument();
      expect(screen.getByText('Deep Learning Research Paper')).toBeInTheDocument();
    });
  });

  it('shows empty state when no content is available', async () => {
    api.get.mockImplementation((url) => {
      if (url.includes('/library/content')) {
        return Promise.resolve({
          data: { content: [] }
        });
      }
      if (url.includes('/library/stats')) {
        return Promise.resolve({
          data: mockStats
        });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });

    render(<ContentLibrary />, { wrapper: createWrapper() });
    
    await waitFor(() => {
      expect(screen.getByText('No content found')).toBeInTheDocument();
      expect(screen.getByText(/Try adjusting your search or filters to find content/)).toBeInTheDocument();
    });
  });

  it('handles search functionality', async () => {
    render(<ContentLibrary />, { wrapper: createWrapper() });
    
    await waitFor(() => {
      expect(screen.getByTestId('search-bar')).toBeInTheDocument();
    });

    const searchInput = screen.getByTestId('search-bar');
    fireEvent.change(searchInput, { target: { value: 'machine learning' } });

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        expect.stringContaining('search=machine+learning')
      );
    });
  });

  it('handles filter changes', async () => {
    render(<ContentLibrary />, { wrapper: createWrapper() });
    
    await waitFor(() => {
      expect(screen.getByTestId('type-filter')).toBeInTheDocument();
    });

    const typeFilter = screen.getByTestId('type-filter');
    fireEvent.change(typeFilter, { target: { value: 'article' } });

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        expect.stringContaining('type=article')
      );
    });
  });

  it('handles content selection', async () => {
    render(<ContentLibrary />, { wrapper: createWrapper() });
    
    await waitFor(() => {
      expect(screen.getByTestId('content-item-1')).toBeInTheDocument();
    });

    const contentItem = screen.getByTestId('content-item-1');
    fireEvent.click(contentItem);

    await waitFor(() => {
      expect(screen.getByTestId('content-detail')).toBeInTheDocument();
      expect(screen.getAllByText('Introduction to Machine Learning')).toHaveLength(2);
    });

    // Check that interaction was recorded
    expect(api.post).toHaveBeenCalledWith('/interactions', {
      contentId: '1',
      type: 'view'
    });
  });

  it('shows content detail when item is selected', async () => {
    render(<ContentLibrary />, { wrapper: createWrapper() });
    
    await waitFor(() => {
      expect(screen.getByTestId('content-item-1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('content-item-1'));

    await waitFor(() => {
      expect(screen.getByTestId('content-detail')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'View Full' })).toBeInTheDocument();
    });
  });

  it('handles content interactions from list', async () => {
    render(<ContentLibrary />, { wrapper: createWrapper() });
    
    await waitFor(() => {
      expect(screen.getByTestId('content-item-1')).toBeInTheDocument();
    });

    const saveButton = screen.getAllByText('Save')[0];
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/interactions', {
        contentId: '1',
        type: 'save'
      });
    });
  });

  it('handles content interactions from detail view', async () => {
    render(<ContentLibrary />, { wrapper: createWrapper() });
    
    await waitFor(() => {
      expect(screen.getByTestId('content-item-1')).toBeInTheDocument();
    });

    // Select content first
    fireEvent.click(screen.getByTestId('content-item-1'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'View Full' })).toBeInTheDocument();
    });

    // Click view full button
    fireEvent.click(screen.getByRole('button', { name: 'View Full' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/interactions', {
        contentId: '1',
        type: 'view'
      });
    });
  });

  it('shows loading state', () => {
    api.get.mockImplementation(() => new Promise(() => {})); // Never resolves
    
    render(<ContentLibrary />, { wrapper: createWrapper() });
    
    expect(screen.getByText('Loading library content...')).toBeInTheDocument();
  });

  it('shows error state', async () => {
    api.get.mockRejectedValue(new Error('API Error'));
    
    render(<ContentLibrary />, { wrapper: createWrapper() });
    
    await waitFor(() => {
      expect(screen.getByText('Failed to load library content. Please try again.')).toBeInTheDocument();
    });
  });

  it('shows empty state for content detail when nothing is selected', async () => {
    render(<ContentLibrary />, { wrapper: createWrapper() });
    
    await waitFor(() => {
      expect(screen.getByText('Select content to view details')).toBeInTheDocument();
      expect(screen.getByText(/Choose an item from the library/)).toBeInTheDocument();
    });
  });

  it('clears selection when search changes', async () => {
    render(<ContentLibrary />, { wrapper: createWrapper() });
    
    await waitFor(() => {
      expect(screen.getByTestId('content-item-1')).toBeInTheDocument();
    });

    // Select content
    fireEvent.click(screen.getByTestId('content-item-1'));

    await waitFor(() => {
      expect(screen.getByTestId('content-detail')).toBeInTheDocument();
    });

    // Change search
    const searchInput = screen.getByTestId('search-bar');
    fireEvent.change(searchInput, { target: { value: 'new search' } });

    await waitFor(() => {
      expect(screen.getByText('Select content to view details')).toBeInTheDocument();
    });
  });

  it('clears selection when filters change', async () => {
    render(<ContentLibrary />, { wrapper: createWrapper() });
    
    await waitFor(() => {
      expect(screen.getByTestId('content-item-1')).toBeInTheDocument();
    });

    // Select content
    fireEvent.click(screen.getByTestId('content-item-1'));

    await waitFor(() => {
      expect(screen.getByTestId('content-detail')).toBeInTheDocument();
    });

    // Change filter
    const typeFilter = screen.getByTestId('type-filter');
    fireEvent.change(typeFilter, { target: { value: 'paper' } });

    await waitFor(() => {
      expect(screen.getByText('Select content to view details')).toBeInTheDocument();
    });
  });
});