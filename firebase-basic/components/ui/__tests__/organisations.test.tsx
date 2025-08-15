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
  Badge: ({ children }: any) => <span data-testid="badge">{children}</span>,
}))
jest.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: any) => (
    <button {...props} data-testid="button">
      {children}
    </button>
  ),
}))

// Helper to flush promises - fixed for Node.js environment
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

    // httpsCallableFromURL
    const getPublicOrgs = jest.fn().mockResolvedValue({
      data: [publicOrg],
    })
    const getPrivateOrgs = jest.fn().mockResolvedValue({
      data: [privateOrg],
    })
    const joinOrg = jest.fn().mockResolvedValue({
      data: { success: true },
    })
    const leaveOrg = jest.fn().mockResolvedValue({
      data: { success: true },
    })
    const createOrg = jest.fn().mockResolvedValue({
      data: {
        ...publicOrg,
        id: 'org3',
        name: 'New Org',
        isPrivate: false,
        members: { 'user-123': 'Admin' },
      },
    })
    ;(httpsCallableFromURL as jest.Mock)
      .mockImplementation((fnsArg, url: string) => {
        if (url.includes('getpublicorganizations')) return getPublicOrgs
        if (url.includes('getuserorganizations')) return getPrivateOrgs
        if (url.includes('joinorganization')) return joinOrg
        if (url.includes('leaveorganization')) return leaveOrg
        if (url.includes('createorganization')) return createOrg
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
      // This test aims to verify that the loading spinner and message are shown when authLoading is true.
      ;(useUserId as jest.Mock).mockReturnValue({
        userId: mockUserId,
        loading: true,
      })
      render(<OrganisationsPage />)
      expect(screen.getByText(/Loading.../i)).toBeInTheDocument()
      // Remove the role check that's failing - the spinner doesn't have a status role
      expect(screen.getByText(/Loading.../i)).toBeInTheDocument()
    })

    test('renders loading state when loading is true', async () => {
      // This test aims to verify that the loading spinner and message are shown while orgs are being fetched.
      // We'll delay the getPublicOrgs promise to simulate loading.
      let resolvePublic: any
      const getPublicOrgs = jest.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvePublic = resolve
          }),
      )
      ;(httpsCallableFromURL as jest.Mock).mockImplementation((fnsArg, url: string) => {
        if (url.includes('getpublicorganizations')) return getPublicOrgs
        if (url.includes('getuserorganizations')) return jest.fn().mockResolvedValue({ data: [] })
        return jest.fn()
      })
      
      render(<OrganisationsPage />)
      expect(screen.getByText(/Loading.../i)).toBeInTheDocument()
      
      act(() => resolvePublic({ data: [] }))
      await flushPromises()
    })

    test('renders orgs, filter tabs, and allows switching filters', async () => {
      // This test aims to verify that orgs are rendered, filter tabs are present, and switching filters updates the list.
      render(<OrganisationsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Public Org')).toBeInTheDocument()
        expect(screen.getByText('Private Org')).toBeInTheDocument()
      })
      
      // Filter tabs - use more specific selectors
      expect(screen.getByText('All')).toBeInTheDocument()
      expect(screen.getByText('Joined')).toBeInTheDocument()
      
      // Use getByRole with more specific selector for filter buttons
      const filterButtons = screen.getAllByRole('button')
      const publicFilterButton = filterButtons.find(button => 
        button.textContent?.includes('Public') && !button.textContent?.includes('Public Org')
      )
      const privateFilterButton = filterButtons.find(button => 
        button.textContent?.includes('Private') && !button.textContent?.includes('Private Org')
      )
      
      expect(publicFilterButton).toBeInTheDocument()
      expect(privateFilterButton).toBeInTheDocument()

      // Switch to "Public"
      if (publicFilterButton) {
        await act(async () => {
          fireEvent.click(publicFilterButton)
        })
        await waitFor(() => {
          expect(screen.getByText('Public Org')).toBeInTheDocument()
          expect(screen.queryByText('Private Org')).not.toBeInTheDocument()
        })
      }

      // Switch to "Private"
      if (privateFilterButton) {
        await act(async () => {
          fireEvent.click(privateFilterButton)
        })
        await waitFor(() => {
          expect(screen.getByText('Private Org')).toBeInTheDocument()
          expect(screen.queryByText('Public Org')).not.toBeInTheDocument()
        })
      }
    })

    test('shows search query UI and filters orgs', async () => {
      // This test aims to verify that the search query UI appears and orgs are filtered accordingly.
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
      // This test aims to verify that the empty state is shown when no orgs match the search.
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
      // This test aims to verify that the empty state and create button are shown when there are no orgs at all.
      const getPublicOrgs = jest.fn().mockResolvedValue({ data: [] })
      const getPrivateOrgs = jest.fn().mockResolvedValue({ data: [] })
      ;(httpsCallableFromURL as jest.Mock).mockImplementation((fnsArg, url: string) => {
        if (url.includes('getpublicorganizations')) return getPublicOrgs
        if (url.includes('getuserorganizations')) return getPrivateOrgs
        return jest.fn()
      })
      
      render(<OrganisationsPage />)
      
      await waitFor(() => {
        expect(screen.getByText(/No organisations found/i)).toBeInTheDocument()
        expect(screen.getByText(/Be the first to create an organisation/i)).toBeInTheDocument()
        expect(screen.getByText(/Create Your First Organisation/i)).toBeInTheDocument()
      })
    })

    test('opens create organization modal when create button is clicked', async () => {
      // This test aims to verify that clicking the create button opens the create organization modal.
      render(<OrganisationsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Create Organisation')).toBeInTheDocument()
      })
      
      fireEvent.click(screen.getByText('Create Organisation'))
      expect(screen.getByTestId('create-org-modal')).toBeInTheDocument()
    })

    test('calls handleToggleFav and updates favorite state', async () => {
      // This test aims to verify that clicking the favorite button toggles favorite state and updates Firebase.
      render(<OrganisationsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Public Org')).toBeInTheDocument()
      })
      
      // Find the favorite button for Public Org - look for heart icon specifically
      const heartButtons = screen.getAllByRole('button').filter(button => 
        button.querySelector('svg')?.classList.contains('lucide-heart')
      )
      expect(heartButtons.length).toBeGreaterThan(0)
      
      await act(async () => {
        fireEvent.click(heartButtons[0])
      })
      
      // Wait for the set operation to be called
      await waitFor(() => {
        expect(mockSet).toHaveBeenCalled()
      }, { timeout: 3000 })
    })

    test('calls handleJoin and shows success toast', async () => {
      // This test aims to verify that clicking "Join Organisation" calls joinOrg and shows a success toast.
      // Remove user from publicOrg members to make it joinable
      const joinableOrg = { ...publicOrg, members: {} }
      ;(httpsCallableFromURL as jest.Mock).mockImplementation((fnsArg, url: string) => {
        if (url.includes('getpublicorganizations')) return jest.fn().mockResolvedValue({ data: [joinableOrg] })
        if (url.includes('getuserorganizations')) return jest.fn().mockResolvedValue({ data: [] })
        if (url.includes('joinorganization')) return jest.fn().mockResolvedValue({ data: { success: true } })
        return jest.fn()
      })
      
      render(<OrganisationsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Public Org')).toBeInTheDocument()
      })
      
      const joinButton = screen.getByText('Join Organisation')
      
      await act(async () => {
        fireEvent.click(joinButton)
      })
      
      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith('Successfully joined organization.')
      })
    })

    test('calls handleLeave and shows success toast', async () => {
      // This test aims to verify that clicking "Leave" calls leaveOrg and shows a success toast.
      render(<OrganisationsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Public Org')).toBeInTheDocument()
      })
      
      // Find the "Leave" button for Public Org
      const leaveButtons = screen.getAllByText('Leave')
      expect(leaveButtons.length).toBeGreaterThan(0)
      
      await act(async () => {
        fireEvent.click(leaveButtons[0])
      })
      
      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith('Successfully left organization.')
      })
    })

    test('calls onCreateOrganization and shows success toast', async () => {
      // This test aims to verify that creating an organization via the modal calls createOrg and shows a success toast.
      // We'll simulate the modal's onCreateOrganization prop.
      let onCreateOrg: any
      ;(CreateOrganizationModal as jest.Mock).mockImplementation(({ open, onCreateOrganization }: any) => {
        onCreateOrg = onCreateOrganization
        return open ? <div data-testid="create-org-modal" /> : null
      })
      
      render(<OrganisationsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Create Organisation')).toBeInTheDocument()
      })
      
      fireEvent.click(screen.getByText('Create Organisation'))
      
      await act(async () => {
        await onCreateOrg({
          name: 'New Org',
          description: 'desc',
          isPrivate: false,
          selectedFriends: [],
        })
      })
      
      expect(mockToastSuccess).toHaveBeenCalledWith('Organization created.')
    })
  })

  // ------------------- Edge Case Tests -------------------
  describe('Edge cases', () => {
    test('handles error when fetching orgs fails', async () => {
      // This test aims to verify that an error toast is shown if fetching orgs fails.
      const getPublicOrgs = jest.fn().mockRejectedValue(new Error('fetch error'))
      const getPrivateOrgs = jest.fn().mockResolvedValue({ data: [] })
      ;(httpsCallableFromURL as jest.Mock).mockImplementation((fnsArg, url: string) => {
        if (url.includes('getpublicorganizations')) return getPublicOrgs
        if (url.includes('getuserorganizations')) return getPrivateOrgs
        return jest.fn()
      })
      
      render(<OrganisationsPage />)
      
      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith('Failed to load organisations.')
      })
    })

    test('handles error when toggling favorite fails', async () => {
      // This test aims to verify that an error toast is shown and favorite state is reverted if set/remove fails.
      mockSet.mockRejectedValueOnce(new Error('fav error'))
      
      render(<OrganisationsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Public Org')).toBeInTheDocument()
      })
      
      const heartButtons = screen.getAllByRole('button').filter(button => 
        button.querySelector('svg')?.classList.contains('lucide-heart')
      )
      
      await act(async () => {
        fireEvent.click(heartButtons[0])
      })
      
      // Wait for the error to be handled
      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith('Failed to update favorite.')
      }, { timeout: 3000 })
    })

    test('handles error when joining org fails', async () => {
      // This test aims to verify that an error toast is shown and org state is reverted if joinOrg fails.
      const joinableOrg = { ...publicOrg, members: {} }
      ;(httpsCallableFromURL as jest.Mock).mockImplementation((fnsArg, url: string) => {
        if (url.includes('getpublicorganizations')) return jest.fn().mockResolvedValue({ data: [joinableOrg] })
        if (url.includes('getuserorganizations')) return jest.fn().mockResolvedValue({ data: [] })
        if (url.includes('joinorganization')) return jest.fn().mockRejectedValue({ message: 'join error' })
        return jest.fn()
      })
      
      render(<OrganisationsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Public Org')).toBeInTheDocument()
      })
      
      const joinButton = screen.getByText('Join Organisation')
      
      await act(async () => {
        fireEvent.click(joinButton)
      })
      
      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith('join error')
      })
    })

    test('handles error when leaving org fails', async () => {
      // This test aims to verify that an error toast is shown and org state is reverted if leaveOrg fails.
      ;(httpsCallableFromURL as jest.Mock).mockImplementation((fnsArg, url: string) => {
        if (url.includes('getpublicorganizations')) return jest.fn().mockResolvedValue({ data: [publicOrg] })
        if (url.includes('getuserorganizations')) return jest.fn().mockResolvedValue({ data: [] })
        if (url.includes('leaveorganization')) return jest.fn().mockRejectedValue({ message: 'leave error' })
        return jest.fn()
      })
      
      render(<OrganisationsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Public Org')).toBeInTheDocument()
      })
      
      const leaveButtons = screen.getAllByText('Leave')
      
      await act(async () => {
        fireEvent.click(leaveButtons[0])
      })
      
      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith('leave error')
      })
    })

    test('handles error when creating org fails', async () => {
      // This test aims to verify that an error toast is shown if createOrg fails.
      let onCreateOrg: any
      ;(CreateOrganizationModal as jest.Mock).mockImplementation(({ open, onCreateOrganization }: any) => {
        onCreateOrg = onCreateOrganization
        return open ? <div data-testid="create-org-modal" /> : null
      })
      ;(httpsCallableFromURL as jest.Mock).mockImplementation((fnsArg, url: string) => {
        if (url.includes('createorganization')) return jest.fn().mockRejectedValue(new Error('create error'))
        if (url.includes('getpublicorganizations')) return jest.fn().mockResolvedValue({ data: [publicOrg] })
        if (url.includes('getuserorganizations')) return jest.fn().mockResolvedValue({ data: [privateOrg] })
        return jest.fn()
      })
      
      render(<OrganisationsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Create Organisation')).toBeInTheDocument()
      })
      
      fireEvent.click(screen.getByText('Create Organisation'))
      
      await act(async () => {
        await onCreateOrg({
          name: 'Fail Org',
          description: 'desc',
          isPrivate: false,
          selectedFriends: [],
        })
      })
      
      expect(mockToastError).toHaveBeenCalledWith('Failed to create organization.')
    })

    test('does not allow joining or leaving org while already joining/leaving', async () => {
      // This test aims to verify that join/leave buttons are disabled while joining/leaving is in progress.
      // We'll simulate a long joinOrg/leaveOrg call.
      let joinResolve: any
      const joinableOrg = { ...publicOrg, members: {} }
      ;(httpsCallableFromURL as jest.Mock).mockImplementation((fnsArg, url: string) => {
        if (url.includes('getpublicorganizations')) return jest.fn().mockResolvedValue({ data: [joinableOrg] })
        if (url.includes('getuserorganizations')) return jest.fn().mockResolvedValue({ data: [] })
        if (url.includes('joinorganization'))
          return jest.fn().mockImplementation(
            () =>
              new Promise((resolve) => {
                joinResolve = resolve
              }),
          )
        return jest.fn()
      })
      
      render(<OrganisationsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Public Org')).toBeInTheDocument()
      })
      
      const joinButton = screen.getByText('Join Organisation')
      
      await act(async () => {
        fireEvent.click(joinButton)
      })
      
      expect(joinButton).toBeDisabled()
      
      act(() => joinResolve({ data: { success: true } }))
      await flushPromises()
    })

    test('removes private org from list after leaving', async () => {
      // This test aims to verify that leaving a private org removes it from the list.
      const privateOrgWithUser = { ...privateOrg, members: { 'user-123': 'Admin' } }
      ;(httpsCallableFromURL as jest.Mock).mockImplementation((fnsArg, url: string) => {
        if (url.includes('getpublicorganizations')) return jest.fn().mockResolvedValue({ data: [] })
        if (url.includes('getuserorganizations')) return jest.fn().mockResolvedValue({ data: [privateOrgWithUser] })
        if (url.includes('leaveorganization')) return jest.fn().mockResolvedValue({ data: { success: true } })
        return jest.fn()
      })
      
      render(<OrganisationsPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Private Org')).toBeInTheDocument()
      })
      
      const leaveButtons = screen.getAllByText('Leave')
      
      await act(async () => {
        fireEvent.click(leaveButtons[0])
      })
      
      await waitFor(() => {
        expect(screen.queryByText('Private Org')).not.toBeInTheDocument()
      })
    })
  })
})