import React from 'react'
import { AppSidebar } from '../app-sidebar';
import { fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";

// Enhanced mocks
jest.mock("lucide-react", () => ({
  BarChart3: (props: any) => <svg data-testid="BarChart3" {...props} />,
  Calendar: (props: any) => <svg data-testid="Calendar" {...props} />,
  Settings: (props: any) => <svg data-testid="Settings" {...props} />,
  Moon: (props: any) => <svg data-testid="Moon" {...props} />,
  Sun: (props: any) => <svg data-testid="Sun" {...props} />,
  BookOpen: (props: any) => <svg data-testid="BookOpen" {...props} />,
  Edit3: (props: any) => <svg data-testid="Edit3" {...props} />,
  Users: (props: any) => <svg data-testid="Users" {...props} />,
  Building2: (props: any) => <svg data-testid="Building2" {...props} />,
}));

// Enhanced sidebar mocks
jest.mock("@/components/ui/sidebar", () => ({
  Sidebar: ({ children, ...props }: any) => <aside {...props}>{children}</aside>,
  SidebarContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  SidebarGroup: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  SidebarGroupContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  SidebarMenu: ({ children, ...props }: any) => <ul {...props}>{children}</ul>,
  SidebarMenuButton: ({ children, asChild, ...props }: any) => 
    asChild ? children : <span {...props}>{children}</span>,
  SidebarMenuItem: ({ children, ...props }: any) => <li {...props}>{children}</li>,
  SidebarHeader: ({ children, ...props }: any) => <header {...props}>{children}</header>,
  SidebarFooter: ({ children, ...props }: any) => <footer {...props}>{children}</footer>,
}));

jest.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

// Enhanced dropdown menu mock
jest.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  DropdownMenuItem: ({ children, ...props }: any) => (
    <div role="menuitem" tabIndex={0} {...props} data-testid="dropdown-item">
      {children}
    </div>
  ),
  DropdownMenuTrigger: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));

const setThemeMock = jest.fn();
jest.mock("next-themes", () => ({
  useTheme: () => ({
    setTheme: setThemeMock,
    theme: "light",
  }),
}));

let mockPathname = "/dashboard";
jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

describe('AppSidebar() AppSidebar method', () => {
  beforeEach(() => {
    setThemeMock.mockClear();
    mockPathname = "/dashboard";
  });

  describe("Happy paths", () => {
    it("renders the sidebar header with correct title and subtitle", () => {
      render(<AppSidebar />);
      expect(screen.getByText("Smart Student")).toBeInTheDocument();
      expect(screen.getByText("Handbook")).toBeInTheDocument();
    });

    it("renders all sidebar menu items with correct titles and descriptions", () => {
      render(<AppSidebar />);
      const menuTitles = [
        "Dashboard",
        "Note Editor",
        "Library",
        "Calendar",
        "Settings",
        "Friends",
        "My Organisations",
      ];
      menuTitles.forEach((title) => {
        expect(screen.getByText(title)).toBeInTheDocument();
      });
    });

    it("highlights the active menu item based on pathname", () => {
      mockPathname = "/notes";
      render(<AppSidebar />);
      const titleElement = screen.getByText("Library");
      const link = titleElement.closest('a');
      expect(link).toHaveClass("bg-blue-100");
    });

    it("renders all icons for each menu item", () => {
      render(<AppSidebar />);
      const menuItems = [
        { title: "Dashboard", icon: "BarChart3" },
        { title: "Note Editor", icon: "Edit3" },
        { title: "Library", icon: "BookOpen" },
        { title: "Calendar", icon: "Calendar" },
        { title: "Settings", icon: "Settings" },
        { title: "Friends", icon: "Users" },
        { title: "My Organisations", icon: "Building2" },
      ];

      menuItems.forEach(({ title, icon }) => {
        const titleElement = screen.getByText(title);
        const link = titleElement.closest('a');
        expect(link).toBeInTheDocument(); // Add this check
        if (link) { // Add null check
          expect(within(link).getByTestId(icon)).toBeInTheDocument();
        }
      });
    });

    it("renders the sidebar footer with appearance button and dropdown", () => {
      render(<AppSidebar />);
      expect(screen.getByText("Appearance")).toBeInTheDocument();
      expect(screen.getByText("Customize theme")).toBeInTheDocument();
    });

    it("opens the appearance dropdown and calls setTheme with correct values", () => {
      render(<AppSidebar />);
      fireEvent.click(screen.getByText("Appearance"));
      
      const dropdownItems = screen.getAllByTestId("dropdown-item");
      expect(dropdownItems).toHaveLength(3);
      
      fireEvent.click(dropdownItems[0]); // Light
      expect(setThemeMock).toHaveBeenCalledWith("light");
      
      fireEvent.click(dropdownItems[1]); // Dark
      expect(setThemeMock).toHaveBeenCalledWith("dark");
      
      fireEvent.click(dropdownItems[2]); // System
      expect(setThemeMock).toHaveBeenCalledWith("system");
    });
  });

  describe("Edge cases", () => {
    it("does not highlight any menu item if pathname does not match any url", () => {
      mockPathname = "/not-a-real-path";
      render(<AppSidebar />);
      const links = screen.getAllByRole("link");
      links.forEach((link) => {
        expect(link).not.toHaveClass("bg-blue-100");
      });
    });

    it("handles rapid theme changes via dropdown without error", () => {
      render(<AppSidebar />);
      fireEvent.click(screen.getByText("Appearance"));
      
      const dropdownItems = screen.getAllByTestId("dropdown-item");
      fireEvent.click(dropdownItems[0]); // Light
      fireEvent.click(dropdownItems[1]); // Dark
      fireEvent.click(dropdownItems[2]); // System
      
      expect(setThemeMock).toHaveBeenCalledTimes(3);
    });

    it("renders correctly when pathname is root ('/')", () => {
      mockPathname = "/";
      render(<AppSidebar />);
      const links = screen.getAllByRole("link");
      links.forEach((link) => {
        expect(link).not.toHaveClass("bg-blue-100");
      });
    });
  });
});