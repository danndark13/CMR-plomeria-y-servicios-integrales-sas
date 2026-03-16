
"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { MOCK_REQUESTS, MOCK_TECHNICIANS, MOCK_COMPANIES } from "@/lib/mock-data"
import { ServiceRequest, Expense, TechnicianIntervention, InterventionType, ExpenseCategory } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
  ShoppingCart,
  AlertCircle,
  Plus,
  Trash2,
  User,
  MapPin,
  ClipboardList
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
  const [isSaving, setIsSaving] = useState(false)
  
  // Form States for adding new intervention
  const [showAddEntry, setShowAddEntry] = useState(false)
  const [newIntervention, setNewIntervention] = useState<Partial<TechnicianIntervention>>({
    type: 'Diagnóstico',
    notes: '',
    laborCost: 0,
    detailedExpenses: []
  })
  const [tempExpense, setTempExpense] = useState<Partial<Expense>>({
    description: '',
    amount: 0,
    category: 'material'
  })

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
    } else if (isRequestLoading === false) {
      const found = MOCK_REQUESTS.find(r => r.id === id || r.claimNumber === id)
      if (found) setLocalRequest(found)
    }
  }, [firestoreRequest, id, isRequestLoading])

  if (isRequestLoading || isProfileLoading) return (
    <div className="p-20 text-center flex flex-col items-center gap-4">
      <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
      <p className="text-muted-foreground font-bold tracking-tighter uppercase text-xs">Sincronizando expediente...</p>
    </div>
  )

  if (!localRequest) return (
    <div className="p-20 text-center flex flex-col items-center gap-4">
      <AlertCircle className="h-12 w-12 text-destructive opacity-40" />
      <h2 className="text-xl font-black uppercase text-slate-800">Expediente no encontrado</h2>
      <Button onClick={() => router.push('/requests')} variant="outline" className="mt-4">Regresar</Button>
    </div>
  )

  const isAdmin = profile?.roleId === 'Administrador'
  const isAccounting = profile?.roleId === 'Contabilidad'
  const isCustomerService = profile?.roleId === 'Servicio al Cliente'
  const canEdit = isAdmin || isCustomerService

  const handleUpdateField = (field: keyof ServiceRequest, value: any) => {
    if (!canEdit) return
    setLocalRequest(prev => prev ? { ...prev, [field]: value } : null)
  }

  const handleAddExpense = () => {
    if (!tempExpense.description || !tempExpense.amount) return
    const expense: Expense = {
      id: Math.random().toString(36).substring(7),
      description: tempExpense.description,
      amount: Number(tempExpense.amount),
      category: (tempExpense.category as ExpenseCategory) || 'material',
      isUnused: false
    }
    setNewIntervention(prev => ({
      ...prev,
      detailedExpenses: [...(prev.detailedExpenses || []), expense]
    }))
    setTempExpense({ description: '', amount: 0, category: 'material' })
  }

  const handleRemoveExpense = (expenseId: string) => {
    setNewIntervention(prev => ({
      ...prev,
      detailedExpenses: (prev.detailedExpenses || []).filter(e => e.id !== expenseId)
    }))
  }

  const handleSaveIntervention = () => {
    if (!db || !requestRef || !profile) return
    if (!newIntervention.technicianId || !newIntervention.notes) {
      toast({ variant: "destructive", title: "Campos incompletos", description: "Debe asignar un técnico y redactar notas." })
      return
    }

    setIsSaving(true)
    const intervention: TechnicianIntervention = {
      id: Math.random().toString(36).substring(7),
      technicianId: newIntervention.technicianId,
      type: (newIntervention.type as InterventionType) || 'Diagnóstico',
      date: new Date().toISOString(),
      notes: newIntervention.notes,
      laborCost: Number(newIntervention.laborCost) || 0,
      detailedExpenses: newIntervention.detailedExpenses || [],
      authorName: `${profile.firstName} ${profile.lastName}`
    }

    const updatedInterventions = [...(localRequest.interventions || []), intervention]
    const updatedData = { 
      ...localRequest, 
      interventions: updatedInterventions,
      updatedAt: new Date().toISOString()
    }

    setDoc(requestRef, updatedData, { merge: true })
      .then(() => {
        toast({ title: "Reporte Añadido", description: "La intervención ha sido registrada exitosamente." })
        setShowAddEntry(false)
        setNewIntervention({ type: 'Diagnóstico', notes: '', laborCost: 0, detailedExpenses: [] })
      })
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: requestRef.path,
          operation: "update",
          requestResourceData: updatedData,
        })
        errorEmitter.emit("permission-error", permissionError)
      })
      .finally(() => setIsSaving(false))
  }

  const handleSaveMainInfo = () => {
    if (!db || !requestRef || !canEdit) return
    setIsSaving(true)
    const dataToSave = {
      insuredName: localRequest.insuredName,
      claimNumber: localRequest.claimNumber,
      address: localRequest.address,
      phoneNumber: localRequest.phoneNumber,
      report: localRequest.report,
      requestedAmount: localRequest.requestedAmount,
      approvedAmount: localRequest.approvedAmount,
      accountingNotes: localRequest.accountingNotes,
      updatedAt: new Date().toISOString()
    }

    updateDoc(requestRef, dataToSave)
      .then(() => toast({ title: "Información Actualizada" }))
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: requestRef.path,
          operation: "update",
          requestResourceData: dataToSave,
        })
        errorEmitter.emit("permission-error", permissionError)
      })
      .finally(() => setIsSaving(false))
  }

  const checkWarehouseStock = (desc: string) => {
    if (!inventoryItems) return null
    const search = desc.toUpperCase()
    return inventoryItems.find(i => search.includes(i.description.toUpperCase()) || i.description.toUpperCase().includes(search))
  }

  const totalLabor = localRequest.interventions.reduce((sum, i) => sum + i.laborCost, 0)
  const totalExpenses = localRequest.interventions.flatMap(i => i.detailedExpenses).reduce((sum, e) => sum + e.amount, 0)
  const totalSuggested = totalLabor + totalExpenses

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-xl">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              {canEdit ? (
                <Input 
                  value={localRequest.claimNumber} 
                  onChange={(e) => handleUpdateField('claimNumber', e.target.value.toUpperCase())}
                  className="w-40 font-black h-8 text-primary uppercase"
                />
              ) : (
                <h1 className="text-2xl font-black text-primary uppercase">{localRequest.claimNumber}</h1>
              )}
              <StatusBadge status={localRequest.status} />
            </div>
            <p className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2">
              <CategoryIcon category={localRequest.category} className="h-3 w-3" /> {localRequest.category}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <Button className="gap-2 font-black shadow-lg" onClick={handleSaveMainInfo} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} GUARDAR CAMBIOS
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-6">
          {/* Cliente Information */}
          <Card className="border-l-4 border-l-primary shadow-sm">
            <CardHeader className="pb-3 border-b bg-slate-50/50">
              <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Información del Cliente</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase">Nombre Asegurado</Label>
                <Input 
                  value={localRequest.insuredName} 
                  onChange={(e) => handleUpdateField('insuredName', e.target.value)}
                  disabled={!canEdit}
                  className="font-bold"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase">Teléfono</Label>
                <Input 
                  value={localRequest.phoneNumber} 
                  onChange={(e) => handleUpdateField('phoneNumber', e.target.value)}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label className="text-[10px] font-black uppercase">Dirección de Visita</Label>
                <Input 
                  value={localRequest.address} 
                  onChange={(e) => handleUpdateField('address', e.target.value)}
                  disabled={!canEdit}
                />
              </div>
            </CardContent>
          </Card>

          {/* Interventions History */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black uppercase tracking-tighter flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" /> Historial de Reportes
              </h2>
              {canEdit && (
                <Button variant="outline" size="sm" className="gap-2 font-bold" onClick={() => setShowAddEntry(!showAddEntry)}>
                  {showAddEntry ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />} 
                  {showAddEntry ? "Cancelar" : "Añadir Reporte"}
                </Button>
              )}
            </div>

            {showAddEntry && (
              <Card className="border-2 border-dashed border-primary animate-in slide-in-from-top-4">
                <CardHeader className="bg-primary/5">
                  <CardTitle className="text-sm font-black uppercase">Nuevo Registro de Intervención</CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase">Técnico Asignado</Label>
                      <Select value={newIntervention.technicianId} onValueChange={(v) => setNewIntervention({...newIntervention, technicianId: v})}>
                        <SelectTrigger><SelectValue placeholder="Seleccionar técnico" /></SelectTrigger>
                        <SelectContent>
                          {MOCK_TECHNICIANS.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase">Tipo de Intervención</Label>
                      <Select value={newIntervention.type} onValueChange={(v) => setNewIntervention({...newIntervention, type: v as InterventionType})}>
                        <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Diagnóstico">Diagnóstico</SelectItem>
                          <SelectItem value="Reparación">Reparación</SelectItem>
                          <SelectItem value="Seguimiento">Seguimiento</SelectItem>
                          <SelectItem value="Finalización">Finalización</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase">Notas Técnicas / Hallazgos</Label>
                    <Textarea 
                      placeholder="Describa el trabajo realizado..." 
                      value={newIntervention.notes}
                      onChange={(e) => setNewIntervention({...newIntervention, notes: e.target.value})}
                    />
                  </div>

                  <div className="space-y-4 p-4 bg-slate-50 rounded-lg border">
                    <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Gastos y Mano de Obra</Label>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black">Costo Mano de Obra ($)</Label>
                        <Input type="number" value={newIntervention.laborCost} onChange={(e) => setNewIntervention({...newIntervention, laborCost: Number(e.target.value)})} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black">Añadir Insumo/Gasto</Label>
                        <div className="flex gap-2">
                          <Input placeholder="Desc" value={tempExpense.description} onChange={(e) => setTempExpense({...tempExpense, description: e.target.value})} />
                          <Input type="number" placeholder="$" className="w-24" value={tempExpense.amount} onChange={(e) => setTempExpense({...tempExpense, amount: Number(e.target.value)})} />
                          <Button size="icon" onClick={handleAddExpense}><Plus className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {newIntervention.detailedExpenses?.map(exp => (
                        <div key={exp.id} className="flex items-center justify-between p-2 bg-white rounded border text-xs">
                          <span className="font-bold uppercase">{exp.description}</span>
                          <div className="flex items-center gap-3">
                            <span className="font-mono">${exp.amount.toLocaleString()}</span>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleRemoveExpense(exp.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button className="w-full font-black shadow-lg" onClick={handleSaveIntervention} disabled={isSaving}>
                    REGISTRAR REPORTE EN BITÁCORA
                  </Button>
                </CardContent>
              </Card>
            )}

            <div className="space-y-4">
              {localRequest.interventions.length > 0 ? [...localRequest.interventions].reverse().map((item) => (
                <Card key={item.id} className="overflow-hidden border-none shadow-md group">
                  <CardHeader className="bg-slate-50 py-3 flex flex-row items-center justify-between border-b">
                    <div className="flex items-center gap-3">
                      <Badge className="bg-primary/10 text-primary font-black uppercase text-[9px]">{item.type}</Badge>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase text-slate-400">
                          {new Date(item.date).toLocaleDateString()} {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="text-[10px] font-bold text-primary uppercase">
                          Técnico: {MOCK_TECHNICIANS.find(t => t.id === item.technicianId)?.name || 'N/A'}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] font-black text-slate-400 uppercase italic">Autor: {item.authorName || "Sistema"}</span>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-4">
                    <p className="text-sm text-slate-700 leading-relaxed italic border-l-4 border-slate-200 pl-4">
                      "{item.notes}"
                    </p>
                    
                    {item.detailedExpenses.length > 0 && (
                      <div className="grid gap-2">
                        {item.detailedExpenses.map(exp => {
                          const stock = checkWarehouseStock(exp.description)
                          return (
                            <div key={exp.id} className="flex flex-col gap-2 p-3 bg-slate-50 rounded-lg border">
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-bold uppercase">{exp.description}</span>
                                <span className="text-xs font-mono font-black">${exp.amount.toLocaleString()}</span>
                              </div>
                              {stock && (
                                <Alert className="bg-blue-50 border-blue-200 py-1.5 px-3">
                                  <div className="flex items-center gap-2">
                                    <Warehouse className="h-3 w-3 text-blue-600" />
                                    <p className="text-[10px] font-bold text-blue-800">
                                      STOCK DISPONIBLE: En bodega hay {stock.quantity} de "{stock.description}"
                                    </p>
                                  </div>
                                </Alert>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                    
                    <div className="flex justify-end pt-2 border-t text-[10px] font-bold text-slate-500 gap-4">
                      <span>Mano de Obra: ${item.laborCost.toLocaleString()}</span>
                      <span className="text-primary">Subtotal: ${(item.laborCost + item.detailedExpenses.reduce((s,e) => s+e.amount, 0)).toLocaleString()}</span>
                    </div>
                  </CardContent>
                </Card>
              )) : (
                <div className="py-20 text-center border-2 border-dashed rounded-xl">
                  <ClipboardList className="h-12 w-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-sm font-bold text-slate-400">No hay intervenciones registradas</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          {/* Financials & Billing */}
          <Card className="shadow-lg border-t-8 border-t-primary overflow-hidden sticky top-24">
            <CardHeader className="bg-slate-50/50 border-b">
              <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" /> Módulo Financiero
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="space-y-3">
                <div className="flex justify-between text-[10px] font-black uppercase text-slate-500">
                  <span>Costo Sugerido</span>
                  <span>M.O + Gastos</span>
                </div>
                <div className="p-4 bg-slate-900 rounded-xl flex items-center justify-between text-white shadow-inner">
                  <span className="text-2xl font-mono font-black">${totalSuggested.toLocaleString()}</span>
                  <RefreshCw className="h-5 w-5 opacity-20" />
                </div>
              </div>

              {(isAdmin || isAccounting) && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-primary">Valor de Cobro (Aprobado)</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-primary" />
                      <Input 
                        type="number" 
                        value={localRequest.approvedAmount} 
                        onChange={(e) => handleUpdateField('approvedAmount', Number(e.target.value))}
                        className="pl-10 h-14 text-2xl font-mono font-black border-primary bg-primary/5 focus-visible:ring-primary shadow-lg"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase">Notas de Contabilidad</Label>
                    <Textarea 
                      placeholder="Deducciones, transportes, etc..." 
                      className="text-xs font-medium border-orange-200"
                      value={localRequest.accountingNotes}
                      onChange={(e) => handleUpdateField('accountingNotes', e.target.value)}
                    />
                  </div>

                  <Button className="w-full h-12 font-black shadow-xl uppercase tracking-widest" onClick={handleSaveMainInfo} disabled={isSaving}>
                    CONCILIAR VALORES
                  </Button>
                </div>
              )}

              <div className="pt-4 border-t space-y-2">
                 <div className="flex justify-between text-[11px] font-bold">
                    <span className="text-muted-foreground uppercase">Mano de Obra</span>
                    <span className="text-slate-700">${totalLabor.toLocaleString()}</span>
                 </div>
                 <div className="flex justify-between text-[11px] font-bold">
                    <span className="text-muted-foreground uppercase">Gastos Materiales</span>
                    <span className="text-slate-700">${totalExpenses.toLocaleString()}</span>
                 </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-blue-600 text-white shadow-xl">
             <CardHeader className="pb-2">
                <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                   <Info className="h-4 w-4" /> Reporte para Asistencia
                </CardTitle>
             </CardHeader>
             <CardContent className="space-y-4">
                <Textarea 
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40 text-xs min-h-[100px] font-medium"
                  placeholder="Redacte aquí el resumen técnico formal que se enviará a la aseguradora..."
                  value={localRequest.report}
                  onChange={(e) => handleUpdateField('report', e.target.value)}
                  disabled={!canEdit}
                />
                <Button variant="outline" className="w-full bg-white/10 hover:bg-white/20 border-white/30 text-white font-bold text-xs gap-2" onClick={handleGenerateSummary} disabled={!canEdit}>
                   <Sparkles className="h-3.5 w-3.5" /> Generar con IA (Flash)
                </Button>
             </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
