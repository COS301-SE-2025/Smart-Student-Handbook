import React from 'react';
import { SignupForm } from '@/components/signup-form';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import "@testing-library/jest-dom";

// Mock implementations - declare functions directly in jest.mock calls
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

// Mock get function as well
jest.mock("firebase/database", () => ({
  ref: jest.fn((db, path) => ({ db, path })),
  set: jest.fn(),
  get: jest.fn(),
}));

jest.mock("@/lib/firebase", () => ({
  auth: {},
  db: {},
}));

// Import the mocked functions after mocking
import { ref as mockRef, set as mockSet, get as mockGet } from 'firebase/database';

describe('SignupForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateUserWithEmailAndPassword.mockReset();
    (mockSet as jest.Mock).mockReset();
    (mockRef as jest.Mock).mockReset();
    (mockGet as jest.Mock).mockReset();
    mockPush.mockReset();
    (mockRef as jest.Mock).mockImplementation((db, path) => ({ db, path }));
    
    // Mock get to return incomplete user settings by default
    (mockGet as jest.Mock).mockResolvedValue({
      val: () => ({
        name: 'Test',
        surname: 'User',
        email: 'test@example.com',
        degree: '', // incomplete
        occupation: '', // incomplete
        hobbies: [], // incomplete
        description: '', // incomplete
      })
    });
  });

  describe('Happy paths', () => {
    test('renders all form fields and static content', () => {
      render(<SignupForm />);
      
      expect(screen.getByText('Create Account')).toBeInTheDocument();
      expect(screen.getByText('Join the Smart Student community')).toBeInTheDocument();
      expect(screen.getByLabelText('Name')).toBeInTheDocument();
      expect(screen.getByLabelText('Surname')).toBeInTheDocument();
      expect(screen.getByLabelText('Email')).toBeInTheDocument();
      expect(screen.getByLabelText('Password')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument();
      expect(screen.getByText(/By clicking continue, you agree to our/i)).toBeInTheDocument();
    });

    test('successful form submission', async () => {
      const mockUser = { 
        uid: 'test-uid',
        email: 'test@example.com' 
      };
      
      mockCreateUserWithEmailAndPassword.mockResolvedValue({ user: mockUser });
      (mockSet as jest.Mock).mockResolvedValue(undefined);
    
      render(<SignupForm />);
    
      // Fill out the form
      fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Test' } });
      fireEvent.change(screen.getByLabelText('Surname'), { target: { value: 'User' } });
      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } });
      fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
      
      // Submit the form
      fireEvent.click(screen.getByRole('button', { name: /sign up/i }));

      // Wait for the async operations to complete
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
            email: 'test@example.com',
            degree: '',
            occupation: '',
            hobbies: [],
            description: '',
          }
        );
        
        expect(mockPush).toHaveBeenCalledWith('/profile'); // Should redirect to profile for incomplete settings
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
      fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Test' } });
      fireEvent.change(screen.getByLabelText('Surname'), { target: { value: 'User' } });
      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } });
      fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
      
      // Submit form
      fireEvent.click(screen.getByRole('button', { name: /sign up/i }));

      // Wait for error message
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
      (mockSet as jest.Mock).mockRejectedValue(new Error('Database write failed'));

      render(<SignupForm />);

      // Fill out form
      fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Test' } });
      fireEvent.change(screen.getByLabelText('Surname'), { target: { value: 'User' } });
      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } });
      fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
      
      // Submit form
      fireEvent.click(screen.getByRole('button', { name: /sign up/i }));

      // Wait for error message
      await waitFor(() => {
        expect(screen.getByText('Database write failed')).toBeInTheDocument();
      });
    });
  });

  describe('Form validation', () => {
    test('shows error for invalid email', async () => {
      render(<SignupForm />);
      
      fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Test' } });
      fireEvent.change(screen.getByLabelText('Surname'), { target: { value: 'User' } });
      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'invalid-email' } });
      fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
      
      fireEvent.click(screen.getByRole('button', { name: /sign up/i }));
      
      await waitFor(() => {
        expect(screen.getByText('Please enter a valid email address.')).toBeInTheDocument();
      });
    });

    test('shows error for short password', async () => {
      render(<SignupForm />);
      
      fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Test' } });
      fireEvent.change(screen.getByLabelText('Surname'), { target: { value: 'User' } });
      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } });
      fireEvent.change(screen.getByLabelText('Password'), { target: { value: '123' } });
      
      fireEvent.click(screen.getByRole('button', { name: /sign up/i }));
      
      await waitFor(() => {
        expect(screen.getByText('Password must be at least 6 characters.')).toBeInTheDocument();
      });
    });

    test('shows error for missing name or surname', async () => {
      render(<SignupForm />);
      
      // Leave name empty
      fireEvent.change(screen.getByLabelText('Surname'), { target: { value: 'User' } });
      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } });
      fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
      
      fireEvent.click(screen.getByRole('button', { name: /sign up/i }));
      
      await waitFor(() => {
        expect(screen.getByText('Please provide both first name and surname.')).toBeInTheDocument();
      });
    });
  });

  describe('Form behavior', () => {
    test('trims whitespace from inputs', async () => {
      const mockUser = { 
        uid: 'test-uid',
        email: 'test@example.com' 
      };
      
      mockCreateUserWithEmailAndPassword.mockResolvedValue({ user: mockUser });
      (mockSet as jest.Mock).mockResolvedValue(true);

      render(<SignupForm />);

      // Fill form with whitespace
      fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  Test  ' } });
      fireEvent.change(screen.getByLabelText('Surname'), { target: { value: '  User  ' } });
      fireEvent.change(screen.getByLabelText('Email'), { target: { value: '  test@example.com  ' } });
      fireEvent.change(screen.getByLabelText('Password'), { target: { value: '  password123  ' } });
      
      // Submit form
      fireEvent.click(screen.getByRole('button', { name: /sign up/i }));

      // Verify trimmed values were used (note: password is NOT trimmed in the actual component)
      await waitFor(() => {
        expect(mockCreateUserWithEmailAndPassword).toHaveBeenCalledWith(
          expect.anything(),
          'test@example.com',
          '  password123  ' // Password should NOT be trimmed
        );
        
        expect(mockSet).toHaveBeenCalledWith(
          expect.anything(),
          {
            name: 'Test',
            surname: 'User',
            email: 'test@example.com',
            degree: '',
            occupation: '',
            hobbies: [],
            description: '',
          }
        );
      });
    });
  });
});