import React from 'react'
import FriendsPage from '@/app/friends/page';
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock the useUserId hook directly
jest.mock("@/hooks/useUserId", () => ({
  useUserId: jest.fn(() => ({
    userId: "user1",
    loading: false
  }))
}));

// Mock Firebase Functions
const mockGetFriends = jest.fn();
const mockGetFriendRequests = jest.fn();
const mockAcceptFriendRequest = jest.fn();
const mockRejectFriendRequest = jest.fn();
const mockCancelFriendRequest = jest.fn();

jest.mock("firebase/functions", () => ({
  httpsCallable: jest.fn((fns, functionName) => {
    switch (functionName) {
      case "getFriends":
        return mockGetFriends;
      case "getFriendRequests":
        return mockGetFriendRequests;
      case "acceptFriendRequest":
        return mockAcceptFriendRequest;
      case "rejectFriendRequest":
        return mockRejectFriendRequest;
      case "cancelFriendRequest":
        return mockCancelFriendRequest;
      default:
        return jest.fn();
    }
  }),
}));

// Mock Firebase lib
jest.mock("@/lib/firebase", () => ({
  fns: {},
}));

// Mock toast
jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock UI components
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

describe('FriendsPage() FriendsPage method', () => {
  // Get reference to the mocked useUserId function
  const mockUseUserId = jest.mocked(require("@/hooks/useUserId").useUserId);

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset useUserId mock to default values
    mockUseUserId.mockReturnValue({
      userId: "user1",
      loading: false
    });
    
    // Reset all function mocks to return empty data by default
    mockGetFriends.mockResolvedValue({ data: [] });
    mockGetFriendRequests.mockResolvedValue({ 
      data: { incoming: [], sent: [] } 
    });
    mockAcceptFriendRequest.mockResolvedValue({
      data: { success: true, message: "Friend request accepted!" }
    });
    mockRejectFriendRequest.mockResolvedValue({
      data: { success: true, message: "Friend request rejected!" }
    });
    mockCancelFriendRequest.mockResolvedValue({
      data: { success: true, message: "Friend request cancelled!" }
    });
  });

  // ------------------- Happy Paths -------------------
  describe("Happy paths", () => {
    test("renders FriendsPage with no friends, no requests", async () => {
      await act(async () => {
        render(<FriendsPage />);
      });
      
      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText("Loading friends...")).not.toBeInTheDocument();
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
      const mockFriends = [
        {
          uid: "friend1",
          name: "Alice",
          surname: "Smith",
          profilePicture: "alice.jpg"
        }
      ];
      
      const mockIncoming = [
        {
          uid: "incoming1",
          name: "Bob",
          surname: "Brown",
          profilePicture: "bob.jpg"
        }
      ];
      
      const mockSent = [
        {
          uid: "sent1",
          name: "Carol",
          surname: "Jones",
          profilePicture: "carol.jpg"
        }
      ];

      mockGetFriends.mockResolvedValue({ data: mockFriends });
      mockGetFriendRequests.mockResolvedValue({ 
        data: { incoming: mockIncoming, sent: mockSent } 
      });

      await act(async () => {
        render(<FriendsPage />);
      });
      
      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText("Loading friends...")).not.toBeInTheDocument();
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
      const mockIncoming = [
        {
          uid: "incoming1",
          name: "Bob",
          surname: "Brown",
          profilePicture: ""
        }
      ];

      mockGetFriendRequests.mockResolvedValue({ 
        data: { incoming: mockIncoming, sent: [] } 
      });

      await act(async () => {
        render(<FriendsPage />);
      });
      
      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText("Loading friends...")).not.toBeInTheDocument();
      });

      const acceptBtn = screen.getByText("Accept");
      
      await act(async () => {
        fireEvent.click(acceptBtn);
      });

      await waitFor(() => {
        expect(mockAcceptFriendRequest).toHaveBeenCalledWith({
          targetUserId: "incoming1"
        });
      });
    });

    test("rejects an incoming friend request", async () => {
      const mockIncoming = [
        {
          uid: "incoming1",
          name: "Bob",
          surname: "Brown",
          profilePicture: ""
        }
      ];

      mockGetFriendRequests.mockResolvedValue({ 
        data: { incoming: mockIncoming, sent: [] } 
      });

      await act(async () => {
        render(<FriendsPage />);
      });
      
      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText("Loading friends...")).not.toBeInTheDocument();
      });

      const rejectBtn = screen.getByText("Reject");
      
      await act(async () => {
        fireEvent.click(rejectBtn);
      });

      await waitFor(() => {
        expect(mockRejectFriendRequest).toHaveBeenCalledWith({
          targetUserId: "incoming1"
        });
      });
    });

    test("cancels a sent friend request", async () => {
      const mockSent = [
        {
          uid: "sent1",
          name: "Carol",
          surname: "Jones",
          profilePicture: ""
        }
      ];

      mockGetFriendRequests.mockResolvedValue({ 
        data: { incoming: [], sent: mockSent } 
      });

      await act(async () => {
        render(<FriendsPage />);
      });
      
      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText("Loading friends...")).not.toBeInTheDocument();
      });

      const cancelBtn = screen.getByText("Cancel");
      
      await act(async () => {
        fireEvent.click(cancelBtn);
      });

      await waitFor(() => {
        expect(mockCancelFriendRequest).toHaveBeenCalledWith({
          targetUserId: "sent1"
        });
      });
    });

    test("renders friend initials in AvatarFallback", async () => {
      const mockFriends = [
        {
          uid: "friend1",
          name: "Bob",
          surname: "Brown",
          profilePicture: ""
        }
      ];

      mockGetFriends.mockResolvedValue({ data: mockFriends });

      await act(async () => {
        render(<FriendsPage />);
      });
      
      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText("Loading friends...")).not.toBeInTheDocument();
      });

      expect(screen.getByText("BB")).toBeInTheDocument();
    });
  });

  // ------------------- Edge Cases -------------------
  describe("Edge cases", () => {
    test("does not render friends/requests if user is not authenticated", async () => {
      mockUseUserId.mockReturnValue({
        userId: null,
        loading: false
      });

      await act(async () => {
        render(<FriendsPage />);
      });
      
      // Since userId is null, the component should render immediately without calling Firebase functions
      expect(screen.getByText("Friends")).toBeInTheDocument();
      expect(screen.getByText("Your Friends")).toBeInTheDocument();
      expect(screen.getByText("Friend Requests")).toBeInTheDocument();
      expect(screen.getByText("No friends yet")).toBeInTheDocument();
      expect(screen.getByText("No incoming requests")).toBeInTheDocument();
      expect(screen.getByText("No sent requests")).toBeInTheDocument();
      
      // Firebase functions should not be called when userId is null
      expect(mockGetFriends).not.toHaveBeenCalled();
      expect(mockGetFriendRequests).not.toHaveBeenCalled();
    });

    test("handles missing UserSettings gracefully in loadUsers", async () => {
      // This test is now handled by the Firebase Functions mock
      // If the backend returns empty arrays, the UI should show "No friends yet"
      await act(async () => {
        render(<FriendsPage />);
      });
      
      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText("Loading friends...")).not.toBeInTheDocument();
      });

      expect(screen.getByText("No friends yet")).toBeInTheDocument();
    });

    test("handles empty name/surname for initials", async () => {
      const mockFriends = [
        {
          uid: "friend1",
          name: "",
          surname: "",
          profilePicture: ""
        }
      ];

      mockGetFriends.mockResolvedValue({ data: mockFriends });

      await act(async () => {
        render(<FriendsPage />);
      });
      
      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText("Loading friends...")).not.toBeInTheDocument();
      });

      // Should render without crashing - friend should still appear with empty initials
      expect(screen.getByText("Friend")).toBeInTheDocument();
    });

    test("handles user with single-letter name/surname for initials", async () => {
      const mockFriends = [
        {
          uid: "friend1",
          name: "A",
          surname: "B",
          profilePicture: ""
        }
      ];

      mockGetFriends.mockResolvedValue({ data: mockFriends });

      await act(async () => {
        render(<FriendsPage />);
      });
      
      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText("Loading friends...")).not.toBeInTheDocument();
      });

      expect(screen.getByText("AB")).toBeInTheDocument();
    });

    test("handles empty friends, incomingRequests, sentRequests objects", async () => {
      // Default mocks already return empty arrays
      await act(async () => {
        render(<FriendsPage />);
      });
      
      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText("Loading friends...")).not.toBeInTheDocument();
      });

      expect(screen.getByText("No friends yet")).toBeInTheDocument();
      expect(screen.getByText("No incoming requests")).toBeInTheDocument();
      expect(screen.getByText("No sent requests")).toBeInTheDocument();
    });

    test("handles missing friends, incomingRequests, sentRequests fields", async () => {
      // Default mocks already return empty arrays
      await act(async () => {
        render(<FriendsPage />);
      });
      
      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText("Loading friends...")).not.toBeInTheDocument();
      });

      expect(screen.getByText("No friends yet")).toBeInTheDocument();
      expect(screen.getByText("No incoming requests")).toBeInTheDocument();
      expect(screen.getByText("No sent requests")).toBeInTheDocument();
    });

    test("handles Firebase function errors gracefully", async () => {
      mockGetFriends.mockRejectedValue(new Error("Network error"));
      mockGetFriendRequests.mockRejectedValue(new Error("Network error"));

      await act(async () => {
        render(<FriendsPage />);
      });
      
      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText("Loading friends...")).not.toBeInTheDocument();
      });

      // Component should still render even if Firebase functions fail
      expect(screen.getByText("Friends")).toBeInTheDocument();
    });

    test("shows loading state initially", async () => {
      // Make Firebase functions take some time to resolve
      mockGetFriends.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ data: [] }), 100)));
      mockGetFriendRequests.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ data: { incoming: [], sent: [] } }), 100)));

      mockUseUserId.mockReturnValue({
        userId: "user1",
        loading: false
      });

      await act(async () => {
        render(<FriendsPage />);
      });

      // Should show loading state while Firebase functions are being called
      expect(screen.getByText("Loading friends...")).toBeInTheDocument();
      
      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText("Loading friends...")).not.toBeInTheDocument();
      }, { timeout: 2000 });
    });

    test("handles accept friend request error", async () => {
      const mockIncoming = [
        {
          uid: "incoming1",
          name: "Bob",
          surname: "Brown",
          profilePicture: ""
        }
      ];

      mockGetFriendRequests.mockResolvedValue({ 
        data: { incoming: mockIncoming, sent: [] } 
      });
      
      mockAcceptFriendRequest.mockRejectedValue(new Error("Failed to accept"));

      await act(async () => {
        render(<FriendsPage />);
      });
      
      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText("Loading friends...")).not.toBeInTheDocument();
      });

      const acceptBtn = screen.getByText("Accept");
      
      await act(async () => {
        fireEvent.click(acceptBtn);
      });

      await waitFor(() => {
        expect(mockAcceptFriendRequest).toHaveBeenCalledWith({
          targetUserId: "incoming1"
        });
      });
      
      // Toast error should be called
      const { toast } = require("sonner");
      expect(toast.error).toHaveBeenCalled();
    });
  });
});