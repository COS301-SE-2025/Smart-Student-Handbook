import React from 'react'
import ProfilePage from '@/app/profile/page';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import "@testing-library/jest-dom";

// Mock Firebase Auth
let mockCurrentUser: any = null;
let mockAuthStateCallback: any = null;

jest.mock("firebase/auth", () => ({
  getAuth: () => ({
    currentUser: mockCurrentUser,
  }),
  onAuthStateChanged: (auth: any, cb: any) => {
    mockAuthStateCallback = cb;
    // Immediately call with current user
    cb(mockCurrentUser);
    return () => {};
  },
  EmailAuthProvider: {
    credential: (email: string, password: string) => ({ email, password }),
  },
  reauthenticateWithCredential: jest.fn(),
  updatePassword: jest.fn(),
}));

// Mock Firebase Database
let mockOnValueCallbacks: { [key: string]: any } = {};

jest.mock("firebase/database", () => ({
  onValue: jest.fn((refObj: any, cb: any) => {
    const refString = refObj?.toString?.() || '';
    mockOnValueCallbacks[refString] = cb;
    
    // Trigger callback immediately with mock data based on ref
    if (refString.includes('UserSettings')) {
      cb({
        val: () => mockCurrentUser ? {
          name: 'John',
          surname: 'Doe',
          degree: 'Computer Science',
          occupation: 'Student',
          hobbies: ['Reading', 'Coding'],
          description: 'Hello world',
        } : null
      });
    } else if (refString.includes('metrics')) {
      cb({
        val: () => mockCurrentUser ? {
          totalStudyHours: 10,
          thisWeekHours: 5,
          notesCreated: 3,
          studyStreak: 2,
          lastUpdated: new Date().toISOString(),
        } : null
      });
    } else if (refString.includes('notes')) {
      cb({
        val: () => mockCurrentUser ? {
          note1: {},
          note2: {},
          note3: {},
        } : null
      });
    }
    
    return () => {};
  }),
  ref: jest.fn((db: any, path: string) => ({
    toString: () => path
  })),
  set: jest.fn(),
  get: jest.fn().mockResolvedValue({
    val: () => ({
      email: 'user@example.com'
    })
  }),
}));

jest.mock("@/lib/firebase", () => ({
  db: {},
}));

jest.mock("@/utils/SaveUserSettings", () => ({
  saveUserSettings: jest.fn(),
}));

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

// Mock all UI components to avoid implementation dependencies
jest.mock("@/components/ui/input", () => ({
  Input: (props: any) => <input {...props} data-testid={props.id || props['data-testid']} />,
}));

jest.mock("@/components/ui/label", () => ({
  Label: (props: any) => <label {...props} />,
}));

jest.mock("@/components/ui/tabs", () => ({
  Tabs: (props: any) => <div {...props}>{props.children}</div>,
  TabsContent: (props: any) => <div {...props}>{props.children}</div>,
  TabsList: (props: any) => <div {...props}>{props.children}</div>,
  TabsTrigger: (props: any) => <button {...props}>{props.children}</button>,
}));

jest.mock("@/components/ui/card", () => ({
  Card: (props: any) => <div {...props}>{props.children}</div>,
  CardContent: (props: any) => <div {...props}>{props.children}</div>,
  CardDescription: (props: any) => <div {...props}>{props.children}</div>,
  CardFooter: (props: any) => <div {...props}>{props.children}</div>,
  CardHeader: (props: any) => <div {...props}>{props.children}</div>,
  CardTitle: (props: any) => <div {...props}>{props.children}</div>,
}));

jest.mock("@/components/ui/button", () => ({
  Button: (props: any) => <button {...props}>{props.children}</button>,
}));

jest.mock("@/components/ui/textarea", () => ({
  Textarea: (props: any) => <textarea {...props} />,
}));

jest.mock("@/components/ui/page-header", () => ({
  PageHeader: (props: any) => (
    <div>
      <div>{props.title}</div>
      <div>{props.description}</div>
    </div>
  ),  
}));

// Mock Select as an input to avoid complex select implementation
jest.mock("@/components/ui/select", () => ({
  Select: ({ children, value, onValueChange }: any) => (
    <input 
      id="degree" 
      value={value || ''} 
      onChange={(e) => onValueChange && onValueChange(e.target.value)} 
      data-testid="degree"
      placeholder="Select your degree"
    />
  ),
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children, value }: any) => <option value={value}>{children}</option>,
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
}));

jest.mock("lucide-react", () => ({
  TrendingUp: () => <svg data-testid="trending-up" />,
  Clock: () => <svg data-testid="clock" />,
  BookOpen: () => <svg data-testid="book-open" />,
  Calendar: () => <svg data-testid="calendar" />,
}));

// Mock Session timer hook
let mockSessionSecondsMock = 0;
jest.mock("@/components/providers/SessionTimerProvider", () => ({
  useSessionSeconds: () => mockSessionSecondsMock,
}));

// Helper to set current user
function setCurrentUser(user: any) {
  mockCurrentUser = user;
  if (mockAuthStateCallback) {
    mockAuthStateCallback(user);
  }
}

describe('ProfilePage() ProfilePage method', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSessionSecondsMock = 0;
    mockOnValueCallbacks = {};
    
    // Setup save function mock
    const saveUserSettings = require("@/utils/SaveUserSettings").saveUserSettings;
    saveUserSettings.mockResolvedValue(undefined);
  });

  describe('Happy Paths', () => {
    beforeEach(() => {
      setCurrentUser({ uid: 'test-uid', email: 'user@example.com' });
    });

    test('renders all main sections and metrics for a logged-in user', async () => {
      render(<ProfilePage />);
      
      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument();
      });
      
      expect(screen.getByText('Manage your account information, security, and preferences.')).toBeInTheDocument();
      expect(screen.getByText('Account Settings')).toBeInTheDocument();
      expect(screen.getByText('Security')).toBeInTheDocument();
      expect(screen.getByText('Profile Information')).toBeInTheDocument();
      expect(screen.getByText('Change Password')).toBeInTheDocument();
      expect(screen.getByText('Total Study Hours')).toBeInTheDocument();
      expect(screen.getByText('Notes Created')).toBeInTheDocument();
      expect(screen.getByText('Study Streak')).toBeInTheDocument();
      expect(screen.getByText('This Week')).toBeInTheDocument();
    });

    test('loads and displays user profile data from database', async () => {
      render(<ProfilePage />);
      
      await waitFor(() => {
        expect(screen.getByLabelText('First Name')).toHaveValue('John');
      });
      
      expect(screen.getByLabelText('Last Name')).toHaveValue('Doe');
      expect(screen.getByTestId('degree')).toHaveValue('Computer Science');
      expect(screen.getByLabelText('Occupation')).toHaveValue('Student');
      expect(screen.getByLabelText('Interests & Hobbies')).toHaveValue('Reading, Coding');
      expect(screen.getByLabelText('Bio')).toHaveValue('Hello world');
    });

    test('allows editing and saving profile data', async () => {
      render(<ProfilePage />);
      
      await waitFor(() => {
        expect(screen.getByLabelText('First Name')).toHaveValue('John');
      });
      
      fireEvent.change(screen.getByLabelText('First Name'), { target: { value: 'Jane' } });
      fireEvent.change(screen.getByLabelText('Interests & Hobbies'), { target: { value: 'Reading, Coding, Hiking' } });
      
      const saveButton = screen.getByText('Save Changes');
      expect(saveButton).not.toBeDisabled();
      
      await act(async () => {
        fireEvent.click(saveButton);
      });
      
      expect(require("@/utils/SaveUserSettings").saveUserSettings).toHaveBeenCalledWith('test-uid', expect.objectContaining({
        name: 'Jane',
        hobbies: ['Reading', 'Coding', 'Hiking'],
      }));
      expect(require('sonner').toast.success).toHaveBeenCalledWith('Your settings have been saved.');
    });

    test('password change: successful update', async () => {
      render(<ProfilePage />);
      
      await waitFor(() => {
        expect(screen.getByLabelText('First Name')).toHaveValue('John');
      });
      
      fireEvent.click(screen.getByText('Security'));
      fireEvent.change(screen.getByLabelText('Current Password'), { target: { value: 'oldpass' } });
      fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'newpass123' } });
      fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: 'newpass123' } });
      
      const updateButton = screen.getByText('Update Password');
      expect(updateButton).not.toBeDisabled();
      
      const reauth = require("firebase/auth").reauthenticateWithCredential;
      const updatePw = require("firebase/auth").updatePassword;
      reauth.mockResolvedValueOnce({});
      updatePw.mockResolvedValueOnce({});
      
      await act(async () => {
        fireEvent.click(updateButton);
      });
      
      expect(reauth).toHaveBeenCalled();
      expect(updatePw).toHaveBeenCalled();
      expect(require('sonner').toast.success).toHaveBeenCalledWith('Password updated successfully.');
    });

    test('metrics update live with sessionSeconds', async () => {
      mockSessionSecondsMock = 3600; // 1 hour
      
      render(<ProfilePage />);
      
      await waitFor(() => {
        expect(screen.getByText('11.0')).toBeInTheDocument(); // totalStudyHours: 10 + 1
      });
      
      expect(screen.getByText('6.0h')).toBeInTheDocument(); // thisWeekHours: 5 + 1
    });
  });

  describe('Edge Cases', () => {
    test('renders default values when logged out', async () => {
      setCurrentUser(null);
      render(<ProfilePage />);
      
      await waitFor(() => {
        expect(screen.getByLabelText('First Name')).toHaveValue('');
      });
      
      expect(screen.getByLabelText('Last Name')).toHaveValue('');
      expect(screen.getByTestId('degree')).toHaveValue('');
      expect(screen.getByLabelText('Occupation')).toHaveValue('');
      expect(screen.getByLabelText('Interests & Hobbies')).toHaveValue('');
      expect(screen.getByLabelText('Bio')).toHaveValue('');
      expect(screen.getByText('Save Changes')).toBeDisabled();
    });

    test('password change: missing fields disables button', async () => {
      setCurrentUser({ uid: 'test-uid', email: 'user@example.com' });
      render(<ProfilePage />);
      
      await waitFor(() => {
        expect(screen.getByLabelText('First Name')).toHaveValue('John');
      });
      
      fireEvent.click(screen.getByText('Security'));
      const updateButton = screen.getByText('Update Password');
      expect(updateButton).toBeDisabled();
    });

    test('password change: new password and confirmation do not match', async () => {
      setCurrentUser({ uid: 'test-uid', email: 'user@example.com' });
      render(<ProfilePage />);
      
      await waitFor(() => {
        expect(screen.getByLabelText('First Name')).toHaveValue('John');
      });
      
      fireEvent.click(screen.getByText('Security'));
      fireEvent.change(screen.getByLabelText('Current Password'), { target: { value: 'oldpass' } });
      fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'newpass123' } });
      fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: 'wrongpass' } });
      
      const updateButton = screen.getByText('Update Password');
      expect(updateButton).toBeDisabled();
      
      await waitFor(() => {
        expect(screen.getByText('Passwords do not match.')).toBeInTheDocument();
      });
    });

    test('hobbies field: trims and dedupes empty values on save', async () => {
      setCurrentUser({ uid: 'test-uid', email: 'user@example.com' });
      render(<ProfilePage />);
      
      await waitFor(() => {
        expect(screen.getByLabelText('First Name')).toHaveValue('John');
      });
      
      fireEvent.change(screen.getByLabelText('Interests & Hobbies'), { 
        target: { value: '  Reading, , Coding,  , ' } 
      });
      
      const saveButton = screen.getByText('Save Changes');
      
      await act(async () => {
        fireEvent.click(saveButton);
      });
      
      expect(require("@/utils/SaveUserSettings").saveUserSettings).toHaveBeenCalledWith('test-uid', expect.objectContaining({
        hobbies: ['Reading', 'Coding'],
      }));
    });

    test('password change: various Firebase error codes', async () => {
      setCurrentUser({ uid: 'test-uid', email: 'user@example.com' });
      render(<ProfilePage />);
      
      await waitFor(() => {
        expect(screen.getByLabelText('First Name')).toHaveValue('John');
      });
      
      fireEvent.click(screen.getByText('Security'));
      fireEvent.change(screen.getByLabelText('Current Password'), { target: { value: 'oldpass' } });
      fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'newpass123' } });
      fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: 'newpass123' } });
      
      const updateButton = screen.getByText('Update Password');
      const reauth = require("firebase/auth").reauthenticateWithCredential;
      
      // Test wrong-password error
      reauth.mockRejectedValueOnce({ code: 'auth/wrong-password' });
      await act(async () => {
        fireEvent.click(updateButton);
      });
      expect(require('sonner').toast.error).toHaveBeenCalledWith('Your current password is incorrect.');
    });

    test('password change: same as current password', async () => {
      setCurrentUser({ uid: 'test-uid', email: 'user@example.com' });
      render(<ProfilePage />);
      
      await waitFor(() => {
        expect(screen.getByLabelText('First Name')).toHaveValue('John');
      });
      
      fireEvent.click(screen.getByText('Security'));
      fireEvent.change(screen.getByLabelText('Current Password'), { target: { value: 'samepass' } });
      fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'samepass' } });
      fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: 'samepass' } });
      
      const updateButton = screen.getByText('Update Password');
      
      await act(async () => {
        fireEvent.click(updateButton);
      });
      
      expect(require('sonner').toast.error).toHaveBeenCalledWith('New password cannot be the same as your current password.');
    });
  });
});