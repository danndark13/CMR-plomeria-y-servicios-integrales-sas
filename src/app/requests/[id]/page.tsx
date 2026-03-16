
"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { MOCK_REQUESTS, MOCK_TECHNICIANS, MOCK_COMPANIES } from "@/lib/mock-data"
import { ServiceRequest, BillingStatus, ServiceStatus } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { 
  ArrowLeft, 
  Sparkles, 
  MapPin, 
  Loader2,
  Wrench,
  DollarSign,
  Save,
  CheckCircle2,
  Wallet,
  AlertCircle,
  FileText,
  RefreshCw
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
  const [accountingNotes, setAccountingNotes] = useState("")
  const [isSummarizing, setIsSummarizing] = useState(false)
  
  // Billing States
  const [requestedAmount, setRequestedAmount] = useState<number>(0)
  const [approvedAmount, setApprovedAmount] = useState<number>(0)
  const [isConciliated, setIsConciliated] = useState(false)
  const [currentStatus, setCurrentStatus] = useState<ServiceStatus>('pending')
  
  const profileRef = useMemoFirebase(() => {
    if (!user || !db) return null
    return doc(db, 'user_profiles', user.uid)
  }, [user, db])

  const { data: profile, isLoading: isProfileLoading } = useDoc(profileRef)

  useEffect(() => {
    const found = MOCK_REQUESTS.find(r => r.id === id || r.claimNumber === id)
    if (found) {
      setRequest(found)
      setReport(found.report || "")
      setAccountingNotes(found.accountingNotes || "")
      setRequestedAmount(found.requestedAmount || 0)
      setApprovedAmount(found.approvedAmount || 0)
      setIsConciliated(!!found.approvedAmount && found.approvedAmount > 0)
      setCurrentStatus(found.status || 'pending')
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
  
  const canEditGeneral = isAdmin || isCustomerService
  const canEditAccounting = isAdmin || isAccounting
  const canSeeFinancials = isAdmin || isAccounting || isCustomerService

  const allNotes = request.interventions.map(i => `[${i.type} - ${MOCK_TECHNICIANS.find(t => t.id === i.technicianId)?.name}]: ${i.notes}`).join('\n')
  
  const totalLabor = request.interventions.reduce((sum, i) => sum + i.laborCost, 0)
  const allExpenses = request.interventions.flatMap(i => i.detailedExpenses.filter(e => !e.isUnused))
  const totalUsedExpenses = allExpenses.reduce((s, e) => s + e.amount, 0)
  const totalOperative = totalLabor + totalUsedExpenses

  const handleGenerateSummary = async () => {
    if (!canEditGeneral) {
      toast({ variant: "destructive", title: "Acceso denegado", description: "Solo Servicio al Cliente o Admin pueden generar reportes técnicos." });
      return;
    }
    setIsSummarizing(true)
    try {
      const result = await serviceNoteSummaryGenerator({ notes: allNotes })
      setReport(prev => prev ? prev + "\n\n" + result.summary : result.summary)
      toast({ title: "Resumen generado", description: "La IA ha consolidado las intervenciones." })
    } catch (error) {
      toast({ title: "Error", description: "No se pudo generar el resumen.", variant: "destructive" })
    } finally {
      setIsSummarizing(false)
    }
  }

  const handleSaveAccountingNotes = () => {
    if (!canEditAccounting) return;
    toast({ 
      title: "Notas de Pago Guardadas", 
      description: "Los comentarios de liquidación se han actualizado correctamente." 
    })
  }

  const handleSaveBilling = () => {
    if (!isAdmin && !isAccounting) return;
    setIsConciliated(true)
    toast({ 
      title: "Valores Conciliados", 
      description: `Se ha fijado el valor de cobro en $${approvedAmount.toLocaleString()}.` 
    })
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
            </div>
            <p className="text-muted-foreground flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
              <CategoryIcon category={request.category} className="h-4 w-4 text-primary" />
              {request.category}
            </p>
          </div>
        </div>
        {(isAdmin || isCustomerService) && (
          <Button className="gap-2 bg-green-600 hover:bg-green-700 font-bold shadow-lg">
            <CheckCircle2 className="h-4 w-4" /> Finalizar Servicio
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="shadow-sm border-l-4 border-l-accent overflow-hidden">
              <CardHeader className="pb-3 bg-slate-50/50">
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Asegurado</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-1">
                <p className="font-black text-xl text-slate-800">{request.insuredName}</p>
                <div className="flex items-center gap-4">
                  <span className="text-xs font-bold text-slate-500">{request.phoneNumber}</span>
                  <Badge variant="outline" className="text-[10px] uppercase font-black bg-blue-50 text-blue-700 border-blue-200">
                    {request.accountName}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-l-4 border-l-primary overflow-hidden">
              <CardHeader className="pb-3 bg-slate-50/50">
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Descripción Operativa</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <p className="text-sm font-medium text-slate-700 leading-relaxed">{request.description}</p>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-lg border-t-4 border-t-slate-800">
            <CardHeader className="bg-slate-50">
              <CardTitle className="text-lg font-black uppercase flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" /> Detalle de Cobro a Asistencia
              </CardTitle>
              <CardDescription className="text-xs font-medium">Especificación de rubros para generación de cobro.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-xs font-black uppercase text-slate-600">Concepto de Mano de Obra</span>
                  <span className="font-mono font-black text-slate-800">${totalLabor.toLocaleString()}</span>
                </div>
                {request.interventions.map((inv, idx) => (
                  <div key={inv.id} className="flex justify-between text-[11px] pl-4 opacity-70 italic">
                    <span>Int. #{idx + 1} - {inv.type} ({MOCK_TECHNICIANS.find(t => t.id === inv.technicianId)?.name})</span>
                    <span>${inv.laborCost.toLocaleString()}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-xs font-black uppercase text-slate-600">Materiales y Otros Gastos</span>
                  <span className="font-mono font-black text-slate-800">${totalUsedExpenses.toLocaleString()}</span>
                </div>
                {allExpenses.length > 0 ? (
                  allExpenses.map((exp) => (
                    <div key={exp.id} className="flex justify-between text-[11px] pl-4 opacity-70 italic">
                      <span>{exp.description} ({exp.category})</span>
                      <span>${exp.amount.toLocaleString()}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-[10px] text-muted-foreground italic pl-4">No se registraron materiales o gastos adicionales.</p>
                )}
              </div>

              <div className="flex justify-between items-center bg-primary/5 p-4 rounded-xl border border-primary/10 mt-4">
                <span className="text-sm font-black uppercase text-primary">Sugerido para cobro</span>
                <span className="text-2xl font-mono font-black text-primary">${totalOperative.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <h2 className="text-xl font-black tracking-tighter flex items-center gap-2 text-slate-800 uppercase">
              <Wrench className="h-5 w-5 text-primary" /> Intervenciones Técnicas
            </h2>
            {request.interventions.map((intervention) => (
              <Card key={intervention.id} className="overflow-hidden border-none shadow-md">
                <CardHeader className="bg-slate-50 py-3 border-b flex flex-row items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge className="bg-primary/10 text-primary font-black uppercase text-[9px]">{intervention.type}</Badge>
                    <span className="text-[10px] font-bold text-slate-400">{new Date(intervention.date).toLocaleDateString()}</span>
                    <span className="font-black text-[11px] text-slate-600 uppercase">{MOCK_TECHNICIANS.find(t => t.id === intervention.technicianId)?.name}</span>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <p className="text-sm text-slate-700 italic leading-relaxed">"{intervention.notes}"</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6">
            <Card className="shadow-lg border-t-4 border-t-green-500">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-black text-green-700 uppercase">Reporte Técnico Formal</CardTitle>
                  {!canEditGeneral && <CardDescription className="text-[10px] uppercase font-bold text-orange-600">Modo Solo Lectura para Contabilidad</CardDescription>}
                </div>
                {canEditGeneral && (
                  <Button size="sm" variant="outline" className="gap-2 font-bold" onClick={handleGenerateSummary} disabled={isSummarizing}>
                    <Sparkles className="h-4 w-4" /> Consolidar con IA
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {canEditGeneral ? (
                  <Textarea 
                    placeholder="Redacte aquí el reporte para la asistencia..."
                    className="min-h-[150px] text-sm font-medium"
                    value={report}
                    onChange={(e) => setReport(e.target.value)}
                  />
                ) : (
                  <div className="p-4 bg-slate-50 rounded-lg border text-sm text-slate-700 leading-relaxed italic">
                    {report || "No hay un reporte técnico cargado todavía."}
                  </div>
                )}
                {canEditGeneral && (
                  <div className="flex justify-end mt-4">
                    <Button className="gap-2 font-black shadow-lg">
                      <Save className="h-4 w-4" /> Guardar Reporte
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {canSeeFinancials && (
              <Card className="shadow-lg border-t-4 border-t-orange-500">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-black text-orange-700 uppercase">Notas de Liquidación y Pagos</CardTitle>
                    <CardDescription className="text-xs">Comentarios internos sobre el pago a técnicos y deducciones.</CardDescription>
                  </div>
                  <Wallet className="h-6 w-6 text-orange-600" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea 
                    placeholder="Ej: Descontar material sobrante, bonificación por prontitud, etc..."
                    className="min-h-[100px] text-sm font-medium border-orange-200 focus-visible:ring-orange-500"
                    value={accountingNotes}
                    onChange={(e) => setAccountingNotes(e.target.value)}
                    disabled={!canEditAccounting}
                  />
                  {canEditAccounting && (
                    <div className="flex justify-end">
                      <Button className="gap-2 font-black bg-orange-600 hover:bg-orange-700 shadow-lg" onClick={handleSaveAccountingNotes}>
                        <Save className="h-4 w-4" /> Guardar Notas Contables
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {(isAdmin || isAccounting) && (
            <Card className="shadow-lg border-t-8 border-t-primary sticky top-24">
              <CardHeader className="bg-slate-50/50 border-b">
                <CardTitle className="text-xs font-black uppercase tracking-widest">Módulo de Conciliación</CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">Valor Inicial Solicitado</Label>
                  <div className={cn(
                    "text-xl font-mono font-black py-2 px-3 bg-slate-50 rounded-lg border",
                    isConciliated ? "text-slate-400 line-through decoration-red-500 decoration-2" : "text-primary"
                  )}>
                    ${requestedAmount.toLocaleString()}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-800">Valor real de cobro final</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                    <Input 
                      type="number" 
                      className="pl-10 h-14 text-2xl font-mono font-black border-primary bg-primary/5 focus-visible:ring-primary shadow-inner" 
                      value={approvedAmount} 
                      onChange={(e) => setApprovedAmount(Number(e.target.value))} 
                    />
                  </div>
                  <p className="text-[9px] font-bold text-muted-foreground italic">Este valor es el que se exportará en el Excel de cobros.</p>
                </div>

                <Button className="w-full h-14 bg-primary hover:bg-primary/90 font-black uppercase tracking-widest shadow-xl text-lg gap-2" onClick={handleSaveBilling}>
                  <RefreshCw className="h-5 w-5" /> ACTUALIZAR COBRO
                </Button>
                
                {isConciliated && (
                  <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-100 animate-in fade-in zoom-in">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-[10px] font-bold text-green-700 uppercase">Valor Conciliado: ${approvedAmount.toLocaleString()}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
