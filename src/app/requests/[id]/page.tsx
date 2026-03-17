
"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { MOCK_REQUESTS, MOCK_TECHNICIANS } from "@/lib/mock-data"
import { ServiceRequest, Expense, TechnicianIntervention, InterventionType, ServiceStatus, UnitOfMeasure, ScheduledVisit, ExpenseCategory } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  ArrowLeft, 
  Loader2,
  Save,
  Warehouse,
  AlertCircle,
  Plus,
  Trash2,
  ClipboardList,
  X,
  Calculator,
  CalendarDays,
  Clock,
  CheckCircle2,
  PackageCheck,
  PackageX,
  Hammer,
  Search,
  HandCoins
} from "lucide-react"
import { StatusBadge } from "@/components/crm/status-badge"
import { CategoryIcon } from "@/components/crm/category-icon"
import { toast } from "@/hooks/use-toast"
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase'
import { doc, setDoc, updateDoc, collection } from 'firebase/firestore'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'

const UNITS: UnitOfMeasure[] = ['UND', 'KG', 'MTS', 'GL', 'PAR', 'LB', 'PQ', 'VIAJE']

export default function RequestDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { user } = useUser()
  const db = useFirestore()
  
  const [localRequest, setLocalRequest] = useState<ServiceRequest | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  
  const [showAddEntry, setShowAddEntry] = useState(false)
  
  const [newIntervention, setNewIntervention] = useState<Partial<TechnicianIntervention>>({
    type: 'Diagnóstico',
    notes: '',
    reportedValue: 0,
    usedRotomartillo: false,
    usedGeofono: false,
    detailedExpenses: []
  })
  
  const [tempExpense, setTempExpense] = useState<Partial<Expense>>({
    description: '',
    unit: 'UND',
    quantity: 1,
    unitValue: 0,
    category: 'material'
  })

  const inventoryQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return collection(db, "inventory")
  }, [db, user])
  const { data: inventoryItems } = useCollection(inventoryQuery)

  const requestRef = useMemoFirebase(() => {
    if (!db || !id || !user) return null
    return doc(db, 'service_requests', id as string)
  }, [db, id, user])

  const { data: firestoreRequest, isLoading: isRequestLoading } = useDoc(requestRef)
  
  const profileRef = useMemoFirebase(() => (user && db ? doc(db, 'user_profiles', user.uid) : null), [user, db])
  const { data: profile, isLoading: isProfileLoading } = useDoc(profileRef)

  useEffect(() => {
    if (firestoreRequest) {
      setLocalRequest(firestoreRequest as any)
    } else if (isRequestLoading === false) {
      const found = MOCK_REQUESTS.find(r => r.id === id || r.claimNumber === id)
      if (found) setLocalRequest(found as any)
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
  const isCompleted = localRequest.status === 'completed'
  const isPrivilegedRole = isAdmin || isAccounting
  const canEdit = isPrivilegedRole || (isCustomerService && !isCompleted)

  const handleUpdateField = (field: keyof ServiceRequest, value: any) => {
    if (!canEdit) return
    setLocalRequest(prev => prev ? { ...prev, [field]: value } : null)
  }

  const handleToggleExpenseUsage = (interventionId: string, expenseId: string, currentUnused: boolean) => {
    if (!db || !requestRef || !canEdit) return

    const updatedInterventions = (localRequest.interventions || []).map(interv => {
      if (interv.id === interventionId) {
        const updatedExpenses = (interv.detailedExpenses || []).map(exp => {
          if (exp.id === expenseId) {
            return { ...exp, isUnused: !currentUnused }
          }
          return exp
        })
        return { ...interv, detailedExpenses: updatedExpenses }
      }
      return interv
    })

    const updatedData = {
      interventions: updatedInterventions,
      updatedAt: new Date().toISOString()
    }

    updateDoc(requestRef, updatedData).catch(err => console.error(err))
    setLocalRequest(prev => prev ? { ...prev, ...updatedData } : null)
  }

  const handleApproveForPayroll = (interventionId: string) => {
    if (!db || !requestRef || !isPrivilegedRole) return

    const updatedInterventions = (localRequest.interventions || []).map(interv => {
      if (interv.id === interventionId) {
        return { ...interv, isReadyForPayroll: true }
      }
      return interv
    })

    const updatedData = {
      interventions: updatedInterventions,
      updatedAt: new Date().toISOString()
    }

    updateDoc(requestRef, updatedData)
      .then(() => {
        toast({ title: "Reporte Aprobado", description: "El reporte ya está disponible en el módulo de nómina." })
        setLocalRequest(prev => prev ? { ...prev, ...updatedData } : null)
      })
      .catch(err => console.error(err))
  }

  const handleAddExpense = () => {
    if (!tempExpense.description || !tempExpense.quantity || !tempExpense.unitValue) return
    const totalAmount = (tempExpense.quantity || 0) * (tempExpense.unitValue || 0)
    const expense: Expense = {
      id: Math.random().toString(36).substring(7),
      description: tempExpense.description,
      unit: tempExpense.unit as UnitOfMeasure,
      quantity: Number(tempExpense.quantity),
      unitValue: Number(tempExpense.unitValue),
      amount: totalAmount,
      category: (tempExpense.category as ExpenseCategory) || 'material',
      isUnused: false
    }
    setNewIntervention(prev => ({
      ...prev,
      detailedExpenses: [...(prev.detailedExpenses || []), expense]
    }))
    setTempExpense({ description: '', unit: 'UND', quantity: 1, unitValue: 0, category: 'material' })
  }

  const handleSaveIntervention = () => {
    if (!db || !requestRef || !profile || !canEdit) return
    if (!newIntervention.technicianId || !newIntervention.notes) {
      toast({ variant: "destructive", title: "Campos incompletos", description: "Debe asignar un técnico y notas." })
      return
    }

    setIsSaving(true)
    const intervention: TechnicianIntervention = {
      id: Math.random().toString(36).substring(7),
      technicianId: newIntervention.technicianId!,
      type: (newIntervention.type as InterventionType) || 'Diagnóstico',
      date: new Date().toISOString(),
      notes: newIntervention.notes!,
      reportedValue: Number(newIntervention.reportedValue) || 0,
      laborCost: 0,
      usedRotomartillo: !!newIntervention.usedRotomartillo,
      usedGeofono: !!newIntervention.usedGeofono,
      detailedExpenses: newIntervention.detailedExpenses || [],
      authorName: `${profile.firstName} ${profile.lastName}`,
      payrollStatus: 'pending'
    }

    const updatedInterventions = [...(localRequest.interventions || []), intervention]
    const updatedData = { 
      interventions: updatedInterventions,
      updatedAt: new Date().toISOString()
    }

    updateDoc(requestRef, updatedData)
      .then(() => {
        toast({ title: "Reporte Añadido" })
        setShowAddEntry(false)
        setLocalRequest(prev => prev ? { ...prev, ...updatedData } : null)
        setNewIntervention({ type: 'Diagnóstico', notes: '', reportedValue: 0, usedRotomartillo: false, usedGeofono: false, detailedExpenses: [] })
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
      status: localRequest.status,
      updatedAt: new Date().toISOString()
    }

    updateDoc(requestRef, dataToSave)
      .then(() => toast({ title: "Información Actualizada" }))
      .finally(() => setIsSaving(false))
  }

  const interventions = localRequest.interventions || []

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-xl">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black text-primary uppercase">{localRequest.claimNumber}</h1>
              {canEdit ? (
                <Select value={localRequest.status} onValueChange={(v) => handleUpdateField('status', v as ServiceStatus)}>
                  <SelectTrigger className="w-[140px] h-8 font-black uppercase text-[10px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendiente</SelectItem>
                    <SelectItem value="assigned">Programado</SelectItem>
                    <SelectItem value="in_progress">En Proceso</SelectItem>
                    <SelectItem value="completed">Finalizado</SelectItem>
                    <SelectItem value="warranty">Garantía</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <StatusBadge status={localRequest.status} />
              )}
            </div>
            <p className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2">
              <CategoryIcon category={localRequest.category} className="h-3 w-3" /> {localRequest.category}
            </p>
          </div>
        </div>
        {canEdit && (
          <Button className="gap-2 font-black shadow-lg" onClick={handleSaveMainInfo} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} GUARDAR CAMBIOS
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-6">
          <Card className="border-l-4 border-l-primary shadow-sm">
            <CardHeader className="pb-3 border-b bg-slate-50/50">
              <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Información del Cliente</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase">Nombre Asegurado</Label>
                <Input 
                  value={localRequest.insuredName || ""} 
                  onChange={(e) => handleUpdateField('insuredName', e.target.value.toUpperCase())}
                  disabled={!canEdit}
                  className="font-bold"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase">Teléfono</Label>
                <Input 
                  value={localRequest.phoneNumber || ""} 
                  onChange={(e) => handleUpdateField('phoneNumber', e.target.value)}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label className="text-[10px] font-black uppercase">Dirección de Visita</Label>
                <Input 
                  value={localRequest.address || ""} 
                  onChange={(e) => handleUpdateField('address', e.target.value.toUpperCase())}
                  disabled={!canEdit}
                />
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black uppercase tracking-tighter flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" /> Bitácora de Reportes
              </h2>
              {canEdit && (
                <Button variant="outline" size="sm" className="gap-2 font-bold" onClick={() => setShowAddEntry(!showAddEntry)}>
                  {showAddEntry ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />} 
                  {showAddEntry ? "Cancelar" : "Añadir Reporte Técnico"}
                </Button>
              )}
            </div>

            {showAddEntry && canEdit && (
              <Card className="border-2 border-dashed border-primary animate-in slide-in-from-top-4 shadow-xl">
                <CardHeader className="bg-primary/5">
                  <CardTitle className="text-sm font-black uppercase">Nuevo Registro de Intervención</CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase">Técnico Asignado</Label>
                      <Select value={newIntervention.technicianId} onValueChange={(v) => setNewIntervention({...newIntervention, technicianId: v})}>
                        <SelectTrigger className="h-10"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                        <SelectContent>
                          {MOCK_TECHNICIANS.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase">Tipo de Intervención</Label>
                      <Select value={newIntervention.type} onValueChange={(v) => setNewIntervention({...newIntervention, type: v as InterventionType})}>
                        <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Diagnóstico">Diagnóstico</SelectItem>
                          <SelectItem value="Reparación">Reparación</SelectItem>
                          <SelectItem value="Seguimiento">Seguimiento</SelectItem>
                          <SelectItem value="Finalización">Finalización</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-blue-600">Valor a Cobrar ($)</Label>
                      <Input 
                        type="number" 
                        placeholder="Ej. 150000" 
                        className="h-10 font-black border-blue-200"
                        value={newIntervention.reportedValue}
                        onChange={(e) => setNewIntervention({...newIntervention, reportedValue: Number(e.target.value)})}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 p-4 bg-slate-50 rounded-xl border border-dashed">
                    <p className="text-[10px] font-black uppercase text-slate-500 col-span-2 tracking-widest">Alquiler de Herramientas Especiales</p>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="rotomartillo" 
                        checked={newIntervention.usedRotomartillo} 
                        onCheckedChange={(v) => setNewIntervention({...newIntervention, usedRotomartillo: !!v})}
                      />
                      <Label htmlFor="rotomartillo" className="text-xs font-bold uppercase flex items-center gap-2">
                        Rotomartillo <span className="text-primary font-black">($80.000)</span>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="geofono" 
                        checked={newIntervention.usedGeofono} 
                        onCheckedChange={(v) => setNewIntervention({...newIntervention, usedGeofono: !!v})}
                      />
                      <Label htmlFor="geofono" className="text-xs font-bold uppercase flex items-center gap-2">
                        Geófono <span className="text-primary font-black">($120.000)</span>
                      </Label>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase">Notas Técnicas / Hallazgos</Label>
                    <Textarea 
                      placeholder="Describa el trabajo realizado..." 
                      className="min-h-[100px]"
                      value={newIntervention.notes}
                      onChange={(e) => setNewIntervention({...newIntervention, notes: e.target.value})}
                    />
                  </div>

                  <div className="space-y-4 p-4 bg-white rounded-xl border border-slate-200 shadow-inner">
                    <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Facturas de Materiales / Gastos</Label>
                    <div className="grid gap-2 md:grid-cols-12">
                      <Input placeholder="Descripción" className="md:col-span-5 h-8 text-xs" value={tempExpense.description} onChange={(e) => setTempExpense({...tempExpense, description: e.target.value.toUpperCase()})} />
                      <Select value={tempExpense.unit} onValueChange={(v) => setTempExpense({...tempExpense, unit: v as UnitOfMeasure})}>
                        <SelectTrigger className="md:col-span-2 h-8 text-[10px] font-bold"><SelectValue /></SelectTrigger>
                        <SelectContent>{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                      </Select>
                      <Input type="number" placeholder="Cant" className="md:col-span-1 h-8 text-xs" value={tempExpense.quantity} onChange={(e) => setTempExpense({...tempExpense, quantity: Number(e.target.value)})} />
                      <Input type="number" placeholder="V. Unit" className="md:col-span-2 h-8 text-xs" value={tempExpense.unitValue} onChange={(e) => setTempExpense({...tempExpense, unitValue: Number(e.target.value)})} />
                      <Button size="sm" className="md:col-span-2 h-8 font-black text-[10px]" onClick={handleAddExpense}><Plus className="h-3 w-3 mr-1" /> AÑADIR</Button>
                    </div>
                    <div className="space-y-2 mt-2">
                      {newIntervention.detailedExpenses?.map(exp => (
                        <div key={exp.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border text-[10px] font-bold">
                          <span className="uppercase">{exp.description} ({exp.quantity} {exp.unit})</span>
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-primary">${exp.amount.toLocaleString()}</span>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setNewIntervention(p => ({...p, detailedExpenses: p.detailedExpenses?.filter(e => e.id !== exp.id)}))}><Trash2 className="h-3 w-3" /></Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button className="w-full font-black shadow-lg h-12 text-sm uppercase tracking-widest bg-primary hover:bg-primary/90" onClick={handleSaveIntervention} disabled={isSaving}>
                    REGISTRAR REPORTE TÉCNICO
                  </Button>
                </CardContent>
              </Card>
            )}

            <div className="space-y-4">
              {interventions.length > 0 ? [...interventions].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((item) => (
                <Card key={item.id} className="overflow-hidden border-none shadow-md">
                  <CardHeader className="bg-slate-50 py-3 flex flex-row items-center justify-between border-b">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col">
                        <span className="text-sm font-black uppercase text-primary">Intervención Técnico: {MOCK_TECHNICIANS.find(t => t.id === item.technicianId)?.name}</span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase">{new Date(item.date).toLocaleString()}</span>
                      </div>
                      <div className="flex gap-2">
                        <Badge className="bg-primary/10 text-primary font-black uppercase text-[9px]">{item.type}</Badge>
                        {item.payrollStatus === 'processed' ? (
                          <Badge className="bg-green-100 text-green-700 font-black uppercase text-[9px] flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Liquidado
                          </Badge>
                        ) : item.isReadyForPayroll ? (
                          <Badge className="bg-orange-100 text-orange-700 font-black uppercase text-[9px] flex items-center gap-1">
                            <HandCoins className="h-3 w-3" /> Pendiente Pago
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1">
                       <span className="text-[10px] font-black text-blue-600 uppercase">A Cobrar: ${item.reportedValue?.toLocaleString()}</span>
                       {(item.usedRotomartillo || item.usedGeofono) && (
                         <div className="flex gap-1">
                           {item.usedRotomartillo && <Badge variant="secondary" className="text-[8px] bg-orange-100 text-orange-700">ROTOMARTILLO</Badge>}
                           {item.usedGeofono && <Badge variant="secondary" className="text-[8px] bg-orange-100 text-orange-700">GEÓFONO</Badge>}
                         </div>
                       )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-4">
                    <p className="text-sm text-slate-700 leading-relaxed italic border-l-4 border-slate-200 pl-4">"{item.notes}"</p>
                    
                    {item.detailedExpenses && item.detailedExpenses.length > 0 && (
                      <div className="grid gap-2">
                        <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Insumos y Gastos</p>
                        {item.detailedExpenses.map(exp => (
                          <div key={exp.id} className={`flex items-center justify-between p-3 rounded-lg border ${exp.isUnused ? 'bg-slate-50 border-dashed opacity-50' : 'bg-white shadow-sm'}`}>
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black uppercase text-slate-800">{exp.description}</span>
                              <span className="text-[9px] text-muted-foreground">{exp.quantity} {exp.unit} x ${exp.unitValue?.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="text-xs font-mono font-black">${exp.amount.toLocaleString()}</span>
                              {canEdit && (
                                <Switch checked={!exp.isUnused} onCheckedChange={() => handleToggleExpenseUsage(item.id, exp.id, exp.isUnused)} className="data-[state=checked]:bg-green-600" />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {isPrivilegedRole && item.payrollStatus !== 'processed' && !item.isReadyForPayroll && (
                      <div className="pt-4 border-t border-dashed flex justify-end">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8 gap-2 font-black text-[10px] uppercase text-orange-600 border-orange-200 hover:bg-orange-50"
                          onClick={() => handleApproveForPayroll(item.id)}
                        >
                          <HandCoins className="h-3.5 w-3.5" /> Aprobar para Nómina Individual
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )) : (
                <div className="py-20 text-center border-2 border-dashed rounded-xl"><p className="text-sm font-bold text-slate-400">Sin reportes registrados</p></div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <Card className="shadow-lg border-t-4 border-t-primary bg-slate-50 sticky top-24">
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Resumen de Cuenta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-white rounded-xl border space-y-3">
                <div className="flex justify-between text-xs font-bold text-slate-500 uppercase">
                  <span>Bruto Reportado (Total):</span>
                  <span className="font-mono text-slate-800">${interventions.reduce((s, i) => s + (i.reportedValue || 0), 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[10px] font-bold text-orange-600 uppercase border-t pt-2">
                  <span>Liquidado Anticipadamente:</span>
                  <span className="font-mono">${interventions.filter(i => i.payrollStatus === 'processed' || i.isReadyForPayroll).reduce((s, i) => s + (i.reportedValue || 0), 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase">
                  <span>Pendiente por Cobro:</span>
                  <span className="font-mono">${interventions.filter(i => i.payrollStatus !== 'processed' && !i.isReadyForPayroll).reduce((s, i) => s + (i.reportedValue || 0), 0).toLocaleString()}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-2 p-3 bg-blue-50 text-blue-700 rounded-lg text-[9px] font-bold uppercase leading-tight border border-blue-100">
                <Calculator className="h-4 w-4 shrink-0" />
                Los reportes marcados para nómina aparecerán directamente en el módulo de liquidación del técnico.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
