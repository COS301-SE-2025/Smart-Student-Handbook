import React from 'react'
import { AppSidebar } from '../app-sidebar';

// firebase-basic/components/ui/app-sidebar.test.tsx
import { fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";

// firebase-basic/components/ui/app-sidebar.test.tsx
// Mocks for lucide-react icons
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
}))

// Mocks for sidebar and dropdown components
jest.mock("@/components/ui/sidebar", () => ({
  Sidebar: ({ children, ...props }: any) => <aside {...props}>{children}</aside>,
  SidebarContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  SidebarGroup: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  SidebarGroupContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  SidebarMenu: ({ children, ...props }: any) => <ul {...props}>{children}</ul>,
  SidebarMenuButton: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  SidebarMenuItem: ({ children, ...props }: any) => <li {...props}>{children}</li>,
  SidebarHeader: ({ children, ...props }: any) => <header {...props}>{children}</header>,
  SidebarFooter: ({ children, ...props }: any) => <footer {...props}>{children}</footer>,
}))

jest.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}))

jest.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  DropdownMenuItem: ({ children, ...props }: any) => <div role="menuitem" tabIndex={0} {...props}>{children}</div>,
  DropdownMenuTrigger: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}))

// Mock useTheme from next-themes
const setThemeMock = jest.fn()
jest.mock("next-themes", () => ({
  useTheme: () => ({
    setTheme: setThemeMock,
  }),
}))

// Mock usePathname from next/navigation
let mockPathname = "/dashboard"
jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}))

describe('AppSidebar() AppSidebar method', () => {
  // Reset mocks and path before each test
  beforeEach(() => {
    setThemeMock.mockClear()
    mockPathname = "/dashboard"
  })

  // =========================
  // Happy Path Tests
  // =========================
  describe("Happy paths", () => {
    it("renders the sidebar header with correct title and subtitle", () => {
      // This test ensures the sidebar header displays the correct branding.
      render(<AppSidebar />)
      expect(screen.getByText("Smart Student")).toBeInTheDocument()
      expect(screen.getByText("Handbook")).toBeInTheDocument()
    })

    it("renders all sidebar menu items with correct titles and descriptions", () => {
      // This test ensures all menu items are rendered with their titles and descriptions.
      render(<AppSidebar />)
      const menuTitles = [
        "Dashboard",
        "Note Editor",
        "Library",
        "Calendar",
        "Settings",
        "Friends",
        "My Organisations",
      ]
      const menuDescriptions = [
        "Overview & insights",
        "Create & edit notes",
        "Browse all notes",
        "Schedule & events",
        "Account & preferences",
        "Friends and Requests",
        "Manage your organisations",
      ]
      menuTitles.forEach((title) => {
        expect(screen.getByText(title)).toBeInTheDocument()
      })
      menuDescriptions.forEach((desc) => {
        expect(screen.getByText(desc)).toBeInTheDocument()
      })
    })

    it("highlights the active menu item based on pathname", () => {
      // This test ensures the active menu item is styled as active.
      mockPathname = "/notes"
      render(<AppSidebar />)
      const activeLink = screen.getByRole("link", { name: /Library/i })
      expect(activeLink).toHaveClass("bg-blue-100")
      expect(within(activeLink).getByTestId("BookOpen")).toBeInTheDocument()
    })

    it("renders all icons for each menu item", () => {
      // This test ensures all icons are rendered for each menu item.
      render(<AppSidebar />)
      expect(screen.getByTestId("BarChart3")).toBeInTheDocument()
      expect(screen.getByTestId("Edit3")).toBeInTheDocument()
      expect(screen.getByTestId("BookOpen")).toBeInTheDocument()
      expect(screen.getByTestId("Calendar")).toBeInTheDocument()
      expect(screen.getByTestId("Settings")).toBeInTheDocument()
      expect(screen.getByTestId("Users")).toBeInTheDocument()
      expect(screen.getByTestId("Building2")).toBeInTheDocument()
    })

    it("renders the sidebar footer with appearance button and dropdown", () => {
      // This test ensures the footer contains the appearance button and dropdown menu.
      render(<AppSidebar />)
      expect(screen.getByText("Appearance")).toBeInTheDocument()
      expect(screen.getByText("Customize theme")).toBeInTheDocument()
      expect(screen.getByTestId("Sun")).toBeInTheDocument()
      expect(screen.getByTestId("Moon")).toBeInTheDocument()
    })

    it("opens the appearance dropdown and calls setTheme with correct values", () => {
      // This test ensures clicking dropdown items calls setTheme with correct arguments.
      render(<AppSidebar />)
      // Open the dropdown by clicking the button
      fireEvent.click(screen.getByText("Appearance"))
      // Click Light
      fireEvent.click(screen.getByText("Light"))
      expect(setThemeMock).toHaveBeenCalledWith("light")
      // Click Dark
      fireEvent.click(screen.getByText("Dark"))
      expect(setThemeMock).toHaveBeenCalledWith("dark")
      // Click System
      fireEvent.click(screen.getByText("System"))
      expect(setThemeMock).toHaveBeenCalledWith("system")
    })

    it("renders correct icon and description for each menu item", () => {
      // This test ensures each menu item has the correct icon and description.
      render(<AppSidebar />)
      const items = [
        { title: "Dashboard", icon: "BarChart3", desc: "Overview & insights" },
        { title: "Note Editor", icon: "Edit3", desc: "Create & edit notes" },
        { title: "Library", icon: "BookOpen", desc: "Browse all notes" },
        { title: "Calendar", icon: "Calendar", desc: "Schedule & events" },
        { title: "Settings", icon: "Settings", desc: "Account & preferences" },
        { title: "Friends", icon: "Users", desc: "Friends and Requests" },
        { title: "My Organisations", icon: "Building2", desc: "Manage your organisations" },
      ]
      items.forEach(({ title, icon, desc }) => {
        const link = screen.getByRole("link", { name: title })
        expect(within(link).getByTestId(icon)).toBeInTheDocument()
        expect(within(link).getByText(desc)).toBeInTheDocument()
      })
    })
  })

  // =========================
  // Edge Case Tests
  // =========================
  describe("Edge cases", () => {
    it("does not highlight any menu item if pathname does not match any url", () => {
      // This test ensures no menu item is highlighted if pathname is not in items.
      mockPathname = "/not-a-real-path"
      render(<AppSidebar />)
      const links = screen.getAllByRole("link")
      links.forEach((link) => {
        expect(link).not.toHaveClass("bg-blue-100")
        expect(link).not.toHaveClass("dark:bg-blue-900")
      })
    })

    it("handles rapid theme changes via dropdown without error", () => {
      // This test ensures multiple rapid theme changes are handled.
      render(<AppSidebar />)
      fireEvent.click(screen.getByText("Appearance"))
      fireEvent.click(screen.getByText("Light"))
      fireEvent.click(screen.getByText("Dark"))
      fireEvent.click(screen.getByText("System"))
      expect(setThemeMock).toHaveBeenCalledTimes(3)
      expect(setThemeMock).toHaveBeenNthCalledWith(1, "light")
      expect(setThemeMock).toHaveBeenNthCalledWith(2, "dark")
      expect(setThemeMock).toHaveBeenNthCalledWith(3, "system")
    })

    it("renders correctly when pathname is root ('/')", () => {
      // This test ensures the sidebar renders with no active item when at root.
      mockPathname = "/"
      render(<AppSidebar />)
      const links = screen.getAllByRole("link")
      links.forEach((link) => {
        expect(link).not.toHaveClass("bg-blue-100")
      })
    })

    it("renders correctly when pathname matches the last item", () => {
      // This test ensures the last menu item is highlighted when pathname matches.
      mockPathname = "/organisations"
      render(<AppSidebar />)
      const activeLink = screen.getByRole("link", { name: /My Organisations/i })
      expect(activeLink).toHaveClass("bg-blue-100")
      expect(within(activeLink).getByTestId("Building2")).toBeInTheDocument()
    })

    it("renders correctly when pathname matches the first item", () => {
      // This test ensures the first menu item is highlighted when pathname matches.
      mockPathname = "/dashboard"
      render(<AppSidebar />)
      const activeLink = screen.getByRole("link", { name: /Dashboard/i })
      expect(activeLink).toHaveClass("bg-blue-100")
      expect(within(activeLink).getByTestId("BarChart3")).toBeInTheDocument()
    })
  })
})