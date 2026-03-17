
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
  User as UserIcon,
  Package,
  RefreshCw,
  Receipt,
  Globe,
  Info,
  Wallet
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
  SidebarSeparator,
  useSidebar
} from "@/components/ui/sidebar"
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase'
import { doc } from 'firebase/firestore'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { toast } from "@/hooks/use-toast"
import { getAuth, signOut } from "firebase/auth"

export function CRMSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useUser()
  const db = useFirestore()
  const auth = getAuth()
  const { setOpenMobile } = useSidebar()

  const profileRef = useMemoFirebase(() => {
    if (!user || !db) return null
    return doc(db, 'user_profiles', user.uid)
  }, [user, db])

  const { data: profile, isLoading } = useDoc(profileRef)

  const handleLogout = () => {
    signOut(auth).then(() => {
      toast({
        title: "Sesión cerrada",
        description: "Has salido del sistema exitosamente."
      })
      router.push("/login")
    })
  }

  const closeSidebar = () => {
    setOpenMobile(false)
  }

  const role = profile?.roleId || (isLoading ? 'Cargando...' : 'Sin Rol')
  const isAdmin = role === 'Administrador' || role === 'Gerente'
  const isTech = role === 'Técnico'
  const isAccounting = role === 'Contabilidad' || isAdmin

  const navigationItems = [
    { title: "Panel Principal", icon: LayoutDashboard, href: "/", show: true },
    { title: "Contabilidad", icon: Calculator, href: "/accounting", show: isAccounting },
    { title: "Mis Liquidaciones", icon: Wallet, href: "/technician/settlements", show: isTech },
    { title: "Bitácora", icon: ClipboardList, href: "/requests", show: true },
    { title: "Calendario", icon: CalendarDays, href: "/calendar", show: true },
    { title: "Inventario / Stock", icon: Package, href: "/inventory", show: true },
  ]

  const adminItems = [
    { title: "Empresas", icon: Briefcase, href: "/companies", show: isAdmin },
    { title: "Técnicos", icon: Users, href: "/technicians", show: isAdmin },
    { title: "Gestión Usuarios", icon: UserCog, href: "/admin/users", show: isAdmin },
  ]

  const accountItems = [
    { title: "Actualizar datos", icon: RefreshCw, href: "/profile", show: true },
  ]

  const displayName = isLoading 
    ? "Cargando..." 
    : profile 
      ? `${profile.firstName} ${profile.lastName}` 
      : (user?.displayName || "Usuario RYS")

  return (
    <Sidebar variant="sidebar" collapsible="offcanvas" className="bg-white border-r shadow-xl">
      <SidebarHeader className="p-6">
        <Link 
          href="/profile" 
          onClick={closeSidebar}
          className="flex items-center gap-4 group transition-all hover:bg-slate-50 p-2 rounded-xl"
        >
          <Avatar className="h-12 w-12 border-2 border-primary/20 shadow-md group-hover:scale-105 transition-transform">
            <AvatarImage src={`https://picsum.photos/seed/${user?.uid || '1'}/100/100`} />
            <AvatarFallback className="bg-primary text-primary-foreground font-bold text-lg">
              {profile?.firstName?.charAt(0) || user?.email?.charAt(0).toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col overflow-hidden text-left">
            <span className="text-sm font-black truncate text-slate-900 group-hover:text-primary transition-colors">
              {displayName}
            </span>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              {role}
            </span>
          </div>
        </Link>
      </SidebarHeader>
      
      <SidebarSeparator className="mx-4 opacity-50" />

      <SidebarContent className="px-3 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="px-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
            Navegación
          </SidebarGroupLabel>
          <SidebarMenu>
            {navigationItems.filter(i => i.show).map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-4 py-6 transition-all duration-300",
                    pathname === item.href 
                      ? "bg-primary text-primary-foreground font-bold shadow-lg scale-[1.02]" 
                      : "text-slate-600 hover:bg-slate-50 hover:text-primary"
                  )}
                >
                  <Link href={item.href} onClick={closeSidebar}>
                    <item.icon className={cn("h-5 w-5", pathname === item.href ? "text-white" : "text-slate-400")} />
                    <span className="text-sm font-medium">{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup className="mt-4">
            <SidebarGroupLabel className="px-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
              Administración
            </SidebarGroupLabel>
            <SidebarMenu>
              {adminItems.filter(i => i.show).map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-4 py-6 transition-all duration-300",
                      pathname === item.href 
                        ? "bg-primary/10 text-primary font-bold" 
                        : "text-slate-600 hover:bg-slate-50 hover:text-primary"
                    )}
                  >
                    <Link href={item.href} onClick={closeSidebar}>
                      <item.icon className="h-5 w-5 text-slate-400" />
                      <span className="text-sm font-medium">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        )}

        <SidebarGroup className="mt-4">
          <SidebarGroupLabel className="px-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
            Configuración
          </SidebarGroupLabel>
          <SidebarMenu>
            {accountItems.filter(i => i.show).map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-4 py-6 transition-all duration-300",
                    pathname === item.href 
                      ? "bg-primary/10 text-primary font-bold" 
                      : "text-slate-600 hover:bg-slate-50 hover:text-primary"
                  )}
                >
                  <Link href={item.href} onClick={closeSidebar}>
                    <item.icon className="h-5 w-5 text-slate-400" />
                    <span className="text-sm font-medium">{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 mt-auto space-y-4">
        <div className="px-4 space-y-2">
          <a 
            href="https://www.rysplomeria.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-[10px] font-black uppercase text-primary hover:underline"
          >
            <Globe className="h-3 w-3" /> www.rysplomeria.com
          </a>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter flex items-center gap-2">
            <Info className="h-3 w-3" /> RYS SAS v1.0
          </p>
        </div>

        <button 
          onClick={() => {
            handleLogout();
            closeSidebar();
          }}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-4 text-slate-600 hover:bg-destructive/5 hover:text-destructive transition-all group"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 group-hover:bg-destructive/10">
            <LogOut className="h-5 w-5" />
          </div>
          <span className="text-sm font-bold">Cerrar Sesión</span>
        </button>
      </SidebarFooter>
    </Sidebar>
  )
}
