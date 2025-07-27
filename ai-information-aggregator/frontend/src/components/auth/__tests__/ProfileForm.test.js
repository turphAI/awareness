import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import ProfileForm from '../ProfileForm';
import { AuthProvider, AuthContext } from '../../../contexts/AuthContext';
import { authService } from '../../../services/authService';

// Mock the auth service
jest.mock('../../../services/authService');

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

const mockUser = {
  id: '1',
  name: 'Test User',
  email: 'test@example.com',
  preferences: {
    topics: ['AI', 'Machine Learning'],
    contentVolume: 15,
    discoveryAggressiveness: 7,
    summaryLength: 'medium',
    digestFrequency: 'daily',
  },
  notifications: {
    email: true,
    push: false,
    digest: true,
  },
};

// Mock the AuthContext
const MockAuthProvider = ({ children }) => {
  const mockAuthValue = {
    user: mockUser,
    isAuthenticated: true,
    isLoading: false,
    error: null,
    updateProfile: authService.updateProfile,
  };

  return (
    <AuthContext.Provider value={mockAuthValue}>
      {children}
    </AuthContext.Provider>
  );
};

const TestWrapper = ({ children }) => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <MockAuthProvider>
        {children}
      </MockAuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

describe('ProfileForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authService.isAuthenticated.mockReturnValue(true);
    authService.getCurrentUser.mockResolvedValue(mockUser);
  });

  it('renders profile form correctly', async () => {
    render(
      <TestWrapper>
        <ProfileForm />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Profile Settings')).toBeInTheDocument();
      expect(screen.getByLabelText('Full Name')).toBeInTheDocument();
      expect(screen.getByLabelText('Email')).toBeInTheDocument();
      expect(screen.getByLabelText('Daily Content Volume')).toBeInTheDocument();
      expect(screen.getByLabelText('Summary Length')).toBeInTheDocument();
      expect(screen.getByLabelText('Digest Frequency')).toBeInTheDocument();
      expect(screen.getByLabelText('Email Notifications')).toBeInTheDocument();
      expect(screen.getByLabelText('Push Notifications')).toBeInTheDocument();
      expect(screen.getByLabelText('Digest Notifications')).toBeInTheDocument();
    });
  });

  it('populates form with user data', async () => {
    render(
      <TestWrapper>
        <ProfileForm />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Test User')).toBeInTheDocument();
      expect(screen.getByDisplayValue('test@example.com')).toBeInTheDocument();
      expect(screen.getByDisplayValue('15')).toBeInTheDocument();
      // Check select values by finding the selected option
      const summarySelect = screen.getByLabelText('Summary Length');
      expect(summarySelect.value).toBe('medium');
      const digestSelect = screen.getByLabelText('Digest Frequency');
      expect(digestSelect.value).toBe('daily');
    });

    // Check checkboxes
    expect(screen.getByLabelText('Email Notifications')).toBeChecked();
    expect(screen.getByLabelText('Push Notifications')).not.toBeChecked();
    expect(screen.getByLabelText('Digest Notifications')).toBeChecked();
  });

  it('validates required fields', async () => {
    render(
      <TestWrapper>
        <ProfileForm />
      </TestWrapper>
    );

    await waitFor(() => {
      const nameInput = screen.getByLabelText('Full Name');
      fireEvent.change(nameInput, { target: { value: '' } });
    });

    const submitButton = screen.getByRole('button', { name: 'Save Changes' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Name is required')).toBeInTheDocument();
    });
  });

  it('validates email format', async () => {
    render(
      <TestWrapper>
        <ProfileForm />
      </TestWrapper>
    );

    await waitFor(() => {
      const emailInput = screen.getByLabelText('Email');
      fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    });

    const submitButton = screen.getByRole('button', { name: 'Save Changes' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Invalid email address')).toBeInTheDocument();
    });
  });

  it('submits form with updated data', async () => {
    const updatedUser = { ...mockUser, name: 'Updated Name' };
    authService.updateProfile.mockResolvedValue(updatedUser);

    render(
      <TestWrapper>
        <ProfileForm />
      </TestWrapper>
    );

    await waitFor(() => {
      const nameInput = screen.getByLabelText('Full Name');
      fireEvent.change(nameInput, { target: { value: 'Updated Name' } });
    });

    const submitButton = screen.getByRole('button', { name: 'Save Changes' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(authService.updateProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Updated Name',
          email: 'test@example.com',
        })
      );
    });
  });

  it('displays success message on successful update', async () => {
    const updatedUser = { ...mockUser, name: 'Updated Name' };
    authService.updateProfile.mockResolvedValue(updatedUser);

    render(
      <TestWrapper>
        <ProfileForm />
      </TestWrapper>
    );

    await waitFor(() => {
      const nameInput = screen.getByLabelText('Full Name');
      fireEvent.change(nameInput, { target: { value: 'Updated Name' } });
    });

    const submitButton = screen.getByRole('button', { name: 'Save Changes' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Profile updated successfully!')).toBeInTheDocument();
    });
  });

  it('displays error message on update failure', async () => {
    const errorMessage = 'Update failed';
    authService.updateProfile.mockRejectedValue(new Error(errorMessage));

    render(
      <TestWrapper>
        <ProfileForm />
      </TestWrapper>
    );

    await waitFor(() => {
      const nameInput = screen.getByLabelText('Full Name');
      fireEvent.change(nameInput, { target: { value: 'Updated Name' } });
    });

    const submitButton = screen.getByRole('button', { name: 'Save Changes' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  it('handles checkbox changes correctly', async () => {
    authService.updateProfile.mockResolvedValue(mockUser);

    render(
      <TestWrapper>
        <ProfileForm />
      </TestWrapper>
    );

    await waitFor(() => {
      const pushNotificationCheckbox = screen.getByLabelText('Push Notifications');
      fireEvent.click(pushNotificationCheckbox);
    });

    const submitButton = screen.getByRole('button', { name: 'Save Changes' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(authService.updateProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          notifications: expect.objectContaining({
            push: true,
          }),
        })
      );
    });
  });

  it('calls onCancel when cancel button is clicked', async () => {
    const mockOnCancel = jest.fn();

    render(
      <TestWrapper>
        <ProfileForm onCancel={mockOnCancel} />
      </TestWrapper>
    );

    await waitFor(() => {
      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      fireEvent.click(cancelButton);
    });

    expect(mockOnCancel).toHaveBeenCalled();
  });
});