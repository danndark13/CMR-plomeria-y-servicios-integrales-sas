"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Wallet, 
  Users, 
  ChevronRight,
  Printer,
  FileSpreadsheet,
  HandCoins,
  ArrowDown
} from "lucide-react"
import { MOCK_REQUESTS, MOCK_TECHNICIANS, MOCK_COMPANIES } from "@/lib/mock-data"
import Link from "next/link"

export default function PayrollPage() {
  const [selectedTech, setSelectedTech] = useState<string>("all")

  // Flatten interventions and link with their requests for the selected tech
  const payrollData = MOCK_REQUESTS.flatMap(req => 
    req.interventions
      .filter(i => selectedTech === "all" || i.technicianId === selectedTech)
      .map(i => ({
        ...i,
        request: req,
        assistanceName: MOCK_COMPANIES.find(c => c.id === req.companyId)?.name || "N/A",
        // Only attribute the full request advances to the intervention if it's the primary/only one shown
        // In a real app, advances would be linked more precisely.
        requestAdvances: req.advances || []
      }))
  ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const totalLabor = payrollData.reduce((sum, i) => sum + i.laborCost, 0)
  const totalExpenses = payrollData.reduce((sum, i) => sum + i.expenses, 0)
  
  // To avoid double-counting advances if a request has multiple interventions by same tech
  const processedRequests = new Set()
  const totalAdvances = payrollData.reduce((sum, i) => {
    if (processedRequests.has(i.request.id)) return sum
    processedRequests.add(i.request.id)
    return sum + (i.requestAdvances.reduce((s, a) => s + a.amount, 0))
  }, 0)

  const totalToPay = totalLabor - totalExpenses - totalAdvances

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-primary">Nómina y Liquidación</h1>
        <p className="text-muted-foreground">Control de pagos descontando gastos y anticipos entregados.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex flex-1 gap-4 w-full md:max-w-md">
          <Select value={selectedTech} onValueChange={setSelectedTech}>
            <SelectTrigger className="w-full bg-white">
              <Users className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Seleccionar Técnico" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los Técnicos</SelectItem>
              {MOCK_TECHNICIANS.map(t => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Printer className="h-4 w-4" /> Imprimir Recibos
          </Button>
          <Button className="gap-2 bg-green-600 hover:bg-green-700">
            <FileSpreadsheet className="h-4 w-4" /> Exportar Planilla
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
         <Card className="border-l-4 border-l-primary shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase">Mano de Obra</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-black text-primary">
                ${totalLabor.toLocaleString()}
              </div>
            </CardContent>
         </Card>
         <Card className="border-l-4 border-l-orange-500 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase">Gastos/Mat.</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-black text-orange-600">
                ${totalExpenses.toLocaleString()}
              </div>
            </CardContent>
         </Card>
         <Card className="border-l-4 border-l-destructive shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase">Anticipos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-black text-destructive">
                ${totalAdvances.toLocaleString()}
              </div>
            </CardContent>
         </Card>
         <Card className="bg-primary text-primary-foreground shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-bold uppercase opacity-80">Neto a Pagar</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black">
                ${totalToPay.toLocaleString()}
              </div>
            </CardContent>
         </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="bg-muted/30">
          <CardTitle className="text-lg flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Liquidación por Intervención y Expediente
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha / Técnico</TableHead>
                <TableHead>Expediente / Asistencia</TableHead>
                <TableHead className="text-right">M. de Obra</TableHead>
                <TableHead className="text-right">Gastos</TableHead>
                <TableHead className="text-right">Anticipos</TableHead>
                <TableHead className="text-right font-bold text-primary">Neto</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payrollData.map((item) => {
                const tech = MOCK_TECHNICIANS.find(t => t.id === item.technicianId)
                const advances = item.requestAdvances.reduce((s, a) => s + a.amount, 0)
                const net = item.laborCost - item.expenses - advances
                return (
                  <TableRow key={item.id} className="hover:bg-muted/50">
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-muted-foreground">{new Date(item.date).toLocaleDateString()}</span>
                        <span className="font-semibold text-xs">{tech?.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-mono font-bold text-primary text-xs">{item.request.claimNumber}</span>
                        <span className="text-[10px] text-muted-foreground">{item.assistanceName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-green-600">
                      ${item.laborCost.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-orange-600">
                      -${item.expenses.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-destructive">
                      -${advances.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-black text-primary">
                      ${net.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Link href={`/requests/${item.request.id}`}>
                        <Button variant="ghost" size="icon"><ChevronRight className="h-4 w-4" /></Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          {payrollData.length === 0 && (
            <div className="py-20 text-center flex flex-col items-center text-muted-foreground">
              <Users className="h-12 w-12 opacity-10 mb-2" />
              <p>No hay intervenciones para liquidar.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
