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
  AlertCircle,
  ArrowUpRight
} from "lucide-react"
import { MOCK_REQUESTS, MOCK_COMPANIES } from "@/lib/mock-data"
import { StatusBadge } from "@/components/crm/status-badge"
import { CategoryIcon } from "@/components/crm/category-icon"
import Link from "next/link"
import { Button } from "@/components/ui/button"

const statusData = [
  { name: 'Pendiente', count: MOCK_REQUESTS.filter(r => r.status === 'pending').length, color: '#f59e0b' },
  { name: 'Asignado', count: MOCK_REQUESTS.filter(r => r.status === 'assigned').length, color: '#3b82f6' },
  { name: 'En Progreso', count: MOCK_REQUESTS.filter(r => r.status === 'in_progress').length, color: '#1F5BCC' },
  { name: 'Completado', count: MOCK_REQUESTS.filter(r => r.status === 'completed').length, color: '#10b981' },
]

export default function DashboardPage() {
  const activeRequests = MOCK_REQUESTS.filter(r => r.status !== 'completed' && r.status !== 'cancelled')
  const completedCount = MOCK_REQUESTS.filter(r => r.status === 'completed').length

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Panel de Control</h1>
        <p className="text-muted-foreground">Bienvenido de nuevo. Aquí tienes un resumen de la operación actual.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Servicios Totales</CardTitle>
            <ClipboardList className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{MOCK_REQUESTS.length}</div>
            <p className="text-xs text-muted-foreground">+2 hoy</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Activos</CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeRequests.length}</div>
            <p className="text-xs text-muted-foreground">Requieren atención</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completados</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedCount}</div>
            <p className="text-xs text-muted-foreground">Últimas 24h</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Empresas</CardTitle>
            <AlertCircle className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{MOCK_COMPANIES.length}</div>
            <p className="text-xs text-muted-foreground">Cuentas activas</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Estado de Servicios</CardTitle>
            <CardDescription>Distribución actual de las solicitudes por estado.</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                  <RechartsTooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Servicios Recientes</CardTitle>
              <CardDescription>Últimas solicitudes ingresadas.</CardDescription>
            </div>
            <Link href="/requests">
              <Button variant="ghost" size="sm" className="gap-1">
                Ver todos <ArrowUpRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {MOCK_REQUESTS.slice(0, 5).map((req) => {
                const companyName = MOCK_COMPANIES.find(c => c.id === req.companyId)?.name || "Asistencia"
                return (
                  <div key={req.id} className="flex items-center gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent">
                      <CategoryIcon category={req.category} className="h-5 w-5" />
                    </div>
                    <div className="flex flex-1 flex-col overflow-hidden">
                      <p className="text-sm font-bold leading-none truncate text-primary">{req.claimNumber}</p>
                      <p className="text-xs text-muted-foreground truncate">{companyName} • {req.category}</p>
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
  )
}