"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { MOCK_REQUESTS, MOCK_TECHNICIANS, MOCK_COMPANIES } from "@/lib/mock-data"
import { ServiceRequest, BillingStatus, Advance } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  ArrowLeft, 
  Sparkles, 
  User, 
  Building2, 
  Clock,
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
  Briefcase,
  Receipt,
  Save,
  Calculator,
  HandCoins
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
  const totalExpenses = request.interventions.reduce((sum, i) => sum + i.expenses, 0)
  const totalAdvances = request.advances?.reduce((sum, a) => sum + a.amount, 0) || 0
  const totalOperative = totalLabor + totalExpenses

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

  const handleSaveBilling = () => {
    toast({ title: "Valores Conciliados", description: "Los valores para facturación electrónica han sido actualizados." })
  }

  const handleAddAdvance = () => {
    if (!newAdvanceAmount || !newAdvanceReason) {
      toast({ title: "Error", description: "Monto y motivo son obligatorios.", variant: "destructive" })
      return
    }
    toast({ title: "Anticipo Registrado", description: `Se han adelantado $${newAdvanceAmount} para el técnico.` })
    setIsAddingAdvance(false)
    setNewAdvanceAmount("")
    setNewAdvanceReason("")
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
                      <Input 
                        type="number" 
                        placeholder="0.00" 
                        value={newAdvanceAmount}
                        onChange={(e) => setNewAdvanceAmount(e.target.value)}
                      />
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

          <Card className="shadow-md border-t-4 border-t-accent bg-accent/5">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2 text-accent-foreground font-bold">
                    <Receipt className="h-5 w-5" />
                    Conciliación Contable
                  </CardTitle>
                  <CardDescription>Ajuste de valores para facturación electrónica.</CardDescription>
                </div>
                <Badge variant="outline" className="border-accent text-accent">Área Contable</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Costo Operativo Base</Label>
                  <div className="h-10 flex items-center px-3 bg-muted rounded-md border font-mono font-bold text-lg">
                    ${totalOperative.toLocaleString()}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="requested" className="text-xs font-bold uppercase text-primary">Valor Cobrado</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                    <Input 
                      id="requested" 
                      type="number" 
                      className="pl-9 font-mono font-bold border-primary/30"
                      value={requestedAmount}
                      onChange={(e) => setRequestedAmount(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="approved" className="text-xs font-bold uppercase text-green-600">Valor Aprobado</Label>
                  <div className="relative">
                    <Calculator className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-600" />
                    <Input 
                      id="approved" 
                      type="number" 
                      className="pl-9 font-mono font-bold border-green-600/30"
                      value={approvedAmount}
                      onChange={(e) => setApprovedAmount(Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 space-y-2">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Estado de Facturación</Label>
                  <Select value={billingStatus} onValueChange={(v) => setBillingStatus(v as BillingStatus)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Seleccionar estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pendiente Conciliar</SelectItem>
                      <SelectItem value="ready_to_bill">Listo para Facturar</SelectItem>
                      <SelectItem value="billed">Facturado</SelectItem>
                      <SelectItem value="paid">Pagado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleSaveBilling} className="gap-2 bg-accent hover:bg-accent/90">
                  <Save className="h-4 w-4" /> Guardar Ajuste
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between mb-2">
             <h2 className="text-xl font-bold flex items-center gap-2">
               <Wrench className="h-5 w-5 text-primary" />
               Bitácora de Intervenciones
             </h2>
             <Button size="sm" variant="outline" className="gap-2">
               <Plus className="h-4 w-4" /> Nueva Visita
             </Button>
          </div>

          <div className="space-y-4">
            {request.interventions.map((intervention) => {
              const tech = MOCK_TECHNICIANS.find(t => t.id === intervention.technicianId)
              return (
                <Card key={intervention.id} className="overflow-hidden border-l-4 border-l-primary/30">
                  <CardHeader className="bg-muted/30 py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary" className="bg-primary/10 text-primary">{intervention.type}</Badge>
                        <span className="text-[10px] text-muted-foreground">{new Date(intervention.date).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <User className="h-3 w-3 text-muted-foreground" />
                      <span className="font-bold text-xs">{tech?.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {intervention.notes}
                    </p>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          <Card className="shadow-sm border-t-4 border-t-green-500">
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
          <Card className="bg-primary text-primary-foreground overflow-hidden">
            <div className="bg-white/10 p-4 border-b border-white/20">
               <CardTitle className="text-xs font-bold uppercase tracking-widest opacity-80">Caja y Operatividad</CardTitle>
            </div>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between text-xs">
                  <span className="opacity-70">Mano de Obra (Bruto):</span>
                  <span className="font-mono font-bold">${totalLabor.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="opacity-70">Gastos Materiales:</span>
                  <span className="font-mono font-bold">${totalExpenses.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs text-red-300">
                  <span className="opacity-70">Anticipos (Descuento):</span>
                  <span className="font-mono font-bold">-${totalAdvances.toLocaleString()}</span>
                </div>
                <Separator className="bg-white/20" />
                <div className="space-y-1">
                   <p className="text-[10px] opacity-60 font-bold">TOTAL COSTO OPERATIVO</p>
                   <p className="text-3xl font-mono font-black">${(totalOperative).toLocaleString()}</p>
                   <p className="text-[10px] opacity-60 italic">Nota: Anticipos ya descontados del neto técnico.</p>
                </div>
              </div>
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
