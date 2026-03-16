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

// Simulación de usuario actual (Cambiar para probar roles)
type AppRole = 'Admin' | 'Contabilidad' | 'Atención al Cliente';
const CURRENT_USER_ROLE: AppRole = 'Atención al Cliente'; 
const CURRENT_USER_NAME = 'Usuario Demo';

export default function RequestDetailPage() {
  const { id } = useParams()
  const router = useRouter()
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

  // Detailed Expense State for adding to an intervention
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

  if (!request) return <div className="p-8 text-center text-muted-foreground italic">Buscando solicitud en el sistema...</div>

  // LÓGICA DE PERMISOS
  const isAdmin = CURRENT_USER_ROLE === 'Admin';
  const isAccounting = CURRENT_USER_ROLE === 'Contabilidad';
  const isCustomerService = CURRENT_USER_ROLE === 'Atención al Cliente';
  
  const isInAccountingProcess = billingStatus !== 'pending';
  const isWarranty = currentStatus === 'warranty';
  
  // Atención al cliente solo puede editar si NO está en contabilidad O si está en GARANTÍA
  const canEditGeneral = isAdmin || (isCustomerService && (!isInAccountingProcess || isWarranty));
  
  // Pero Atención al Cliente NO puede ver financieros si ya está en contabilidad (incluso en garantía, los costos viejos son privados)
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
      userId: 'user-id',
      userName: CURRENT_USER_NAME,
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
    return <Badge className={cn("text-[10px]", configs[status].className)}>{configs[status].label}</Badge>
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{request.id}</h1>
              <StatusBadge status={currentStatus} />
              {getBillingStatusBadge(billingStatus)}
              {isInAccountingProcess && isCustomerService && !isWarranty && (
                <Badge variant="outline" className="gap-1 border-destructive text-destructive bg-destructive/5">
                  <Lock className="h-3 w-3" /> Solo Lectura
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground flex items-center gap-2 text-sm">
              <CategoryIcon category={request.category} className="h-4 w-4" />
              {request.category} • Expediente: {request.claimNumber}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(isAdmin || isAccounting) && (
            <>
              <Button variant="outline" className="gap-2 border-orange-500 text-orange-600 hover:bg-orange-50" onClick={handleSetWarranty}>
                <ShieldCheck className="h-4 w-4" /> Activar Garantía
              </Button>
              <Button variant="outline" className="gap-2">
                <Receipt className="h-4 w-4" /> Generar Factura
              </Button>
            </>
          )}
          {canEditGeneral && (
            <Button className="gap-2 bg-green-600 hover:bg-green-700">
              <CheckCircle2 className="h-4 w-4" /> Finalizar Servicio
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {isInAccountingProcess && isCustomerService && !isWarranty && (
            <Card className="bg-destructive/10 border-destructive/20 text-destructive p-4 flex items-center gap-3">
              <Lock className="h-5 w-5 shrink-0" />
              <div className="text-sm">
                <p className="font-bold">Servicio en Contabilidad</p>
                <p className="opacity-80">Este expediente ya está siendo procesado por el área financiera. La edición y visualización de costos está restringida.</p>
              </div>
            </Card>
          )}

          {isWarranty && isCustomerService && (
            <Card className="bg-orange-50 border-orange-200 text-orange-800 p-4 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <div className="text-sm">
                <p className="font-bold">Modo Garantía Activo</p>
                <p className="opacity-80">Puede añadir nuevas intervenciones técnicas. Los reportes y gastos anteriores permanecen bloqueados para proteger el cierre inicial.</p>
              </div>
            </Card>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            <Card className="shadow-sm border-l-4 border-l-accent">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <UserCheck className="h-4 w-4" /> Asegurado
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-1">
                  <Label className="text-xs text-muted-foreground">Nombre</Label>
                  <p className="font-bold text-lg">{request.insuredName}</p>
                </div>
                <div className="flex justify-between items-center bg-muted/30 p-2 rounded">
                   <div className="flex items-center gap-2 text-sm">
                     <Phone className="h-4 w-4 text-accent" />
                     <span>{request.phoneNumber}</span>
                   </div>
                   <div className="flex items-center gap-2 text-sm font-bold text-primary">
                     <Hash className="h-4 w-4" />
                     <span>{request.claimNumber}</span>
                   </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-l-4 border-l-primary">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Ubicación
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-1">
                  <Label className="text-xs text-muted-foreground">Dirección</Label>
                  <p className="font-medium text-sm">{request.address}</p>
                </div>
                <div className="p-2 bg-primary/5 rounded border border-primary/10">
                  <p className="text-[11px] text-muted-foreground italic leading-tight">"{request.description}"</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Wrench className="h-5 w-5 text-primary" /> Bitácora Operativa
              </h2>
              {canEditGeneral && (
                <Button size="sm" variant="outline" className="gap-2">
                  <Plus className="h-4 w-4" /> Nueva Intervención
                </Button>
              )}
            </div>
            {request.interventions.map((intervention) => {
              const tech = MOCK_TECHNICIANS.find(t => t.id === intervention.technicianId)
              
              // REGLA DE PROTECCIÓN HISTÓRICA:
              // Atención al cliente no puede editar intervenciones previas a la garantía.
              // Para el prototipo, bloqueamos todas las existentes si es CS y el servicio ya estuvo en contabilidad.
              const canEditThisIntervention = isAdmin || (isCustomerService && !isInAccountingProcess);

              return (
                <Card key={intervention.id} className="overflow-hidden border-l-4 border-l-primary/30">
                  <CardHeader className="bg-muted/30 py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary" className="bg-primary/10 text-primary">{intervention.type}</Badge>
                        <span className="text-[10px] text-muted-foreground">{new Date(intervention.date).toLocaleDateString()}</span>
                        <Separator orientation="vertical" className="h-4" />
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3 text-muted-foreground" />
                          <span className="font-bold text-xs">{tech?.name}</span>
                        </div>
                      </div>
                      {canSeeFinancials && (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-muted-foreground">Costo:</span>
                          <span className="text-xs font-mono font-bold">${intervention.laborCost.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-4">
                    <div className="relative group">
                      <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap italic">
                        "{intervention.notes}"
                      </p>
                      {!canEditThisIntervention && isCustomerService && (
                        <div className="absolute top-0 right-0">
                          <Badge variant="outline" className="text-[8px] uppercase opacity-50"><Lock className="h-2 w-2 mr-1" /> Bloqueado</Badge>
                        </div>
                      )}
                    </div>

                    {canSeeFinancials && (
                      <div className="space-y-3 pt-2 border-t border-dashed">
                        <div className="flex items-center justify-between">
                          <Label className="text-[10px] font-bold uppercase text-muted-foreground">Gastos Registrados</Label>
                          {canEditThisIntervention && (
                            <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 text-primary" onClick={() => setActiveInterventionId(intervention.id)}>
                              <Plus className="h-3 w-3" /> Añadir Material
                            </Button>
                          )}
                        </div>
                        {activeInterventionId === intervention.id && canEditThisIntervention && (
                          <div className="p-3 border rounded-md bg-muted/20 space-y-3 animate-in fade-in">
                            <div className="grid grid-cols-2 gap-3">
                              <Input placeholder="Descripción" className="h-8 text-xs" value={newExpense.description} onChange={(e) => setNewExpense({...newExpense, description: e.target.value})} />
                              <Input placeholder="Monto" type="number" className="h-8 text-xs" value={newExpense.amount} onChange={(e) => setNewExpense({...newExpense, amount: e.target.value})} />
                            </div>
                            <div className="flex items-center justify-between">
                               <div className="flex items-center gap-2">
                                 <Switch checked={newExpense.isApprovedExtra} onCheckedChange={(v) => setNewExpense({...newExpense, isApprovedExtra: v})} />
                                 <Label className="text-[10px] font-bold text-orange-600">Aprobación Extra</Label>
                               </div>
                               <div className="flex gap-2">
                                 <Button size="sm" className="h-7 text-xs" onClick={() => handleAddExpense(intervention)}>Guardar</Button>
                                 <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setActiveInterventionId(null)}>Cancelar</Button>
                               </div>
                            </div>
                          </div>
                        )}
                        <div className="space-y-2">
                          {intervention.detailedExpenses.map((exp) => (
                            <div key={exp.id} className={cn("flex flex-col p-2 rounded text-[11px] border bg-white shadow-sm", exp.isUnused && "bg-orange-50/30")}>
                               <div className="flex justify-between items-center">
                                 <span className="font-medium">{exp.description} {exp.isUnused && <Badge className="text-[8px] bg-orange-100 text-orange-800 ml-1">Inventario</Badge>}</span>
                                 <span className="font-mono font-bold">${exp.amount.toLocaleString()}</span>
                               </div>
                               {exp.isApprovedExtra && (
                                 <div className="mt-1 flex items-center gap-1 text-[8px] text-blue-700 font-bold">
                                   <ShieldAlert className="h-2 w-2" /> APROBADO: {exp.approvedByUserId}
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

          <Card className="shadow-md border-t-4 border-t-green-500">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2 text-green-700">
                  <FileText className="h-5 w-5" /> Reporte Final Formal
                </CardTitle>
                <CardDescription>Documentación consolidada para la asistencia.</CardDescription>
              </div>
              {canEditGeneral && (
                <Button size="sm" variant="outline" className="gap-2" onClick={handleGenerateSummary} disabled={isSummarizing}>
                  {isSummarizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Consolidar con IA
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <Textarea 
                placeholder="Redacte aquí el reporte formal..."
                className="min-h-[150px] text-sm"
                value={report}
                onChange={(e) => setReport(e.target.value)}
                disabled={!canEditGeneral}
              />
              {canEditGeneral && (
                <Button className="mt-4 gap-2">
                  <Save className="h-4 w-4" /> Guardar Reporte Final
                </Button>
              )}
            </CardContent>
          </Card>

          {(isAdmin || isAccounting) && (
            <Card className="border-t-4 border-t-slate-800 bg-slate-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-md flex items-center gap-2">
                  <Activity className="h-4 w-4" /> Bitácora de Auditoría Financiera
                </CardTitle>
                <CardDescription>Registro histórico de cambios en valores y estados de cobro.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {auditLogs.length > 0 ? (
                    auditLogs.map((log) => (
                      <div key={log.id} className="flex gap-3 items-start border-l-2 border-slate-300 pl-4 py-1">
                        <Clock className="h-3 w-3 text-slate-400 mt-1 shrink-0" />
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-slate-700">{log.userName}</span>
                            <span className="text-[10px] text-slate-400">{new Date(log.timestamp).toLocaleString()}</span>
                          </div>
                          <p className="text-[11px] font-medium text-slate-600">{log.action}</p>
                          <p className="text-[10px] text-slate-500 italic bg-white p-1.5 rounded border border-slate-200">
                            {log.details}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-center text-muted-foreground italic py-4">No hay registros de auditoría aún.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-6">
          {canSeeFinancials && (
            <>
              <Card className="bg-primary text-primary-foreground overflow-hidden shadow-xl">
                <div className="bg-white/10 p-4 flex justify-between items-center border-b border-white/20">
                   <CardTitle className="text-xs font-bold uppercase tracking-widest opacity-80">Caja y Operatividad</CardTitle>
                   <Calculator className="h-4 w-4 opacity-50" />
                </div>
                <CardContent className="p-6 space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between text-xs">
                      <span className="opacity-70">Mano de Obra Total:</span>
                      <span className="font-mono font-bold">${totalLabor.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="opacity-70">Gastos Usados:</span>
                      <span className="font-mono font-bold">${totalUsedExpenses.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-xs text-red-300 font-bold">
                      <span className="opacity-70 text-white">Anticipos:</span>
                      <span>-${totalAdvances.toLocaleString()}</span>
                    </div>
                    <Separator className="bg-white/20" />
                    <div className="space-y-1">
                       <p className="text-[10px] opacity-60 font-bold uppercase">Costo Real del Servicio</p>
                       <p className="text-3xl font-mono font-black">${(totalLabor + totalUsedExpenses).toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {(isAdmin || isAccounting) && (
                <Card className="shadow-md border-t-4 border-t-accent bg-accent/5">
                  <CardHeader className="pb-3">
                     <CardTitle className="text-sm font-bold flex items-center gap-2">
                       <Receipt className="h-4 w-4 text-accent" /> Gestión de Cobro (Ajustes)
                     </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                     <div className="space-y-1">
                       <Label className="text-[10px] text-muted-foreground">VALOR COBRADO (Solicitado)</Label>
                       <Input type="number" className="h-8 font-mono" value={requestedAmount} onChange={(e) => setRequestedAmount(Number(e.target.value))} />
                     </div>
                     <div className="space-y-1">
                       <Label className="text-[10px] text-muted-foreground">VALOR APROBADO (Asistencia)</Label>
                       <Input type="number" className="h-8 font-mono border-green-500" value={approvedAmount} onChange={(e) => setApprovedAmount(Number(e.target.value))} />
                     </div>
                     <div className="space-y-2">
                        <Label className="text-[10px] text-muted-foreground">ESTADO DE FACTURACIÓN</Label>
                        <select className="w-full h-8 rounded-md border text-xs px-2" value={billingStatus} onChange={(e) => setBillingStatus(e.target.value as BillingStatus)}>
                           <option value="pending">Pendiente Conciliar</option>
                           <option value="ready_to_bill">Listo para Facturar</option>
                           <option value="billed">Facturado</option>
                           <option value="paid">Pagado</option>
                        </select>
                     </div>
                     <div className="space-y-2">
                        <Label className="text-[10px] text-muted-foreground">ESTADO OPERATIVO</Label>
                        <select className="w-full h-8 rounded-md border text-xs px-2" value={currentStatus} onChange={(e) => setCurrentStatus(e.target.value as ServiceStatus)}>
                           <option value="in_progress">En Progreso</option>
                           <option value="completed">Completado</option>
                           <option value="warranty">En Garantía</option>
                           <option value="cancelled">Cancelado</option>
                        </select>
                     </div>
                     <div className="space-y-1 pt-2">
                        <Label className="text-[10px] text-muted-foreground font-bold">MARGEN BRUTO AJUSTADO</Label>
                        <div className={cn("h-8 px-3 flex items-center rounded-md font-mono font-bold text-sm", (approvedAmount - totalOperative) >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
                          ${(approvedAmount - totalOperative).toLocaleString()}
                        </div>
                     </div>
                     <Button className="w-full h-9 gap-2 bg-accent hover:bg-accent/90" onClick={handleSaveBilling}>
                       <Save className="h-4 w-4" /> Guardar y Registrar
                     </Button>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          <Card className="border-l-4 border-l-yellow-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center justify-between">
                <span>Anticipos</span>
                <HandCoins className="h-4 w-4 text-yellow-600" />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
               {isAddingAdvance && (
                 <div className="p-3 border rounded bg-yellow-50/50 space-y-2 animate-in fade-in">
                    <Input placeholder="Monto" type="number" className="h-8 text-xs" value={newAdvanceAmount} onChange={(e) => setNewAdvanceAmount(e.target.value)} />
                    <Input placeholder="Motivo" className="h-8 text-xs" value={newAdvanceReason} onChange={(e) => setNewAdvanceReason(e.target.value)} />
                    <div className="flex gap-2">
                      <Button size="sm" className="h-7 text-[10px] flex-1" onClick={handleAddAdvance}>Registrar</Button>
                      <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => setIsAddingAdvance(false)}>X</Button>
                    </div>
                 </div>
               )}
               <div className="space-y-2">
                 {request.advances?.map(adv => (
                   <div key={adv.id} className="flex justify-between items-center text-[11px] p-2 bg-white border rounded shadow-sm">
                      <div className="flex flex-col">
                        <span className="font-bold">{adv.reason}</span>
                        <span className="text-[9px] text-muted-foreground">{new Date(adv.date).toLocaleDateString()}</span>
                      </div>
                      <span className="font-mono font-bold text-destructive">-${adv.amount.toLocaleString()}</span>
                   </div>
                 ))}
                 {canEditGeneral && !isAddingAdvance && (
                   <Button variant="outline" className="w-full h-7 text-[10px] border-dashed" onClick={() => setIsAddingAdvance(true)}>
                     <Plus className="h-3 w-3 mr-1" /> Nuevo Anticipo
                   </Button>
                 )}
               </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-md flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" /> Asistencia y Cuenta
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-3 bg-primary/5 rounded border border-primary/10">
                <p className="text-sm font-bold text-primary">{company?.name}</p>
                <p className="text-[11px] text-muted-foreground">Canal: {request.accountName}</p>
              </div>
              <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> Creado el {new Date(request.createdAt).toLocaleString()}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
