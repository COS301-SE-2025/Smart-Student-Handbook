import React from 'react';
import AddFriendModal from "@/components/ui/addfriendmodal";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("firebase/database", () => ({
  getDatabase: () => ({}),
  ref: jest.fn(),
  get: jest.fn(),
}));

jest.mock("firebase/auth", () => ({
  getAuth: () => ({
    currentUser: { uid: "current-user-uid" },
  }),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

jest.mock("@/components/ui/input", () => ({
  Input: (props: any) => <input {...props} data-testid="search-input" />,
}));

jest.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

// Create a simple Dialog mock that works with the component's state management
jest.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mock-dialog">{children}</div>
  ),
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogTrigger: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-trigger">{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogClose: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('AddFriendModal', () => {
  const { get } = require("firebase/database");
  const { useRouter } = require("next/navigation");
  let mockPush: jest.Mock;

  beforeEach(() => {
    mockPush = useRouter().push;
    mockPush.mockClear();
    get.mockClear();
  });

  describe("Component rendering and basic functionality", () => {
    it("renders the component", () => {
      render(<AddFriendModal />);
      
      // Just check that the component renders without errors
      expect(screen.getByTestId("mock-dialog")).toBeInTheDocument();
    });

    it("can interact with search functionality when modal state changes", async () => {
      const mockUsers = {
        "user-1": {
          UserSettings: {
            name: "Alice",
            surname: "Smith",
            email: "alice@example.com",
          },
        },
        "user-2": {
          UserSettings: {
            name: "Bob",
            surname: "Jones", 
            email: "bob@example.com",
          },
        },
      };

      get.mockResolvedValueOnce({ val: () => mockUsers });

      render(<AddFriendModal />);
      
      // The component uses internal state, so we need to find the button and trigger the modal
      // Since the modal opens based on internal state, let's find the Add Friend button
      const addFriendButton = screen.getByText("Add Friend");
      fireEvent.click(addFriendButton);

      // Wait for the search input to appear (this happens when open state becomes true)
      await waitFor(() => {
        const searchInput = screen.queryByPlaceholderText(/search by name/i);
        if (searchInput) {
          expect(searchInput).toBeInTheDocument();
          return true;
        }
        return false;
      }, { timeout: 3000 });

      // If we have the search input, test the search functionality
      const searchInput = screen.getByPlaceholderText(/search by name/i);
      fireEvent.change(searchInput, { target: { value: "Alice" } });

      // Wait for Firebase call and filtering
      await waitFor(() => {
        expect(get).toHaveBeenCalled();
      });

      // Test that search results appear
      await waitFor(() => {
        expect(screen.getByText("Alice Smith")).toBeInTheDocument();
      });
    });

    it("handles navigation when user is clicked", async () => {
      const mockUsers = {
        "user-1": {
          UserSettings: {
            name: "Alice",
            surname: "Smith",
            email: "alice@example.com",
          },
        },
      };

      get.mockResolvedValueOnce({ val: () => mockUsers });

      render(<AddFriendModal />);
      
      const addFriendButton = screen.getByText("Add Friend");
      fireEvent.click(addFriendButton);

      // Wait for search input and search for user
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search by name/i)).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search by name/i);
      fireEvent.change(searchInput, { target: { value: "Alice" } });

      await waitFor(() => {
        expect(screen.getByText("Alice Smith")).toBeInTheDocument();
      });

      // Click on the user item
      const userItem = screen.getByText("Alice Smith").closest('li');
      if (userItem) {
        fireEvent.click(userItem);
        expect(mockPush).toHaveBeenCalledWith("/friends/user-1");
      }
    });
  });
});