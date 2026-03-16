
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { 
  Wallet, 
  Users, 
  ChevronRight,
  Printer,
  FileSpreadsheet,
  HandCoins,
  Package,
  Wrench,
  AlertCircle,
  ShieldAlert,
  History
} from "lucide-react"
import { MOCK_REQUESTS, MOCK_TECHNICIANS, MOCK_COMPANIES } from "@/lib/mock-data"
import Link from "next/link"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

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
        usedExpensesTotal: i.detailedExpenses.filter(e => !e.isUnused).reduce((s, e) => s + e.amount, 0),
        unusedExpensesTotal: i.detailedExpenses.filter(e => e.isUnused).reduce((s, e) => s + e.amount, 0),
        requestAdvances: req.advances || []
      }))
  ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const handleToggleInventory = (expenseId: string, isNowInventory: boolean) => {
    toast({
      title: isNowInventory ? "Trasladado a Inventario" : "Cargado al Servicio",
      description: isNowInventory 
        ? "El material ya no se cobrará al servicio y quedará registrado como inventario del técnico."
        : "El material se descontará del pago del técnico y se cargará al costo del servicio."
    })
  }

  const totalLabor = payrollData.reduce((sum, i) => sum + i.laborCost, 0)
  const totalUsedExpenses = payrollData.reduce((sum, i) => sum + i.usedExpensesTotal, 0)
  
  const processedRequests = new Set()
  const totalAdvances = payrollData.reduce((sum, i) => {
    if (processedRequests.has(i.request.id)) return sum
    processedRequests.add(i.request.id)
    return sum + (i.requestAdvances.reduce((s, a) => s + a.amount, 0))
  }, 0)

  const totalToPay = totalLabor - totalUsedExpenses - totalAdvances

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-primary">Nómina y Liquidación</h1>
        <p className="text-muted-foreground">Control de pagos, gestión de inventario y deducción de anticipos.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex flex-1 gap-4 w-full md:max-w-md">
          <Select value={selectedTech} onValueChange={setSelectedTech}>
            <SelectTrigger className="w-full bg-white border-primary/20">
              <Users className="h-4 w-4 mr-2 text-primary" />
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
         <Card className="border-l-4 border-l-primary shadow-sm bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase">Mano de Obra</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-black text-primary">
                ${totalLabor.toLocaleString()}
              </div>
            </CardContent>
         </Card>
         <Card className="border-l-4 border-l-orange-500 shadow-sm bg-orange-50/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase">Gastos Materiales</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-black text-orange-600">
                ${totalUsedExpenses.toLocaleString()}
              </div>
            </CardContent>
         </Card>
         <Card className="border-l-4 border-l-destructive shadow-sm bg-destructive/5">
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
              <CardTitle className="text-[10px] font-bold uppercase opacity-80">Neto a Transferir</CardTitle>
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
            Liquidación Detallada por Técnico
          </CardTitle>
          <CardDescription>Audite los gastos extra y determine el cobro final.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha / Técnico</TableHead>
                  <TableHead>Expediente / Asistencia</TableHead>
                  <TableHead>Gestión de Materiales y Auditoría</TableHead>
                  <TableHead className="text-right">M. de Obra</TableHead>
                  <TableHead className="text-right">Neto</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payrollData.map((item) => {
                  const tech = MOCK_TECHNICIANS.find(t => t.id === item.technicianId)
                  const advances = item.requestAdvances.reduce((s, a) => s + a.amount, 0)
                  const net = item.laborCost - item.usedExpensesTotal - advances
                  
                  return (
                    <TableRow key={item.id} className="hover:bg-muted/50 border-b">
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
                      <TableCell>
                        <div className="space-y-2 max-w-[400px]">
                          {item.detailedExpenses.map(exp => (
                            <div key={exp.id} className={cn(
                              "flex flex-col p-2 rounded bg-white border text-[10px]",
                              exp.isApprovedExtra ? "border-blue-200 bg-blue-50/20" : ""
                            )}>
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex flex-col">
                                  <span className="font-bold flex items-center gap-1">
                                    {exp.description} 
                                    {exp.isApprovedExtra && <ShieldAlert className="h-2.5 w-2.5 text-blue-600" />}
                                  </span>
                                  <span className="text-muted-foreground">${exp.amount.toLocaleString()}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Label className="text-[9px]">{exp.isUnused ? 'Inventario' : 'Cobrar'}</Label>
                                  <Switch 
                                    size="sm"
                                    checked={!exp.isUnused}
                                    onCheckedChange={(v) => handleToggleInventory(exp.id, !v)}
                                  />
                                </div>
                              </div>
                              
                              {exp.isApprovedExtra && (
                                <div className="mt-1 flex items-center gap-1.5 p-1 bg-blue-100/50 rounded text-[8px] font-bold text-blue-700">
                                  <History className="h-2 w-2" />
                                  APROBACIÓN EXTRA: {exp.approvedByUserId} • {new Date(exp.approvedAt!).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                          ))}
                          {item.detailedExpenses.length === 0 && <span className="text-muted-foreground italic text-xs">Sin materiales</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-green-600">
                        ${item.laborCost.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end">
                          <span className="font-mono font-bold text-primary text-sm">${net.toLocaleString()}</span>
                          {advances > 0 && <span className="text-[9px] text-destructive">Anticipos: -${advances.toLocaleString()}</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Link href={`/requests/${item.request.id}?mode=accounting`}>
                          <Button variant="ghost" size="icon"><ChevronRight className="h-4 w-4" /></Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Panel de Inventario Activo del Técnico Seleccionado */}
      {selectedTech !== "all" && (
        <Card className="border-orange-200 bg-orange-50/20">
          <CardHeader>
            <CardTitle className="text-md flex items-center gap-2 text-orange-700">
              <Package className="h-5 w-5" />
              Inventario Activo: {MOCK_TECHNICIANS.find(t => t.id === selectedTech)?.name}
            </CardTitle>
            <CardDescription>Materiales que el técnico tiene en su poder y no han sido cargados a servicios.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-3">
               {MOCK_TECHNICIANS.find(t => t.id === selectedTech)?.inventory?.map(item => (
                 <div key={item.id} className="p-3 bg-white border rounded-lg shadow-sm flex justify-between items-center">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold">{item.description}</span>
                      <span className="text-[10px] text-muted-foreground">Cantidad: {item.quantity}</span>
                    </div>
                    <Badge variant="outline" className="text-[9px] bg-orange-100 text-orange-700">En stock</Badge>
                 </div>
               ))}
               {(!MOCK_TECHNICIANS.find(t => t.id === selectedTech)?.inventory || MOCK_TECHNICIANS.find(t => t.id === selectedTech)?.inventory?.length === 0) && (
                 <div className="col-span-3 py-6 text-center text-muted-foreground text-sm italic">
                   Este técnico no tiene materiales registrados en inventario.
                 </div>
               )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
