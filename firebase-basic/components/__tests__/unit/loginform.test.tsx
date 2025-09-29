import React from 'react'
import { LoginForm } from '@/components/login-form'; 
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import "@testing-library/jest-dom";

// Mocks
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
  })),
}));

const mockSignInWithEmailAndPassword = jest.fn();
jest.mock("firebase/auth", () => ({
  signInWithEmailAndPassword: (...args: any[]) => mockSignInWithEmailAndPassword(...args),
}));
jest.mock("@/lib/firebase", () => ({
  auth: {},
}));
jest.mock("@/lib/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

// UI component mocks
jest.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
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
  Apple: () => <svg data-testid="apple-icon" />,
  Facebook: () => <svg data-testid="facebook-icon" />,
  Github: () => <svg data-testid="github-icon" />,
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

describe('LoginForm() LoginForm method', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================
  // Happy Path Tests
  // =========================
  describe('Happy paths', () => {
    test('renders all form fields and static content', () => {
      render(<LoginForm />);
      expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument();
      expect(screen.getByText(/or continue with/i)).toBeInTheDocument();
      expect(screen.getByText(/don't have an account/i)).toBeInTheDocument();
      expect(screen.getByText(/terms of service/i)).toBeInTheDocument();
      expect(screen.getByText(/privacy policy/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /sign up/i })).toHaveAttribute('href', '/signup');
      expect(screen.getByRole('link', { name: /forgot your password/i })).toBeInTheDocument();
      expect(screen.getByAltText(/smart student handbook logo/i)).toBeInTheDocument();
      expect(screen.getByTestId('apple-icon')).toBeInTheDocument();
      expect(screen.getByTestId('github-icon')).toBeInTheDocument();
      expect(screen.getByTestId('facebook-icon')).toBeInTheDocument();
    });

    test('allows user to type email and password', () => {
      render(<LoginForm />);
      const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement;
      const passwordInput = screen.getByLabelText(/password/i) as HTMLInputElement;

      fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'mypassword' } });

      expect(emailInput.value).toBe('user@example.com');
      expect(passwordInput.value).toBe('mypassword');
    });

    test('submits form and navigates to dashboard on successful login', async () => {
      const pushMock = jest.fn();
      require("next/navigation").useRouter.mockImplementation(() => ({
        push: pushMock,
      }));
      mockSignInWithEmailAndPassword.mockResolvedValueOnce({ user: { uid: '123' } });

      render(<LoginForm />);
      fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'user@example.com' } });
      fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'mypassword' } });

      fireEvent.click(screen.getByRole('button', { name: 'Login' }));

      expect(screen.getByTestId('loader')).toBeInTheDocument();

      await waitFor(() => {
        expect(mockSignInWithEmailAndPassword).toHaveBeenCalledWith({}, 'user@example.com', 'mypassword');
        expect(pushMock).toHaveBeenCalledWith('/dashboard');
      });

      expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
      expect(screen.queryByText(/invalid email or password/i)).not.toBeInTheDocument();
    });

    test('disables login button and shows loader while loading', async () => {
      let resolvePromise: (value?: unknown) => void;
      mockSignInWithEmailAndPassword.mockImplementation(
        () => new Promise((resolve) => { resolvePromise = resolve; })
      );

      render(<LoginForm />);
      fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'user@example.com' } });
      fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'mypassword' } });

      const loginButton = screen.getByRole('button', { name: 'Login' });
      fireEvent.click(loginButton);

      expect(loginButton).toBeDisabled();
      expect(screen.getByTestId('loader')).toBeInTheDocument();

      resolvePromise!();
      await waitFor(() => expect(loginButton).not.toBeDisabled());
    });

    test('shows and hides password when toggle button is clicked', () => {
      render(<LoginForm />);
      const passwordInput = screen.getByLabelText(/password/i) as HTMLInputElement;
      const toggleButton = screen.getByRole('button', { name: /show/i });

      expect(passwordInput.type).toBe('password');
      fireEvent.click(toggleButton);
      expect(passwordInput.type).toBe('text');
      expect(screen.getByRole('button', { name: /hide/i })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /hide/i }));
      expect(passwordInput.type).toBe('password');
    });

   // Update the className test in loginform.test.tsx
test('applies custom className from parent to root div', () => {
  render(<LoginForm className="custom-class" />);
  
  // Find the root div by looking for the outermost container
  const rootDiv = screen.getByTestId('login-form-container');
  expect(rootDiv).toHaveClass('custom-class');
});
  });

  // =========================
  // Edge Case Tests
  // =========================
  describe('Edge cases', () => {
    test('shows error message on failed login', async () => {
      mockSignInWithEmailAndPassword.mockRejectedValueOnce(new Error('Auth error'));

      render(<LoginForm />);
      fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'fail@example.com' } });
      fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrongpass' } });

      fireEvent.click(screen.getByRole('button', { name: 'Login' }));

      await waitFor(() => {
        expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument();
      });
      expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
    });

    test('clears error message on new login attempt', async () => {
      mockSignInWithEmailAndPassword.mockRejectedValueOnce(new Error('Auth error'));
      render(<LoginForm />);
      fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'fail@example.com' } });
      fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrongpass' } });
      fireEvent.click(screen.getByRole('button', { name: 'Login' }));

      await waitFor(() => {
        expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument();
      });

      mockSignInWithEmailAndPassword.mockResolvedValueOnce({ user: { uid: '456' } });
      fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'user2@example.com' } });
      fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'newpass' } });
      fireEvent.click(screen.getByRole('button', { name: 'Login' }));

      await waitFor(() => {
        expect(screen.queryByText(/invalid email or password/i)).not.toBeInTheDocument();
      });
    });

    test('prevents form submission if required fields are empty', () => {
      render(<LoginForm />);
      const loginButton = screen.getByRole('button', { name: 'Login' });
      fireEvent.click(loginButton);
      expect(mockSignInWithEmailAndPassword).not.toHaveBeenCalled();
    });

    test('does not allow login while already loading', async () => {
      let resolvePromise: (value?: unknown) => void;
      mockSignInWithEmailAndPassword.mockImplementation(
        () => new Promise((resolve) => { resolvePromise = resolve; })
      );

      render(<LoginForm />);
      fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'user@example.com' } });
      fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'mypassword' } });

      const loginButton = screen.getByRole('button', { name: 'Login' });
      fireEvent.click(loginButton);
      fireEvent.click(loginButton);
      fireEvent.click(loginButton);

      expect(mockSignInWithEmailAndPassword).toHaveBeenCalledTimes(1);

      resolvePromise!();
      await waitFor(() => expect(loginButton).not.toBeDisabled());
    });

    test('social login buttons are present but do not trigger login', () => {
      render(<LoginForm />);
      const loginButton = screen.getByRole('button', { name: 'Login' });
      const socialButtons = [
        screen.getByTestId('apple-icon').closest('button'),
        screen.getByTestId('github-icon').closest('button'),
        screen.getByTestId('facebook-icon').closest('button')
      ].filter(Boolean) as HTMLButtonElement[];

      socialButtons.forEach(button => fireEvent.click(button!));
      expect(mockSignInWithEmailAndPassword).not.toHaveBeenCalled();
    });
  });
});