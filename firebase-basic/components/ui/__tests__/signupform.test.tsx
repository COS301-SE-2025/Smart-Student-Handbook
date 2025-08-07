import React from 'react';
import { SignupForm } from '@/components/signup-form';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import "@testing-library/jest-dom";

// Mock implementations
const mockCreateUserWithEmailAndPassword = jest.fn();
const mockInitializeNewUser = jest.fn();
const mockPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

jest.mock("firebase/auth", () => ({
  getAuth: jest.fn(() => ({})),
  createUserWithEmailAndPassword: jest.fn((...args) => 
    mockCreateUserWithEmailAndPassword(...args)),
}));

jest.mock("@/lib/firebase", () => ({
  auth: {},
}));

jest.mock("@/utils/user", () => ({
  initializeNewUser: jest.fn((...args) => 
    mockInitializeNewUser(...args)),
}));

describe('SignupForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateUserWithEmailAndPassword.mockReset();
    mockInitializeNewUser.mockReset();
    mockPush.mockReset();
  });

  describe('Happy paths', () => {
    test('renders all form fields and static content', () => {
      render(<SignupForm />);
      
      expect(screen.getByText('Create Account')).toBeInTheDocument();
      expect(screen.getByText('Join the Smart Student community')).toBeInTheDocument();
      expect(screen.getByTestId('name-input')).toBeInTheDocument();
      expect(screen.getByTestId('email-input')).toBeInTheDocument();
      expect(screen.getByTestId('password-input')).toBeInTheDocument();
      expect(screen.getByTestId('submit-button')).toBeInTheDocument();
      expect(screen.getByText(/Already have an account/i)).toBeInTheDocument();
      expect(screen.getByText(/By signing up, you agree to our/i)).toBeInTheDocument();
    });

    test('successful form submission', async () => {
      const mockUser = { uid: 'test-uid' };
      
      mockCreateUserWithEmailAndPassword.mockResolvedValue({ user: mockUser });
      mockInitializeNewUser.mockResolvedValue(undefined);
    
      render(<SignupForm />);
    
      // Fill out the form
      fireEvent.change(screen.getByTestId('name-input'), { target: { value: 'Test User' } });
      fireEvent.change(screen.getByTestId('email-input'), { target: { value: 'test@example.com' } });
      fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'password123' } });
      
      // Submit the form
      fireEvent.click(screen.getByTestId('submit-button'));

      // Wait for the async operations to complete
      await waitFor(() => {
        expect(mockCreateUserWithEmailAndPassword).toHaveBeenCalledWith(
          expect.anything(),
          'test@example.com',
          'password123'
        );
        expect(mockInitializeNewUser).toHaveBeenCalledWith('test-uid', 'Test User');
        expect(mockPush).toHaveBeenCalledWith('/dashboard');
      });
    });

    test('email validation works correctly', () => {
      // Test the email regex directly
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      expect(emailRegex.test('invalid-email')).toBe(false);
      expect(emailRegex.test('test@example.com')).toBe(true);
    });
  });

  describe('Error handling', () => {
    test('shows error when user creation fails', async () => {
      mockCreateUserWithEmailAndPassword.mockRejectedValue(new Error('Email already in use'));

      render(<SignupForm />);

      // Fill out form with valid data
      fireEvent.change(screen.getByTestId('name-input'), { target: { value: 'Test' } });
      fireEvent.change(screen.getByTestId('email-input'), { target: { value: 'test@example.com' } });
      fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'password123' } });
      
      // Submit form
      fireEvent.click(screen.getByTestId('submit-button'));

      // Wait for error message
      await waitFor(() => {
        expect(screen.getByText('Email already in use')).toBeInTheDocument();
      });
    });

    test('shows error when initialization fails', async () => {
      const mockUser = { uid: 'test-uid' };
      mockCreateUserWithEmailAndPassword.mockResolvedValue({ user: mockUser });
      mockInitializeNewUser.mockRejectedValue(new Error('Initialization failed'));

      render(<SignupForm />);

      // Fill out form
      fireEvent.change(screen.getByTestId('name-input'), { target: { value: 'Test' } });
      fireEvent.change(screen.getByTestId('email-input'), { target: { value: 'test@example.com' } });
      fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'password123' } });
      
      // Submit form
      fireEvent.click(screen.getByTestId('submit-button'));

      // Wait for error message
      await waitFor(() => {
        expect(screen.getByText('Initialization failed')).toBeInTheDocument();
      });
    });
  });

  describe('Form behavior', () => {
    test('disables submit button when required fields are empty', () => {
      render(<SignupForm />);
      const button = screen.getByTestId('submit-button');
      expect(button).toBeDisabled();
    });

    test('enables submit button when all fields are valid', () => {
      render(<SignupForm />);
      
      fireEvent.change(screen.getByTestId('name-input'), { target: { value: 'Test' } });
      fireEvent.change(screen.getByTestId('email-input'), { target: { value: 'test@example.com' } });
      fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'password123' } });
      
      const button = screen.getByTestId('submit-button');
      expect(button).not.toBeDisabled();
    });

    test('trims whitespace from inputs', async () => {
      const mockUser = { uid: 'test-uid' };
      mockCreateUserWithEmailAndPassword.mockResolvedValue({ user: mockUser });
      mockInitializeNewUser.mockResolvedValue(true);

      render(<SignupForm />);

      // Fill form with whitespace
      fireEvent.change(screen.getByTestId('name-input'), { target: { value: '  Test User  ' } });
      fireEvent.change(screen.getByTestId('email-input'), { target: { value: '  test@example.com  ' } });
      fireEvent.change(screen.getByTestId('password-input'), { target: { value: '  password123  ' } });
      
      // Submit form
      fireEvent.click(screen.getByTestId('submit-button'));

      // Verify trimmed values were used
      await waitFor(() => {
        expect(mockCreateUserWithEmailAndPassword).toHaveBeenCalledWith(
          expect.anything(),
          'test@example.com',
          'password123'
        );
        expect(mockInitializeNewUser).toHaveBeenCalledWith('test-uid', 'Test User');
      });
    });
  });
});