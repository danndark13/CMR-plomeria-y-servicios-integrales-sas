
"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { 
  ClipboardList, 
  Clock, 
  CheckCircle2, 
  CalendarDays,
  ArrowUpRight,
  MapPin,
  User,
  AlertCircle,
  BellRing,
  AlertTriangle,
  Calculator,
  ArrowRight,
  History,
  Plus,
  Loader2,
  Save,
  Building2,
  Phone,
  FileText
} from "lucide-react"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { MOCK_REQUESTS, MOCK_COMPANIES, MOCK_TECHNICIANS, MOCK_REMINDERS } from "@/lib/mock-data"
import { StatusBadge } from "@/components/crm/status-badge"
import { CategoryIcon } from "@/components/crm/category-icon"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase'
import { collection, doc, addDoc, setDoc, updateDoc, runTransaction } from 'firebase/firestore'
import { toast } from "@/hooks/use-toast"
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'
import { cn } from "@/lib/utils"
import { ScheduledVisit, ServiceRequest, TechnicianIntervention } from "@/lib/types"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type AppointmentRow = { request: ServiceRequest; visit: ScheduledVisit }
const VISIT_FEE = 20000

export default function DashboardPage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const [activeReminder, setActiveReminder] = useState<AppointmentRow | null>(null)
  const [isReminderAudioBlocked, setIsReminderAudioBlocked] = useState(false)
  const reminderAudioRef = useRef<HTMLAudioElement | null>(null)
  
  // States for dynamic account selection
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("")
  const [selectedAccountName, setSelectedAccountName] = useState<string>("")
  const [isAddingNewAccount, setIsAddingNewAccount] = useState(false)
  
  const { user, isUserLoading } = useUser()
  const db = useFirestore()

  const profileRef = useMemoFirebase(() => {
    if (!user || !db) return null
    return doc(db, 'user_profiles', user.uid)
  }, [user, db])
  const { data: profile } = useDoc(profileRef)

  const requestsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return collection(db, "service_requests")
  }, [db, user])
  const { data: firestoreRequests } = useCollection(requestsQuery)

  const companiesQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return collection(db, "assistance_companies")
  }, [db, user])
  const { data: firestoreCompanies } = useCollection(companiesQuery)

  const clientAccountsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return collection(db, "client_accounts")
  }, [db, user])
  const { data: firestoreAccounts } = useCollection(clientAccountsQuery)
  const usersQuery = useMemoFirebase(() => db && user ? collection(db, "user_profiles") : null, [db, user])
  const { data: firestoreUsers } = useCollection(usersQuery)

  const isTech = profile?.roleId === 'Técnico'
  const isAdmin = profile?.roleId === 'Administrador' || profile?.roleId === 'Gerente'
  const allRequests = useMemo(() => {
    const combined = [...(firestoreRequests || [])]
    const seenIds = new Set(combined.map(r => r.id))
    const seenClaims = new Set(combined.map(r => r.claimNumber?.toUpperCase()))

    for (const mock of MOCK_REQUESTS) {
      const mockClaim = mock.claimNumber?.toUpperCase()
      if (!seenIds.has(mock.id) && !seenClaims.has(mockClaim)) {
        combined.push(mock)
        seenIds.add(mock.id)
        seenClaims.add(mockClaim)
      }
    }

    if (isTech && profile) {
      return combined.filter(req =>
        req.interventions?.some((intervention: any) => intervention.technicianId === profile.username) ||
        req.scheduledVisit?.technicianId === profile.username ||
        req.scheduledVisits?.some((visit: ScheduledVisit) => visit.technicianId === profile.username)
      )
    }

    return combined
  }, [firestoreRequests, isTech, profile])

  const appointmentRows = useMemo(() => (allRequests || [])
    .filter((request: ServiceRequest) => request.status !== "completed" && request.status !== "cancelled")
    .flatMap((request: ServiceRequest) => (request.scheduledVisits || (request.scheduledVisit ? [request.scheduledVisit] : []))
      .map(visit => ({ request, visit })))
    .sort((a, b) => new Date(a.visit.date).getTime() - new Date(b.visit.date).getTime()), [allRequests])

  const hasVisitReport = (request: ServiceRequest, visit: ScheduledVisit) =>
    (request.interventions || []).some(intervention =>
      visit.id ? intervention.scheduledVisitId === visit.id : new Date(intervention.date).getTime() >= new Date(visit.createdAt).getTime()
    )
  const visibleAppointmentRows = appointmentRows.filter(({ request, visit }) => !hasVisitReport(request, visit))
  const scheduledRows = visibleAppointmentRows.filter(({ visit }) => now.getTime() < new Date(visit.date).getTime())
  const inProgressRows = visibleAppointmentRows.filter(({ visit }) => {
    const startsAt = new Date(visit.date).getTime()
    return now.getTime() >= startsAt && now.getTime() < startsAt + 30 * 60 * 1000
  })
  const reportPendingRows = visibleAppointmentRows.filter(({ visit }) =>
    now.getTime() >= new Date(visit.date).getTime() + 30 * 60 * 1000
  )
  const unassignedRows = visibleAppointmentRows.filter(({ visit }) => !visit.technicianId)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 10000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (activeReminder) return
    const reminder = appointmentRows.find(({ request, visit }) => {
      if (!visit.technicianId || hasVisitReport(request, visit) || visit.arrivedAt) return false
      const snoozedUntil = visit.snoozedUntil ? new Date(visit.snoozedUntil).getTime() : 0
      return now.getTime() >= new Date(visit.date).getTime() - 5 * 60 * 1000 && now.getTime() >= snoozedUntil
    })
    if (!reminder) return
    setActiveReminder(reminder)
    const audio = reminderAudioRef.current
    if (!audio) return
    audio.loop = true
    audio.currentTime = 0
    audio.play()
      .then(() => setIsReminderAudioBlocked(false))
      .catch(error => {
        console.error("Dashboard reminder audio playback failed:", error)
        setIsReminderAudioBlocked(true)
      })
  }, [activeReminder, appointmentRows, now])

  useEffect(() => {
    setMounted(true)
  }, [])

  const allCompanies = useMemo(() => {
    return (firestoreCompanies && firestoreCompanies.length > 0) ? firestoreCompanies : MOCK_COMPANIES
  }, [firestoreCompanies])

  const technicians = useMemo(() => {
    const unique = new Map<string, { id: string; name: string }>()
    ;(firestoreUsers || []).filter(person => person.roleId === "Técnico").forEach(person => {
      const id = (person.username || person.id).toUpperCase().trim()
      unique.set(id, { id, name: `${person.firstName || ""} ${person.lastName || ""}`.trim() || id })
    })
    MOCK_TECHNICIANS.forEach(person => {
      const id = person.id.toUpperCase().trim()
      if (!unique.has(id)) unique.set(id, { id, name: person.name })
    })
    return Array.from(unique.values())
  }, [firestoreUsers])

  const getTechnicianName = (id?: string) => technicians.find(person => person.id === id?.toUpperCase().trim())?.name || id || "Sin asignar"
  const getAssistanceName = (request: ServiceRequest) => allCompanies.find(company => company.id === request.companyId)?.name || request.companyId || "Sin asistencia"

  const updateVisit = async (
    row: AppointmentRow,
    updates: Partial<ScheduledVisit>,
    intervention?: TechnicianIntervention
  ): Promise<boolean> => {
    if (!db || !firestoreRequests?.some(request => request.id === row.request.id)) {
      toast({ variant: "destructive", title: "No se pudo guardar el cambio de la cita" })
      return false
    }
    const requestRef = doc(db, "service_requests", row.request.id)
    try {
      await runTransaction(db, async transaction => {
        const snapshot = await transaction.get(requestRef)
        if (!snapshot.exists()) throw new Error("El expediente ya no existe.")
        const currentRequest = { ...snapshot.data(), id: snapshot.id } as ServiceRequest
        const visits = (currentRequest.scheduledVisits || [currentRequest.scheduledVisit].filter((visit): visit is ScheduledVisit => !!visit))
        if (!visits.some(visit => visit.id === row.visit.id)) throw new Error("La visita ya no existe en el expediente.")
        const updatedVisits = visits.map(visit => visit.id === row.visit.id
          ? { ...visit, ...updates, ...(visit.arrivedAt ? { arrivedAt: visit.arrivedAt } : {}) }
          : visit)
        const latest = updatedVisits.find(visit => visit.id === currentRequest.scheduledVisit?.id)
        const hasIntervention = (currentRequest.interventions || []).some(item => item.scheduledVisitId === row.visit.id)
        transaction.update(requestRef, {
          scheduledVisits: updatedVisits,
          ...(latest ? { scheduledVisit: latest } : {}),
          ...(intervention && !hasIntervention ? { interventions: [...(currentRequest.interventions || []), intervention] } : {}),
          updatedAt: new Date().toISOString()
        })
      })
      return true
    } catch (error) {
      console.error("Updating scheduled visit failed:", error)
      toast({
        variant: "destructive",
        title: "No se pudo actualizar la cita",
        description: error instanceof Error ? error.message : "Verifica los permisos y la conexión con Firestore."
      })
      return false
    }
  }

  const handleReminderAction = async (arrived: boolean) => {
    if (!activeReminder) return
    const nowIso = new Date().toISOString()
    const visitIntervention: TechnicianIntervention | undefined = arrived && activeReminder.visit.technicianId &&
      !hasVisitReport(activeReminder.request, activeReminder.visit)
      ? {
          id: `VISITA-${activeReminder.visit.id}`,
          title: `Visita ${activeReminder.visit.subservice || activeReminder.request.category}`,
          technicianId: activeReminder.visit.technicianId,
          type: "Visita Programada",
          subservice: activeReminder.visit.subservice || activeReminder.request.serviceSubservice || "",
          scheduledVisitId: activeReminder.visit.id,
          date: nowIso,
          notes: "Visita marcada en sitio. Tarifa base de visita registrada para nómina.",
          reportedValue: 0,
          laborCost: 0,
          usedRotomartillo: false,
          usedGeofono: false,
          usedPlanchaTermofusion: false,
          detailedExpenses: [],
          costLines: [],
          authorName: profile?.firstName || "SISTEMA",
          payrollStatus: "pending",
          isReadyForPayroll: true,
          isPayrollExcluded: false,
          isSimpleVisit: true
        }
      : undefined
    const saved = await updateVisit(activeReminder, arrived
      ? { arrivedAt: nowIso }
      : { snoozedUntil: new Date(Date.now() + 15 * 60 * 1000).toISOString() }, visitIntervention)
    if (saved) {
      const audio = reminderAudioRef.current
      audio?.pause()
      if (audio) audio.currentTime = 0
      setIsReminderAudioBlocked(false)
      setActiveReminder(null)
      if (visitIntervention) {
        toast({ title: "Visita registrada para nómina", description: `Se agregó la tarifa base de $${VISIT_FEE.toLocaleString("es-CO")} al expediente.` })
      }
    }
  }

  const copyDashboardTicket = async (row: AppointmentRow) => {
    const { request, visit } = row
    const ticket = [
      `Expediente: ${request.claimNumber}`,
      `Hora y fecha: ${new Date(visit.date).toLocaleString("es-CO")}`,
      `Dirección: ${request.address}`,
      `Ciudad: ${request.city}`,
      `Cuenta: ${getAssistanceName(request)} / ${request.accountName}`,
      `Técnico asignado: ${getTechnicianName(visit.technicianId)}`,
      `Servicio: ${request.category}`,
      `Subservicio: ${visit.subservice || request.serviceSubservice || "Pendiente"}`,
      `Qué reportan: ${request.description}`
    ].join("\n")
    try {
      await navigator.clipboard.writeText(ticket)
      toast({ title: "Ticket copiado" })
    } catch {
      toast({ variant: "destructive", title: "No se pudo copiar el ticket", description: "Verifica los permisos del navegador." })
    }
  }

  const currentCompany = useMemo(() => {
    return allCompanies.find(c => c.id === selectedCompanyId)
  }, [allCompanies, selectedCompanyId])

  const availableAccounts = useMemo(() => {
    if (!selectedCompanyId) return []
    
    const mockAccounts = currentCompany?.accounts || []
    const dbAccounts = (firestoreAccounts || [])
      .filter(acc => acc.assistanceCompanyId === selectedCompanyId)
      .map(acc => acc.name)
    
    return Array.from(new Set([...mockAccounts, ...dbAccounts])).sort()
  }, [selectedCompanyId, currentCompany, firestoreAccounts])

  if (!mounted || isUserLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="h-16 w-16 rounded-2xl bg-white shadow-xl flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary opacity-40" />
        </div>
        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Cargando Panel Operativo...</p>
      </div>
    )
  }

  const handleCreateService = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db || !user) return

    setIsProcessing(true)
    const formData = new FormData(e.currentTarget)
    
    let finalAccountName = selectedAccountName
    if (isAddingNewAccount) {
      finalAccountName = (formData.get("newAccountName") as string || "").toUpperCase().trim()
      
      if (finalAccountName && selectedCompanyId) {
        const newAccId = Math.random().toString(36).substring(7).toUpperCase()
        const newAccRef = doc(db, "client_accounts", newAccId)
        setDoc(newAccRef, {
          id: newAccId,
          name: finalAccountName,
          assistanceCompanyId: selectedCompanyId,
          createdAt: new Date().toISOString()
        }).catch(err => console.error("Error saving new account:", err))
      }
    }

    const newService = {
      claimNumber: (formData.get("claimNumber") as string).toUpperCase(),
      folio: Math.max(0, Number(formData.get("folio")) || 0),
      category: formData.get("category") as string,
      companyId: selectedCompanyId,
      accountName: finalAccountName,
      insuredName: (formData.get("insuredName") as string).toUpperCase(),
      address: (formData.get("address") as string).toUpperCase(),
      city: (formData.get("city") as string).toUpperCase(),
      phoneNumber: formData.get("phoneNumber") as string,
      description: formData.get("description") as string,
      status: 'pending',
      interventions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: user.uid,
      billingStatus: 'pending'
    }

    const colRef = collection(db, "service_requests")
    addDoc(colRef, newService)
      .then((docRef) => {
        toast({ title: "Servicio Creado", description: `El expediente ${newService.claimNumber} ha sido registrado.` })
        setIsCreating(false)
        router.push(`/requests/${docRef.id}`)
      })
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: colRef.path,
          operation: "create",
          requestResourceData: newService,
        })
        errorEmitter.emit("permission-error", permissionError)
      })
      .finally(() => setIsProcessing(false))
  }

  const todayStr = new Date().toLocaleDateString()
  const todayVisits = allRequests.flatMap((req: ServiceRequest) => 
    (req.interventions || [])
      .filter((i: any) => new Date(i.date).toLocaleDateString() === todayStr && (isTech ? i.technicianId === profile?.username : true))
      .map((i: any) => ({ ...i, request: req }))
  ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  const canCreate = isAdmin || profile?.roleId === 'Servicio al Cliente'

  if (isTech) {
    return (
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-primary uppercase">Mi Panel Técnico</h1>
          <p className="text-muted-foreground font-medium">Gestiona tus servicios asignados y agenda diaria.</p>
        </div>

        <div className="grid gap-8 lg:grid-cols-12">
          <Card className="lg:col-span-7 border-accent/20 bg-accent/5 shadow-sm overflow-hidden">
            <CardHeader className="bg-accent/10 border-b">
              <CardTitle className="text-lg flex items-center gap-2 text-accent-foreground font-black uppercase">
                <CalendarDays className="h-5 w-5 text-accent" /> Mi Agenda Hoy
              </CardTitle>
              <CardDescription className="text-accent-foreground/70 font-bold uppercase text-[10px]">Visitas programadas para el día de hoy.</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                {todayVisits.length > 0 ? (
                  todayVisits.map((visit) => (
                    <div key={`${visit.id}-${visit.request.id}`} className="p-4 bg-white rounded-xl border border-accent/20 shadow-sm space-y-3 group hover:border-accent transition-all">
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded uppercase">{visit.request.claimNumber}</span>
                        <span className="text-xs font-mono font-black text-accent">
                          {new Date(visit.date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-black uppercase text-slate-700">{visit.request.insuredName}</p>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1 mt-1">
                          <MapPin className="h-3 w-3" /> {visit.request.address} • {visit.request.city}
                        </p>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-dashed">
                         <StatusBadge status={visit.request.status} />
                         <Link href={`/requests/${visit.request.id}`}>
                           <Button size="sm" className="h-8 text-[10px] bg-accent hover:bg-accent/90 font-black uppercase">Iniciar Reporte</Button>
                         </Link>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-20 text-center text-muted-foreground">
                    <CalendarDays className="h-12 w-12 mx-auto opacity-10 mb-4" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Sin servicios para hoy</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-5 shadow-sm border-l-4 border-l-primary">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2 font-black uppercase">
                <History className="h-5 w-5 text-primary" /> Mis Últimos 4 Servicios
              </CardTitle>
              <CardDescription className="font-bold uppercase text-[10px]">Historial reciente de intervenciones.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {allRequests.slice(0, 4).map((req) => (
                  <Link href={`/requests/${req.id}`} key={req.id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-muted/50 transition-colors group border border-transparent hover:border-primary/10">
                    <div className="h-10 w-10 shrink-0 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                      <CategoryIcon category={req.category} className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black truncate text-primary uppercase">{req.claimNumber}</p>
                      <p className="text-[9px] text-muted-foreground font-bold uppercase truncate">{req.insuredName}</p>
                    </div>
                    <StatusBadge status={req.status} />
                  </Link>
                ))}
                <Link href="/requests">
                  <Button variant="ghost" className="w-full mt-4 text-[10px] font-black uppercase gap-2 hover:text-primary">
                    Ver Bitácora Completa <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-primary uppercase">Panel Principal</h1>
          <p className="text-muted-foreground font-medium">Control de servicios, alertas técnicas y agenda diaria.</p>
        </div>
        <div className="flex gap-2">
          {canCreate && (
            <Button className="gap-2 shadow-lg h-12 font-black bg-primary hover:bg-primary/90" onClick={() => setIsCreating(true)}>
              <Plus className="h-5 w-5" /> APERTURA DE EXPEDIENTE
            </Button>
          )}
          <Link href="/calendar">
            <Button variant="outline" className="gap-2 border-primary text-primary hover:bg-primary/5 h-12 font-bold">
              <CalendarDays className="h-4 w-4" /> Calendario
            </Button>
          </Link>
        </div>
      </div>

      <section className="space-y-4" aria-label="Agenda operativa">
        <div className="grid grid-cols-2 gap-5 rounded-xl border border-[#e7e7e7] bg-white p-5 shadow-sm lg:grid-cols-4">
          {[
            { label: "Servicios", detail: "Programados", value: scheduledRows.length, color: "#f36f3d" },
            { label: "Servicios", detail: "En curso", value: inProgressRows.length, color: "#b6b6b6" },
            { label: "Alertas", detail: "Falta reporte", value: reportPendingRows.length, color: "#a4b342", alert: reportPendingRows.length > 0 },
            { label: "Alertas", detail: "Sin técnico", value: unassignedRows.length, color: "#f36f3d", alert: unassignedRows.length > 0 }
          ].map(metric => (
            <div key={metric.detail} className="flex flex-col items-center justify-center gap-3 py-2 text-center">
              <div className="flex h-28 w-28 items-center justify-center rounded-full border-[7px] bg-white p-1 shadow-[0_0_0_2px_white,0_0_0_3px_#e7e7e7]" style={{ borderColor: metric.alert ? "#e94747" : metric.color }}>
                <div className="flex h-full w-full flex-col items-center justify-center rounded-full border border-[#ededed]">
                  <span className={cn("text-3xl font-light leading-none", metric.alert && "text-[#e94747]")} style={!metric.alert ? { color: metric.color } : undefined}>{metric.value}</span>
                  <span className="mt-1 max-w-20 text-[9px] font-bold uppercase leading-tight text-[#5d5d5d]">{metric.label}</span>
                  <span className="max-w-20 text-[9px] uppercase leading-tight text-[#858585]">{metric.detail}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Servicios programados, en curso y sin reporte</CardTitle>
            <CardDescription>PR antes de la cita; EC durante los primeros 30 minutos; SR si pasan 30 minutos sin reporte. Los reportes registrados salen de esta lista.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>ES.</TableHead><TableHead>Técnico</TableHead><TableHead>Programación</TableHead><TableHead>Expediente</TableHead><TableHead>Dirección</TableHead><TableHead>Cliente / asistencia</TableHead><TableHead>Ticket</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {visibleAppointmentRows.map(row => {
                    const startsAt = new Date(row.visit.date).getTime()
                    const overdue = now.getTime() >= startsAt + 30 * 60 * 1000
                    const status = now.getTime() < startsAt ? "PR" : overdue ? "SR" : "EC"
                    return (
                      <TableRow
                        key={`${row.request.id}-${row.visit.id}`}
                        onClick={() => router.push(`/requests/${row.request.id}`)}
                        className={cn("cursor-pointer", status === "SR" && "border-l-4 border-l-destructive bg-red-100")}
                      >
                        <TableCell><Badge variant={status === "EC" ? "default" : status === "SR" ? "destructive" : "secondary"}>{status}</Badge></TableCell>
                        <TableCell onClick={event => event.stopPropagation()}>
                          {row.visit.technicianId ? <span className="font-medium">{getTechnicianName(row.visit.technicianId)}</span> : (
                            <Select onValueChange={async technicianId => {
                              if (await updateVisit(row, { technicianId })) {
                                toast({ title: "Técnico asignado", description: getTechnicianName(technicianId) })
                              }
                            }}>
                              <SelectTrigger className="h-8 w-36"><SelectValue placeholder="Asignar" /></SelectTrigger>
                              <SelectContent>{technicians.map(tech => <SelectItem key={tech.id} value={tech.id}>{tech.name}</SelectItem>)}</SelectContent>
                            </Select>
                          )}
                        </TableCell>
                        <TableCell><span className="whitespace-nowrap">{new Date(row.visit.date).toLocaleString("es-CO", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}</span></TableCell>
                        <TableCell className="font-semibold">{row.request.claimNumber}</TableCell>
                        <TableCell className="max-w-56 truncate">{row.request.address}</TableCell>
                        <TableCell className="max-w-52">
                          <div className="flex flex-col"><span className="truncate font-medium">{getAssistanceName(row.request)}</span><span className="truncate text-xs text-muted-foreground">{row.request.accountName}</span></div>
                        </TableCell>
                        <TableCell onClick={event => event.stopPropagation()}>
                          <div className="flex items-center gap-1.5">
                            <Button variant="outline" size="sm" onClick={() => void copyDashboardTicket(row)}>Copiar ticket</Button>
                            {!row.visit.arrivedAt && row.visit.technicianId && (
                              <Button
                                size="sm"
                                variant="secondary"
                                className="font-bold text-xs"
                                onClick={async () => {
                                  const techId = row.visit.technicianId
                                  if (!techId) return
                                  const nowIso = new Date().toISOString()
                                  const visitIntervention: TechnicianIntervention | undefined = !hasVisitReport(row.request, row.visit)
                                    ? {
                                        id: `VISITA-${row.visit.id}`,
                                        title: `Visita ${row.visit.subservice || row.request.category}`,
                                        technicianId: techId,
                                        type: "Visita Programada",
                                        subservice: row.visit.subservice || row.request.serviceSubservice || "",
                                        scheduledVisitId: row.visit.id,
                                        date: nowIso,
                                        notes: "Visita marcada en sitio. Tarifa base de visita registrada para nómina.",
                                        reportedValue: 0,
                                        laborCost: 0,
                                        usedRotomartillo: false,
                                        usedGeofono: false,
                                        usedPlanchaTermofusion: false,
                                        detailedExpenses: [],
                                        costLines: [],
                                        authorName: profile?.firstName || "SISTEMA",
                                        payrollStatus: "pending",
                                        isReadyForPayroll: true,
                                        isPayrollExcluded: false,
                                        isSimpleVisit: true
                                      }
                                    : undefined
                                  const saved = await updateVisit(row, { arrivedAt: nowIso }, visitIntervention)
                                  if (saved) {
                                    toast({ title: "Visita marcada en sitio", description: "Se registró para nómina con tarifa base de $20.000." })
                                  }
                                }}
                              >
                                En sitio
                              </Button>
                            )}
                          </div>
                          {row.visit.arrivedAt && <span className="block mt-1 text-[9px] font-bold text-emerald-600">En sitio: {new Date(row.visit.arrivedAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>}
                          {status !== "PR" && <p className="mt-1 text-[10px] font-semibold text-destructive">{overdue ? "Falta reporte · más de 30 min" : "Falta reporte"}</p>}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  {visibleAppointmentRows.length === 0 && <TableRow><TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">No hay servicios programados ni en curso.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-destructive/20 bg-destructive/5 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-destructive font-black uppercase">
              <AlertTriangle className="h-5 w-5" /> Sobrecarga Técnica
            </CardTitle>
            <CardDescription className="text-destructive/70 font-bold uppercase text-[10px]">Técnicos con exceso de tareas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {MOCK_TECHNICIANS.filter(t => t.activeTasks > 3).map((tech) => (
              <div key={tech.id} className="p-3 bg-white rounded-lg border border-destructive/20 flex justify-between items-center shadow-sm">
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-slate-800 uppercase">{tech.name}</span>
                  <span className="text-[9px] text-muted-foreground font-black uppercase">{tech.specialties.slice(0,2).join(" • ")}</span>
                </div>
                <Badge variant="destructive" className="h-6 px-2 animate-pulse font-black text-[10px]">
                  {tech.activeTasks} ACTIVOS
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-accent/20 bg-accent/5 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-accent-foreground font-black uppercase">
              <CalendarDays className="h-5 w-5 text-accent" /> Servicios Hoy
            </CardTitle>
            <CardDescription className="text-accent-foreground/70 font-bold uppercase text-[10px]">Visitas técnicas agendadas.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {todayVisits.length > 0 ? (
                todayVisits.slice(0, 4).map((visit) => {
                  const tech = MOCK_TECHNICIANS.find(t => t.id === visit.technicianId)
                  return (
                    <div key={`${visit.id}-${visit.request.id}`} className="p-3 bg-white rounded-lg border border-accent/20 shadow-sm space-y-2 group hover:border-accent transition-colors">
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded uppercase">{visit.request.claimNumber}</span>
                        <span className="text-xs font-mono font-black text-accent">
                          {new Date(visit.date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-sm font-black truncate uppercase text-slate-700">{visit.request.insuredName}</p>
                      <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground uppercase">
                         <div className="flex items-center gap-1"><User className="h-3 w-3" /> {tech?.name || getTechnicianName(visit.technicianId)}</div>
                         <Link href={`/requests/${visit.request.id}`}>
                           <Button variant="ghost" size="sm" className="h-6 text-[9px] text-accent font-black hover:bg-accent/10 uppercase">Ver Detalle</Button>
                         </Link>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="py-12 text-center text-muted-foreground text-[10px] font-bold uppercase italic">
                  Sin visitas agendadas para hoy.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-l-4 border-l-primary">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 font-black uppercase">
              <History className="h-5 w-5 text-primary" /> Últimos Ingresos
            </CardTitle>
            <CardDescription className="font-bold uppercase text-[10px]">Expedientes recientes.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {allRequests.slice(0, 5).map((req) => {
                const companyName = allCompanies.find(c => c.id === req.companyId)?.name || "Asistencia"
                return (
                  <Link href={`/requests/${req.id}`} key={req.id} className="flex items-center gap-4 p-2 rounded-lg hover:bg-muted/50 transition-colors group">
                    <div className="h-9 w-9 shrink-0 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                      <CategoryIcon category={req.category} className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black truncate text-primary uppercase">{req.claimNumber}</p>
                      <p className="text-[9px] text-muted-foreground font-bold uppercase truncate">{companyName} • {req.accountName}</p>
                    </div>
                    <StatusBadge status={req.status} />
                  </Link>
                )
              })}
              <Link href="/requests">
                <Button variant="ghost" size="sm" className="w-full mt-2 text-[10px] font-black uppercase gap-2 hover:text-primary">
                  Ver Bitácora Completa <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      <audio ref={reminderAudioRef} src="/audio/tono-alarma-nuclear.mp3" preload="auto" />
      <Dialog open={!!activeReminder} onOpenChange={open => { if (!open) void handleReminderAction(false) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recordatorio de llegada</DialogTitle>
            <DialogDescription>La visita está próxima. Confirma el estado para programar el seguimiento del reporte.</DialogDescription>
          </DialogHeader>
          {activeReminder && (
            <div className="space-y-2 rounded-lg border bg-muted/20 p-4">
              <p className="text-sm"><span className="font-semibold">Técnico:</span> {getTechnicianName(activeReminder.visit.technicianId)}</p>
              <p className="text-sm"><span className="font-semibold">Expediente:</span> {activeReminder.request.claimNumber}</p>
              <p className="text-sm"><span className="font-semibold">Programado:</span> {new Date(activeReminder.visit.date).toLocaleString("es-CO")}</p>
              {isReminderAudioBlocked && (
                <Button type="button" variant="outline" className="mt-2" onClick={() => {
                  const audio = reminderAudioRef.current
                  if (!audio) return
                  audio.loop = true
                  audio.currentTime = 0
                  audio.play()
                    .then(() => setIsReminderAudioBlocked(false))
                    .catch(error => {
                      console.error("Dashboard reminder audio playback failed:", error)
                      toast({ variant: "destructive", title: "No fue posible reproducir la alerta sonora", description: "Revisa el volumen del dispositivo y vuelve a intentarlo." })
                    })
                }}>Activar sonido de alerta</Button>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => void handleReminderAction(false)}>Posponer 15 minutos</Button>
            <Button onClick={() => void handleReminderAction(true)}>En sitio</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCreating} onOpenChange={(open) => {
        setIsCreating(open)
        if (!open) {
          setSelectedCompanyId("")
          setSelectedAccountName("")
          setIsAddingNewAccount(false)
        }
      }}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-primary">Apertura de Expediente</DialogTitle>
            <DialogDescription className="font-bold">Registro de nuevo servicio con selección dinámica de cuentas.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateService} className="space-y-6 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">N° de Expediente / Claim</Label>
                <div className="relative">
                  <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input name="claimNumber" placeholder="EJ: EXP-123456" required className="pl-10 font-mono font-black uppercase h-12 border-primary/20" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">Folio</Label>
                <Input name="folio" type="number" min="0" step="1" defaultValue="0" className="h-12 font-mono border-primary/20" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Categoría de Servicio</Label>
                <Select name="category" required>
                  <SelectTrigger className="font-black uppercase h-12 border-primary/20">
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Plomería">Plomería</SelectItem>
                    <SelectItem value="Electricidad">Electricidad</SelectItem>
                    <SelectItem value="Cerrajería">Cerrajería</SelectItem>
                    <SelectItem value="Vidriería">Vidriería</SelectItem>
                    <SelectItem value="Trabajo en Alturas">Trabajo en Alturas</SelectItem>
                    <SelectItem value="Instalación">Instalación</SelectItem>
                    <SelectItem value="Destaponamiento">Destaponamiento</SelectItem>
                    <SelectItem value="Taponamiento">Taponamiento</SelectItem>
                    <SelectItem value="Impermeabilización">Impermeabilización</SelectItem>
                    <SelectItem value="Garantía">Garantía</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Empresa de Asistencia</Label>
                <Select value={selectedCompanyId} onValueChange={(v) => {
                  setSelectedCompanyId(v)
                  setSelectedAccountName("")
                  setIsAddingNewAccount(false)
                }} required>
                  <SelectTrigger className="font-black uppercase h-12 border-primary/20">
                    <SelectValue placeholder="Seleccionar aliado" />
                  </SelectTrigger>
                  <SelectContent>
                    {allCompanies.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cuenta Cliente</Label>
                <Select 
                  value={isAddingNewAccount ? "NEW" : selectedAccountName} 
                  onValueChange={(v) => {
                    if (v === "NEW") {
                      setIsAddingNewAccount(true)
                      setSelectedAccountName("")
                    } else {
                      setIsAddingNewAccount(false)
                      setSelectedAccountName(v)
                    }
                  }} 
                  disabled={!selectedCompanyId}
                  required={!isAddingNewAccount}
                >
                  <SelectTrigger className="font-black uppercase h-12 border-primary/20">
                    <SelectValue placeholder={selectedCompanyId ? "Seleccionar cuenta" : "Primero elija asistencia"} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableAccounts.map(acc => (
                      <SelectItem key={acc} value={acc}>{acc}</SelectItem>
                    ))}
                    <SelectItem value="NEW" className="font-bold text-primary italic">+ OTRA (Agregar nueva...)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isAddingNewAccount && (
              <div className="space-y-2 animate-in slide-in-from-top-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Nombre de la Nueva Cuenta</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                  <Input 
                    name="newAccountName" 
                    placeholder="Escriba el nombre de la cuenta..." 
                    required 
                    className="pl-10 font-black uppercase h-12 border-primary ring-offset-background"
                  />
                </div>
              </div>
            )}

            <div className="p-4 bg-slate-50 rounded-xl border-2 border-dashed border-primary/10 space-y-4">
               <p className="text-[11px] font-black uppercase text-primary tracking-widest border-b pb-2">Datos del Cliente Final</p>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest">Nombre Completo</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input name="insuredName" placeholder="Juan Perez" required className="pl-10 font-bold uppercase h-10" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest">Teléfono</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input name="phoneNumber" placeholder="310 000 0000" required className="pl-10 font-bold h-10" />
                    </div>
                  </div>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest">Dirección de Visita</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input name="address" placeholder="Calle 1 #2-3" required className="pl-10 font-medium h-10 uppercase" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest">Ciudad</Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input name="city" placeholder="Ej. Bogota" required className="pl-10 font-bold uppercase h-10" />
                    </div>
                  </div>
               </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Descripción de la Solicitud</Label>
              <Textarea name="description" placeholder="Describa el problema reportado..." className="min-h-[80px] font-medium" required />
            </div>

            <DialogFooter className="gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsCreating(false)} disabled={isProcessing} className="font-bold h-12 px-8">CANCELAR</Button>
              <Button type="submit" disabled={isProcessing} className="font-black gap-2 shadow-lg h-12 px-10 bg-primary hover:bg-primary/90 uppercase tracking-widest">
                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} CREAR SERVICIO
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
