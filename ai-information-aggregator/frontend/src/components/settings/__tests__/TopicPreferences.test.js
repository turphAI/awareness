import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TopicPreferences from '../TopicPreferences';
import configurationService from '../../../services/configurationService';

// Mock the configuration service
jest.mock('../../../services/configurationService');

const mockSettings = {
  topicPreferences: {
    topics: ['Machine Learning', 'AI Ethics']
  }
};

const mockOnUpdate = jest.fn();

describe('TopicPreferences Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    configurationService.updateTopicPreferences.mockResolvedValue({});
  });

  test('renders topic preferences with title and description', () => {
    render(<TopicPreferences settings={mockSettings} onUpdate={mockOnUpdate} />);
    
    expect(screen.getByText('Topic Preferences')).toBeInTheDocument();
    expect(screen.getByText(/Select the topics you're most interested in/)).toBeInTheDocument();
  });

  test('displays predefined topics as selectable tags', () => {
    render(<TopicPreferences settings={mockSettings} onUpdate={mockOnUpdate} />);
    
    expect(screen.getByText('Machine Learning')).toBeInTheDocument();
    expect(screen.getByText('Natural Language Processing')).toBeInTheDocument();
    expect(screen.getByText('Computer Vision')).toBeInTheDocument();
    expect(screen.getByText('Deep Learning')).toBeInTheDocument();
  });

  test('shows selected topics with different styling', () => {
    render(<TopicPreferences settings={mockSettings} onUpdate={mockOnUpdate} />);
    
    const mlTag = screen.getByText('Machine Learning');
    const cvTag = screen.getByText('Computer Vision');
    
    // Machine Learning should be selected (in mockSettings)
    expect(mlTag).toHaveStyle('background-color: #007bff');
    expect(mlTag).toHaveStyle('color: white');
    
    // Computer Vision should not be selected
    expect(cvTag).toHaveStyle('background-color: #f8f9fa');
    expect(cvTag).toHaveStyle('color: #333');
  });

  test('toggles topic selection when clicked', () => {
    render(<TopicPreferences settings={mockSettings} onUpdate={mockOnUpdate} />);
    
    const cvTag = screen.getByText('Computer Vision');
    
    // Initially not selected
    expect(cvTag).toHaveStyle('background-color: #f8f9fa');
    
    fireEvent.click(cvTag);
    
    // Should now be selected
    expect(cvTag).toHaveStyle('background-color: #007bff');
  });

  test('allows adding custom topics', () => {
    render(<TopicPreferences settings={mockSettings} onUpdate={mockOnUpdate} />);
    
    const input = screen.getByPlaceholderText('Add custom topic...');
    const addButton = screen.getByText('Add Topic');
    
    fireEvent.change(input, { target: { value: 'Custom AI Topic' } });
    fireEvent.click(addButton);
    
    expect(screen.getByText('Custom AI Topic ×')).toBeInTheDocument();
    expect(input.value).toBe('');
  });

  test('adds custom topic on Enter key press', () => {
    render(<TopicPreferences settings={mockSettings} onUpdate={mockOnUpdate} />);
    
    const input = screen.getByPlaceholderText('Add custom topic...');
    
    fireEvent.change(input, { target: { value: 'Another Custom Topic' } });
    fireEvent.keyPress(input, { key: 'Enter', code: 'Enter', charCode: 13 });
    
    expect(screen.getByText(/Another Custom Topic/)).toBeInTheDocument();
  });

  test('prevents adding duplicate topics', () => {
    render(<TopicPreferences settings={mockSettings} onUpdate={mockOnUpdate} />);
    
    const input = screen.getByPlaceholderText('Add custom topic...');
    const addButton = screen.getByText('Add Topic');
    
    // Try to add a topic that already exists
    fireEvent.change(input, { target: { value: 'Machine Learning' } });
    fireEvent.click(addButton);
    
    // Should not add duplicate
    const mlTags = screen.getAllByText(/Machine Learning/);
    expect(mlTags).toHaveLength(1); // Only the original predefined tag
  });

  test('prevents adding empty topics', () => {
    render(<TopicPreferences settings={mockSettings} onUpdate={mockOnUpdate} />);
    
    const addButton = screen.getByText('Add Topic');
    
    // Button should be disabled when input is empty
    expect(addButton).toBeDisabled();
  });

  test('allows removing custom topics', () => {
    const settingsWithCustom = {
      topicPreferences: {
        topics: ['Machine Learning', 'Custom Topic']
      }
    };
    
    render(<TopicPreferences settings={settingsWithCustom} onUpdate={mockOnUpdate} />);
    
    const customTag = screen.getByText('Custom Topic ×');
    fireEvent.click(customTag);
    
    expect(screen.queryByText('Custom Topic ×')).not.toBeInTheDocument();
  });

  test('does not allow removing predefined topics with × click', () => {
    render(<TopicPreferences settings={mockSettings} onUpdate={mockOnUpdate} />);
    
    const mlTag = screen.getByText('Machine Learning');
    
    // Predefined topics should not have × symbol
    expect(mlTag.textContent).toBe('Machine Learning');
    expect(mlTag.textContent).not.toContain('×');
  });

  test('saves preferences when save button is clicked', async () => {
    render(<TopicPreferences settings={mockSettings} onUpdate={mockOnUpdate} />);
    
    const saveButton = screen.getByText('Save Preferences');
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(configurationService.updateTopicPreferences).toHaveBeenCalledWith({
        ...mockSettings.topicPreferences,
        topics: ['Machine Learning', 'AI Ethics']
      });
    });
    
    expect(mockOnUpdate).toHaveBeenCalledWith('topicPreferences', {
      ...mockSettings.topicPreferences,
      topics: ['Machine Learning', 'AI Ethics']
    });
  });

  test('shows loading state while saving', async () => {
    configurationService.updateTopicPreferences.mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 100))
    );
    
    render(<TopicPreferences settings={mockSettings} onUpdate={mockOnUpdate} />);
    
    const saveButton = screen.getByText('Save Preferences');
    fireEvent.click(saveButton);
    
    expect(screen.getByText('Saving...')).toBeInTheDocument();
    expect(saveButton).toBeDisabled();
    
    await waitFor(() => {
      expect(screen.getByText('Save Preferences')).toBeInTheDocument();
    });
  });

  test('shows success message after successful save', async () => {
    render(<TopicPreferences settings={mockSettings} onUpdate={mockOnUpdate} />);
    
    const saveButton = screen.getByText('Save Preferences');
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(screen.getByText('Topic preferences saved successfully!')).toBeInTheDocument();
    });
  });

  test('shows error message when save fails', async () => {
    configurationService.updateTopicPreferences.mockRejectedValue(new Error('Network error'));
    
    render(<TopicPreferences settings={mockSettings} onUpdate={mockOnUpdate} />);
    
    const saveButton = screen.getByText('Save Preferences');
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(screen.getByText('Failed to save topic preferences. Please try again.')).toBeInTheDocument();
    });
  });

  test('handles empty settings gracefully', () => {
    const emptySettings = { topicPreferences: {} };
    
    render(<TopicPreferences settings={emptySettings} onUpdate={mockOnUpdate} />);
    
    // Should render without crashing
    expect(screen.getByText('Topic Preferences')).toBeInTheDocument();
    
    // No topics should be selected initially
    const mlTag = screen.getByText('Machine Learning');
    expect(mlTag).toHaveStyle('background-color: #f8f9fa');
  });

  test('saves updated topic selection', async () => {
    render(<TopicPreferences settings={mockSettings} onUpdate={mockOnUpdate} />);
    
    // Add a new topic selection
    const cvTag = screen.getByText('Computer Vision');
    fireEvent.click(cvTag);
    
    const saveButton = screen.getByText('Save Preferences');
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(configurationService.updateTopicPreferences).toHaveBeenCalledWith({
        ...mockSettings.topicPreferences,
        topics: ['Machine Learning', 'AI Ethics', 'Computer Vision']
      });
    });
  });

  test('saves with custom topics included', async () => {
    render(<TopicPreferences settings={mockSettings} onUpdate={mockOnUpdate} />);
    
    // Add a custom topic
    const input = screen.getByPlaceholderText('Add custom topic...');
    const addButton = screen.getByText('Add Topic');
    
    fireEvent.change(input, { target: { value: 'Quantum Computing' } });
    fireEvent.click(addButton);
    
    const saveButton = screen.getByText('Save Preferences');
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(configurationService.updateTopicPreferences).toHaveBeenCalledWith({
        ...mockSettings.topicPreferences,
        topics: ['Machine Learning', 'AI Ethics', 'Quantum Computing']
      });
    });
  });
});