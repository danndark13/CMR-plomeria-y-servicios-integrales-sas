
"use client"

import { useState, useEffect, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { MOCK_REQUESTS, MOCK_TECHNICIANS } from "@/lib/mock-data"
import { ServiceRequest, Expense, TechnicianIntervention, InterventionType, ServiceStatus, UnitOfMeasure, Advance, ExpenseCategory } from "@/lib/types"
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
  HandCoins,
  MapPin,
  Car,
  DollarSign,
  Info
} from "lucide-react"
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog"
import { StatusBadge } from "@/components/crm/status-badge"
import { CategoryIcon } from "@/components/crm/category-icon"
import { toast } from "@/hooks/use-toast"
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase'
import { doc, updateDoc, collection, deleteDoc } from 'firebase/firestore'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'
import { cn } from "@/lib/utils"

const UNITS: UnitOfMeasure[] = ['UND', 'KG', 'MTS', 'GL', 'PAR', 'LB', 'PQ', 'VIAJE']

export default function RequestDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { user } = useUser()
  const db = useFirestore()
  
  const [isSaving, setIsSaving] = useState(false)
  const [showAddEntry, setShowAddEntry] = useState(false)
  const [showAddAdvance, setShowAddAdvance] = useState(false)
  
  const [newIntervention, setNewIntervention] = useState<Partial<TechnicianIntervention>>({
    type: 'Diagnóstico',
    notes: '',
    reportedValue: 0,
    usedRotomartillo: false,
    usedGeofono: false,
    isSimpleVisit: false,
    detailedExpenses: []
  })
  
  const [tempExpense, setTempExpense] = useState<Partial<Expense>>({
    description: '',
    unit: 'UND',
    quantity: 1,
    unitValue: 0,
    category: 'material',
    isUnused: false
  })

  const [newAdvance, setNewAdvance] = useState({
    amount: 0,
    reason: '',
    technicianId: ''
  })

  const requestRef = useMemoFirebase(() => {
    if (!db || !id || !user) return null
    return doc(db, 'service_requests', id as string)
  }, [db, id, user])

  const { data: firestoreRequest, isLoading: isRequestLoading } = useDoc(requestRef)
  
  const profileRef = useMemoFirebase(() => (user && db ? doc(db, 'user_profiles', user.uid) : null), [user, db])
  const { data: profile, isLoading: isProfileLoading } = useDoc(profileRef)

  // Fetch all technicians for selection
  const usersQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return collection(db, "user_profiles")
  }, [db, user])
  const { data: allUsers } = useCollection(usersQuery)

  const techList = useMemo(() => {
    const realTechs = (allUsers || []).filter(u => u.roleId === 'Técnico')
    const combined = [...realTechs]
    MOCK_TECHNICIANS.forEach(mt => {
      if (!combined.find(rt => rt.username === mt.id)) {
        combined.push({ id: mt.id, username: mt.id, firstName: mt.name, lastName: '', roleId: 'Técnico' } as any)
      }
    })
    return combined
  }, [allUsers])

  const [localStateRequest, setLocalStateRequest] = useState<ServiceRequest | null>(null)

  useEffect(() => {
    if (firestoreRequest) {
      setLocalStateRequest(firestoreRequest as any)
    } else if (isRequestLoading === false) {
      const found = MOCK_REQUESTS.find(r => r.id === id || r.claimNumber === id)
      if (found) setLocalStateRequest(found as any)
    }
  }, [firestoreRequest, id, isRequestLoading])

  const isDev = profile?.roleId === 'Desarrollador'
  const isAdmin = profile?.roleId === 'Administrador' || profile?.roleId === 'Gerente' || isDev
  const isAccounting = profile?.roleId === 'Contabilidad' || isDev
  const isCustomerService = profile?.roleId === 'Servicio al Cliente'
  const isTech = profile?.roleId === 'Técnico'
  const isCompleted = localStateRequest?.status === 'completed'
  const isPrivilegedRole = isAdmin || isAccounting
  const canEdit = isPrivilegedRole || (isCustomerService && !isCompleted) || (isTech && !isCompleted)

  const handleUpdateStatus = (newStatus: ServiceStatus) => {
    if (!db || !requestRef) return
    setIsSaving(true)
    updateDoc(requestRef, { status: newStatus, updatedAt: new Date().toISOString() })
      .then(() => {
        toast({ title: "Estado Actualizado" })
      })
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: requestRef.path,
          operation: "update",
          requestResourceData: { status: newStatus },
        })
        errorEmitter.emit("permission-error", permissionError)
      })
      .finally(() => setIsSaving(false))
  }

  const handleDeleteRequest = () => {
    if (!db || !requestRef || !isDev) return
    setIsSaving(true)
    deleteDoc(requestRef)
      .then(() => {
        toast({ title: "Expediente Eliminado", description: "El registro ha sido removido físicamente." })
        router.push('/requests')
      })
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: requestRef.path,
          operation: "delete",
        })
        errorEmitter.emit("permission-error", permissionError)
      })
      .finally(() => setIsSaving(false))
  }

  const handleApproveForPayroll = (interventionId: string) => {
    if (!db || !requestRef || !isPrivilegedRole || !localStateRequest) return
    
    const updatedInterventions = (localStateRequest.interventions || []).map(i => {
      if (i.id === interventionId) return { ...i, isReadyForPayroll: true }
      return i
    })

    updateDoc(requestRef, { interventions: updatedInterventions, updatedAt: new Date().toISOString() })
      .then(() => toast({ title: "Reporte Aprobado", description: "Este reporte ya aparecerá en la nómina del técnico." }))
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: requestRef.path,
          operation: "update",
          requestResourceData: { interventions: updatedInterventions },
        })
        errorEmitter.emit("permission-error", permissionError)
      })
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
      isUnused: !!tempExpense.isUnused
    }
    setNewIntervention(prev => ({
      ...prev,
      detailedExpenses: [...(prev.detailedExpenses || []), expense]
    }))
    setTempExpense({ description: '', unit: 'UND', quantity: 1, unitValue: 0, category: 'material', isUnused: false })
  }

  const handleSaveIntervention = () => {
    if (!db || !requestRef || !profile || !canEdit || !localStateRequest) return
    
    const targetTechId = isTech ? profile.username : newIntervention.technicianId
    if (!targetTechId || !newIntervention.notes) {
      toast({ variant: "destructive", title: "Campos incompletos", description: "Debe asignar un técnico y notas." })
      return
    }

    setIsSaving(true)
    const intervention: TechnicianIntervention = {
      id: Math.random().toString(36).substring(7),
      technicianId: targetTechId,
      type: (newIntervention.type as InterventionType) || 'Diagnóstico',
      date: new Date().toISOString(),
      notes: newIntervention.notes!,
      reportedValue: Number(newIntervention.reportedValue) || 0,
      laborCost: 0,
      usedRotomartillo: !!newIntervention.usedRotomartillo,
      usedGeofono: !!newIntervention.usedGeofono,
      isSimpleVisit: !!newIntervention.isSimpleVisit,
      detailedExpenses: newIntervention.detailedExpenses || [],
      authorName: `${profile.firstName} ${profile.lastName}`,
      payrollStatus: 'pending'
    }

    const updatedInterventions = [...(localStateRequest.interventions || []), intervention]
    const updatedData = { 
      interventions: updatedInterventions,
      updatedAt: new Date().toISOString()
    }

    updateDoc(requestRef, updatedData)
      .then(() => {
        toast({ title: "Reporte Añadido" })
        setShowAddEntry(false)
        setNewIntervention({ type: 'Diagnóstico', notes: '', reportedValue: 0, usedRotomartillo: false, usedGeofono: false, isSimpleVisit: false, detailedExpenses: [] })
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

  const handleSaveAdvance = () => {
    if (!db || !requestRef || !newAdvance.technicianId || !newAdvance.amount || !localStateRequest) return
    
    setIsSaving(true)
    const advance: Advance = {
      id: Math.random().toString(36).substring(7),
      amount: Number(newAdvance.amount),
      reason: newAdvance.reason || 'Adelanto de servicio',
      date: new Date().toISOString(),
      createdByUserId: user?.uid || '',
      technicianId: newAdvance.technicianId,
      isPaidInPayroll: false
    }

    const updatedAdvances = [...(localStateRequest.advances || []), advance]
    const updatedData = {
      advances: updatedAdvances,
      updatedAt: new Date().toISOString()
    }

    updateDoc(requestRef, updatedData)
      .then(() => {
        toast({ title: "Adelanto Registrado" })
        setShowAddAdvance(false)
        setNewAdvance({ amount: 0, reason: '', technicianId: '' })
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

  if (isRequestLoading || isProfileLoading) return (
    <div className="p-20 text-center flex flex-col items-center gap-4">
      <div className="h-16 w-16 rounded-2xl bg-white shadow-xl flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary opacity-40" />
      </div>
      <p className="text-muted-foreground font-bold tracking-tighter uppercase text-xs">Sincronizando expediente...</p>
    </div>
  )

  if (!localStateRequest) return (
    <div className="p-20 text-center flex flex-col items-center gap-4">
      <AlertCircle className="h-12 w-12 text-destructive opacity-40" />
      <h2 className="text-xl font-black uppercase text-slate-800">Expediente no encontrado</h2>
      <Button onClick={() => router.push('/requests')} variant="outline" className="mt-4">Regresar</Button>
    </div>
  )

  const interventions = localStateRequest.interventions || []
  const advances = localStateRequest.advances || []

  // FILTRO TÉCNICO: Solo ver expedientes donde él participó
  const isParticipant = interventions.some(i => i.technicianId === profile?.username) || 
                        localStateRequest.scheduledVisit?.technicianId === profile?.username;

  if (isTech && !isParticipant) {
    return (
      <div className="p-20 text-center flex flex-col items-center gap-4">
        <AlertCircle className="h-12 w-12 text-destructive opacity-40" />
        <h2 className="text-xl font-black uppercase text-slate-800">Acceso Restringido</h2>
        <p className="text-muted-foreground">Solo puedes ver expedientes donde tengas reportes asignados.</p>
        <Button onClick={() => router.push('/requests')} variant="outline" className="mt-4">Regresar</Button>
      </div>
    )
  }

  const visibleInterventions = interventions; 

  const visibleAdvances = isTech
    ? (advances || []).filter(a => a.technicianId === profile?.username)
    : advances

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-xl">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black text-primary uppercase">{localStateRequest.claimNumber}</h1>
              {!isTech && <StatusBadge status={localStateRequest.status} />}
            </div>
            <p className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2">
              <CategoryIcon category={localStateRequest.category} className="h-3 w-3" /> {localStateRequest.category}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {isDev && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="gap-2 font-black uppercase text-[10px] h-10 shadow-lg">
                  <Trash2 className="h-4 w-4" /> Eliminar Expediente
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-destructive font-black uppercase tracking-tighter">¿Eliminar registro físico?</AlertDialogTitle>
                  <AlertDialogDescription className="font-bold">
                    Esta acción es irreversible. El expediente <strong className="text-primary">{localStateRequest.claimNumber}</strong> será borrado de la base de datos de producción.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="font-bold">CANCELAR</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteRequest} className="bg-destructive hover:bg-destructive/90 font-black">
                    SÍ, ELIMINAR PERMANENTEMENTE
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {canEdit && !isTech && (
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-black uppercase text-muted-foreground mr-2">Estado Operativo:</p>
              <Select value={localStateRequest.status} onValueChange={(v) => handleUpdateStatus(v as ServiceStatus)}>
                <SelectTrigger className="w-[180px] font-black uppercase h-10 border-primary/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="assigned">Programado</SelectItem>
                  <SelectItem value="in_progress">En Proceso</SelectItem>
                  <SelectItem value="completed">Finalizado</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                  <SelectItem value="warranty">Garantía</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-6">
          <Card className="border-l-4 border-l-primary shadow-sm">
            <CardHeader className="pb-3 border-b bg-slate-50/50">
              <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Información del Servicio</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase text-slate-400">Asegurado</p>
                <p className="font-bold uppercase">{localStateRequest.insuredName}</p>
              </div>
              {!isTech && (
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase text-slate-400">Teléfono</p>
                  <p className="font-medium">{localStateRequest.phoneNumber}</p>
                </div>
              )}
              <div className="space-y-1 md:col-span-2">
                <p className="text-[10px] font-black uppercase text-slate-400">Dirección / Ciudad</p>
                <p className="font-medium uppercase flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-primary" /> {localStateRequest.address}</p>
              </div>
              <div className="space-y-1 md:col-span-2 pt-2 border-t border-dashed">
                <p className="text-[10px] font-black uppercase text-slate-400">Descripción del Problema</p>
                <p className="text-xs text-slate-600 leading-relaxed">{localStateRequest.description}</p>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black uppercase tracking-tighter flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" /> Historial de Reportes
              </h2>
              <div className="flex gap-2">
                {canEdit && !isTech && (
                  <Button variant="outline" size="sm" className="gap-2 font-bold border-destructive text-destructive" onClick={() => setShowAddAdvance(!showAddAdvance)}>
                    <DollarSign className="h-4 w-4" /> Adelanto
                  </Button>
                )}
                {canEdit && (
                  <Button variant="outline" size="sm" className="gap-2 font-bold" onClick={() => setShowAddEntry(!showAddEntry)}>
                    {showAddEntry ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />} 
                    Añadir Reporte
                  </Button>
                )}
              </div>
            </div>

            {showAddAdvance && (
              <Card className="border-2 border-dashed border-destructive bg-destructive/5 animate-in slide-in-from-top-2">
                <CardContent className="pt-6 space-y-4">
                  <p className="text-[10px] font-black uppercase text-destructive tracking-widest">Registrar Nuevo Adelanto de Efectivo</p>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase">Técnico</Label>
                      <Select value={newAdvance.technicianId} onValueChange={(v) => setNewAdvance({...newAdvance, technicianId: v})}>
                        <SelectTrigger className="h-10"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                        <SelectContent>
                          {techList.map(t => <SelectItem key={t.id} value={t.username || t.id}>{t.firstName} {t.lastName}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase">Monto ($)</Label>
                      <Input type="number" value={newAdvance.amount} onChange={(e) => setNewAdvance({...newAdvance, amount: Number(e.target.value)})} className="font-bold" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase">Concepto</Label>
                      <Input value={newAdvance.reason} onChange={(e) => setNewAdvance({...newAdvance, reason: e.target.value.toUpperCase()})} placeholder="EJ: ALIMENTACION" />
                    </div>
                  </div>
                  <Button className="w-full bg-destructive hover:bg-destructive/90 font-black h-10" onClick={handleSaveAdvance} disabled={isSaving}>
                    CONFIRMAR ENTREGA DE ADELANTO
                  </Button>
                </CardContent>
              </Card>
            )}

            {showAddEntry && canEdit && (
              <Card className="border-2 border-dashed border-primary animate-in slide-in-from-top-4 shadow-xl">
                <CardHeader className="bg-primary/5">
                  <CardTitle className="text-sm font-black uppercase">Nuevo Registro de Intervención</CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                          <Car className="h-5 w-5" />
                        </div>
                        <div>
                          <Label htmlFor="simple-visit" className="text-sm font-black uppercase text-orange-800 block cursor-pointer">Visita Técnica Simple</Label>
                          <p className="text-[9px] font-bold text-orange-600 uppercase">Valor Base $20.000 (Sin 10%)</p>
                        </div>
                      </div>
                      <Switch 
                        id="simple-visit" 
                        checked={newIntervention.isSimpleVisit} 
                        onCheckedChange={(v) => {
                          setNewIntervention({
                            ...newIntervention, 
                            isSimpleVisit: v,
                            reportedValue: v ? Math.max(20000, newIntervention.reportedValue || 0) : newIntervention.reportedValue
                          })
                        }} 
                      />
                    </div>

                    {!isTech && (
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase">Técnico Asignado</Label>
                        <Select value={newIntervention.technicianId} onValueChange={(v) => setNewIntervention({...newIntervention, technicianId: v})}>
                          <SelectTrigger className="h-12"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                          <SelectContent>
                            {techList.map(t => <SelectItem key={t.id} value={t.username || t.id}>{t.firstName} {t.lastName}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase">Tipo de Trabajo</Label>
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
                    <div className="space-y-2 md:col-span-2">
                      <Label className="text-[10px] font-black uppercase text-blue-600">Valor Bruto a Cobrar ($)</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-blue-600">$</span>
                        <Input 
                          type="number" 
                          className={cn("h-10 pl-7 font-black border-blue-200 bg-blue-50/50", newIntervention.isSimpleVisit && "border-orange-200 bg-orange-50/30")}
                          value={newIntervention.reportedValue}
                          onChange={(e) => setNewIntervention({...newIntervention, reportedValue: Number(e.target.value)})}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 p-4 bg-slate-50 rounded-xl border border-dashed">
                    <p className="text-[10px] font-black uppercase text-slate-500 col-span-2 tracking-widest flex items-center gap-2">
                      <Hammer className="h-3 w-3" /> Herramientas Especiales
                    </p>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="rotomartillo" checked={newIntervention.usedRotomartillo} onCheckedChange={(v) => setNewIntervention({...newIntervention, usedRotomartillo: !!v})} />
                      <Label htmlFor="rotomartillo" className="text-xs font-bold uppercase">Rotomartillo ($80k)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="geofono" checked={newIntervention.usedGeofono} onCheckedChange={(v) => setNewIntervention({...newIntervention, usedGeofono: !!v})} />
                      <Label htmlFor="geofono" className="text-xs font-bold uppercase">Geófono ($120k)</Label>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase">Notas Técnicas del Servicio</Label>
                    <Textarea 
                      className="min-h-[100px] font-medium"
                      value={newIntervention.notes}
                      onChange={(e) => setNewIntervention({...newIntervention, notes: e.target.value})}
                      placeholder="Describa el trabajo realizado..."
                    />
                  </div>

                  <div className="space-y-4 p-4 bg-white rounded-xl border border-slate-200 shadow-inner">
                    <div className="flex justify-between items-center mb-2">
                      <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Insumos y Facturas</Label>
                      <div className="flex items-center gap-2">
                        <Label htmlFor="is-unused" className="text-[9px] font-black uppercase text-orange-600">¿Queda en mi Stock?</Label>
                        <Switch id="is-unused" checked={tempExpense.isUnused} onCheckedChange={(v) => setTempExpense({...tempExpense, isUnused: v})} className="scale-75 data-[state=checked]:bg-orange-500" />
                      </div>
                    </div>
                    <div className="grid gap-2 md:grid-cols-12">
                      <Input placeholder="Descripción" className="md:col-span-5 h-8 text-xs font-bold" value={tempExpense.description} onChange={(e) => setTempExpense({...tempExpense, description: e.target.value.toUpperCase()})} />
                      <Select value={tempExpense.unit} onValueChange={(v) => setTempExpense({...tempExpense, unit: v as UnitOfMeasure})}>
                        <SelectTrigger className="md:col-span-2 h-8 text-[10px] font-bold"><SelectValue /></SelectTrigger>
                        <SelectContent>{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                      </Select>
                      <Input type="number" placeholder="Cant" className="md:col-span-1 h-8 text-xs" value={tempExpense.quantity} onChange={(e) => setTempExpense({...tempExpense, quantity: Number(e.target.value)})} />
                      <Input type="number" placeholder="V. Unit" className="md:col-span-2 h-8 text-xs" value={tempExpense.unitValue} onChange={(e) => setTempExpense({...tempExpense, unitValue: Number(e.target.value)})} />
                      <Button size="sm" className="md:col-span-2 h-8 font-black text-[10px]" onClick={handleAddExpense}>AÑADIR</Button>
                    </div>
                    <div className="space-y-2 mt-2">
                      {newIntervention.detailedExpenses?.map(exp => (
                        <div key={exp.id} className={cn("flex items-center justify-between p-2 rounded-lg border text-[10px] font-bold", exp.isUnused ? "bg-orange-50/50 border-orange-200 border-dashed" : "bg-slate-50")}>
                          <span className="uppercase">{exp.description} ({exp.quantity} {exp.unit}) {exp.isUnused && <Badge className="ml-2 h-4 text-[7px] bg-orange-500">EN STOCK</Badge>}</span>
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-primary">${exp.amount.toLocaleString()}</span>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setNewIntervention(p => ({...p, detailedExpenses: p.detailedExpenses?.filter(e => e.id !== exp.id)}))}><Trash2 className="h-3 w-3" /></Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button className="w-full font-black shadow-lg h-12 text-sm uppercase tracking-widest bg-primary hover:bg-primary/90" onClick={handleSaveIntervention} disabled={isSaving}>
                    REGISTRAR REPORTE
                  </Button>
                </CardContent>
              </Card>
            )}

            <div className="space-y-4">
              {visibleInterventions.length === 0 && visibleAdvances.length === 0 ? (
                <div className="py-20 text-center border-2 border-dashed rounded-xl bg-slate-50/50"><p className="text-sm font-bold text-slate-400 italic">No hay reportes ni adelantos en este expediente</p></div>
              ) : (
                <div className="space-y-4">
                  {visibleAdvances.map(adv => (
                    <Card key={adv.id} className="border-l-4 border-l-destructive bg-destructive/5 overflow-hidden">
                      <div className="px-4 py-3 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
                            <DollarSign className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-xs font-black uppercase text-destructive-foreground">Adelanto Recibido</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase">
                              {new Date(adv.date).toLocaleString()} • {adv.reason}
                              {!isTech && <span className="ml-2 text-primary">| Técnico: {adv.technicianId}</span>}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-black text-destructive">-${adv.amount.toLocaleString()}</span>
                          {adv.isPaidInPayroll ? <Badge className="bg-green-500 h-5 text-[8px]">LIQUIDADO</Badge> : <Badge variant="outline" className="h-5 text-[8px] border-destructive text-destructive">PENDIENTE</Badge>}
                        </div>
                      </div>
                    </Card>
                  ))}

                  {[...visibleInterventions].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((item) => {
                    const isMyReport = isTech ? item.technicianId === profile?.username : true;
                    const techDisplayName = item.technicianId === profile?.username ? item.technicianId : "Técnico RYS";
                    
                    const materialExpenses = (item.detailedExpenses || []).filter(e => !e.isUnused && !e.isReturned).reduce((s, e) => s + (e.amount || 0), 0)
                    let rentals = 0
                    if (item.usedRotomartillo) rentals += 80000
                    if (item.usedGeofono) rentals += 120000
                    const totalDirectCosts = materialExpenses + rentals

                    let techShare = 0
                    if (item.isSimpleVisit) {
                      const visitBase = 20000
                      const extra = Math.max(0, item.reportedValue - visitBase)
                      const subExtra = extra - totalDirectCosts
                      const fee = subExtra > 0 ? subExtra * 0.10 : 0
                      techShare = (visitBase / 2) + ((subExtra - fee) / 2)
                    } else {
                      const sub = item.reportedValue - totalDirectCosts
                      const fee = sub > 0 ? sub * 0.10 : 0
                      techShare = (sub - fee) / 2
                    }

                    return (
                      <Card key={item.id} className={cn("overflow-hidden border-none shadow-md", item.isSimpleVisit && "border-l-4 border-l-orange-500")}>
                        <CardHeader className="bg-slate-50 py-3 flex flex-row items-center justify-between border-b">
                          <div className="flex items-center gap-3">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black uppercase text-slate-400">{new Date(item.date).toLocaleString()}</span>
                                {item.isSimpleVisit && <Badge className="bg-orange-500 text-white font-black uppercase text-[8px]">Visita Técnica</Badge>}
                                {item.payrollStatus === 'processed' && <Badge className="bg-green-600 text-white font-black uppercase text-[8px]">Pagado al Técnico</Badge>}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge className="bg-primary/10 text-primary font-black uppercase text-[9px]">{item.type}</Badge>
                                {!isTech ? (
                                  <span className="text-[10px] font-bold text-slate-500">Técnico: {item.technicianId}</span>
                                ) : (
                                  <span className="text-[10px] font-bold text-slate-500">{techDisplayName}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-right flex items-center gap-4">
                             {isMyReport && (
                               <div>
                                 <p className="text-[8px] font-black uppercase text-slate-400">Pago Técnico Neto</p>
                                 <p className="text-lg font-black text-green-600">${techShare.toLocaleString()}</p>
                               </div>
                             )}
                             {isPrivilegedRole && item.payrollStatus !== 'processed' && !item.isReadyForPayroll && (
                               <Button size="sm" onClick={() => handleApproveForPayroll(item.id)} className="bg-blue-600 hover:bg-blue-700 text-[9px] font-black uppercase h-8">
                                 Aprobar Nómina
                               </Button>
                             )}
                             {item.isReadyForPayroll && item.payrollStatus !== 'processed' && (
                               <Badge variant="outline" className="border-blue-500 text-blue-600 text-[8px] font-black uppercase">Aprobado para Pago</Badge>
                             )}
                          </div>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-4">
                          <p className="text-sm text-slate-700 font-medium italic border-l-4 border-slate-200 pl-4">"{item.notes}"</p>
                          
                          {isMyReport && (item.detailedExpenses?.length > 0 || rentals > 0) && (
                            <div className="grid gap-2">
                              <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Deducciones de Nómina (Materiales y Equipos)</p>
                              {rentals > 0 && (
                                <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border text-[10px] font-bold">
                                  <span className="uppercase flex items-center gap-2"><Hammer className="h-3 w-3" /> Alquiler de Maquinaria</span>
                                  <span className="font-mono text-destructive">-${rentals.toLocaleString()}</span>
                                </div>
                              )}
                              {item.detailedExpenses.map(exp => (
                                <div key={exp.id} className={cn("flex items-center justify-between p-2 rounded-lg border", exp.isUnused ? 'bg-orange-50/30 border-dashed border-orange-200' : 'bg-white')}>
                                  <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] font-black uppercase text-slate-800">{exp.description}</span>
                                      {exp.isUnused && <Badge className="h-3 text-[6px] bg-orange-500">EN STOCK (NO DESCONTADO)</Badge>}
                                    </div>
                                    <span className="text-[9px] text-muted-foreground">{exp.quantity} {exp.unit} x ${exp.unitValue?.toLocaleString()}</span>
                                  </div>
                                  <span className={cn("text-[10px] font-mono font-black", exp.isUnused ? 'text-slate-400' : 'text-destructive')}>
                                    {exp.isUnused ? '$0' : `-$${exp.amount.toLocaleString()}`}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          {isTech && (
            <Card className="shadow-lg border-t-4 border-t-primary bg-slate-50 sticky top-24">
              <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Mi Estado Financiero</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-white rounded-xl border space-y-3 shadow-sm">
                  <div className="flex justify-between text-[10px] font-bold text-destructive uppercase">
                    <span>Adelantos Recibidos:</span>
                    <span className="font-mono">-${visibleAdvances.reduce((s, a) => s + (a.amount || 0), 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-bold text-orange-600 uppercase border-t pt-2">
                    <span>Mi Stock (Pendiente):</span>
                    <span className="font-mono">${interventions.flatMap(i => i.detailedExpenses).filter(e => e.isUnused && e.technicianId === profile?.username).reduce((s, e) => s + (e.amount || 0), 0).toLocaleString()}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 p-3 bg-blue-50 text-blue-700 rounded-lg text-[9px] font-bold uppercase leading-tight border border-blue-100">
                  <Info className="h-4 w-4 shrink-0" />
                  Los valores aquí mostrados son estimaciones de tu pago neto (50%) después de descontar gastos operativos.
                </div>
              </CardContent>
            </Card>
          )}

          {!isTech && (
            <Card className="shadow-lg border-t-4 border-t-blue-600 bg-slate-50 sticky top-24">
              <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Resumen de Facturación</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-white rounded-xl border space-y-3 shadow-sm">
                  <div className="flex justify-between text-[10px] font-bold uppercase">
                    <span className="text-slate-500">Base a Cobrar (Total Reportado):</span>
                    <span className="font-mono font-black text-blue-600">${interventions.reduce((s, i) => s + (i.reportedValue || 0), 0).toLocaleString()}</span>
                  </div>
                  {localStateRequest.billingStatus === 'validated' && (
                    <div className="flex justify-between text-[10px] font-black uppercase text-green-600 border-t pt-2">
                      <span>Valor Aprobado:</span>
                      <span className="font-mono">${(localStateRequest.approvedAmount || 0).toLocaleString()}</span>
                    </div>
                  )}
                </div>
                <div className="p-3 bg-blue-50 text-blue-700 rounded-lg text-[9px] font-bold uppercase leading-tight border border-blue-100 flex items-center gap-2">
                  <Calculator className="h-4 w-4 shrink-0" />
                  La conciliación final y ajustes de valor aprobado se realizan en el módulo contable.
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
