
"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { 
  Wallet, 
  ChevronRight,
  ArrowLeft,
  HandCoins,
  History,
  Loader2,
  CheckCircle2,
  Calculator,
  Save,
  DollarSign,
  AlertCircle,
  FileText,
  Hammer,
  ArrowRight,
  Info,
  Car
} from "lucide-react"
import { MOCK_TECHNICIANS } from "@/lib/mock-data"
import { toast } from "@/hooks/use-toast"
import { useFirestore, useCollection, useMemoFirebase, useUser } from "@/firebase"
import { collection, doc, writeBatch } from "firebase/firestore"
import { TechnicianIntervention, ServiceRequest, PayrollRecord, Advance } from "@/lib/types"

export default function PayrollHubPage() {
  const db = useFirestore()
  const { user } = useUser()
  const [selectedTechId, setSelectedTechId] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  
  // Adjustment state
  const [adjustmentAmount, setAdjustmentAmount] = useState(0)
  const [adjustmentReason, setAdjustmentReason] = useState("")

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

  const pendingInterventions = useMemo(() => {
    return (allRequests || []).flatMap(req => 
      (req.interventions || [])
        .filter(i => {
          const isCorrectTech = i.technicianId === selectedTechId
          const notProcessed = i.payrollStatus !== 'processed'
          const caseValidated = req.billingStatus === 'validated'
          const earlyApproved = i.isReadyForPayroll === true
          return isCorrectTech && notProcessed && (caseValidated || earlyApproved)
        })
        .map(i => ({ ...i, request: req }))
    )
  }, [allRequests, selectedTechId])

  const pendingAdvances = useMemo(() => {
    return (allRequests || []).flatMap(req => 
      (req.advances || [])
        .filter(a => !a.isPaidInPayroll)
        .map(a => ({ ...a, request: req }))
    )
  }, [allRequests])

  const totals = useMemo(() => {
    let totalGross = 0
    let totalExpenses = 0
    let totalRentals = 0
    let totalFee = 0
    let accumulatedToSplit = 0
    let totalSimpleVisitBonus = 0 // Parte del técnico por visitas de $20k

    pendingInterventions.forEach(i => {
      const gross = i.reportedValue || 0
      const materialExpenses = (i.detailedExpenses || []).filter(e => !e.isUnused).reduce((s, e) => s + (e.amount || 0), 0)
      let rentals = 0
      if (i.usedRotomartillo) rentals += 80000
      if (i.usedGeofono) rentals += 120000
      const totalDirectCosts = materialExpenses + rentals

      totalGross += gross
      totalExpenses += materialExpenses
      totalRentals += rentals

      // LÓGICA ESPECIAL: Visita Técnica Simple
      if (i.isSimpleVisit) {
        const visitBase = 20000
        const extraGross = Math.max(0, gross - visitBase)
        
        // 1. Visita: $10k para técnico, $10k para empresa (No Fee)
        totalSimpleVisitBonus += (visitBase / 2)
        
        // 2. Extra (escaleras, etc.): Lleva descuento del 10%
        const subtotalExtra = extraGross - totalDirectCosts
        const fee = subtotalExtra > 0 ? subtotalExtra * 0.10 : 0
        const toSplit = subtotalExtra - fee
        
        totalFee += fee
        accumulatedToSplit += toSplit
      } else {
        // LÓGICA ESTÁNDAR
        const subtotalCosts = gross - totalDirectCosts
        const fee = subtotalCosts > 0 ? subtotalCosts * 0.10 : 0
        const toSplit = subtotalCosts - fee

        totalFee += fee
        accumulatedToSplit += toSplit
      }
    })

    const totalAdvances = pendingAdvances.reduce((s, a) => s + (a.amount || 0), 0)
    const technicianBase = (accumulatedToSplit / 2) + totalSimpleVisitBonus
    const netPaid = technicianBase - totalAdvances + adjustmentAmount

    return { 
      totalGross, 
      totalExpenses, 
      totalRentals, 
      totalFee, 
      accumulatedToSplit, 
      totalAdvances,
      technicianBase,
      netPaid,
      totalSimpleVisitBonus
    }
  }, [pendingInterventions, pendingAdvances, adjustmentAmount])

  const handleGeneratePayroll = async () => {
    if (!db || !selectedTechId || pendingInterventions.length === 0) return
    
    setIsProcessing(true)
    const batch = writeBatch(db)
    const payrollId = `LIQ-${Math.random().toString(36).substring(7).toUpperCase()}`
    
    const payrollRecord: PayrollRecord = {
      id: payrollId,
      technicianId: selectedTechId,
      date: new Date().toISOString(),
      totalGross: totals.totalGross,
      feeAmount: totals.totalFee,
      totalRentals: totals.totalRentals,
      totalExpenses: totals.totalExpenses,
      totalAdvances: totals.totalAdvances,
      amountToSplit: totals.accumulatedToSplit,
      netPaid: totals.netPaid,
      adjustmentAmount,
      adjustmentReason,
      itemsCount: pendingInterventions.length,
      processedInterventionIds: pendingInterventions.map(i => i.id),
      processedAdvanceIds: pendingAdvances.map(a => a.id)
    }
    
    batch.set(doc(db, "payroll_history", payrollId), payrollRecord)

    const requestIds = new Set([...pendingInterventions.map(i => i.request.id), ...pendingAdvances.map(a => a.request.id)])
    requestIds.forEach(reqId => {
      const req = (allRequests || []).find(r => r.id === reqId)
      if (!req) return
      
      const updatedInterventions = req.interventions.map(i => {
        const isTarget = pendingInterventions.some(pi => pi.id === i.id && pi.request.id === reqId)
        if (isTarget) {
          return { ...i, payrollStatus: 'processed' as const, payrollId, isReadyForPayroll: false }
        }
        return i
      })
      
      const updatedAdvances = (req.advances || []).map(a => {
        const isTarget = pendingAdvances.some(pa => pa.id === a.id && pa.request.id === reqId)
        if (isTarget) return { ...a, isPaidInPayroll: true, payrollId }
        return a
      })

      batch.update(doc(db, "service_requests", reqId), { 
        interventions: updatedInterventions, 
        advances: updatedAdvances, 
        updatedAt: new Date().toISOString() 
      })
    })

    try {
      await batch.commit()
      toast({ title: "Nómina Liquidada", description: `Liquidación ${payrollId} generada exitosamente.` })
      setAdjustmentAmount(0); setAdjustmentReason(""); setSelectedTechId(null)
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo procesar el pago." })
    } finally {
      setIsProcessing(false)
    }
  }

  if (!selectedTechId) {
    return (
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-primary uppercase">Nómina y Liquidación</h1>
          <p className="text-muted-foreground font-medium">Gestión de pagos técnicos (50/50 RYS). Descuento del 10% aplicado sobre excedentes.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {MOCK_TECHNICIANS.map((tech) => {
            const techPending = (allRequests || []).flatMap(r => r.interventions || [])
              .filter(i => i.technicianId === tech.id && i.payrollStatus !== 'processed' && (i.isReadyForPayroll || (allRequests?.find(r => r.interventions?.includes(i))?.billingStatus === 'validated')))
            
            return (
              <Card key={tech.id} className="hover:shadow-xl transition-all cursor-pointer group border-l-4 border-l-primary" onClick={() => setSelectedTechId(tech.id)}>
                <CardHeader className="pb-4">
                  <Avatar className="h-12 w-12 mb-2"><AvatarImage src={`https://picsum.photos/seed/${tech.id}/100/100`} /><AvatarFallback>{tech.name.substring(0,2)}</AvatarFallback></Avatar>
                  <CardTitle className="text-lg font-black uppercase">{tech.name}</CardTitle>
                  <CardDescription className="text-[10px] font-bold uppercase">{tech.specialties.join(" • ")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center">
                    <Button variant="ghost" className="text-xs font-bold p-0 group-hover:text-primary">Ver Liquidación <ChevronRight className="h-4 w-4" /></Button>
                    {techPending.length > 0 && <Badge className="bg-orange-500">{techPending.length} pendientes</Badge>}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8 pb-20">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => setSelectedTechId(null)} className="rounded-xl border-primary text-primary"><ArrowLeft className="h-5 w-5" /></Button>
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14 border-4 border-white shadow-lg"><AvatarImage src={`https://picsum.photos/seed/${selectedTechId}/100/100`} /></Avatar>
          <div>
            <h1 className="text-3xl font-black tracking-tighter text-primary uppercase">{selectedTech?.name}</h1>
            <p className="text-muted-foreground font-bold text-xs uppercase tracking-widest">Liquidación de Servicios (Visitas Simples + % Variable)</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="bg-slate-50 border-none shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-[9px] font-black uppercase text-slate-400">Bruto Reportado</CardTitle></CardHeader>
              <CardContent><div className="text-xl font-black text-slate-800">${totals.totalGross.toLocaleString()}</div></CardContent>
            </Card>
            <Card className="bg-destructive/5 border-none shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-[9px] font-black uppercase text-destructive/60">Gastos Directos</CardTitle></CardHeader>
              <CardContent><div className="text-xl font-black text-destructive">-${(totals.totalExpenses + totals.totalRentals).toLocaleString()}</div></CardContent>
            </Card>
            <Card className="bg-orange-50 border-none shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-[9px] font-black uppercase text-orange-600/60">Fee RYS (10%)</CardTitle></CardHeader>
              <CardContent><div className="text-xl font-black text-orange-600">-${totals.totalFee.toLocaleString()}</div></CardContent>
            </Card>
            <Card className="bg-primary/5 border-none shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-[9px] font-black uppercase text-primary/60">Bonos Visita Simple</CardTitle></CardHeader>
              <CardContent><div className="text-xl font-black text-primary">${totals.totalSimpleVisitBonus.toLocaleString()}</div></CardContent>
            </Card>
          </div>

          <Card className="shadow-md border-none overflow-hidden">
            <CardHeader className="bg-slate-900 text-white flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-black uppercase tracking-widest">Servicios Listos para Pago</CardTitle>
                <CardDescription className="text-white/40 text-[10px] uppercase font-bold">Desglose de intervenciones individuales</CardDescription>
              </div>
              <Badge className="bg-green-500 text-[10px] font-black">{pendingInterventions.length} REPORTES</Badge>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow className="bg-muted/30">
                  <TableHead className="font-black uppercase text-[10px]">Expediente / Tipo</TableHead>
                  <TableHead className="text-right font-black uppercase text-[10px]">V. Cobro</TableHead>
                  <TableHead className="text-right font-black uppercase text-[10px]">Gastos/Equipos</TableHead>
                  <TableHead className="text-right font-black uppercase text-[10px]">Fee (10%)</TableHead>
                  <TableHead className="text-right font-black uppercase text-[10px]">Neto Técnico</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {pendingInterventions.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic">No hay servicios pendientes por pagar.</TableCell></TableRow>
                  ) : pendingInterventions.map((item) => {
                    const materialExpenses = (item.detailedExpenses || []).filter(e => !e.isUnused).reduce((s, e) => s + (e.amount || 0), 0)
                    let rentals = 0
                    if (item.usedRotomartillo) rentals += 80000
                    if (item.usedGeofono) rentals += 120000
                    const totalCosts = materialExpenses + rentals
                    
                    let techNet = 0
                    let fee = 0
                    
                    if (item.isSimpleVisit) {
                      const visitBase = 20000
                      const extra = Math.max(0, item.reportedValue - visitBase)
                      const subtotalExtra = extra - totalCosts
                      fee = subtotalExtra > 0 ? subtotalExtra * 0.10 : 0
                      techNet = (visitBase / 2) + ((subtotalExtra - fee) / 2)
                    } else {
                      const subtotal = item.reportedValue - totalCosts
                      fee = subtotal > 0 ? subtotal * 0.10 : 0
                      techNet = (subtotal - fee) / 2
                    }

                    return (
                      <TableRow key={item.id} className={cn(item.isSimpleVisit && "bg-orange-50/30")}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-mono font-black text-primary text-xs">{item.request.claimNumber}</span>
                            <div className="flex gap-1 items-center">
                              <span className="text-[8px] font-bold text-slate-400 uppercase">{item.type}</span>
                              {item.isSimpleVisit && <Badge className="h-3 text-[7px] bg-orange-100 text-orange-700 gap-1"><Car className="h-2 w-2" /> SIMPLE</Badge>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-slate-700">${(item.reportedValue || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right font-mono text-xs text-destructive">-${totalCosts.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-mono text-xs text-orange-600">-${fee.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-mono font-black text-primary">${techNet.toLocaleString()}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-white shadow-2xl border-t-8 border-t-primary h-fit sticky top-24">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-black uppercase tracking-tighter flex items-center gap-2 text-primary">
              <Calculator className="h-5 w-5" /> Liquidación Final
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="flex justify-between text-xs font-bold uppercase text-slate-500"><span>Base Partición:</span><span className="font-mono">${totals.accumulatedToSplit.toLocaleString()}</span></div>
              <div className="flex justify-between text-xs font-bold uppercase text-slate-500"><span>Bonos Visita Directos:</span><span className="font-mono">${totals.totalSimpleVisitBonus.toLocaleString()}</span></div>
              <div className="flex justify-between text-xs font-black uppercase text-primary border-t pt-2"><span>Total Técnico (Antes de Anticipos):</span><span className="font-mono">${totals.technicianBase.toLocaleString()}</span></div>
              
              <div className="pt-2 border-t border-dashed space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <HandCoins className="h-4 w-4 text-destructive" />
                    <span className="text-[10px] font-black uppercase text-destructive">Anticipos a descontar</span>
                  </div>
                  <span className="font-mono font-bold text-destructive">-${totals.totalAdvances.toLocaleString()}</span>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-primary">Ajuste Manual (+/-)</Label>
                  <div className="relative"><DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-primary" /><Input type="number" value={adjustmentAmount} onChange={(e) => setAdjustmentAmount(Number(e.target.value))} className="pl-7 font-black border-primary/20 h-10" /></div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase">Motivo del Ajuste</Label>
                  <Input placeholder="Ej. Bonificación eficiencia" value={adjustmentReason} onChange={(e) => setAdjustmentReason(e.target.value)} className="h-10 text-xs" />
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-900 rounded-2xl text-white shadow-xl space-y-1">
              <p className="text-[10px] font-black uppercase text-white/40 tracking-[0.2em]">Neto a Pagar Técnico</p>
              <p className="text-4xl font-black text-green-400">${totals.netPaid.toLocaleString()}</p>
            </div>

            <div className="flex items-center gap-2 p-3 bg-blue-50 text-blue-700 rounded-lg text-[9px] font-bold uppercase leading-tight border border-blue-100">
              <Info className="h-4 w-4 shrink-0" />
              Las visitas simples se pagan $10.000 directos al técnico sin aplicar el descuento administrativo del 10%.
            </div>

            <Button className="w-full h-14 font-black text-sm uppercase tracking-widest shadow-lg bg-green-600 hover:bg-green-700" onClick={handleGeneratePayroll} disabled={isProcessing || pendingInterventions.length === 0}>
              {isProcessing ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Save className="h-5 w-5 mr-2" />} FINALIZAR Y LIQUIDAR
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
