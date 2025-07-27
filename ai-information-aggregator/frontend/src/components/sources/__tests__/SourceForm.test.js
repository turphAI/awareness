import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SourceForm from '../SourceForm';
import sourceService from '../../../services/sourceService';
import categoryService from '../../../services/categoryService';

// Mock the services
jest.mock('../../../services/sourceService');
jest.mock('../../../services/categoryService');

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

const mockSource = {
  _id: '1',
  name: 'Test Source',
  url: 'https://test.com',
  description: 'Test description',
  type: 'website',
  checkFrequency: 'daily',
  relevanceScore: 0.7,
  categories: ['AI Research'],
  requiresAuthentication: false
};

describe('SourceForm', () => {
  const mockOnSubmit = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    sourceService.validateUrl.mockResolvedValue({ valid: true });
    categoryService.suggestCategories.mockResolvedValue([
      { _id: 'cat1', name: 'AI Research', score: 0.8 }
    ]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders add source form', () => {
    render(
      <SourceForm
        categories={mockCategories}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
        isLoading={false}
      />
    );

    expect(screen.getByText('Add New Source')).toBeInTheDocument();
    expect(screen.getByLabelText(/URL/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Type/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Check Frequency/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Relevance Score/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Description/)).toBeInTheDocument();
  });

  it('renders edit source form with existing data', () => {
    render(
      <SourceForm
        source={mockSource}
        categories={mockCategories}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
        isLoading={false}
      />
    );

    expect(screen.getByText('Edit Source')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test Source')).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://test.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('0.7')).toBeInTheDocument();
  });

  it('validates required fields', async () => {
    render(
      <SourceForm
        categories={mockCategories}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
        isLoading={false}
      />
    );

    fireEvent.click(screen.getByText('Add Source'));

    await waitFor(() => {
      expect(screen.getByText('URL is required')).toBeInTheDocument();
      expect(screen.getByText('Name is required')).toBeInTheDocument();
    });

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('submits form with valid data', async () => {
    render(
      <SourceForm
        categories={mockCategories}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
        isLoading={false}
      />
    );

    fireEvent.change(screen.getByLabelText(/URL/), { 
      target: { value: 'https://example.com' } 
    });
    fireEvent.change(screen.getByLabelText(/Name/), { 
      target: { value: 'Example Source' } 
    });

    fireEvent.click(screen.getByText('Add Source'));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://example.com',
          name: 'Example Source',
          type: 'website',
          checkFrequency: 'daily',
          relevanceScore: 0.5,
          requiresAuthentication: false,
          categories: []
        })
      );
    });
  });

  it('handles category selection', async () => {
    render(
      <SourceForm
        categories={mockCategories}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
        isLoading={false}
      />
    );

    // Click on a category tag
    fireEvent.click(screen.getByText('AI Research'));

    // Fill required fields
    fireEvent.change(screen.getByLabelText(/URL/), { 
      target: { value: 'https://example.com' } 
    });
    fireEvent.change(screen.getByLabelText(/Name/), { 
      target: { value: 'Example Source' } 
    });

    fireEvent.click(screen.getByText('Add Source'));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          categories: ['AI Research']
        })
      );
    });
  });

  it('validates URL when field loses focus', async () => {
    render(
      <SourceForm
        categories={mockCategories}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
        isLoading={false}
      />
    );

    const urlInput = screen.getByLabelText(/URL/);
    fireEvent.change(urlInput, { target: { value: 'https://example.com' } });
    fireEvent.blur(urlInput);

    await waitFor(() => {
      expect(sourceService.validateUrl).toHaveBeenCalledWith('https://example.com');
    });
  });

  it('shows URL validation status', async () => {
    render(
      <SourceForm
        categories={mockCategories}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
        isLoading={false}
      />
    );

    const urlInput = screen.getByLabelText(/URL/);
    fireEvent.change(urlInput, { target: { value: 'https://example.com' } });
    fireEvent.blur(urlInput);

    await waitFor(() => {
      expect(screen.getByText('URL is valid and reachable')).toBeInTheDocument();
    });
  });

  it('handles URL validation error', async () => {
    sourceService.validateUrl.mockRejectedValue(new Error('Invalid URL'));
    
    render(
      <SourceForm
        categories={mockCategories}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
        isLoading={false}
      />
    );

    const urlInput = screen.getByLabelText(/URL/);
    fireEvent.change(urlInput, { target: { value: 'https://invalid.com' } });
    fireEvent.blur(urlInput);

    await waitFor(() => {
      expect(screen.getByText('URL validation failed')).toBeInTheDocument();
    });
  });

  it('gets category suggestions', async () => {
    render(
      <SourceForm
        categories={mockCategories}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
        isLoading={false}
      />
    );

    fireEvent.change(screen.getByLabelText(/URL/), { 
      target: { value: 'https://example.com' } 
    });
    fireEvent.change(screen.getByLabelText(/Name/), { 
      target: { value: 'AI Article' } 
    });
    
    fireEvent.click(screen.getByText('Get Suggestions'));

    await waitFor(() => {
      expect(categoryService.suggestCategories).toHaveBeenCalledWith({
        url: 'https://example.com',
        title: 'AI Article',
        description: ''
      });
    });
  });

  it('calls onCancel when cancel button is clicked', () => {
    render(
      <SourceForm
        categories={mockCategories}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
        isLoading={false}
      />
    );

    fireEvent.click(screen.getByText('Cancel'));

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('disables submit button when loading', () => {
    render(
      <SourceForm
        categories={mockCategories}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
        isLoading={true}
      />
    );

    const submitButton = screen.getByText('Saving...');
    expect(submitButton).toBeDisabled();
  });

  it('shows correct button text for edit mode', () => {
    render(
      <SourceForm
        source={mockSource}
        categories={mockCategories}
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
        isLoading={false}
      />
    );

    expect(screen.getByText('Update Source')).toBeInTheDocument();
  });
});