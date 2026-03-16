"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { 
  Wallet, 
  Users, 
  ChevronRight,
  ArrowLeft,
  HandCoins,
  History,
  Lock,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Calculator,
  Save,
  DollarSign,
  Plus
} from "lucide-react"
import { MOCK_TECHNICIANS, MOCK_COMPANIES } from "@/lib/mock-data"
import { toast } from "@/hooks/use-toast"
import { useFirestore, useCollection, useMemoFirebase, useUser } from "@/firebase"
import { collection, doc, setDoc, writeBatch, serverTimestamp } from "firebase/firestore"
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'
import { TechnicianIntervention, ServiceRequest, PayrollRecord, Advance } from "@/lib/types"

export default function PayrollHubPage() {
  const db = useFirestore()
  const { user, isUserLoading } = useUser()
  const [selectedTechId, setSelectedTechId] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  // Fetch data
  const requestsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return collection(db, "service_requests")
  }, [db, user])
  const { data: allRequests, isLoading: isRequestsLoading } = useCollection(requestsQuery)

  const payrollQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return collection(db, "payroll_history")
  }, [db, user])
  const { data: payrollHistory, isLoading: isHistoryLoading } = useCollection(payrollQuery)

  const selectedTech = MOCK_TECHNICIANS.find(t => t.id === selectedTechId)

  // Process data for the selected technician
  const interventions = (allRequests || []).flatMap(req => 
    (req.interventions || [])
      .filter(i => i.technicianId === selectedTechId)
      .map(i => ({ ...i, request: req }))
  )

  const pendingInterventions = interventions.filter(i => 
    i.request.billingStatus === 'validated' && i.payrollStatus !== 'processed'
  )

  const openInterventions = interventions.filter(i => 
    i.request.billingStatus !== 'validated' && i.request.billingStatus !== 'paid'
  )

  const advances = (allRequests || []).flatMap(req => 
    (req.advances || [])
      .filter(a => !a.isPaidInPayroll) // Solo anticipos no liquidados aún
      .map(a => ({ ...a, request: req }))
  )

  const handleGeneratePayroll = async () => {
    if (!db || !selectedTechId || pendingInterventions.length === 0) return
    
    setIsProcessing(true)
    const batch = writeBatch(db)
    const payrollId = Math.random().toString(36).substring(7).toUpperCase()
    
    const totalLabor = pendingInterventions.reduce((s, i) => s + (i.laborCost || 0), 0)
    const totalExpenses = pendingInterventions.reduce((s, i) => s + (i.detailedExpenses || []).reduce((se, e) => se + (e.amount || 0), 0), 0)
    const totalAdvances = advances.reduce((s, a) => s + (a.amount || 0), 0)
    const netPaid = totalLabor - totalAdvances

    // 1. Create payroll record
    const payrollRecord: PayrollRecord = {
      id: payrollId,
      technicianId: selectedTechId,
      date: new Date().toISOString(),
      totalLabor,
      totalExpenses,
      totalAdvances,
      netPaid,
      itemsCount: pendingInterventions.length,
      processedInterventionIds: pendingInterventions.map(i => i.id),
      processedAdvanceIds: advances.map(a => a.id)
    }
    batch.set(doc(db, "payroll_history", payrollId), payrollRecord)

    // 2. Mark interventions and advances as processed in their respective requests
    // Nota: Esto requiere iterar por cada solicitud para actualizar el arreglo completo
    const requestIds = new Set([...pendingInterventions.map(i => i.request.id), ...advances.map(a => a.request.id)])
    
    requestIds.forEach(reqId => {
      const req = allRequests?.find(r => r.id === reqId)
      if (!req) return

      const updatedInterventions = req.interventions.map(i => {
        if (i.technicianId === selectedTechId && i.payrollStatus !== 'processed' && req.billingStatus === 'validated') {
          return { ...i, payrollStatus: 'processed' as const, payrollId }
        }
        return i
      })

      const updatedAdvances = (req.advances || []).map(a => {
        // En una app real, los anticipos se asocian a técnicos. Aquí asumimos el técnico actual.
        return { ...a, isPaidInPayroll: true, payrollId }
      })

      batch.update(doc(db, "service_requests", reqId), {
        interventions: updatedInterventions,
        advances: updatedAdvances,
        updatedAt: new Date().toISOString()
      })
    })

    try {
      await batch.commit()
      toast({ title: "Nómina Generada", description: `Liquidación #${payrollId} guardada correctamente.` })
    } catch (error: any) {
      console.error(error)
      const permissionError = new FirestorePermissionError({
        path: "payroll_history",
        operation: "create",
      })
      errorEmitter.emit("permission-error", permissionError)
    } finally {
      setIsProcessing(false)
    }
  }

  const isLoading = isUserLoading || isRequestsLoading || isHistoryLoading

  if (!selectedTechId) {
    return (
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-primary uppercase">Nómina y Pagos</h1>
          <p className="text-muted-foreground font-medium">Gestión individualizada de liquidaciones para técnicos.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {MOCK_TECHNICIANS.map((tech) => (
            <Card 
              key={tech.id} 
              className="hover:shadow-xl transition-all cursor-pointer group border-l-4 border-l-primary"
              onClick={() => setSelectedTechId(tech.id)}
            >
              <CardHeader className="pb-4">
                <Avatar className="h-12 w-12 border-2 border-primary/20 mb-2">
                  <AvatarImage src={`https://picsum.photos/seed/tech-${tech.id}/100/100`} />
                  <AvatarFallback>{tech.name.substring(0,2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <CardTitle className="text-lg uppercase font-black">{tech.name}</CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-tighter">
                  {tech.specialties.join(" • ")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="ghost" className="w-full justify-between text-xs font-bold p-0 group-hover:text-primary">
                  Gestionar Liquidación <ChevronRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  const historyForTech = (payrollHistory || []).filter(h => h.technicianId === selectedTechId).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return (
    <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-right-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => setSelectedTechId(null)} className="rounded-xl border-primary text-primary">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14 border-4 border-white shadow-lg">
              <AvatarImage src={`https://picsum.photos/seed/tech-${selectedTechId}/100/100`} />
              <AvatarFallback>{selectedTech?.name.substring(0,2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-3xl font-black tracking-tighter text-primary uppercase">{selectedTech?.name}</h1>
              <p className="text-muted-foreground font-bold text-xs uppercase tracking-widest">Panel de Pago Personal</p>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-[500px] mb-6 h-12 bg-slate-100 p-1">
          <TabsTrigger 
            value="pending" 
            className="font-black uppercase tracking-widest text-[11px] data-[state=active]:bg-primary data-[state=active]:text-white h-full transition-all"
          >
            PENDIENTE POR PAGAR
          </TabsTrigger>
          <TabsTrigger 
            value="history" 
            className="font-black uppercase tracking-widest text-[11px] data-[state=active]:bg-slate-900 data-[state=active]:text-white h-full transition-all"
          >
            HISTORIAL DE PAGOS
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-4">
            <Card className="bg-primary/5 border-l-4 border-l-primary">
              <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Mano de Obra Validada</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black text-primary">${pendingInterventions.reduce((s,i) => s+(i.laborCost || 0), 0).toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card className="bg-destructive/5 border-l-4 border-l-destructive">
              <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Anticipos Pendientes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black text-destructive">${advances.reduce((s,a) => s+(a.amount || 0), 0).toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card className="bg-slate-900 text-white md:col-span-2 shadow-xl border-none">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                   <CardTitle className="text-[10px] font-black uppercase opacity-60 tracking-widest">Total a Liquidar Hoy</CardTitle>
                   <Calculator className="h-4 w-4 opacity-40" />
                </div>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <div className="text-3xl font-black text-green-400">
                  ${(pendingInterventions.reduce((s,i) => s+(i.laborCost || 0), 0) - advances.reduce((s,a) => s+(a.amount || 0), 0)).toLocaleString()}
                </div>
                <Button 
                  className="bg-green-600 hover:bg-green-700 font-black h-12 px-8 shadow-lg"
                  onClick={handleGeneratePayroll}
                  disabled={isProcessing || pendingInterventions.length === 0}
                >
                  {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />} GENERAR NÓMINA
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-8 space-y-6">
              <Card className="shadow-md border-none overflow-hidden">
                <CardHeader className="bg-slate-50 border-b">
                  <CardTitle className="text-sm font-black uppercase flex items-center gap-2 tracking-widest">
                    <CheckCircle2 className="h-5 w-5 text-green-600" /> Expedientes Validados (Para Pago)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/20">
                        <TableHead className="font-black uppercase text-[10px]">Expediente</TableHead>
                        <TableHead className="font-black uppercase text-[10px]">Fecha</TableHead>
                        <TableHead className="text-right font-black uppercase text-[10px]">M. Obra</TableHead>
                        <TableHead className="text-right font-black uppercase text-[10px]">Gastos</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingInterventions.length === 0 ? (
                        <TableRow><TableCell colSpan={4} className="h-32 text-center text-muted-foreground italic">No hay servicios validados pendientes por pagar.</TableCell></TableRow>
                      ) : pendingInterventions.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-mono font-black text-primary">{item.request.claimNumber}</span>
                              <span className="text-[10px] font-bold uppercase text-muted-foreground">{item.request.insuredName}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs font-medium text-slate-500">{new Date(item.date).toLocaleDateString()}</TableCell>
                          <TableCell className="text-right font-mono font-bold text-green-600">${(item.laborCost || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right font-mono text-xs text-orange-600">${(item.detailedExpenses || []).reduce((s,e) => s+e.amount, 0).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card className="border-dashed shadow-none bg-slate-50/30">
                <CardHeader className="pb-3 border-b border-dashed">
                  <CardTitle className="text-sm font-black uppercase flex items-center gap-2 text-slate-400">
                    <Lock className="h-4 w-4" /> Expedientes Abiertos (No Validados)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableBody>
                      {openInterventions.length === 0 ? (
                        <TableRow><TableCell className="h-20 text-center text-[10px] font-bold text-slate-300 uppercase italic">Sin servicios en campo actualmente</TableCell></TableRow>
                      ) : openInterventions.map((item) => (
                        <TableRow key={item.id} className="opacity-50 grayscale">
                          <TableCell className="py-2">
                             <span className="font-mono font-bold text-[11px] mr-4">{item.request.claimNumber}</span>
                             <span className="text-[10px] font-black uppercase tracking-widest">{item.request.insuredName}</span>
                          </TableCell>
                          <TableCell className="text-right py-2">
                            <Badge variant="outline" className="text-[9px] font-black uppercase">Pendiente Validación</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-4 space-y-6">
              <Card className="border-t-4 border-t-destructive shadow-lg">
                <CardHeader>
                  <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                    <HandCoins className="h-4 w-4 text-destructive" /> Descuento por Anticipos
                  </CardTitle>
                  <CardDescription className="text-[10px]">Valores entregados que se debitarán de este pago.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                   {advances.length === 0 ? (
                     <div className="py-8 text-center bg-slate-50 rounded-lg border border-dashed">
                        <p className="text-[10px] font-bold text-slate-400 uppercase italic">No hay anticipos registrados</p>
                     </div>
                   ) : advances.map(adv => (
                     <div key={adv.id} className="flex items-center justify-between p-3 bg-destructive/5 rounded-lg border border-destructive/10">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-destructive uppercase leading-tight">{adv.reason}</span>
                          <span className="text-[9px] font-bold text-muted-foreground">{new Date(adv.date).toLocaleDateString()}</span>
                        </div>
                        <span className="font-mono font-black text-destructive">-${adv.amount.toLocaleString()}</span>
                     </div>
                   ))}
                   
                   <div className="pt-4 border-t flex justify-between items-center">
                      <span className="text-xs font-black uppercase">Total Deducciones</span>
                      <span className="text-lg font-black text-destructive">-${advances.reduce((s,a) => s+a.amount, 0).toLocaleString()}</span>
                   </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history">
          <Card className="shadow-md border-none overflow-hidden">
            <CardHeader className="bg-slate-900 text-white">
              <CardTitle className="text-sm font-black uppercase flex items-center gap-2 tracking-widest">
                <History className="h-5 w-5 text-primary" /> Historial de Pagos Realizados
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="font-black uppercase text-[10px]">ID Liquidación</TableHead>
                    <TableHead className="font-black uppercase text-[10px]">Fecha de Pago</TableHead>
                    <TableHead className="text-center font-black uppercase text-[10px]">Servicios</TableHead>
                    <TableHead className="text-right font-black uppercase text-[10px]">Neto Pagado</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={5} className="h-32 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary/20" /></TableCell></TableRow>
                  ) : historyForTech.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="h-40 text-center text-muted-foreground italic">No se han registrado pagos anteriores para este técnico.</TableCell></TableRow>
                  ) : historyForTech.map((record) => (
                    <TableRow key={record.id} className="hover:bg-primary/5">
                      <TableCell><Badge variant="outline" className="font-mono font-black text-primary">#{record.id}</Badge></TableCell>
                      <TableCell className="text-sm font-medium">{new Date(record.date).toLocaleString()}</TableCell>
                      <TableCell className="text-center font-bold text-slate-600">{record.itemsCount} exp.</TableCell>
                      <TableCell className="text-right font-mono font-black text-green-600">${record.netPaid.toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400"><ChevronRight className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
