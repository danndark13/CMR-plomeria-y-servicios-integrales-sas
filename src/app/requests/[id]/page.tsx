
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

  const profileRef = useMemoFirebase(() => {
    if (!user || !db) return null
    return doc(db, 'user_profiles', user.uid)
  }, [user, db])

  const { data: profile, isLoading: isProfileLoading } = useDoc(profileRef)

  useEffect(() => {
    // En un app real, esto sería una consulta a Firestore por el ID del documento
    const found = MOCK_REQUESTS.find(r => r.id === id || r.claimNumber === id)
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
      <p className="text-muted-foreground font-bold tracking-tighter uppercase text-xs">Cargando expediente...</p>
    </div>
  )

  const isAdmin = profile?.roleId === 'Administrador'
  const isAccounting = profile?.roleId === 'Contabilidad'
  const isCustomerService = profile?.roleId === 'Servicio al Cliente'
  
  const isInAccountingProcess = billingStatus !== 'pending' && billingStatus !== 'ready_to_bill'
  const isWarranty = currentStatus === 'warranty'
  
  // El Administrador/Gerente siempre puede editar. 
  // CS solo si no está facturado o está en garantía.
  const canEditGeneral = isAdmin || (isCustomerService && (!isInAccountingProcess || isWarranty))
  
  // Financieros: Solo Admin, Contabilidad, o CS si no ha pasado a facturación.
  const canSeeFinancials = isAdmin || isAccounting || (isCustomerService && !isInAccountingProcess)

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
    toast({ title: "Gasto Registrado", description: `${newExpense.description} por $${newExpense.amount} añadido.` })
    setActiveInterventionId(null)
    setNewExpense({ amount: "", description: "", category: "material", isUnused: false, isApprovedExtra: false })
  }

  const handleSaveBilling = () => {
    if (!isAdmin && !isAccounting) return;
    toast({ title: "Cambios Guardados", description: "Se han actualizado los valores financieros." })
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
              <h1 className="text-2xl font-black tracking-tighter text-primary uppercase">{request.claimNumber}</h1>
              <StatusBadge status={currentStatus} />
              <Badge variant="outline" className="text-[10px] font-black uppercase bg-slate-100">{billingStatus}</Badge>
            </div>
            <p className="text-muted-foreground flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
              <CategoryIcon category={request.category} className="h-4 w-4 text-primary" />
              {request.category} • ID: {request.id}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canEditGeneral && (
            <Button className="gap-2 bg-green-600 hover:bg-green-700 font-bold shadow-lg">
              <CheckCircle2 className="h-4 w-4" /> Finalizar Servicio
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="shadow-sm border-l-4 border-l-accent overflow-hidden">
              <CardHeader className="pb-3 bg-slate-50/50">
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Asegurado</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-2">
                <p className="font-black text-xl text-slate-800">{request.insuredName}</p>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                  <Phone className="h-3.5 w-3.5" /> {request.phoneNumber}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-l-4 border-l-primary overflow-hidden">
              <CardHeader className="pb-3 bg-slate-50/50">
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Ubicación</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-2">
                <p className="font-bold text-sm text-slate-700">{request.address}</p>
                <div className="flex items-center gap-2 text-xs text-primary font-mono">
                  <MapPin className="h-3.5 w-3.5" /> Ver en Mapa
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-black tracking-tighter flex items-center gap-2 text-slate-800 uppercase">
              <Wrench className="h-5 w-5 text-primary" /> Bitácora Operativa
            </h2>
            {request.interventions.map((intervention) => {
              const tech = MOCK_TECHNICIANS.find(t => t.id === intervention.technicianId)
              return (
                <Card key={intervention.id} className="overflow-hidden border-none shadow-md">
                  <CardHeader className="bg-slate-50 py-3 border-b flex flex-row items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge className="bg-primary/10 text-primary font-black uppercase text-[9px]">{intervention.type}</Badge>
                      <span className="text-[10px] font-bold text-slate-400">{new Date(intervention.date).toLocaleDateString()}</span>
                      <span className="font-black text-[11px] text-slate-600 uppercase">{tech?.name}</span>
                    </div>
                    {canSeeFinancials && (
                      <span className="text-[11px] font-mono font-black text-green-600">${intervention.laborCost.toLocaleString()}</span>
                    )}
                  </CardHeader>
                  <CardContent className="pt-4">
                    <p className="text-sm text-slate-700 italic leading-relaxed">"{intervention.notes}"</p>
                    {canSeeFinancials && intervention.detailedExpenses.length > 0 && (
                      <div className="mt-4 grid gap-2 md:grid-cols-2">
                        {intervention.detailedExpenses.map(exp => (
                          <div key={exp.id} className="flex justify-between items-center p-2 bg-slate-50 border rounded-lg text-[10px]">
                            <span className="font-bold uppercase truncate max-w-[120px]">{exp.description}</span>
                            <span className="font-mono font-black">${exp.amount.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>

          <Card className="shadow-lg border-t-4 border-t-green-500">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-black text-green-700 uppercase">Reporte Técnico Formal</CardTitle>
              {canEditGeneral && (
                <Button size="sm" variant="outline" className="gap-2 font-bold" onClick={handleGenerateSummary} disabled={isSummarizing}>
                  <Sparkles className="h-4 w-4" /> Asistente IA
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <Textarea 
                placeholder="Redacte aquí el reporte para la asistencia..."
                className="min-h-[150px] text-sm font-medium"
                value={report}
                onChange={(e) => setReport(e.target.value)}
                disabled={!canEditGeneral}
              />
              {canEditGeneral && (
                <div className="flex justify-end mt-4">
                  <Button className="gap-2 font-black shadow-lg">
                    <Save className="h-4 w-4" /> Guardar Reporte
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {canSeeFinancials && (
            <Card className="bg-slate-900 text-white overflow-hidden shadow-2xl">
              <CardHeader className="bg-white/5">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400">Resumen Financiero</CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="flex justify-between text-xs">
                  <span>Mano de Obra</span>
                  <span className="font-mono font-bold">${totalLabor.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>Materiales</span>
                  <span className="font-mono font-bold">${totalUsedExpenses.toLocaleString()}</span>
                </div>
                <Separator className="bg-white/10" />
                <div className="text-center pt-2">
                  <p className="text-[10px] font-black uppercase text-primary mb-1">Costo Operativo</p>
                  <p className="text-3xl font-mono font-black">${totalOperative.toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {(isAdmin || isAccounting) && (
            <Card className="shadow-lg border-t-4 border-t-accent">
              <CardHeader>
                <CardTitle className="text-xs font-black uppercase">Conciliación</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase">Valor Cobrado</Label>
                  <Input type="number" className="font-mono font-black" value={requestedAmount} onChange={(e) => setRequestedAmount(Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase">Valor Aprobado</Label>
                  <Input type="number" className="font-mono font-black border-green-500 bg-green-50" value={approvedAmount} onChange={(e) => setApprovedAmount(Number(e.target.value))} />
                </div>
                <Button className="w-full h-12 bg-accent hover:bg-accent/90 font-black uppercase" onClick={handleSaveBilling}>
                  Actualizar Valores
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
