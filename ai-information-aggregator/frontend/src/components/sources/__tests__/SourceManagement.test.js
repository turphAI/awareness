import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import SourceManagement from '../SourceManagement';
import sourceService from '../../../services/sourceService';
import categoryService from '../../../services/categoryService';

// Mock the services
jest.mock('../../../services/sourceService');
jest.mock('../../../services/categoryService');

// Mock the child components
jest.mock('../SourceForm', () => {
  return function MockSourceForm({ onSubmit, onCancel, source }) {
    return (
      <div data-testid="source-form">
        <button onClick={() => onSubmit({ name: 'Test Source', url: 'https://test.com' })}>
          Submit
        </button>
        <button onClick={onCancel}>Cancel</button>
        {source && <div data-testid="editing-source">{source.name}</div>}
      </div>
    );
  };
});

jest.mock('../SourceList', () => {
  return function MockSourceList({ sources, onEdit, onDelete, onUpdateRelevance }) {
    return (
      <div data-testid="source-list">
        {sources.map(source => (
          <div key={source._id} data-testid={`source-${source._id}`}>
            <span>{source.name}</span>
            <button onClick={() => onEdit(source)}>Edit</button>
            <button onClick={() => onDelete(source._id)}>Delete</button>
            <button onClick={() => onUpdateRelevance(source._id, 0.8, 'test')}>
              Update Relevance
            </button>
          </div>
        ))}
      </div>
    );
  };
});

jest.mock('../CategoryManager', () => {
  return function MockCategoryManager() {
    return <div data-testid="category-manager">Category Manager</div>;
  };
});

const mockSources = [
  {
    _id: '1',
    name: 'Test Source 1',
    url: 'https://test1.com',
    type: 'website',
    categories: ['AI Research'],
    relevanceScore: 0.7,
    active: true
  },
  {
    _id: '2',
    name: 'Test Source 2',
    url: 'https://test2.com',
    type: 'blog',
    categories: ['UX Design'],
    relevanceScore: 0.5,
    active: true
  }
];

const mockCategories = [
  {
    _id: 'cat1',
    name: 'AI Research',
    description: 'AI research papers',
    color: '#007bff'
  },
  {
    _id: 'cat2',
    name: 'UX Design',
    description: 'UX design articles',
    color: '#28a745'
  }
];

const createTestQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
};

const renderWithQueryClient = (component) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  );
};

describe('SourceManagement', () => {
  beforeEach(() => {
    sourceService.getAllSources.mockResolvedValue(mockSources);
    categoryService.getAllCategories.mockResolvedValue(mockCategories);
    sourceService.createSource.mockResolvedValue(mockSources[0]);
    sourceService.updateSource.mockResolvedValue(mockSources[0]);
    sourceService.deleteSource.mockResolvedValue({ message: 'Deleted' });
    sourceService.updateRelevance.mockResolvedValue(mockSources[0]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders source management interface', async () => {
    renderWithQueryClient(<SourceManagement />);
    
    expect(screen.getByText('Source Management')).toBeInTheDocument();
    expect(screen.getByText('Add Source')).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.getByTestId('source-list')).toBeInTheDocument();
    });
  });

  it('displays source statistics', async () => {
    renderWithQueryClient(<SourceManagement />);
    
    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument(); // Total sources
      expect(screen.getByText('Total Sources')).toBeInTheDocument();
      expect(screen.getByText('Active Sources')).toBeInTheDocument();
      expect(screen.getByText('Avg Relevance')).toBeInTheDocument();
    });
  });

  it('shows add source form when Add Source button is clicked', async () => {
    renderWithQueryClient(<SourceManagement />);
    
    await waitFor(() => {
      expect(screen.getByTestId('source-list')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('Add Source'));
    
    expect(screen.getByTestId('source-form')).toBeInTheDocument();
    expect(screen.queryByTestId('source-list')).not.toBeInTheDocument();
  });

  it('switches between tabs', async () => {
    renderWithQueryClient(<SourceManagement />);
    
    await waitFor(() => {
      expect(screen.getByTestId('source-list')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('Categories'));
    
    expect(screen.getByTestId('category-manager')).toBeInTheDocument();
    expect(screen.queryByTestId('source-list')).not.toBeInTheDocument();
    
    fireEvent.click(screen.getByText('Sources'));
    
    expect(screen.getByTestId('source-list')).toBeInTheDocument();
    expect(screen.queryByTestId('category-manager')).not.toBeInTheDocument();
  });

  it('creates a new source', async () => {
    renderWithQueryClient(<SourceManagement />);
    
    await waitFor(() => {
      expect(screen.getByTestId('source-list')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('Add Source'));
    fireEvent.click(screen.getByText('Submit'));
    
    await waitFor(() => {
      expect(sourceService.createSource).toHaveBeenCalledWith({
        name: 'Test Source',
        url: 'https://test.com'
      });
    });
  });

  it('edits an existing source', async () => {
    renderWithQueryClient(<SourceManagement />);
    
    await waitFor(() => {
      expect(screen.getByTestId('source-list')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getAllByText('Edit')[0]);
    
    expect(screen.getByTestId('source-form')).toBeInTheDocument();
    expect(screen.getByTestId('editing-source')).toHaveTextContent('Test Source 1');
  });

  it('deletes a source with confirmation', async () => {
    // Mock window.confirm
    const originalConfirm = window.confirm;
    window.confirm = jest.fn(() => true);
    
    renderWithQueryClient(<SourceManagement />);
    
    await waitFor(() => {
      expect(screen.getByTestId('source-list')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getAllByText('Delete')[0]);
    
    await waitFor(() => {
      expect(sourceService.deleteSource).toHaveBeenCalledWith('1');
    });
    
    // Restore window.confirm
    window.confirm = originalConfirm;
  });

  it('updates source relevance', async () => {
    renderWithQueryClient(<SourceManagement />);
    
    await waitFor(() => {
      expect(screen.getByTestId('source-list')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getAllByText('Update Relevance')[0]);
    
    await waitFor(() => {
      expect(sourceService.updateRelevance).toHaveBeenCalledWith('1', 0.8, 'test');
    });
  });

  it('cancels form editing', async () => {
    renderWithQueryClient(<SourceManagement />);
    
    await waitFor(() => {
      expect(screen.getByTestId('source-list')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('Add Source'));
    expect(screen.getByTestId('source-form')).toBeInTheDocument();
    
    fireEvent.click(screen.getByText('Cancel'));
    
    expect(screen.queryByTestId('source-form')).not.toBeInTheDocument();
    expect(screen.getByTestId('source-list')).toBeInTheDocument();
  });

  it('handles API errors gracefully', async () => {
    sourceService.getAllSources.mockRejectedValue(new Error('API Error'));
    
    renderWithQueryClient(<SourceManagement />);
    
    await waitFor(() => {
      expect(screen.getByText('Failed to load sources')).toBeInTheDocument();
    });
  });

  it('dismisses error messages', async () => {
    sourceService.getAllSources.mockRejectedValue(new Error('API Error'));
    
    renderWithQueryClient(<SourceManagement />);
    
    await waitFor(() => {
      expect(screen.getByText('Failed to load sources')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('×'));
    
    expect(screen.queryByText('Failed to load sources')).not.toBeInTheDocument();
  });
});