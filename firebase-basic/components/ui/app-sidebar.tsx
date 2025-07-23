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
    url: "/hardnotes",
    icon: Edit3,
    description: "Create & edit notes",
  },
  // {
  //   title: "Library",
  //   url: "/notes",
  //   icon: BookOpen,
  //   description: "Browse all notes",
  // },
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
    title: "Help & Support",
    url: "/notes",
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
    <Sidebar className="border-r border-border bg-white dark:bg-[#0f172a]">
      <SidebarHeader className="border-b border-gray-100 px-6 py-4">
        <div className="group-data-[collapsible=icon]:hidden">
          <h2 className="font-semibold text-gray-900 dark:text-white text-sm tracking-tight">Smart Student</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Handbook</p>
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
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-white border border-blue-300 dark:border-blue-700"
                            : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-black dark:hover:text-white"
                        }`}
                      >
                        {isActive && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-500 rounded-r-full" />
                        )}
                        <item.icon
                          className={`h-4 w-4 transition-colors ${
                            isActive
                              ? "text-blue-600 dark:text-blue-300"
                              : "text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-white"
                          }`}
                        />
                        <div className="flex flex-col space y-4 group-data-[collapsible=icon]:hidden">
                          <span className={`font-medium text-base ${isActive ? "text-blue-700 dark:text-blue-300" : ""}`}>{item.title}</span>
                          <span
                            className={`text-xs transition-colors ${
                              isActive
                                ? "text-blue-500 dark:text-blue-400"
                                : "text-gray-500 dark:text-gray-400 group-hover:text-gray-600 dark:group-hover:text-white"
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

      <SidebarFooter className="border-t border-border p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full justify-start gap-3 h-9 px-3">
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
