
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
  History,
  Lock,
  Loader2,
  CheckCircle2
} from "lucide-react"
import { MOCK_REQUESTS, MOCK_TECHNICIANS, MOCK_COMPANIES } from "@/lib/mock-data"
import Link from "next/link"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { useFirestore, useCollection, useMemoFirebase, useUser } from "@/firebase"
import { collection } from "firebase/firestore"

export default function PayrollPage() {
  const db = useFirestore()
  const { user, isUserLoading } = useUser()
  const [selectedTech, setSelectedTech] = useState<string>("all")

  // Fetch real data from Firestore
  const requestsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return collection(db, "service_requests")
  }, [db, user])

  const { data: firestoreRequests, isLoading: isRequestsLoading } = useCollection(requestsQuery)

  // Merge Firestore and Mock for demo consistency
  const allRequests = firestoreRequests 
    ? [...firestoreRequests, ...MOCK_REQUESTS.filter(mr => !firestoreRequests.find(fr => fr.claimNumber === mr.claimNumber))]
    : MOCK_REQUESTS

  // Flatten interventions and link with their requests for the selected tech
  const payrollData = allRequests.flatMap(req => 
    (req.interventions || [])
      .filter(i => selectedTech === "all" || i.technicianId === selectedTech)
      .map(i => ({
        ...i,
        request: req,
        assistanceName: MOCK_COMPANIES.find(c => c.id === req.companyId)?.name || "N/A",
        isValidated: req.billingStatus === 'validated' || req.billingStatus === 'paid',
        usedExpensesTotal: (i.detailedExpenses || []).filter(e => !e.isUnused).reduce((s, e) => s + (e.amount || 0), 0),
        unusedExpensesTotal: (i.detailedExpenses || []).filter(e => e.isUnused).reduce((s, e) => s + (e.amount || 0), 0),
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

  // ONLY sum totals for validated requests
  const validatedData = payrollData.filter(d => d.isValidated)
  const totalLabor = validatedData.reduce((sum, i) => sum + (i.laborCost || 0), 0)
  const totalUsedExpenses = validatedData.reduce((sum, i) => sum + i.usedExpensesTotal, 0)
  
  const processedRequests = new Set()
  const totalAdvances = validatedData.reduce((sum, i) => {
    if (processedRequests.has(i.request.id)) return sum
    processedRequests.add(i.request.id)
    return sum + (i.requestAdvances.reduce((s, a) => s + (a.amount || 0), 0))
  }, 0)

  const totalToPay = totalLabor - totalUsedExpenses - totalAdvances

  const isLoadingTotal = isUserLoading || isRequestsLoading

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-black tracking-tighter text-primary uppercase">Nómina y Liquidación</h1>
        <p className="text-muted-foreground font-medium">Control de pagos basado en expedientes validados por contabilidad.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex flex-1 gap-4 w-full md:max-w-md">
          <Select value={selectedTech} onValueChange={setSelectedTech}>
            <SelectTrigger className="w-full bg-white border-primary/20 h-11">
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
          <Button variant="outline" className="gap-2 font-bold h-11 border-primary text-primary">
            <Printer className="h-4 w-4" /> Imprimir Recibos
          </Button>
          <Button className="gap-2 bg-green-600 hover:bg-green-700 font-bold h-11 shadow-lg">
            <FileSpreadsheet className="h-4 w-4" /> Exportar Planilla
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
         <Card className="border-l-4 border-l-primary shadow-sm bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Mano de Obra Validada</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-black text-primary">
                ${totalLabor.toLocaleString()}
              </div>
            </CardContent>
         </Card>
         <Card className="border-l-4 border-l-orange-500 shadow-sm bg-orange-50/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Gastos Deductibles</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-black text-orange-600">
                ${totalUsedExpenses.toLocaleString()}
              </div>
            </CardContent>
         </Card>
         <Card className="border-l-4 border-l-destructive shadow-sm bg-destructive/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Deducción Anticipos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-black text-destructive">
                ${totalAdvances.toLocaleString()}
              </div>
            </CardContent>
         </Card>
         <Card className="bg-slate-900 text-white shadow-xl border-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-black uppercase opacity-60 tracking-widest">Neto a Pagar</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black text-green-400">
                ${totalToPay.toLocaleString()}
              </div>
            </CardContent>
         </Card>
      </div>

      <Card className="overflow-hidden border-none shadow-md">
        <CardHeader className="bg-slate-50 border-b">
          <CardTitle className="text-sm font-black uppercase flex items-center gap-2 tracking-widest text-slate-600">
            <Wallet className="h-5 w-5 text-primary" />
            Liquidación Detallada por Técnico
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="font-black uppercase text-[10px] tracking-widest">Fecha / Técnico</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest">Expediente</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest text-center">Estado Contable</TableHead>
                  <TableHead className="text-right font-black uppercase text-[10px] tracking-widest">M. Obra</TableHead>
                  <TableHead className="text-right font-black uppercase text-[10px] tracking-widest">Deducciones</TableHead>
                  <TableHead className="text-right font-black uppercase text-[10px] tracking-widest">Neto</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingTotal ? (
                  <TableRow><TableCell colSpan={7} className="h-40 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary/20" /></TableCell></TableRow>
                ) : payrollData.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="h-40 text-center text-muted-foreground italic font-medium">No hay reportes técnicos registrados para los criterios seleccionados.</TableCell></TableRow>
                ) : payrollData.map((item) => {
                  const tech = MOCK_TECHNICIANS.find(t => t.id === item.technicianId)
                  const advances = item.requestAdvances.reduce((s, a) => s + (a.amount || 0), 0)
                  const net = (item.laborCost || 0) - item.usedExpensesTotal - advances
                  
                  return (
                    <TableRow key={item.id} className={cn("hover:bg-primary/5 border-b", !item.isValidated && "bg-slate-50/50")}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{new Date(item.date).toLocaleDateString()}</span>
                          <span className="font-bold text-xs text-slate-800">{tech?.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-mono font-black text-primary text-xs">{item.request.claimNumber}</span>
                          <span className="text-[10px] text-muted-foreground font-medium uppercase">{item.assistanceName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {item.isValidated ? (
                          <Badge className="bg-green-600 text-white font-black uppercase text-[9px] tracking-widest py-1 px-3">
                            <CheckCircle2 className="h-2.5 w-2.5 mr-1" /> VALIDADO
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-600 font-black uppercase text-[9px] tracking-widest py-1 px-3">
                            <Lock className="h-2.5 w-2.5 mr-1" /> ABIERTO
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.isValidated ? (
                          <span className="font-mono font-bold text-xs text-green-600">${(item.laborCost || 0).toLocaleString()}</span>
                        ) : (
                          <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">BLOQUEADO</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.isValidated ? (
                          <div className="flex flex-col items-end">
                            <span className="font-mono text-[10px] text-orange-600">Mat: ${item.usedExpensesTotal.toLocaleString()}</span>
                            {advances > 0 && <span className="font-mono text-[10px] text-destructive">Ant: ${advances.toLocaleString()}</span>}
                          </div>
                        ) : (
                          <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">---</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.isValidated ? (
                          <span className="font-mono font-black text-primary text-sm">${net.toLocaleString()}</span>
                        ) : (
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">PENDIENTE</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/requests/${item.request.id}`}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-primary">
                            <ChevronRight className="h-4 w-4" />
                          </Button>
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
    </div>
  )
}
