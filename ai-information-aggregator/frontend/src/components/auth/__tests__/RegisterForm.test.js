import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import RegisterForm from '../RegisterForm';
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

describe('RegisterForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authService.isAuthenticated.mockReturnValue(false);
  });

  it('renders register form correctly', () => {
    render(
      <TestWrapper>
        <RegisterForm />
      </TestWrapper>
    );

    expect(screen.getByRole('heading', { name: 'Create Account' })).toBeInTheDocument();
    expect(screen.getByLabelText('Full Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Account' })).toBeInTheDocument();
    expect(screen.getByText('Already have an account?')).toBeInTheDocument();
  });

  it('validates required fields', async () => {
    render(
      <TestWrapper>
        <RegisterForm />
      </TestWrapper>
    );

    const submitButton = screen.getByRole('button', { name: 'Create Account' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Name is required')).toBeInTheDocument();
      expect(screen.getByText('Email is required')).toBeInTheDocument();
      expect(screen.getByText('Password is required')).toBeInTheDocument();
      expect(screen.getByText('Please confirm your password')).toBeInTheDocument();
    });
  });

  it('validates name length', async () => {
    render(
      <TestWrapper>
        <RegisterForm />
      </TestWrapper>
    );

    const nameInput = screen.getByLabelText('Full Name');
    const submitButton = screen.getByRole('button', { name: 'Create Account' });

    fireEvent.change(nameInput, { target: { value: 'A' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Name must be at least 2 characters')).toBeInTheDocument();
    });
  });

  it('validates email format', async () => {
    render(
      <TestWrapper>
        <RegisterForm />
      </TestWrapper>
    );

    const emailInput = screen.getByLabelText('Email');
    const submitButton = screen.getByRole('button', { name: 'Create Account' });

    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Invalid email address')).toBeInTheDocument();
    });
  });

  it('validates password complexity', async () => {
    render(
      <TestWrapper>
        <RegisterForm />
      </TestWrapper>
    );

    const passwordInput = screen.getByLabelText('Password');
    const submitButton = screen.getByRole('button', { name: 'Create Account' });

    fireEvent.change(passwordInput, { target: { value: 'simple' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Password must contain at least one uppercase letter, one lowercase letter, and one number')).toBeInTheDocument();
    });
  });

  it('validates password confirmation', async () => {
    render(
      <TestWrapper>
        <RegisterForm />
      </TestWrapper>
    );

    const passwordInput = screen.getByLabelText('Password');
    const confirmPasswordInput = screen.getByLabelText('Confirm Password');
    const submitButton = screen.getByRole('button', { name: 'Create Account' });

    fireEvent.change(passwordInput, { target: { value: 'Password123' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'DifferentPassword123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Passwords must match')).toBeInTheDocument();
    });
  });

  it('submits form with valid data', async () => {
    const mockUser = { id: '1', name: 'Test User', email: 'test@example.com' };
    const mockToken = 'mock-token';
    
    authService.register.mockResolvedValue({ user: mockUser, token: mockToken });

    render(
      <TestWrapper>
        <RegisterForm />
      </TestWrapper>
    );

    const nameInput = screen.getByLabelText('Full Name');
    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');
    const confirmPasswordInput = screen.getByLabelText('Confirm Password');
    const submitButton = screen.getByRole('button', { name: 'Create Account' });

    fireEvent.change(nameInput, { target: { value: 'Test User' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'Password123' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'Password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(authService.register).toHaveBeenCalledWith({
        name: 'Test User',
        email: 'test@example.com',
        password: 'Password123',
      });
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('displays error message on registration failure', async () => {
    const errorMessage = 'Email already exists';
    authService.register.mockRejectedValue(new Error(errorMessage));

    render(
      <TestWrapper>
        <RegisterForm />
      </TestWrapper>
    );

    const nameInput = screen.getByLabelText('Full Name');
    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');
    const confirmPasswordInput = screen.getByLabelText('Confirm Password');
    const submitButton = screen.getByRole('button', { name: 'Create Account' });

    fireEvent.change(nameInput, { target: { value: 'Test User' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'Password123' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'Password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  it('disables submit button while loading', async () => {
    authService.register.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)));

    render(
      <TestWrapper>
        <RegisterForm />
      </TestWrapper>
    );

    const nameInput = screen.getByLabelText('Full Name');
    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');
    const confirmPasswordInput = screen.getByLabelText('Confirm Password');
    const submitButton = screen.getByRole('button', { name: 'Create Account' });

    fireEvent.change(nameInput, { target: { value: 'Test User' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'Password123' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'Password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Creating Account...' })).toBeDisabled();
    });
  });
});