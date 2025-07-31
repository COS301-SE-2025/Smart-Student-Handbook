import { render, screen, waitFor, act } from '@testing-library/react';
import FriendsPage from '../app/friends/page';

describe('FriendsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders without crashing', async () => {
    await act(async () => {
      render(<FriendsPage />);
    });
    
    // Just check that the component renders
    expect(document.body).toBeInTheDocument();
  });

  test('renders friends page content', async () => {
    await act(async () => {
      render(<FriendsPage />);
    });
    
    // Wait for component to stabilize and check for any friends-related content
    await waitFor(() => {
      const hasContent = 
        screen.queryByTestId('add-friend-modal') ||
        screen.queryByText(/friend/i) ||
        screen.queryByText(/connect/i);
      expect(hasContent).toBeTruthy();
    }, { timeout: 5000 });
  });
});