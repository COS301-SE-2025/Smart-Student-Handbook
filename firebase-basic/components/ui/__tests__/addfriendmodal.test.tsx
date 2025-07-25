import React from 'react'
import AddFriendModal from '../addfriendmodal';
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mocks
jest.mock("firebase/database", () => {
  return {
    getDatabase: () => ({}),
    ref: jest.fn(),
    get: jest.fn(),
  };
});
jest.mock("firebase/auth", () => {
  return {
    getAuth: () => ({
      currentUser: { uid: "current-user-uid" },
    }),
  };
});
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

// Mock UI components (Input, Button, Dialog, etc.)
jest.mock("@/components/ui/input", () => ({
  Input: (props: any) => (
    <input {...props} data-testid="mock-input" />
  ),
}));
jest.mock("@/components/ui/button", () => ({
  Button: (props: any) => (
    <button {...props} data-testid="mock-button">{props.children}</button>
  ),
}));
jest.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: any) => (
    <div data-testid="mock-dialog">{children}</div>
  ),
  DialogContent: ({ children }: any) => (
    <div data-testid="mock-dialog-content">{children}</div>
  ),
  DialogTrigger: ({ children }: any) => (
    <div data-testid="mock-dialog-trigger">{children}</div>
  ),
  DialogHeader: ({ children }: any) => (
    <div data-testid="mock-dialog-header">{children}</div>
  ),
  DialogTitle: ({ children }: any) => (
    <div data-testid="mock-dialog-title">{children}</div>
  ),
  DialogClose: ({ children }: any) => (
    <div data-testid="mock-dialog-close">{children}</div>
  ),
}));

describe('AddFriendModal() AddFriendModal method', () => {
  // Setup for router mock
  const pushMock = jest.fn();
  beforeEach(() => {
    jest.clearAllMocks();
    const { useRouter } = require("next/navigation");
    useRouter.mockReturnValue({ push: pushMock });
  });

  // Setup for firebase/database mocks
  const { get } = require("firebase/database");

  // --- Happy Path Tests ---
  describe("Happy paths", () => {
    test("renders Add Friend button and opens modal on click", async () => {
      // This test ensures the Add Friend button is rendered and clicking it opens the modal.
      get.mockResolvedValueOnce({
        val: () => ({
          "user-1": {
            UserSettings: {
              name: "Alice",
              surname: "Smith",
              email: "alice@example.com",
            },
          },
        }),
      });

      render(<AddFriendModal />);
      const addButton = screen.getByRole("button", { name: /add friend/i });
      expect(addButton).toBeInTheDocument();

      // Open modal
      fireEvent.click(addButton);

      // Wait for dialog content to appear
      await waitFor(() => {
        expect(screen.getByText(/search for a friend/i)).toBeInTheDocument();
      });
    });

    test("fetches and filters users by name, surname, and email", async () => {
      // This test ensures that users are fetched and can be filtered by name, surname, or email.
      get.mockResolvedValueOnce({
        val: () => ({
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
          "current-user-uid": {
            UserSettings: {
              name: "Current",
              surname: "User",
              email: "current@example.com",
            },
          },
        }),
      });

      render(<AddFriendModal />);
      fireEvent.click(screen.getByRole("button", { name: /add friend/i }));

      // Wait for users to be fetched
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search by name, surname or email/i)).toBeInTheDocument();
      });

      // Search by name
      const input = screen.getByPlaceholderText(/search by name, surname or email/i);
      fireEvent.change(input, { target: { value: "Alice" } });

      await waitFor(() => {
        expect(screen.getByText(/Alice Smith/)).toBeInTheDocument();
        expect(screen.getByText(/alice@example.com/)).toBeInTheDocument();
      });

      // Search by surname
      fireEvent.change(input, { target: { value: "Jones" } });
      await waitFor(() => {
        expect(screen.getByText(/Bob Jones/)).toBeInTheDocument();
        expect(screen.getByText(/bob@example.com/)).toBeInTheDocument();
      });

      // Search by email
      fireEvent.change(input, { target: { value: "alice@example.com" } });
      await waitFor(() => {
        expect(screen.getByText(/Alice Smith/)).toBeInTheDocument();
      });
    });

    test("clicking a user navigates to their profile and closes modal", async () => {
      // This test ensures that clicking a user navigates to their profile and closes the modal.
      get.mockResolvedValueOnce({
        val: () => ({
          "user-1": {
            UserSettings: {
              name: "Alice",
              surname: "Smith",
              email: "alice@example.com",
            },
          },
        }),
      });

      render(<AddFriendModal />);
      fireEvent.click(screen.getByRole("button", { name: /add friend/i }));

      // Wait for users to be fetched
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search by name, surname or email/i)).toBeInTheDocument();
      });

      // Search to show user
      const input = screen.getByPlaceholderText(/search by name, surname or email/i);
      fireEvent.change(input, { target: { value: "Alice" } });

      await waitFor(() => {
        expect(screen.getByText(/Alice Smith/)).toBeInTheDocument();
      });

      // Click user
      const userItem = screen.getByText(/Alice Smith/).closest("li");
      fireEvent.click(userItem!);

      expect(pushMock).toHaveBeenCalledWith("/friends/user-1");
    });

    test("search input clears results when emptied", async () => {
      // This test ensures that clearing the search input clears the results.
      get.mockResolvedValueOnce({
        val: () => ({
          "user-1": {
            UserSettings: {
              name: "Alice",
              surname: "Smith",
              email: "alice@example.com",
            },
          },
        }),
      });

      render(<AddFriendModal />);
      fireEvent.click(screen.getByRole("button", { name: /add friend/i }));

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search by name, surname or email/i)).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText(/search by name, surname or email/i);
      fireEvent.change(input, { target: { value: "Alice" } });

      await waitFor(() => {
        expect(screen.getByText(/Alice Smith/)).toBeInTheDocument();
      });

      // Clear input
      fireEvent.change(input, { target: { value: "" } });

      await waitFor(() => {
        expect(screen.queryByText(/Alice Smith/)).not.toBeInTheDocument();
      });
    });
  });

  // --- Edge Case Tests ---
  describe("Edge cases", () => {
    test("does not show current user in search results", async () => {
      // This test ensures that the current user is not shown in the search results.
      get.mockResolvedValueOnce({
        val: () => ({
          "current-user-uid": {
            UserSettings: {
              name: "Current",
              surname: "User",
              email: "current@example.com",
            },
          },
          "user-2": {
            UserSettings: {
              name: "Bob",
              surname: "Jones",
              email: "bob@example.com",
            },
          },
        }),
      });

      render(<AddFriendModal />);
      fireEvent.click(screen.getByRole("button", { name: /add friend/i }));

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search by name, surname or email/i)).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText(/search by name, surname or email/i);
      fireEvent.change(input, { target: { value: "Current" } });

      await waitFor(() => {
        expect(screen.queryByText(/Current User/)).not.toBeInTheDocument();
      });

      fireEvent.change(input, { target: { value: "Bob" } });
      await waitFor(() => {
        expect(screen.getByText(/Bob Jones/)).toBeInTheDocument();
      });
    });

    test("handles no users in database gracefully", async () => {
      // This test ensures that the component handles the case where there are no users in the database.
      get.mockResolvedValueOnce({
        val: () => undefined,
      });

      render(<AddFriendModal />);
      fireEvent.click(screen.getByRole("button", { name: /add friend/i }));

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search by name, surname or email/i)).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText(/search by name, surname or email/i);
      fireEvent.change(input, { target: { value: "Any" } });

      await waitFor(() => {
        expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
      });
    });

    test("handles users with missing UserSettings fields", async () => {
      // This test ensures that users with missing UserSettings fields are handled without errors.
      get.mockResolvedValueOnce({
        val: () => ({
          "user-1": {
            UserSettings: {
              name: "Alice",
              // surname missing
              // email missing
            },
          },
          "user-2": {
            // UserSettings missing
          },
        }),
      });

      render(<AddFriendModal />);
      fireEvent.click(screen.getByRole("button", { name: /add friend/i }));

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search by name, surname or email/i)).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText(/search by name, surname or email/i);
      fireEvent.change(input, { target: { value: "Alice" } });

      await waitFor(() => {
        expect(screen.getByText(/Alice/)).toBeInTheDocument();
      });
    });

    test("search is case-insensitive", async () => {
      // This test ensures that the search is case-insensitive.
      get.mockResolvedValueOnce({
        val: () => ({
          "user-1": {
            UserSettings: {
              name: "Alice",
              surname: "Smith",
              email: "alice@example.com",
            },
          },
        }),
      });

      render(<AddFriendModal />);
      fireEvent.click(screen.getByRole("button", { name: /add friend/i }));

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search by name, surname or email/i)).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText(/search by name, surname or email/i);
      fireEvent.change(input, { target: { value: "alice" } });

      await waitFor(() => {
        expect(screen.getByText(/Alice Smith/)).toBeInTheDocument();
      });

      fireEvent.change(input, { target: { value: "ALICE" } });
      await waitFor(() => {
        expect(screen.getByText(/Alice Smith/)).toBeInTheDocument();
      });
    });

    test("handles rapid open/close of modal without errors", async () => {
      // This test ensures that rapidly opening and closing the modal does not cause errors.
      get.mockResolvedValueOnce({
        val: () => ({
          "user-1": {
            UserSettings: {
              name: "Alice",
              surname: "Smith",
              email: "alice@example.com",
            },
          },
        }),
      });

      render(<AddFriendModal />);
      const addButton = screen.getByRole("button", { name: /add friend/i });

      // Open and close modal rapidly
      fireEvent.click(addButton);
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search by name, surname or email/i)).toBeInTheDocument();
      });
    });
  });
});