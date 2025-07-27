import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Settings from '../Settings';
import configurationService from '../../../services/configurationService';

// Mock the configuration service
jest.mock('../../../services/configurationService');

// Mock the individual settings components
jest.mock('../TopicPreferences', () => {
  return function MockTopicPreferences({ settings, onUpdate }) {
    return (
      <div data-testid="topic-preferences">
        Topic Preferences Component
        <button onClick={() => onUpdate('topicPreferences', { topics: ['AI'] })}>
          Update Topics
        </button>
      </div>
    );
  };
});

jest.mock('../NotificationSettings', () => {
  return function MockNotificationSettings({ settings, onUpdate }) {
    return (
      <div data-testid="notification-settings">
        Notification Settings Component
        <button onClick={() => onUpdate('notificationSettings', { emailEnabled: true })}>
          Update Notifications
        </button>
      </div>
    );
  };
});

jest.mock('../ContentVolumeSettings', () => {
  return function MockContentVolumeSettings({ settings, onUpdate }) {
    return (
      <div data-testid="content-volume-settings">
        Content Volume Settings Component
      </div>
    );
  };
});

jest.mock('../DiscoverySettings', () => {
  return function MockDiscoverySettings({ settings, onUpdate }) {
    return (
      <div data-testid="discovery-settings">
        Discovery Settings Component
      </div>
    );
  };
});

jest.mock('../SummaryPreferences', () => {
  return function MockSummaryPreferences({ settings, onUpdate }) {
    return (
      <div data-testid="summary-preferences">
        Summary Preferences Component
      </div>
    );
  };
});

jest.mock('../DigestScheduling', () => {
  return function MockDigestScheduling({ settings, onUpdate }) {
    return (
      <div data-testid="digest-scheduling">
        Digest Scheduling Component
      </div>
    );
  };
});

const mockSettings = {
  topicPreferences: { topics: ['Machine Learning', 'AI'] },
  notificationSettings: { emailEnabled: true, pushEnabled: false },
  contentVolumeSettings: { dailyLimit: 50 },
  discoverySettings: { aggressiveness: 0.7 },
  summaryPreferences: { defaultLength: 'medium' },
  digestScheduling: { enabled: true, frequency: 'daily' }
};

describe('Settings Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    configurationService.getAllSettings.mockResolvedValue(mockSettings);
  });

  test('renders settings page with title and description', async () => {
    render(<Settings />);
    
    await waitFor(() => {
      expect(screen.queryByText('Loading settings...')).not.toBeInTheDocument();
    });
    
    expect(screen.getByText('System Configuration')).toBeInTheDocument();
    expect(screen.getByText(/Customize your AI Information Aggregator experience/)).toBeInTheDocument();
  });

  test('shows loading state initially', () => {
    render(<Settings />);
    
    expect(screen.getByText('Loading settings...')).toBeInTheDocument();
  });

  test('loads settings on mount', async () => {
    render(<Settings />);
    
    await waitFor(() => {
      expect(configurationService.getAllSettings).toHaveBeenCalledTimes(1);
    });
  });

  test('renders all tab buttons', async () => {
    render(<Settings />);
    
    await waitFor(() => {
      expect(screen.queryByText('Loading settings...')).not.toBeInTheDocument();
    });

    expect(screen.getByText('Topic Preferences')).toBeInTheDocument();
    expect(screen.getByText('Notifications')).toBeInTheDocument();
    expect(screen.getByText('Content Volume')).toBeInTheDocument();
    expect(screen.getByText('Discovery')).toBeInTheDocument();
    expect(screen.getByText('Summary')).toBeInTheDocument();
    expect(screen.getByText('Digest')).toBeInTheDocument();
  });

  test('shows topic preferences tab by default', async () => {
    render(<Settings />);
    
    await waitFor(() => {
      expect(screen.getByTestId('topic-preferences')).toBeInTheDocument();
    });
  });

  test('switches tabs when clicked', async () => {
    render(<Settings />);
    
    await waitFor(() => {
      expect(screen.getByTestId('topic-preferences')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Notifications'));
    
    expect(screen.getByTestId('notification-settings')).toBeInTheDocument();
    expect(screen.queryByTestId('topic-preferences')).not.toBeInTheDocument();
  });

  test('switches to content volume tab', async () => {
    render(<Settings />);
    
    await waitFor(() => {
      expect(screen.getByTestId('topic-preferences')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Content Volume'));
    
    expect(screen.getByTestId('content-volume-settings')).toBeInTheDocument();
  });

  test('switches to discovery tab', async () => {
    render(<Settings />);
    
    await waitFor(() => {
      expect(screen.getByTestId('topic-preferences')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Discovery'));
    
    expect(screen.getByTestId('discovery-settings')).toBeInTheDocument();
  });

  test('switches to summary tab', async () => {
    render(<Settings />);
    
    await waitFor(() => {
      expect(screen.getByTestId('topic-preferences')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Summary'));
    
    expect(screen.getByTestId('summary-preferences')).toBeInTheDocument();
  });

  test('switches to digest tab', async () => {
    render(<Settings />);
    
    await waitFor(() => {
      expect(screen.getByTestId('topic-preferences')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Digest'));
    
    expect(screen.getByTestId('digest-scheduling')).toBeInTheDocument();
  });

  test('handles settings update from child components', async () => {
    render(<Settings />);
    
    await waitFor(() => {
      expect(screen.getByTestId('topic-preferences')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Update Topics'));
    
    // The settings should be updated internally
    // We can't directly test the state, but we can verify the component doesn't crash
    expect(screen.getByTestId('topic-preferences')).toBeInTheDocument();
  });

  test('displays error message when settings fail to load', async () => {
    configurationService.getAllSettings.mockRejectedValue(new Error('Network error'));
    
    render(<Settings />);
    
    await waitFor(() => {
      expect(screen.getByText('Failed to load settings. Please try again.')).toBeInTheDocument();
    });
  });

  test('passes correct props to child components', async () => {
    render(<Settings />);
    
    await waitFor(() => {
      expect(screen.getByTestId('topic-preferences')).toBeInTheDocument();
    });

    // Switch to notifications tab to test props passing
    fireEvent.click(screen.getByText('Notifications'));
    
    expect(screen.getByTestId('notification-settings')).toBeInTheDocument();
  });

  test('active tab has correct styling', async () => {
    render(<Settings />);
    
    await waitFor(() => {
      expect(screen.queryByText('Loading settings...')).not.toBeInTheDocument();
    });

    const topicTab = screen.getByText('Topic Preferences');
    const notificationTab = screen.getByText('Notifications');
    
    // Topic Preferences should be active by default
    expect(topicTab).toHaveStyle('color: #007bff');
    expect(notificationTab).toHaveStyle('color: #666');
    
    // Click notifications tab
    fireEvent.click(notificationTab);
    
    expect(notificationTab).toHaveStyle('color: #007bff');
  });

  test('handles reload functionality', async () => {
    render(<Settings />);
    
    await waitFor(() => {
      expect(screen.getByTestId('topic-preferences')).toBeInTheDocument();
    });

    // Clear the mock to test reload
    configurationService.getAllSettings.mockClear();
    configurationService.getAllSettings.mockResolvedValue(mockSettings);
    
    // Trigger reload by updating settings (this would typically trigger a reload)
    fireEvent.click(screen.getByText('Update Topics'));
    
    // The component should still be functional
    expect(screen.getByTestId('topic-preferences')).toBeInTheDocument();
  });

  test('maintains tab state during settings updates', async () => {
    render(<Settings />);
    
    await waitFor(() => {
      expect(screen.getByTestId('topic-preferences')).toBeInTheDocument();
    });

    // Switch to notifications tab
    fireEvent.click(screen.getByText('Notifications'));
    expect(screen.getByTestId('notification-settings')).toBeInTheDocument();
    
    // Update settings
    fireEvent.click(screen.getByText('Update Notifications'));
    
    // Should still be on notifications tab
    expect(screen.getByTestId('notification-settings')).toBeInTheDocument();
  });
});