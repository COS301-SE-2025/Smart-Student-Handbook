import React from 'react'
import ProfilePage from '/Users/mpumenjamela/Smart-Student-Handbook-1/firebase-basic/app/profile/page';
import { act, fireEvent, render, screen } from '@testing-library/react';
import "@testing-library/jest-dom";

// Mock Firebase Auth
let currentUser: any = null;
jest.mock("firebase/auth", () => ({
  getAuth: () => ({
    get currentUser() { return currentUser; },
    set currentUser(val) { currentUser = val; }
  }),
  onAuthStateChanged: (auth: any, cb: any) => {
    cb(currentUser);
    return () => {};
  },
  EmailAuthProvider: {
    credential: (email: string, password: string) => ({ email, password }),
  },
  reauthenticateWithCredential: jest.fn(),
  updatePassword: jest.fn(),
}));

// Mock Firebase Database
jest.mock("firebase/database", () => ({
  onValue: jest.fn(),
  ref: jest.fn(),
  set: jest.fn(),
}));

jest.mock("/Users/mpumenjamela/Smart-Student-Handbook-1/firebase-basic/lib/firebase", () => ({
  db: {},
}));

jest.mock("/Users/mpumenjamela/Smart-Student-Handbook-1/firebase-basic/utils/SaveUserSettings", () => ({
  saveUserSettings: jest.fn(),
}));

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

// UI components: just passthrough
jest.mock("/Users/mpumenjamela/Smart-Student-Handbook-1/firebase-basic/components/ui/input", () => ({
  Input: (props: any) => <input {...props} data-testid={props.id} />,
}));
jest.mock("/Users/mpumenjamela/Smart-Student-Handbook-1/firebase-basic/components/ui/label", () => ({
  Label: (props: any) => <label {...props} />,
}));
jest.mock("/Users/mpumenjamela/Smart-Student-Handbook-1/firebase-basic/components/ui/tabs", () => ({
  Tabs: (props: any) => <div {...props} />,
  TabsContent: (props: any) => <div {...props} />,
  TabsList: (props: any) => <div {...props} />,
  TabsTrigger: (props: any) => <button {...props} />,
}));
jest.mock("/Users/mpumenjamela/Smart-Student-Handbook-1/firebase-basic/components/ui/card", () => ({
  Card: (props: any) => <div {...props} />,
  CardContent: (props: any) => <div {...props} />,
  CardDescription: (props: any) => <div {...props} />,
  CardFooter: (props: any) => <div {...props} />,
  CardHeader: (props: any) => <div {...props} />,
  CardTitle: (props: any) => <div {...props} />,
}));
jest.mock("/Users/mpumenjamela/Smart-Student-Handbook-1/firebase-basic/components/ui/button", () => ({
  Button: (props: any) => <button {...props} />,
}));
jest.mock("/Users/mpumenjamela/Smart-Student-Handbook-1/firebase-basic/components/ui/textarea", () => ({
  Textarea: (props: any) => <textarea {...props} data-testid={props.id} />,
}));
jest.mock("/Users/mpumenjamela/Smart-Student-Handbook-1/firebase-basic/components/ui/page-header", () => ({
  PageHeader: (props: any) => (
    <div>
      <div>{props.title}</div>
      <div>{props.description}</div>
    </div>
  ),  
}));
jest.mock("/Users/mpumenjamela/Smart-Student-Handbook-1/firebase-basic/components/ui/select", () => ({
  Select: ({ children, value, onValueChange }: any) => (
    <select 
      id="degree" 
      value={value} 
      onChange={(e) => onValueChange(e.target.value)}
      aria-label="Degree Program"
    >
      {children}
    </select>
  ),
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ children, value }: any) => <option value={value}>{children}</option>,
  SelectTrigger: ({ children }: any) => <>{children}</>,
  SelectValue: ({ placeholder }: any) => <option value="">{placeholder}</option>,
}));
jest.mock("lucide-react", () => ({
  TrendingUp: () => <svg data-testid="trending-up" />,
  Clock: () => <svg data-testid="clock" />,
  BookOpen: () => <svg data-testid="book-open" />,
  Calendar: () => <svg data-testid="calendar" />,
}));

// Mock useSessionSeconds
let sessionSecondsMock = 0;
jest.mock("/Users/mpumenjamela/Smart-Student-Handbook-1/firebase-basic/components/providers/SessionTimerProvider", () => ({
  useSessionSeconds: () => sessionSecondsMock,
}));

// Helper to set currentUser for tests
function setCurrentUser(user: any) {
  currentUser = user;
}

describe('ProfilePage() ProfilePage method', () => {
  // Get references to the mocked functions
  let onValueMock: jest.MockedFunction<any>;
  let refMock: jest.MockedFunction<any>;
  let setMock: jest.MockedFunction<any>;
  let saveUserSettingsMock: jest.MockedFunction<any>;
  let toastMock: any;

  beforeAll(() => {
    // Get the mocked functions after Jest has processed the mocks
    const { onValue, ref, set } = require('firebase/database');
    onValueMock = onValue as jest.MockedFunction<any>;
    refMock = ref as jest.MockedFunction<any>;
    setMock = set as jest.MockedFunction<any>;
    saveUserSettingsMock = require("/Users/mpumenjamela/Smart-Student-Handbook-1/firebase-basic/utils/SaveUserSettings").saveUserSettings;
    toastMock = require('sonner').toast;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    sessionSecondsMock = 0;
    setCurrentUser({ uid: 'test-uid', email: 'user@example.com' });

    // Setup ref mock to return an object with toString method
    refMock.mockImplementation((db: any, path: string) => ({
      toString: () => path,
      path
    }));

    // Setup default onValue mock implementation
    onValueMock.mockImplementation((refObj: any, cb: any) => {
      const path = refObj?.toString?.() || refObj?.path || '';

      if (path.includes('UserSettings')) {
        cb({
          val: () => ({
            name: 'John',
            surname: 'Doe',
            degree: 'CS',
            occupation: 'Student',
            hobbies: ['Reading', 'Coding'],
            description: 'Hello world',
          }),
        });
      } else if (path.includes('metrics')) {
        cb({
          val: () => ({
            totalStudyHours: 10,
            thisWeekHours: 5,
            notesCreated: 3,
            studyStreak: 2,
            lastUpdated: new Date().toISOString(),
          }),
        });
      } else if (path.includes('notes')) {
        cb({
          val: () => ({
            note1: {},
            note2: {},
            note3: {},
          }),
        });
      }

      return () => {};
    });
  });

  // Happy Path Tests
  describe('Happy Paths', () => {
    test('renders all main sections and metrics for a logged-in user', () => {
      render(<ProfilePage />);
      expect(screen.getByText('Settings')).toBeInTheDocument();
      expect(screen.getByText('Manage your account information, security, and preferences.')).toBeInTheDocument();
      expect(screen.getByText('Account Settings')).toBeInTheDocument();
      expect(screen.getByText('Security')).toBeInTheDocument();
      expect(screen.getByText('Profile Information')).toBeInTheDocument();
      expect(screen.getByText('Change Password')).toBeInTheDocument();
      expect(screen.getByText('Total Study Hours')).toBeInTheDocument();
      expect(screen.getByText('Notes Created')).toBeInTheDocument();
      expect(screen.getByText('Study Streak')).toBeInTheDocument();
      expect(screen.getByText('This Week')).toBeInTheDocument();
      // Metrics values
      expect(screen.getByText('10.0')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('2 days')).toBeInTheDocument();
      expect(screen.getByText('5.0h')).toBeInTheDocument();
    });

    test('loads and displays user profile data from database', () => {
      render(<ProfilePage />);
      expect(screen.getByLabelText('First Name')).toHaveValue('John');
      expect(screen.getByLabelText('Last Name')).toHaveValue('Doe');
      expect(screen.getByLabelText('Degree Program')).toHaveValue('CS');
      expect(screen.getByLabelText('Occupation')).toHaveValue('Student');
      expect(screen.getByLabelText('Interests & Hobbies')).toHaveValue('Reading, Coding');
      expect(screen.getByLabelText('Bio')).toHaveValue('Hello world');
    });

    test('allows editing and saving profile data', async () => {
      render(<ProfilePage />);
      
      fireEvent.change(screen.getByLabelText('First Name'), { target: { value: 'Jane' } });
      fireEvent.change(screen.getByLabelText('Interests & Hobbies'), { target: { value: 'Reading, Coding, Hiking' } });
      
      const saveButton = screen.getByText('Save Changes');
      expect(saveButton).not.toBeDisabled();
      
      await act(async () => {
        fireEvent.click(saveButton);
      });
      
      expect(saveUserSettingsMock).toHaveBeenCalledWith('test-uid', expect.objectContaining({
        name: 'Jane',
        hobbies: ['Reading', 'Coding', 'Hiking'],
      }));
      expect(toastMock.success).toHaveBeenCalledWith('Your settings have been saved.');
    });

    test('shows info toast when saving with no changes', async () => {
      render(<ProfilePage />);
      const saveButton = screen.getByText('Save Changes');
      
      await act(async () => {
        fireEvent.click(saveButton);
      });
      
      expect(toastMock.info).toHaveBeenCalledWith('No changes to save.');
    });

    test('password change: successful update', async () => {
      const { getByLabelText, getByText } = render(<ProfilePage />);
      
      fireEvent.click(getByText('Security'));
      fireEvent.change(getByLabelText('Current Password'), { target: { value: 'oldpass' } });
      fireEvent.change(getByLabelText('New Password'), { target: { value: 'newpass123' } });
      fireEvent.change(getByLabelText('Confirm New Password'), { target: { value: 'newpass123' } });
      
      const updateButton = getByText('Update Password');
      expect(updateButton).not.toBeDisabled();
      
      const { reauthenticateWithCredential, updatePassword } = require("firebase/auth");
      reauthenticateWithCredential.mockResolvedValueOnce({});
      updatePassword.mockResolvedValueOnce({});
      
      await act(async () => {
        fireEvent.click(updateButton);
      });
      
      expect(reauthenticateWithCredential).toHaveBeenCalled();
      expect(updatePassword).toHaveBeenCalled();
      expect(toastMock.success).toHaveBeenCalledWith('Password updated successfully.');
    });

    test('metrics update live with sessionSeconds', () => {
      sessionSecondsMock = 3600; // 1 hour
      render(<ProfilePage />);
      expect(screen.getByText('11.0')).toBeInTheDocument(); // totalStudyHours: 10 + 1
      expect(screen.getByText('6.0h')).toBeInTheDocument(); // thisWeekHours: 5 + 1
    });
  });

  // Edge Case Tests
  describe('Edge Cases', () => {
    test('renders default values when logged out', () => {
      setCurrentUser(null);
      onValueMock.mockImplementation(() => () => {});
      
      render(<ProfilePage />);
      
      expect(screen.getByLabelText('First Name')).toHaveValue('');
      expect(screen.getByLabelText('Last Name')).toHaveValue('');
      expect(screen.getByLabelText('Degree Program')).toHaveValue('');
      expect(screen.getByLabelText('Occupation')).toHaveValue('');
      expect(screen.getByLabelText('Interests & Hobbies')).toHaveValue('');
      expect(screen.getByLabelText('Bio')).toHaveValue('');
      expect(screen.getByText('0.0')).toBeInTheDocument();
      expect(screen.getByText('0')).toBeInTheDocument();
      expect(screen.getByText('0 days')).toBeInTheDocument();
      expect(screen.getByText('0.0h')).toBeInTheDocument();
      expect(screen.getByText('Save Changes')).toBeDisabled();
    });

    test('password change: missing fields', async () => {
      render(<ProfilePage />);
      fireEvent.click(screen.getByText('Security'));
      const updateButton = screen.getByText('Update Password');
      expect(updateButton).toBeDisabled();
    });

    test('password change: new password and confirmation do not match', async () => {
      render(<ProfilePage />);
      fireEvent.click(screen.getByText('Security'));
      
      fireEvent.change(screen.getByLabelText('Current Password'), { target: { value: 'oldpass' } });
      fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'newpass123' } });
      fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: 'wrongpass' } });
      
      const updateButton = screen.getByText('Update Password');
      expect(updateButton).toBeDisabled();
      expect(screen.getByText('Passwords do not match.')).toBeInTheDocument();
    });

    test('password change: new password same as current', async () => {
      render(<ProfilePage />);
      fireEvent.click(screen.getByText('Security'));
      
      fireEvent.change(screen.getByLabelText('Current Password'), { target: { value: 'samepass' } });
      fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'samepass' } });
      fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: 'samepass' } });
      
      const updateButton = screen.getByText('Update Password');
      
      await act(async () => {
        fireEvent.click(updateButton);
      });
      
      expect(toastMock.error).toHaveBeenCalledWith('New password cannot be the same as your current password.');
    });

    test('password change: no email on user', async () => {
      // Set user WITHOUT email
      setCurrentUser({ uid: 'test-uid', email: null });
      
      render(<ProfilePage />);
      fireEvent.click(screen.getByText('Security'));
      
      fireEvent.change(screen.getByLabelText('Current Password'), { target: { value: 'oldpass' } });
      fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'newpass123' } });
      fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: 'newpass123' } });
      
      const updateButton = screen.getByText('Update Password');
      
      await act(async () => {
        fireEvent.click(updateButton);
      });
      
      expect(toastMock.error).toHaveBeenCalledWith('Your account has no email. Please re-login and try again.');
    });

    test('password change: error conditions from Firebase', async () => {
      render(<ProfilePage />);
      fireEvent.click(screen.getByText('Security'));
      
      fireEvent.change(screen.getByLabelText('Current Password'), { target: { value: 'oldpass' } });
      fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'newpass123' } });
      fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: 'newpass123' } });
      
      const updateButton = screen.getByText('Update Password');
      const { reauthenticateWithCredential, updatePassword } = require("firebase/auth");

      // Test wrong-password error
      reauthenticateWithCredential.mockRejectedValueOnce({ code: 'auth/wrong-password' });
      await act(async () => {
        fireEvent.click(updateButton);
      });
      expect(toastMock.error).toHaveBeenCalledWith('Your current password is incorrect.');

      // Test weak-password error
      jest.clearAllMocks();
      reauthenticateWithCredential.mockResolvedValueOnce({});
      updatePassword.mockRejectedValueOnce({ code: 'auth/weak-password' });
      await act(async () => {
        fireEvent.click(updateButton);
      });
      expect(toastMock.error).toHaveBeenCalledWith('New password is too weak.');

      // Test too-many-requests error
      jest.clearAllMocks();
      reauthenticateWithCredential.mockResolvedValueOnce({});
      updatePassword.mockRejectedValueOnce({ code: 'auth/too-many-requests' });
      await act(async () => {
        fireEvent.click(updateButton);
      });
      expect(toastMock.error).toHaveBeenCalledWith('Too many attempts. Please wait.');

      // Test requires-recent-login error
      jest.clearAllMocks();
      reauthenticateWithCredential.mockResolvedValueOnce({});
      updatePassword.mockRejectedValueOnce({ code: 'auth/requires-recent-login' });
      await act(async () => {
        fireEvent.click(updateButton);
      });
      expect(toastMock.error).toHaveBeenCalledWith('Please log out and try again.');

      // Test generic error
      jest.clearAllMocks();
      reauthenticateWithCredential.mockResolvedValueOnce({});
      updatePassword.mockRejectedValueOnce({ code: 'other-error' });
      await act(async () => {
        fireEvent.click(updateButton);
      });
      expect(toastMock.error).toHaveBeenCalledWith('Failed to update password.');
    });

    test('hobbies field: trims and dedupes empty values on save', async () => {
      render(<ProfilePage />);
      
      fireEvent.change(screen.getByLabelText('Interests & Hobbies'), { 
        target: { value: '  Reading, , Coding,  , ' } 
      });
      
      const saveButton = screen.getByText('Save Changes');
      
      await act(async () => {
        fireEvent.click(saveButton);
      });
      
      expect(saveUserSettingsMock).toHaveBeenCalledWith('test-uid', expect.objectContaining({
        hobbies: ['Reading', 'Coding'],
      }));
    });

    test('notes count: handles empty notes object', () => {
      onValueMock.mockImplementation((refObj: any, cb: any) => {
        const path = refObj?.toString?.() || refObj?.path || '';
        
        if (path.includes('notes')) {
          cb({ val: () => ({}) });
        } else if (path.includes('UserSettings')) {
          cb({
            val: () => ({
              name: '',
              surname: '',
              degree: '',
              occupation: '',
              hobbies: '',
              description: '',
            }),
          });
        } else if (path.includes('metrics')) {
          cb({
            val: () => ({
              totalStudyHours: 0,
              thisWeekHours: 0,
              notesCreated: 0,
              studyStreak: 0,
              lastUpdated: new Date().toISOString(),
            }),
          });
        }
        return () => {};
      });
      
      render(<ProfilePage />);
      expect(screen.getByText('0')).toBeInTheDocument();
    });

    test('notes count: handles null notes object', () => {
      onValueMock.mockImplementation((refObj: any, cb: any) => {
        const path = refObj?.toString?.() || refObj?.path || '';
        
        if (path.includes('notes')) {
          cb({ val: () => null });
        } else if (path.includes('UserSettings')) {
          cb({
            val: () => ({
              name: '',
              surname: '',
              degree: '',
              occupation: '',
              hobbies: '',
              description: '',
            }),
          });
        } else if (path.includes('metrics')) {
          cb({
            val: () => ({
              totalStudyHours: 0,
              thisWeekHours: 0,
              notesCreated: 0,
              studyStreak: 0,
              lastUpdated: new Date().toISOString(),
            }),
          });
        }
        return () => {};
      });
      
      render(<ProfilePage />);
      expect(screen.getByText('0')).toBeInTheDocument();
    });
  });
});