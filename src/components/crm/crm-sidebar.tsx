"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { 
  LayoutDashboard, 
  Briefcase, 
  ClipboardList, 
  Users, 
  Settings,
  ChevronRight,
  ShieldCheck
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarSeparator
} from "@/components/ui/sidebar"

const menuItems = [
  { title: "Dashboard", icon: LayoutDashboard, href: "/" },
  { title: "Servicios", icon: ClipboardList, href: "/requests" },
  { title: "Empresas", icon: Briefcase, href: "/companies" },
  { title: "Técnicos", icon: Users, href: "/technicians" },
]

export function CRMSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar variant="sidebar" collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-lg">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-lg font-bold tracking-tight text-primary">AsistenciaPro</span>
            <span className="text-xs font-medium text-muted-foreground">CRM de Servicios</span>
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Menú Principal
          </SidebarGroupLabel>
          <SidebarMenu className="px-2 mt-2">
            {menuItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === item.href}
                  tooltip={item.title}
                  className={cn(
                    "relative flex items-center gap-3 rounded-md px-3 py-2 transition-all duration-200",
                    pathname === item.href 
                      ? "bg-primary/10 text-primary font-semibold" 
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <Link href={item.href}>
                    <item.icon className="h-5 w-5" />
                    <span>{item.title}</span>
                    {pathname === item.href && (
                      <ChevronRight className="ml-auto h-4 w-4" />
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Configuración" className="text-muted-foreground">
              <Settings className="h-5 w-5" />
              <span>Configuración</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="mt-4 flex items-center gap-3 rounded-lg border bg-accent/30 p-3 group-data-[collapsible=icon]:hidden">
          <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
            AD
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="truncate text-sm font-semibold">Admin Panel</span>
            <span className="truncate text-xs text-muted-foreground">admin@asistenciapro.com</span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}