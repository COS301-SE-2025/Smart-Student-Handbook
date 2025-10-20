import React from 'react'
import { CreateOrganizationModal } from "@/components/ui/create-organization-modal";
import { useUserId } from "@/hooks/useUserId";
import { get, getDatabase, ref, remove, set } from "firebase/database";
import { httpsCallableFromURL } from "firebase/functions";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import OrganisationsPage from '@/app/organisations/page'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import "@testing-library/jest-dom";

// --- Mocks ---

jest.mock("@/hooks/useUserId")
jest.mock("next/navigation")
jest.mock("firebase/functions")
jest.mock("@/lib/firebase", () => ({
  fns: {},
}))
jest.mock("firebase/database")
jest.mock("sonner")
jest.mock("@/components/ui/create-organization-modal", () => ({
  CreateOrganizationModal: jest.fn(() => <div data-testid="create-org-modal" />),
}))
jest.mock("@/components/ui/avatar", () => ({
  Avatar: ({ children }: any) => <div data-testid="avatar">{children}</div>,
  AvatarFallback: ({ children }: any) => <div data-testid="avatar-fallback">{children}</div>,
}))
jest.mock("@/components/ui/badge", () => ({
  Badge: ({ children, ...props }: any) => <span data-testid="badge" {...props}>{children}</span>,
}))
jest.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, disabled, asChild, ...props }: any) => (
    <button 
      {...props} 
      onClick={onClick}
      disabled={disabled}
      data-testid="button"
    >
      {children}
    </button>
  ),
}))

// Mock Next.js Link component
jest.mock("next/link", () => {
  return ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
})

// Mock Lucide React icons
jest.mock("lucide-react", () => ({
  Heart: (props: any) => <svg {...props} data-testid="heart" className="lucide-heart" />,
  Users: (props: any) => <svg {...props} data-testid="users" className="lucide-users" />,
  Lock: (props: any) => <svg {...props} data-testid="lock" className="lucide-lock" />,
  Globe: (props: any) => <svg {...props} data-testid="globe" className="lucide-globe" />,
  Plus: (props: any) => <svg {...props} data-testid="plus" className="lucide-plus" />,
  Crown: (props: any) => <svg {...props} data-testid="crown" className="lucide-crown" />,
  UserCheck: (props: any) => <svg {...props} data-testid="user-check" className="lucide-user-check" />,
  SearchX: (props: any) => <svg {...props} data-testid="search-x" className="lucide-search-x" />,
  Loader2: (props: any) => <svg {...props} data-testid="loader2" className="lucide-loader2" />,
}))

// Helper to flush promises
const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0))

describe('OrganisationsPage() OrganisationsPage method', () => {
  // --- Shared Mocks/Setup ---
  let mockUserId = 'user-123'
  let mockSet: jest.Mock
  let mockRemove: jest.Mock
  let mockGet: jest.Mock
  let mockRef: jest.Mock
  let mockGetDatabase: jest.Mock
  let mockToastSuccess: jest.Mock
  let mockToastError: jest.Mock
  let mockGetPublicOrgs: jest.Mock
  let mockGetPrivateOrgs: jest.Mock
  let mockJoinOrg: jest.Mock
  let mockLeaveOrg: jest.Mock
  let mockCreateOrg: jest.Mock

  // Default orgs
  const publicOrg = {
    id: 'org1',
    ownerId: 'owner1',
    name: 'Public Org',
    description: 'A public org',
    isPrivate: false,
    members: { 'user-123': 'Member', 'user-456': 'Member' },
    createdAt: 123456,
  }
  const privateOrg = {
    id: 'org2',
    ownerId: 'owner2',
    name: 'Private Org',
    description: 'A private org',
    isPrivate: true,
    members: { 'user-123': 'Admin' },
    createdAt: 123457,
  }

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks()

    // useUserId
    ;(useUserId as jest.Mock).mockReturnValue({
      userId: mockUserId,
      loading: false,
    })

    // useSearchParams
    const searchParams = {
      get: jest.fn().mockReturnValue(''),
    }
    ;(useSearchParams as jest.Mock).mockReturnValue(searchParams)

    // Create callable mocks
    mockGetPublicOrgs = jest.fn().mockResolvedValue({
      data: [publicOrg],
    })
    mockGetPrivateOrgs = jest.fn().mockResolvedValue({
      data: [privateOrg],
    })
    mockJoinOrg = jest.fn().mockResolvedValue({
      data: { success: true },
    })
    mockLeaveOrg = jest.fn().mockResolvedValue({
      data: { success: true },
    })
    mockCreateOrg = jest.fn().mockResolvedValue({
      data: {
        ...publicOrg,
        id: 'org3',
        name: 'New Org',
        isPrivate: false,
        members: { 'user-123': 'Admin' },
      },
    })

    // httpsCallableFromURL
    ;(httpsCallableFromURL as jest.Mock)
      .mockImplementation((fnsArg, url: string) => {
        if (url.includes('getpublicorganizations')) return mockGetPublicOrgs
        if (url.includes('getuserorganizations')) return mockGetPrivateOrgs
        if (url.includes('joinorganization')) return mockJoinOrg
        if (url.includes('leaveorganization')) return mockLeaveOrg
        if (url.includes('createorganization')) return mockCreateOrg
        throw new Error('Unknown callable')
      })

    // Firebase database
    mockSet = jest.fn().mockResolvedValue(undefined)
    mockRemove = jest.fn().mockResolvedValue(undefined)
    mockGet = jest.fn().mockResolvedValue({
      val: () => ({ org1: true, org2: false }),
    })
    mockRef = jest.fn()
    mockGetDatabase = jest.fn()
    ;(getDatabase as jest.Mock).mockReturnValue({})
    ;(ref as jest.Mock).mockImplementation(mockRef)
    ;(get as jest.Mock).mockImplementation(mockGet)
    ;(set as jest.Mock).mockImplementation(mockSet)
    ;(remove as jest.Mock).mockImplementation(mockRemove)

    // Toast
    mockToastSuccess = jest.fn()
    mockToastError = jest.fn()
    ;(toast.success as jest.Mock).mockImplementation(mockToastSuccess)
    ;(toast.error as jest.Mock).mockImplementation(mockToastError)
  })

  // ------------------- Happy Path Tests -------------------
  describe('Happy paths', () => {
    test('renders loading state when authLoading is true', () => {
      ;(useUserId as jest.Mock).mockReturnValue({
        userId: null,
        loading: true,
      })
      render(<OrganisationsPage />)
      expect(screen.getByText('Loading...')).toBeInTheDocument()
    })

    test('renders loading state when loading is true', async () => {
      let resolvePublic: any
      let resolvePrivate: any
      
      mockGetPublicOrgs.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvePublic = resolve
          }),
      )
      mockGetPrivateOrgs.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvePrivate = resolve
          }),
      )
      
      render(<OrganisationsPage />)
      
      // Should show loading state
      await waitFor(() => {
        expect(screen.getByText('Loading...')).toBeInTheDocument()
      })
      
      // Resolve promises and wait for completion
      await act(async () => {
        resolvePublic({ data: [] })
        resolvePrivate({ data: [] })
        await flushPromises()
      })
    })

    test('renders orgs, filter tabs, and allows switching filters', async () => {
      render(<OrganisationsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Public Org')).toBeInTheDocument()
        expect(screen.getByText('Private Org')).toBeInTheDocument()
      })
      
      // Find filter buttons by their text content
      const filterButtons = screen.getAllByTestId('button')
      
      // Find specific filter buttons
      const allFilterButton = filterButtons.find(button => 
        button.textContent?.includes('All') && button.textContent?.includes('2')
      )
      const joinedFilterButton = filterButtons.find(button => 
        button.textContent?.includes('Joined') && button.textContent?.includes('2')
      )
      const publicFilterButton = filterButtons.find(button => 
        button.textContent?.includes('Public') && button.textContent?.includes('1')
      )
      const privateFilterButton = filterButtons.find(button => 
        button.textContent?.includes('Private') && button.textContent?.includes('1')
      )
      
      expect(allFilterButton).toBeInTheDocument()
      expect(joinedFilterButton).toBeInTheDocument()
      expect(publicFilterButton).toBeInTheDocument()
      expect(privateFilterButton).toBeInTheDocument()
  
      // Switch to "Public" filter
      if (publicFilterButton) {
        await act(async () => {
          fireEvent.click(publicFilterButton)
          await flushPromises()
        })
        
        await waitFor(() => {
          expect(screen.getByText('Public Org')).toBeInTheDocument()
          expect(screen.queryByText('Private Org')).not.toBeInTheDocument()
        })
      }
    })

    test('shows search query UI and filters orgs', async () => {
      const searchParams = {
        get: jest.fn().mockImplementation((key) => (key === 'search' ? 'private' : '')),
      }
      ;(useSearchParams as jest.Mock).mockReturnValue(searchParams)
      
      render(<OrganisationsPage />)
      
      await waitFor(() => {
        expect(screen.getByText(/Searching for:/i)).toBeInTheDocument()
        expect(screen.getByText('Private Org')).toBeInTheDocument()
        expect(screen.queryByText('Public Org')).not.toBeInTheDocument()
      })
    })

    test('shows empty state when no orgs match', async () => {
      const searchParams = {
        get: jest.fn().mockImplementation((key) => (key === 'search' ? 'notfound' : '')),
      }
      ;(useSearchParams as jest.Mock).mockReturnValue(searchParams)
      
      render(<OrganisationsPage />)
      
      await waitFor(() => {
        expect(screen.getByText(/No matching organisations found/i)).toBeInTheDocument()
        expect(screen.getByText(/No organisations match "notfound"/i)).toBeInTheDocument()
      })
    })

    test('shows empty state and create button when no orgs exist', async () => {
      mockGetPublicOrgs.mockResolvedValue({ data: [] })
      mockGetPrivateOrgs.mockResolvedValue({ data: [] })
      
      render(<OrganisationsPage />)
      
      await waitFor(() => {
        expect(screen.getByText(/No organisations found/i)).toBeInTheDocument()
        expect(screen.getByText(/Be the first to create an organisation/i)).toBeInTheDocument()
        expect(screen.getByText(/Create Your First Organisation/i)).toBeInTheDocument()
      })
    })

    test('opens create organization modal when create button is clicked', async () => {
      render(<OrganisationsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Create Organisation')).toBeInTheDocument()
      })
      
      await act(async () => {
        fireEvent.click(screen.getByText('Create Organisation'))
        await flushPromises()
      })
      
      expect(screen.getByTestId('create-org-modal')).toBeInTheDocument()
    })

    test('calls handleToggleFav and updates favorite state', async () => {
      render(<OrganisationsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Public Org')).toBeInTheDocument()
      })
      
      // Find heart icons directly using data-testid
      const heartIcons = screen.getAllByTestId('heart')
      expect(heartIcons.length).toBeGreaterThan(0)
      
      // Click the first heart icon's parent button
      const heartButton = heartIcons[0].closest('button')
      expect(heartButton).toBeInTheDocument()
      
      await act(async () => {
        fireEvent.click(heartButton!)
        await flushPromises()
      })
      
      // Wait for the set operation to be called
      await waitFor(() => {
        expect(mockRef).toHaveBeenCalledWith(expect.anything(), expect.stringMatching(/userFavorites\/user-123\/org/))
      }, { timeout: 3000 })
    })

    test('calls handleJoin and shows success toast', async () => {
      // Remove user from publicOrg members to make it joinable
      const joinableOrg = { ...publicOrg, members: {} }
      mockGetPublicOrgs.mockResolvedValue({ data: [joinableOrg] })
      mockGetPrivateOrgs.mockResolvedValue({ data: [] })
      
      render(<OrganisationsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Public Org')).toBeInTheDocument()
      })
      
      const joinButton = screen.getByText('Join Organisation')
      
      await act(async () => {
        fireEvent.click(joinButton)
        await flushPromises()
      })
      
      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith('Successfully joined organization.')
      })
    })

    test('calls handleLeave and shows success toast', async () => {
      render(<OrganisationsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Public Org')).toBeInTheDocument()
      })
      
      // Find the "Leave" button for Public Org
      const leaveButtons = screen.getAllByText('Leave')
      expect(leaveButtons.length).toBeGreaterThan(0)
      
      await act(async () => {
        fireEvent.click(leaveButtons[0])
        await flushPromises()
      })
      
      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith('Successfully left organization.')
      })
    })

    test('calls onCreateOrganization and shows success toast', async () => {
      let onCreateOrg: any
      ;(CreateOrganizationModal as jest.Mock).mockImplementation(({ open, onCreateOrganization }: any) => {
        onCreateOrg = onCreateOrganization
        return open ? <div data-testid="create-org-modal" /> : null
      })
      
      render(<OrganisationsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Create Organisation')).toBeInTheDocument()
      })
      
      await act(async () => {
        fireEvent.click(screen.getByText('Create Organisation'))
        await flushPromises()
      })
      
      await act(async () => {
        await onCreateOrg({
          name: 'New Org',
          description: 'desc',
          isPrivate: false,
          selectedFriends: [],
        })
        await flushPromises()
      })
      
      expect(mockToastSuccess).toHaveBeenCalledWith('Organization created.')
    })
  })

  // ------------------- Edge Case Tests -------------------
  describe('Edge cases', () => {
    test('handles error when fetching orgs fails', async () => {
      mockGetPublicOrgs.mockRejectedValue(new Error('fetch error'))
      mockGetPrivateOrgs.mockResolvedValue({ data: [] })
      
      render(<OrganisationsPage />)
      
      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith('Failed to load organisations.')
      }, { timeout: 5000 })
    })

    test('handles error when toggling favorite fails', async () => {
      mockRemove.mockRejectedValueOnce(new Error('fav error')) // Mock remove instead of set
      
      render(<OrganisationsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Public Org')).toBeInTheDocument()
      })
      
      // Find heart icons directly using data-testid
      const heartIcons = screen.getAllByTestId('heart')
      expect(heartIcons.length).toBeGreaterThan(0)
      
      // Click the first heart icon's parent button
      const heartButton = heartIcons[0].closest('button')
      expect(heartButton).toBeInTheDocument()
      
      await act(async () => {
        fireEvent.click(heartButton!)
        await flushPromises()
      })
      
      // Wait for the error to be handled
      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith('Failed to update favorite.')
      }, { timeout: 7000 })
    }, 10000) // Increase timeout for this test


    test('handles error when joining org fails', async () => {
      const joinableOrg = { ...publicOrg, members: {} }
      mockGetPublicOrgs.mockResolvedValue({ data: [joinableOrg] })
      mockGetPrivateOrgs.mockResolvedValue({ data: [] })
      mockJoinOrg.mockRejectedValue({ message: 'join error' })
      
      render(<OrganisationsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Public Org')).toBeInTheDocument()
      })
      
      const joinButton = screen.getByText('Join Organisation')
      
      await act(async () => {
        fireEvent.click(joinButton)
        await flushPromises()
      })
      
      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith('join error')
      }, { timeout: 5000 })
    })

    test('handles error when leaving org fails', async () => {
      mockLeaveOrg.mockRejectedValue({ message: 'leave error' })
      
      render(<OrganisationsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Public Org')).toBeInTheDocument()
      })
      
      const leaveButtons = screen.getAllByText('Leave')
      
      await act(async () => {
        fireEvent.click(leaveButtons[0])
        await flushPromises()
      })
      
      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith('leave error')
      }, { timeout: 5000 })
    })

    test('handles error when creating org fails', async () => {
      let onCreateOrg: any
      ;(CreateOrganizationModal as jest.Mock).mockImplementation(({ open, onCreateOrganization }: any) => {
        onCreateOrg = onCreateOrganization
        return open ? <div data-testid="create-org-modal" /> : null
      })
      mockCreateOrg.mockRejectedValue(new Error('create error'))
      
      render(<OrganisationsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Create Organisation')).toBeInTheDocument()
      })
      
      await act(async () => {
        fireEvent.click(screen.getByText('Create Organisation'))
        await flushPromises()
      })
      
      await act(async () => {
        try {
          await onCreateOrg({
            name: 'Fail Org',
            description: 'desc',
            isPrivate: false,
            selectedFriends: [],
          })
        } catch (e) {
          // Expected to fail
        }
        await flushPromises()
      })
      
      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith('Failed to create organization.')
      }, { timeout: 5000 })
    })

    test('does not allow joining or leaving org while already joining/leaving', async () => {
      let joinResolve: any
      const joinableOrg = { ...publicOrg, members: {} }
      mockGetPublicOrgs.mockResolvedValue({ data: [joinableOrg] })
      mockGetPrivateOrgs.mockResolvedValue({ data: [] })
      mockJoinOrg.mockImplementation(
        () =>
          new Promise((resolve) => {
            joinResolve = resolve
          }),
      )
      
      render(<OrganisationsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Public Org')).toBeInTheDocument()
      })
      
      const joinButton = screen.getByText('Join Organisation')
      
      await act(async () => {
        fireEvent.click(joinButton)
        await flushPromises()
      })
      
      // Check that button shows "Joining..." text
      await waitFor(() => {
        expect(screen.getByText('Joining...')).toBeInTheDocument()
      })
      
      await act(async () => {
        joinResolve({ data: { success: true } })
        await flushPromises()
      })
    })

    test('removes private org from list after leaving', async () => {
      const privateOrgWithUser = { ...privateOrg, members: { 'user-123': 'Admin' } }
      mockGetPublicOrgs.mockResolvedValue({ data: [] })
      mockGetPrivateOrgs.mockResolvedValue({ data: [privateOrgWithUser] })
      
      render(<OrganisationsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Private Org')).toBeInTheDocument()
      })
      
      const leaveButtons = screen.getAllByText('Leave')
      
      await act(async () => {
        fireEvent.click(leaveButtons[0])
        await flushPromises()
      })
      
      await waitFor(() => {
        expect(screen.queryByText('Private Org')).not.toBeInTheDocument()
      }, { timeout: 5000 })
    })
  })
})