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
  User
} from "lucide-react"
import { MOCK_REQUESTS, MOCK_COMPANIES, MOCK_TECHNICIANS } from "@/lib/mock-data"
import { StatusBadge } from "@/components/crm/status-badge"
import { CategoryIcon } from "@/components/crm/category-icon"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

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
          <p className="text-muted-foreground">Resumen operativo del día de hoy.</p>
        </div>
        <Link href="/calendar">
          <Button variant="outline" className="gap-2 border-primary text-primary hover:bg-primary/5">
            <CalendarDays className="h-4 w-4" /> Ver Calendario Completo
          </Button>
        </Link>
      </div>

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
        {/* Agenda del día */}
        <Card className="lg:col-span-4 border-accent/20 bg-accent/5">
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
