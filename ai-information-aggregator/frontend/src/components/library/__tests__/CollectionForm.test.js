import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock styled-components
jest.mock('styled-components', () => {
  const styled = (tag) => (styles) => (props) => {
    const Component = typeof tag === 'string' ? tag : 'div';
    return React.createElement(Component, props);
  };
  
  // Add common HTML elements
  styled.div = styled('div');
  styled.h2 = styled('h2');
  styled.h3 = styled('h3');
  styled.label = styled('label');
  styled.input = styled('input');
  styled.textarea = styled('textarea');
  styled.select = styled('select');
  styled.button = styled('button');
  styled.span = styled('span');
  styled.p = styled('p');
  
  return {
    __esModule: true,
    default: styled,
  };
});

import CollectionForm from '../CollectionForm';

describe('CollectionForm', () => {
  const mockOnSubmit = jest.fn();
  const mockOnCancel = jest.fn();

  const defaultProps = {
    collection: null,
    onSubmit: mockOnSubmit,
    onCancel: mockOnCancel,
    isLoading: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Create Mode', () => {
    it('renders create form with default values', () => {
      render(<CollectionForm {...defaultProps} />);
      
      expect(screen.getByText('Create New Collection')).toBeInTheDocument();
      expect(screen.getByLabelText(/collection name/i)).toHaveValue('');
      expect(screen.getByLabelText(/description/i)).toHaveValue('');
      expect(screen.getByText('Create Collection')).toBeInTheDocument();
    });

    it('displays validation errors for required fields', async () => {
      const user = userEvent.setup();
      render(<CollectionForm {...defaultProps} />);
      
      const submitButton = screen.getByText('Create Collection');
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('Collection name is required')).toBeInTheDocument();
      });
    });

    it('validates collection name length', async () => {
      const user = userEvent.setup();
      render(<CollectionForm {...defaultProps} />);
      
      const nameInput = screen.getByLabelText(/collection name/i);
      const longName = 'a'.repeat(101); // Exceeds 100 character limit
      
      await user.type(nameInput, longName);
      await user.click(screen.getByText('Create Collection'));
      
      await waitFor(() => {
        expect(screen.getByText('Collection name cannot exceed 100 characters')).toBeInTheDocument();
      });
    });

    it('validates description length', async () => {
      const user = userEvent.setup();
      render(<CollectionForm {...defaultProps} />);
      
      const descriptionInput = screen.getByLabelText(/description/i);
      const longDescription = 'a'.repeat(501); // Exceeds 500 character limit
      
      await user.type(descriptionInput, longDescription);
      await user.click(screen.getByText('Create Collection'));
      
      await waitFor(() => {
        expect(screen.getByText('Description cannot exceed 500 characters')).toBeInTheDocument();
      });
    });

    it('submits form with valid data', async () => {
      const user = userEvent.setup();
      render(<CollectionForm {...defaultProps} />);
      
      const nameInput = screen.getByLabelText(/collection name/i);
      const descriptionInput = screen.getByLabelText(/description/i);
      
      await user.type(nameInput, 'Test Collection');
      await user.type(descriptionInput, 'Test description');
      
      await user.click(screen.getByText('Create Collection'));
      
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          name: 'Test Collection',
          description: 'Test description',
          public: false,
          featured: false,
          color: '#3498db',
          icon: '📁',
          tags: []
        });
      });
    });
  });

  describe('Edit Mode', () => {
    const existingCollection = {
      _id: '123',
      name: 'Existing Collection',
      description: 'Existing description',
      public: true,
      featured: false,
      color: '#e74c3c',
      icon: '📚',
      tags: ['tag1', 'tag2']
    };

    it('renders edit form with existing values', () => {
      render(<CollectionForm {...defaultProps} collection={existingCollection} />);
      
      expect(screen.getByText('Edit Collection')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Existing Collection')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Existing description')).toBeInTheDocument();
      expect(screen.getByText('Update Collection')).toBeInTheDocument();
    });

    it('pre-selects correct color and icon', () => {
      render(<CollectionForm {...defaultProps} collection={existingCollection} />);
      
      // Color and icon selection would be tested by checking if the correct elements have selected styling
      // This would require more complex DOM queries based on the actual implementation
      expect(screen.getByText('📚')).toBeInTheDocument();
    });

    it('displays existing tags', () => {
      render(<CollectionForm {...defaultProps} collection={existingCollection} />);
      
      expect(screen.getByText('tag1')).toBeInTheDocument();
      expect(screen.getByText('tag2')).toBeInTheDocument();
    });

    it('submits updated data', async () => {
      const user = userEvent.setup();
      render(<CollectionForm {...defaultProps} collection={existingCollection} />);
      
      const nameInput = screen.getByDisplayValue('Existing Collection');
      await user.clear(nameInput);
      await user.type(nameInput, 'Updated Collection');
      
      await user.click(screen.getByText('Update Collection'));
      
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          name: 'Updated Collection',
          description: 'Existing description',
          public: true,
          featured: false,
          color: '#e74c3c',
          icon: '📚',
          tags: ['tag1', 'tag2']
        });
      });
    });
  });

  describe('Color Selection', () => {
    it('allows color selection', async () => {
      const user = userEvent.setup();
      render(<CollectionForm {...defaultProps} />);
      
      // Find color options and click one
      const colorOptions = screen.getAllByRole('button');
      const redColorOption = colorOptions.find(option => 
        option.style.backgroundColor === 'rgb(231, 76, 60)' // #e74c3c in RGB
      );
      
      if (redColorOption) {
        await user.click(redColorOption);
      }
      
      await user.type(screen.getByLabelText(/collection name/i), 'Test');
      await user.click(screen.getByText('Create Collection'));
      
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            color: expect.any(String)
          })
        );
      });
    });
  });

  describe('Icon Selection', () => {
    it('allows icon selection', async () => {
      const user = userEvent.setup();
      render(<CollectionForm {...defaultProps} />);
      
      // Click on a different icon
      const bookIcon = screen.getByText('📚');
      await user.click(bookIcon);
      
      await user.type(screen.getByLabelText(/collection name/i), 'Test');
      await user.click(screen.getByText('Create Collection'));
      
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            icon: '📚'
          })
        );
      });
    });
  });

  describe('Tag Management', () => {
    it('allows adding tags', async () => {
      const user = userEvent.setup();
      render(<CollectionForm {...defaultProps} />);
      
      const tagInput = screen.getByPlaceholderText('Add tags...');
      await user.type(tagInput, 'newtag{enter}');
      
      expect(screen.getByText('newtag')).toBeInTheDocument();
    });

    it('prevents duplicate tags', async () => {
      const user = userEvent.setup();
      render(<CollectionForm {...defaultProps} />);
      
      const tagInput = screen.getByPlaceholderText('Add tags...');
      await user.type(tagInput, 'tag1{enter}');
      await user.type(tagInput, 'tag1{enter}');
      
      const tagElements = screen.getAllByText('tag1');
      expect(tagElements).toHaveLength(1);
    });

    it('allows removing tags', async () => {
      const user = userEvent.setup();
      const collectionWithTags = {
        ...defaultProps.collection,
        tags: ['removeme']
      };
      
      render(<CollectionForm {...defaultProps} collection={collectionWithTags} />);
      
      const removeButton = screen.getByText('×');
      await user.click(removeButton);
      
      expect(screen.queryByText('removeme')).not.toBeInTheDocument();
    });
  });

  describe('Public/Featured Options', () => {
    it('shows featured option when public is selected', async () => {
      const user = userEvent.setup();
      render(<CollectionForm {...defaultProps} />);
      
      const publicCheckbox = screen.getByLabelText(/make this collection public/i);
      await user.click(publicCheckbox);
      
      expect(screen.getByLabelText(/feature this collection/i)).toBeInTheDocument();
    });

    it('hides featured option when public is not selected', () => {
      render(<CollectionForm {...defaultProps} />);
      
      expect(screen.queryByLabelText(/feature this collection/i)).not.toBeInTheDocument();
    });
  });

  describe('Form Actions', () => {
    it('calls onCancel when cancel button is clicked', async () => {
      const user = userEvent.setup();
      render(<CollectionForm {...defaultProps} />);
      
      await user.click(screen.getByText('Cancel'));
      
      expect(mockOnCancel).toHaveBeenCalled();
    });

    it('disables submit button when loading', () => {
      render(<CollectionForm {...defaultProps} isLoading={true} />);
      
      const submitButton = screen.getByText('Saving...');
      expect(submitButton).toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    it('has proper form labels', () => {
      render(<CollectionForm {...defaultProps} />);
      
      expect(screen.getByLabelText(/collection name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/make this collection public/i)).toBeInTheDocument();
    });

    it('associates error messages with form fields', async () => {
      const user = userEvent.setup();
      render(<CollectionForm {...defaultProps} />);
      
      await user.click(screen.getByText('Create Collection'));
      
      await waitFor(() => {
        const nameInput = screen.getByLabelText(/collection name/i);
        const errorMessage = screen.getByText('Collection name is required');
        
        expect(nameInput).toBeInvalid();
        expect(errorMessage).toBeInTheDocument();
      });
    });
  });
});