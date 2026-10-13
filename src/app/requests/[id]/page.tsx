
"use client"

import { useState, useEffect, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { MOCK_REQUESTS, MOCK_TECHNICIANS } from "@/lib/mock-data"
import { ServiceRequest, Expense, TechnicianIntervention, InterventionType, ServiceStatus, UnitOfMeasure, Advance, ExpenseCategory, CostSheetItem, TicketCostLine } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as DatePicker } from "@/components/ui/calendar"
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
  FileText,
  Building2,
  UserCheck,
  User as UserIcon,
  ShieldCheck,
  Wrench,
  CircleCheck,
  Calendar
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "@/hooks/use-toast"
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase'
import { doc, updateDoc, collection, deleteDoc, setDoc } from 'firebase/firestore'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'
import { cn } from "@/lib/utils"

const UNITS: UnitOfMeasure[] = ['UND', 'KG', 'MTS', 'GL', 'PAR', 'LB', 'PQ', 'VIAJE', 'GAL', 'BASE', 'LT', 'CM', 'M2', 'M3', 'ROLLO', 'CAJA', 'BOLSA']
const VISIT_FEE = 20000

export default function RequestDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { user } = useUser()
  const db = useFirestore()
  
  const [isSaving, setIsSaving] = useState(false)
  const [showAddEntry, setShowAddEntry] = useState(false)
  const [editingInterventionId, setEditingInterventionId] = useState<string | null>(null)
  const [showAddAdvance, setShowAddAdvance] = useState(false)
  const [showScheduleForm, setShowScheduleForm] = useState(false)
  const [newSchedule, setNewSchedule] = useState({ technicianId: '', subservice: '', hour: '12', minute: '00', period: 'PM' as 'AM' | 'PM' })
  const [scheduleDate, setScheduleDate] = useState<Date>(new Date())
  const [scheduleTechQuery, setScheduleTechQuery] = useState('')
  const [isOtherScheduleTech, setIsOtherScheduleTech] = useState(false)
  const [selectedCostItemId, setSelectedCostItemId] = useState("")
  const [costQuantity, setCostQuantity] = useState(1)
  const [costAuthorizationStatus, setCostAuthorizationStatus] = useState<TicketCostLine["authorizationStatus"]>("approved")
  const [showOutOfTariff, setShowOutOfTariff] = useState(false)
  const [outOfTariff, setOutOfTariff] = useState({ kind: "material" as TicketCostLine["kind"], description: "", unit: "UND", quantity: 1, unitValue: 0 })
  
  const [isAddingNewTech, setIsAddingNewTech] = useState(false)
  const [newTechFullName, setNewTechFullName] = useState("")

  const [newIntervention, setNewIntervention] = useState<Partial<TechnicianIntervention>>({
    type: 'Diagnóstico',
    notes: '',
    reportedValue: 0,
    usedRotomartillo: false,
    usedGeofono: false,
    usedPlanchaTermofusion: false,
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
  const companiesQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return collection(db, "assistance_companies")
  }, [db, user])
  const { data: assistanceCompanies } = useCollection(companiesQuery)
  const costItemsQuery = useMemoFirebase(() => db && user ? collection(db, "cost_sheet_items") : null, [db, user])
  const { data: costSheetItems } = useCollection<CostSheetItem>(costItemsQuery)

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
  
  const canModifyHistory = isGerente || isDev
  const canEdit = isAdmin || (isCustomerService && !isCompleted) || (isTech && !isCompleted)

  const handleUpdateStatus = (newStatus: ServiceStatus) => {
    if (!db || !requestRef) return
    setIsSaving(true)
    const date = new Date().toISOString()
    const history = localStateRequest?.statusHistory || []
    const statusHistory = history.at(-1)?.status === newStatus ? history : [...history, {
      status: newStatus,
      date,
      ...(profile?.firstName ? { userName: profile.firstName } : {})
    }]
    updateDoc(requestRef, { status: newStatus, statusHistory, updatedAt: date })
      .then(() => toast({ title: "Estado Actualizado" }))
      .finally(() => setIsSaving(false))
  }

  const handleSaveSchedule = async () => {
    const hour = Number(newSchedule.hour)
    const minute = Number(newSchedule.minute)
    if (!db || !requestRef || !localStateRequest || !scheduleDate || !newSchedule.subservice.trim() || !Number.isInteger(hour) || hour < 1 || hour > 12 || !Number.isInteger(minute) || minute < 0 || minute > 59) {
      toast({ variant: "destructive", title: "Revisa la programación", description: "Selecciona la fecha, una hora entre 1 y 12, minutos entre 00 y 59 y el subservicio." })
      return
    }
    const createdAt = new Date().toISOString()
    const scheduledAt = new Date(scheduleDate.getFullYear(), scheduleDate.getMonth(), scheduleDate.getDate(), (hour % 12) + (newSchedule.period === 'PM' ? 12 : 0), minute)
    const visit = {
      id: crypto.randomUUID(),
      ...(newSchedule.technicianId ? { technicianId: newSchedule.technicianId } : {}),
      date: scheduledAt.toISOString(),
      subservice: newSchedule.subservice.trim(),
      createdAt
    }
    const scheduledVisits = [...(localStateRequest.scheduledVisits || (localStateRequest.scheduledVisit ? [localStateRequest.scheduledVisit] : [])), visit]
    const statusHistory = [...(localStateRequest.statusHistory || []), {
      status: 'assigned' as const,
      date: createdAt,
      ...(profile?.firstName ? { userName: profile.firstName } : {})
    }]
    setIsSaving(true)
    try {
      await updateDoc(requestRef, {
        scheduledVisits,
        scheduledVisit: visit,
        serviceSubservice: visit.subservice,
        status: 'assigned',
        statusHistory,
        updatedAt: createdAt
      })
      setNewIntervention(previous => ({ ...previous, technicianId: visit.technicianId, subservice: visit.subservice, scheduledVisitId: visit.id }))
      setShowScheduleForm(false)
      setNewSchedule({ technicianId: '', subservice: '', hour: '12', minute: '00', period: 'PM' })
      setScheduleDate(new Date())
      setScheduleTechQuery('')
      setIsOtherScheduleTech(false)
      toast({ title: "Visita programada", description: "La programación quedó registrada en el expediente." })
    } catch (error) {
      toast({ variant: "destructive", title: "No se pudo programar la visita", description: error instanceof Error ? error.message : "Verifica que las reglas de Firestore permitan actualizar el expediente." })
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdateMetadata = (field: string, value: any, interventionId?: string) => {
    if (!db || !requestRef || !isDev || !localStateRequest) return;

    let updateData: any = {};
    if (interventionId) {
      const updatedInterventions = localStateRequest.interventions.map(i => {
        if (i.id === interventionId) {
          return { ...i, [field]: value };
        }
        return i;
      });
      updateData = { interventions: updatedInterventions };
    } else {
      updateData = { [field]: value };
    }

    updateDoc(requestRef, { ...updateData, updatedAt: new Date().toISOString() })
      .then(() => toast({ title: "Metadatos Actualizados" }))
      .catch(() => toast({ variant: "destructive", title: "Error al actualizar" }));
  };

  const handleUpdateIntervention = (interventionId: string, updates: Partial<TechnicianIntervention>) => {
    if (!db || !requestRef || !canEdit || !localStateRequest) return
    const interventions = localStateRequest.interventions.map(item => item.id === interventionId ? { ...item, ...updates } : item)
    const scheduledVisits = (localStateRequest.scheduledVisits || (localStateRequest.scheduledVisit ? [localStateRequest.scheduledVisit] : [])).map(visit =>
      localStateRequest.interventions.find(item => item.id === interventionId)?.scheduledVisitId === visit.id
        ? { ...visit, technicianId: updates.technicianId || visit.technicianId, subservice: updates.subservice || visit.subservice }
        : visit
    )
    const latestScheduled = scheduledVisits.find(visit => visit.id === localStateRequest.scheduledVisit?.id)
    updateDoc(requestRef, {
      interventions,
      scheduledVisits,
      ...(latestScheduled ? { scheduledVisit: latestScheduled } : {}),
      updatedAt: new Date().toISOString()
    }).catch(() => toast({ variant: "destructive", title: "No se pudieron guardar los cambios del ticket" }))
  }

  const handleDeleteRequest = () => {
    if (!db || !requestRef || !isDev) return
    setIsSaving(true)
    deleteDoc(requestRef)
      .then(() => {
        toast({ title: "Expediente Eliminado" })
        router.push('/requests')
      })
      .finally(() => setIsSaving(false))
  }

  const handleTogglePayrollReady = (interventionId: string) => {
    if (!db || !requestRef || !isAdmin || !localStateRequest) return
    
    const updatedInterventions = localStateRequest.interventions.map(i => {
      if (i.id === interventionId) {
        return { ...i, isReadyForPayroll: !i.isReadyForPayroll }
      }
      return i
    })

    updateDoc(requestRef, { interventions: updatedInterventions, updatedAt: new Date().toISOString() })
      .then(() => toast({ title: "Estado Nómina Actualizado" }))
  }

  const [costAssistanceFilter, setCostAssistanceFilter] = useState("request")
  const availableCostItems = (costSheetItems || []).filter(item =>
    item.kind === "material" || (item.kind === "service" && (
      costAssistanceFilter === "all"
        ? true
        : item.assistanceCompanyId === (costAssistanceFilter === "request" ? localStateRequest?.companyId : costAssistanceFilter)
    ))
  )

  const addCostLine = (item: Pick<CostSheetItem, "id" | "kind" | "description" | "unit" | "value">, quantity: number, isOutOfTariff = false) => {
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast({ variant: "destructive", title: "La cantidad debe ser mayor que cero" })
      return
    }
    const costCode = !isOutOfTariff
      ? costSheetItems?.find(cost => cost.id === item.id)?.code
      : undefined
    const line: TicketCostLine = {
      id: crypto.randomUUID(),
      ...(costCode ? { costCode } : {}),
      description: item.description,
      kind: item.kind,
      unit: item.unit,
      quantity,
      unitValue: item.value,
      total: quantity * item.value,
      authorizationStatus: costAuthorizationStatus,
      ...(!isOutOfTariff ? { costSheetItemId: item.id } : {}),
      isOutOfTariff
    }
    setNewIntervention(previous => {
      const costLines = [...(previous.costLines || []), line]
      const reportedValue = costLines.filter(cost => cost.authorizationStatus === "approved").reduce((sum, cost) => sum + cost.total, 0)
      const detailedExpenses = item.kind === "material"
        ? [...(previous.detailedExpenses || []), {
            id: line.id,
            description: line.description,
            category: "material" as const,
            unit: line.unit as UnitOfMeasure,
            quantity: line.quantity,
            unitValue: line.unitValue,
            amount: line.total,
            isUnused: false
          }]
        : previous.detailedExpenses
      return { ...previous, costLines, reportedValue, detailedExpenses }
    })
    setSelectedCostItemId("")
    setCostQuantity(1)
    setShowOutOfTariff(false)
    setOutOfTariff({ kind: "material", description: "", unit: "UND", quantity: 1, unitValue: 0 })
  }

  const removeCostLine = (lineId: string) => {
    setNewIntervention(previous => {
      const removedLine = (previous.costLines || []).find(line => line.id === lineId)
      const costLines = (previous.costLines || []).filter(line => line.id !== lineId)
      const reportedValue = costLines.filter(line => line.authorizationStatus === "approved").reduce((sum, line) => sum + line.total, 0)
      const detailedExpenses = removedLine?.kind === "material"
        ? (previous.detailedExpenses || []).filter(expense => expense.id !== lineId)
        : previous.detailedExpenses
      return { ...previous, costLines, reportedValue, detailedExpenses }
    })
  }

  const handleAddExpense = () => {
    if (!tempExpense.description || !tempExpense.quantity || !tempExpense.unitValue) {
      toast({ variant: "destructive", title: "Datos incompletos en el gasto" })
      return
    }
    const totalAmount = (tempExpense.quantity || 0) * (tempExpense.unitValue || 0)
    const expense: Expense = {
      id: Math.random().toString(36).substring(7),
      description: tempExpense.description.toUpperCase(),
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

  const removeExpense = (idx: number) => {
    setNewIntervention(prev => ({
      ...prev,
      detailedExpenses: (prev.detailedExpenses || []).filter((_, i) => i !== idx)
    }))
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

    if (!targetTechId || !newIntervention.notes?.trim()) {
      toast({ variant: "destructive", title: "Selecciona el técnico y agrega el reporte" })
      return
    }

    setIsSaving(true)
    const intervention: TechnicianIntervention = {
      id: Math.random().toString(36).substring(7),
      title: newIntervention.title?.trim() || `${localStateRequest.category} - ${newIntervention.subservice || localStateRequest.serviceSubservice || 'Servicio técnico'}`,
      technicianId: targetTechId,
      type: (newIntervention.type as InterventionType) || 'Diagnóstico',
      ...(newIntervention.visitType ? { visitType: newIntervention.visitType } : {}),
      subservice: newIntervention.subservice || localStateRequest.serviceSubservice || '',
      ...(newIntervention.scheduledVisitId ? { scheduledVisitId: newIntervention.scheduledVisitId } : {}),
      date: new Date().toISOString(),
      notes: newIntervention.notes!,
      reportedValue: Number(newIntervention.reportedValue) || 0,
      costLines: newIntervention.costLines || [],
      laborCost: 0,
      usedRotomartillo: !!newIntervention.usedRotomartillo,
      usedGeofono: !!newIntervention.usedGeofono,
      usedPlanchaTermofusion: !!newIntervention.usedPlanchaTermofusion,
      isSimpleVisit: !!newIntervention.isSimpleVisit,
      detailedExpenses: newIntervention.detailedExpenses || [],
      authorName: `${profile.firstName} ${profile.lastName}`,
      payrollStatus: 'pending',
      authorizedByAdvisor: newIntervention.authorizedByAdvisor?.toUpperCase() || ''
    }

    const updatedInterventions = editingInterventionId
      ? (localStateRequest.interventions || []).map(item => item.id === editingInterventionId ? {
          ...item,
          ...intervention,
          id: editingInterventionId,
          payrollStatus: item.payrollStatus,
          payrollId: item.payrollId,
          isReadyForPayroll: item.isReadyForPayroll
        } : item)
      : [...(localStateRequest.interventions || []), intervention]
    const scheduledVisits = (localStateRequest.scheduledVisits || (localStateRequest.scheduledVisit ? [localStateRequest.scheduledVisit] : [])).map(visit =>
      visit.id === intervention.scheduledVisitId ? { ...visit, technicianId: intervention.technicianId, subservice: intervention.subservice } : visit
    )
    const latestScheduled = scheduledVisits.find(visit => visit.id === localStateRequest.scheduledVisit?.id)
    try {
      await updateDoc(requestRef, {
        interventions: updatedInterventions,
        scheduledVisits,
        ...(latestScheduled ? { scheduledVisit: latestScheduled } : {}),
        updatedAt: new Date().toISOString()
      })
      toast({ title: "Reporte Añadido" })
      setShowAddEntry(false)
      setEditingInterventionId(null)
      setNewIntervention({ type: 'Diagnóstico', title: '', notes: '', reportedValue: 0, usedRotomartillo: false, usedGeofono: false, usedPlanchaTermofusion: false, isSimpleVisit: false, detailedExpenses: [], costLines: [], authorizedByAdvisor: '' })
    } catch (error) {
      console.error("Saving service report failed:", error)
      toast({
        variant: "destructive",
        title: "No se pudo guardar el reporte",
        description: error instanceof Error ? error.message : "Verifica los permisos y la conexión con Firestore."
      })
    } finally {
      setIsSaving(false)
    }
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
  const scheduledVisits = localStateRequest.scheduledVisits || (localStateRequest.scheduledVisit ? [localStateRequest.scheduledVisit] : [])
  const timeline = [
    ...(localStateRequest.statusHistory?.length
      ? localStateRequest.statusHistory.map(entry => ({ date: entry.date, label: entry.status === 'assigned' ? 'PROGRAMADO' : entry.status === 'in_progress' ? 'EN CURSO' : entry.status === 'completed' ? 'FINALIZADO' : entry.status.toUpperCase() }))
      : [{ date: localStateRequest.createdAt, label: 'CREADO' }]),
    ...scheduledVisits.map(visit => ({ date: visit.date, label: 'PROGRAMADO' })),
    ...interventions.map(item => ({ date: item.date, label: item.type.toUpperCase() }))
  ].filter(event => event.date).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const assistanceName = assistanceCompanies?.find(company => company.id === localStateRequest.companyId)?.name || localStateRequest.companyId

  const copyTicket = async (intervention?: TechnicianIntervention, visit?: typeof scheduledVisits[number]) => {
    const ticket = [
      intervention?.title ? `Ticket: ${intervention.title}` : "",
      `Expediente: ${localStateRequest.claimNumber}`,
      `Hora y fecha: ${new Date(intervention?.date || visit?.date || localStateRequest.createdAt).toLocaleString('es-CO')}`,
      `Dirección: ${localStateRequest.address}`,
      `Ciudad: ${localStateRequest.city}`,
      `Cuenta: ${assistanceName} / ${localStateRequest.accountName}`,
      `Técnico asignado: ${intervention?.technicianId || visit?.technicianId || 'Pendiente'}`,
      `Servicio: ${localStateRequest.category}`,
      `Subservicio: ${intervention?.subservice || visit?.subservice || localStateRequest.serviceSubservice || 'Pendiente'}`,
      `Visita: ${intervention?.visitType || 'Pendiente'}`,
      `Qué reportan: ${localStateRequest.description}`,
      `Reporte: ${intervention?.notes || 'Pendiente'}`,
      `Costos aprobados: ${(intervention?.costLines || []).filter(line => line.authorizationStatus === 'approved').map(line => `${line.description} ${line.total.toLocaleString('es-CO')}`).join(', ') || `$${(intervention?.reportedValue || 0).toLocaleString('es-CO')}`}`,
      `Costos por autorizar: ${(intervention?.costLines || []).filter(line => line.authorizationStatus === 'pending').map(line => `${line.description} ${line.total.toLocaleString('es-CO')}`).join(', ') || 'Ninguno'}`,
      '',
      'Quedamos atentos,',
      'Equipo Plomería y Servicios Integrales'
    ].join('\n')
    try {
      await navigator.clipboard.writeText(ticket)
      toast({ title: "Ticket copiado", description: "Ya puedes pegarlo para enviarlo a la asistencia." })
    } catch {
      toast({ variant: "destructive", title: "No se pudo copiar el ticket", description: "Verifica los permisos del navegador." })
    }
  }

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
              <span className="rounded bg-[#a4b342]/15 px-2 py-1 text-[#59651e]">Folio {localStateRequest.folio ?? 0}</span>
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

      <div className="grid gap-5 lg:grid-cols-12">
        <Card className="h-fit border-[#e7e7e7] shadow-sm lg:col-span-4">
          <CardHeader className="border-b bg-white pb-3">
            <CardTitle className="text-sm font-bold uppercase tracking-wide text-[#5d5d5d]">Línea de tiempo</CardTitle>
          </CardHeader>
          <CardContent className="pt-5">
            {timeline.length ? (
              <ol className="space-y-0">
                {timeline.map((event, index) => {
                  const dotColor = event.label.includes("CREADO") ? "#a4b342" : event.label.includes("PROGRAMADO") ? "#f36f3d" : event.label.includes("FINALIZADO") ? "#f36f3d" : event.label.includes("CURSO") ? "#f36f3d" : "#d6a51d"
                  return (
                    <li key={`${event.date}-${event.label}-${index}`} className="relative grid grid-cols-[82px_16px_minmax(0,1fr)] gap-3 pb-5 last:pb-0">
                      {index < timeline.length - 1 && <span className="absolute left-[91px] top-3 h-full w-px bg-[#d8d8d8]" />}
                      <time className="pt-0.5 text-right text-[10px] leading-4 text-[#777]">{new Date(event.date).toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "2-digit" })}<br />{new Date(event.date).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}</time>
                      <span className="relative z-10 mt-1 h-3 w-3 rounded-full border-2 border-white shadow-[0_0_0_1px_#d8d8d8]" style={{ backgroundColor: dotColor }} />
                      <div className="flex min-w-0 flex-col gap-1">
                        <span className="text-[11px] font-semibold uppercase text-[#4b4b4b]">{event.label}</span>
                      </div>
                    </li>
                  )
                })}
              </ol>
            ) : <p className="text-sm text-muted-foreground">Aún no hay movimientos registrados.</p>}
          </CardContent>
        </Card>

        <Card className="border-[#e7e7e7] shadow-sm lg:col-span-8">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b">
            <div>
              <CardTitle className="text-sm font-bold uppercase tracking-wide text-[#5d5d5d]">Programar</CardTitle>
              <CardDescription>Cada cita conserva su técnico, fecha y subservicio.</CardDescription>
            </div>
            {canEdit && <Button variant="outline" size="sm" onClick={() => setShowScheduleForm(value => !value)}><Plus className="mr-2 h-4 w-4" />Nueva programación</Button>}
          </CardHeader>
          <CardContent className="space-y-3">
            {showScheduleForm && (
              <div className="grid gap-3 rounded-lg border bg-muted/20 p-4 md:grid-cols-2">
                <div className="space-y-1">
                  <Label>Fecha de la cita</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" className="w-full justify-start text-left font-medium"><CalendarDays className="mr-2 h-4 w-4 text-primary" />{format(scheduleDate, "EEEE d 'de' MMMM yyyy", { locale: es })}</Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <DatePicker mode="single" selected={scheduleDate} onSelect={day => day && setScheduleDate(day)} initialFocus weekStartsOn={1} locale={es} />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1">
                  <Label>Hora (12 horas)</Label>
                  <div className="flex gap-2">
                    <Input aria-label="Hora" type="number" inputMode="numeric" min={1} max={12} value={newSchedule.hour} onChange={event => setNewSchedule({ ...newSchedule, hour: event.target.value })} className="w-20" />
                    <span className="flex items-center font-bold">:</span>
                    <Input aria-label="Minutos" type="number" inputMode="numeric" min={0} max={59} value={newSchedule.minute} onChange={event => setNewSchedule({ ...newSchedule, minute: event.target.value.padStart(2, '0').slice(-2) })} className="w-20" />
                    <Select value={newSchedule.period} onValueChange={period => setNewSchedule({ ...newSchedule, period: period as 'AM' | 'PM' })}>
                      <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="AM">AM</SelectItem><SelectItem value="PM">PM</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Técnico</Label>
                  <Input
                    value={scheduleTechQuery}
                    onChange={event => {
                      setScheduleTechQuery(event.target.value)
                      setNewSchedule({ ...newSchedule, technicianId: isOtherScheduleTech ? event.target.value : '' })
                    }}
                    placeholder="Escribe para buscar técnico..."
                    list="schedule-technicians"
                  />
                  <datalist id="schedule-technicians">{techList.map(tech => <option key={tech.id} value={`${tech.firstName} ${tech.lastName || ''}`.trim()} />)}</datalist>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button type="button" size="sm" variant={!newSchedule.technicianId && !isOtherScheduleTech ? "default" : "outline"} onClick={() => { setNewSchedule({ ...newSchedule, technicianId: '' }); setScheduleTechQuery(''); setIsOtherScheduleTech(false) }}>Pendiente por asignar</Button>
                    {scheduleTechQuery.trim() && !isOtherScheduleTech && techList.filter(tech => `${tech.firstName} ${tech.lastName || ''} ${tech.username || ''}`.toLowerCase().includes(scheduleTechQuery.toLowerCase())).slice(0, 5).map(tech => {
                      const name = `${tech.firstName} ${tech.lastName || ''}`.trim()
                      return <Button key={tech.id} type="button" size="sm" variant="outline" onClick={() => { setNewSchedule({ ...newSchedule, technicianId: tech.username || tech.id }); setScheduleTechQuery(name); setIsOtherScheduleTech(false) }}>{name}</Button>
                    })}
                    {scheduleTechQuery.trim() && !techList.some(tech => `${tech.firstName} ${tech.lastName || ''}`.trim().toLowerCase() === scheduleTechQuery.trim().toLowerCase()) && (
                      <Button type="button" size="sm" variant={isOtherScheduleTech ? "default" : "outline"} onClick={() => { setIsOtherScheduleTech(true); setNewSchedule({ ...newSchedule, technicianId: scheduleTechQuery.trim() }) }}>Otro: crear “{scheduleTechQuery.trim()}”</Button>
                    )}
                  </div>
                  {isOtherScheduleTech && <p className="text-xs text-muted-foreground">Este nombre quedará registrado como técnico asignado en esta cita.</p>}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="schedule-subservice">Subservicio</Label>
                  <Input id="schedule-subservice" value={newSchedule.subservice} onChange={event => setNewSchedule({ ...newSchedule, subservice: event.target.value })} placeholder="Ej. Instalación de tubería" />
                </div>
                <div className="flex items-end gap-2">
                  <Button onClick={handleSaveSchedule} disabled={isSaving} className="flex-1">{isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Guardar</Button>
                  <Button variant="ghost" onClick={() => setShowScheduleForm(false)}>Cancelar</Button>
                </div>
              </div>
            )}
            {scheduledVisits.length ? scheduledVisits.slice().sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(visit => {
              const visitHasReport = interventions.some(item => item.scheduledVisitId === visit.id)
              const technician = techList.find(item => (item.username || item.id) === visit.technicianId)
              return (
                <div key={visit.id} className={cn("flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3", !visitHasReport && "border-destructive/40 bg-destructive/5")}>
                  <div className="min-w-48">
                    <p className="text-sm font-semibold">{new Date(visit.date).toLocaleString('es-CO')}</p>
                    <p className="text-xs text-muted-foreground">{visit.subservice || localStateRequest.serviceSubservice || "Subservicio pendiente"}</p>
                    <p className="text-xs text-muted-foreground">Técnico: {technician ? `${technician.firstName} ${technician.lastName || ''}`.trim() : visit.technicianId || "Sin asignar"}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={visitHasReport ? "secondary" : "destructive"}>{visitHasReport ? "Con reporte" : "Falta reporte"}</Badge>
                    <Button variant="outline" size="sm" onClick={() => copyTicket(undefined, visit)}><FileText className="mr-2 h-4 w-4" />Copiar ticket</Button>
                    {canEdit && <Button size="sm" onClick={() => {
                      setNewIntervention(previous => ({ ...previous, technicianId: visit.technicianId || '', subservice: visit.subservice || localStateRequest.serviceSubservice || '', scheduledVisitId: visit.id, notes: '' }))
                      setShowAddEntry(true)
                    }}><Plus className="mr-2 h-4 w-4" />{visitHasReport ? "Agregar reporte" : "Hacer reporte"}</Button>}
                  </div>
                </div>
              )
            }) : <p className="text-sm text-muted-foreground">No hay visitas programadas todavía.</p>}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-[#e7e7e7] shadow-sm">
              <CardHeader className="border-b pb-3"><CardTitle className="text-xs font-bold uppercase tracking-wide text-[#666]">Información general</CardTitle></CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div><p className="text-[10px] font-bold uppercase text-[#999]">Servicio / subservicio</p><p className="mt-1 text-sm font-semibold text-[#424242]">{localStateRequest.category}{localStateRequest.serviceSubservice ? ` · ${localStateRequest.serviceSubservice}` : ''}</p></div>
                <div><p className="text-[10px] font-bold uppercase text-[#999]">Qué reportan</p><p className="mt-1 text-sm leading-relaxed text-[#555]">{localStateRequest.description}</p></div>
              </CardContent>
            </Card>
            <Card className="border-[#e7e7e7] shadow-sm">
              <CardHeader className="border-b pb-3"><CardTitle className="text-xs font-bold uppercase tracking-wide text-[#666]">Cliente</CardTitle></CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f36f3d]/10"><Building2 className="h-5 w-5 text-[#f36f3d]" /></span><div><p className="font-semibold text-[#414141]">{assistanceName}</p><p className="text-xs text-muted-foreground">{localStateRequest.accountName}</p></div></div>
                <div><p className="text-[10px] font-bold uppercase text-[#999]">Cuenta</p><p className="mt-1 text-sm text-[#555]">{localStateRequest.accountName}</p></div>
              </CardContent>
            </Card>
            <Card className="border-[#e7e7e7] shadow-sm md:col-span-2">
              <CardHeader className="border-b pb-3"><CardTitle className="text-xs font-bold uppercase tracking-wide text-[#666]">Asistido</CardTitle></CardHeader>
              <CardContent className="grid gap-4 pt-4 sm:grid-cols-2">
                <div><p className="text-[10px] font-bold uppercase text-[#999]">Nombre</p><p className="mt-1 text-sm font-semibold uppercase text-[#414141]">{localStateRequest.insuredName}</p></div>
                <div><p className="text-[10px] font-bold uppercase text-[#999]">Teléfono</p><p className="mt-1 text-sm text-[#555]">{localStateRequest.phoneNumber || "No registrado"}</p></div>
                <div className="sm:col-span-2"><p className="text-[10px] font-bold uppercase text-[#999]">Dirección</p><p className="mt-1 flex items-center gap-2 text-sm uppercase text-[#555]"><MapPin className="h-3.5 w-3.5 text-[#f36f3d]" />{localStateRequest.address} · {localStateRequest.city}</p></div>
              </CardContent>
            </Card>
          </div>
          {isDev && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="space-y-4 p-4">
                <p className="flex items-center gap-2 text-[9px] font-black uppercase text-red-600"><ShieldCheck className="h-3 w-3" />Panel de Desarrollador: Metadatos del Expediente</p>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-1"><Label className="text-[8px] font-black uppercase">Fecha de Apertura (ISO)</Label><Input defaultValue={localStateRequest.createdAt} onBlur={event => handleUpdateMetadata("createdAt", event.target.value)} className="h-8 text-[10px] font-mono" /></div>
                  <div className="space-y-1"><Label className="text-[8px] font-black uppercase">Creado por (ID Usuario)</Label><Input defaultValue={localStateRequest.createdBy} onBlur={event => handleUpdateMetadata("createdBy", event.target.value)} className="h-8 text-[10px] font-mono" /></div>
                </div>
              </CardContent>
            </Card>
          )}

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
                    <div className="space-y-2 md:col-span-2">
                      <Label className="text-[10px] font-black uppercase">Título del ticket</Label>
                      <Input value={newIntervention.title || ''} onChange={event => setNewIntervention({ ...newIntervention, title: event.target.value })} placeholder="Título breve del reporte" />
                    </div>
                    {!isTech && scheduledVisits.length > 0 && (
                      <div className="space-y-2 md:col-span-2">
                        <Label className="text-[10px] font-black uppercase">Programación relacionada</Label>
                        <Select value={newIntervention.scheduledVisitId || "none"} onValueChange={value => {
                          const visit = scheduledVisits.find(item => item.id === value)
                          setNewIntervention(previous => ({ ...previous, scheduledVisitId: value === "none" ? undefined : value, technicianId: visit?.technicianId || previous.technicianId, subservice: visit?.subservice || previous.subservice }))
                        }}>
                          <SelectTrigger><SelectValue placeholder="Seleccionar programación" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Reporte no relacionado con una cita</SelectItem>
                            {scheduledVisits.map(visit => <SelectItem key={visit.id} value={visit.id}>{`${new Date(visit.date).toLocaleString('es-CO')} · ${visit.subservice || 'Subservicio pendiente'} · ${visit.technicianId || 'Sin técnico'}`}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
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
                        <Label className="text-[10px] font-black uppercase">Técnico Responsable</Label>
                        <Select 
                          value={isAddingNewTech ? "NEW" : newIntervention.technicianId} 
                          onValueChange={(v) => {
                            if (v === "NEW") setIsAddingNewTech(true)
                            else { setIsAddingNewTech(false); setNewIntervention({...newIntervention, technicianId: v}); }
                          }}
                        >
                          <SelectTrigger className="h-12 border-primary/20"><SelectValue placeholder="Seleccionar técnico" /></SelectTrigger>
                          <SelectContent>
                            {techList.map(t => <SelectItem key={t.id} value={t.username || t.id}>{t.firstName}</SelectItem>)}
                            <SelectItem value="NEW" className="font-bold text-primary italic">+ OTRO técnico...</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase">Subservicio</Label>
                      <Input value={newIntervention.subservice || ''} onChange={event => setNewIntervention({ ...newIntervention, subservice: event.target.value })} placeholder="Ej. Instalación de tubería" />
                    </div>
                  </div>

                  {isAddingNewTech && (
                    <div className="space-y-2 p-4 bg-primary/5 rounded-xl border border-primary/20 animate-in slide-in-from-top-2">
                      <Label className="text-[10px] font-black uppercase text-primary">Nombre del Nuevo Técnico</Label>
                      <Input placeholder="EJ. ANDRES RIVERA" value={newTechFullName} onChange={(e) => setNewTechFullName(e.target.value.toUpperCase())} className="font-black h-10" />
                    </div>
                  )}

                  <div className="rounded-xl border bg-white p-4 space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-3">
                      <div>
                        <h3 className="text-sm font-semibold">Calculadora de costos</h3>
                        <p className="text-xs text-muted-foreground">Filtra tarifas por asistencia o busca en todas; materiales compartidos.</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Select value={costAssistanceFilter} onValueChange={setCostAssistanceFilter}>
                          <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="request">Asistencia actual · {assistanceName}</SelectItem>
                            <SelectItem value="all">Todas las asistencias</SelectItem>
                            {(assistanceCompanies || []).map(company => <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Select value={costAuthorizationStatus} onValueChange={value => setCostAuthorizationStatus(value as TicketCostLine["authorizationStatus"])}>
                          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="approved">Aprobado</SelectItem><SelectItem value="pending">Por autorizar</SelectItem></SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-[1fr_120px_auto_auto]">
                      <Select value={selectedCostItemId} onValueChange={setSelectedCostItemId}>
                        <SelectTrigger><SelectValue placeholder="Seleccionar servicio o material del tarifado" /></SelectTrigger>
                        <SelectContent>
                          {availableCostItems.map(item => <SelectItem key={item.id} value={item.id}>{item.code ? `${item.code} · ` : ""}{item.description} · {item.unit} · ${item.value.toLocaleString('es-CO')}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Input type="number" min="1" value={costQuantity} onChange={event => setCostQuantity(Number(event.target.value))} aria-label="Cantidad" />
                      <Button type="button" variant="outline" onClick={() => {
                        const item = availableCostItems.find(cost => cost.id === selectedCostItemId)
                        if (!item) {
                          toast({ variant: "destructive", title: "Selecciona un ítem del tarifado" })
                          return
                        }
                        addCostLine(item, costQuantity)
                      }}><Plus className="mr-2 h-4 w-4" />Agregar</Button>
                      <Button type="button" variant="outline" onClick={() => setShowOutOfTariff(value => !value)}>Fuera de tarifado</Button>
                    </div>
                    {showOutOfTariff && (
                      <div className="grid gap-3 rounded-lg border border-dashed p-3 md:grid-cols-6">
                        <Select value={outOfTariff.kind} onValueChange={value => setOutOfTariff({ ...outOfTariff, kind: value as TicketCostLine["kind"] })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="material">Material</SelectItem><SelectItem value="service">Servicio</SelectItem></SelectContent>
                        </Select>
                        <Input value={outOfTariff.description} onChange={event => setOutOfTariff({ ...outOfTariff, description: event.target.value })} placeholder="Descripción" />
                        <Select value={outOfTariff.unit} onValueChange={unit => setOutOfTariff({ ...outOfTariff, unit })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{UNITS.map(unit => <SelectItem key={unit} value={unit}>{unit}</SelectItem>)}</SelectContent>
                        </Select>
                        <Input type="number" min="1" value={outOfTariff.quantity} onChange={event => setOutOfTariff({ ...outOfTariff, quantity: Number(event.target.value) })} aria-label="Cantidad" />
                        <Input type="number" min="1" value={outOfTariff.unitValue} onChange={event => setOutOfTariff({ ...outOfTariff, unitValue: Number(event.target.value) })} placeholder="Valor unitario" />
                        <Button type="button" onClick={() => {
                          if (!outOfTariff.description.trim() || outOfTariff.unitValue <= 0) {
                            toast({ variant: "destructive", title: "Completa descripción y valor" })
                            return
                          }
                          addCostLine({ id: "", kind: outOfTariff.kind, description: outOfTariff.description.trim(), unit: outOfTariff.unit, value: outOfTariff.unitValue }, outOfTariff.quantity, true)
                        }}>Agregar ítem</Button>
                      </div>
                    )}
                    {(newIntervention.costLines || []).length > 0 && (
                      <div className="space-y-3">
                        {(["approved", "pending"] as const).map(status => {
                          const lines = (newIntervention.costLines || []).filter(line => line.authorizationStatus === status)
                          if (!lines.length) return null
                          const total = lines.reduce((sum, line) => sum + line.total, 0)
                          const standardLines = lines.filter(line => !line.isOutOfTariff)
                          const otherLines = lines.filter(line => line.isOutOfTariff)
                          return (
                            <div key={status} className="rounded-lg border p-3">
                              <p className="mb-2 text-xs font-semibold">{status === "approved" ? "Costos aprobados" : "Por autorizar"}</p>
                              {standardLines.length > 0 && <p className="border-t pt-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Tarifado</p>}
                              {standardLines.map(line => (
                                <div key={line.id} className="flex items-center justify-between gap-3 border-t py-2 text-sm">
                                  <span>{line.costCode && <strong className="mr-1 font-mono text-primary">{line.costCode}</strong>}{line.description} · {line.quantity} {line.unit} × ${line.unitValue.toLocaleString('es-CO')}</span>
                                  <span className="flex items-center gap-2 font-semibold">${line.total.toLocaleString('es-CO')}<Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeCostLine(line.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button></span>
                                </div>
                              ))}
                              {otherLines.length > 0 && <p className="mt-2 border-t pt-2 text-[10px] font-bold uppercase tracking-wide text-[#f36f3d]">Otros costos · Fuera de tarifado</p>}
                              {otherLines.map(line => (
                                <div key={line.id} className="flex items-center justify-between gap-3 border-t border-dashed py-2 text-sm">
                                  <span>{line.description} · {line.quantity} {line.unit} × ${line.unitValue.toLocaleString('es-CO')}</span>
                                  <span className="flex items-center gap-2 font-semibold">${line.total.toLocaleString('es-CO')}<Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeCostLine(line.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button></span>
                                </div>
                              ))}
                              <p className="border-t pt-2 text-right text-sm font-bold">Total: ${total.toLocaleString('es-CO')}</p>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  <div className="p-4 bg-slate-50 rounded-xl border space-y-4">
                    <div className="flex items-center gap-2 border-b pb-2">
                      <Hammer className="h-4 w-4 text-primary" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Alquiler de Equipos Especiales</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex items-center justify-between p-2 bg-white rounded-lg border">
                        <Label className="text-xs font-bold uppercase">Rotomartillo</Label>
                        <Switch checked={newIntervention.usedRotomartillo} onCheckedChange={(v) => setNewIntervention({...newIntervention, usedRotomartillo: v})} />
                      </div>
                      <div className="flex items-center justify-between p-2 bg-white rounded-lg border">
                        <Label className="text-xs font-bold uppercase">Geófono</Label>
                        <Switch checked={newIntervention.usedGeofono} onCheckedChange={(v) => setNewIntervention({...newIntervention, usedGeofono: v})} />
                      </div>
                      <div className="flex items-center justify-between p-2 bg-white rounded-lg border">
                        <Label className="text-xs font-bold uppercase">Termo Fusión</Label>
                        <Switch checked={newIntervention.usedPlanchaTermofusion} onCheckedChange={(v) => setNewIntervention({...newIntervention, usedPlanchaTermofusion: v})} />
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-xl border space-y-4">
                    <div className="flex items-center gap-2 border-b pb-2">
                      <Warehouse className="h-4 w-4 text-primary" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Materiales y gastos adicionales</span>
                    </div>
                    
                    <div className="grid gap-4 md:grid-cols-12 items-end">
                      <div className="md:col-span-4 space-y-1">
                        <Label className="text-[9px] font-black uppercase">Descripción</Label>
                        <Input value={tempExpense.description} onChange={(e) => setTempExpense({...tempExpense, description: e.target.value})} placeholder="Ej. TUBO PVC 1/2" className="h-9 uppercase text-xs" />
                      </div>
                      <div className="md:col-span-2 space-y-1">
                        <Label className="text-[9px] font-black uppercase">Cat.</Label>
                        <Select value={tempExpense.category} onValueChange={(v) => setTempExpense({...tempExpense, category: v as ExpenseCategory})}>
                          <SelectTrigger className="h-9 text-[10px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="material">Mat.</SelectItem>
                            <SelectItem value="transporte">Trans.</SelectItem>
                            <SelectItem value="otros">Otros</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="md:col-span-2 space-y-1">
                        <Label className="text-[9px] font-black uppercase">Cant.</Label>
                        <Input type="number" value={tempExpense.quantity} onChange={(e) => setTempExpense({...tempExpense, quantity: Number(e.target.value)})} className="h-9" />
                      </div>
                      <div className="md:col-span-3 space-y-1">
                        <Label className="text-[9px] font-black uppercase">V. Unit ($)</Label>
                        <Input type="number" value={tempExpense.unitValue} onChange={(e) => setTempExpense({...tempExpense, unitValue: Number(e.target.value)})} className="h-9" />
                      </div>
                      <div className="md:col-span-1">
                        <Button type="button" onClick={handleAddExpense} size="icon" className="h-9 w-9 bg-primary"><Plus className="h-4 w-4" /></Button>
                      </div>
                    </div>

                    {(newIntervention.detailedExpenses || []).length > 0 && (
                      <div className="mt-4 border rounded-lg overflow-hidden bg-white">
                        <Table>
                          <TableHeader className="bg-muted/50"><TableRow>
                            <TableHead className="text-[9px] font-black uppercase h-8">Material</TableHead>
                            <TableHead className="text-[9px] font-black uppercase h-8 text-right">Total</TableHead>
                            <TableHead className="h-8"></TableHead>
                          </TableRow></TableHeader>
                          <TableBody>
                            {newIntervention.detailedExpenses?.map((ex, idx) => (
                              <TableRow key={idx} className="h-8">
                                <TableCell className="text-[10px] py-1 font-bold">{ex.description}</TableCell>
                                <TableCell className="text-[10px] py-1 text-right font-mono">${ex.amount.toLocaleString()}</TableCell>
                                <TableCell className="py-1 text-right"><Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeExpense(idx)}><Trash2 className="h-3.5 w-3.5" /></Button></TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase">Tipo de visita</Label>
                      <Select value={newIntervention.visitType || 'Intervención'} onValueChange={value => setNewIntervention({ ...newIntervention, visitType: value as TechnicianIntervention['visitType'] })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {['Diurna', 'Nocturna', 'Festivo', 'Fallido', 'Intervención'].map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase">Tipo de Trabajo</Label>
                      <Select value={newIntervention.type} onValueChange={(v) => setNewIntervention({...newIntervention, type: v as InterventionType})}>
                        <SelectTrigger className="h-10 border-primary/20"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Diagnóstico">Diagnóstico</SelectItem>
                          <SelectItem value="Reparación">Reparación</SelectItem>
                          <SelectItem value="Finalización">Finalización</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase">Asesor Cabina (Opcional)</Label>
                      <Input placeholder="NOMBRE ASESOR" value={newIntervention.authorizedByAdvisor} onChange={(e) => setNewIntervention({...newIntervention, authorizedByAdvisor: e.target.value.toUpperCase()})} className="h-10 uppercase text-xs" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-blue-600">Valor Bruto Cobrado a Aseguradora ($)</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-600" />
                      <Input type="number" className="pl-9 font-black bg-blue-50/50 border-blue-200 h-12 text-lg" value={newIntervention.reportedValue} onChange={(e) => setNewIntervention({...newIntervention, reportedValue: Number(e.target.value)})} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase">Descripción detallada de la labor</Label>
                    <Textarea className="min-h-[120px] font-medium" value={newIntervention.notes} onChange={(e) => setNewIntervention({...newIntervention, notes: e.target.value})} placeholder="Detalle acciones realizadas, repuestos instalados y observaciones..." />
                  </div>

                  <Button className="w-full font-black shadow-lg h-14 bg-primary hover:bg-primary/90 text-lg uppercase tracking-widest" onClick={handleSaveIntervention} disabled={isSaving}>
                    {isSaving ? <Loader2 className="h-6 w-6 animate-spin mr-2" /> : <Save className="h-6 w-6 mr-2" />} REGISTRAR REPORTE
                  </Button>
                </CardContent>
              </Card>
            )}

            <div className="space-y-4">
              {[...interventions].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((item) => (
                <Card key={item.id} className="overflow-hidden border-none shadow-md">
                  <CardHeader className="bg-slate-50 py-3 flex flex-row items-center justify-between border-b">
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-semibold">{item.title || item.subservice || localStateRequest.category}</p>
                      <div className="flex items-center gap-2">
                        {isDev ? (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-red-500" />
                            <Input 
                              defaultValue={item.date} 
                              onBlur={(e) => handleUpdateMetadata('date', e.target.value, item.id)}
                              aria-label="Editar fecha y hora de publicación del reporte"
                              title="Solo Desarrollador puede editar la fecha y hora de publicación"
                              className="h-6 text-[9px] font-mono w-40 px-1 border-red-200"
                            />
                          </div>
                        ) : (
                          <span className="text-[10px] font-black uppercase text-slate-400">{new Date(item.date).toLocaleString()}</span>
                        )}
                        {item.isSimpleVisit && <Badge className="bg-orange-500 text-[8px] font-black">Visita $20k</Badge>}
                        {item.payrollStatus === 'processed' && <Badge className="bg-green-600 text-white text-[8px]">PAGADO</Badge>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-primary/10 text-primary text-[9px] font-black">{item.type}</Badge>
                        {item.visitType && <Badge variant="outline" className="text-[9px]">{item.visitType}</Badge>}
                        {item.isPayrollExcluded && <Badge variant="outline" className="text-[9px]">SIN NÓMINA</Badge>}
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Téc: {item.technicianId || (item.isPayrollExcluded ? "NO APLICA" : "PENDIENTE")}</span>
                        {item.subservice && <span className="text-[10px] font-bold text-slate-500 uppercase">{item.subservice}</span>}
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-2">
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="h-7" onClick={() => void copyTicket(item)}><FileText className="mr-2 h-3.5 w-3.5" />Copiar ticket</Button>
                        {canEdit && item.payrollStatus !== 'processed' && <Button variant="outline" size="sm" className="h-7" onClick={() => {
                          setEditingInterventionId(item.id)
                          setNewIntervention({ ...item })
                          setIsAddingNewTech(false)
                          setShowAddEntry(true)
                        }}>Editar ticket</Button>}
                      </div>
                      <div className="flex items-center gap-2 text-[9px] font-black uppercase text-primary/60">
                        <UserIcon className="h-3 w-3" /> 
                        {isDev ? (
                          <div className="flex items-center gap-1">
                            <span className="shrink-0">Autor:</span>
                            <Input 
                              defaultValue={item.authorName} 
                              onBlur={(e) => handleUpdateMetadata('authorName', e.target.value, item.id)}
                              aria-label="Editar autor del reporte"
                              title="Solo Desarrollador puede editar el autor del reporte"
                              className="h-6 text-[9px] font-bold w-32 px-1 border-primary/20"
                            />
                          </div>
                        ) : (
                          `Registrado por: ${item.authorName || 'SISTEMA'}`
                        )}
                      </div>
                      {isAdmin && item.payrollStatus !== 'processed' && (
                        <Button 
                          size="sm" 
                          variant={item.isReadyForPayroll ? "default" : "outline"}
                          className={cn(
                            "h-7 text-[9px] font-black uppercase gap-1 px-3",
                            item.isReadyForPayroll ? "bg-green-600 hover:bg-green-700" : "border-primary text-primary"
                          )}
                          onClick={() => handleTogglePayrollReady(item.id)}
                        >
                          {item.isReadyForPayroll ? <CircleCheck className="h-3 w-3" /> : <Calculator className="h-3 w-3" />}
                          {item.isReadyForPayroll ? "HABILITADO PARA NÓMINA" : "HABILITAR PARA NÓMINA"}
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-4">
                    <p className="text-sm font-medium italic border-l-4 border-primary/20 pl-4">"{item.notes}"</p>
                    {(item.costLines || []).length > 0 && (
                      <div className="grid gap-3 md:grid-cols-2">
                        {(["approved", "pending"] as const).map(status => {
                          const lines = (item.costLines || []).filter(line => line.authorizationStatus === status)
                          if (!lines.length) return null
                          const tariffLines = lines.filter(line => !line.isOutOfTariff)
                          const otherLines = lines.filter(line => line.isOutOfTariff)
                          return <div key={status} className="rounded-lg border p-3">
                            <p className="mb-2 text-xs font-semibold">{status === "approved" ? "Costos aprobados" : "Por autorizar"}</p>
                            {tariffLines.map(line => <div key={line.id} className="flex justify-between gap-3 border-t py-1 text-xs"><span>{line.costCode && <strong className="mr-1 font-mono text-primary">{line.costCode}</strong>}{line.description} · {line.quantity} {line.unit}</span><span>${line.total.toLocaleString('es-CO')}</span></div>)}
                            {otherLines.length > 0 && <p className="border-t pt-2 text-[10px] font-bold uppercase text-[#f36f3d]">Otros costos</p>}
                            {otherLines.map(line => <div key={line.id} className="flex justify-between gap-3 border-t border-dashed py-1 text-xs"><span>{line.description} · {line.quantity} {line.unit}</span><span>${line.total.toLocaleString('es-CO')}</span></div>)}
                            <p className="border-t pt-2 text-right text-xs font-bold">Total: ${lines.reduce((sum, line) => sum + line.total, 0).toLocaleString('es-CO')}</p>
                          </div>
                        })}
                      </div>
                    )}
                    
                    {(item.usedRotomartillo || item.usedGeofono || item.usedPlanchaTermofusion || (item.detailedExpenses || []).length > 0) && (
                      <div className="bg-slate-50 p-3 rounded-lg border border-dashed grid gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                          <p className="text-[9px] font-black uppercase text-muted-foreground flex items-center gap-1"><Wrench className="h-3 w-3" /> Equipos y Gastos</p>
                          <div className="flex flex-wrap gap-2">
                            {item.usedRotomartillo && <Badge variant="outline" className="bg-white text-[8px] font-bold">ROTOMARTILLO</Badge>}
                            {item.usedGeofono && <Badge variant="outline" className="bg-white text-[8px] font-bold">GEÓFONO</Badge>}
                            {item.usedPlanchaTermofusion && <Badge variant="outline" className="bg-white text-[8px] font-bold uppercase">PLANCHA TERMO FUSIÓN</Badge>}
                            {(item.detailedExpenses || []).map((ex, i) => (
                              <Badge key={i} variant="outline" className={cn("bg-white text-[8px] font-bold", ex.isUnused && "border-orange-200 text-orange-600")}>
                                {ex.description} (${ex.amount.toLocaleString()})
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div className="text-right flex flex-col justify-center">
                          <p className="text-[9px] font-black uppercase text-slate-400">Bruto Reportado</p>
                          <p className="text-lg font-black text-primary">${item.reportedValue.toLocaleString()}</p>
                        </div>
                      </div>
                    )}

                    {item.authorizedByAdvisor && (
                      <p className="text-[9px] font-black uppercase text-blue-600 bg-blue-50 w-fit px-2 py-0.5 rounded border border-blue-100 flex items-center gap-1">
                        <ShieldCheck className="h-3 w-3" /> AUTORIZÓ CABINA: {item.authorizedByAdvisor}
                      </p>
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
              <div className="p-4 bg-white rounded-xl border border-dashed text-xs space-y-3 shadow-inner">
                <div className="flex items-center gap-2 text-slate-500">
                  <Info className="h-4 w-4" />
                  <span>Los alquileres de maquinaria se descuentan automáticamente de la base antes del 50%.</span>
                </div>
                <div className="flex items-center gap-2 text-orange-600 font-bold">
                  <PackageCheck className="h-4 w-4" />
                  <span>Materiales marcados como "Stock" no suman costo al servicio pero restan inventario.</span>
                </div>
                <div className="flex items-center gap-2 text-primary font-bold">
                  <Calculator className="h-4 w-4" />
                  <span>Usa "Habilitar para Nómina" para pagar reportes antes de conciliar la factura global.</span>
                </div>
              </div>

              <div className="pt-4 space-y-2 border-t font-mono">
                <p className="text-[10px] font-black uppercase text-muted-foreground text-center">Resumen Financiero del Expediente</p>
                <div className="p-4 bg-primary text-white rounded-xl shadow-lg space-y-2">
                  <div className="flex justify-between text-[10px] font-bold opacity-80 uppercase">
                    <span>Bruto Reportado:</span>
                    <span>${interventions.reduce((s,i) => s + i.reportedValue, 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-bold opacity-80 uppercase">
                    <span>Total Visitas:</span>
                    <span>${(interventions.filter(i => i.isSimpleVisit).length * VISIT_FEE).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-bold opacity-80 uppercase text-orange-200">
                    <span>Adelantos Téc:</span>
                    <span>-${advances.reduce((s,a) => s + a.amount, 0).toLocaleString()}</span>
                  </div>
                  <div className="pt-2 border-t border-white/20 flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase">Por Cobrar:</span>
                    <span className="text-xl font-black">
                      ${(
                        interventions.reduce((s,i) => s + i.reportedValue + (i.isSimpleVisit ? VISIT_FEE : 0), 0)
                      ).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
