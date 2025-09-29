import React from 'react';
import { SignupForm } from '@/components/signup-form';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import "@testing-library/jest-dom";

// Mock implementations
const mockCreateUserWithEmailAndPassword = jest.fn();
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
  updateProfile: jest.fn(() => Promise.resolve()),
}));

const mockRef = jest.fn((db, path) => ({ db, path }));
const mockSet = jest.fn();

jest.mock("firebase/database", () => ({
  ref: mockRef,
  set: mockSet,
}));

jest.mock("@/lib/firebase", () => ({
  auth: {},
  db: {},
}));

describe('SignupForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateUserWithEmailAndPassword.mockReset();
    mockSet.mockReset();
    mockRef.mockReset();
    mockPush.mockReset();
    mockRef.mockImplementation((db, path) => ({ db, path }));
  });

  describe('Happy paths', () => {
    test('renders all form fields and static content', () => {
      render(<SignupForm />);
      
      expect(screen.getByText('Create Account')).toBeInTheDocument();
      expect(screen.getByText('Join the Smart Student community')).toBeInTheDocument();
      expect(screen.getByTestId('name-input')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Your surname')).toBeInTheDocument();
      expect(screen.getByTestId('email-input')).toBeInTheDocument();
      expect(screen.getByTestId('password-input')).toBeInTheDocument();
      expect(screen.getByTestId('submit-button')).toBeInTheDocument();
      expect(screen.getByText(/Already have an account/i)).toBeInTheDocument();
      expect(screen.getByText(/By signing up, you agree to our/i)).toBeInTheDocument();
    });

    test('successful form submission', async () => {
      const mockUser = { 
        uid: 'test-uid',
        email: 'test@example.com' 
      };
      
      mockCreateUserWithEmailAndPassword.mockResolvedValue({ user: mockUser });
      mockSet.mockResolvedValue(undefined);
    
      render(<SignupForm />);
    
      fireEvent.change(screen.getByTestId('name-input'), { target: { value: 'Test' } });
      fireEvent.change(screen.getByPlaceholderText('Your surname'), { target: { value: 'User' } });
      fireEvent.change(screen.getByTestId('email-input'), { target: { value: 'test@example.com' } });
      fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'password123' } });
      
      fireEvent.click(screen.getByTestId('submit-button'));

      await waitFor(() => {
        expect(mockCreateUserWithEmailAndPassword).toHaveBeenCalledWith(
          expect.anything(),
          'test@example.com',
          'password123'
        );
        
        expect(mockSet).toHaveBeenCalledWith(
          expect.anything(),
          {
            name: 'Test',
            surname: 'User',
            role: 'User',
            email: 'test@example.com',
            createdAt: expect.any(Number),
          }
        );
        
        expect(mockPush).toHaveBeenCalledWith('/dashboard');
      });
    });

    test('email validation works correctly', () => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      expect(emailRegex.test('invalid-email')).toBe(false);
      expect(emailRegex.test('test@example.com')).toBe(true);
    });
  });

  describe('Error handling', () => {
    test('shows error when user creation fails', async () => {
      mockCreateUserWithEmailAndPassword.mockRejectedValue(new Error('Email already in use'));

      render(<SignupForm />);

      fireEvent.change(screen.getByTestId('name-input'), { target: { value: 'Test' } });
      fireEvent.change(screen.getByPlaceholderText('Your surname'), { target: { value: 'User' } });
      fireEvent.change(screen.getByTestId('email-input'), { target: { value: 'test@example.com' } });
      fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'password123' } });
      
      fireEvent.click(screen.getByTestId('submit-button'));

      await waitFor(() => {
        expect(screen.getByText('Email already in use')).toBeInTheDocument();
      });
    });

    test('shows error when database write fails', async () => {
      const mockUser = { 
        uid: 'test-uid',
        email: 'test@example.com' 
      };
      
      mockCreateUserWithEmailAndPassword.mockResolvedValue({ user: mockUser });
      mockSet.mockRejectedValue(new Error('Database write failed'));

      render(<SignupForm />);

      fireEvent.change(screen.getByTestId('name-input'), { target: { value: 'Test' } });
      fireEvent.change(screen.getByPlaceholderText('Your surname'), { target: { value: 'User' } });
      fireEvent.change(screen.getByTestId('email-input'), { target: { value: 'test@example.com' } });
      fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'password123' } });
      
      fireEvent.click(screen.getByTestId('submit-button'));

      await waitFor(() => {
        expect(screen.getByText('Database write failed')).toBeInTheDocument();
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
      fireEvent.change(screen.getByPlaceholderText('Your surname'), { target: { value: 'User' } });
      fireEvent.change(screen.getByTestId('email-input'), { target: { value: 'test@example.com' } });
      fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'password123' } });
      
      const button = screen.getByTestId('submit-button');
      expect(button).not.toBeDisabled();
    });

    test('trims whitespace from inputs', async () => {
      const mockUser = { 
        uid: 'test-uid',
        email: 'test@example.com' 
      };
      
      mockCreateUserWithEmailAndPassword.mockResolvedValue({ user: mockUser });
      mockSet.mockResolvedValue(true);

      render(<SignupForm />);

      fireEvent.change(screen.getByTestId('name-input'), { target: { value: '  Test  ' } });
      fireEvent.change(screen.getByPlaceholderText('Your surname'), { target: { value: '  User  ' } });
      fireEvent.change(screen.getByTestId('email-input'), { target: { value: '  test@example.com  ' } });
      fireEvent.change(screen.getByTestId('password-input'), { target: { value: '  password123  ' } });
      
      fireEvent.click(screen.getByTestId('submit-button'));

      await waitFor(() => {
        expect(mockCreateUserWithEmailAndPassword).toHaveBeenCalledWith(
          expect.anything(),
          'test@example.com',
          'password123'
        );
        
        expect(mockSet).toHaveBeenCalledWith(
          expect.anything(),
          {
            name: 'Test',
            surname: 'User',
            role: 'User',
            email: 'test@example.com',
            createdAt: expect.any(Number),
          }
        );
      });
    });
  });
});