
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
import { Checkbox } from "@/components/ui/checkbox"
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
  Car,
  Trash2,
  FileSpreadsheet,
  Download
} from "lucide-react"
import { MOCK_TECHNICIANS } from "@/lib/mock-data"
import { toast } from "@/hooks/use-toast"
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from "@/firebase"
import { collection, doc, writeBatch, deleteDoc, query, where, orderBy } from "firebase/firestore"
import { TechnicianIntervention, ServiceRequest, PayrollRecord, Advance } from "@/lib/types"
import { cn } from "@/lib/utils"

export default function PayrollHubPage() {
  const db = useFirestore()
  const { user } = useUser()
  const [selectedTechId, setSelectedTechId] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedHistoryItems, setSelectedHistoryItems] = useState<string[]>([])
  
  const [adjustmentAmount, setAdjustmentAmount] = useState(0)
  const [adjustmentReason, setAdjustmentReason] = useState("")

  const profileRef = useMemoFirebase(() => {
    if (!user || !db) return null
    return doc(db, "user_profiles", user.uid)
  }, [user, db])
  const { data: profile } = useDoc(profileRef)
  const isDev = profile?.roleId === 'Desarrollador'

  const requestsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return collection(db, "service_requests")
  }, [db, user])
  const { data: allRequests, isLoading: isRequestsLoading } = useCollection(requestsQuery)

  const payrollQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return query(collection(db, "payroll_history"), orderBy("date", "desc"))
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
        .filter(a => a.technicianId === selectedTechId && !a.isPaidInPayroll)
        .map(a => ({ ...a, request: req }))
    )
  }, [allRequests, selectedTechId])

  const totals = useMemo(() => {
    let totalGross = 0
    let totalExpenses = 0
    let totalRentals = 0
    let totalFee = 0
    let accumulatedToSplit = 0
    let totalSimpleVisitBonus = 0 

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

      if (i.isSimpleVisit) {
        const visitBase = 20000
        const extraGross = Math.max(0, gross - visitBase)
        totalSimpleVisitBonus += (visitBase / 2)
        const subtotalExtra = extraGross - totalDirectCosts
        const fee = subtotalExtra > 0 ? subtotalExtra * 0.10 : 0
        const toSplit = subtotalExtra - fee
        totalFee += fee
        accumulatedToSplit += toSplit
      } else {
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

    return { totalGross, totalExpenses, totalRentals, totalFee, accumulatedToSplit, totalAdvances, technicianBase, netPaid, totalSimpleVisitBonus }
  }, [pendingInterventions, pendingAdvances, adjustmentAmount])

  const handleGeneratePayroll = async () => {
    if (!db || !selectedTechId || (pendingInterventions.length === 0 && pendingAdvances.length === 0)) return
    
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
        if (isTarget) return { ...i, payrollStatus: 'processed' as const, payrollId, isReadyForPayroll: false }
        return i
      })
      
      const updatedAdvances = (req.advances || []).map(a => {
        const isTarget = pendingAdvances.some(pa => pa.id === a.id && pa.request.id === reqId)
        if (isTarget) return { ...a, isPaidInPayroll: true, payrollId }
        return a
      })

      batch.update(doc(db, "service_requests", reqId), { interventions: updatedInterventions, advances: updatedAdvances, updatedAt: new Date().toISOString() })
    })

    try {
      await batch.commit()
      toast({ title: "Nómina Liquidada" })
      setAdjustmentAmount(0); setAdjustmentReason(""); setSelectedTechId(null)
    } catch (error) {
      toast({ variant: "destructive", title: "Error" })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDeletePayroll = async (record: PayrollRecord) => {
    if (!db || !isDev) return
    setIsProcessing(true)
    
    try {
      const batch = writeBatch(db)
      const requestsToUpdate = (allRequests || []).filter(req => 
        req.interventions?.some(i => i.payrollId === record.id) ||
        req.advances?.some(a => a.payrollId === record.id)
      )

      requestsToUpdate.forEach(req => {
        const updatedInterventions = req.interventions.map(i => {
          if (i.payrollId === record.id) {
            return { ...i, payrollStatus: 'pending' as const, payrollId: undefined }
          }
          return i
        })
        const updatedAdvances = (req.advances || []).map(a => {
          if (a.payrollId === record.id) {
            return { ...a, isPaidInPayroll: false, payrollId: undefined }
          }
          return a
        })
        batch.update(doc(db, "service_requests", req.id), { interventions: updatedInterventions, advances: updatedAdvances })
      })

      batch.delete(doc(db, "payroll_history", record.id))
      await batch.commit()
      toast({ title: "Registro Eliminado", description: "Los servicios han vuelto a estado pendiente de pago." })
    } catch (e) {
      toast({ variant: "destructive", title: "Error al eliminar" })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleExportSelected = () => {
    if (selectedHistoryItems.length === 0) return
    const records = (payrollHistory || []).filter(r => selectedHistoryItems.includes(r.id))
    
    const headers = ["ID", "TECNICO", "FECHA", "BRUTO", "GASTOS", "FEE", "ADELANTOS", "AJUSTE", "NETO PAGADO"]
    const rows = records.map(r => [
      r.id,
      r.technicianId,
      new Date(r.date).toLocaleDateString(),
      r.totalGross,
      r.totalExpenses + r.totalRentals,
      r.feeAmount,
      r.totalAdvances,
      r.adjustmentAmount,
      r.netPaid
    ])

    const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n")
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `Reporte_Nomina_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    toast({ title: "Exportación Exitosa" })
  }

  if (!selectedTechId) {
    return (
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-primary uppercase">Centro de Nómina</h1>
          <p className="text-muted-foreground font-medium">Gestión de pagos y revisión de historial consolidado.</p>
        </div>

        <Tabs defaultValue="liquidar" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-[400px] mb-8 h-12 bg-slate-100 p-1">
            <TabsTrigger value="liquidar" className="font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white transition-all">LIQUIDAR TÉCNICOS</TabsTrigger>
            <TabsTrigger value="historial" className="font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white transition-all">HISTORIAL DE PAGOS</TabsTrigger>
          </TabsList>

          <TabsContent value="liquidar">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {MOCK_TECHNICIANS.map((tech) => {
                const techPending = (allRequests || []).flatMap(r => r.interventions || [])
                  .filter(i => i.technicianId === tech.id && i.payrollStatus !== 'processed' && (i.isReadyForPayroll || (allRequests?.find(r => r.interventions?.includes(i))?.billingStatus === 'validated')))
                const advPending = (allRequests || []).flatMap(r => r.advances || []).filter(a => a.technicianId === tech.id && !a.isPaidInPayroll)
                
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
                        <div className="flex gap-1">
                          {techPending.length > 0 && <Badge className="bg-orange-500">{techPending.length}</Badge>}
                          {advPending.length > 0 && <Badge className="bg-destructive" title="Adelantos">${advPending.reduce((s,a) => s + a.amount, 0).toLocaleString()}</Badge>}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </TabsContent>

          <TabsContent value="historial">
            <Card className="shadow-md border-none overflow-hidden">
              <CardHeader className="bg-slate-50 border-b flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-black uppercase">Registros de Pago</CardTitle>
                  <CardDescription className="text-[10px] font-bold">Consolidado histórico de nóminas liquidadas.</CardDescription>
                </div>
                <Button 
                  disabled={selectedHistoryItems.length === 0} 
                  onClick={handleExportSelected}
                  className="bg-green-600 hover:bg-green-700 font-black text-[10px] uppercase gap-2 h-10 shadow-lg"
                >
                  <FileSpreadsheet className="h-4 w-4" /> EXPORTAR SELECCIONADOS ({selectedHistoryItems.length})
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow className="bg-muted/30">
                    <TableHead className="w-12"></TableHead>
                    <TableHead className="font-black uppercase text-[10px]">Referencia</TableHead>
                    <TableHead className="font-black uppercase text-[10px]">Técnico</TableHead>
                    <TableHead className="font-black uppercase text-[10px]">Fecha</TableHead>
                    <TableHead className="text-right font-black uppercase text-[10px]">Neto Pagado</TableHead>
                    <TableHead className="text-right font-black uppercase text-[10px]">Acciones</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {isHistoryLoading ? (
                      <TableRow><TableCell colSpan={6} className="h-40 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary opacity-20" /></TableCell></TableRow>
                    ) : payrollHistory?.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="h-40 text-center italic text-muted-foreground">No se han realizado liquidaciones todavía.</TableCell></TableRow>
                    ) : (payrollHistory || []).map((liq) => (
                      <TableRow key={liq.id} className="hover:bg-slate-50 transition-colors">
                        <TableCell>
                          <Checkbox 
                            checked={selectedHistoryItems.includes(liq.id)} 
                            onCheckedChange={(checked) => {
                              setSelectedHistoryItems(prev => checked ? [...prev, liq.id] : prev.filter(id => id !== liq.id))
                            }} 
                          />
                        </TableCell>
                        <TableCell><Badge variant="outline" className="font-mono font-black text-primary border-primary/20">{liq.id}</Badge></TableCell>
                        <TableCell><span className="font-bold uppercase text-xs">{liq.technicianId}</span></TableCell>
                        <TableCell><span className="text-[10px] font-bold text-slate-500 uppercase">{new Date(liq.date).toLocaleDateString()}</span></TableCell>
                        <TableCell className="text-right font-mono font-black text-green-600">${liq.netPaid.toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {isDev && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleDeletePayroll(liq)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10">
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
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

  return (
    <div className="flex flex-col gap-8 pb-20">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => setSelectedTechId(null)} className="rounded-xl border-primary text-primary"><ArrowLeft className="h-5 w-5" /></Button>
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14 border-4 border-white shadow-lg"><AvatarImage src={`https://picsum.photos/seed/${selectedTechId}/100/100`} /></Avatar>
          <div>
            <h1 className="text-3xl font-black tracking-tighter text-primary uppercase">{selectedTech?.name}</h1>
            <p className="text-muted-foreground font-bold text-xs uppercase tracking-widest">Liquidación Detallada</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="bg-slate-50 border-none shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-[9px] font-black uppercase text-slate-400">Bruto</CardTitle></CardHeader><CardContent><div className="text-xl font-black text-slate-800">${totals.totalGross.toLocaleString()}</div></CardContent></Card>
            <Card className="bg-destructive/5 border-none shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-[9px] font-black uppercase text-destructive/60">Gastos</CardTitle></CardHeader><CardContent><div className="text-xl font-black text-destructive">-${(totals.totalExpenses + totals.totalRentals).toLocaleString()}</div></CardContent></Card>
            <Card className="bg-orange-50 border-none shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-[9px] font-black uppercase text-orange-600/60">Fee (10%)</CardTitle></CardHeader><CardContent><div className="text-xl font-black text-orange-600">-${totals.totalFee.toLocaleString()}</div></CardContent></Card>
            <Card className="bg-destructive/10 border-none shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-[9px] font-black uppercase text-destructive">Adelantos</CardTitle></CardHeader><CardContent><div className="text-xl font-black text-destructive">-${totals.totalAdvances.toLocaleString()}</div></CardContent></Card>
          </div>

          <Card className="shadow-md border-none overflow-hidden">
            <CardHeader className="bg-slate-900 text-white flex flex-row items-center justify-between">
              <div><CardTitle className="text-sm font-black uppercase tracking-widest">Desglose de Servicios</CardTitle><CardDescription className="text-white/40 text-[10px] uppercase font-bold">Items a liquidar</CardDescription></div>
              <Badge className="bg-green-500 text-[10px] font-black">{pendingInterventions.length + pendingAdvances.length} ITEMS</Badge>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow className="bg-muted/30">
                  <TableHead className="font-black uppercase text-[10px]">Descripción</TableHead>
                  <TableHead className="text-right font-black uppercase text-[10px]">Valor</TableHead>
                  <TableHead className="text-right font-black uppercase text-[10px]">Deducción</TableHead>
                  <TableHead className="text-right font-black uppercase text-[10px]">Neto</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {pendingAdvances.map((adv) => (
                    <TableRow key={adv.id} className="bg-destructive/5">
                      <TableCell><div className="flex flex-col"><span className="text-[10px] font-black text-destructive uppercase">ADELANTO: {adv.reason}</span><span className="text-[8px] font-bold text-slate-400">{adv.request.claimNumber}</span></div></TableCell>
                      <TableCell className="text-right font-mono font-bold text-destructive">-${adv.amount.toLocaleString()}</TableCell>
                      <TableCell className="text-right">---</TableCell>
                      <TableCell className="text-right font-mono font-black text-destructive">-${adv.amount.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                  {pendingInterventions.map((item) => {
                    const materialExpenses = (item.detailedExpenses || []).filter(e => !e.isUnused).reduce((s, e) => s + (e.amount || 0), 0)
                    let rentals = 0
                    if (item.usedRotomartillo) rentals += 80000
                    if (item.usedGeofono) rentals += 120000
                    const totalCosts = materialExpenses + rentals
                    let techNet = 0
                    if (item.isSimpleVisit) {
                      const visitBase = 20000
                      const extra = Math.max(0, item.reportedValue - visitBase)
                      const subExtra = extra - totalCosts
                      const fee = subExtra > 0 ? subExtra * 0.10 : 0
                      techNet = (visitBase / 2) + ((subExtra - fee) / 2)
                    } else {
                      const subtotal = item.reportedValue - totalCosts
                      const fee = subtotal > 0 ? subtotal * 0.10 : 0
                      techNet = (subtotal - fee) / 2
                    }
                    return (
                      <TableRow key={item.id} className={cn(item.isSimpleVisit && "bg-orange-50/30")}>
                        <TableCell><div className="flex flex-col"><span className="font-mono font-black text-primary text-xs">{item.request.claimNumber}</span><span className="text-[8px] font-bold text-slate-400 uppercase">{item.type} {item.isSimpleVisit && '(VISITA)'}</span></div></TableCell>
                        <TableCell className="text-right font-mono font-bold text-slate-700">${(item.reportedValue || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right font-mono text-xs text-destructive">-${totalCosts.toLocaleString()}</TableCell>
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
          <CardHeader className="pb-4"><CardTitle className="text-xl font-black uppercase tracking-tighter flex items-center gap-2 text-primary"><Calculator className="h-5 w-5" /> Liquidación Final</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="flex justify-between text-xs font-bold uppercase text-slate-500"><span>Base Partición:</span><span className="font-mono">${totals.accumulatedToSplit.toLocaleString()}</span></div>
              <div className="flex justify-between text-xs font-black uppercase text-primary border-t pt-2"><span>Total Técnico (Bruto):</span><span className="font-mono">${totals.technicianBase.toLocaleString()}</span></div>
              <div className="pt-2 border-t border-dashed space-y-4">
                <div className="flex justify-between items-center"><div className="flex items-center gap-2"><HandCoins className="h-4 w-4 text-destructive" /><span className="text-[10px] font-black uppercase text-destructive">Adelantos</span></div><span className="font-mono font-bold text-destructive">-${totals.totalAdvances.toLocaleString()}</span></div>
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-primary">Ajuste (+/-)</Label><Input type="number" value={adjustmentAmount} onChange={(e) => setAdjustmentAmount(Number(e.target.value))} className="font-black" /></div>
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Motivo</Label><Input value={adjustmentReason} onChange={(e) => setAdjustmentReason(e.target.value)} className="h-10 text-xs" /></div>
              </div>
            </div>
            <div className="p-6 bg-slate-900 rounded-2xl text-white shadow-xl space-y-1"><p className="text-[10px] font-black uppercase text-white/40 tracking-[0.2em]">Neto a Pagar</p><p className="text-4xl font-black text-green-400">${totals.netPaid.toLocaleString()}</p></div>
            <Button className="w-full h-14 font-black text-sm uppercase tracking-widest shadow-lg bg-green-600 hover:bg-green-700" onClick={handleGeneratePayroll} disabled={isProcessing || (pendingInterventions.length === 0 && pendingAdvances.length === 0)}>{isProcessing ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Save className="h-5 w-5 mr-2" />} FINALIZAR Y LIQUIDAR</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
