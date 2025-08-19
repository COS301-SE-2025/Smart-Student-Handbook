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

// Enhanced sidebar mocks that preserve the actual className behavior
jest.mock("@/components/ui/sidebar", () => ({
  Sidebar: ({ children, className, ...props }: any) => <aside className={className} {...props}>{children}</aside>,
  SidebarContent: ({ children, className, ...props }: any) => <div className={className} {...props}>{children}</div>,
  SidebarGroup: ({ children, className, ...props }: any) => <div className={className} {...props}>{children}</div>,
  SidebarGroupContent: ({ children, className, ...props }: any) => <div className={className} {...props}>{children}</div>,
  SidebarMenu: ({ children, className, ...props }: any) => <ul className={className} {...props}>{children}</ul>,
  SidebarMenuButton: ({ children, asChild, className, ...props }: any) => 
    asChild ? React.cloneElement(children, { className }) : <span className={className} {...props}>{children}</span>,
  SidebarMenuItem: ({ children, className, ...props }: any) => <li className={className} {...props}>{children}</li>,
  SidebarHeader: ({ children, className, ...props }: any) => <header className={className} {...props}>{children}</header>,
  SidebarFooter: ({ children, className, ...props }: any) => <footer className={className} {...props}>{children}</footer>,
}));

jest.mock("@/components/ui/button", () => ({
  Button: ({ children, className, ...props }: any) => <button className={className} {...props}>{children}</button>,
}));

// Enhanced dropdown menu mock
jest.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuContent: ({ children, className, ...props }: any) => <div className={className} {...props}>{children}</div>,
  DropdownMenuItem: ({ children, onClick, className, ...props }: any) => (
    <div role="menuitem" tabIndex={0} onClick={onClick} className={className} {...props} data-testid="dropdown-item">
      {children}
    </div>
  ),
  DropdownMenuTrigger: ({ children, asChild, ...props }: any) => (
    <div {...(asChild ? {} : props)}>
      {asChild ? children : <div>{children}</div>}
    </div>
  ),
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
        'Dashboard',
        'Library',
        'Calendar',
        'Friends',
        'Organisations',
        'Help Menu',
        'Settings',
      ];
      menuTitles.forEach((title) => {
        expect(screen.getByText(title)).toBeInTheDocument();
      });
    });

    it("highlights the active menu item based on pathname", () => {
      mockPathname = "/notes"; // Changed from "/hardnotes" to match the actual URL in app-sidebar.tsx
      render(<AppSidebar />);
      const titleElement = screen.getByText("Library");
      const link = titleElement.closest('a');
      // Check for the actual active classes from the component
      expect(link?.className).toContain('bg-sidebar-accent');
      expect(link?.className).toContain('text-sidebar-accent-foreground');
    });

    it("renders all icons for each menu item", () => {
      render(<AppSidebar />);
      const menuItems = [
        { title: "Dashboard", icon: "BarChart3" },
        { title: "Library", icon: "Edit3" },
        { title: "Calendar", icon: "Calendar" },
        { title: "Friends", icon: "Users" },
        { title: "Organisations", icon: "Building2" },
        { title: "Help Menu", icon: "BookOpen" },
        { title: "Settings", icon: "Settings" },
      ];

      menuItems.forEach(({ title, icon }) => {
        const titleElement = screen.getByText(title);
        const link = titleElement.closest('a');
        expect(link).toBeInTheDocument();
        if (link) {
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
        expect(link?.className).not.toContain('bg-sidebar-accent');
      });
    });

    it("handles rapid theme changes via dropdown without error", () => {
      render(<AppSidebar />);
      
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
        expect(link?.className).not.toContain('bg-sidebar-accent');
      });
    });
  });
});