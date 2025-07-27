import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CollectionManagement from '../CollectionManagement';
import collectionService from '../../../services/collectionService';

// Mock the services
jest.mock('../../../services/collectionService');
jest.mock('styled-components', () => ({
  __esModule: true,
  default: (component) => (props) => component(props),
}));

// Mock child components
jest.mock('../CollectionForm', () => {
  return function MockCollectionForm({ collection, onSubmit, onCancel }) {
    return (
      <div data-testid="collection-form">
        <h2>{collection ? 'Edit Collection' : 'Create New Collection'}</h2>
        <button onClick={() => onSubmit({ name: 'Test Collection' })}>
          Submit
        </button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    );
  };
});

jest.mock('../CollectionList', () => {
  return function MockCollectionList({ collections, onSelect, onEdit, onDelete }) {
    return (
      <div data-testid="collection-list">
        {collections.map(collection => (
          <div key={collection._id} data-testid={`collection-${collection._id}`}>
            <span>{collection.name}</span>
            <button onClick={() => onSelect(collection)}>Select</button>
            <button onClick={() => onEdit(collection)}>Edit</button>
            <button onClick={() => onDelete(collection._id)}>Delete</button>
          </div>
        ))}
      </div>
    );
  };
});

jest.mock('../CollectionDetail', () => {
  return function MockCollectionDetail({ collection, onBack, onEdit, onDelete }) {
    return (
      <div data-testid="collection-detail">
        <h2>{collection.name}</h2>
        <button onClick={onBack}>Back</button>
        <button onClick={onEdit}>Edit</button>
        <button onClick={onDelete}>Delete</button>
      </div>
    );
  };
});

describe('CollectionManagement', () => {
  const sampleCollections = [
    {
      _id: '1',
      name: 'Tech Articles',
      description: 'Technology articles',
      public: true,
      contentIds: ['content1', 'content2']
    },
    {
      _id: '2',
      name: 'Research Papers',
      description: 'Academic papers',
      public: false,
      contentIds: ['content3']
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    collectionService.getUserCollections.mockResolvedValue({
      data: { collections: sampleCollections }
    });
  });

  describe('Initial Loading', () => {
    it('renders loading state initially', () => {
      render(<CollectionManagement />);
      expect(screen.getByText('Loading collections...')).toBeInTheDocument();
    });

    it('loads and displays collections', async () => {
      render(<CollectionManagement />);
      
      await waitFor(() => {
        expect(screen.getByText('My Collections')).toBeInTheDocument();
        expect(screen.getByText('Tech Articles')).toBeInTheDocument();
        expect(screen.getByText('Research Papers')).toBeInTheDocument();
      });
      
      expect(collectionService.getUserCollections).toHaveBeenCalledWith({
        sortBy: 'name',
        includeCollaborated: true
      });
    });

    it('displays error message when loading fails', async () => {
      collectionService.getUserCollections.mockRejectedValue(new Error('API Error'));
      
      render(<CollectionManagement />);
      
      await waitFor(() => {
        expect(screen.getByText('Failed to load collections. Please try again.')).toBeInTheDocument();
      });
    });
  });

  describe('Header and Controls', () => {
    it('renders header with title and create button', async () => {
      render(<CollectionManagement />);
      
      await waitFor(() => {
        expect(screen.getByText('My Collections')).toBeInTheDocument();
        expect(screen.getByText('Create Collection')).toBeInTheDocument();
      });
    });

    it('has view mode toggle buttons', async () => {
      render(<CollectionManagement />);
      
      await waitFor(() => {
        expect(screen.getByText('List')).toBeInTheDocument();
        expect(screen.getByText('Grid')).toBeInTheDocument();
      });
    });

    it('switches view modes', async () => {
      const user = userEvent.setup();
      render(<CollectionManagement />);
      
      await waitFor(() => {
        expect(screen.getByText('List')).toBeInTheDocument();
      });
      
      await user.click(screen.getByText('Grid'));
      // View mode change would be reflected in the CollectionList component props
    });
  });

  describe('Search and Filtering', () => {
    it('renders search input and filter controls', async () => {
      render(<CollectionManagement />);
      
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search collections...')).toBeInTheDocument();
        expect(screen.getByDisplayValue('All Collections')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Sort by Name')).toBeInTheDocument();
      });
    });

    it('filters collections by search query', async () => {
      const user = userEvent.setup();
      render(<CollectionManagement />);
      
      await waitFor(() => {
        expect(screen.getByText('Tech Articles')).toBeInTheDocument();
        expect(screen.getByText('Research Papers')).toBeInTheDocument();
      });
      
      const searchInput = screen.getByPlaceholderText('Search collections...');
      await user.type(searchInput, 'Tech');
      
      // Only Tech Articles should be visible after filtering
      expect(screen.getByText('Tech Articles')).toBeInTheDocument();
      expect(screen.queryByText('Research Papers')).not.toBeInTheDocument();
    });

    it('filters collections by visibility', async () => {
      const user = userEvent.setup();
      render(<CollectionManagement />);
      
      await waitFor(() => {
        expect(screen.getByText('Tech Articles')).toBeInTheDocument();
        expect(screen.getByText('Research Papers')).toBeInTheDocument();
      });
      
      const filterSelect = screen.getByDisplayValue('All Collections');
      await user.selectOptions(filterSelect, 'Public');
      
      // Only public collections should be visible
      expect(screen.getByText('Tech Articles')).toBeInTheDocument();
      expect(screen.queryByText('Research Papers')).not.toBeInTheDocument();
    });

    it('changes sort order', async () => {
      const user = userEvent.setup();
      render(<CollectionManagement />);
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('Sort by Name')).toBeInTheDocument();
      });
      
      const sortSelect = screen.getByDisplayValue('Sort by Name');
      await user.selectOptions(sortSelect, 'createdAt');
      
      await waitFor(() => {
        expect(collectionService.getUserCollections).toHaveBeenCalledWith({
          sortBy: 'createdAt',
          includeCollaborated: true
        });
      });
    });
  });

  describe('Collection Creation', () => {
    it('shows create form when create button is clicked', async () => {
      const user = userEvent.setup();
      render(<CollectionManagement />);
      
      await waitFor(() => {
        expect(screen.getByText('Create Collection')).toBeInTheDocument();
      });
      
      await user.click(screen.getByText('Create Collection'));
      
      expect(screen.getByTestId('collection-form')).toBeInTheDocument();
      expect(screen.getByText('Create New Collection')).toBeInTheDocument();
    });

    it('creates new collection successfully', async () => {
      const user = userEvent.setup();
      collectionService.createCollection.mockResolvedValue({
        data: { _id: '3', name: 'Test Collection' }
      });
      
      render(<CollectionManagement />);
      
      await waitFor(() => {
        expect(screen.getByText('Create Collection')).toBeInTheDocument();
      });
      
      await user.click(screen.getByText('Create Collection'));
      await user.click(screen.getByText('Submit'));
      
      await waitFor(() => {
        expect(collectionService.createCollection).toHaveBeenCalledWith({
          name: 'Test Collection'
        });
      });
    });

    it('handles creation errors', async () => {
      const user = userEvent.setup();
      collectionService.createCollection.mockRejectedValue({
        response: { data: { message: 'Creation failed' } }
      });
      
      render(<CollectionManagement />);
      
      await waitFor(() => {
        expect(screen.getByText('Create Collection')).toBeInTheDocument();
      });
      
      await user.click(screen.getByText('Create Collection'));
      await user.click(screen.getByText('Submit'));
      
      await waitFor(() => {
        expect(screen.getByText('Creation failed')).toBeInTheDocument();
      });
    });
  });

  describe('Collection Editing', () => {
    it('shows edit form when edit is clicked', async () => {
      const user = userEvent.setup();
      render(<CollectionManagement />);
      
      await waitFor(() => {
        expect(screen.getByTestId('collection-list')).toBeInTheDocument();
      });
      
      const editButtons = screen.getAllByText('Edit');
      await user.click(editButtons[0]);
      
      expect(screen.getByTestId('collection-form')).toBeInTheDocument();
      expect(screen.getByText('Edit Collection')).toBeInTheDocument();
    });

    it('updates collection successfully', async () => {
      const user = userEvent.setup();
      collectionService.updateCollection.mockResolvedValue({
        data: { ...sampleCollections[0], name: 'Updated Collection' }
      });
      
      render(<CollectionManagement />);
      
      await waitFor(() => {
        expect(screen.getByTestId('collection-list')).toBeInTheDocument();
      });
      
      const editButtons = screen.getAllByText('Edit');
      await user.click(editButtons[0]);
      await user.click(screen.getByText('Submit'));
      
      await waitFor(() => {
        expect(collectionService.updateCollection).toHaveBeenCalledWith('1', {
          name: 'Test Collection'
        });
      });
    });
  });

  describe('Collection Deletion', () => {
    it('deletes collection with confirmation', async () => {
      const user = userEvent.setup();
      window.confirm = jest.fn(() => true);
      collectionService.deleteCollection.mockResolvedValue({});
      
      render(<CollectionManagement />);
      
      await waitFor(() => {
        expect(screen.getByTestId('collection-list')).toBeInTheDocument();
      });
      
      const deleteButtons = screen.getAllByText('Delete');
      await user.click(deleteButtons[0]);
      
      expect(window.confirm).toHaveBeenCalledWith(
        'Are you sure you want to delete this collection? This action cannot be undone.'
      );
      
      await waitFor(() => {
        expect(collectionService.deleteCollection).toHaveBeenCalledWith('1');
      });
    });

    it('cancels deletion when user declines confirmation', async () => {
      const user = userEvent.setup();
      window.confirm = jest.fn(() => false);
      
      render(<CollectionManagement />);
      
      await waitFor(() => {
        expect(screen.getByTestId('collection-list')).toBeInTheDocument();
      });
      
      const deleteButtons = screen.getAllByText('Delete');
      await user.click(deleteButtons[0]);
      
      expect(collectionService.deleteCollection).not.toHaveBeenCalled();
    });
  });

  describe('Collection Selection', () => {
    it('shows collection detail when collection is selected', async () => {
      const user = userEvent.setup();
      render(<CollectionManagement />);
      
      await waitFor(() => {
        expect(screen.getByTestId('collection-list')).toBeInTheDocument();
      });
      
      const selectButtons = screen.getAllByText('Select');
      await user.click(selectButtons[0]);
      
      expect(screen.getByTestId('collection-detail')).toBeInTheDocument();
      expect(screen.getByText('Tech Articles')).toBeInTheDocument();
    });

    it('returns to list from collection detail', async () => {
      const user = userEvent.setup();
      render(<CollectionManagement />);
      
      await waitFor(() => {
        expect(screen.getByTestId('collection-list')).toBeInTheDocument();
      });
      
      const selectButtons = screen.getAllByText('Select');
      await user.click(selectButtons[0]);
      
      expect(screen.getByTestId('collection-detail')).toBeInTheDocument();
      
      await user.click(screen.getByText('Back'));
      
      expect(screen.getByTestId('collection-list')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no collections exist', async () => {
      collectionService.getUserCollections.mockResolvedValue({
        data: { collections: [] }
      });
      
      render(<CollectionManagement />);
      
      await waitFor(() => {
        expect(screen.getByText('No collections found')).toBeInTheDocument();
        expect(screen.getByText('You haven\'t created any collections yet.')).toBeInTheDocument();
        expect(screen.getByText('Create Your First Collection')).toBeInTheDocument();
      });
    });

    it('shows search empty state when no results match', async () => {
      const user = userEvent.setup();
      render(<CollectionManagement />);
      
      await waitFor(() => {
        expect(screen.getByText('Tech Articles')).toBeInTheDocument();
      });
      
      const searchInput = screen.getByPlaceholderText('Search collections...');
      await user.type(searchInput, 'NonexistentCollection');
      
      expect(screen.getByText('No collections found')).toBeInTheDocument();
      expect(screen.getByText('No collections match your search criteria.')).toBeInTheDocument();
    });
  });

  describe('Form Navigation', () => {
    it('returns to list when form is cancelled', async () => {
      const user = userEvent.setup();
      render(<CollectionManagement />);
      
      await waitFor(() => {
        expect(screen.getByText('Create Collection')).toBeInTheDocument();
      });
      
      await user.click(screen.getByText('Create Collection'));
      expect(screen.getByTestId('collection-form')).toBeInTheDocument();
      
      await user.click(screen.getByText('Cancel'));
      expect(screen.getByTestId('collection-list')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('displays and clears error messages', async () => {
      const user = userEvent.setup();
      collectionService.createCollection.mockRejectedValue(new Error('Network error'));
      
      render(<CollectionManagement />);
      
      await waitFor(() => {
        expect(screen.getByText('Create Collection')).toBeInTheDocument();
      });
      
      await user.click(screen.getByText('Create Collection'));
      await user.click(screen.getByText('Submit'));
      
      await waitFor(() => {
        expect(screen.getByText('Failed to save collection. Please try again.')).toBeInTheDocument();
      });
      
      // Error should clear when trying again
      await user.click(screen.getByText('Cancel'));
      await user.click(screen.getByText('Create Collection'));
      
      expect(screen.queryByText('Failed to save collection. Please try again.')).not.toBeInTheDocument();
    });
  });
});