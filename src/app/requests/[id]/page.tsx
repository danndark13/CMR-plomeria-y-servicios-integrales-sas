
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
  DollarSign
} from "lucide-react"
import { StatusBadge } from "@/components/crm/status-badge"
import { CategoryIcon } from "@/components/crm/category-icon"
import { toast } from "@/hooks/use-toast"
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase'
import { doc, updateDoc, collection } from 'firebase/firestore'
import { cn } from "@/lib/utils"

const UNITS: UnitOfMeasure[] = ['UND', 'KG', 'MTS', 'GL', 'PAR', 'LB', 'PQ', 'VIAJE']

export default function RequestDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { user } = useUser()
  const db = useFirestore()
  
  const [localRequest, setLocalRequest] = useState<ServiceRequest | null>(null)
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

  useEffect(() => {
    if (firestoreRequest) {
      setLocalRequest(firestoreRequest as any)
    } else if (isRequestLoading === false) {
      const found = MOCK_REQUESTS.find(r => r.id === id || r.claimNumber === id)
      if (found) setLocalRequest(found as any)
    }
  }, [firestoreRequest, id, isRequestLoading])

  const isAdmin = profile?.roleId === 'Administrador'
  const isAccounting = profile?.roleId === 'Contabilidad'
  const isCustomerService = profile?.roleId === 'Servicio al Cliente'
  const isTech = profile?.roleId === 'Técnico'
  const isCompleted = localRequest?.status === 'completed'
  const isPrivilegedRole = isAdmin || isAccounting
  const canEdit = isPrivilegedRole || (isCustomerService && !isCompleted) || (isTech && !isCompleted)

  const handleUpdateField = (field: keyof ServiceRequest, value: any) => {
    if (!canEdit || isTech) return
    setLocalRequest(prev => prev ? { ...prev, [field]: value } : null)
  }

  const handleToggleExpenseUsage = (interventionId: string, expenseId: string, currentUnused: boolean) => {
    if (!db || !requestRef || !canEdit || !localRequest || isTech) return

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

    updateDoc(requestRef, updatedData)
    setLocalRequest(prev => prev ? { ...prev, ...updatedData } : null)
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
    if (!db || !requestRef || !profile || !canEdit || !localRequest) return
    
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
        setNewIntervention({ type: 'Diagnóstico', notes: '', reportedValue: 0, usedRotomartillo: false, usedGeofono: false, isSimpleVisit: false, detailedExpenses: [] })
      })
      .finally(() => setIsSaving(false))
  }

  const handleSaveAdvance = () => {
    if (!db || !requestRef || !newAdvance.technicianId || !newAdvance.amount || !localRequest) return
    
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

    const updatedAdvances = [...(localRequest.advances || []), advance]
    const updatedData = {
      advances: updatedAdvances,
      updatedAt: new Date().toISOString()
    }

    updateDoc(requestRef, updatedData)
      .then(() => {
        toast({ title: "Adelanto Registrado" })
        setShowAddAdvance(false)
        setLocalRequest(prev => prev ? { ...prev, ...updatedData } : null)
        setNewAdvance({ amount: 0, reason: '', technicianId: '' })
      })
      .finally(() => setIsSaving(false))
  }

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

  const interventions = localRequest.interventions || []
  const advances = localRequest.advances || []

  // Technician View Filter: Only see their own data if they are a tech
  const visibleInterventions = isTech 
    ? interventions.filter(i => i.technicianId === profile?.username)
    : interventions

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
              <h1 className="text-2xl font-black text-primary uppercase">{localRequest.claimNumber}</h1>
              <StatusBadge status={localRequest.status} />
            </div>
            <p className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2">
              <CategoryIcon category={localRequest.category} className="h-3 w-3" /> {localRequest.category}
            </p>
          </div>
        </div>
        {canEdit && !isTech && (
          <Button className="gap-2 font-black shadow-lg" onClick={() => {
            setIsSaving(true);
            updateDoc(requestRef!, { ...localRequest, updatedAt: new Date().toISOString() })
              .then(() => toast({ title: "Cambios Guardados" }))
              .finally(() => setIsSaving(false))
          }} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} GUARDAR CAMBIOS
          </Button>
        )}
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
                <p className="font-bold uppercase">{localRequest.insuredName}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase text-slate-400">Teléfono</p>
                <p className="font-medium">{localRequest.phoneNumber}</p>
              </div>
              <div className="space-y-1 md:col-span-2">
                <p className="text-[10px] font-black uppercase text-slate-400">Dirección</p>
                <p className="font-medium uppercase flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-primary" /> {localRequest.address}</p>
              </div>
              <div className="space-y-1 md:col-span-2 pt-2 border-t border-dashed">
                <p className="text-[10px] font-black uppercase text-slate-400">Descripción del Problema</p>
                <p className="text-xs text-slate-600 leading-relaxed">{localRequest.description}</p>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black uppercase tracking-tighter flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" /> Mis Reportes Técnicos
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
                          <p className="text-[9px] font-bold text-orange-600 uppercase">Valor Base $20.000</p>
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
                            {MOCK_TECHNICIANS.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
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
                      <Label className="text-[10px] font-black uppercase text-blue-600">Valor Reportado ($)</Label>
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
                      <Label htmlFor="rotomartillo" className="text-xs font-bold uppercase">Rotomartillo</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="geofono" checked={newIntervention.usedGeofono} onCheckedChange={(v) => setNewIntervention({...newIntervention, usedGeofono: !!v})} />
                      <Label htmlFor="geofono" className="text-xs font-bold uppercase">Geófono</Label>
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
                <div className="py-20 text-center border-2 border-dashed rounded-xl bg-slate-50/50"><p className="text-sm font-bold text-slate-400 italic">No tienes reportes en este expediente</p></div>
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
                            <p className="text-[9px] font-bold text-slate-400 uppercase">{new Date(adv.date).toLocaleString()} • {adv.reason}</p>
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
                              </div>
                              <Badge className="w-fit bg-primary/10 text-primary font-black uppercase text-[9px] mt-1">{item.type}</Badge>
                            </div>
                          </div>
                          <div className="text-right">
                             <p className="text-[8px] font-black uppercase text-slate-400">Pago Estimado</p>
                             <p className="text-lg font-black text-green-600">${techShare.toLocaleString()}</p>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-4">
                          <p className="text-sm text-slate-700 font-medium italic border-l-4 border-slate-200 pl-4">"{item.notes}"</p>
                          
                          {(item.detailedExpenses?.length > 0 || rentals > 0) && (
                            <div className="grid gap-2">
                              <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Gastos y Herramientas</p>
                              {rentals > 0 && (
                                <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border text-[10px] font-bold">
                                  <span className="uppercase flex items-center gap-2"><Hammer className="h-3 w-3" /> Alquiler de Maquinaria</span>
                                  <span className="font-mono text-destructive">-${rentals.toLocaleString()}</span>
                                </div>
                              )}
                              {item.detailedExpenses.map(exp => (
                                <div key={exp.id} className={cn("flex items-center justify-between p-2 rounded-lg border", exp.isUnused ? 'bg-orange-50/30 border-dashed border-orange-200' : 'bg-white')}>
                                  <div className="flex flex-col">
                                    <span className="text-[10px] font-black uppercase text-slate-800">{exp.description} {exp.isUnused && <Badge className="h-3 text-[6px] bg-orange-500">EN MI STOCK</Badge>}</span>
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
                Los valores aquí mostrados son estimaciones de tu pago neto (50%) después de descontar gastos y el fee administrativo.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
