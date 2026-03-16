
"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { 
  TrendingUp, 
  Users, 
  ClipboardCheck, 
  DollarSign, 
  Award, 
  Cloud, 
  Zap, 
  Database,
  Info,
  ShieldCheck,
  ZapOff,
  CheckCircle2
} from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"

const PRODUCTIVITY_DATA = [
  { name: 'Andrés Castro', services: 12, totalCost: 850000, efficiency: '95%' },
  { name: 'Laura Martinez', services: 8, totalCost: 420000, efficiency: '88%' },
  { name: 'Sofia Rodriguez', services: 15, totalCost: 1200000, efficiency: '98%' },
  { name: 'Diego Lopez', services: 5, totalCost: 310000, efficiency: '82%' },
]

export default function AdminReportsPage() {
  const totalServices = PRODUCTIVITY_DATA.reduce((acc, d) => acc + d.services, 0)
  const totalFinancial = PRODUCTIVITY_DATA.reduce((acc, d) => acc + d.totalCost, 0)

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-primary uppercase">Informes de Gestión</h1>
          <p className="text-muted-foreground font-medium">Análisis de rendimiento operativo y salud de la infraestructura.</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-l-4 border-l-primary">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Servicios Creados</CardTitle>
                <ClipboardCheck className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black">{totalServices}</div>
                <p className="text-[10px] text-muted-foreground font-bold uppercase">Este mes</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-green-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Costos Gestionados</CardTitle>
                <DollarSign className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black text-green-600">${totalFinancial.toLocaleString()}</div>
                <p className="text-[10px] text-muted-foreground font-bold uppercase">M. de Obra + Gastos</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-accent">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Eficiencia Media</CardTitle>
                <TrendingUp className="h-4 w-4 text-accent" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black text-accent">92%</div>
                <p className="text-[10px] text-muted-foreground font-bold uppercase">Cierre de expedientes</p>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-md border-none overflow-hidden">
            <CardHeader className="bg-slate-50 border-b">
              <CardTitle className="text-lg font-black uppercase">Rendimiento por Colaborador</CardTitle>
              <CardDescription className="text-xs">Cantidad de expedientes gestionados vs meta mensual.</CardDescription>
            </CardHeader>
            <CardContent className="h-[350px] pt-6">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={PRODUCTIVITY_DATA}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                  <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} fontWeight="bold" />
                  <YAxis axisLine={false} tickLine={false} fontSize={10} />
                  <Tooltip cursor={{ fill: 'rgba(31, 91, 204, 0.05)' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                  <Bar dataKey="services" fill="#1F5BCC" radius={[6, 6, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <Card className="bg-slate-900 text-white shadow-2xl overflow-hidden border-none">
            <CardHeader className="border-b border-white/10 bg-white/5">
              <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-green-400" /> Monitor de Costos $0 USD
              </CardTitle>
              <CardDescription className="text-slate-400 text-[10px]">Capa gratuita de Google Cloud activa.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-black uppercase">
                    <span>Escrituras en Base de Datos</span>
                    <span className="text-green-400">0.1% de 20k/día</span>
                  </div>
                  <Progress value={1} className="h-1 bg-white/10" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-black uppercase">
                    <span>Lecturas de Expedientes</span>
                    <span className="text-green-400">0.5% de 50k/día</span>
                  </div>
                  <Progress value={5} className="h-1 bg-white/10" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-black uppercase">
                    <span>Almacenamiento (1GB Gratis)</span>
                    <span className="text-green-400">Libre</span>
                  </div>
                  <Progress value={2} className="h-1 bg-white/10" />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                <p className="text-[11px] leading-relaxed font-medium">
                  Mientras no superes las <strong className="text-green-400">20,000 escrituras diarias</strong>, tu factura mensual será de <strong className="text-green-400">$0.00 USD</strong>.
                </p>
                <div className="flex items-center gap-2 text-[9px] font-black uppercase text-slate-400">
                  <CheckCircle2 className="h-3 w-3 text-green-500" /> Todo incluido bajo el Plan Blaze
                </div>
              </div>

              <div className="pt-4 border-t border-white/10 flex justify-between items-center">
                <span className="text-xs font-black uppercase">Costo Est. Mes</span>
                <span className="text-2xl font-black text-green-400">$0.00</span>
              </div>
            </CardContent>
          </Card>

          <Alert className="bg-blue-50 border-blue-200">
            <Info className="h-4 w-4 text-primary" />
            <AlertTitle className="text-[10px] font-black uppercase text-primary">Nota sobre IA</AlertTitle>
            <AlertDescription className="text-[10px] text-blue-800">
              El resumen con IA (Gemini Flash) consume "tokens". Resumir 1,000 servicios te costaría menos de un café ($0.10 USD).
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </div>
  )
}
