
"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { MOCK_REQUESTS, MOCK_TECHNICIANS, MOCK_COMPANIES } from "@/lib/mock-data"
import { ServiceRequest, Expense } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { 
  ArrowLeft, 
  Sparkles, 
  Loader2,
  Wrench,
  DollarSign,
  CheckCircle2,
  Wallet,
  RefreshCw,
  ArrowRight,
  Save,
  Lock,
  Package,
  Info,
  Warehouse,
  ShoppingCart
} from "lucide-react"
import { StatusBadge } from "@/components/crm/status-badge"
import { CategoryIcon } from "@/components/crm/category-icon"
import { serviceNoteSummaryGenerator } from "@/ai/flows/service-note-summary-generator"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase'
import { doc, setDoc, updateDoc, collection } from 'firebase/firestore'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'

export default function RequestDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useUser()
  const db = useFirestore()
  
  const [localRequest, setLocalRequest] = useState<ServiceRequest | null>(null)
  const [report, setReport] = useState("")
  const [accountingNotes, setAccountingNotes] = useState("")
  const [isSummarizing, setIsSummarizing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  
  // Billing States
  const [requestedAmount, setRequestedAmount] = useState<number>(0)
  const [approvedAmount, setApprovedAmount] = useState<number>(0)
  const [isConciliated, setIsConciliated] = useState(false)

  // Fetch Inventory for cross-check
  const inventoryQuery = useMemoFirebase(() => {
    if (!db) return null
    return collection(db, "inventory")
  }, [db])
  const { data: inventoryItems } = useCollection(inventoryQuery)

  const requestRef = useMemoFirebase(() => {
    if (!db || !id) return null
    return doc(db, 'service_requests', id as string)
  }, [db, id])

  const { data: firestoreRequest, isLoading: isRequestLoading } = useDoc(requestRef)
  
  const profileRef = useMemoFirebase(() => (user && db ? doc(db, 'user_profiles', user.uid) : null), [user, db])
  const { data: profile, isLoading: isProfileLoading } = useDoc(profileRef)

  useEffect(() => {
    if (firestoreRequest) {
      setLocalRequest(firestoreRequest as any)
      setReport(firestoreRequest.report || "")
      setAccountingNotes(firestoreRequest.accountingNotes || "")
      setRequestedAmount(firestoreRequest.requestedAmount || 0)
      setApprovedAmount(firestoreRequest.approvedAmount || 0)
      setIsConciliated(!!firestoreRequest.approvedAmount && firestoreRequest.approvedAmount > 0)
    } else {
      const found = MOCK_REQUESTS.find(r => r.id === id || r.claimNumber === id)
      if (found) {
        setLocalRequest(found)
        setReport(found.report || "")
        setAccountingNotes(found.accountingNotes || "")
        setRequestedAmount(found.requestedAmount || 0)
        setApprovedAmount(found.approvedAmount || 0)
        setIsConciliated(!!found.approvedAmount && found.approvedAmount > 0)
      }
    }
  }, [firestoreRequest, id])

  if (!localRequest || isProfileLoading || isRequestLoading) return (
    <div className="p-20 text-center flex flex-col items-center gap-4">
      <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
      <p className="text-muted-foreground font-bold tracking-tighter uppercase text-xs">Cargando expediente...</p>
    </div>
  )

  const isAdmin = profile?.roleId === 'Administrador'
  const isAccounting = profile?.roleId === 'Contabilidad'
  const isCustomerService = profile?.roleId === 'Servicio al Cliente'
  
  const isAccountingMode = searchParams.get('mode') === 'accounting' || isAccounting

  const canEditReport = !isAccountingMode && (isAdmin || isCustomerService)
  const canEditFinancials = isAdmin || isAccounting
  const canSeeFinancials = isAdmin || isAccounting || isCustomerService

  const allNotes = localRequest.interventions.map(i => `[${i.type} - ${MOCK_TECHNICIANS.find(t => t.id === i.technicianId)?.name}]: ${i.notes}`).join('\n')
  
  const totalLabor = localRequest.interventions.reduce((sum, i) => sum + i.laborCost, 0)
  const allExpenses = localRequest.interventions.flatMap(i => i.detailedExpenses.filter(e => !e.isUnused))
  const totalUsedExpenses = allExpenses.reduce((s, e) => s + e.amount, 0)
  const totalSuggested = totalLabor + totalUsedExpenses

  // Helper to check if an expense matches warehouse items
  const checkWarehouseStock = (expenseDescription: string) => {
    if (!inventoryItems) return null
    const search = expenseDescription.toUpperCase().trim()
    return inventoryItems.find(item => search.includes(item.description.toUpperCase()) || item.description.toUpperCase().includes(search))
  }

  const handleGenerateSummary = async () => {
    if (!canEditReport) return;
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

  const handleSaveAll = () => {
    if (!db || !id) return
    setIsSaving(true)
    
    const dataToSave = {
      ...localRequest,
      report,
      accountingNotes,
      requestedAmount: requestedAmount || totalSuggested,
      approvedAmount: approvedAmount,
      updatedAt: new Date().toISOString()
    }
    
    const docRef = doc(db, 'service_requests', id as string)
    setDoc(docRef, dataToSave, { merge: true })
      .then(() => {
        toast({ title: "Cambios Guardados", description: "El expediente ha sido actualizado correctamente." })
      })
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: docRef.path,
          operation: "update",
          requestResourceData: dataToSave,
        })
        errorEmitter.emit("permission-error", permissionError)
      })
      .finally(() => setIsSaving(false))
  }

  const handleUpdateBilling = () => {
    if (!canEditFinancials || !db || !id) return;
    setIsSaving(true)
    
    const billingUpdate = {
      approvedAmount: approvedAmount,
      requestedAmount: requestedAmount || totalSuggested,
      accountingNotes: accountingNotes,
      billingStatus: 'ready_to_bill',
      updatedAt: new Date().toISOString()
    }

    const docRef = doc(db, 'service_requests', id as string)
    updateDoc(docRef, billingUpdate)
      .then(() => {
        setIsConciliated(true)
        toast({ 
          title: "Valores Conciliados", 
          description: `Se ha fijado el valor de cobro en $${approvedAmount.toLocaleString()}.` 
        })
      })
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: docRef.path,
          operation: "update",
          requestResourceData: billingUpdate,
        })
        errorEmitter.emit("permission-error", permissionError)
      })
      .finally(() => setIsSaving(false))
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
              <h1 className="text-2xl font-black tracking-tighter text-primary uppercase">{localRequest.claimNumber}</h1>
              <StatusBadge status={localRequest.status} />
              {isAccountingMode && (
                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 font-black text-[9px] uppercase">
                  Modo Contable Activo
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
              <CategoryIcon category={localRequest.category} className="h-4 w-4 text-primary" />
              {localRequest.category}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {canEditReport && (
            <Button className="gap-2 bg-green-600 hover:bg-green-700 font-bold shadow-lg" onClick={handleSaveAll} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} 
              Finalizar y Guardar Reporte
            </Button>
          )}
          {canEditFinancials && (
             <Button className="gap-2 bg-primary font-bold shadow-lg" onClick={handleUpdateBilling} disabled={isSaving}>
                <Save className="h-4 w-4" /> Guardar Cambios Contables
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
              <CardContent className="pt-4 space-y-1">
                <p className="font-black text-xl text-slate-800">{localRequest.insuredName}</p>
                <div className="flex items-center gap-4">
                  <span className="text-xs font-bold text-slate-500">{localRequest.phoneNumber}</span>
                  <Badge variant="outline" className="text-[10px] uppercase font-black bg-blue-50 text-blue-700 border-blue-200">
                    {localRequest.accountName}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-l-4 border-l-primary overflow-hidden">
              <CardHeader className="pb-3 bg-slate-50/50">
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Descripción Operativa</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <p className="text-sm font-medium text-slate-700 leading-relaxed">{localRequest.description}</p>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-lg border-t-4 border-t-slate-800">
            <CardHeader className="bg-slate-50">
              <CardTitle className="text-lg font-black uppercase flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" /> Detalle de Cobro Sugerido
              </CardTitle>
              <CardDescription className="text-xs font-medium">Basado en intervenciones y gastos registrados.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-xs font-black uppercase text-slate-600">Mano de Obra Total</span>
                  <span className="font-mono font-black text-slate-800">${totalLabor.toLocaleString()}</span>
                </div>
              </div>
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-xs font-black uppercase text-slate-600">Materiales y Otros Gastos</span>
                  <span className="font-mono font-black text-slate-800">${totalUsedExpenses.toLocaleString()}</span>
                </div>
              </div>
              <div className="flex justify-between items-center bg-primary/5 p-4 rounded-xl border border-primary/10 mt-4">
                <span className="text-sm font-black uppercase text-primary">Total Operativo Sugerido</span>
                <span className="text-2xl font-mono font-black text-primary">${totalSuggested.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <h2 className="text-xl font-black tracking-tighter flex items-center gap-2 text-slate-800 uppercase">
              <Wrench className="h-5 w-5 text-primary" /> Intervenciones y Gastos
            </h2>
            {localRequest.interventions.map((intervention) => (
              <Card key={intervention.id} className="overflow-hidden border-none shadow-md">
                <CardHeader className="bg-slate-50 py-3 border-b flex flex-row items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge className="bg-primary/10 text-primary font-black uppercase text-[9px]">{intervention.type}</Badge>
                    <span className="text-[10px] font-bold text-slate-400">{new Date(intervention.date).toLocaleDateString()}</span>
                    <span className="font-black text-[11px] text-slate-600 uppercase">{MOCK_TECHNICIANS.find(t => t.id === intervention.technicianId)?.name}</span>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  <p className="text-sm text-slate-700 italic leading-relaxed">"{intervention.notes}"</p>
                  
                  {/* Expense Checking Logic */}
                  {intervention.detailedExpenses.length > 0 && (
                    <div className="space-y-3 pt-2">
                      <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest border-b pb-1">Análisis de Gastos de Campo</p>
                      {intervention.detailedExpenses.map(exp => {
                        const warehouseItem = checkWarehouseStock(exp.description)
                        return (
                          <div key={exp.id} className="flex flex-col gap-2 p-3 bg-slate-50 rounded-lg border">
                            <div className="flex justify-between items-start">
                              <div className="flex flex-col">
                                <span className="text-xs font-bold text-slate-800">{exp.description}</span>
                                <span className="text-[10px] text-muted-foreground">Valor solicitado: ${exp.amount.toLocaleString()}</span>
                              </div>
                              <Badge variant="outline" className="text-[9px] font-black uppercase bg-white">
                                {exp.category}
                              </Badge>
                            </div>

                            {warehouseItem && (
                              <Alert className="bg-blue-50 border-blue-200 text-blue-800 py-2">
                                <Warehouse className="h-4 w-4 text-blue-600" />
                                <AlertTitle className="text-[10px] font-black uppercase mb-1">Stock Disponible en Bodega</AlertTitle>
                                <AlertDescription className="text-[11px] leading-tight flex flex-col gap-2">
                                  <span>Contamos con <strong>{warehouseItem.quantity} unidades</strong> de "{warehouseItem.description}" en bodega central.</span>
                                  <div className="flex gap-2 mt-1">
                                    <Button variant="outline" size="sm" className="h-7 text-[9px] font-black uppercase bg-white border-blue-300 text-blue-700 hover:bg-blue-100 gap-1">
                                      <Warehouse className="h-3 w-3" /> Tomar de Bodega
                                    </Button>
                                    <Button variant="outline" size="sm" className="h-7 text-[9px] font-black uppercase bg-white border-slate-300 text-slate-600 hover:bg-slate-100 gap-1">
                                      <ShoppingCart className="h-3 w-3" /> Comprar Externo
                                    </Button>
                                  </div>
                                </AlertDescription>
                              </Alert>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6">
            <Card className="shadow-lg border-t-4 border-t-green-500">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-black text-green-700 uppercase">Reporte Técnico Formal</CardTitle>
                </div>
                {canEditReport ? (
                  <Button size="sm" variant="outline" className="gap-2 font-bold" onClick={handleGenerateSummary} disabled={isSummarizing}>
                    <Sparkles className="h-4 w-4" /> Consolidar con IA
                  </Button>
                ) : (
                   <Badge variant="outline" className="gap-1 font-bold bg-slate-100 text-slate-500 border-slate-200">
                      <Lock className="h-3 w-3" /> Solo Lectura (Módulo Contable)
                   </Badge>
                )}
              </CardHeader>
              <CardContent>
                {canEditReport ? (
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
                    disabled={!canEditFinancials}
                  />
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {canEditFinancials && (
            <Card className="shadow-lg border-t-8 border-t-primary sticky top-24 overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b">
                <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                  <RefreshCw className="h-3 w-3 text-primary" /> Módulo de Conciliación
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">Valor Sugerido por Operación</Label>
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-dashed">
                    <span className="text-xl font-mono font-black text-slate-800">${totalSuggested.toLocaleString()}</span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-[10px] font-bold text-primary gap-1"
                      onClick={() => setApprovedAmount(totalSuggested)}
                    >
                      USAR SUGERIDO <ArrowRight className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-800">Valor real de cobro final</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                      <Input 
                        type="number" 
                        className="pl-10 h-14 text-2xl font-mono font-black border-primary bg-primary/5 focus-visible:ring-primary shadow-inner" 
                        value={approvedAmount} 
                        onChange={(e) => setApprovedAmount(Number(e.target.value))} 
                        placeholder="0"
                      />
                    </div>
                  </div>

                  {isConciliated && (
                    <div className="p-4 bg-green-50 rounded-xl border-2 border-green-200 flex flex-col items-center justify-center gap-1 animate-in zoom-in-95">
                      <span className="text-[10px] font-black text-green-600 uppercase tracking-widest">Valor Conciliado</span>
                      <span className="text-3xl font-mono font-black text-green-700">${approvedAmount.toLocaleString()}</span>
                    </div>
                  )}

                  <Button 
                    className="w-full h-14 bg-primary hover:bg-primary/90 font-black uppercase tracking-widest shadow-xl text-lg gap-2" 
                    onClick={handleUpdateBilling}
                    disabled={isSaving || approvedAmount <= 0}
                  >
                    {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />} 
                    ACTUALIZAR COBRO
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
