import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import LoginForm from '../LoginForm';
import { AuthProvider } from '../../../contexts/AuthContext';
import { authService } from '../../../services/authService';

// Mock the auth service
jest.mock('../../../services/authService');

// Mock react-router-dom
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

const TestWrapper = ({ children }) => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <AuthProvider>
        {children}
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

describe('LoginForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authService.isAuthenticated.mockReturnValue(false);
  });

  it('renders login form correctly', () => {
    render(
      <TestWrapper>
        <LoginForm />
      </TestWrapper>
    );

    expect(screen.getByRole('heading', { name: 'Sign In' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
    expect(screen.getByText("Don't have an account?")).toBeInTheDocument();
    expect(screen.getByText('Forgot your password?')).toBeInTheDocument();
  });

  it('validates required fields', async () => {
    render(
      <TestWrapper>
        <LoginForm />
      </TestWrapper>
    );

    const submitButton = screen.getByRole('button', { name: 'Sign In' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Email is required')).toBeInTheDocument();
      expect(screen.getByText('Password is required')).toBeInTheDocument();
    });
  });

  it('validates email format', async () => {
    render(
      <TestWrapper>
        <LoginForm />
      </TestWrapper>
    );

    const emailInput = screen.getByLabelText('Email');
    const submitButton = screen.getByRole('button', { name: 'Sign In' });

    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Invalid email address')).toBeInTheDocument();
    });
  });

  it('validates password length', async () => {
    render(
      <TestWrapper>
        <LoginForm />
      </TestWrapper>
    );

    const passwordInput = screen.getByLabelText('Password');
    const submitButton = screen.getByRole('button', { name: 'Sign In' });

    fireEvent.change(passwordInput, { target: { value: '123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Password must be at least 6 characters')).toBeInTheDocument();
    });
  });

  it('submits form with valid data', async () => {
    const mockUser = { id: '1', name: 'Test User', email: 'test@example.com' };
    const mockToken = 'mock-token';
    
    authService.login.mockResolvedValue({ user: mockUser, token: mockToken });

    render(
      <TestWrapper>
        <LoginForm />
      </TestWrapper>
    );

    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');
    const submitButton = screen.getByRole('button', { name: 'Sign In' });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(authService.login).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('displays error message on login failure', async () => {
    const errorMessage = 'Invalid credentials';
    authService.login.mockRejectedValue(new Error(errorMessage));

    render(
      <TestWrapper>
        <LoginForm />
      </TestWrapper>
    );

    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');
    const submitButton = screen.getByRole('button', { name: 'Sign In' });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  it('disables submit button while loading', async () => {
    authService.login.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)));

    render(
      <TestWrapper>
        <LoginForm />
      </TestWrapper>
    );

    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');
    const submitButton = screen.getByRole('button', { name: 'Sign In' });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Signing In...' })).toBeDisabled();
    });
  });
});