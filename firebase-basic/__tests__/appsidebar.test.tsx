import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import { AppSidebar } from "@/components/ui/app-sidebar"

// --- Mock next/navigation ---
jest.mock("next/navigation", () => ({
  usePathname: jest.fn(),
}))
const mockUsePathname = require("next/navigation").usePathname as jest.Mock

// --- Mock next-themes ---
jest.mock("next-themes", () => ({
  useTheme: () => ({
    setTheme: mockSetTheme,
  }),
}))
const mockSetTheme = jest.fn()

// --- Mock lucide-react icons ---
jest.mock("lucide-react", () => {
  const MockIcon = (props: any) => <svg data-testid="icon" {...props} />
  return {
    BarChart3: MockIcon,
    Calendar: MockIcon,
    Settings: MockIcon,
    Moon: MockIcon,
    Sun: MockIcon,
    BookOpen: MockIcon,
    Edit3: MockIcon,
    Users: MockIcon,
    Building2: MockIcon,
  }
})

// --- Mock UI shadcn components ---
// (Minimal passthroughs so tests can render)
jest.mock("@/components/ui/sidebar", () => ({
  Sidebar: (props: any) => <div data-testid="sidebar" {...props} />,
  SidebarHeader: (props: any) => <div data-testid="sidebar-header" {...props} />,
  SidebarContent: (props: any) => <div data-testid="sidebar-content" {...props} />,
  SidebarGroup: (props: any) => <div data-testid="sidebar-group" {...props} />,
  SidebarGroupContent: (props: any) => <div data-testid="sidebar-group-content" {...props} />,
  SidebarMenu: (props: any) => <div data-testid="sidebar-menu" {...props} />,
  SidebarMenuItem: (props: any) => <div data-testid="sidebar-menu-item" {...props} />,
  SidebarMenuButton: (props: any) => <div data-testid="sidebar-menu-button" {...props} />,
  SidebarFooter: (props: any) => <div data-testid="sidebar-footer" {...props} />,
}))
jest.mock("@/components/ui/button", () => ({
  Button: (props: any) => <button data-testid="button" {...props} />,
}))
jest.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: (props: any) => <div data-testid="dropdown-menu" {...props} />,
  DropdownMenuTrigger: (props: any) => <div data-testid="dropdown-trigger" {...props} />,
  DropdownMenuContent: (props: any) => <div data-testid="dropdown-content" {...props} />,
  DropdownMenuItem: (props: any) => <div data-testid="dropdown-item" {...props} />,
}))

describe("AppSidebar", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test("renders all sidebar items", () => {
    mockUsePathname.mockReturnValue("/dashboard")
    render(<AppSidebar />)

    expect(screen.getByText("Dashboard")).toBeInTheDocument()
    expect(screen.getByText("Library")).toBeInTheDocument()
    expect(screen.getByText("Calendar")).toBeInTheDocument()
    expect(screen.getByText("Friends")).toBeInTheDocument()
    expect(screen.getByText("Organisations")).toBeInTheDocument()
    expect(screen.getByText("Help Menu")).toBeInTheDocument()
    expect(screen.getByText("Settings")).toBeInTheDocument()
  })

  test("highlights active item when pathname matches", () => {
    mockUsePathname.mockReturnValue("/friends")
    render(<AppSidebar />)

    const activeItem = screen.getByText("Friends").closest("a")
    expect(activeItem).toHaveClass("bg-blue-100") // active style
  })

  test("calls setTheme when theme options clicked", () => {
    mockUsePathname.mockReturnValue("/dashboard")
    render(<AppSidebar />)

    const light = screen.getByText("Light")
    const dark = screen.getByText("Dark")
    const system = screen.getByText("System")

    fireEvent.click(light)
    expect(mockSetTheme).toHaveBeenCalledWith("light")

    fireEvent.click(dark)
    expect(mockSetTheme).toHaveBeenCalledWith("dark")

    fireEvent.click(system)
    expect(mockSetTheme).toHaveBeenCalledWith("system")
  })
})
