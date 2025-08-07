import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { getAuth } from 'firebase/auth';
import { db } from '@/lib/firebase';
import { ref, get, onValue, remove, set } from 'firebase/database';
import FriendsPage from '../../app/friends/page';

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(),
}));
jest.mock('@/lib/firebase', () => ({
  db: {
    ref: jest.fn(),
    get: jest.fn(),
    onValue: jest.fn(),
    remove: jest.fn(),
    set: jest.fn(),
  },
}));
jest.mock('@/components/ui/addfriendmodal', () => ({
  default: () => <div data-testid="add-friend-modal" />,
}));

describe('FriendsPage', () => {
  const mockUser = { uid: 'user123' };
  const mockUserProfile = { uid: 'friend123', name: 'John', surname: 'Doe', profilePicture: '/placeholder.svg' };

  beforeEach(() => {
    (getAuth as jest.Mock).mockReturnValue({ currentUser: mockUser });
    (ref as jest.Mock).mockReturnValue({});
    (get as jest.Mock).mockResolvedValue({ exists: () => true, val: () => ({}) });
    (onValue as jest.Mock).mockImplementation((ref, callback) => {
      callback({ val: () => ({
        friends: { friend123: true },
        incomingRequests: { req123: true },
        sentRequests: { sent123: true },
      }) });
      return jest.fn();
    });
    (remove as jest.Mock).mockResolvedValue();
    (set as jest.Mock).mockResolvedValue();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('renders with initial state and loads friends', async () => {
    (get as jest.Mock).mockImplementationOnce((ref) => {
      if (ref.toString().includes('friend123')) return { exists: () => true, val: () => mockUserProfile };
      return { exists: () => true, val: () => ({}) };
    });

    render(<FriendsPage />);
    await waitFor(() => expect(screen.getByText('Your Friends')).toBeInTheDocument());
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByTestId('add-friend-modal')).toBeInTheDocument();
  });

  test('handles accept friend request', async () => {
    (get as jest.Mock).mockImplementation((ref) => {
      if (ref.toString().includes('req123')) return { exists: () => true, val: () => mockUserProfile };
      return { exists: () => true, val: () => ({}) };
    });

    render(<FriendsPage />);
    await waitFor(() => screen.getByText('Incoming (1)'));
    fireEvent.click(screen.getByText('Accept'));
    await waitFor(() => {
      expect(set).toHaveBeenCalledWith(expect.any(Object), true);
      expect(remove).toHaveBeenCalledTimes(2);
    });
  });

  test('handles reject friend request', async () => {
    render(<FriendsPage />);
    await waitFor(() => screen.getByText('Incoming (1)'));
    fireEvent.click(screen.getByText('Reject'));
    await waitFor(() => {
      expect(remove).toHaveBeenCalledTimes(2);
    });
  });

  test('handles cancel sent request', async () => {
    render(<FriendsPage />);
    await waitFor(() => screen.getByText('Sent (1)'));
    fireEvent.click(screen.getByText('Cancel Request'));
    await waitFor(() => {
      expect(remove).toHaveBeenCalledTimes(2);
    });
  });
});