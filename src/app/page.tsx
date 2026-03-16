
"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer, 
  Cell 
} from "recharts"
import { 
  ClipboardList, 
  Clock, 
  CheckCircle2, 
  CalendarDays,
  ArrowUpRight,
  MapPin,
  User,
  AlertCircle,
  BellRing,
  AlertTriangle,
  Calculator,
  ArrowRight
} from "lucide-react"
import { MOCK_REQUESTS, MOCK_COMPANIES, MOCK_TECHNICIANS, MOCK_REMINDERS } from "@/lib/mock-data"
import { StatusBadge } from "@/components/crm/status-badge"
import { CategoryIcon } from "@/components/crm/category-icon"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const statusData = [
  { name: 'Pendiente', count: MOCK_REQUESTS.filter(r => r.status === 'pending').length, color: '#f59e0b' },
  { name: 'Asignado', count: MOCK_REQUESTS.filter(r => r.status === 'assigned').length, color: '#3b82f6' },
  { name: 'En Progreso', count: MOCK_REQUESTS.filter(r => r.status === 'in_progress').length, color: '#1F5BCC' },
  { name: 'Completado', count: MOCK_REQUESTS.filter(r => r.status === 'completed').length, color: '#10b981' },
]

export default function DashboardPage() {
  const activeRequests = MOCK_REQUESTS.filter(r => r.status !== 'completed' && r.status !== 'cancelled')
  const completedCount = MOCK_REQUESTS.filter(r => r.status === 'completed').length

  // Obtener visitas de hoy
  const todayStr = new Date().toLocaleDateString()
  const todayVisits = MOCK_REQUESTS.flatMap(req => 
    req.interventions
      .filter(i => new Date(i.date).toLocaleDateString() === todayStr)
      .map(i => ({ ...i, request: req }))
  ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Panel de Control</h1>
          <p className="text-muted-foreground">Resumen operativo y accesos administrativos.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/calendar">
            <Button variant="outline" className="gap-2 border-primary text-primary hover:bg-primary/5">
              <CalendarDays className="h-4 w-4" /> Calendario
            </Button>
          </Link>
          <Button className="gap-2">
            <BellRing className="h-4 w-4" /> {MOCK_REMINDERS.length} Alertas
          </Button>
        </div>
      </div>

      {/* ACCESO EXCLUSIVO ADMIN: HUB DE CONTABILIDAD */}
      <Card className="bg-primary border-none text-primary-foreground shadow-xl overflow-hidden relative">
        <div className="absolute right-0 top-0 h-full w-1/3 bg-white/10 skew-x-12 translate-x-12" />
        <CardHeader className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
              <Calculator className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-xl">Gestión Contable</CardTitle>
              <CardDescription className="text-primary-foreground/70">Facturación, Nómina y Conciliación Financiera.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="relative z-10">
          <Link href="/accounting">
            <Button variant="secondary" className="w-full md:w-auto gap-2 bg-white text-primary hover:bg-white/90">
              Ingresar a Contabilidad <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Servicios Totales</CardTitle>
            <ClipboardList className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{MOCK_REQUESTS.length}</div>
            <p className="text-xs text-muted-foreground">Histórico acumulado</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En Gestión</CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeRequests.length}</div>
            <p className="text-xs text-muted-foreground">Pendientes de cierre</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow border-l-4 border-l-accent">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Visitas Hoy</CardTitle>
            <CalendarDays className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayVisits.length}</div>
            <p className="text-xs text-muted-foreground">Programadas para hoy</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completados</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedCount}</div>
            <p className="text-xs text-muted-foreground">Servicios cerrados</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Panel de Alertas y Recordatorios */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <Card className="border-destructive/20 bg-destructive/5">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                Alertas Críticas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {MOCK_REMINDERS.filter(r => r.type === 'critical' || r.type === 'warning').map((reminder) => (
                <div key={reminder.id} className={cn(
                  "p-3 rounded-lg border flex gap-3 items-start",
                  reminder.type === 'critical' ? "bg-destructive/10 border-destructive/20" : "bg-yellow-50 border-yellow-200"
                )}>
                  {reminder.type === 'critical' ? <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" /> : <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />}
                  <div className="flex-1">
                    <p className="text-xs font-bold uppercase">{reminder.title}</p>
                    <p className="text-[11px] text-muted-foreground leading-tight">{reminder.description}</p>
                    {reminder.technicianId && (
                      <Badge variant="outline" className="mt-2 text-[9px] h-4">
                        Técnico: {MOCK_TECHNICIANS.find(t => t.id === reminder.technicianId)?.name}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-accent/20 bg-accent/5">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-accent" />
                Agenda de Hoy
              </CardTitle>
              <Badge variant="secondary" className="bg-accent/20 text-accent-foreground">
                {todayStr}
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {todayVisits.length > 0 ? (
                  todayVisits.map((visit) => {
                    const tech = MOCK_TECHNICIANS.find(t => t.id === visit.technicianId)
                    return (
                      <div key={visit.id} className="p-3 bg-white rounded-lg border shadow-sm space-y-2">
                        <div className="flex justify-between items-start">
                          <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">{visit.request.claimNumber}</span>
                          <span className="text-xs font-mono font-bold text-accent">
                            {new Date(visit.date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-sm font-bold truncate">{visit.request.insuredName}</p>
                        <div className="flex flex-col gap-1 text-[11px] text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" /> {tech?.name}
                          </div>
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {visit.request.address}
                          </div>
                        </div>
                        <Link href={`/requests/${visit.request.id}`}>
                          <Button variant="ghost" size="sm" className="w-full h-7 text-[11px] mt-1 hover:bg-accent/10 text-accent">
                            Ver Servicio
                          </Button>
                        </Link>
                      </div>
                    )
                  })
                ) : (
                  <div className="py-10 text-center text-muted-foreground">
                    <p className="text-sm">No hay visitas para hoy.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Gráfico y Servicios Recientes */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Estado de Servicios</CardTitle>
            </CardHeader>
            <CardContent className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} />
                  <RechartsTooltip cursor={{ fill: '#f3f4f6' }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Últimos Ingresos</CardTitle>
              <Link href="/requests">
                <Button variant="ghost" size="sm" className="gap-1">
                  Ver todos <ArrowUpRight className="h-3 w-3" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {MOCK_REQUESTS.slice(0, 4).map((req) => {
                  const companyName = MOCK_COMPANIES.find(c => c.id === req.companyId)?.name || "Asistencia"
                  return (
                    <div key={req.id} className="flex items-center gap-4">
                      <div className="h-9 w-9 shrink-0 flex items-center justify-center rounded-full bg-accent/20 text-accent">
                        <CategoryIcon category={req.category} className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate text-primary">{req.claimNumber}</p>
                        <p className="text-xs text-muted-foreground">{companyName} • {req.category}</p>
                      </div>
                      <StatusBadge status={req.status} />
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
