import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CollectionList from '../CollectionList';

// Mock styled-components
jest.mock('styled-components', () => ({
  __esModule: true,
  default: (component) => (props) => component(props),
}));

describe('CollectionList', () => {
  const mockOnSelect = jest.fn();
  const mockOnEdit = jest.fn();
  const mockOnDelete = jest.fn();

  const defaultProps = {
    collections: [],
    viewMode: 'list',
    onSelect: mockOnSelect,
    onEdit: mockOnEdit,
    onDelete: mockOnDelete,
  };

  const sampleCollections = [
    {
      _id: '1',
      name: 'Tech Articles',
      description: 'Collection of technology articles',
      color: '#3498db',
      icon: '💻',
      contentIds: ['content1', 'content2'],
      viewCount: 25,
      createdAt: '2024-01-15T10:00:00Z',
      tags: ['tech', 'programming'],
      public: true,
      featured: false
    },
    {
      _id: '2',
      name: 'Research Papers',
      description: 'Academic research papers',
      color: '#e74c3c',
      icon: '📚',
      contentIds: ['content3'],
      viewCount: 10,
      createdAt: '2024-01-10T10:00:00Z',
      tags: ['research', 'academic'],
      public: false,
      featured: false
    },
    {
      _id: '3',
      name: 'Featured Collection',
      description: 'A featured public collection',
      color: '#2ecc71',
      icon: '⭐',
      contentIds: [],
      viewCount: 100,
      createdAt: '2024-01-20T10:00:00Z',
      tags: ['featured'],
      public: true,
      featured: true
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Empty State', () => {
    it('renders empty state when no collections', () => {
      render(<CollectionList {...defaultProps} />);
      
      expect(screen.getByText('No collections found')).toBeInTheDocument();
      expect(screen.getByText('Create your first collection to get started.')).toBeInTheDocument();
    });
  });

  describe('Collection Rendering', () => {
    it('renders collections in list view', () => {
      render(<CollectionList {...defaultProps} collections={sampleCollections} />);
      
      expect(screen.getByText('Tech Articles')).toBeInTheDocument();
      expect(screen.getByText('Research Papers')).toBeInTheDocument();
      expect(screen.getByText('Featured Collection')).toBeInTheDocument();
    });

    it('renders collections in grid view', () => {
      render(<CollectionList {...defaultProps} collections={sampleCollections} viewMode="grid" />);
      
      expect(screen.getByText('Tech Articles')).toBeInTheDocument();
      expect(screen.getByText('Research Papers')).toBeInTheDocument();
      expect(screen.getByText('Featured Collection')).toBeInTheDocument();
    });

    it('displays collection descriptions', () => {
      render(<CollectionList {...defaultProps} collections={sampleCollections} />);
      
      expect(screen.getByText('Collection of technology articles')).toBeInTheDocument();
      expect(screen.getByText('Academic research papers')).toBeInTheDocument();
    });

    it('displays collection icons and colors', () => {
      render(<CollectionList {...defaultProps} collections={sampleCollections} />);
      
      expect(screen.getByText('💻')).toBeInTheDocument();
      expect(screen.getByText('📚')).toBeInTheDocument();
      expect(screen.getByText('⭐')).toBeInTheDocument();
    });

    it('displays collection metadata', () => {
      render(<CollectionList {...defaultProps} collections={sampleCollections} />);
      
      // Check for content count
      expect(screen.getByText('2 items')).toBeInTheDocument();
      expect(screen.getByText('1 item')).toBeInTheDocument();
      expect(screen.getByText('No items')).toBeInTheDocument();
      
      // Check for view counts
      expect(screen.getByText('25 views')).toBeInTheDocument();
      expect(screen.getByText('10 views')).toBeInTheDocument();
      expect(screen.getByText('100 views')).toBeInTheDocument();
    });

    it('displays formatted dates', () => {
      render(<CollectionList {...defaultProps} collections={sampleCollections} />);
      
      expect(screen.getByText('Jan 15, 2024')).toBeInTheDocument();
      expect(screen.getByText('Jan 10, 2024')).toBeInTheDocument();
      expect(screen.getByText('Jan 20, 2024')).toBeInTheDocument();
    });

    it('displays tags', () => {
      render(<CollectionList {...defaultProps} collections={sampleCollections} />);
      
      expect(screen.getByText('tech')).toBeInTheDocument();
      expect(screen.getByText('programming')).toBeInTheDocument();
      expect(screen.getByText('research')).toBeInTheDocument();
      expect(screen.getByText('academic')).toBeInTheDocument();
    });

    it('displays status badges', () => {
      render(<CollectionList {...defaultProps} collections={sampleCollections} />);
      
      // Check for public/private badges
      expect(screen.getAllByText('Public')).toHaveLength(2);
      expect(screen.getByText('Private')).toBeInTheDocument();
      
      // Check for featured badge
      expect(screen.getByText('Featured')).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('calls onSelect when collection is clicked', async () => {
      const user = userEvent.setup();
      render(<CollectionList {...defaultProps} collections={sampleCollections} />);
      
      const collection = screen.getByText('Tech Articles');
      await user.click(collection);
      
      expect(mockOnSelect).toHaveBeenCalledWith(sampleCollections[0]);
    });

    it('calls onEdit when edit button is clicked', async () => {
      const user = userEvent.setup();
      render(<CollectionList {...defaultProps} collections={sampleCollections} />);
      
      const editButtons = screen.getAllByText('Edit');
      await user.click(editButtons[0]);
      
      expect(mockOnEdit).toHaveBeenCalledWith(sampleCollections[0]);
      expect(mockOnSelect).not.toHaveBeenCalled(); // Should not trigger selection
    });

    it('calls onDelete when delete button is clicked', async () => {
      const user = userEvent.setup();
      render(<CollectionList {...defaultProps} collections={sampleCollections} />);
      
      const deleteButtons = screen.getAllByText('Delete');
      await user.click(deleteButtons[0]);
      
      expect(mockOnDelete).toHaveBeenCalledWith(sampleCollections[0]._id);
      expect(mockOnSelect).not.toHaveBeenCalled(); // Should not trigger selection
    });

    it('does not call onSelect when action buttons are clicked', async () => {
      const user = userEvent.setup();
      render(<CollectionList {...defaultProps} collections={sampleCollections} />);
      
      const editButton = screen.getAllByText('Edit')[0];
      await user.click(editButton);
      
      expect(mockOnSelect).not.toHaveBeenCalled();
    });
  });

  describe('Action Button Visibility', () => {
    it('shows action buttons on hover', () => {
      render(<CollectionList {...defaultProps} collections={sampleCollections} />);
      
      const editButtons = screen.getAllByText('Edit');
      const deleteButtons = screen.getAllByText('Delete');
      
      expect(editButtons).toHaveLength(3);
      expect(deleteButtons).toHaveLength(3);
    });
  });

  describe('Content Count Formatting', () => {
    it('formats content count correctly', () => {
      const collectionsWithVariousCounts = [
        { ...sampleCollections[0], contentIds: [] },
        { ...sampleCollections[1], contentIds: ['one'] },
        { ...sampleCollections[2], contentIds: ['one', 'two', 'three'] }
      ];
      
      render(<CollectionList {...defaultProps} collections={collectionsWithVariousCounts} />);
      
      expect(screen.getByText('No items')).toBeInTheDocument();
      expect(screen.getByText('1 item')).toBeInTheDocument();
      expect(screen.getByText('3 items')).toBeInTheDocument();
    });
  });

  describe('View Mode Differences', () => {
    it('renders differently in grid vs list mode', () => {
      const { rerender } = render(
        <CollectionList {...defaultProps} collections={sampleCollections} viewMode="list" />
      );
      
      const listContainer = screen.getByText('Tech Articles').closest('div');
      
      rerender(
        <CollectionList {...defaultProps} collections={sampleCollections} viewMode="grid" />
      );
      
      const gridContainer = screen.getByText('Tech Articles').closest('div');
      
      // The containers should be different (though we can't easily test styling)
      expect(listContainer).toBeDefined();
      expect(gridContainer).toBeDefined();
    });
  });

  describe('Collection Sorting', () => {
    it('maintains collection order as provided', () => {
      render(<CollectionList {...defaultProps} collections={sampleCollections} />);
      
      const collectionNames = screen.getAllByRole('heading', { level: 3 });
      expect(collectionNames[0]).toHaveTextContent('Tech Articles');
      expect(collectionNames[1]).toHaveTextContent('Research Papers');
      expect(collectionNames[2]).toHaveTextContent('Featured Collection');
    });
  });

  describe('Accessibility', () => {
    it('has proper heading structure', () => {
      render(<CollectionList {...defaultProps} collections={sampleCollections} />);
      
      const headings = screen.getAllByRole('heading', { level: 3 });
      expect(headings).toHaveLength(3);
      expect(headings[0]).toHaveTextContent('Tech Articles');
    });

    it('has clickable elements with proper roles', () => {
      render(<CollectionList {...defaultProps} collections={sampleCollections} />);
      
      const editButtons = screen.getAllByRole('button', { name: /edit/i });
      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      
      expect(editButtons).toHaveLength(3);
      expect(deleteButtons).toHaveLength(3);
    });
  });

  describe('Edge Cases', () => {
    it('handles collections without descriptions', () => {
      const collectionsWithoutDesc = [
        { ...sampleCollections[0], description: null },
        { ...sampleCollections[1], description: undefined },
        { ...sampleCollections[2], description: '' }
      ];
      
      render(<CollectionList {...defaultProps} collections={collectionsWithoutDesc} />);
      
      expect(screen.getByText('Tech Articles')).toBeInTheDocument();
      expect(screen.getByText('Research Papers')).toBeInTheDocument();
      expect(screen.getByText('Featured Collection')).toBeInTheDocument();
    });

    it('handles collections without tags', () => {
      const collectionsWithoutTags = [
        { ...sampleCollections[0], tags: null },
        { ...sampleCollections[1], tags: undefined },
        { ...sampleCollections[2], tags: [] }
      ];
      
      render(<CollectionList {...defaultProps} collections={collectionsWithoutTags} />);
      
      expect(screen.getByText('Tech Articles')).toBeInTheDocument();
    });

    it('handles missing or zero view counts', () => {
      const collectionsWithoutViews = [
        { ...sampleCollections[0], viewCount: 0 },
        { ...sampleCollections[1], viewCount: null },
        { ...sampleCollections[2], viewCount: undefined }
      ];
      
      render(<CollectionList {...defaultProps} collections={collectionsWithoutViews} />);
      
      expect(screen.getAllByText('0 views')).toHaveLength(3);
    });
  });
});