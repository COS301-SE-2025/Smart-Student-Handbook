import React from 'react'
import { SignupForm } from '@/components/signup-form';
import { fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import "@testing-library/jest-dom";

// Mocks
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
  })),
}));

const mockCreateUserWithEmailAndPassword = jest.fn();
const mockInitializeNewUser = jest.fn();

jest.mock("firebase/auth", () => ({
  createUserWithEmailAndPassword: (...args: any[]) => 
    mockCreateUserWithEmailAndPassword(...args),
}));

jest.mock("@/utils/user", () => ({
  initializeNewUser: (...args: any[]) => 
    mockInitializeNewUser(...args),
}));

jest.mock("@/lib/firebase", () => ({
  auth: {},
}));

jest.mock("@/lib/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

jest.mock("@/components/ui/button", () => ({
    Button: ({ children, disabled, ...props }: any) => (
      <button {...props} disabled={disabled} data-testid="button">
        {children}
        {disabled && <span data-testid="button-disabled"></span>}
      </button>
    ),
  }));

jest.mock("@/components/ui/card", () => ({
  Card: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));

jest.mock("@/components/ui/input", () => ({
  Input: ({ ...props }: any) => <input {...props} />,
}));

jest.mock("@/components/ui/label", () => ({
  Label: ({ children, ...props }: any) => <label {...props}>{children}</label>,
}));

jest.mock("lucide-react", () => ({
  Loader2: () => <svg data-testid="loader" />,
}));

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => (
    <img 
      {...props} 
      fill={props.fill ? "true" : undefined}
      priority={props.priority ? "true" : undefined}
    />
  ),
}));

describe('SignupForm() SignupForm method', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Happy paths', () => {
    test('renders all form fields and static content', () => {
      render(<SignupForm />);
      expect(screen.getByText('Create Account')).toBeInTheDocument();
      expect(screen.getByText('Join the Smart Student community')).toBeInTheDocument();
      expect(screen.getByLabelText('Name')).toBeInTheDocument();
      expect(screen.getByLabelText('Email')).toBeInTheDocument();
      expect(screen.getByLabelText('Password')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Sign Up' })).toBeInTheDocument();
      expect(screen.getByText(/Already have an account/i)).toBeInTheDocument();
      expect(screen.getByText(/By signing up, you agree to our/i)).toBeInTheDocument();
      expect(screen.getByAltText('Smart Student Handbook Logo')).toBeInTheDocument();
    });

    test('allows user to fill and submit the form successfully', async () => {
        const mockUser = { uid: 'test-uid' };
        mockCreateUserWithEmailAndPassword.mockResolvedValueOnce({ user: mockUser });
        mockInitializeNewUser.mockResolvedValueOnce(undefined);
        
        const pushMock = jest.fn();
        require("next/navigation").useRouter.mockImplementation(() => ({
          push: pushMock,
        }));
      
        render(<SignupForm />);
      
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Alice Smith' } });
        fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'alice@example.com' } });
        fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
      
        fireEvent.click(screen.getByRole('button', { name: 'Sign Up' }));
      
        // Check for disabled state using our test ID
        expect(screen.getByTestId('button-disabled')).toBeInTheDocument();
        expect(screen.getByText('Signing up…')).toBeInTheDocument();
        expect(screen.getByTestId('loader')).toBeInTheDocument();
      
        await waitFor(() => {
          expect(mockCreateUserWithEmailAndPassword).toHaveBeenCalledWith(
            {},
            'alice@example.com',
            'password123'
          );
          expect(mockInitializeNewUser).toHaveBeenCalledWith('test-uid', 'Alice Smith');
          expect(pushMock).toHaveBeenCalledWith('/dashboard');
        });
      
        // Button should no longer be disabled
        expect(screen.queryByTestId('button-disabled')).not.toBeInTheDocument();
        expect(screen.queryByText('Signing up…')).not.toBeInTheDocument();
      });

      test('applies custom className from parent to root div', () => {
        render(<SignupForm className="custom-class" data-testid="root-div" />);
        const rootDiv = screen.getByTestId('root-div');
        expect(rootDiv).toHaveClass('custom-class');
        expect(rootDiv).toHaveClass('flex');
        expect(rootDiv).toHaveClass('flex-col');
        expect(rootDiv).toHaveClass('gap-6');
      });

    test('login link points to /login', () => {
      render(<SignupForm />);
      const loginLink = screen.getByRole('link', { name: /Log in/i });
      expect(loginLink).toHaveAttribute('href', '/login');
    });
  });

  describe('Edge cases', () => {
    test('shows error for invalid email format', async () => {
        render(<SignupForm />);
        
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Bob' } });
        fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'invalid-email' } });
        fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'pass1234' } });
      
        fireEvent.click(screen.getByRole('button', { name: 'Sign Up' }));
      
        const errorMessage = await screen.findByTestId('error-message');
        expect(errorMessage).toHaveTextContent('Please enter a valid email address.');
        expect(mockCreateUserWithEmailAndPassword).not.toHaveBeenCalled();
        expect(mockInitializeNewUser).not.toHaveBeenCalled();
      });

    test('trims email before validation and submission', async () => {
      const mockUser = { uid: 'trim-uid' };
      mockCreateUserWithEmailAndPassword.mockResolvedValueOnce({ user: mockUser });
      mockInitializeNewUser.mockResolvedValueOnce(undefined);
      
      const pushMock = jest.fn();
      require("next/navigation").useRouter.mockImplementation(() => ({
        push: pushMock,
      }));

      render(<SignupForm />);

      await act(async () => {
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Trim User' } });
        fireEvent.change(screen.getByLabelText('Email'), { target: { value: '  trim@example.com  ' } });
        fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'pass1234' } });
        fireEvent.click(screen.getByRole('button', { name: 'Sign Up' }));
      });

      await waitFor(() => {
        expect(mockCreateUserWithEmailAndPassword).toHaveBeenCalledWith(
          {},
          'trim@example.com',
          'pass1234'
        );
        expect(mockInitializeNewUser).toHaveBeenCalledWith('trim-uid', 'Trim User');
        expect(pushMock).toHaveBeenCalledWith('/dashboard');
      });
    });

    test('shows only one error at a time and clears error on new submit', async () => {
        mockCreateUserWithEmailAndPassword.mockRejectedValueOnce(new Error('First error'));
        render(<SignupForm />);
      
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Error User' } });
        fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'error@example.com' } });
        fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'pass1234' } });
      
        fireEvent.click(screen.getByRole('button', { name: 'Sign Up' }));
      
        let errorMessage = await screen.findByTestId('error-message');
        expect(errorMessage).toHaveTextContent('First error');
      
        fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'bademail' } });
        fireEvent.click(screen.getByRole('button', { name: 'Sign Up' }));
      
        errorMessage = await screen.findByTestId('error-message');
        expect(errorMessage).toHaveTextContent('Please enter a valid email address.');
        expect(screen.queryByText('First error')).not.toBeInTheDocument();
      });
      
    test('shows error if initializeNewUser throws', async () => {
      const mockUser = { uid: 'err-uid' };
      mockCreateUserWithEmailAndPassword.mockResolvedValueOnce({ user: mockUser });
      mockInitializeNewUser.mockRejectedValueOnce(new Error('Failed to initialize user'));
      render(<SignupForm />);

      await act(async () => {
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Fail User' } });
        fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'fail@example.com' } });
        fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'pass1234' } });
        fireEvent.click(screen.getByRole('button', { name: 'Sign Up' }));
      });

      expect(await screen.findByText('Failed to initialize user')).toBeInTheDocument();
      expect(screen.getByTestId('button')).not.toBeDisabled();
    });

    test('disables submit button and shows loader while loading', async () => {
      let resolvePromise: (value?: unknown) => void;
      mockCreateUserWithEmailAndPassword.mockImplementation(
        () => new Promise((resolve) => { resolvePromise = resolve; })
      );
      
      render(<SignupForm />);

      await act(async () => {
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Loader User' } });
        fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'loader@example.com' } });
        fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'pass1234' } });
        fireEvent.click(screen.getByRole('button', { name: 'Sign Up' }));
      });

      const submitButton = screen.getByTestId('button');
      expect(submitButton).toBeDisabled();
      expect(screen.getByText('Signing up…')).toBeInTheDocument();
      expect(screen.getByTestId('loader')).toBeInTheDocument();

      await act(async () => {
        resolvePromise!({ user: { uid: 'loader-uid' } });
      });

      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });
    });

    test('shows only one error at a time and clears error on new submit', async () => {
      mockCreateUserWithEmailAndPassword.mockRejectedValueOnce(new Error('First error'));
      render(<SignupForm />);

      await act(async () => {
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Error User' } });
        fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'error@example.com' } });
        fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'pass1234' } });
        fireEvent.click(screen.getByRole('button', { name: 'Sign Up' }));
      });

      expect(await screen.findByText('First error')).toBeInTheDocument();

      await act(async () => {
        fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'bademail' } });
        fireEvent.click(screen.getByRole('button', { name: 'Sign Up' }));
      });

      expect(await screen.findByText('Please enter a valid email address.')).toBeInTheDocument();
      expect(screen.queryByText('First error')).not.toBeInTheDocument();
    });
  });
});