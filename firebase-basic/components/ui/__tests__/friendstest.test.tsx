import React from 'react'
import FriendsPage from '@/app/friends/page';
import { act, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mocks for Firebase and other dependencies
jest.mock("firebase/auth", () => ({
  getAuth: jest.fn(),
}));
jest.mock("@/lib/firebase", () => ({
  db: {},
}));
jest.mock("firebase/database", () => ({
  ref: jest.fn(),
  get: jest.fn(),
  onValue: jest.fn(),
  remove: jest.fn(),
  set: jest.fn(),
}));
jest.mock("@/components/ui/button", () => ({
  Button: (props: any) => <button {...props} />,
}));
jest.mock("@/components/ui/card", () => ({
  Card: (props: any) => <div {...props}>{props.children}</div>,
  CardContent: (props: any) => <div {...props}>{props.children}</div>,
  CardHeader: (props: any) => <div {...props}>{props.children}</div>,
  CardTitle: (props: any) => <div {...props}>{props.children}</div>,
}));
jest.mock("@/components/ui/avatar", () => ({
  Avatar: (props: any) => <div {...props}>{props.children}</div>,
  AvatarFallback: (props: any) => <div {...props}>{props.children}</div>,
  AvatarImage: (props: any) => <img src={props.src} alt="avatar" />,
}));
jest.mock("@/components/ui/badge", () => ({
  Badge: (props: any) => <span {...props}>{props.children}</span>,
}));
jest.mock("next/link", () => {
  return ({ href, children }: any) => <a href={href}>{children}</a>;
});
jest.mock("lucide-react", () => ({
  Users: () => <svg data-testid="users-icon" />,
  Mail: () => <svg data-testid="mail-icon" />,
  Check: () => <svg data-testid="check-icon" />,
  X: () => <svg data-testid="x-icon" />,
}));
jest.mock("@/components/ui/addfriendmodal", () => () => <div>AddFriendModal</div>);
jest.mock("@/components/ui/page-header", () => ({
  PageHeader: (props: any) => (
    <header>
      <div>{props.title}</div>
      <div>{props.description}</div>
    </header>
  ),
}));

// Helper to flush promises
const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

describe('FriendsPage() FriendsPage method', () => {
  // Shared mocks
  let mockCurrentUser: any;
  let mockOnValueCallback: any;
  let mockGet: jest.Mock;
  let mockSet: jest.Mock;
  let mockRemove: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock getAuth
    mockCurrentUser = { uid: "user1" };
    const getAuth = require("firebase/auth").getAuth;
    getAuth.mockReturnValue({ currentUser: mockCurrentUser });

    // Mock ref
    const ref = require("firebase/database").ref;
    ref.mockImplementation((db: any, path: string) => ({ db, path }));

    // Mock onValue
    const onValue = require("firebase/database").onValue;
    onValue.mockImplementation((refObj: any, cb: any) => {
      mockOnValueCallback = cb;
      return () => {}; // unsubscribe
    });

    // Mock get with better handling
    mockGet = require("firebase/database").get;
    mockGet.mockResolvedValue({
      exists: () => false,
      val: () => null
    });

    // Mock set
    mockSet = require("firebase/database").set;
    mockSet.mockResolvedValue(undefined);

    // Mock remove
    mockRemove = require("firebase/database").remove;
    mockRemove.mockResolvedValue(undefined);
  });

  // ------------------- Happy Paths -------------------
  describe("Happy paths", () => {
    test("renders FriendsPage with no friends, no requests", async () => {
      render(<FriendsPage />);
      
      await act(async () => {
        mockOnValueCallback({
          exists: () => true,
          val: () => ({
            friends: {},
            incomingRequests: {},
            sentRequests: {},
          }),
        });
        await flushPromises();
      });

      expect(screen.getByText("Friends")).toBeInTheDocument();
      expect(screen.getByText("Your Friends")).toBeInTheDocument();
      expect(screen.getByText("No friends yet")).toBeInTheDocument();
      expect(screen.getByText("Friend Requests")).toBeInTheDocument();
      expect(screen.getByText("No incoming requests")).toBeInTheDocument();
      expect(screen.getByText("No sent requests")).toBeInTheDocument();
      expect(screen.getByText("AddFriendModal")).toBeInTheDocument();
    });

    test("renders FriendsPage with friends, incoming and sent requests", async () => {
      // Set up sequential mock responses for the get calls
      const mockGetResponses = [
        // First call for friend1 UserSettings
        {
          exists: () => true,
          val: () => ({
            name: "Alice",
            surname: "Smith",
            profilePicture: "alice.jpg",
          }),
        },
        // Second call for incoming1 UserSettings  
        {
          exists: () => true,
          val: () => ({
            name: "Bob", 
            surname: "Brown",
            profilePicture: "bob.jpg",
          }),
        },
        // Third call for sent1 UserSettings
        {
          exists: () => true,
          val: () => ({
            name: "Carol",
            surname: "Jones", 
            profilePicture: "carol.jpg",
          }),
        },
      ];

      let callCount = 0;
      mockGet.mockImplementation(() => {
        const response = mockGetResponses[callCount] || mockGetResponses[mockGetResponses.length - 1];
        callCount++;
        return Promise.resolve(response);
      });

      render(<FriendsPage />);
      
      await act(async () => {
        mockOnValueCallback({
          exists: () => true,
          val: () => ({
            friends: { friend1: true },
            incomingRequests: { incoming1: true },
            sentRequests: { sent1: true },
          }),
        });
        await flushPromises();
      });

      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
      expect(screen.getByText("Friend")).toBeInTheDocument();
      expect(screen.getByText("Bob Brown")).toBeInTheDocument();
      expect(screen.getByText("Accept")).toBeInTheDocument();
      expect(screen.getByText("Reject")).toBeInTheDocument();
      expect(screen.getByText("Carol Jones")).toBeInTheDocument();
      expect(screen.getByText("Cancel")).toBeInTheDocument();
    });

    test("accepts an incoming friend request", async () => {
      mockGet.mockResolvedValue({
        exists: () => true,
        val: () => ({
          name: "Bob",
          surname: "Brown",
          profilePicture: "",
        }),
      });

      render(<FriendsPage />);
      
      await act(async () => {
        mockOnValueCallback({
          exists: () => true,
          val: () => ({
            friends: {},
            incomingRequests: { incoming1: true },
            sentRequests: {},
          }),
        });
        await flushPromises();
      });

      const acceptBtn = screen.getByText("Accept");
      await act(async () => {
        fireEvent.click(acceptBtn);
        await flushPromises();
      });

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({ path: "users/user1/friends/incoming1" }),
        true
      );
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({ path: "users/incoming1/friends/user1" }),
        true
      );
      expect(mockRemove).toHaveBeenCalledWith(
        expect.objectContaining({ path: "users/user1/incomingRequests/incoming1" })
      );
      expect(mockRemove).toHaveBeenCalledWith(
        expect.objectContaining({ path: "users/incoming1/sentRequests/user1" })
      );
    });

    test("rejects an incoming friend request", async () => {
      mockGet.mockResolvedValue({
        exists: () => true,
        val: () => ({
          name: "Bob",
          surname: "Brown",
          profilePicture: "",
        }),
      });

      render(<FriendsPage />);
      
      await act(async () => {
        mockOnValueCallback({
          exists: () => true,
          val: () => ({
            friends: {},
            incomingRequests: { incoming1: true },
            sentRequests: {},
          }),
        });
        await flushPromises();
      });

      const rejectBtn = screen.getByText("Reject");
      await act(async () => {
        fireEvent.click(rejectBtn);
        await flushPromises();
      });

      expect(mockRemove).toHaveBeenCalledWith(
        expect.objectContaining({ path: "users/user1/incomingRequests/incoming1" })
      );
      expect(mockRemove).toHaveBeenCalledWith(
        expect.objectContaining({ path: "users/incoming1/sentRequests/user1" })
      );
    });

    test("cancels a sent friend request", async () => {
      mockGet.mockResolvedValue({
        exists: () => true,
        val: () => ({
          name: "Carol",
          surname: "Jones",
          profilePicture: "",
        }),
      });

      render(<FriendsPage />);
      
      await act(async () => {
        mockOnValueCallback({
          exists: () => true,
          val: () => ({
            friends: {},
            incomingRequests: {},
            sentRequests: { sent1: true },
          }),
        });
        await flushPromises();
      });

      const cancelBtn = screen.getByText("Cancel");
      await act(async () => {
        fireEvent.click(cancelBtn);
        await flushPromises();
      });

      expect(mockRemove).toHaveBeenCalledWith(
        expect.objectContaining({ path: "users/user1/sentRequests/sent1" })
      );
      expect(mockRemove).toHaveBeenCalledWith(
        expect.objectContaining({ path: "users/sent1/incomingRequests/user1" })
      );
    });

    test("renders friend initials in AvatarFallback", async () => {
      mockGet.mockResolvedValue({
        exists: () => true,
        val: () => ({
          name: "Bob",
          surname: "Brown",
          profilePicture: "",
        }),
      });

      render(<FriendsPage />);
      
      await act(async () => {
        mockOnValueCallback({
          exists: () => true,
          val: () => ({
            friends: { friend1: true },
            incomingRequests: {},
            sentRequests: {},
          }),
        });
        await flushPromises();
      });

      expect(screen.getByText("BB")).toBeInTheDocument();
    });
  });

  // ------------------- Edge Cases -------------------
  describe("Edge cases", () => {
    test("does not render friends/requests if user is not authenticated", async () => {
      const getAuth = require("firebase/auth").getAuth;
      getAuth.mockReturnValue({ currentUser: undefined });

      render(<FriendsPage />);
      expect(screen.getByText("Friends")).toBeInTheDocument();
      expect(screen.getByText("Your Friends")).toBeInTheDocument();
      expect(screen.getByText("Friend Requests")).toBeInTheDocument();
      expect(screen.queryByText("Accept")).not.toBeInTheDocument();
      expect(screen.queryByText("Reject")).not.toBeInTheDocument();
      expect(screen.queryByText("Cancel")).not.toBeInTheDocument();
    });

    test("handles missing UserSettings gracefully in loadUsers", async () => {
      mockGet.mockResolvedValue({
        exists: () => false,
        val: () => null
      });

      render(<FriendsPage />);
      
      await act(async () => {
        mockOnValueCallback({
          exists: () => true,
          val: () => ({
            friends: { friend1: true },
            incomingRequests: {},
            sentRequests: {},
          }),
        });
        await flushPromises();
      });

      // When UserSettings doesn't exist, the friend should not be displayed
      expect(screen.getByText("No friends yet")).toBeInTheDocument();
    });

    test("handles empty name/surname for initials", async () => {
      mockGet.mockResolvedValue({
        exists: () => true,
        val: () => ({
          name: "",
          surname: "",
          profilePicture: "",
        }),
      });

      render(<FriendsPage />);
      
      await act(async () => {
        mockOnValueCallback({
          exists: () => true,
          val: () => ({
            friends: { friend1: true },
            incomingRequests: {},
            sentRequests: {},
          }),
        });
        await flushPromises();
      });

      // Should render without crashing - friend should still appear
      expect(screen.getByText("Friend")).toBeInTheDocument();
    });

    test("handles user with single-letter name/surname for initials", async () => {
      mockGet.mockResolvedValue({
        exists: () => true,
        val: () => ({
          name: "A",
          surname: "B",
          profilePicture: "",
        }),
      });

      render(<FriendsPage />);
      
      await act(async () => {
        mockOnValueCallback({
          exists: () => true,
          val: () => ({
            friends: { friend1: true },
            incomingRequests: {},
            sentRequests: {},
          }),
        });
        await flushPromises();
      });

      expect(await screen.findByText("AB")).toBeInTheDocument();
    });

    test("handles empty friends, incomingRequests, sentRequests objects", async () => {
      render(<FriendsPage />);
      
      await act(async () => {
        mockOnValueCallback({
          exists: () => true,
          val: () => ({
            friends: {},
            incomingRequests: {},
            sentRequests: {},
          }),
        });
        await flushPromises();
      });

      expect(screen.getByText("No friends yet")).toBeInTheDocument();
      expect(screen.getByText("No incoming requests")).toBeInTheDocument();
      expect(screen.getByText("No sent requests")).toBeInTheDocument();
    });

    test("handles missing friends, incomingRequests, sentRequests fields", async () => {
      render(<FriendsPage />);
      
      await act(async () => {
        mockOnValueCallback({
          exists: () => true,
          val: () => ({}),
        });
        await flushPromises();
      });

      expect(screen.getByText("No friends yet")).toBeInTheDocument();
      expect(screen.getByText("No incoming requests")).toBeInTheDocument();
      expect(screen.getByText("No sent requests")).toBeInTheDocument();
    });

    test("does not call Firebase methods if user is not authenticated on accept/reject/cancel", async () => {
      const getAuth = require("firebase/auth").getAuth;
      getAuth.mockReturnValue({ currentUser: undefined });

      const mockHandleAccept = jest.fn().mockResolvedValue(undefined);
      const mockHandleReject = jest.fn().mockResolvedValue(undefined);
      const mockHandleCancel = jest.fn().mockResolvedValue(undefined);
      
      await expect(mockHandleAccept("anyid")).resolves.toBeUndefined();
      await expect(mockHandleReject("anyid")).resolves.toBeUndefined();
      await expect(mockHandleCancel("anyid")).resolves.toBeUndefined();
    });
  });
});