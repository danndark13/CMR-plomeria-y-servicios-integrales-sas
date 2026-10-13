"use client"

import { useMemo, useState } from "react"
import { addDays, format, isSameDay, startOfWeek } from "date-fns"
import { es } from "date-fns/locale"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { MOCK_REQUESTS, MOCK_TECHNICIANS, MOCK_COMPANIES } from "@/lib/mock-data"
import { Badge } from "@/components/ui/badge"
import { StatusBadge } from "@/components/crm/status-badge"
import { CategoryIcon } from "@/components/crm/category-icon"
import { Building2, CalendarDays, ChevronLeft, ChevronRight, Clock, Loader2, MapPin, User as UserIcon, Plus, Save, Search, X } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from "@/firebase"
import { collection, doc, updateDoc } from "firebase/firestore"
import { ServiceRequest } from "@/lib/types"
import { cn } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"

type CalendarEvent = {
  id: string
  date: string
  type: string
  technicianId?: string
  subservice?: string
  request: ServiceRequest
  isScheduled: boolean
}

type CalendarView = "week" | "day"

export default function CalendarPage() {
  const [date, setDate] = useState<Date>(new Date())
  const [view, setView] = useState<CalendarView>("week")
  const [showScheduleForm, setShowScheduleForm] = useState(false)
  const [claimQuery, setClaimQuery] = useState("")
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null)
  const [scheduleDate, setScheduleDate] = useState<Date>(new Date())
  const [scheduleTime, setScheduleTime] = useState({ hour: "12", minute: "00", period: "PM" as "AM" | "PM" })
  const [technicianQuery, setTechnicianQuery] = useState("")
  const [technicianId, setTechnicianId] = useState("")
  const [isOtherTechnician, setIsOtherTechnician] = useState(false)
  const [subservice, setSubservice] = useState("")
  const [isSavingSchedule, setIsSavingSchedule] = useState(false)
  const db = useFirestore()
  const { user } = useUser()
  const router = useRouter()
  const profileRef = useMemoFirebase(() => db && user ? doc(db, "user_profiles", user.uid) : null, [db, user])
  const { data: profile } = useDoc(profileRef)

  const requestsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return collection(db, "service_requests")
  }, [db, user])

  const { data: firestoreRequests, isLoading } = useCollection(requestsQuery)
  const usersQuery = useMemoFirebase(() => db && user ? collection(db, "user_profiles") : null, [db, user])
  const { data: allUsers } = useCollection(usersQuery)

  const allRequests = useMemo(() => {
    const combined = [...(firestoreRequests || [])]
    const seen = new Set(combined.map(request => request.claimNumber?.toUpperCase()))
    MOCK_REQUESTS.forEach(request => {
      if (!seen.has(request.claimNumber?.toUpperCase())) combined.push(request as ServiceRequest)
    })
    return combined
  }, [firestoreRequests])

  const events = useMemo<CalendarEvent[]>(() => allRequests.flatMap((request: ServiceRequest) => {
    const interventions: CalendarEvent[] = (request.interventions || []).map(intervention => ({
      id: intervention.id,
      date: intervention.date,
      type: intervention.type,
      technicianId: intervention.technicianId,
      subservice: intervention.subservice,
      request,
      isScheduled: false
    }))
    const visits: CalendarEvent[] = (request.scheduledVisits || (request.scheduledVisit ? [request.scheduledVisit] : [])).map(visit => ({
      id: visit.id,
      date: visit.date,
      type: "Cita programada",
      technicianId: visit.technicianId,
      subservice: visit.subservice,
      request,
      isScheduled: true
    }))
    return [...interventions, ...visits].filter(event => !Number.isNaN(new Date(event.date).getTime()))
  }), [allRequests])

  const weekDates = useMemo(() => {
    const monday = startOfWeek(date, { weekStartsOn: 1 })
    return Array.from({ length: 7 }, (_, index) => addDays(monday, index))
  }, [date])
  const eventsForDate = (day: Date) => events
    .filter(event => isSameDay(new Date(event.date), day))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const eventsForSelectedDay = eventsForDate(date)

  const technicianOptions = useMemo(() => {
    const byId = new Map<string, string>()
    ;(allUsers || []).filter(userProfile => userProfile.roleId === "Técnico").forEach(userProfile => {
      const id = userProfile.username || userProfile.id
      byId.set(id, `${userProfile.firstName} ${userProfile.lastName || ""}`.trim())
    })
    MOCK_TECHNICIANS.forEach(tech => {
      if (![...byId.keys()].some(id => id.toUpperCase() === tech.id.toUpperCase())) byId.set(tech.id, tech.name)
    })
    events.forEach(event => {
      if (event.technicianId && ![...byId.keys()].some(id => id.toUpperCase() === event.technicianId?.toUpperCase())) byId.set(event.technicianId, event.technicianId)
    })
    return Array.from(byId, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [allUsers, events])

  const getTechName = (id?: string) => technicianOptions.find(tech => tech.id === id)?.name || id || "Sin asignar"
  const getCompanyName = (id: string) => MOCK_COMPANIES.find(company => company.id === id)?.name || id || "N/A"
  const shiftRange = (amount: number) => setDate(current => addDays(current, amount * (view === "week" ? 7 : 1)))
  const canSchedule = ["Desarrollador", "Administrador", "Gerente", "Servicio al Cliente", "Técnico"].includes(profile?.roleId || "")
  const matchingRequests = useMemo(() => {
    const query = claimQuery.trim().toLowerCase()
    if (!query) return []
    return allRequests.filter(request => `${request.claimNumber} ${request.insuredName} ${request.address}`.toLowerCase().includes(query)).slice(0, 6)
  }, [allRequests, claimQuery])

  const saveCalendarSchedule = async () => {
    if (!db || !selectedRequest || !firestoreRequests?.some(request => request.id === selectedRequest.id) || !subservice.trim()) {
      toast({ variant: "destructive", title: "Completa la programación", description: "Selecciona un expediente existente en Firestore y escribe el subservicio." })
      return
    }
    const hour = Number(scheduleTime.hour)
    const minute = Number(scheduleTime.minute)
    if (!Number.isInteger(hour) || hour < 1 || hour > 12 || !Number.isInteger(minute) || minute < 0 || minute > 59) {
      toast({ variant: "destructive", title: "Hora inválida", description: "La hora debe estar entre 1 y 12 y los minutos entre 00 y 59." })
      return
    }
    setIsSavingSchedule(true)
    const scheduledAt = new Date(scheduleDate.getFullYear(), scheduleDate.getMonth(), scheduleDate.getDate(), (hour % 12) + (scheduleTime.period === "PM" ? 12 : 0), minute)
    const createdAt = new Date().toISOString()
    const visit = {
      id: crypto.randomUUID(),
      ...(technicianId.trim() ? { technicianId: technicianId.trim() } : {}),
      date: scheduledAt.toISOString(),
      subservice: subservice.trim(),
      createdAt
    }
    const scheduledVisits = [...(selectedRequest.scheduledVisits || (selectedRequest.scheduledVisit ? [selectedRequest.scheduledVisit] : [])), visit]
    const statusHistory = [...(selectedRequest.statusHistory || []), {
      status: "assigned" as const,
      date: createdAt,
      ...(profile?.firstName ? { userName: profile.firstName } : {})
    }]
    try {
      await updateDoc(doc(db, "service_requests", selectedRequest.id), {
        scheduledVisits,
        scheduledVisit: visit,
        serviceSubservice: visit.subservice,
        status: "assigned",
        statusHistory,
        updatedAt: createdAt
      })
      toast({ title: "Cita programada", description: `Expediente ${selectedRequest.claimNumber} · ${format(scheduledAt, "dd/MM/yyyy hh:mm a")}` })
      setShowScheduleForm(false)
      setSelectedRequest(null)
      setClaimQuery("")
      setTechnicianQuery("")
      setTechnicianId("")
      setIsOtherTechnician(false)
      setSubservice("")
    } catch (error) {
      toast({ variant: "destructive", title: "No se pudo programar la cita", description: error instanceof Error ? error.message : "Verifica las reglas y permisos de Firestore." })
    } finally {
      setIsSavingSchedule(false)
    }
  }

  const renderEvent = (event: CalendarEvent) => (
    <Link
      key={`${event.id}-${event.isScheduled ? "visit" : "intervention"}`}
      href={`/requests/${event.request.id}`}
      className={cn(
        "block rounded-lg border p-2.5 transition hover:-translate-y-0.5 hover:shadow-md",
        event.isScheduled
          ? "border-[#a4b342]/40 bg-[#a4b342]/10 hover:border-[#a4b342]"
          : "border-[#5b7db7]/25 bg-[#5b7db7]/10 hover:border-[#5b7db7]"
      )}
    >
      <div className="mb-1 flex items-center justify-between gap-1">
        <span className="font-mono text-[11px] font-bold text-[#263b5a]">{event.request.claimNumber}</span>
        <span className="text-[10px] font-bold text-[#383838]">{format(new Date(event.date), "HH:mm")}</span>
      </div>
      <p className="line-clamp-1 text-xs font-semibold text-[#303030]">{event.request.insuredName}</p>
      <p className="mt-1 line-clamp-1 text-[10px] text-muted-foreground">{event.subservice || event.request.category}</p>
      <div className="mt-2 flex items-center justify-between gap-1">
        <span className="line-clamp-1 text-[10px] text-muted-foreground">{getTechName(event.technicianId)}</span>
        <span className={cn(
          "shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase",
          event.isScheduled ? "bg-[#a4b342]/20 text-[#53611c]" : "bg-[#5b7db7]/15 text-[#365987]"
        )}>{event.isScheduled ? "PR" : "EC"}</span>
      </div>
    </Link>
  )

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 pb-10">
      <header className="flex flex-col gap-3 border-b border-[#e8e8e8] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#f36f3d]">Agenda operativa</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#202020] sm:text-3xl">Calendario</h1>
          <p className="mt-1 text-sm text-muted-foreground">Visitas programadas e intervenciones, de lunes a domingo.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border bg-white p-1">
            <Button size="sm" variant={view === "week" ? "default" : "ghost"} onClick={() => setView("week")} className={cn("h-8 px-3 text-xs", view === "week" && "bg-[#f36f3d] text-white hover:bg-[#e65e2b]")}>Semana</Button>
            <Button size="sm" variant={view === "day" ? "default" : "ghost"} onClick={() => setView("day")} className={cn("h-8 px-3 text-xs", view === "day" && "bg-[#f36f3d] text-white hover:bg-[#e65e2b]")}>Día</Button>
          </div>
          <Button variant="outline" size="sm" onClick={() => setDate(new Date())} className="h-10 border-[#dedede] text-xs">Hoy</Button>
        </div>
      </header>

      {canSchedule && (
        <Card className="overflow-visible border-primary/25 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between border-b">
            <div>
              <CardTitle className="flex items-center gap-2 text-base"><Plus className="h-4 w-4 text-primary" />Programar desde calendario</CardTitle>
              <CardDescription>Busca el expediente, selecciona el día y registra la hora en formato de 12 horas.</CardDescription>
            </div>
            <Button type="button" variant={showScheduleForm ? "outline" : "default"} onClick={() => setShowScheduleForm(value => !value)}>
              {showScheduleForm ? <X className="mr-2 h-4 w-4" /> : <CalendarDays className="mr-2 h-4 w-4" />}{showScheduleForm ? "Cerrar" : "Nueva cita"}
            </Button>
          </CardHeader>
          {showScheduleForm && (
            <CardContent className="grid gap-4 pt-5 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="calendar-claim">Expediente</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="calendar-claim" value={claimQuery} onChange={event => { setClaimQuery(event.target.value); setSelectedRequest(null) }} placeholder="Escribe expediente o nombre del usuario..." className="pl-9" />
                  {matchingRequests.length > 0 && !selectedRequest && (
                    <div className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-white p-1 shadow-lg">
                      {matchingRequests.map(request => <button key={request.id} type="button" className="flex w-full flex-col items-start rounded px-3 py-2 text-left hover:bg-primary/10" onClick={() => { setSelectedRequest(request); setClaimQuery(`${request.claimNumber} · ${request.insuredName}`) }}>
                        <span className="font-semibold">{request.claimNumber} · {request.insuredName}</span><span className="text-xs text-muted-foreground">{request.city} · {request.address}</span>
                      </button>)}
                    </div>
                  )}
                </div>
                {selectedRequest && <p className="text-xs text-green-700">Expediente seleccionado: {selectedRequest.claimNumber}</p>}
              </div>
              <div className="space-y-2">
                <Label>Fecha de la cita</Label>
                <Popover>
                  <PopoverTrigger asChild><Button type="button" variant="outline" className="w-full justify-start text-left font-medium"><CalendarDays className="mr-2 h-4 w-4 text-primary" />{format(scheduleDate, "EEEE d 'de' MMMM yyyy", { locale: es })}</Button></PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={scheduleDate} onSelect={day => day && setScheduleDate(day)} initialFocus weekStartsOn={1} locale={es} /></PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Hora (12 horas)</Label>
                <div className="flex gap-2">
                  <Input aria-label="Hora" type="number" inputMode="numeric" min={1} max={12} value={scheduleTime.hour} onChange={event => setScheduleTime({ ...scheduleTime, hour: event.target.value })} className="w-20" />
                  <span className="flex items-center font-bold">:</span>
                  <Input aria-label="Minutos" type="number" inputMode="numeric" min={0} max={59} value={scheduleTime.minute} onChange={event => setScheduleTime({ ...scheduleTime, minute: event.target.value.padStart(2, "0").slice(-2) })} className="w-20" />
                  <Select value={scheduleTime.period} onValueChange={period => setScheduleTime({ ...scheduleTime, period: period as "AM" | "PM" })}><SelectTrigger className="w-24"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="AM">AM</SelectItem><SelectItem value="PM">PM</SelectItem></SelectContent></Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Técnico asignado</Label>
                <Input value={technicianQuery} onChange={event => { setTechnicianQuery(event.target.value); setTechnicianId(""); setIsOtherTechnician(false) }} placeholder="Escribe para buscar técnico..." />
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant={!technicianId ? "default" : "outline"} onClick={() => { setTechnicianQuery(""); setTechnicianId(""); setIsOtherTechnician(false) }}>Pendiente por asignar</Button>
                  {technicianQuery.trim() && !isOtherTechnician && technicianOptions.filter(tech => `${tech.name} ${tech.id}`.toLowerCase().includes(technicianQuery.toLowerCase())).slice(0, 5).map(tech => <Button key={tech.id} type="button" size="sm" variant="outline" onClick={() => { setTechnicianId(tech.id); setTechnicianQuery(tech.name); setIsOtherTechnician(false) }}>{tech.name}</Button>)}
                  {technicianQuery.trim() && !technicianOptions.some(tech => tech.name.toLowerCase() === technicianQuery.trim().toLowerCase()) && <Button type="button" size="sm" variant={isOtherTechnician ? "default" : "outline"} onClick={() => { setTechnicianId(technicianQuery.trim()); setIsOtherTechnician(true) }}>Otro: crear “{technicianQuery.trim()}”</Button>}
                </div>
                {isOtherTechnician && <p className="text-xs text-muted-foreground">El nombre se guardará como técnico de esta cita.</p>}
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="calendar-subservice">Subservicio</Label>
                <Input id="calendar-subservice" value={subservice} onChange={event => setSubservice(event.target.value)} placeholder="Ej. Instalación de tubería" />
              </div>
              <div className="flex justify-end lg:col-span-2">
                <Button type="button" onClick={saveCalendarSchedule} disabled={isSavingSchedule || isLoading}>{isSavingSchedule ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Guardar programación</Button>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="overflow-hidden border-[#e8e8e8] shadow-sm">
          <CardHeader className="border-b bg-[#171717] px-5 py-4 text-white">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold"><CalendarDays className="h-4 w-4 text-[#f36f3d]" />Elegir fecha</CardTitle>
            <CardDescription className="text-xs text-white/65">Selecciona un día para abrir su agenda.</CardDescription>
          </CardHeader>
          <CardContent className="p-3 sm:p-4">
            <Calendar
              mode="single"
              selected={date}
              onSelect={selected => selected && setDate(selected)}
              weekStartsOn={1}
              locale={es}
              className="mx-auto w-full max-w-[300px] p-1"
            />
            <div className="mt-3 flex items-center justify-center gap-4 border-t pt-3 text-[10px] font-medium text-muted-foreground">
              <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#a4b342]" />Programado</span>
              <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#5b7db7]" />Intervención</span>
            </div>
          </CardContent>
        </Card>

        <section className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold capitalize text-[#242424]">
                {view === "week"
                  ? `${format(weekDates[0], "d MMM", { locale: es })} – ${format(weekDates[6], "d MMM yyyy", { locale: es })}`
                  : format(date, "EEEE d 'de' MMMM yyyy", { locale: es })}
              </h2>
              <p className="text-xs text-muted-foreground">{view === "week" ? "Vista semanal · lunes a domingo" : "Agenda del día seleccionado"}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="border border-[#f36f3d]/25 bg-[#f36f3d]/10 text-[#b94d27] hover:bg-[#f36f3d]/10">
                {view === "week" ? weekDates.reduce((total, day) => total + eventsForDate(day).length, 0) : eventsForSelectedDay.length} eventos
              </Badge>
              <Button variant="outline" size="icon" aria-label="Anterior" onClick={() => shiftRange(-1)} className="h-8 w-8"><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="outline" size="icon" aria-label="Siguiente" onClick={() => shiftRange(1)} className="h-8 w-8"><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>

          {isLoading ? (
            <Card className="flex min-h-[280px] items-center justify-center border-[#e8e8e8]">
              <div className="flex flex-col items-center gap-3 text-muted-foreground"><Loader2 className="h-8 w-8 animate-spin text-[#f36f3d]" /><p className="text-xs">Cargando agenda...</p></div>
            </Card>
          ) : view === "week" ? (
            <div className="overflow-x-auto rounded-xl border border-[#e5e5e5] bg-white shadow-sm">
              <div className="grid min-w-[840px] grid-cols-7 divide-x divide-[#ededed]">
                {weekDates.map(day => {
                  const dayEvents = eventsForDate(day)
                  const isSelected = isSameDay(day, date)
                  return (
                    <div key={day.toISOString()} className="min-h-[390px]">
                      <button type="button" onClick={() => { setDate(day); setView("day") }} className={cn("flex w-full flex-col items-center border-b px-2 py-3 transition hover:bg-[#f8f8f8]", isSelected && "bg-[#fff6f2]")}>
                        <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{format(day, "EEE", { locale: es })}</span>
                        <span className={cn("mt-1 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold", isSelected ? "bg-[#f36f3d] text-white" : "text-[#262626]")}>{format(day, "d")}</span>
                      </button>
                      <div className="space-y-2 p-2">
                        {dayEvents.length ? dayEvents.map(renderEvent) : <p className="pt-5 text-center text-[10px] text-muted-foreground/70">Sin eventos</p>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : eventsForSelectedDay.length ? (
            <div className="space-y-3">
              {eventsForSelectedDay.map(event => (
                <Card key={`${event.id}-${event.isScheduled ? "visit" : "intervention"}`} className="overflow-hidden border-[#e6e6e6] shadow-sm transition hover:shadow-md">
                  <div className={cn("h-1 w-full", event.isScheduled ? "bg-[#a4b342]" : "bg-[#5b7db7]")} />
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                      <div className="flex items-center gap-3 sm:w-36">
                        <Clock className="h-4 w-4 text-[#f36f3d]" />
                        <span className="text-lg font-bold text-[#252525]">{format(new Date(event.date), "HH:mm")}</span>
                        <Badge className={cn("text-[9px] text-white", event.isScheduled ? "bg-[#9baa3e]" : "bg-[#5b7db7]")}>{event.isScheduled ? "PR" : "EC"}</Badge>
                      </div>
                      <div className="min-w-0 flex-1">
                        <Link href={`/requests/${event.request.id}`} className="flex items-center gap-2 font-bold text-[#242424] hover:text-[#f36f3d]">
                          <CategoryIcon category={event.request.category} className="h-4 w-4 shrink-0 text-[#f36f3d]" />
                          <span className="truncate">{event.request.claimNumber} · {event.request.insuredName}</span>
                        </Link>
                        <p className="mt-1 truncate text-xs text-muted-foreground">{event.subservice || event.request.category} · {event.request.address}</p>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-1"><UserIcon className="h-3 w-3" />{getTechName(event.technicianId)}</span>
                          <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{getCompanyName(event.request.companyId)}</span>
                          <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{event.request.city}</span>
                        </div>
                      </div>
                      <StatusBadge status={event.request.status} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="flex min-h-[300px] flex-col items-center justify-center border-dashed border-[#d8d8d8] bg-white px-6 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#f36f3d]/10"><Clock className="h-7 w-7 text-[#f36f3d]" /></div>
              <p className="font-semibold text-[#383838]">Sin eventos agendados</p>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">Selecciona otra fecha o crea una programación desde el expediente.</p>
            </Card>
          )}
        </section>
      </div>
    </div>
  )
}
