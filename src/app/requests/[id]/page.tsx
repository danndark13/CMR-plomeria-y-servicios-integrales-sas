
"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { MOCK_REQUESTS, MOCK_TECHNICIANS, MOCK_COMPANIES } from "@/lib/mock-data"
import { ServiceRequest, BillingStatus, ExpenseCategory, Technician, Advance, AuditEntry, ServiceStatus } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { 
  ArrowLeft, 
  Sparkles, 
  User, 
  Building2, 
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Phone,
  MapPin,
  FileText,
  UserCheck,
  Hash,
  Plus,
  Wrench,
  DollarSign,
  Receipt,
  Save,
  Calculator,
  HandCoins,
  Package,
  Truck,
  Trash2,
  ShieldAlert,
  History,
  Lock,
  Activity,
  Clock,
  ShieldCheck
} from "lucide-react"
import { StatusBadge } from "@/components/crm/status-badge"
import { CategoryIcon } from "@/components/crm/category-icon"
import { serviceNoteSummaryGenerator } from "@/ai/flows/service-note-summary-generator"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase'
import { doc } from 'firebase/firestore'

export default function RequestDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { user } = useUser()
  const db = useFirestore()
  
  const [request, setRequest] = useState<ServiceRequest | null>(null)
  const [report, setReport] = useState("")
  const [isSummarizing, setIsSummarizing] = useState(false)
  
  // Billing & Advance States
  const [requestedAmount, setRequestedAmount] = useState<number>(0)
  const [approvedAmount, setApprovedAmount] = useState<number>(0)
  const [billingStatus, setBillingStatus] = useState<BillingStatus>('pending')
  const [currentStatus, setCurrentStatus] = useState<ServiceStatus>('pending')
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([])
  
  const [isAddingAdvance, setIsAddingAdvance] = useState(false)
  const [newAdvanceAmount, setNewAdvanceAmount] = useState("")
  const [newAdvanceReason, setNewAdvanceReason] = useState("")

  const [activeInterventionId, setActiveInterventionId] = useState<string | null>(null)
  const [newExpense, setNewExpense] = useState<{
    amount: string, 
    description: string, 
    category: ExpenseCategory, 
    isUnused: boolean,
    isApprovedExtra: boolean
  }>({
    amount: "",
    description: "",
    category: "material",
    isUnused: false,
    isApprovedExtra: false
  })

  // Perfil del usuario real desde Firestore
  const profileRef = useMemoFirebase(() => {
    if (!user || !db) return null
    return doc(db, 'user_profiles', user.uid)
  }, [user, db])

  const { data: profile, isLoading: isProfileLoading } = useDoc(profileRef)

  useEffect(() => {
    const found = MOCK_REQUESTS.find(r => r.id === id)
    if (found) {
      setRequest(found)
      setReport(found.report || "")
      setRequestedAmount(found.requestedAmount || 0)
      setApprovedAmount(found.approvedAmount || 0)
      setBillingStatus(found.billingStatus || 'pending')
      setCurrentStatus(found.status || 'pending')
      setAuditLogs(found.auditLogs || [])
    }
  }, [id])

  if (!request || isProfileLoading) return (
    <div className="p-20 text-center flex flex-col items-center gap-4">
      <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
      <p className="text-muted-foreground font-bold tracking-tighter uppercase text-xs">Sincronizando expedientes...</p>
    </div>
  )

  // LÓGICA DE PERMISOS REALES
  const isAdmin = profile?.roleId === 'Administrador';
  const isAccounting = profile?.roleId === 'Contabilidad';
  const isCustomerService = profile?.roleId === 'Servicio al Cliente';
  
  const isInAccountingProcess = billingStatus !== 'pending';
  const isWarranty = currentStatus === 'warranty';
  
  // El Administrador/Gerente siempre puede editar. 
  // CS solo si no está en contabilidad o está en garantía.
  const canEditGeneral = isAdmin || (isCustomerService && (!isInAccountingProcess || isWarranty));
  
  // Financieros: Solo Admin, Contabilidad, o CS si no ha pasado a facturación.
  const canSeeFinancials = isAdmin || isAccounting || (isCustomerService && !isInAccountingProcess);

  const company = MOCK_COMPANIES.find(c => c.id === request.companyId)
  const allNotes = request.interventions.map(i => `[${i.type} - ${MOCK_TECHNICIANS.find(t => t.id === i.technicianId)?.name}]: ${i.notes}`).join('\n')
  
  const totalLabor = request.interventions.reduce((sum, i) => sum + i.laborCost, 0)
  const totalUsedExpenses = request.interventions.reduce((sum, i) => 
    sum + i.detailedExpenses.filter(e => !e.isUnused).reduce((s, e) => s + e.amount, 0), 0
  )
  const totalAdvances = request.advances?.reduce((sum, a) => sum + a.amount, 0) || 0
  const totalOperative = totalLabor + totalUsedExpenses

  const handleGenerateSummary = async () => {
    if (!canEditGeneral) return;
    if (!allNotes) {
      toast({ title: "Error", description: "Debe haber intervenciones con notas para generar un resumen.", variant: "destructive" })
      return
    }
    setIsSummarizing(true)
    try {
      const result = await serviceNoteSummaryGenerator({ notes: allNotes })
      setReport(prev => prev ? prev + "\n\n" + result.summary : result.summary)
      toast({ title: "Resumen generado", description: "La IA ha consolidado las intervenciones exitosamente." })
    } catch (error) {
      toast({ title: "Error", description: "No se pudo generar el resumen con IA.", variant: "destructive" })
    } finally {
      setIsSummarizing(false)
    }
  }

  const handleAddExpense = (intervention: any) => {
    if (!canEditGeneral) return;
    if (!newExpense.amount || !newExpense.description) {
      toast({ title: "Error", description: "Monto y descripción son obligatorios.", variant: "destructive" })
      return
    }

    const tech = MOCK_TECHNICIANS.find(t => t.id === intervention.technicianId)
    const isInInventory = tech?.inventory?.some(item => 
      newExpense.description.toLowerCase().includes(item.description.toLowerCase())
    )

    if (isInInventory && !newExpense.isApprovedExtra) {
      toast({ 
        title: "BLOQUEADO: Material en Inventario", 
        description: `El técnico ${tech?.name} ya tiene '${newExpense.description}' en su inventario activo. Requiere 'Gasto Extra Aprobado'.`, 
        variant: "destructive" 
      })
      return
    }

    toast({ 
      title: "Gasto Registrado", 
      description: `${newExpense.description} por $${newExpense.amount} añadido.` 
    })
    
    setActiveInterventionId(null)
    setNewExpense({ amount: "", description: "", category: "material", isUnused: false, isApprovedExtra: false })
  }

  const handleAddAdvance = () => {
    if (!canEditGeneral) return;
    if (!newAdvanceAmount || !newAdvanceReason) {
      toast({ title: "Error", description: "Monto y motivo son obligatorios.", variant: "destructive" })
      return
    }
    toast({ title: "Anticipo Registrado", description: `Se han adelantado $${newAdvanceAmount} al técnico.` })
    setIsAddingAdvance(false)
    setNewAdvanceAmount("")
    setNewAdvanceReason("")
  }

  const handleSaveBilling = () => {
    if (!isAdmin && !isAccounting) return;
    
    const newEntry: AuditEntry = {
      id: Math.random().toString(36).substr(2, 9),
      userId: user?.uid || 'unknown',
      userName: `${profile?.firstName} ${profile?.lastName}`,
      action: 'Ajuste de Facturación',
      timestamp: new Date().toISOString(),
      details: `Cambio de valores. Cobro: $${requestedAmount}. Aprobado: $${approvedAmount}. Estado Pago: ${billingStatus}. Estado Servicio: ${currentStatus}.`
    }
    
    setAuditLogs([newEntry, ...auditLogs])
    toast({ title: "Cambios Guardados", description: "Se han actualizado los valores y registrado en la bitácora." })
  }

  const handleSetWarranty = () => {
    if (!isAdmin && !isAccounting) return;
    setCurrentStatus('warranty');
    toast({ title: "Estado: GARANTÍA", description: "El servicio se ha reactivado por garantía. Atención al cliente puede añadir nuevos reportes." });
  }

  const getBillingStatusBadge = (status: BillingStatus) => {
    const configs: Record<BillingStatus, { label: string, className: string }> = {
      pending: { label: "Pendiente Conciliar", className: "bg-yellow-100 text-yellow-800" },
      ready_to_bill: { label: "Listo para Facturar", className: "bg-blue-100 text-blue-800" },
      billed: { label: "Facturado", className: "bg-green-100 text-green-800" },
      paid: { label: "Pagado", className: "bg-gray-100 text-gray-800" }
    }
    return <Badge className={cn("text-[10px] font-black uppercase", configs[status].className)}>{configs[status].label}</Badge>
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-xl">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black tracking-tighter text-primary uppercase">{request.id}</h1>
              <StatusBadge status={currentStatus} />
              {getBillingStatusBadge(billingStatus)}
              {isInAccountingProcess && isCustomerService && !isWarranty && (
                <Badge variant="outline" className="gap-1 border-destructive text-destructive bg-destructive/5 font-black uppercase text-[10px]">
                  <Lock className="h-3 w-3" /> Solo Lectura
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
              <CategoryIcon category={request.category} className="h-4 w-4 text-primary" />
              {request.category} • EXP: {request.claimNumber}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(isAdmin || isAccounting) && (
            <>
              <Button variant="outline" className="gap-2 border-orange-500 text-orange-600 hover:bg-orange-50 font-bold" onClick={handleSetWarranty}>
                <ShieldCheck className="h-4 w-4" /> Activar Garantía
              </Button>
              <Button variant="outline" className="gap-2 font-bold">
                <Receipt className="h-4 w-4" /> Generar Factura
              </Button>
            </>
          )}
          {canEditGeneral && (
            <Button className="gap-2 bg-green-600 hover:bg-green-700 font-bold shadow-lg">
              <CheckCircle2 className="h-4 w-4" /> Finalizar Servicio
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {isInAccountingProcess && isCustomerService && !isWarranty && (
            <Card className="bg-destructive/10 border-destructive/20 text-destructive p-4 flex items-center gap-3 shadow-sm rounded-xl">
              <Lock className="h-5 w-5 shrink-0" />
              <div className="text-[11px] font-bold uppercase tracking-tight">
                <p>Servicio en Proceso de Facturación</p>
                <p className="opacity-70 font-medium normal-case">Este expediente está bajo control del área financiera. La edición operativa está restringida temporalmente.</p>
              </div>
            </Card>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            <Card className="shadow-sm border-l-4 border-l-accent overflow-hidden">
              <CardHeader className="pb-3 bg-slate-50/50">
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-accent" /> Asegurado
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="grid gap-1">
                  <p className="font-black text-xl text-slate-800">{request.insuredName}</p>
                </div>
                <div className="flex justify-between items-center bg-slate-100/50 p-2.5 rounded-lg border">
                   <div className="flex items-center gap-2 text-xs font-bold">
                     <Phone className="h-4 w-4 text-accent" />
                     <span>{request.phoneNumber}</span>
                   </div>
                   <div className="flex items-center gap-2 text-xs font-black text-primary font-mono">
                     <Hash className="h-4 w-4" />
                     <span>{request.claimNumber}</span>
                   </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-l-4 border-l-primary overflow-hidden">
              <CardHeader className="pb-3 bg-slate-50/50">
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" /> Punto de Servicio
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="grid gap-1">
                  <p className="font-bold text-sm text-slate-700">{request.address}</p>
                </div>
                <div className="p-3 bg-primary/5 rounded-lg border border-primary/10">
                  <p className="text-[11px] text-slate-600 italic leading-relaxed font-medium">"{request.description}"</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black tracking-tighter flex items-center gap-2 text-slate-800 uppercase">
                <Wrench className="h-5 w-5 text-primary" /> Bitácora Operativa
              </h2>
              {canEditGeneral && (
                <Button size="sm" variant="outline" className="gap-2 font-bold h-9 border-primary/20 text-primary hover:bg-primary/5">
                  <Plus className="h-4 w-4" /> Nueva Intervención
                </Button>
              )}
            </div>
            {request.interventions.map((intervention) => {
              const tech = MOCK_TECHNICIANS.find(t => t.id === intervention.technicianId)
              const canEditThisIntervention = isAdmin || (isCustomerService && !isInAccountingProcess);

              return (
                <Card key={intervention.id} className="overflow-hidden border-none shadow-md">
                  <CardHeader className="bg-slate-50 py-3 border-b">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge className="bg-primary/10 text-primary hover:bg-primary/10 border-primary/20 font-black uppercase text-[9px] tracking-widest">{intervention.type}</Badge>
                        <span className="text-[10px] font-bold text-slate-400">{new Date(intervention.date).toLocaleDateString()}</span>
                        <Separator orientation="vertical" className="h-4" />
                        <div className="flex items-center gap-1.5">
                          <User className="h-3 w-3 text-slate-400" />
                          <span className="font-black text-[11px] text-slate-600 uppercase">{tech?.name}</span>
                        </div>
                      </div>
                      {canSeeFinancials && (
                        <div className="flex items-center gap-2 bg-white px-2 py-1 rounded border shadow-sm">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">M. de Obra:</span>
                          <span className="text-[11px] font-mono font-black text-green-600">${intervention.laborCost.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-4">
                    <div className="relative p-4 bg-slate-50/50 rounded-xl border border-dashed">
                      <p className="text-sm text-slate-700 leading-relaxed italic">
                        "{intervention.notes}"
                      </p>
                      {!canEditThisIntervention && isCustomerService && (
                        <div className="absolute top-2 right-2">
                          <Badge variant="outline" className="text-[8px] font-black uppercase bg-white/50 backdrop-blur-sm"><Lock className="h-2 w-2 mr-1" /> Solo Lectura</Badge>
                        </div>
                      )}
                    </div>

                    {canSeeFinancials && (
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Desglose de Materiales</Label>
                          {canEditThisIntervention && (
                            <Button variant="ghost" size="sm" className="h-6 text-[10px] font-bold gap-1 text-primary hover:bg-primary/5" onClick={() => setActiveInterventionId(intervention.id)}>
                              <Plus className="h-3 w-3" /> Añadir Material
                            </Button>
                          )}
                        </div>
                        {activeInterventionId === intervention.id && canEditThisIntervention && (
                          <div className="p-4 border-2 border-primary/10 rounded-xl bg-white space-y-3 animate-in fade-in slide-in-from-top-2 shadow-inner">
                            <div className="grid grid-cols-2 gap-3">
                              <Input placeholder="Descripción del material" className="h-9 text-xs font-bold" value={newExpense.description} onChange={(e) => setNewExpense({...newExpense, description: e.target.value})} />
                              <Input placeholder="Monto $" type="number" className="h-9 text-xs font-mono font-bold" value={newExpense.amount} onChange={(e) => setNewExpense({...newExpense, amount: e.target.value})} />
                            </div>
                            <div className="flex items-center justify-between">
                               <div className="flex items-center gap-3">
                                 <Switch checked={newExpense.isApprovedExtra} onCheckedChange={(v) => setNewExpense({...newExpense, isApprovedExtra: v})} />
                                 <div className="flex flex-col">
                                   <Label className="text-[10px] font-black text-orange-600 uppercase tracking-tighter">Aprobación Extra</Label>
                                   <span className="text-[8px] text-muted-foreground">Usar si el técnico ya tiene este material</span>
                                 </div>
                               </div>
                               <div className="flex gap-2">
                                 <Button size="sm" className="h-8 text-[10px] font-black uppercase px-4 shadow-sm" onClick={() => handleAddExpense(intervention)}>REGISTRAR</Button>
                                 <Button size="sm" variant="ghost" className="h-8 text-[10px] font-bold uppercase" onClick={() => setActiveInterventionId(null)}>X</Button>
                               </div>
                            </div>
                          </div>
                        )}
                        <div className="grid gap-2 md:grid-cols-2">
                          {intervention.detailedExpenses.map((exp) => (
                            <div key={exp.id} className={cn(
                              "flex flex-col p-3 rounded-xl text-[11px] border bg-white shadow-sm transition-all hover:border-primary/20", 
                              exp.isUnused && "border-orange-200 bg-orange-50/20"
                            )}>
                               <div className="flex justify-between items-center mb-1">
                                 <span className="font-black text-slate-700 uppercase tracking-tighter truncate max-w-[120px]">
                                   {exp.description} 
                                   {exp.isUnused && <Badge className="text-[7px] bg-orange-100 text-orange-800 ml-1.5 font-black uppercase">En Inventario</Badge>}
                                 </span>
                                 <span className="font-mono font-black text-slate-900">${exp.amount.toLocaleString()}</span>
                               </div>
                               {exp.isApprovedExtra && (
                                 <div className="mt-1 flex items-center gap-1 text-[8px] text-blue-700 font-bold uppercase tracking-tighter bg-blue-50 w-fit px-1.5 py-0.5 rounded">
                                   <ShieldAlert className="h-2 w-2" /> APROBACIÓN EXTRA: {exp.approvedByUserId?.split(' ')[0]}
                                 </div>
                               )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>

          <Card className="shadow-lg border-t-4 border-t-green-500 overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between bg-slate-50/50">
              <div>
                <CardTitle className="text-lg font-black tracking-tighter flex items-center gap-2 text-green-700 uppercase">
                  <FileText className="h-5 w-5" /> Reporte Técnico Formal
                </CardTitle>
                <CardDescription className="font-medium text-[11px]">Consolidado profesional para la compañía de asistencia.</CardDescription>
              </div>
              {canEditGeneral && (
                <Button size="sm" variant="outline" className="gap-2 font-bold bg-white shadow-sm border-green-200 text-green-700 hover:bg-green-50" onClick={handleGenerateSummary} disabled={isSummarizing}>
                  {isSummarizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Asistente IA
                </Button>
              )}
            </CardHeader>
            <CardContent className="pt-6">
              <Textarea 
                placeholder="Redacte aquí el reporte formal que se enviará a la asistencia..."
                className="min-h-[200px] text-sm font-medium leading-relaxed bg-slate-50/30 border-dashed"
                value={report}
                onChange={(e) => setReport(e.target.value)}
                disabled={!canEditGeneral}
              />
              {canEditGeneral && (
                <div className="flex justify-end mt-4">
                  <Button className="gap-2 font-black uppercase tracking-widest h-12 px-8 shadow-xl">
                    <Save className="h-5 w-5" /> Guardar Reporte Final
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {(isAdmin || isAccounting) && (
            <Card className="border-t-4 border-t-slate-800 bg-slate-50 shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-[11px] font-black uppercase tracking-[0.2em] flex items-center gap-2 text-slate-800">
                  <Activity className="h-4 w-4" /> Bitácora de Auditoría
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  {auditLogs.length > 0 ? (
                    auditLogs.map((log) => (
                      <div key={log.id} className="flex gap-4 items-start border-l-2 border-slate-300 pl-4 py-1 relative">
                        <div className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-slate-300" />
                        <div className="flex flex-col gap-1.5 w-full">
                          <div className="flex items-center justify-between w-full">
                            <span className="text-[11px] font-black text-slate-700 uppercase">{log.userName}</span>
                            <span className="text-[10px] font-bold text-slate-400">{new Date(log.timestamp).toLocaleString()}</span>
                          </div>
                          <p className="text-[11px] font-bold text-primary uppercase tracking-tighter">{log.action}</p>
                          <p className="text-[10px] text-slate-500 font-medium bg-white p-3 rounded-xl border shadow-sm italic leading-relaxed">
                            {log.details}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-10 text-center opacity-30 italic font-medium text-sm">Sin registros de auditoría financiera.</div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-6">
          {canSeeFinancials && (
            <>
              <Card className="bg-slate-900 text-white overflow-hidden shadow-2xl border-none">
                <div className="bg-white/5 p-4 flex justify-between items-center border-b border-white/10">
                   <CardTitle className="text-[10px] font-black uppercase tracking-[0.3em] opacity-80">Estado de Costos</CardTitle>
                   <Calculator className="h-4 w-4 text-primary" />
                </div>
                <CardContent className="p-8 space-y-6">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Mano de Obra:</span>
                      <span className="text-sm font-mono font-black">${totalLabor.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Materiales:</span>
                      <span className="text-sm font-mono font-black">${totalUsedExpenses.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-red-400">
                      <span className="text-[10px] font-bold uppercase tracking-wider">Anticipos:</span>
                      <span className="text-sm font-mono font-black">-${totalAdvances.toLocaleString()}</span>
                    </div>
                    <Separator className="bg-white/10" />
                    <div className="pt-2 text-center">
                       <p className="text-[10px] text-primary font-black uppercase tracking-[0.2em] mb-1">Costo Operativo Total</p>
                       <p className="text-4xl font-mono font-black tracking-tighter text-white">
                         ${(totalLabor + totalUsedExpenses).toLocaleString()}
                       </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {(isAdmin || isAccounting) && (
                <Card className="shadow-lg border-t-4 border-t-accent bg-white overflow-hidden">
                  <CardHeader className="pb-3 bg-slate-50/50">
                     <CardTitle className="text-[11px] font-black uppercase tracking-[0.2em] flex items-center gap-2 text-slate-800">
                       <Receipt className="h-4 w-4 text-accent" /> Control de Facturación
                     </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-5">
                     <div className="space-y-1.5">
                       <Label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Valor Solicitado a Cobrar</Label>
                       <div className="relative">
                         <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                         <Input type="number" className="pl-9 h-11 font-mono font-black text-primary text-lg" value={requestedAmount} onChange={(e) => setRequestedAmount(Number(e.target.value))} />
                       </div>
                     </div>
                     <div className="space-y-1.5">
                       <Label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Valor Aprobado Final</Label>
                       <div className="relative">
                         <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-600" />
                         <Input type="number" className="pl-9 h-11 font-mono font-black text-green-700 text-lg border-green-500 bg-green-50/30" value={approvedAmount} onChange={(e) => setApprovedAmount(Number(e.target.value))} />
                       </div>
                     </div>
                     <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Estado Conciliación</Label>
                          <select className="w-full h-11 rounded-lg border-2 text-xs font-bold px-3 focus:border-primary transition-all" value={billingStatus} onChange={(e) => setBillingStatus(e.target.value as BillingStatus)}>
                             <option value="pending">⏳ Pendiente Conciliar</option>
                             <option value="ready_to_bill">✅ Listo para Facturar</option>
                             <option value="billed">📑 Facturado</option>
                             <option value="paid">💰 Pagado</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Estado de Expediente</Label>
                          <select className="w-full h-11 rounded-lg border-2 text-xs font-bold px-3 focus:border-primary transition-all" value={currentStatus} onChange={(e) => setCurrentStatus(e.target.value as ServiceStatus)}>
                             <option value="in_progress">🚧 En Progreso</option>
                             <option value="completed">🏆 Completado</option>
                             <option value="warranty">🛡️ En Garantía</option>
                             <option value="cancelled">❌ Cancelado</option>
                          </select>
                        </div>
                     </div>
                     <div className="pt-4 border-t border-dashed">
                        <div className="flex items-center justify-between mb-2">
                           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Utilidad Bruta:</span>
                           <span className={cn("text-lg font-mono font-black", (approvedAmount - totalOperative) >= 0 ? "text-green-600" : "text-destructive")}>
                             ${(approvedAmount - totalOperative).toLocaleString()}
                           </span>
                        </div>
                        <Button className="w-full h-12 gap-2 bg-accent hover:bg-accent/90 font-black uppercase tracking-widest shadow-lg" onClick={handleSaveBilling}>
                          <Save className="h-5 w-5" /> ACTUALIZAR DATOS
                        </Button>
                     </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          <Card className="border-l-4 border-l-yellow-500 shadow-md">
            <CardHeader className="pb-2 bg-yellow-50/30">
              <CardTitle className="text-[11px] font-black uppercase tracking-widest text-yellow-800 flex items-center justify-between">
                <span>Deducción de Anticipos</span>
                <HandCoins className="h-5 w-5" />
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
               {isAddingAdvance && (
                 <div className="p-4 border-2 border-yellow-200 rounded-xl bg-white space-y-3 animate-in zoom-in-95 shadow-sm">
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input placeholder="Monto $" type="number" className="pl-9 h-9 text-sm font-mono font-bold" value={newAdvanceAmount} onChange={(e) => setNewAdvanceAmount(e.target.value)} />
                    </div>
                    <Input placeholder="Motivo o concepto..." className="h-9 text-xs font-medium" value={newAdvanceReason} onChange={(e) => setNewAdvanceReason(e.target.value)} />
                    <div className="flex gap-2">
                      <Button size="sm" className="h-8 text-[10px] font-black uppercase flex-1 shadow-md" onClick={handleAddAdvance}>APROBAR</Button>
                      <Button size="sm" variant="ghost" className="h-8 text-[10px] font-bold uppercase text-slate-400" onClick={() => setIsAddingAdvance(false)}>X</Button>
                    </div>
                 </div>
               )}
               <div className="space-y-2">
                 {request.advances?.map(adv => (
                   <div key={adv.id} className="flex justify-between items-center text-[11px] p-3 bg-white border rounded-xl shadow-sm">
                      <div className="flex flex-col">
                        <span className="font-black text-slate-700 uppercase tracking-tighter">{adv.reason}</span>
                        <span className="text-[9px] text-muted-foreground font-bold">{new Date(adv.date).toLocaleDateString()}</span>
                      </div>
                      <span className="font-mono font-black text-destructive">-${adv.amount.toLocaleString()}</span>
                   </div>
                 ))}
                 {canEditGeneral && !isAddingAdvance && (
                   <Button variant="outline" className="w-full h-10 text-[10px] font-black uppercase tracking-widest border-dashed border-2 border-yellow-200 text-yellow-700 hover:bg-yellow-50" onClick={() => setIsAddingAdvance(true)}>
                     <Plus className="h-4 w-4 mr-1.5" /> Nuevo Anticipo
                   </Button>
                 )}
               </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-3 bg-slate-50/50">
              <CardTitle className="text-[11px] font-black uppercase tracking-[0.2em] flex items-center gap-2 text-slate-800">
                <Building2 className="h-4 w-4 text-primary" /> Relación Institucional
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="p-4 bg-white border-2 rounded-xl flex items-center gap-4">
                <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                  <Building2 className="h-6 w-6" />
                </div>
                <div className="flex flex-col">
                  <p className="text-sm font-black text-slate-800 uppercase tracking-tighter">{company?.name}</p>
                  <p className="text-[11px] font-bold text-muted-foreground">CUENTA: {request.accountName}</p>
                </div>
              </div>
              <div className="text-[9px] font-bold text-slate-400 flex items-center gap-1.5 px-2">
                <Clock className="h-3.5 w-3.5" /> REGISTRO INICIAL: {new Date(request.createdAt).toLocaleString()}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
