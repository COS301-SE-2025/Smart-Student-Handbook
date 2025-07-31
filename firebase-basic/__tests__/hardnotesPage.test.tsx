import { render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import HardNotesPage from '../app/hardnotes/page';

// Additional mocks specific to this test
jest.mock('@/hooks/useUserId', () => ({
  useUserId: jest.fn(() => ({ userId: 'user123', loading: false })),
}));

describe('HardNotesPage', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  test('renders without crashing', async () => {
    await act(async () => {
      render(<HardNotesPage />);
    });
    
    // Wait for the component to load
    await waitFor(() => {
      // Look for any content that indicates the page loaded
      expect(document.body).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  test('renders basic structure', async () => {
    await act(async () => {
      render(<HardNotesPage />);
    });
    
    // Check for basic page structure
    await waitFor(() => {
      const pageElements = screen.getAllByText(/Notes Editor|Create|Note|Folder/i);
      expect(pageElements.length).toBeGreaterThan(0);
    }, { timeout: 5000 });
  });
});