
"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  LineChart,
  Line,
  Legend
} from "recharts"
import { 
  TrendingUp, 
  TrendingDown,
  DollarSign, 
  Calendar, 
  Filter, 
  ArrowUpRight,
  ArrowDownRight,
  Package,
  Hammer,
  Receipt,
  Users,
  Briefcase,
  Loader2,
  FileText,
  Calculator,
  Building2,
  ChevronRight,
  ArrowLeft
} from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useFirestore, useCollection, useMemoFirebase, useUser } from "@/firebase"
import { collection, query, orderBy } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MOCK_TECHNICIANS } from "@/lib/mock-data"
import { ServiceRequest, PayrollRecord } from "@/lib/types"
import { cn } from "@/lib/utils"
import Link from "next/link"

type TimePeriod = 'today' | 'yesterday' | 'last_week' | 'month' | 'year' | 'semester_1' | 'semester_2' | 'all';

export default function BalanceGeneralPage() {
  const db = useFirestore()
  const { user } = useUser()
  const [period, setPeriod] = useState<TimePeriod>('month')
  const [techFilter, setTechFilter] = useState<string>('ALL')

  // 1. Fetch Data
  const requestsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return collection(db, "service_requests")
  }, [db, user])
  const { data: allRequests, isLoading: loadingReq } = useCollection(requestsQuery)

  const payrollQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return collection(db, "payroll_history")
  }, [db, user])
  const { data: payrollHistory, isLoading: loadingPay } = useCollection(payrollQuery)

  // 2. Helper for date filtering
  const isInPeriod = (dateStr: string, period: TimePeriod) => {
    if (!dateStr) return false
    const date = new Date(dateStr)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    
    switch (period) {
      case 'today':
        return date >= today
      case 'yesterday':
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)
        return date >= yesterday && date < today
      case 'last_week':
        const lastWeek = new Date(today)
        lastWeek.setDate(lastWeek.getDate() - 7)
        return date >= lastWeek
      case 'month':
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
      case 'year':
        return date.getFullYear() === now.getFullYear()
      case 'semester_1':
        return date.getFullYear() === now.getFullYear() && date.getMonth() <= 5
      case 'semester_2':
        return date.getFullYear() === now.getFullYear() && date.getMonth() > 5
      case 'all':
        return true
      default:
        return true
    }
  }

  // 3. Calculated Metrics
  const stats = useMemo(() => {
    if (!allRequests || !payrollHistory) return null

    const filteredReqs = allRequests.filter(r => 
      isInPeriod(r.createdAt || r.updatedAt, period) && 
      (techFilter === 'ALL' || r.interventions?.some(i => i.technicianId === techFilter))
    )

    const filteredPay = (payrollHistory as PayrollRecord[]).filter(p => 
      isInPeriod(p.date, period) && (techFilter === 'ALL' || p.technicianId === techFilter)
    )

    // Dinero que ha entrado (Total Reportado / Validado)
    const ingresosBrutos = filteredReqs.reduce((s, r) => s + (r.approvedAmount || r.requestedAmount || 0), 0)
    
    // Dinero que ha salido (Pagos netos a técnicos + Materiales de nómina)
    const egresosNomina = filteredPay.reduce((s, p) => s + (p.netPaid || 0), 0)
    const egresosMateriales = filteredPay.reduce((s, p) => s + (p.totalExpenses || 0), 0)
    const totalEgresos = egresosNomina + egresosMateriales

    // Alquileres Ganados
    const ingresosAlquiler = filteredPay.reduce((s, p) => s + (p.totalRentals || 0), 0)

    // Descuento 10%
    const totalFeeRecaudado = filteredPay.reduce((s, p) => s + (p.feeAmount || 0), 0)

    // Bonificaciones (Ajustes positivos en nómina)
    const bonificaciones = filteredPay.reduce((s, p) => s + (p.adjustmentAmount > 0 ? p.adjustmentAmount : 0), 0)

    // Lo que nos deben las empresas (Validated but not Paid in requests)
    const deudaEmpresas = allRequests.filter(r => r.billingStatus === 'validated').reduce((s, r) => s + (r.approvedAmount || 0), 0)

    // Cantidad de expedientes
    const totalExpedientes = filteredReqs.length

    return {
      ingresosBrutos,
      totalEgresos,
      egresosMateriales,
      ingresosAlquiler,
      totalFeeRecaudado,
      bonificaciones,
      deudaEmpresas,
      totalExpedientes,
      egresosNomina
    }
  }, [allRequests, payrollHistory, period, techFilter])

  // 4. Chart Data
  const chartData = useMemo(() => {
    if (!allRequests) return []
    // Simplified: Show last 6 months trend
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    const data = months.map((m, i) => {
      const reqs = (allRequests || []).filter(r => {
        const d = new Date(r.createdAt)
        return d.getMonth() === i && d.getFullYear() === new Date().getFullYear()
      })
      return {
        name: m,
        servicios: reqs.length,
        monto: reqs.reduce((s, r) => s + (r.approvedAmount || r.requestedAmount || 0), 0) / 1000000 // In millions
      }
    })
    return data
  }, [allRequests])

  if (loadingReq || loadingPay) {
    return (
      <div className="flex flex-col items-center justify-center p-20 gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Generando Balance General...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/accounting">
            <Button variant="outline" size="icon" className="rounded-xl border-primary text-primary"><ArrowLeft className="h-5 w-5" /></Button>
          </Link>
          <div>
            <h1 className="text-3xl font-black tracking-tighter text-primary uppercase">Balance y Análisis</h1>
            <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest">Indicadores de rentabilidad y salud financiera</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 bg-white p-2 rounded-2xl shadow-sm border">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-400 ml-2" />
            <Select value={period} onValueChange={(v) => setPeriod(v as TimePeriod)}>
              <SelectTrigger className="w-[160px] h-9 font-bold text-[11px] uppercase border-none shadow-none focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hoy</SelectItem>
                <SelectItem value="yesterday">Ayer</SelectItem>
                <SelectItem value="last_week">Última Semana</SelectItem>
                <SelectItem value="month">Este Mes</SelectItem>
                <SelectItem value="semester_1">1er Semestre</SelectItem>
                <SelectItem value="semester_2">2do Semestre</SelectItem>
                <SelectItem value="year">Todo el Año</SelectItem>
                <SelectItem value="all">Histórico Total</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-px h-6 bg-slate-200 self-center" />
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-slate-400 ml-2" />
            <Select value={techFilter} onValueChange={setTechFilter}>
              <SelectTrigger className="w-[180px] h-9 font-bold text-[11px] uppercase border-none shadow-none focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">TODOS LOS TÉCNICOS</SelectItem>
                {MOCK_TECHNICIANS.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-slate-900 text-white border-none shadow-2xl overflow-hidden relative group">
          <div className="absolute -right-4 -top-4 bg-primary/20 h-24 w-24 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase text-primary tracking-[0.2em] flex items-center justify-between">
              Ingresos Brutos <ArrowUpRight className="h-3 w-3" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black">${stats?.ingresosBrutos.toLocaleString()}</div>
            <p className="text-[9px] font-bold text-white/40 uppercase mt-1">Facturación total reportada</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-none shadow-xl border-l-4 border-l-destructive">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase text-destructive tracking-[0.2em] flex items-center justify-between">
              Egresos Totales <ArrowDownRight className="h-3 w-3" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-slate-800">${stats?.totalEgresos.toLocaleString()}</div>
            <div className="flex gap-2 mt-1">
              <Badge variant="outline" className="text-[8px] border-destructive/20 text-destructive">Nómina: ${(stats?.egresosNomina || 0).toLocaleString()}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-none shadow-xl border-l-4 border-l-blue-600">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase text-blue-600 tracking-[0.2em] flex items-center justify-between">
              Deuda de Empresas <Calculator className="h-3 w-3" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-slate-800">${stats?.deudaEmpresas.toLocaleString()}</div>
            <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Saldo pendiente por cobrar</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-none shadow-xl border-l-4 border-l-primary">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase text-primary tracking-[0.2em] flex items-center justify-between">
              Expedientes <FileText className="h-3 w-3" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-slate-800">{stats?.totalExpedientes}</div>
            <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Servicios gestionados en periodo</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 shadow-md border-none overflow-hidden">
          <CardHeader className="bg-slate-50 border-b flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-black uppercase tracking-widest">Rendimiento Operativo</CardTitle>
              <CardDescription className="text-[10px] font-bold uppercase">Tendencia de ingresos vs volumen de servicios</CardDescription>
            </div>
            <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] font-black uppercase">KPI CRECIMIENTO</Badge>
          </CardHeader>
          <CardContent className="h-[350px] pt-10">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={10} fontWeight="bold" />
                <YAxis axisLine={false} tickLine={false} fontSize={10} />
                <Tooltip 
                  cursor={{ fill: 'rgba(31, 91, 204, 0.05)' }} 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }} 
                />
                <Bar dataKey="monto" fill="#1F5BCC" radius={[6, 6, 0, 0]} barSize={35} name="Ingresos (M)" />
                <Bar dataKey="servicios" fill="#F97316" radius={[6, 6, 0, 0]} barSize={15} name="Cant. Servicios" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="shadow-lg border-t-8 border-t-green-600">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-black uppercase flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" /> Beneficio Operativo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 bg-green-50 rounded-2xl border border-green-100 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase text-slate-500">Rentabilidad Fee (10%):</span>
                  <span className="text-lg font-black text-green-700">${stats?.totalFeeRecaudado.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center border-t border-green-200 pt-2">
                  <span className="text-[10px] font-black uppercase text-slate-500">Ganancia Alquileres:</span>
                  <span className="text-lg font-black text-green-700">${stats?.ingresosAlquiler.toLocaleString()}</span>
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between text-[10px] font-black uppercase">
                  <span className="flex items-center gap-2"><Package className="h-3 w-3 text-primary" /> Gastos Materiales:</span>
                  <span className="text-destructive font-mono">-${stats?.egresosMateriales.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-[10px] font-black uppercase">
                  <span className="flex items-center gap-2"><ArrowUpRight className="h-3 w-3 text-orange-500" /> Bonificaciones:</span>
                  <span className="text-orange-600 font-mono">-${stats?.bonificaciones.toLocaleString()}</span>
                </div>
              </div>

              <div className="pt-4 border-t border-dashed">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[9px] font-black uppercase text-slate-400">Margen Neto Operativo</p>
                    <p className="text-3xl font-black text-slate-900">${((stats?.totalFeeRecaudado || 0) + (stats?.ingresosAlquiler || 0)).toLocaleString()}</p>
                  </div>
                  <Badge className="bg-green-600 font-black h-6 px-3">+{((((stats?.totalFeeRecaudado || 0) + (stats?.ingresosAlquiler || 0)) / (stats?.ingresosBrutos || 1)) * 100).toFixed(1)}%</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-50 border-none shadow-sm overflow-hidden">
            <CardHeader className="pb-2 bg-slate-100/50 border-b">
              <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                <Briefcase className="h-3 w-3" /> Distribución de Cartera
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {['IKE', 'IGS', 'MAWDY'].map(corp => {
                const amount = allRequests?.filter(r => r.companyId === corp).reduce((s, r) => s + (r.approvedAmount || 0), 0) || 0
                const percent = (amount / (stats?.ingresosBrutos || 1)) * 100
                return (
                  <div key={corp} className="space-y-1">
                    <div className="flex justify-between text-[9px] font-black uppercase">
                      <span>{corp} ASISTENCIA</span>
                      <span>{percent.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
