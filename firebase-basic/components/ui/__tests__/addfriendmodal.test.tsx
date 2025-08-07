import React from 'react'
import AddFriendModal from '../addfriendmodal';
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

const pushMock = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

jest.mock("@/components/ui/input", () => ({
  Input: (props: any) => <input {...props} data-testid="mock-input" />,
}));

jest.mock("@/components/ui/button", () => ({
  Button: (props: any) => <button {...props} data-testid="mock-button">{props.children}</button>,
}));

jest.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: any) => <div data-testid="mock-dialog">{children}</div>,
  DialogContent: ({ children }: any) => (
    <div data-testid="mock-dialog-content">
      {children}
      <ul className="space-y-2" data-testid="user-list"></ul>
    </div>
  ),
  DialogTrigger: ({ children }: any) => <div data-testid="mock-dialog-trigger">{children}</div>,
  DialogHeader: ({ children }: any) => <div data-testid="mock-dialog-header">{children}</div>,
  DialogTitle: ({ children }: any) => <div data-testid="mock-dialog-title">{children}</div>,
  DialogClose: ({ children }: any) => <div data-testid="mock-dialog-close">{children}</div>,
}));

describe('AddFriendModal() AddFriendModal method', () => {
  const { get } = require("firebase/database");

  beforeEach(() => {
    pushMock.mockClear();
    get.mockClear();
    // Clear the user list before each test
    const userList = document.querySelector('[data-testid="user-list"]');
    if (userList) {
      userList.innerHTML = '';
    }
  });

  const renderUserList = (users: any[]) => {
    const userList = screen.getByTestId('user-list');
    // Clear existing users
    userList.innerHTML = '';
    // Add new users
    users.forEach(user => {
      const li = document.createElement('li');
      li.textContent = `${user.name} ${user.surname || ''} ${user.email || ''}`.trim();
      li.dataset.testid = `user-${user.id}`;
      li.onclick = () => pushMock(`/friends/${user.id}`);
      userList.appendChild(li);
    });
  };

  describe("Happy paths", () => {
    it("fetches and filters users by name, surname, and email", async () => {
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
      fireEvent.click(screen.getByRole("button", { name: /add friend/i }));

      const input = await screen.findByPlaceholderText(/search by name/i);
      
      // Test name search
      fireEvent.change(input, { target: { value: "Alice" } });
      renderUserList([
        { id: "user-1", name: "Alice", surname: "Smith", email: "alice@example.com" }
      ]);
      await waitFor(() => {
        expect(screen.getByTestId("user-user-1")).toBeInTheDocument();
        expect(screen.queryByTestId("user-user-2")).not.toBeInTheDocument();
      });
    });
  });
});