
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
import { Textarea } from "@/components/ui/textarea"
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
  Download,
  FileDown,
  MessageSquare
} from "lucide-react"
import { MOCK_TECHNICIANS } from "@/lib/mock-data"
import { toast } from "@/hooks/use-toast"
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from "@/firebase"
import { collection, doc, writeBatch, deleteDoc, query, where, orderBy } from "firebase/firestore"
import { TechnicianIntervention, ServiceRequest, PayrollRecord, Advance } from "@/lib/types"
import { cn } from "@/lib/utils"
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"

export default function PayrollHubPage() {
  const db = useFirestore()
  const { user } = useUser()
  const [selectedTechId, setSelectedTechId] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedHistoryItems, setSelectedHistoryItems] = useState<string[]>([])
  
  const [adjustmentAmount, setAdjustmentAmount] = useState(0)
  const [adjustmentReason, setAdjustmentReason] = useState("")
  const [payrollNotes, setPayrollNotes] = useState("")

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

  const usersQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return collection(db, "user_profiles")
  }, [db, user])
  const { data: allUsers } = useCollection(usersQuery)

  const allTechnicians = useMemo(() => {
    const uniqueMap = new Map()
    if (allUsers) {
      allUsers.filter(u => u.roleId === 'Técnico').forEach(u => {
        const uname = (u.username || u.id).toUpperCase().trim()
        if (!uniqueMap.has(uname)) {
          uniqueMap.set(uname, { id: uname, name: `${u.firstName} ${u.lastName || ''}`.trim(), specialties: ['Técnico'] })
        }
      })
    }
    MOCK_TECHNICIANS.forEach(mt => {
      const uname = mt.id.toUpperCase().trim()
      if (!uniqueMap.has(uname)) {
        uniqueMap.set(uname, mt)
      }
    })
    return Array.from(uniqueMap.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [allUsers])

  const selectedTech = allTechnicians.find(t => t.id === selectedTechId)

  const pendingInterventions = useMemo(() => {
    return (allRequests || []).flatMap((req: ServiceRequest) => 
      (req.interventions || [])
        .filter((i: any) => {
          const isCorrectTech = i.technicianId === selectedTechId
          const notProcessed = i.payrollStatus !== 'processed'
          const caseValidated = req.billingStatus === 'validated'
          const earlyApproved = i.isReadyForPayroll === true
          return isCorrectTech && notProcessed && (caseValidated || earlyApproved)
        })
        .map((i: any) => ({ ...i, request: req }))
    )
  }, [allRequests, selectedTechId])

  const pendingAdvances = useMemo(() => {
    return (allRequests || []).flatMap((req: ServiceRequest) => 
      (req.advances || [])
        .filter((a: any) => a.technicianId === selectedTechId && !a.isPaidInPayroll)
        .map((a: any) => ({ ...a, request: req }))
    )
  }, [allRequests, selectedTechId])

  const totals = useMemo(() => {
    let totalGross = 0
    let totalExpenses = 0
    let totalRentals = 0
    let totalFee = 0
    let accumulatedToSplit = 0
    let totalSimpleVisitBonus = 0 

    pendingInterventions.forEach((i: any) => {
      const gross = i.reportedValue || 0
      const materialExpenses = (i.detailedExpenses || []).filter((e: any) => !e.isUnused).reduce((s: number, e: any) => s + (e.amount || 0), 0)
      
      let rentals = 0
      if (i.usedRotomartillo) rentals += 80000
      if (i.usedGeofono) rentals += 120000
      if (i.usedPlanchaTermofusion) rentals += 70000
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

  const generatePayrollPDF = (records: PayrollRecord[]) => {
    const doc = new jsPDF()
    
    records.forEach((record, index) => {
      if (index > 0) doc.addPage()
      
      const techName = allTechnicians.find(t => t.id === record.technicianId)?.name || record.technicianId
      const dateStr = new Date(record.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })

      // HEADER
      doc.setFontSize(18)
      doc.setTextColor(31, 91, 204)
      doc.text("PLOMERÍA Y SERVICIOS RYS SAS", 105, 20, { align: 'center' })
      
      doc.setFontSize(10)
      doc.setTextColor(100)
      doc.text("Nit: 901.601.017 | Comprobante de Liquidación Técnico", 105, 26, { align: 'center' })
      
      doc.setDrawColor(200)
      doc.line(20, 32, 190, 32)

      // INFO SECTION
      doc.setFontSize(11)
      doc.setTextColor(0)
      doc.setFont("helvetica", "bold")
      doc.text("TÉCNICO:", 20, 45)
      doc.setFont("helvetica", "normal")
      doc.text(techName.toUpperCase(), 50, 45)

      doc.setFont("helvetica", "bold")
      doc.text("FECHA:", 20, 52)
      doc.setFont("helvetica", "normal")
      doc.text(dateStr, 50, 52)

      doc.setFont("helvetica", "bold")
      doc.text("REF LIQ:", 20, 59)
      doc.setFont("helvetica", "normal")
      doc.text(record.id, 50, 59)

      // ITEMS TABLE
      const tableRows: any[] = []
      
      const relatedRequests = (allRequests || []).filter((r: ServiceRequest) => 
        r.interventions?.some((i: any) => i.payrollId === record.id)
      )

      relatedRequests.forEach((req: ServiceRequest) => {
        const myIntervs = req.interventions.filter((i: any) => i.payrollId === record.id)
        myIntervs.forEach((i: any) => {
          const matCost = i.detailedExpenses?.filter((e: any) => !e.isUnused).reduce((s: number, e: any) => s + (e.amount || 0), 0) || 0
          let rentals = 0
          if (i.usedRotomartillo) rentals += 80000
          if (i.usedGeofono) rentals += 120000
          if (i.usedPlanchaTermofusion) rentals += 70000
          
          let techNet = 0
          const subtotal = i.reportedValue - (matCost + rentals)
          const internalFee = subtotal > 0 ? subtotal * 0.10 : 0
          if (i.isSimpleVisit) {
            techNet = (20000 / 2) + ((Math.max(0, i.reportedValue - 20000) - (matCost + rentals) - internalFee) / 2)
          } else {
            techNet = (subtotal - internalFee) / 2
          }

          tableRows.push([
            req.claimNumber,
            `${i.type}${i.isSimpleVisit ? ' (VISITA)' : ''}`,
            `$${(i.reportedValue - internalFee).toLocaleString()}`,
            `-$${(matCost + rentals).toLocaleString()}`,
            `$${techNet.toLocaleString()}`
          ])
        })
      })

      autoTable(doc, {
        startY: 70,
        head: [['EXPEDIENTE', 'TIPO SERVICIO', 'VALOR BRUTO', 'DEDUCCIONES', 'PAGO NETO (50%)']],
        body: tableRows,
        theme: 'striped',
        headStyles: { fillColor: [31, 91, 204], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: {
          2: { halign: 'right' },
          3: { halign: 'right', textColor: [200, 0, 0] },
          4: { halign: 'right', fontStyle: 'bold' }
        }
      })

      let currentY = (doc as any).lastAutoTable.finalY + 10

      // NOTES SECTION
      if (record.notes) {
        doc.setFontSize(10)
        doc.setFont("helvetica", "bold")
        doc.text("NOVEDADES / NOTAS:", 20, currentY)
        doc.setFont("helvetica", "normal")
        doc.setFontSize(9)
        const splitNotes = doc.splitTextToSize(record.notes, 170)
        doc.text(splitNotes, 20, currentY + 6)
        currentY += (splitNotes.length * 5) + 15
      }

      // FINALS SECTION
      doc.setDrawColor(230)
      doc.setFillColor(245, 245, 245)
      doc.rect(120, currentY, 70, 45, 'F')

      doc.setFontSize(10)
      doc.setTextColor(80)
      doc.text("SUBTOTAL SERVICIOS:", 125, currentY + 10)
      doc.text(`$${(record.netPaid + record.totalAdvances - (record.adjustmentAmount || 0)).toLocaleString()}`, 185, currentY + 10, { align: 'right' })

      doc.text("ADELANTOS RECIBIDOS:", 125, currentY + 18)
      doc.text(`-$${record.totalAdvances.toLocaleString()}`, 185, currentY + 18, { align: 'right' })

      if (record.adjustmentAmount !== 0) {
        doc.text("AJUSTES / BONOS:", 125, currentY + 26)
        doc.text(`${record.adjustmentAmount > 0 ? '+' : '-'}$${Math.abs(record.adjustmentAmount).toLocaleString()}`, 185, currentY + 26, { align: 'right' })
      }

      doc.setFontSize(14)
      doc.setTextColor(31, 91, 204)
      doc.setFont("helvetica", "bold")
      doc.text("TOTAL PAGADO:", 125, currentY + 38)
      doc.text(`$${record.netPaid.toLocaleString()}`, 185, currentY + 38, { align: 'right' })

      // FOOTER
      doc.setFontSize(8)
      doc.setTextColor(150)
      doc.setFont("helvetica", "italic")
      doc.text("Nota: Los descuentos de materiales y alquileres se restan del valor reportado antes de la partición del 50%.", 20, 280)
      doc.text("Este documento es un soporte interno de liquidación corporativa.", 20, 285)
    })

    doc.save(`Nomina_RYS_${new Date().toISOString().split('T')[0]}.pdf`)
    toast({ title: "PDF Generado" })
  }

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
      notes: payrollNotes,
      itemsCount: pendingInterventions.length,
      processedInterventionIds: pendingInterventions.map(i => i.id),
      processedAdvanceIds: pendingAdvances.map(a => a.id)
    }
    
    batch.set(doc(db, "payroll_history", payrollId), payrollRecord)

    const requestIds = new Set([...pendingInterventions.map(i => i.request.id), ...pendingAdvances.map(a => a.request.id)])
    requestIds.forEach(reqId => {
      const req = (allRequests || []).find(r => r.id === reqId)
      if (!req) return
      
      const updatedInterventions = req.interventions.map((i: any) => {
        const isTarget = pendingInterventions.some((pi: any) => pi.id === i.id && pi.request.id === reqId)
        if (isTarget) return { ...i, payrollStatus: 'processed' as const, payrollId, isReadyForPayroll: false }
        return i
      })
      
      const updatedAdvances = (req.advances || []).map((a: any) => {
        const isTarget = pendingAdvances.some((pa: any) => pa.id === a.id && pa.request.id === reqId)
        if (isTarget) return { ...a, isPaidInPayroll: true, payrollId }
        return a
      })

      batch.update(doc(db, "service_requests", reqId), { interventions: updatedInterventions, advances: updatedAdvances, updatedAt: new Date().toISOString() })
    })

    try {
      await batch.commit()
      toast({ title: "Nómina Liquidada" })
      setAdjustmentAmount(0); setAdjustmentReason(""); setPayrollNotes(""); setSelectedTechId(null)
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
      const requestsToUpdate = (allRequests || []).filter((req: ServiceRequest) => 
        req.interventions?.some((i: any) => i.payrollId === record.id) ||
        req.advances?.some((a: any) => a.payrollId === record.id)
      )

      requestsToUpdate.forEach((req: ServiceRequest) => {
        const updatedInterventions = req.interventions.map((i: any) => {
          if (i.payrollId === record.id) {
            return { ...i, payrollStatus: 'pending' as const, payrollId: undefined }
          }
          return i
        })
        const updatedAdvances = (req.advances || []).map((a: any) => {
          if (a.payrollId === record.id) {
            return { ...a, isPaidInPayroll: false, payrollId: undefined }
          }
          return a
        })
        batch.update(doc(db, "service_requests", req.id), { interventions: updatedInterventions, advances: updatedAdvances })
      })

      batch.delete(doc(db, "payroll_history", record.id))
      await batch.commit()
      toast({ title: "Registro Eliminado" })
    } catch (e) {
      toast({ variant: "destructive", title: "Error al eliminar" })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleTogglePaid = async (record: PayrollRecord) => {
    if (!db) return
    const nowPaid = !record.isPaid
    try {
      const { updateDoc } = await import("firebase/firestore")
      await updateDoc(doc(db, "payroll_history", record.id), {
        isPaid: nowPaid,
        paidAt: nowPaid ? new Date().toISOString() : null
      })
      toast({ title: nowPaid ? "Nómina marcada como PAGADA ✅" : "Nómina marcada como PENDIENTE" })
    } catch (e) {
      toast({ variant: "destructive", title: "Error al actualizar estado" })
    }
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
              {allTechnicians.map((tech) => {
                const techPending = (allRequests || []).flatMap(r => r.interventions || [])
                  .filter(i => i.technicianId === tech.id && i.payrollStatus !== 'processed' && (i.isReadyForPayroll || (allRequests?.find(r => r.interventions?.includes(i))?.billingStatus === 'validated')))
                const advPending = (allRequests || []).flatMap(r => r.advances || []).filter(a => a.technicianId === tech.id && !a.isPaidInPayroll)
                
                if (techPending.length === 0 && advPending.length === 0) return null;

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
              {allTechnicians.filter(t => {
                const tp = (allRequests || []).flatMap(r => r.interventions || []).filter(i => i.technicianId === t.id && i.payrollStatus !== 'processed' && (i.isReadyForPayroll || (allRequests?.find(r => r.interventions?.includes(i))?.billingStatus === 'validated')))
                const ap = (allRequests || []).flatMap(r => r.advances || []).filter(a => a.technicianId === t.id && !a.isPaidInPayroll)
                return tp.length > 0 || ap.length > 0
              }).length === 0 && (
                <div className="col-span-full py-20 text-center text-muted-foreground italic border-2 border-dashed rounded-xl bg-slate-50">
                  No hay técnicos con servicios pendientes de liquidar.
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="historial">
            <Card className="shadow-md border-none overflow-hidden">
              <CardHeader className="bg-slate-50 border-b flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-black uppercase">Registros de Pago</CardTitle>
                  <CardDescription className="text-[10px] font-bold">Consolidado histórico de nóminas liquidadas.</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button 
                    disabled={selectedHistoryItems.length === 0} 
                    onClick={() => {
                      const records = (payrollHistory || []).filter(r => selectedHistoryItems.includes(r.id))
                      generatePayrollPDF(records)
                    }}
                    className="bg-primary hover:bg-primary/90 font-black text-[10px] uppercase gap-2 h-10 shadow-lg"
                  >
                    <FileDown className="h-4 w-4" /> DESCARGAR PDF SELECCIONADOS ({selectedHistoryItems.length})
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow className="bg-muted/30">
                    <TableHead className="w-12"></TableHead>
                    <TableHead className="font-black uppercase text-[10px]">Referencia</TableHead>
                    <TableHead className="font-black uppercase text-[10px]">Técnico</TableHead>
                    <TableHead className="font-black uppercase text-[10px]">Fecha</TableHead>
                    <TableHead className="font-black uppercase text-[10px]">Estado Pago</TableHead>
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
                        <TableCell><span className="font-bold uppercase text-xs">{(allTechnicians.find(t => t.id === liq.technicianId)?.name || liq.technicianId).toUpperCase()}</span></TableCell>
                        <TableCell><span className="text-[10px] font-bold text-slate-500 uppercase">{new Date(liq.date).toLocaleDateString()}</span></TableCell>
                        <TableCell>
                          <button
                            onClick={() => handleTogglePaid(liq)}
                            title={liq.isPaid ? `Pagado el ${liq.paidAt ? new Date(liq.paidAt).toLocaleDateString() : ""}. Clic para marcar como pendiente` : "Clic para marcar como pagada"}
                            className="flex items-center gap-1 cursor-pointer"
                          >
                            {liq.isPaid
                              ? <Badge className="bg-green-500 hover:bg-green-600 text-white font-black text-[10px] gap-1"><CheckCircle2 className="h-3 w-3" />PAGADA</Badge>
                              : <Badge variant="outline" className="text-orange-500 border-orange-400 hover:bg-orange-50 font-black text-[10px] gap-1"><AlertCircle className="h-3 w-3" />PENDIENTE</Badge>
                            }
                          </button>
                        </TableCell>
                         <TableCell className="text-right font-mono font-black text-green-600">${liq.netPaid.toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {isDev && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleDeletePayroll(liq)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10" onClick={() => generatePayrollPDF([liq])}>
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
                  {pendingInterventions.map((item: any) => {
                    const materialExpenses = (item.detailedExpenses || []).filter((e: any) => !e.isUnused).reduce((s: number, e: any) => s + (e.amount || 0), 0)
                    let rentals = 0
                    if (item.usedRotomartillo) rentals += 80000
                    if (item.usedGeofono) rentals += 120000
                    if (item.usedPlanchaTermofusion) rentals += 70000
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
                        <TableCell className="text-right font-mono font-bold text-slate-700">${(() => { const sub = (item.reportedValue||0) - (materialExpenses+rentals); const f = sub > 0 ? sub*0.10 : 0; return ((item.reportedValue||0) - f).toLocaleString() })()}</TableCell>
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
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-primary">Ajuste (+/-)</Label><Input type="number" value={adjustmentAmount} onChange={(e) => setAdjustmentAmount(Number(e.target.value))} className="font-black h-9" /></div>
                  <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Motivo Ajuste</Label><Input value={adjustmentReason} onChange={(e) => setAdjustmentReason(e.target.value.toUpperCase())} className="h-9 text-[10px]" /></div>
                </div>

                <div className="space-y-2 pt-2 border-t">
                  <Label className="text-[10px] font-black uppercase flex items-center gap-2 text-slate-600"><MessageSquare className="h-3 w-3" /> Novedades / Notas de Nómina</Label>
                  <Textarea 
                    placeholder="Escriba aquí notas que aparecerán en el PDF..." 
                    className="min-h-[80px] text-xs font-medium"
                    value={payrollNotes}
                    onChange={(e) => setPayrollNotes(e.target.value)}
                  />
                </div>
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
