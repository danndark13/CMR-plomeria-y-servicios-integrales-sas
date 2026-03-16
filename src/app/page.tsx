
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
  ArrowRight,
  History
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
  
  // Obtener visitas de hoy
  const todayStr = new Date().toLocaleDateString()
  const todayVisits = MOCK_REQUESTS.flatMap(req => 
    req.interventions
      .filter(i => new Date(i.date).toLocaleDateString() === todayStr)
      .map(i => ({ ...i, request: req }))
  ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  // Filtro de técnicos con sobrecarga (más de 3 tareas)
  const overloadedTechs = MOCK_TECHNICIANS.filter(t => t.activeTasks > 3)

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary uppercase">Panel Principal</h1>
          <p className="text-muted-foreground font-medium">Control de servicios, alertas técnicas y agenda diaria.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/calendar">
            <Button variant="outline" className="gap-2 border-primary text-primary hover:bg-primary/5">
              <CalendarDays className="h-4 w-4" /> Ver Calendario Completo
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* COLUMNA 1: ALERTAS DE SOBRECARGA (Técnicos con muchos servicios) */}
        <Card className="border-destructive/20 bg-destructive/5 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Sobrecarga Técnica
            </CardTitle>
            <CardDescription className="text-destructive/70">Técnicos con más de 3 servicios activos.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {overloadedTechs.length > 0 ? (
              overloadedTechs.map((tech) => (
                <div key={tech.id} className="p-3 bg-white rounded-lg border border-destructive/20 flex justify-between items-center shadow-sm">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-800">{tech.name}</span>
                    <span className="text-[10px] text-muted-foreground uppercase">{tech.specialties.join(", ")}</span>
                  </div>
                  <Badge variant="destructive" className="h-6 px-2 animate-pulse">
                    {tech.activeTasks} Activos
                  </Badge>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-muted-foreground text-xs italic">
                Carga de trabajo balanceada.
              </div>
            )}
            
            {/* Otras Alertas Críticas */}
            {MOCK_REMINDERS.filter(r => r.type === 'critical' && !r.technicianId).map((reminder) => (
              <div key={reminder.id} className="p-3 rounded-lg border bg-destructive/10 border-destructive/20 flex gap-3 items-start">
                <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-[11px] font-bold uppercase text-destructive">{reminder.title}</p>
                  <p className="text-[11px] leading-tight">{reminder.description}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* COLUMNA 2: NOTIFICACIONES DE SERVICIOS PROGRAMADOS (Hoy) */}
        <Card className="border-accent/20 bg-accent/5 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-accent-foreground">
              <CalendarDays className="h-5 w-5 text-accent" /> Servicios Hoy
            </CardTitle>
            <CardDescription className="text-accent-foreground/70">Visitas técnicas agendadas para {todayStr}.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {todayVisits.length > 0 ? (
                todayVisits.slice(0, 4).map((visit) => {
                  const tech = MOCK_TECHNICIANS.find(t => t.id === visit.technicianId)
                  return (
                    <div key={visit.id} className="p-3 bg-white rounded-lg border border-accent/20 shadow-sm space-y-2 group hover:border-accent transition-colors">
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">{visit.request.claimNumber}</span>
                        <span className="text-xs font-mono font-bold text-accent">
                          {new Date(visit.date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-sm font-bold truncate">{visit.request.insuredName}</p>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                         <div className="flex items-center gap-1"><User className="h-3 w-3" /> {tech?.name}</div>
                         <Link href={`/requests/${visit.request.id}`}>
                           <Button variant="ghost" size="sm" className="h-6 text-[10px] text-accent font-bold hover:bg-accent/10">Ver Detalle</Button>
                         </Link>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="py-12 text-center text-muted-foreground text-sm italic">
                  No hay visitas para hoy.
                </div>
              )}
              {todayVisits.length > 4 && (
                <Link href="/calendar" className="block text-center text-[11px] font-bold text-accent hover:underline pt-2">
                  + {todayVisits.length - 4} visitas más en el calendario
                </Link>
              )}
            </div>
          </CardContent>
        </Card>

        {/* COLUMNA 3: ÚLTIMOS SERVICIOS CREADOS */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <History className="h-5 w-5 text-primary" /> Últimos Ingresos
            </CardTitle>
            <CardDescription>Expedientes registrados recientemente en el sistema.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {MOCK_REQUESTS.slice(0, 5).map((req) => {
                const companyName = MOCK_COMPANIES.find(c => c.id === req.companyId)?.name || "Asistencia"
                return (
                  <Link href={`/requests/${req.id}`} key={req.id} className="flex items-center gap-4 p-2 rounded-lg hover:bg-muted/50 transition-colors group">
                    <div className="h-9 w-9 shrink-0 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                      <CategoryIcon category={req.category} className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate text-primary">{req.claimNumber}</p>
                      <p className="text-[10px] text-muted-foreground uppercase">{companyName} • {req.category}</p>
                    </div>
                    <StatusBadge status={req.status} />
                  </Link>
                )
              })}
              <Link href="/requests">
                <Button variant="ghost" size="sm" className="w-full mt-2 text-xs gap-2">
                  Ir a Bitácora Completa <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ACCESO EXCLUSIVO ADMIN/CONTABILIDAD: HUB FINANCIERO */}
      <Card className="bg-slate-900 border-none text-white shadow-xl overflow-hidden relative">
        <div className="absolute right-0 top-0 h-full w-1/3 bg-primary/20 skew-x-12 translate-x-12" />
        <CardHeader className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-white/10 rounded-lg flex items-center justify-center backdrop-blur-sm border border-white/20">
              <Calculator className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl">Módulo de Contabilidad</CardTitle>
              <CardDescription className="text-slate-400">Acceso a Facturación, Nómina y Liquidaciones.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="relative z-10 flex gap-4">
          <Link href="/accounting">
            <Button variant="default" className="gap-2 bg-primary hover:bg-primary/90">
              Ingresar al Hub Contable <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/admin/reports">
            <Button variant="outline" className="gap-2 border-white/20 text-white hover:bg-white/10">
              Reportes de Productividad
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
