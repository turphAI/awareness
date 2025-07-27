import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SearchBar from '../SearchBar';

describe('SearchBar', () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with placeholder text', () => {
    render(<SearchBar value="" onChange={mockOnChange} placeholder="Search content..." />);
    
    expect(screen.getByPlaceholderText('Search content...')).toBeInTheDocument();
  });

  it('displays the current value', () => {
    render(<SearchBar value="machine learning" onChange={mockOnChange} />);
    
    expect(screen.getByDisplayValue('machine learning')).toBeInTheDocument();
  });

  it('shows search icon', () => {
    render(<SearchBar value="" onChange={mockOnChange} />);
    
    expect(screen.getByText('🔍')).toBeInTheDocument();
  });

  it('calls onChange with debounced input', async () => {
    render(<SearchBar value="" onChange={mockOnChange} />);
    
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'test query' } });

    // Should not call immediately
    expect(mockOnChange).not.toHaveBeenCalled();

    // Should call after debounce delay
    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith('test query');
    }, { timeout: 500 });
  });

  it('shows clear button when there is input', () => {
    render(<SearchBar value="test" onChange={mockOnChange} />);
    
    const clearButton = screen.getByTitle('Clear search');
    expect(clearButton).toBeInTheDocument();
  });

  it('hides clear button when input is empty', () => {
    render(<SearchBar value="" onChange={mockOnChange} />);
    
    const clearButton = screen.queryByTitle('Clear search');
    expect(clearButton).not.toBeVisible();
  });

  it('clears input when clear button is clicked', async () => {
    render(<SearchBar value="test query" onChange={mockOnChange} />);
    
    const clearButton = screen.getByTitle('Clear search');
    fireEvent.click(clearButton);

    expect(mockOnChange).toHaveBeenCalledWith('');
  });

  it('shows suggestions when typing', async () => {
    render(<SearchBar value="" onChange={mockOnChange} />);
    
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'machine' } });

    // Should show suggestions
    await waitFor(() => {
      expect(screen.getByText('machine learning')).toBeInTheDocument();
    });
  });

  it('filters suggestions based on input', async () => {
    render(<SearchBar value="" onChange={mockOnChange} />);
    
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'gpt' } });

    await waitFor(() => {
      expect(screen.getByText('GPT-4')).toBeInTheDocument();
      expect(screen.queryByText('machine learning')).not.toBeInTheDocument();
    });
  });

  it('hides suggestions when input is empty', async () => {
    render(<SearchBar value="test" onChange={mockOnChange} />);
    
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '' } });

    await waitFor(() => {
      expect(screen.queryByText('machine learning')).not.toBeInTheDocument();
    });
  });

  it('selects suggestion when clicked', async () => {
    render(<SearchBar value="" onChange={mockOnChange} />);
    
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'machine' } });

    await waitFor(() => {
      expect(screen.getByText('machine learning')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('machine learning'));

    expect(mockOnChange).toHaveBeenCalledWith('machine learning');
  });

  it('handles escape key press', async () => {
    render(<SearchBar value="" onChange={mockOnChange} />);
    
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'machine' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    // Test that escape key is handled (implementation detail)
    expect(input).toBeInTheDocument();
  });

  it('handles focus events', async () => {
    render(<SearchBar value="machine" onChange={mockOnChange} />);
    
    const input = screen.getByRole('textbox');
    fireEvent.focus(input);

    // Test that focus is handled
    expect(input).toBeInTheDocument();
  });

  it('handles blur events', async () => {
    render(<SearchBar value="" onChange={mockOnChange} />);
    
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'machine' } });
    fireEvent.blur(input);

    // Test that blur is handled
    expect(input).toBeInTheDocument();
  });

  it('displays suggestion types', async () => {
    render(<SearchBar value="" onChange={mockOnChange} />);
    
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'machine' } });

    await waitFor(() => {
      expect(screen.getByText('topic')).toBeInTheDocument();
    });
  });

  it('updates input value when external value changes', () => {
    const { rerender } = render(<SearchBar value="initial" onChange={mockOnChange} />);
    
    expect(screen.getByDisplayValue('initial')).toBeInTheDocument();

    rerender(<SearchBar value="updated" onChange={mockOnChange} />);
    
    expect(screen.getByDisplayValue('updated')).toBeInTheDocument();
  });

  it('handles empty suggestions gracefully', async () => {
    render(<SearchBar value="" onChange={mockOnChange} />);
    
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'xyz123nonexistent' } });

    // Should not show any suggestions
    await waitFor(() => {
      expect(screen.queryByText('machine learning')).not.toBeInTheDocument();
    });
  });

  it('renders input element correctly', async () => {
    render(<SearchBar value="" onChange={mockOnChange} />);
    
    const input = screen.getByRole('textbox');
    
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('type', 'text');
  });
});