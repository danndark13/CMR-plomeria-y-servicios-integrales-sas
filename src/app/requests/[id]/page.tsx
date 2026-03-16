"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { MOCK_REQUESTS, MOCK_TECHNICIANS, MOCK_COMPANIES } from "@/lib/mock-data"
import { ServiceRequest, BillingStatus, ExpenseCategory, Technician } from "@/lib/types"
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
  ShieldAlert
} from "lucide-react"
import { StatusBadge } from "@/components/crm/status-badge"
import { CategoryIcon } from "@/components/crm/category-icon"
import { serviceNoteSummaryGenerator } from "@/ai/flows/service-note-summary-generator"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

export default function RequestDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [request, setRequest] = useState<ServiceRequest | null>(null)
  const [summary, setSummary] = useState("")
  const [report, setReport] = useState("")
  const [isSummarizing, setIsSummarizing] = useState(false)
  
  // Billing & Advance States
  const [requestedAmount, setRequestedAmount] = useState<number>(0)
  const [approvedAmount, setApprovedAmount] = useState<number>(0)
  const [billingStatus, setBillingStatus] = useState<BillingStatus>('pending')
  
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
      setSummary(found.summary || "")
      setReport(found.report || "")
      setRequestedAmount(found.requestedAmount || 0)
      setApprovedAmount(found.approvedAmount || 0)
      setBillingStatus(found.billingStatus || 'pending')
    }
  }, [id])

  if (!request) return <div className="p-8 text-center text-muted-foreground italic">Buscando solicitud en el sistema...</div>

  const company = MOCK_COMPANIES.find(c => c.id === request.companyId)
  const allNotes = request.interventions.map(i => `[${i.type} - ${MOCK_TECHNICIANS.find(t => t.id === i.technicianId)?.name}]: ${i.notes}`).join('\n')
  
  const totalLabor = request.interventions.reduce((sum, i) => sum + i.laborCost, 0)
  const totalUsedExpenses = request.interventions.reduce((sum, i) => 
    sum + i.detailedExpenses.filter(e => !e.isUnused).reduce((s, e) => s + e.amount, 0), 0
  )
  const totalInInventory = request.interventions.reduce((sum, i) => 
    sum + i.detailedExpenses.filter(e => e.isUnused).reduce((s, e) => s + e.amount, 0), 0
  )
  const totalAdvances = request.advances?.reduce((sum, a) => sum + a.amount, 0) || 0
  const totalOperative = totalLabor + totalUsedExpenses

  const handleGenerateSummary = async () => {
    if (!allNotes) {
      toast({ title: "Error", description: "Debe haber intervenciones con notas para generar un resumen.", variant: "destructive" })
      return
    }
    setIsSummarizing(true)
    try {
      const result = await serviceNoteSummaryGenerator({ notes: allNotes })
      setSummary(result.summary)
      toast({ title: "Resumen generado", description: "La IA ha consolidado las intervenciones exitosamente." })
    } catch (error) {
      toast({ title: "Error", description: "No se pudo generar el resumen con IA.", variant: "destructive" })
    } finally {
      setIsSummarizing(false)
    }
  }

  const handleAddExpense = (intervention: any) => {
    if (!newExpense.amount || !newExpense.description) {
      toast({ title: "Error", description: "Monto y descripción son obligatorios.", variant: "destructive" })
      return
    }

    // CHECK INVENTORY
    const tech = MOCK_TECHNICIANS.find(t => t.id === intervention.technicianId)
    const isInInventory = tech?.inventory?.some(item => 
      newExpense.description.toLowerCase().includes(item.description.toLowerCase()) ||
      item.description.toLowerCase().includes(newExpense.description.toLowerCase())
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
      description: `${newExpense.description} por $${newExpense.amount} añadido.${newExpense.isApprovedExtra ? ' (Aprobado como Extra)' : ''}` 
    })
    
    setActiveInterventionId(null)
    setNewExpense({ amount: "", description: "", category: "material", isUnused: false, isApprovedExtra: false })
  }

  const handleSaveBilling = () => {
    toast({ title: "Cambios Guardados", description: "Se han actualizado los valores de facturación." })
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
              <StatusBadge status={request.status} />
              {getBillingStatusBadge(billingStatus)}
            </div>
            <p className="text-muted-foreground flex items-center gap-2 text-sm">
              <CategoryIcon category={request.category} className="h-4 w-4" />
              {request.category} • Expediente: {request.claimNumber}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2">
            <Receipt className="h-4 w-4" /> Facturar
          </Button>
          <Button className="gap-2 bg-green-600 hover:bg-green-700">
            <CheckCircle2 className="h-4 w-4" /> Finalizar Servicio
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
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

          <Card className="shadow-md border-t-4 border-t-yellow-500 bg-yellow-50/30">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2 text-yellow-800 font-bold">
                    <HandCoins className="h-5 w-5" />
                    Anticipos a Técnicos
                  </CardTitle>
                  <CardDescription>Adelantos registrados para este expediente.</CardDescription>
                </div>
                <Button size="sm" onClick={() => setIsAddingAdvance(true)} className="bg-yellow-600 hover:bg-yellow-700">
                  <Plus className="h-4 w-4 mr-2" /> Nuevo Anticipo
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {isAddingAdvance && (
                <div className="p-4 border rounded-lg bg-white space-y-4 animate-in fade-in zoom-in-95">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Monto del Anticipo</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                          type="number" 
                          placeholder="0.00" 
                          className="pl-9"
                          value={newAdvanceAmount}
                          onChange={(e) => setNewAdvanceAmount(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Motivo</Label>
                      <Input 
                        placeholder="Ej. Gasolina, Peajes..." 
                        value={newAdvanceReason}
                        onChange={(e) => setNewAdvanceReason(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleAddAdvance} className="flex-1">Confirmar Anticipo</Button>
                    <Button size="sm" variant="ghost" onClick={() => setIsAddingAdvance(false)}>Cancelar</Button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {request.advances && request.advances.length > 0 ? (
                  request.advances.map((adv) => (
                    <div key={adv.id} className="flex items-center justify-between p-3 bg-white border rounded shadow-sm">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold">{adv.reason}</span>
                        <span className="text-[10px] text-muted-foreground">{new Date(adv.date).toLocaleDateString()}</span>
                      </div>
                      <span className="font-mono font-bold text-destructive">-${adv.amount.toLocaleString()}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-center text-muted-foreground py-4 italic">No se han registrado anticipos para este servicio.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between mb-2">
             <h2 className="text-xl font-bold flex items-center gap-2">
               <Wrench className="h-5 w-5 text-primary" />
               Bitácora e Inventario
             </h2>
          </div>

          <div className="space-y-6">
            {request.interventions.map((intervention) => {
              const tech = MOCK_TECHNICIANS.find(t => t.id === intervention.technicianId)
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
                      <div className="flex items-center gap-2">
                         <span className="text-[10px] font-bold text-muted-foreground">Mano de Obra:</span>
                         <span className="text-xs font-mono font-bold">${intervention.laborCost.toLocaleString()}</span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-4">
                    <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap italic">
                      "{intervention.notes}"
                    </p>
                    
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Gastos y Materiales</Label>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 text-[10px] gap-1 text-primary hover:bg-primary/5"
                          onClick={() => setActiveInterventionId(activeInterventionId === intervention.id ? null : intervention.id)}
                        >
                          <Plus className="h-3 w-3" /> Añadir Gasto
                        </Button>
                      </div>

                      {activeInterventionId === intervention.id && (
                        <div className="p-4 border rounded-md bg-muted/20 space-y-4 animate-in slide-in-from-top-2">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-xs">Descripción del Material/Gasto</Label>
                              <Input 
                                placeholder="Ej. Cemento Blanco..." 
                                className="h-9 text-sm"
                                value={newExpense.description}
                                onChange={(e) => setNewExpense({...newExpense, description: e.target.value})}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs">Monto</Label>
                              <div className="relative">
                                <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                  type="number" 
                                  placeholder="0" 
                                  className="h-9 text-sm pl-7"
                                  value={newExpense.amount}
                                  onChange={(e) => setNewExpense({...newExpense, amount: e.target.value})}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col gap-3 p-3 bg-white rounded border border-dashed">
                             <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  <Switch 
                                    id="isApprovedExtra" 
                                    checked={newExpense.isApprovedExtra}
                                    onCheckedChange={(v) => setNewExpense({...newExpense, isApprovedExtra: v})}
                                  />
                                  <Label htmlFor="isApprovedExtra" className="text-xs font-bold text-orange-600 flex items-center gap-1">
                                    <ShieldAlert className="h-3 w-3" /> Gasto Extra Aprobado
                                  </Label>
                                </div>
                                <Button size="sm" className="h-8 text-xs bg-primary" onClick={() => handleAddExpense(intervention)}>
                                  Guardar Gasto
                                </Button>
                             </div>
                             <p className="text-[10px] text-muted-foreground leading-tight">
                               * Si el material ya existe en el inventario del técnico, el sistema bloqueará el registro a menos que se marque como "Gasto Extra Aprobado".
                             </p>
                          </div>
                        </div>
                      )}

                      <div className="space-y-2">
                        {intervention.detailedExpenses.length > 0 ? (
                          intervention.detailedExpenses.map((exp) => (
                            <div key={exp.id} className={cn(
                              "flex items-center justify-between p-2 rounded text-xs border",
                              exp.isUnused ? "bg-orange-50/50 border-orange-200 border-dashed" : "bg-white border-muted"
                            )}>
                              <div className="flex items-center gap-2">
                                {exp.isUnused ? <Package className="h-3 w-3 text-orange-500" /> : <Truck className="h-3 w-3 text-muted-foreground" />}
                                <div className="flex flex-col">
                                  <span className="font-medium">{exp.description}</span>
                                  {exp.isUnused && <span className="text-[9px] font-bold text-orange-600 uppercase">Queda en Inventario Técnico</span>}
                                  {exp.isApprovedExtra && <span className="text-[8px] font-bold text-blue-600 uppercase flex items-center gap-1"><ShieldAlert className="h-2 w-2" /> Aprobado como Extra</span>}
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className={cn("font-mono font-bold", exp.isUnused ? "text-orange-600" : "text-foreground")}>
                                  ${exp.amount.toLocaleString()}
                                </span>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive">
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-[10px] text-muted-foreground italic text-center py-2">Sin gastos registrados en esta visita.</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          <Card className="shadow-md border-t-4 border-t-green-500">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2 text-green-700">
                  <FileText className="h-5 w-5" />
                  Reporte Final Consolidado
                </CardTitle>
                <CardDescription>Documentación formal para la asistencia.</CardDescription>
              </div>
              <Button size="sm" variant="outline" className="gap-2" onClick={handleGenerateSummary} disabled={isSummarizing}>
                {isSummarizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                IA: Consolidar
              </Button>
            </CardHeader>
            <CardContent>
              <Textarea 
                placeholder="Redacte aquí el reporte formal..."
                className="min-h-[150px]"
                value={report}
                onChange={(e) => setReport(e.target.value)}
              />
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card className="bg-primary text-primary-foreground overflow-hidden shadow-xl">
            <div className="bg-white/10 p-4 border-b border-white/20 flex justify-between items-center">
               <CardTitle className="text-xs font-bold uppercase tracking-widest opacity-80">Caja y Operatividad</CardTitle>
               <Receipt className="h-4 w-4 opacity-50" />
            </div>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between text-xs">
                  <span className="opacity-70">Mano de Obra (Total):</span>
                  <span className="font-mono font-bold">${totalLabor.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="opacity-70">Gastos Materiales (Usados):</span>
                  <span className="font-mono font-bold">${totalUsedExpenses.toLocaleString()}</span>
                </div>
                {totalInInventory > 0 && (
                  <div className="flex justify-between text-[10px] text-orange-200 bg-white/10 p-1 px-2 rounded">
                    <span className="flex items-center gap-1"><Package className="h-3 w-3" /> En Inventario (No cobrable):</span>
                    <span className="font-mono font-bold">${totalInInventory.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs text-red-300">
                  <span className="opacity-70">Anticipos Entregados:</span>
                  <span className="font-mono font-bold">-${totalAdvances.toLocaleString()}</span>
                </div>
                <Separator className="bg-white/20" />
                <div className="space-y-1">
                   <p className="text-[10px] opacity-60 font-bold">TOTAL COSTO OPERATIVO DEL SERVICIO</p>
                   <p className="text-3xl font-mono font-black">${(totalOperative).toLocaleString()}</p>
                   <p className="text-[10px] opacity-60 italic leading-tight mt-2">
                     * El valor en inventario no se suma al costo del servicio pero queda registrado como gasto de la empresa.
                   </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border-t-4 border-t-accent bg-accent/5">
            <CardHeader className="pb-3">
               <CardTitle className="text-sm font-bold flex items-center gap-2">
                 <Calculator className="h-4 w-4 text-accent" /> Conciliación Facturación
               </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
               <div className="space-y-1">
                 <Label className="text-[10px] text-muted-foreground uppercase">Valor Solicitado</Label>
                 <Input 
                   type="number" 
                   className="h-8 font-mono" 
                   value={requestedAmount}
                   onChange={(e) => setRequestedAmount(Number(e.target.value))}
                 />
               </div>
               <div className="space-y-1">
                 <Label className="text-[10px] text-muted-foreground uppercase">Valor Aprobado Asistencia</Label>
                 <Input 
                   type="number" 
                   className="h-8 font-mono border-green-500" 
                   value={approvedAmount}
                   onChange={(e) => setApprovedAmount(Number(e.target.value))}
                 />
               </div>
               <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground uppercase">Margen Bruto Ajustado</Label>
                  <div className={cn(
                    "h-8 px-3 flex items-center rounded-md font-mono font-bold text-sm",
                    (approvedAmount - totalOperative) >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                  )}>
                    ${(approvedAmount - totalOperative).toLocaleString()}
                  </div>
               </div>
               <Button className="w-full h-8 text-xs gap-2 bg-accent hover:bg-accent/90" onClick={handleSaveBilling}>
                 <Save className="h-4 w-4" /> Guardar Ajustes
               </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-md flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" /> Asistencia
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-muted/50 rounded-lg border border-dashed border-primary/20">
                <p className="text-sm font-bold text-primary">{company?.name}</p>
                <p className="text-xs text-muted-foreground">Cuenta: {request.accountName}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
