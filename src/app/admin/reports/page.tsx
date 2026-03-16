"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { TrendingUp, Users, ClipboardCheck, DollarSign, Award } from "lucide-react"

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
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-primary">Informes de Productividad</h1>
        <p className="text-muted-foreground">Rendimiento de Atención al Cliente y análisis de costos.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Servicios Creados</CardTitle>
            <ClipboardCheck className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalServices}</div>
            <p className="text-xs text-muted-foreground">Este mes</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Costos Gestionados</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalFinancial.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Mano de obra + Gastos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Eficiencia Media</CardTitle>
            <TrendingUp className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">92%</div>
            <p className="text-xs text-muted-foreground">Cierre de expedientes</p>
          </CardContent>
        </Card>
        <Card className="bg-primary text-primary-foreground">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mejor Desempeño</CardTitle>
            <Award className="h-4 w-4 opacity-70" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">Sofia Rodriguez</div>
            <p className="text-xs opacity-70">15 Expedientes</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Expedientes por Colaborador</CardTitle>
            <CardDescription>Cantidad de servicios creados.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={PRODUCTIVITY_DATA}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: '#f3f4f6' }} />
                <Bar dataKey="services" fill="#1F5BCC" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Detalle de Productividad</CardTitle>
            <CardDescription>Desglose por usuario de Atención al Cliente.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead className="text-center">Servicios</TableHead>
                  <TableHead className="text-right">Total Costos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {PRODUCTIVITY_DATA.map((item) => (
                  <TableRow key={item.name}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{item.services}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      ${item.totalCost.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
