
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
  Info,
  Building2,
  UserCheck,
  User as UserIcon,
  ShieldCheck
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
import { doc, updateDoc, collection, deleteDoc, setDoc } from 'firebase/firestore'
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
  
  const [isAddingNewTech, setIsAddingNewTech] = useState(false)
  const [newTechFullName, setNewTechFullName] = useState("")

  const [newIntervention, setNewIntervention] = useState<Partial<TechnicianIntervention>>({
    type: 'Diagnóstico',
    notes: '',
    reportedValue: 0,
    usedRotomartillo: false,
    usedGeofono: false,
    isSimpleVisit: false,
    detailedExpenses: [],
    authorizedByAdvisor: ''
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

  const usersQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return collection(db, "user_profiles")
  }, [db, user])
  const { data: allUsers } = useCollection(usersQuery)

  const techList = useMemo(() => {
    const uniqueMap = new Map()
    if (allUsers) {
      allUsers.filter(u => u.roleId === 'Técnico').forEach(u => {
        const uname = (u.username || u.id).toUpperCase().trim()
        if (!uniqueMap.has(uname)) {
          uniqueMap.set(uname, u)
        }
      })
    }
    MOCK_TECHNICIANS.forEach(mt => {
      const uname = mt.id.toUpperCase().trim()
      if (!uniqueMap.has(uname)) {
        uniqueMap.set(uname, { id: mt.id, username: mt.id, firstName: mt.name, lastName: '', roleId: 'Técnico' })
      }
    })
    return Array.from(uniqueMap.values()).sort((a, b) => a.firstName.localeCompare(b.firstName))
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
  const isGerente = profile?.roleId === 'Gerente'
  const isAdmin = profile?.roleId === 'Administrador' || isGerente || isDev
  const isAccounting = profile?.roleId === 'Contabilidad' || isDev
  const isCustomerService = profile?.roleId === 'Servicio al Cliente'
  const isTech = profile?.roleId === 'Técnico'
  const isCompleted = localStateRequest?.status === 'completed'
  
  // Only Gerente and Desarrollador can modify existing data
  const canModifyHistory = isGerente || isDev
  
  const canEdit = isAdmin || (isCustomerService && !isCompleted) || (isTech && !isCompleted)

  const handleUpdateStatus = (newStatus: ServiceStatus) => {
    if (!db || !requestRef) return
    setIsSaving(true)
    updateDoc(requestRef, { status: newStatus, updatedAt: new Date().toISOString() })
      .then(() => toast({ title: "Estado Actualizado" }))
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
        toast({ title: "Expediente Eliminado" })
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
    if (!db || !requestRef || !isAdmin || !localStateRequest) return
    
    const updatedInterventions = (localStateRequest.interventions || []).map(i => {
      if (i.id === interventionId) return { ...i, isReadyForPayroll: true }
      return i
    })

    updateDoc(requestRef, { interventions: updatedInterventions, updatedAt: new Date().toISOString() })
      .then(() => toast({ title: "Reporte Aprobado" }))
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

  const handleSaveIntervention = async () => {
    if (!db || !requestRef || !profile || !canEdit || !localStateRequest) return
    
    let targetTechId = isTech ? profile.username : newIntervention.technicianId
    
    if (isAddingNewTech) {
      if (!newTechFullName.trim()) {
        toast({ variant: "destructive", title: "Nombre faltante" })
        return
      }
      const newId = Math.random().toString(36).substring(7).toUpperCase()
      const newUname = `TEC-${newTechFullName.split(' ')[0].toUpperCase()}-${Math.floor(Math.random() * 100)}`
      
      const newTechProfile = {
        id: newId,
        username: newUname,
        firstName: newTechFullName.toUpperCase(),
        lastName: '',
        roleId: 'Técnico',
        isActive: true,
        email: `${newUname.toLowerCase()}@rysplomeria.com`,
        createdAt: new Date().toISOString()
      }
      
      try {
        await setDoc(doc(db, "user_profiles", newId), newTechProfile)
        targetTechId = newUname
      } catch (e) {
        toast({ variant: "destructive", title: "Error al crear técnico" })
        return
      }
    }

    if (!targetTechId || !newIntervention.notes) {
      toast({ variant: "destructive", title: "Campos incompletos" })
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
      payrollStatus: 'pending',
      authorizedByAdvisor: newIntervention.authorizedByAdvisor?.toUpperCase() || ''
    }

    const updatedInterventions = [...(localStateRequest.interventions || []), intervention]
    updateDoc(requestRef, { interventions: updatedInterventions, updatedAt: new Date().toISOString() })
      .then(() => {
        toast({ title: "Reporte Añadido" })
        setShowAddEntry(false)
        setNewIntervention({ type: 'Diagnóstico', notes: '', reportedValue: 0, usedRotomartillo: false, usedGeofono: false, isSimpleVisit: false, detailedExpenses: [], authorizedByAdvisor: '' })
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
    updateDoc(requestRef, { advances: updatedAdvances, updatedAt: new Date().toISOString() })
      .then(() => {
        toast({ title: "Adelanto Registrado" })
        setShowAddAdvance(false)
        setNewAdvance({ amount: 0, reason: '', technicianId: '' })
      })
      .finally(() => setIsSaving(false))
  }

  if (isRequestLoading || isProfileLoading) return (
    <div className="p-20 text-center flex flex-col items-center gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary opacity-40" />
      <p className="text-muted-foreground font-bold uppercase text-xs">Sincronizando...</p>
    </div>
  )

  if (!localStateRequest) return (
    <div className="p-20 text-center flex flex-col items-center gap-4">
      <h2 className="text-xl font-black uppercase text-slate-800">Expediente no encontrado</h2>
      <Button onClick={() => router.push('/requests')} variant="outline">Regresar</Button>
    </div>
  )

  const interventions = localStateRequest.interventions || []
  const advances = localStateRequest.advances || []

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
              <StatusBadge status={localStateRequest.status} />
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
                  <Trash2 className="h-4 w-4" /> Eliminar Permanente
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-destructive font-black uppercase tracking-tighter">¿Borrar expediente?</AlertDialogTitle>
                  <AlertDialogDescription>Esta acción borrará físicamente el registro {localStateRequest.claimNumber}.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="font-bold">CANCELAR</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteRequest} className="bg-destructive font-black">ELIMINAR</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {canEdit && (
            <div className="flex items-center gap-2">
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
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase text-slate-400">Ubicación</p>
                <p className="font-medium uppercase flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-primary" /> {localStateRequest.address} • {localStateRequest.city}</p>
              </div>
              <div className="space-y-1 md:col-span-2 pt-2 border-t border-dashed">
                <p className="text-[10px] font-black uppercase text-slate-400">Descripción</p>
                <p className="text-xs text-slate-600">{localStateRequest.description}</p>
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
                    {showAddEntry ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />} Reporte
                  </Button>
                )}
              </div>
            </div>

            {showAddAdvance && (
              <Card className="border-2 border-dashed border-destructive bg-destructive/5 animate-in slide-in-from-top-2">
                <CardContent className="pt-6 space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase">Técnico</Label>
                      <Select value={newAdvance.technicianId} onValueChange={(v) => setNewAdvance({...newAdvance, technicianId: v})}>
                        <SelectTrigger className="h-10"><SelectValue placeholder="Elegir" /></SelectTrigger>
                        <SelectContent>{techList.map(t => <SelectItem key={t.id} value={t.username || t.id}>{t.firstName}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase">Monto</Label>
                      <Input type="number" value={newAdvance.amount} onChange={(e) => setNewAdvance({...newAdvance, amount: Number(e.target.value)})} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase">Motivo</Label>
                      <Input value={newAdvance.reason} onChange={(e) => setNewAdvance({...newAdvance, reason: e.target.value.toUpperCase()})} />
                    </div>
                  </div>
                  <Button className="w-full bg-destructive font-black h-10" onClick={handleSaveAdvance}>REGISTRAR ADELANTO</Button>
                </CardContent>
              </Card>
            )}

            {showAddEntry && (
              <Card className="border-2 border-dashed border-primary animate-in slide-in-from-top-4 shadow-xl">
                <CardContent className="pt-6 space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Car className="h-5 w-5 text-orange-600" />
                        <div>
                          <Label htmlFor="simple-visit" className="text-sm font-black uppercase">Visita Simple</Label>
                          <p className="text-[9px] font-bold text-orange-600">$20.000 BASE</p>
                        </div>
                      </div>
                      <Switch checked={newIntervention.isSimpleVisit} onCheckedChange={(v) => setNewIntervention({...newIntervention, isSimpleVisit: v})} />
                    </div>
                    {!isTech && (
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase">Técnico</Label>
                        <Select 
                          value={isAddingNewTech ? "NEW" : newIntervention.technicianId} 
                          onValueChange={(v) => {
                            if (v === "NEW") setIsAddingNewTech(true)
                            else { setIsAddingNewTech(false); setNewIntervention({...newIntervention, technicianId: v}); }
                          }}
                        >
                          <SelectTrigger className="h-12"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                          <SelectContent>
                            {techList.map(t => <SelectItem key={t.id} value={t.username || t.id}>{t.firstName}</SelectItem>)}
                            <SelectItem value="NEW" className="font-bold text-primary italic">+ OTRO técnico...</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  {isAddingNewTech && (
                    <div className="space-y-2 p-4 bg-primary/5 rounded-xl border border-primary/20 animate-in slide-in-from-top-2">
                      <Label className="text-[10px] font-black uppercase text-primary">Nombre del Técnico</Label>
                      <Input placeholder="EJ. ANDRES RIVERA" value={newTechFullName} onChange={(e) => setNewTechFullName(e.target.value.toUpperCase())} className="font-black h-10" />
                    </div>
                  )}

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase">Tipo de Trabajo</Label>
                      <Select value={newIntervention.type} onValueChange={(v) => setNewIntervention({...newIntervention, type: v as InterventionType})}>
                        <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Diagnóstico">Diagnóstico</SelectItem>
                          <SelectItem value="Reparación">Reparación</SelectItem>
                          <SelectItem value="Finalización">Finalización</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase">Asesor Cabina (Opcional)</Label>
                      <Input placeholder="ASESOR" value={newIntervention.authorizedByAdvisor} onChange={(e) => setNewIntervention({...newIntervention, authorizedByAdvisor: e.target.value})} className="h-10 uppercase text-xs" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-blue-600">Valor Bruto Cobrado ($)</Label>
                    <Input type="number" className="font-black bg-blue-50/50" value={newIntervention.reportedValue} onChange={(e) => setNewIntervention({...newIntervention, reportedValue: Number(e.target.value)})} />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase">Notas del Reporte</Label>
                    <Textarea className="min-h-[100px]" value={newIntervention.notes} onChange={(e) => setNewIntervention({...newIntervention, notes: e.target.value})} placeholder="Detalle acciones realizadas..." />
                  </div>

                  <Button className="w-full font-black shadow-lg h-12 bg-primary hover:bg-primary/90" onClick={handleSaveIntervention} disabled={isSaving}>REGISTRAR EN BITÁCORA</Button>
                </CardContent>
              </Card>
            )}

            <div className="space-y-4">
              {[...interventions].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((item) => (
                <Card key={item.id} className="overflow-hidden border-none shadow-md">
                  <CardHeader className="bg-slate-50 py-3 flex flex-row items-center justify-between border-b">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase text-slate-400">{new Date(item.date).toLocaleString()}</span>
                        {item.isSimpleVisit && <Badge className="bg-orange-500 text-[8px] font-black">Visita</Badge>}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className="bg-primary/10 text-primary text-[9px] font-black">{item.type}</Badge>
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Téc: {item.technicianId}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-2 text-[9px] font-black uppercase text-primary/60">
                        <UserIcon className="h-3 w-3" /> Registrado por: {item.authorName || 'SISTEMA'}
                      </div>
                      {canModifyHistory && (
                        <div className="flex items-center gap-2 mt-1 justify-end">
                          <ShieldCheck className="h-3.5 w-3.5 text-green-600" />
                          <span className="text-[8px] font-black uppercase text-green-600">Acceso Edición Activo</span>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <p className="text-sm font-medium italic border-l-4 pl-4">"{item.notes}"</p>
                    {item.authorizedByAdvisor && (
                      <p className="mt-2 text-[9px] font-black uppercase text-blue-600 bg-blue-50 w-fit px-2 py-0.5 rounded">AUTORIZÓ CABINA: {item.authorizedByAdvisor}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <Card className="shadow-lg border-t-4 border-t-primary bg-slate-50 sticky top-24">
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Control de Auditoría</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-white rounded-xl border border-dashed text-xs space-y-3">
                <div className="flex items-center gap-2 text-slate-500">
                  <Info className="h-4 w-4" />
                  <span>Historial de reportes bloqueado para técnicos una vez guardados.</span>
                </div>
                <div className="flex items-center gap-2 text-primary font-bold">
                  <ShieldCheck className="h-4 w-4" />
                  <span>Gerencia y Desarrollador supervisan la calidad del reporte.</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
