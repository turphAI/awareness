import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import NotificationSettings from '../NotificationSettings';
import configurationService from '../../../services/configurationService';

// Mock the configuration service
jest.mock('../../../services/configurationService');

const mockSettings = {
  notificationSettings: {
    emailEnabled: true,
    pushEnabled: false,
    digestEnabled: true,
    breakingNewsEnabled: true,
    newContentEnabled: false,
    weeklyDigestEnabled: true,
    emailFrequency: 'daily',
    pushFrequency: 'immediate',
    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00'
  }
};

const mockOnUpdate = jest.fn();

describe('NotificationSettings Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    configurationService.updateNotificationSettings.mockResolvedValue({});
  });

  test('renders notification settings with title and description', () => {
    render(<NotificationSettings settings={mockSettings} onUpdate={mockOnUpdate} />);
    
    expect(screen.getByText('Notification Settings')).toBeInTheDocument();
    expect(screen.getByText(/Configure how and when you want to receive notifications/)).toBeInTheDocument();
  });

  test('displays notification channels section', () => {
    render(<NotificationSettings settings={mockSettings} onUpdate={mockOnUpdate} />);
    
    expect(screen.getByText('Notification Channels')).toBeInTheDocument();
    expect(screen.getByText('Email Notifications')).toBeInTheDocument();
    expect(screen.getByText('Push Notifications')).toBeInTheDocument();
  });

  test('shows correct initial checkbox states', () => {
    render(<NotificationSettings settings={mockSettings} onUpdate={mockOnUpdate} />);
    
    const checkboxes = screen.getAllByRole('checkbox');
    const emailCheckbox = checkboxes[0]; // First checkbox is email
    const pushCheckbox = checkboxes[1]; // Second checkbox is push
    
    expect(emailCheckbox).toBeChecked();
    expect(pushCheckbox).not.toBeChecked();
  });

  test('displays notification types section', () => {
    render(<NotificationSettings settings={mockSettings} onUpdate={mockOnUpdate} />);
    
    expect(screen.getByText('Notification Types')).toBeInTheDocument();
    expect(screen.getByText('Breaking News')).toBeInTheDocument();
    expect(screen.getByText('New Content')).toBeInTheDocument();
    expect(screen.getByText('Daily Digest')).toBeInTheDocument();
    expect(screen.getByText('Weekly Digest')).toBeInTheDocument();
  });

  test('shows correct notification type checkbox states', () => {
    render(<NotificationSettings settings={mockSettings} onUpdate={mockOnUpdate} />);
    
    const checkboxes = screen.getAllByRole('checkbox');
    const breakingNewsCheckbox = checkboxes[2]; // Third checkbox is breaking news
    const newContentCheckbox = checkboxes[3]; // Fourth checkbox is new content
    const digestCheckbox = checkboxes[4]; // Fifth checkbox is digest
    const weeklyDigestCheckbox = checkboxes[5]; // Sixth checkbox is weekly digest
    
    expect(breakingNewsCheckbox).toBeChecked();
    expect(newContentCheckbox).not.toBeChecked();
    expect(digestCheckbox).toBeChecked();
    expect(weeklyDigestCheckbox).toBeChecked();
  });

  test('toggles checkbox states when clicked', () => {
    render(<NotificationSettings settings={mockSettings} onUpdate={mockOnUpdate} />);
    
    const checkboxes = screen.getAllByRole('checkbox');
    const pushCheckbox = checkboxes[1]; // Second checkbox is push
    
    expect(pushCheckbox).not.toBeChecked();
    fireEvent.click(pushCheckbox);
    expect(pushCheckbox).toBeChecked();
  });

  test('displays frequency selectors', () => {
    render(<NotificationSettings settings={mockSettings} onUpdate={mockOnUpdate} />);
    
    expect(screen.getByText('Email Frequency')).toBeInTheDocument();
    expect(screen.getByText('Push Notification Frequency')).toBeInTheDocument();
  });

  test('shows correct initial frequency values', () => {
    render(<NotificationSettings settings={mockSettings} onUpdate={mockOnUpdate} />);
    
    const emailFrequencySelect = screen.getByDisplayValue('Daily');
    const pushFrequencySelect = screen.getByDisplayValue('Immediate');
    
    expect(emailFrequencySelect).toBeInTheDocument();
    expect(pushFrequencySelect).toBeInTheDocument();
  });

  test('disables frequency selectors when channels are disabled', () => {
    const settingsWithDisabledChannels = {
      notificationSettings: {
        ...mockSettings.notificationSettings,
        emailEnabled: false,
        pushEnabled: false
      }
    };
    
    render(<NotificationSettings settings={settingsWithDisabledChannels} onUpdate={mockOnUpdate} />);
    
    const emailFrequencySelect = screen.getByDisplayValue('Daily');
    const pushFrequencySelect = screen.getByDisplayValue('Immediate');
    
    expect(emailFrequencySelect).toBeDisabled();
    expect(pushFrequencySelect).toBeDisabled();
  });

  test('displays quiet hours section', () => {
    render(<NotificationSettings settings={mockSettings} onUpdate={mockOnUpdate} />);
    
    expect(screen.getByText('Quiet Hours')).toBeInTheDocument();
    expect(screen.getByText(/Disable notifications during specified hours/)).toBeInTheDocument();
  });

  test('shows quiet hours schedule when enabled', () => {
    const settingsWithQuietHours = {
      notificationSettings: {
        ...mockSettings.notificationSettings,
        quietHoursEnabled: true
      }
    };
    
    render(<NotificationSettings settings={settingsWithQuietHours} onUpdate={mockOnUpdate} />);
    
    expect(screen.getByText('Quiet Hours Schedule')).toBeInTheDocument();
    expect(screen.getByText('Start Time')).toBeInTheDocument();
    expect(screen.getByText('End Time')).toBeInTheDocument();
  });

  test('hides quiet hours schedule when disabled', () => {
    render(<NotificationSettings settings={mockSettings} onUpdate={mockOnUpdate} />);
    
    expect(screen.queryByText('Quiet Hours Schedule')).not.toBeInTheDocument();
  });

  test('enables quiet hours schedule when checkbox is clicked', () => {
    render(<NotificationSettings settings={mockSettings} onUpdate={mockOnUpdate} />);
    
    const checkboxes = screen.getAllByRole('checkbox');
    const quietHoursCheckbox = checkboxes[6]; // Last checkbox is quiet hours
    fireEvent.click(quietHoursCheckbox);
    
    expect(screen.getByText('Quiet Hours Schedule')).toBeInTheDocument();
  });

  test('changes frequency selection', () => {
    render(<NotificationSettings settings={mockSettings} onUpdate={mockOnUpdate} />);
    
    const emailFrequencySelect = screen.getByDisplayValue('Daily');
    fireEvent.change(emailFrequencySelect, { target: { value: 'weekly' } });
    
    expect(emailFrequencySelect.value).toBe('weekly');
  });

  test('saves settings when save button is clicked', async () => {
    render(<NotificationSettings settings={mockSettings} onUpdate={mockOnUpdate} />);
    
    const saveButton = screen.getByText('Save Settings');
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(configurationService.updateNotificationSettings).toHaveBeenCalledWith(
        mockSettings.notificationSettings
      );
    });
    
    expect(mockOnUpdate).toHaveBeenCalledWith('notificationSettings', mockSettings.notificationSettings);
  });

  test('shows loading state while saving', async () => {
    configurationService.updateNotificationSettings.mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 100))
    );
    
    render(<NotificationSettings settings={mockSettings} onUpdate={mockOnUpdate} />);
    
    const saveButton = screen.getByText('Save Settings');
    fireEvent.click(saveButton);
    
    expect(screen.getByText('Saving...')).toBeInTheDocument();
    expect(saveButton).toBeDisabled();
    
    await waitFor(() => {
      expect(screen.getByText('Save Settings')).toBeInTheDocument();
    });
  });

  test('shows success message after successful save', async () => {
    render(<NotificationSettings settings={mockSettings} onUpdate={mockOnUpdate} />);
    
    const saveButton = screen.getByText('Save Settings');
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(screen.getByText('Notification settings saved successfully!')).toBeInTheDocument();
    });
  });

  test('shows error message when save fails', async () => {
    configurationService.updateNotificationSettings.mockRejectedValue(new Error('Network error'));
    
    render(<NotificationSettings settings={mockSettings} onUpdate={mockOnUpdate} />);
    
    const saveButton = screen.getByText('Save Settings');
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(screen.getByText('Failed to save notification settings. Please try again.')).toBeInTheDocument();
    });
  });

  test('saves updated settings after changes', async () => {
    render(<NotificationSettings settings={mockSettings} onUpdate={mockOnUpdate} />);
    
    // Toggle push notifications
    const checkboxes = screen.getAllByRole('checkbox');
    const pushCheckbox = checkboxes[1]; // Second checkbox is push
    fireEvent.click(pushCheckbox);
    
    // Change email frequency
    const emailFrequencySelect = screen.getByDisplayValue('Daily');
    fireEvent.change(emailFrequencySelect, { target: { value: 'weekly' } });
    
    const saveButton = screen.getByText('Save Settings');
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(configurationService.updateNotificationSettings).toHaveBeenCalledWith({
        ...mockSettings.notificationSettings,
        pushEnabled: true,
        emailFrequency: 'weekly'
      });
    });
  });

  test('handles empty settings gracefully', () => {
    const emptySettings = { notificationSettings: {} };
    
    render(<NotificationSettings settings={emptySettings} onUpdate={mockOnUpdate} />);
    
    // Should render without crashing
    expect(screen.getByText('Notification Settings')).toBeInTheDocument();
  });

  test('updates quiet hours times', () => {
    const settingsWithQuietHours = {
      notificationSettings: {
        ...mockSettings.notificationSettings,
        quietHoursEnabled: true
      }
    };
    
    render(<NotificationSettings settings={settingsWithQuietHours} onUpdate={mockOnUpdate} />);
    
    const startTimeSelect = screen.getByDisplayValue('22:00');
    fireEvent.change(startTimeSelect, { target: { value: '23:00' } });
    
    expect(startTimeSelect.value).toBe('23:00');
  });
});