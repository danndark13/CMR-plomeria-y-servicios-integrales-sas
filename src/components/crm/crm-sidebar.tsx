
"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { 
  LayoutDashboard, 
  Briefcase, 
  ClipboardList, 
  Users, 
  Settings,
  ShieldCheck,
  CalendarDays,
  BarChart3,
  UserCog,
  Calculator,
  LogOut,
  User as UserIcon
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
import { MOCK_REQUESTS, MOCK_REMINDERS } from "@/lib/mock-data"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu"
import { toast } from "@/hooks/use-toast"

export function CRMSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  
  const today = new Date().toLocaleDateString()
  const todayCount = MOCK_REQUESTS.reduce((acc, req) => {
    const hasToday = req.interventions.some(i => new Date(i.date).toLocaleDateString() === today)
    return hasToday ? acc + 1 : acc
  }, 0)

  const criticalCount = MOCK_REMINDERS.filter(r => r.type === 'critical' || r.type === 'warning').length

  const mainItems = [
    { title: "Panel Principal", icon: LayoutDashboard, href: "/", badge: criticalCount > 0 ? criticalCount : null, badgeColor: "bg-destructive text-destructive-foreground" },
    { title: "Bitácora", icon: ClipboardList, href: "/requests" },
    { title: "Calendario", icon: CalendarDays, href: "/calendar", badge: todayCount > 0 ? todayCount : null, badgeColor: "bg-accent text-accent-foreground" },
    { title: "Empresas", icon: Briefcase, href: "/companies" },
    { title: "Técnicos", icon: Users, href: "/technicians" },
  ]

  const adminItems = [
    { title: "Contabilidad", icon: Calculator, href: "/accounting" },
    { title: "Gestión Usuarios", icon: UserCog, href: "/admin/users" },
    { title: "Productividad", icon: BarChart3, href: "/admin/reports" },
  ]

  const handleLogout = () => {
    toast({
      title: "Sesión cerrada",
      description: "Has salido del sistema exitosamente."
    })
    router.push("/login")
  }

  return (
    <Sidebar variant="sidebar" collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-lg">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-lg font-bold tracking-tight text-primary">AsistenciaPro</span>
            <span className="text-[10px] font-bold text-muted-foreground uppercase">CRM Operativo</span>
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="px-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Operación
          </SidebarGroupLabel>
          <SidebarMenu className="px-2 mt-2">
            {mainItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === item.href}
                  tooltip={item.title}
                  className={cn(
                    "relative flex items-center gap-3 rounded-md px-3 py-2 transition-all duration-200",
                    pathname === item.href 
                      ? "bg-primary/10 text-primary font-bold shadow-sm" 
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <Link href={item.href}>
                    <item.icon className="h-5 w-5 shrink-0" />
                    <span className="truncate">{item.title}</span>
                    {item.badge && (
                      <Badge className={cn("ml-auto h-5 w-5 flex items-center justify-center p-0 rounded-full text-[10px] animate-pulse", item.badgeColor)}>
                        {item.badge}
                      </Badge>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="px-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Administración
          </SidebarGroupLabel>
          <SidebarMenu className="px-2 mt-2">
            {adminItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === item.href || (item.href === '/accounting' && pathname.startsWith('/accounting'))}
                  tooltip={item.title}
                  className={cn(
                    "relative flex items-center gap-3 rounded-md px-3 py-2 transition-all duration-200",
                    (pathname === item.href || (item.href === '/accounting' && pathname.startsWith('/accounting')))
                      ? "bg-primary/10 text-primary font-bold shadow-sm" 
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <Link href={item.href}>
                    <item.icon className="h-5 w-5 shrink-0" />
                    <span className="truncate">{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton className="h-fit py-3 px-3 border bg-accent/30 hover:bg-accent/50 rounded-lg group-data-[collapsible=icon]:p-2 transition-all">
              <div className="flex items-center gap-3 w-full">
                <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                  DC
                </div>
                <div className="flex flex-col overflow-hidden text-left group-data-[collapsible=icon]:hidden">
                  <span className="truncate text-sm font-semibold">Daniel Céspedes</span>
                  <span className="truncate text-[10px] text-muted-foreground">danielcorecspds@gmail.com</span>
                </div>
              </div>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end" className="w-56">
            <DropdownMenuItem asChild>
              <Link href="/profile" className="flex items-center gap-2 cursor-pointer">
                <UserIcon className="h-4 w-4" />
                <span>Mi Perfil</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings" className="flex items-center gap-2 cursor-pointer">
                <Settings className="h-4 w-4" />
                <span>Configuración</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive flex items-center gap-2 cursor-pointer focus:bg-destructive/10 focus:text-destructive">
              <LogOut className="h-4 w-4" />
              <span>Cerrar Sesión</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
