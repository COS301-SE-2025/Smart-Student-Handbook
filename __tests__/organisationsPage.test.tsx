import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import OrganisationsPage from '../../app/organisations/page';
import { fns } from '@/lib/firebase';
import { getDatabase } from 'firebase/database';
import { useUserId } from '@/hooks/useUserId';

jest.mock('@/lib/firebase', () => ({
  fns: {},
  getDatabase: jest.fn(),
}));
jest.mock('@/hooks/useUserId', () => ({
  useUserId: jest.fn(() => ({ userId: 'user123', loading: false })),
}));
jest.mock('@/components/ui/create-organization-modal', () => ({
  default: () => <div data-testid="create-org-modal" />,
}));

describe('OrganisationsPage', () => {
  const mockOrg = {
    id: 'org1',
    ownerId: 'user123',
    name: 'Study Group',
    description: 'A study group',
    isPrivate: false,
    members: { user123: 'Admin' },
  };

  beforeEach(() => {
    (getDatabase as jest.Mock).mockReturnValue({
      ref: jest.fn(),
      get: jest.fn().mockResolvedValue({ val: () => ({}) }),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('renders and loads organizations', async () => {
    const mockCallable = jest.fn().mockResolvedValue({ data: [mockOrg] });
    (fns as any).getPublicOrganizations = mockCallable;
    (fns as any).getUserOrganizations = mockCallable;

    render(<OrganisationsPage />);
    await waitFor(() => expect(screen.getByText('Organisations')).toBeInTheDocument());
    expect(screen.getByText('Study Group')).toBeInTheDocument();
  });

  test('handles join organization', async () => {
    const mockJoin = jest.fn().mockResolvedValue({ data: { success: true } });
    (fns as any).joinOrganization = mockJoin;

    render(<OrganisationsPage />);
    await waitFor(() => screen.getByText('Join Organisation'));
    fireEvent.click(screen.getByText('Join Organisation'));
    await waitFor(() => expect(mockJoin).toHaveBeenCalledWith({ orgId: 'org1' }));
  });

  test('toggles favorite', async () => {
    const mockRef = { get: jest.fn().mockResolvedValue({ exists: () => false }), remove: jest.fn(), set: jest.fn() };
    (getDatabase as jest.Mock).mockReturnValue({
      ref: jest.fn(() => mockRef),
    });

    render(<OrganisationsPage />);
    await waitFor(() => screen.getByText('Study Group'));
    fireEvent.click(screen.getByRole('button', { name: /heart/i }));
    await waitFor(() => expect(mockRef.set).toHaveBeenCalledWith(true));
  });
});