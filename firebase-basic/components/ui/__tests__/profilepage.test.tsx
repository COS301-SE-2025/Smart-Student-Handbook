import React from 'react'
import ProfilePage from '/Users/mpumenjamela/Smart-Student-Handbook-1/firebase-basic/app/profile/page';
import { act, fireEvent, render, screen } from '@testing-library/react';
import "@testing-library/jest-dom";

// Create a mock function for onValue BEFORE using it
const onValueMock = jest.fn()

// Mocks for hooks and modules
jest.mock("firebase/auth", () => {
  // getAuth returns a mock auth object
  let currentUser: any = null
  return {
    getAuth: () => ({
      currentUser,
    }),
    onAuthStateChanged: (auth: any, cb: any) => {
      // Simulate user login
      cb(currentUser)
      return () => {}
    },
    EmailAuthProvider: {
      credential: (email: string, password: string) => ({ email, password }),
    },
    reauthenticateWithCredential: jest.fn(),
    updatePassword: jest.fn(),
  }
})

jest.mock("firebase/database", () => ({
  onValue: onValueMock,
  ref: jest.fn(),
  set: jest.fn(),
}))

jest.mock("/Users/mpumenjamela/Smart-Student-Handbook-1/firebase-basic/lib/firebase", () => ({
  db: {},
}))

jest.mock("/Users/mpumenjamela/Smart-Student-Handbook-1/firebase-basic/utils/SaveUserSettings", () => ({
  saveUserSettings: jest.fn(),
}))

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}))

// UI components: just passthrough
jest.mock("/Users/mpumenjamela/Smart-Student-Handbook-1/firebase-basic/components/ui/input", () => ({
  Input: (props: any) => <input {...props} />,
}))
jest.mock("/Users/mpumenjamela/Smart-Student-Handbook-1/firebase-basic/components/ui/label", () => ({
  Label: (props: any) => <label {...props} />,
}))
jest.mock("/Users/mpumenjamela/Smart-Student-Handbook-1/firebase-basic/components/ui/tabs", () => ({
  Tabs: (props: any) => <div {...props} />,
  TabsContent: (props: any) => <div {...props} />,
  TabsList: (props: any) => <div {...props} />,
  TabsTrigger: (props: any) => <button {...props} />,
}))
jest.mock("/Users/mpumenjamela/Smart-Student-Handbook-1/firebase-basic/components/ui/card", () => ({
  Card: (props: any) => <div {...props} />,
  CardContent: (props: any) => <div {...props} />,
  CardDescription: (props: any) => <div {...props} />,
  CardFooter: (props: any) => <div {...props} />,
  CardHeader: (props: any) => <div {...props} />,
  CardTitle: (props: any) => <div {...props} />,
}))
jest.mock("/Users/mpumenjamela/Smart-Student-Handbook-1/firebase-basic/components/ui/button", () => ({
  Button: (props: any) => <button {...props} />,
}))
jest.mock("/Users/mpumenjamela/Smart-Student-Handbook-1/firebase-basic/components/ui/textarea", () => ({
  Textarea: (props: any) => <textarea {...props} />,
}))
jest.mock("/Users/mpumenjamela/Smart-Student-Handbook-1/firebase-basic/components/ui/page-header", () => ({
  PageHeader: (props: any) => <div>{props.title}{props.description}</div>,
}))
jest.mock("/Users/mpumenjamela/Smart-Student-Handbook-1/firebase-basic/components/ui/select", () => ({
  Select: ({ children, onValueChange, value }: any) => (
    <select onChange={(e) => onValueChange && onValueChange(e.target.value)} value={value}>
      {children}
    </select>
  ),
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ children, value }: any) => <option value={value}>{children}</option>,
  SelectTrigger: ({ children, className }: any) => <div className={className}>{children}</div>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
}))
jest.mock("lucide-react", () => ({
  TrendingUp: () => <svg data-testid="trending-up" />,
  Clock: () => <svg data-testid="clock" />,
  BookOpen: () => <svg data-testid="book-open" />,
  Calendar: () => <svg data-testid="calendar" />,
}))

// Style hook: useSessionSeconds
let sessionSecondsMock = 0
jest.mock("/Users/mpumenjamela/Smart-Student-Handbook-1/firebase-basic/components/providers/SessionTimerProvider", () => ({
  useSessionSeconds: () => sessionSecondsMock,
}))

// Helper to set currentUser for tests
function setCurrentUser(user: any) {
  const auth = require('firebase/auth')
  auth.getAuth().currentUser = user
}

// Helper to mock onValue for database listeners
describe('ProfilePage() ProfilePage method', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks()
    sessionSecondsMock = 0
    setCurrentUser({
      uid: 'test-uid',
      email: 'user@example.com',
    })
    onValueMock.mockImplementation((ref: any, cb: any) => {
      // Simulate DB listeners for settings, metrics, notes
      if (ref.includes && ref.includes('UserSettings')) {
        cb({
          val: () => ({
            name: 'John',
            surname: 'Doe',
            degree: 'CS',
            occupation: 'Student',
            hobbies: ['Reading', 'Coding'],
            description: 'Hello world',
          }),
        })
      } else if (ref.includes && ref.includes('metrics')) {
        cb({
          val: () => ({
            totalStudyHours: 10,
            thisWeekHours: 5,
            notesCreated: 3,
            studyStreak: 2,
            lastUpdated: new Date().toISOString(),
          }),
        })
      } else if (ref.includes && ref.includes('notes')) {
        cb({
          val: () => ({
            note1: {},
            note2: {},
            note3: {},
          }),
        })
      }
    })
  })

  // Happy Path Tests
  describe('Happy Paths', () => {
    test('renders all main sections and metrics for a logged-in user', () => {
      // This test ensures the ProfilePage renders all main UI sections and metrics for a logged-in user.
      render(<ProfilePage />)
      expect(screen.getByText('Settings')).toBeInTheDocument()
      expect(screen.getByText('Manage your account information, security, and preferences.')).toBeInTheDocument()
      expect(screen.getByText('Account Settings')).toBeInTheDocument()
      expect(screen.getByText('Security')).toBeInTheDocument()
      expect(screen.getByText('Profile Information')).toBeInTheDocument()
      expect(screen.getByText('Change Password')).toBeInTheDocument()
      expect(screen.getByText('Total Study Hours')).toBeInTheDocument()
      expect(screen.getByText('Notes Created')).toBeInTheDocument()
      expect(screen.getByText('Study Streak')).toBeInTheDocument()
      expect(screen.getByText('This Week')).toBeInTheDocument()
      // Metrics values
      expect(screen.getByText('10.0')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
      expect(screen.getByText('2 days')).toBeInTheDocument()
      expect(screen.getByText('5.0h')).toBeInTheDocument()
    })

    test('loads and displays user profile data from database', () => {
      // This test verifies that user profile data is loaded and displayed correctly from the database.
      render(<ProfilePage />)
      expect(screen.getByLabelText('First Name')).toHaveValue('John')
      expect(screen.getByLabelText('Last Name')).toHaveValue('Doe')
      expect(screen.getByLabelText('Degree Program')).toHaveValue('CS')
      expect(screen.getByLabelText('Occupation')).toHaveValue('Student')
      expect(screen.getByLabelText('Interests & Hobbies')).toHaveValue('Reading, Coding')
      expect(screen.getByLabelText('Bio')).toHaveValue('Hello world')
    })

    test('allows editing and saving profile data', async () => {
      // This test checks that the user can edit and save their profile data, and that the saveUserSettings utility is called.
      render(<ProfilePage />)
      fireEvent.change(screen.getByLabelText('First Name'), { target: { value: 'Jane' } })
      fireEvent.change(screen.getByLabelText('Interests & Hobbies'), { target: { value: 'Reading, Coding, Hiking' } })
      const saveButton = screen.getByText('Save Changes')
      expect(saveButton).not.toBeDisabled()
      await act(async () => {
        fireEvent.click(saveButton)
      })
      expect(require("/Users/mpumenjamela/Smart-Student-Handbook-1/firebase-basic/utils/SaveUserSettings").saveUserSettings).toHaveBeenCalledWith('test-uid', expect.objectContaining({
        name: 'Jane',
        hobbies: ['Reading', 'Coding', 'Hiking'],
      }))
      expect(require('sonner').toast.success).toHaveBeenCalledWith('Your settings have been saved.')
    })

    test('shows info toast when saving with no changes', async () => {
      // This test ensures that saving without changes shows an info toast.
      render(<ProfilePage />)
      const saveButton = screen.getByText('Save Changes')
      await act(async () => {
        fireEvent.click(saveButton)
      })
      expect(require('sonner').toast.info).toHaveBeenCalledWith('No changes to save.')
    })

    test('password change: successful update', async () => {
      // This test verifies that a successful password update triggers the correct calls and success toast.
      const { getByLabelText, getByText } = render(<ProfilePage />)
      fireEvent.click(getByText('Security')) // Switch to password tab
      fireEvent.change(getByLabelText('Current Password'), { target: { value: 'oldpass' } })
      fireEvent.change(getByLabelText('New Password'), { target: { value: 'newpass123' } })
      fireEvent.change(getByLabelText('Confirm New Password'), { target: { value: 'newpass123' } })
      const updateButton = getByText('Update Password')
      expect(updateButton).not.toBeDisabled()
      const reauth = require("firebase/auth").reauthenticateWithCredential
      const updatePw = require("firebase/auth").updatePassword
      reauth.mockResolvedValueOnce({})
      updatePw.mockResolvedValueOnce({})
      await act(async () => {
        fireEvent.click(updateButton)
      })
      expect(reauth).toHaveBeenCalled()
      expect(updatePw).toHaveBeenCalled()
      expect(require('sonner').toast.success).toHaveBeenCalledWith('Password updated successfully.')
    })

    test('metrics update live with sessionSeconds', () => {
      // This test checks that metrics update live when sessionSeconds changes.
      sessionSecondsMock = 3600 // 1 hour
      render(<ProfilePage />)
      expect(screen.getByText('11.0')).toBeInTheDocument() // totalStudyHours: 10 + 1
      expect(screen.getByText('6.0h')).toBeInTheDocument() // thisWeekHours: 5 + 1
    })
  })

  // Edge Case Tests
  describe('Edge Cases', () => {
    test('renders default values when logged out', () => {
      // This test ensures that when the user is logged out, default values are rendered.
      setCurrentUser(null)
      onValueMock.mockImplementation(() => {})
      render(<ProfilePage />)
      expect(screen.getByLabelText('First Name')).toHaveValue('')
      expect(screen.getByLabelText('Last Name')).toHaveValue('')
      expect(screen.getByLabelText('Degree Program')).toHaveValue('')
      expect(screen.getByLabelText('Occupation')).toHaveValue('')
      expect(screen.getByLabelText('Interests & Hobbies')).toHaveValue('')
      expect(screen.getByLabelText('Bio')).toHaveValue('')
      expect(screen.getByText('0.0')).toBeInTheDocument()
      expect(screen.getByText('0')).toBeInTheDocument()
      expect(screen.getByText('0 days')).toBeInTheDocument()
      expect(screen.getByText('0.0h')).toBeInTheDocument()
      expect(screen.getByText('Save Changes')).toBeDisabled()
    })

    test('password change: missing fields', async () => {
      // This test checks that missing password fields show an error toast.
      render(<ProfilePage />)
      fireEvent.click(screen.getByText('Security'))
      const updateButton = screen.getByText('Update Password')
      await act(async () => {
        fireEvent.click(updateButton)
      })
      expect(require('sonner').toast.error).toHaveBeenCalledWith('Please fill in all password fields.')
    })

    test('password change: new password and confirmation do not match', async () => {
      // This test ensures that mismatched new password and confirmation shows an error toast.
      render(<ProfilePage />)
      fireEvent.click(screen.getByText('Security'))
      fireEvent.change(screen.getByLabelText('Current Password'), { target: { value: 'oldpass' } })
      fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'newpass123' } })
      fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: 'wrongpass' } })
      const updateButton = screen.getByText('Update Password')
      expect(updateButton).toBeDisabled()
      fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: 'wrongpass' } })
      await act(async () => {
        fireEvent.click(updateButton)
      })
      expect(require('sonner').toast.error).toHaveBeenCalledWith('New password and confirmation do not match.')
      expect(screen.getByText('Passwords do not match.')).toBeInTheDocument()
    })

    test('password change: new password same as current', async () => {
      // This test checks that using the same password for new and current shows an error toast.
      render(<ProfilePage />)
      fireEvent.click(screen.getByText('Security'))
      fireEvent.change(screen.getByLabelText('Current Password'), { target: { value: 'samepass' } })
      fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'samepass' } })
      fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: 'samepass' } })
      const updateButton = screen.getByText('Update Password')
      await act(async () => {
        fireEvent.click(updateButton)
      })
      expect(require('sonner').toast.error).toHaveBeenCalledWith('New password cannot be the same as your current password.')
    })

    test('password change: no email on user', async () => {
      // This test ensures that if the user has no email, an error toast is shown.
      setCurrentUser({ uid: 'test-uid', email: undefined })
      render(<ProfilePage />)
      fireEvent.click(screen.getByText('Security'))
      fireEvent.change(screen.getByLabelText('Current Password'), { target: { value: 'oldpass' } })
      fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'newpass123' } })
      fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: 'newpass123' } })
      const updateButton = screen.getByText('Update Password')
      await act(async () => {
        fireEvent.click(updateButton)
      })
      expect(require('sonner').toast.error).toHaveBeenCalledWith('Your account has no email. Please re-login and try again.')
    })

    test('password change: error conditions from Firebase', async () => {
      // This test verifies that specific Firebase error codes show the correct error toast.
      render(<ProfilePage />)
      fireEvent.click(screen.getByText('Security'))
      fireEvent.change(screen.getByLabelText('Current Password'), { target: { value: 'oldpass' } })
      fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'newpass123' } })
      fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: 'newpass123' } })
      const updateButton = screen.getByText('Update Password')
      const reauth = require("firebase/auth").reauthenticateWithCredential
      const updatePw = require("firebase/auth").updatePassword

      // wrong-password
      reauth.mockRejectedValueOnce({ code: 'auth/wrong-password' })
      await act(async () => {
        fireEvent.click(updateButton)
      })
      expect(require('sonner').toast.error).toHaveBeenCalledWith('Your current password is incorrect.')

      // weak-password
      reauth.mockResolvedValueOnce({})
      updatePw.mockRejectedValueOnce({ code: 'auth/weak-password' })
      await act(async () => {
        fireEvent.click(updateButton)
      })
      expect(require('sonner').toast.error).toHaveBeenCalledWith('New password is too weak.')

      // too-many-requests
      reauth.mockResolvedValueOnce({})
      updatePw.mockRejectedValueOnce({ code: 'auth/too-many-requests' })
      await act(async () => {
        fireEvent.click(updateButton)
      })
      expect(require('sonner').toast.error).toHaveBeenCalledWith('Too many attempts. Please wait.')

      // requires-recent-login
      reauth.mockResolvedValueOnce({})
      updatePw.mockRejectedValueOnce({ code: 'auth/requires-recent-login' })
      await act(async () => {
        fireEvent.click(updateButton)
      })
      expect(require('sonner').toast.error).toHaveBeenCalledWith('Please log out and try again.')

      // generic error
      reauth.mockResolvedValueOnce({})
      updatePw.mockRejectedValueOnce({ code: 'other-error' })
      await act(async () => {
        fireEvent.click(updateButton)
      })
      expect(require('sonner').toast.error).toHaveBeenCalledWith('Failed to update password.')
    })

    test('hobbies field: trims and dedupes empty values on save', async () => {
      // This test checks that the hobbies field is trimmed and empty values are removed before saving.
      render(<ProfilePage />)
      fireEvent.change(screen.getByLabelText('Interests & Hobbies'), { target: { value: '  Reading, , Coding,  , ' } })
      const saveButton = screen.getByText('Save Changes')
      await act(async () => {
        fireEvent.click(saveButton)
      })
      expect(require("/Users/mpumenjamela/Smart-Student-Handbook-1/firebase-basic/utils/SaveUserSettings").saveUserSettings).toHaveBeenCalledWith('test-uid', expect.objectContaining({
        hobbies: ['Reading', 'Coding'],
      }))
    })

    test('notes count: handles empty notes object', () => {
      // This test ensures that notes count is zero when notes object is empty.
      onValueMock.mockImplementation((ref: any, cb: any) => {
        if (ref.includes && ref.includes('notes')) {
          cb({ val: () => ({}) })
        } else if (ref.includes && ref.includes('UserSettings')) {
          cb({
            val: () => ({
              name: '',
              surname: '',
              degree: '',
              occupation: '',
              hobbies: '',
              description: '',
            }),
          })
        } else if (ref.includes && ref.includes('metrics')) {
          cb({
            val: () => ({
              totalStudyHours: 0,
              thisWeekHours: 0,
              notesCreated: 0,
              studyStreak: 0,
              lastUpdated: new Date().toISOString(),
            }),
          })
        }
      })
      render(<ProfilePage />)
      expect(screen.getByText('0')).toBeInTheDocument()
    })
  })
})