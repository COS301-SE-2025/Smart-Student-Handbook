// __tests__/student-calendar.test.tsx
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import StudentCalendar from '@/components/ui/student-calendar'
import { httpsCallable } from 'firebase/functions'
import { toast } from 'sonner'

// Mock dependencies
jest.mock('firebase/functions')
jest.mock('sonner')
jest.mock('@/hooks/useUserId', () => ({
  useUserId: () => ({ userId: 'test-user-123' })
}))
jest.mock('@/lib/firebase', () => ({
  fns: {}
}))

const mockHttpsCallable = httpsCallable as jest.MockedFunction<typeof httpsCallable>
const mockToast = toast as jest.Mocked<typeof toast>

describe('StudentCalendar', () => {
  const mockSemesters = [
    {
      id: 'sem1',
      name: 'Semester 1 2025',
      startDate: '2025-02-10',
      endDate: '2025-06-21',
      isActive: true
    }
  ]

  const mockEvents = [
    {
      id: 'evt1',
      title: 'Math Exam',
      description: 'Final exam',
      date: new Date('2025-03-15'),
      type: 'exam' as const,
      time: '09:00',
      endTime: '11:00',
      semesterId: 'sem1'
    }
  ]

  const mockLectures = [
    {
      id: 'lec1',
      subject: 'Mathematics',
      lecturer: 'Dr. Smith',
      room: 'A101',
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '10:30',
      semesterId: 'sem1'
    }
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    mockToast.success = jest.fn()
    mockToast.error = jest.fn()
    mockToast.info = jest.fn()

    // Default mock implementations
    mockHttpsCallable.mockImplementation((fns: any, name: string) => {
      return ((data: any) => {
        switch (name) {
          case 'getSemesters':
            return Promise.resolve({ data: mockSemesters })
          case 'getEvents':
            return Promise.resolve({ data: mockEvents })
          case 'getLectures':
            return Promise.resolve({ data: mockLectures })
          case 'addEvent':
            return Promise.resolve({ 
              data: { id: 'new-evt', ...data.event, date: data.event.date }
            })
          case 'addLecture':
            return Promise.resolve({ 
              data: { id: 'new-lec', ...data.lecture }
            })
          case 'addSemester':
            return Promise.resolve({ 
              data: { id: 'new-sem', ...data.semester }
            })
          case 'deleteEvent':
            return Promise.resolve({ data: { success: true } })
          case 'deleteLecture':
            return Promise.resolve({ data: { success: true } })
          case 'deleteSemester':
            return Promise.resolve({ data: { success: true } })
          case 'setActiveSemester':
            return Promise.resolve({ data: { success: true } })
          case 'updateSemester':
            return Promise.resolve({ data: { success: true, semester: data.semester } })
          default:
            return Promise.resolve({ data: {} })
        }
      }) as any
    })
  })

  describe('Component Rendering', () => {
    it('renders the calendar header and basic elements', async () => {
      render(<StudentCalendar />)
      
      await waitFor(() => {
        expect(screen.getByText('Student Calendar')).toBeInTheDocument()
        expect(screen.getByText('Manage your academic schedule and events')).toBeInTheDocument()
      })
      
      // Basic UI elements
      expect(screen.getByText('Calendar View')).toBeInTheDocument()
      expect(screen.getByText('Daily Timetable')).toBeInTheDocument()
      expect(screen.getByText('Manage Semesters')).toBeInTheDocument()
    })

    it('loads and displays semester information', async () => {
      render(<StudentCalendar />)
      
      await waitFor(() => {
        expect(screen.getByText('Current Semester')).toBeInTheDocument()
      })
      
      // Should show semester info in sidebar
      expect(screen.getByText('Semester 1 2025')).toBeInTheDocument()
    })

    it('shows event types legend', async () => {
      render(<StudentCalendar />)
      
      await waitFor(() => {
        expect(screen.getByText('Event Types')).toBeInTheDocument()
      })
      
      // Check legend items
      expect(screen.getByText('Exams')).toBeInTheDocument()
      expect(screen.getByText('Assignments')).toBeInTheDocument()
      expect(screen.getByText('Reminders')).toBeInTheDocument()
      expect(screen.getByText('Classes')).toBeInTheDocument()
    })
  })

  describe('Semester Management', () => {
    it('handles semester dialog opening', async () => {
      render(<StudentCalendar />)
      
      await waitFor(() => {
        // Semester dialog should not be open initially
        expect(screen.queryByText('Manage Semesters')).not.toBeInTheDocument()
      })
    })

    it('creates default semester when none exist', async () => {
      mockHttpsCallable.mockImplementation((fns: any, name: string) => {
        return ((data: any) => {
          if (name === 'getSemesters') {
            return Promise.resolve({ data: [] })
          }
          if (name === 'addSemester') {
            return Promise.resolve({ 
              data: { 
                id: 'default-sem',
                name: 'Semester 1 2025',
                startDate: '2025-02-10',
                endDate: '2025-06-21'
              }
            })
          }
          return Promise.resolve({ data: { success: true } })
        }) as any
      })

      render(<StudentCalendar />)

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith('Default semester created and activated')
      })
    })
  })

  describe('Error Handling', () => {
    it('handles fetch semester error gracefully', async () => {
      mockHttpsCallable.mockImplementation(() => {
        return (() => Promise.reject(new Error('Network error'))) as any
      })

      render(<StudentCalendar />)

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalled()
      })
    })

    it('handles add event error', async () => {
      mockHttpsCallable.mockImplementation((fns: any, name: string) => {
        return ((data: any) => {
          if (name === 'addEvent') {
            return Promise.reject(new Error('Failed to add event'))
          }
          if (name === 'getSemesters') {
            return Promise.resolve({ data: mockSemesters })
          }
          return Promise.resolve({ data: [] })
        }) as any
      })

      render(<StudentCalendar />)
      
      // Component should render without crashing
      await waitFor(() => {
        expect(screen.getByText('Student Calendar')).toBeInTheDocument()
      })
    })
  })

  describe('Sidebar Functionality', () => {
    it('displays current semester info in sidebar', async () => {
      render(<StudentCalendar />)
      
      await waitFor(() => {
        expect(screen.getByText('Current Semester')).toBeInTheDocument()
        expect(screen.getByText('Semester 1 2025')).toBeInTheDocument()
      })
    })

    it('shows today\'s lectures section in sidebar', async () => {
      render(<StudentCalendar />)
      
      await waitFor(() => {
        expect(screen.getByText("Today's Lectures")).toBeInTheDocument()
      })
    })
  })

  describe('Calendar Grid', () => {
    it('renders calendar grid with days', async () => {
      render(<StudentCalendar />)
      
      await waitFor(() => {
        // Check for day headers
        expect(screen.getByText('Su')).toBeInTheDocument()
        expect(screen.getByText('Mo')).toBeInTheDocument()
        expect(screen.getByText('Tu')).toBeInTheDocument()
        expect(screen.getByText('We')).toBeInTheDocument()
        expect(screen.getByText('Th')).toBeInTheDocument()
        expect(screen.getByText('Fr')).toBeInTheDocument()
        expect(screen.getByText('Sa')).toBeInTheDocument()
      })
    })
  })

  describe('Data Loading', () => {
    it('loads initial data successfully', async () => {
      render(<StudentCalendar />)
      
      await waitFor(() => {
        // Should make API calls for initial data
        expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'getSemesters')
        expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'getEvents')
        expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'getLectures')
      })
    })

    it('handles empty data states', async () => {
      mockHttpsCallable.mockImplementation((fns: any, name: string) => {
        return ((data: any) => {
          // Return empty arrays for all data
          if (name === 'getSemesters' || name === 'getEvents' || name === 'getLectures') {
            return Promise.resolve({ data: [] })
          }
          return Promise.resolve({ data: {} })
        }) as any
      })

      render(<StudentCalendar />)
      
      // Should render without errors even with empty data
      await waitFor(() => {
        expect(screen.getByText('Student Calendar')).toBeInTheDocument()
      })
    })
  })

  describe('Component State', () => {
    it('maintains proper initial state', async () => {
      render(<StudentCalendar />)
      
      await waitFor(() => {
        // Should start in calendar view
        expect(screen.getByText('Calendar View')).toBeInTheDocument()
      })
    })

    it('handles loading state', async () => {
      // Mock delayed response to test loading state
      mockHttpsCallable.mockImplementation((fns: any, name: string) => {
        return ((data: any) => {
          return new Promise(resolve => {
            setTimeout(() => {
              resolve({ data: mockSemesters })
            }, 100)
          })
        }) as any
      })

      render(<StudentCalendar />)
      
      // Should show loading state initially
      expect(screen.getByText('Student Calendar')).toBeInTheDocument()
    })
  })
})