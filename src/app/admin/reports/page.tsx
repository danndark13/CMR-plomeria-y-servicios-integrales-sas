
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
  ShieldCheck
} from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

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

      <Alert className="bg-blue-50 border-blue-200">
        <Info className="h-4 w-4 text-primary" />
        <AlertTitle className="text-sm font-black uppercase text-primary">Información sobre Publicación</AlertTitle>
        <AlertDescription className="text-xs text-blue-800">
          Publicar esta app en <strong>Firebase App Hosting</strong> (Plan Blaze) suele tener un costo de <strong>$0 USD</strong> para operaciones pequeñas. Solo pagas por uso real después de superar generosas cuotas gratuitas.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
        <Card className="bg-primary text-primary-foreground">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest opacity-70">Líder del Mes</CardTitle>
            <Award className="h-4 w-4 opacity-70" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-black uppercase">{PRODUCTIVITY_DATA[2].name}</div>
            <p className="text-[10px] font-bold opacity-70">15 Expedientes Finalizados</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-8 shadow-md border-none overflow-hidden">
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

        <div className="lg:col-span-4 space-y-6">
          <Card className="shadow-lg border-t-4 border-t-primary overflow-hidden">
            <CardHeader className="bg-slate-50/50">
              <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                <Cloud className="h-4 w-4 text-primary" /> Salud de Infraestructura
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center p-3 bg-white border rounded-lg shadow-sm">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-slate-400" />
                    <span className="text-xs font-bold text-slate-700">Firestore Storage</span>
                  </div>
                  <Badge variant="outline" className="text-[9px] font-black bg-green-50 text-green-700 border-green-200 uppercase">Saludable</Badge>
                </div>
                <div className="flex justify-between items-center p-3 bg-white border rounded-lg shadow-sm">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-slate-400" />
                    <span className="text-xs font-bold text-slate-700">GenAI Summarizer</span>
                  </div>
                  <Badge variant="outline" className="text-[9px] font-black bg-green-50 text-green-700 border-green-200 uppercase">Activo</Badge>
                </div>
                <div className="flex justify-between items-center p-3 bg-white border rounded-lg shadow-sm">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-slate-400" />
                    <span className="text-xs font-bold text-slate-700">Auth Services</span>
                  </div>
                  <Badge variant="outline" className="text-[9px] font-black bg-green-50 text-green-700 border-green-200 uppercase">Seguro</Badge>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed italic border-t pt-3">
                Nota: Esta app utiliza el Plan Blaze de Google Cloud. Los costos son despreciables para este volumen de datos.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 text-white shadow-xl">
            <CardHeader>
              <CardTitle className="text-xs font-black uppercase tracking-widest opacity-70">Estimación de Costo de Publicación</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-[11px] font-bold uppercase">
                  <span>Alojamiento (Hosting)</span>
                  <span className="text-green-400">$0.00 / mes*</span>
                </div>
                <div className="flex justify-between text-[11px] font-bold uppercase">
                  <span>Base de Datos (Firestore)</span>
                  <span className="text-green-400">$0.00 / mes*</span>
                </div>
                <div className="flex justify-between text-[11px] font-bold uppercase">
                  <span>IA (Gemini Flash)</span>
                  <span className="text-green-400">&lt; $0.05 / mes</span>
                </div>
              </div>
              <div className="border-t border-white/10 pt-4 flex justify-between items-center">
                <span className="text-sm font-black uppercase">Costo Total Est.</span>
                <span className="text-xl font-black text-green-400">Gratis**</span>
              </div>
              <p className="text-[8px] opacity-40 leading-tight">
                *Dentro de la capa gratuita de Google Cloud.<br/>
                **Requiere Plan Blaze para habilitar IA y Hosting, pero solo se cobra por uso excedente.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
