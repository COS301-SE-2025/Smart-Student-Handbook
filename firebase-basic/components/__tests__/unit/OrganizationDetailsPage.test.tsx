import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { useParams, useRouter } from 'next/navigation'
import OrganizationDetailsPage from '@/app/organisations/[id]/page'
import { useUserId } from '@/hooks/useUserId'
import { httpsCallableFromURL } from 'firebase/functions'
import { getDatabase, ref, get, set, remove } from 'firebase/database'
import { toast } from 'sonner'

// Mock all dependencies
jest.mock('next/navigation')
jest.mock('@/hooks/useUserId')
jest.mock('firebase/functions')
jest.mock('firebase/database')
jest.mock('sonner')
jest.mock('@/lib/firebase', () => ({
  fns: {},
}))

describe('OrganizationDetailsPage', () => {
  const mockPush = jest.fn()
  const mockRouter = { push: mockPush }
  const mockOrgId = 'org123'
  const mockUserId = 'user123'

  const mockOrganization = {
    id: mockOrgId,
    ownerId: 'owner123',
    name: 'Test Organization',
    description: 'Test description',
    isPrivate: false,
    members: {
      [mockUserId]: 'Member' as const,
      owner123: 'Admin' as const,
    },
    createdAt: Date.now(),
    memberDetails: [
      {
        id: mockUserId,
        name: 'Test User',
        email: 'test@example.com',
        role: 'Member' as const,
        joinedAt: Date.now(),
      },
      {
        id: 'owner123',
        name: 'Owner User',
        email: 'owner@example.com',
        role: 'Admin' as const,
        joinedAt: Date.now() - 1000000,
      },
    ],
    activities: [],
    notes: [],
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useParams as jest.Mock).mockReturnValue({ id: mockOrgId })
    ;(useRouter as jest.Mock).mockReturnValue(mockRouter)
    ;(useUserId as jest.Mock).mockReturnValue({
      userId: mockUserId,
      loading: false,
    })
    ;(toast.success as jest.Mock).mockImplementation(() => {})
    ;(toast.error as jest.Mock).mockImplementation(() => {})
  })

  describe('Loading States', () => {
    it('should show loading spinner when auth is loading', () => {
      ;(useUserId as jest.Mock).mockReturnValue({
        userId: null,
        loading: true,
      })

      render(<OrganizationDetailsPage />)
      expect(screen.getByText(/loading organisation/i)).toBeInTheDocument()
    })

    it('should show loading spinner while fetching organization', () => {
      const mockGetOrgDetails = jest.fn().mockReturnValue(
        new Promise(() => {}) // Never resolves
      )
      ;(httpsCallableFromURL as jest.Mock).mockReturnValue(mockGetOrgDetails)

      render(<OrganizationDetailsPage />)
      expect(screen.getByText(/loading organisation/i)).toBeInTheDocument()
    })
  })

  describe('Error States', () => {
    it('should show error message when organization fetch fails', async () => {
      const mockGetOrgDetails = jest
        .fn()
        .mockRejectedValue(new Error('Failed to load'))
      ;(httpsCallableFromURL as jest.Mock).mockReturnValue(mockGetOrgDetails)
      ;(get as jest.Mock).mockResolvedValue({ exists: () => false, val: () => null })

      render(<OrganizationDetailsPage />)

      await waitFor(() => {
        expect(screen.getByText(/organisation not found/i)).toBeInTheDocument()
      })
    })

    it('should show back button on error', async () => {
      const mockGetOrgDetails = jest
        .fn()
        .mockRejectedValue(new Error('Failed to load'))
      ;(httpsCallableFromURL as jest.Mock).mockReturnValue(mockGetOrgDetails)
      ;(get as jest.Mock).mockResolvedValue({ exists: () => false, val: () => null })

      render(<OrganizationDetailsPage />)

      await waitFor(() => {
        const backButton = screen.getByRole('button', {
          name: /back to organisations/i,
        })
        expect(backButton).toBeInTheDocument()
        fireEvent.click(backButton)
        expect(mockPush).toHaveBeenCalledWith('/organisations')
      })
    })
  })

  describe('Organization Display', () => {
    beforeEach(() => {
      const mockGetOrgDetails = jest.fn().mockResolvedValue({
        data: mockOrganization,
      })
      ;(httpsCallableFromURL as jest.Mock).mockReturnValue(mockGetOrgDetails)
      ;(get as jest.Mock).mockResolvedValue({
        exists: () => false,
        val: () => null,
      })
      ;(getDatabase as jest.Mock).mockReturnValue({})
    })

    it('should display organization name and description', async () => {
      render(<OrganizationDetailsPage />)

      await waitFor(() => {
        expect(screen.getByText('Test Organization')).toBeInTheDocument()
        expect(screen.getByText('Test description')).toBeInTheDocument()
      })
    })

    it('should display member count badge', async () => {
      render(<OrganizationDetailsPage />)

      await waitFor(() => {
        expect(screen.getByText(/2 members/i)).toBeInTheDocument()
      })
    })

    it('should display privacy badge for public organization', async () => {
      render(<OrganizationDetailsPage />)

      await waitFor(() => {
        expect(screen.getByText('Public')).toBeInTheDocument()
      })
    })

    it('should display privacy badge for private organization', async () => {
      const privateOrg = { ...mockOrganization, isPrivate: true }
      const mockGetOrgDetails = jest.fn().mockResolvedValue({ data: privateOrg })
      ;(httpsCallableFromURL as jest.Mock).mockReturnValue(mockGetOrgDetails)

      render(<OrganizationDetailsPage />)

      await waitFor(() => {
        expect(screen.getByText('Private')).toBeInTheDocument()
      })
    })

    it('should display member role badge', async () => {
      render(<OrganizationDetailsPage />)

      await waitFor(() => {
        expect(screen.getByText('Member')).toBeInTheDocument()
      })
    })

    it('should display admin role badge for admin users', async () => {
      const adminOrg = {
        ...mockOrganization,
        members: { ...mockOrganization.members, [mockUserId]: 'Admin' as const },
      }
      const mockGetOrgDetails = jest.fn().mockResolvedValue({ data: adminOrg })
      ;(httpsCallableFromURL as jest.Mock).mockReturnValue(mockGetOrgDetails)

      render(<OrganizationDetailsPage />)

      await waitFor(() => {
        expect(screen.getByText('Admin')).toBeInTheDocument()
      })
    })
  })

  describe('Favorite Functionality', () => {
    beforeEach(() => {
      const mockGetOrgDetails = jest.fn().mockResolvedValue({
        data: mockOrganization,
      })
      ;(httpsCallableFromURL as jest.Mock).mockReturnValue(mockGetOrgDetails)
      ;(getDatabase as jest.Mock).mockReturnValue({})
    })

    it('should display Add Favorite button when not favorited', async () => {
      ;(get as jest.Mock).mockResolvedValue({
        exists: () => false,
        val: () => null,
      })

      render(<OrganizationDetailsPage />)

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /add favorite/i })
        ).toBeInTheDocument()
      })
    })

    it('should display Remove Favorite button when favorited', async () => {
      ;(get as jest.Mock).mockResolvedValue({
        exists: () => true,
        val: () => true,
      })

      render(<OrganizationDetailsPage />)

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /remove favorite/i })
        ).toBeInTheDocument()
      })
    })

    it('should toggle favorite status when button is clicked', async () => {
      ;(get as jest.Mock).mockResolvedValue({
        exists: () => false,
        val: () => null,
      })
      ;(set as jest.Mock).mockResolvedValue(undefined)

      render(<OrganizationDetailsPage />)

      await waitFor(() => {
        const favoriteButton = screen.getByRole('button', {
          name: /add favorite/i,
        })
        fireEvent.click(favoriteButton)
      })

      expect(set).toHaveBeenCalled()
    })

    it('should handle favorite toggle error', async () => {
      ;(get as jest.Mock).mockResolvedValue({
        exists: () => false,
        val: () => null,
      })
      ;(set as jest.Mock).mockRejectedValue(new Error('Failed to update'))

      render(<OrganizationDetailsPage />)

      await waitFor(() => {
        const favoriteButton = screen.getByRole('button', {
          name: /add favorite/i,
        })
        fireEvent.click(favoriteButton)
      })

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to update favourite')
      })
    })
  })

  describe('Join/Leave Functionality', () => {
    it('should show Join button for non-members of public org', async () => {
      const publicOrg = {
        ...mockOrganization,
        members: { owner123: 'Admin' as const },
      }
      const mockGetOrgDetails = jest.fn().mockResolvedValue({ data: publicOrg })
      ;(httpsCallableFromURL as jest.Mock).mockReturnValue(mockGetOrgDetails)
      ;(get as jest.Mock).mockResolvedValue({
        exists: () => false,
        val: () => null,
      })

      render(<OrganizationDetailsPage />)

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /join organisation/i })
        ).toBeInTheDocument()
      })
    })

    it('should not show Join button for private org non-members', async () => {
      const privateOrg = {
        ...mockOrganization,
        isPrivate: true,
        members: { owner123: 'Admin' as const },
      }
      const mockGetOrgDetails = jest.fn().mockResolvedValue({ data: privateOrg })
      ;(httpsCallableFromURL as jest.Mock).mockReturnValue(mockGetOrgDetails)
      ;(get as jest.Mock).mockResolvedValue({
        exists: () => false,
        val: () => null,
      })

      render(<OrganizationDetailsPage />)

      await waitFor(() => {
        expect(
          screen.queryByRole('button', { name: /join organisation/i })
        ).not.toBeInTheDocument()
      })
    })

    it('should show Leave button for members', async () => {
      const mockGetOrgDetails = jest.fn().mockResolvedValue({
        data: mockOrganization,
      })
      ;(httpsCallableFromURL as jest.Mock).mockReturnValue(mockGetOrgDetails)
      ;(get as jest.Mock).mockResolvedValue({
        exists: () => false,
        val: () => null,
      })

      render(<OrganizationDetailsPage />)

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /leave organisation/i })
        ).toBeInTheDocument()
      })
    })

    it('should handle join organization', async () => {
      const publicOrg = {
        ...mockOrganization,
        members: { owner123: 'Admin' as const },
      }
      const mockGetOrgDetails = jest.fn().mockResolvedValue({ data: publicOrg })
      const mockJoinOrg = jest.fn().mockResolvedValue({ data: { success: true } })
      ;(httpsCallableFromURL as jest.Mock).mockImplementation((_, url) => {
        if (url.includes('getorganizationdetails')) return mockGetOrgDetails
        if (url.includes('joinorganization')) return mockJoinOrg
        return jest.fn()
      })
      ;(get as jest.Mock).mockResolvedValue({
        exists: () => false,
        val: () => null,
      })

      delete (window as any).location
      window.location = { reload: jest.fn() } as any

      render(<OrganizationDetailsPage />)

      await waitFor(() => {
        const joinButton = screen.getByRole('button', {
          name: /join organisation/i,
        })
        fireEvent.click(joinButton)
      })

      await waitFor(() => {
        expect(mockJoinOrg).toHaveBeenCalledWith({ orgId: mockOrgId })
        expect(toast.success).toHaveBeenCalledWith('Joined organisation')
      })
    })

    it('should handle leave organization', async () => {
      const mockGetOrgDetails = jest.fn().mockResolvedValue({
        data: mockOrganization,
      })
      const mockLeaveOrg = jest
        .fn()
        .mockResolvedValue({ data: { success: true, transferred: false } })
      ;(httpsCallableFromURL as jest.Mock).mockImplementation((_, url) => {
        if (url.includes('getorganizationdetails')) return mockGetOrgDetails
        if (url.includes('leaveorganization')) return mockLeaveOrg
        return jest.fn()
      })
      ;(get as jest.Mock).mockResolvedValue({
        exists: () => false,
        val: () => null,
      })

      render(<OrganizationDetailsPage />)

      await waitFor(() => {
        const leaveButton = screen.getByRole('button', {
          name: /leave organisation/i,
        })
        fireEvent.click(leaveButton)
      })

      await waitFor(() => {
        expect(mockLeaveOrg).toHaveBeenCalledWith({ orgId: mockOrgId })
        expect(toast.success).toHaveBeenCalledWith('Left organisation')
        expect(mockPush).toHaveBeenCalledWith('/organisations')
      })
    })
  })

  describe('Admin Functionality', () => {
    it('should show Delete Organization button for owner', async () => {
      const ownerOrg = { ...mockOrganization, ownerId: mockUserId }
      const mockGetOrgDetails = jest.fn().mockResolvedValue({ data: ownerOrg })
      ;(httpsCallableFromURL as jest.Mock).mockReturnValue(mockGetOrgDetails)
      ;(get as jest.Mock).mockResolvedValue({
        exists: () => false,
        val: () => null,
      })

      render(<OrganizationDetailsPage />)

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /delete organisation/i })
        ).toBeInTheDocument()
      })
    })
  })

  describe('Delete Organization', () => {
    it('should show delete button for owner', async () => {
      const ownerOrg = { ...mockOrganization, ownerId: mockUserId }
      const mockGetOrgDetails = jest.fn().mockResolvedValue({ data: ownerOrg })
      ;(httpsCallableFromURL as jest.Mock).mockReturnValue(mockGetOrgDetails)
      ;(get as jest.Mock).mockResolvedValue({
        exists: () => false,
        val: () => null,
      })

      render(<OrganizationDetailsPage />)

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /delete organisation/i })
        ).toBeInTheDocument()
      })
    })

    it('should handle organization deletion', async () => {
      const ownerOrg = { ...mockOrganization, ownerId: mockUserId }
      const mockGetOrgDetails = jest.fn().mockResolvedValue({ data: ownerOrg })
      const mockDeleteOrg = jest
        .fn()
        .mockResolvedValue({ data: { success: true } })
      ;(httpsCallableFromURL as jest.Mock).mockImplementation((_, url) => {
        if (url.includes('getorganizationdetails')) return mockGetOrgDetails
        if (url.includes('deleteorganization')) return mockDeleteOrg
        return jest.fn()
      })
      ;(get as jest.Mock).mockResolvedValue({
        exists: () => false,
        val: () => null,
      })

      window.confirm = jest.fn().mockReturnValue(true)

      render(<OrganizationDetailsPage />)

      await waitFor(() => {
        const deleteButton = screen.getByRole('button', {
          name: /delete organisation/i,
        })
        fireEvent.click(deleteButton)
      })

      await waitFor(() => {
        expect(mockDeleteOrg).toHaveBeenCalledWith({ orgId: mockOrgId })
        expect(toast.success).toHaveBeenCalledWith('Organisation deleted.')
        expect(mockPush).toHaveBeenCalledWith('/organisations')
      })
    })
  })

  describe('Member vs Non-Member View', () => {
    it('should not show tabs for non-members', async () => {
      const nonMemberOrg = {
        ...mockOrganization,
        members: { owner123: 'Admin' as const }, // Current user is NOT a member
      }
      const mockGetOrgDetails = jest.fn().mockResolvedValue({ data: nonMemberOrg })
      ;(httpsCallableFromURL as jest.Mock).mockReturnValue(mockGetOrgDetails)
      ;(get as jest.Mock).mockResolvedValue({
        exists: () => false,
        val: () => null,
      })

      render(<OrganizationDetailsPage />)

      await waitFor(() => {
        expect(screen.getByText('Test Organization')).toBeInTheDocument()
      })

      // Tabs should NOT be visible for non-members
      expect(screen.queryByRole('tab', { name: /notes/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('tab', { name: /details/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('tab', { name: /members/i })).not.toBeInTheDocument()
    })
  })

  describe('Notes Display', () => {
    it('should show empty state when no notes and user is member', async () => {
      const mockGetOrgDetails = jest.fn().mockResolvedValue({
        data: mockOrganization,
      })
      ;(httpsCallableFromURL as jest.Mock).mockReturnValue(mockGetOrgDetails)
      ;(get as jest.Mock).mockResolvedValue({
        exists: () => false,
        val: () => null,
      })

      render(<OrganizationDetailsPage />)

      await waitFor(() => {
        expect(screen.getByText('Test Organization')).toBeInTheDocument()
      })

      // Notes tab is default, so check for empty state
      await waitFor(() => {
        expect(screen.getByText(/no notes yet/i)).toBeInTheDocument()
      })
    })
  })
})