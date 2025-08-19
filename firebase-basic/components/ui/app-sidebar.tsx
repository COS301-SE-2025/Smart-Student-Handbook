"use client"

import { BarChart3, Calendar, Settings, Moon, Sun, BookOpen, Edit3, Users, Building2 } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar"
import { useTheme } from "next-themes"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

const items = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: BarChart3,
    description: "Overview & insights",
  },
  {
    title: "Library",
    url: "/notes",
    icon: Edit3,
    description: "Create & edit notes",
  },
  {
    title: "Calendar",
    url: "/calendar",
    icon: Calendar,
    description: "Schedule & events",
  },
  {
    title: "Friends",
    url: "/friends",
    icon: Users,
    description: "Friends & requests",
  },
  {
    title: "Organisations",
    url: "/organisations",
    icon: Building2,
    description: "Manage your organisations",
  },
  {
    title: "Help Menu",
    url: "/help",
    icon: BookOpen,
    description: "User guide & support",
  },
  {
    title: "Settings",
    url: "/profile",
    icon: Settings,
    description: "Account & preferences",
  },
]

export function AppSidebar() {
  const { setTheme } = useTheme()
  const pathname = usePathname()

  return (
    <Sidebar className="border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <SidebarHeader className="px-3 py-2 flex items-center justify-between">
        <div className="group-data-[collapsible=icon]:hidden">
          <h2 className="font-semibold text-sidebar-foreground text-sm tracking-tight">Smart Student</h2>
          <p className="text-xs text-sidebar-accent-foreground/70 font-medium">Handbook</p>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-1 py-1">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {items.map((item) => {
                const isActive = pathname === item.url
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <a
                        href={item.url}
                        className={`relative flex items-center gap-3 px-3 py-5.5 rounded-lg transition-all duration-200 group ${
                          isActive
                            ? "bg-sidebar-accent text-sidebar-accent-foreground border border-sidebar-border"
                            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        }`}
                      >
                        {isActive && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full" />
                        )}
                        <item.icon
                          className={`h-4 w-4 transition-colors ${
                            isActive
                              ? "text-primary"
                              : "text-muted-foreground group-hover:text-sidebar-accent-foreground"
                          }`}
                        />
                        <div className="flex flex-col space y-4 group-data-[collapsible=icon]:hidden">
                          <span className={`font-medium text-base ${isActive ? "text-primary" : ""}`}>{item.title}</span>
                          <span
                            className={`text-xs transition-colors ${
                              isActive
                                ? "text-primary"
                                : "text-muted-foreground group-hover:text-sidebar-accent-foreground/80"
                            }`}
                          >
                            {item.description}
                          </span>
                        </div>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full justify-start gap-3 h-9 px-3 text-sidebar-foreground">
              <div className="flex h-4 w-4 items-center justify-center">
                <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              </div>
              <div className="group-data-[collapsible=icon]:hidden text-left min-w-0">
                <div className="text-sm font-medium truncate">Appearance</div>
                <div className="text-xs text-muted-foreground truncate">Customize theme</div>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40 ml-2">
            <DropdownMenuItem onClick={() => setTheme("light")} className="gap-2">
              <Sun className="h-4 w-4" />
              <span>Light</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("dark")} className="gap-2">
              <Moon className="h-4 w-4" />
              <span>Dark</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("system")} className="gap-2">
              <Settings className="h-4 w-4" />
              <span>System</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
