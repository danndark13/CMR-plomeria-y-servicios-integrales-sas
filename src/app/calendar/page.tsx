"use client"

import { useState, useEffect } from "react"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { MOCK_REQUESTS, MOCK_TECHNICIANS, MOCK_COMPANIES } from "@/lib/mock-data"
import { Badge } from "@/components/ui/badge"
import { StatusBadge } from "@/components/crm/status-badge"
import { CategoryIcon } from "@/components/crm/category-icon"
import { Clock, MapPin, User as UserIcon, Building2, ChevronRight, Loader2 } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useFirestore, useCollection, useMemoFirebase, useUser } from "@/firebase"
import { collection } from "firebase/firestore"

export default function CalendarPage() {
  const [date, setDate] = useState<Date | undefined>(new Date())
  const db = useFirestore()
  const { user } = useUser()

  const requestsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return collection(db, "service_requests")
  }, [db, user])

  const { data: firestoreRequests, isLoading } = useCollection(requestsQuery)

  const allRequests = firestoreRequests 
    ? [
        ...firestoreRequests, 
        ...MOCK_REQUESTS.filter(mr => !firestoreRequests.find(fr => fr.id === mr.id || fr.claimNumber === mr.claimNumber))
      ]
    : MOCK_REQUESTS

  const selectedDateStr = date?.toLocaleDateString() || ""
  
  // Combine historical interventions and scheduled visits for the calendar
  const eventsForDay = allRequests.flatMap(req => {
    const historicalInterventions = (req.interventions || [])
      .filter(i => new Date(i.date).toLocaleDateString() === selectedDateStr)
      .map(i => ({ 
        id: i.id,
        date: i.date, 
        type: i.type, 
        technicianId: i.technicianId,
        request: req,
        isScheduled: false
      }));

    const scheduledVisits = req.scheduledVisit && new Date(req.scheduledVisit.date).toLocaleDateString() === selectedDateStr
      ? [{
          id: req.scheduledVisit.id,
          date: req.scheduledVisit.date,
          type: 'Cita Programada',
          technicianId: req.scheduledVisit.technicianId,
          request: req,
          isScheduled: true
        }]
      : [];

    return [...historicalInterventions, ...scheduledVisits];
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const getTechName = (id: string) => MOCK_TECHNICIANS.find(t => t.id === id)?.name || "Sin asignar"
  const getCompanyName = (id: string) => MOCK_COMPANIES.find(c => c.id === id)?.name || "N/A"

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-black tracking-tighter text-primary uppercase">Calendario Operativo</h1>
        <p className="text-muted-foreground font-medium">Gestiona las visitas técnicas programadas y reprogramaciones.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <Card className="lg:col-span-4 h-fit sticky top-8 border-none shadow-xl">
          <CardHeader>
            <CardTitle className="text-lg font-black uppercase">Filtro de Fecha</CardTitle>
            <CardDescription>Visualiza los servicios por día.</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center p-0 pb-6">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              className="rounded-md border-none"
            />
          </CardContent>
        </Card>

        <div className="lg:col-span-8 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">
              {date?.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
            </h2>
            <Badge variant="outline" className="text-xs px-3 font-black border-primary text-primary bg-primary/5 py-1">
              {eventsForDay.length} Eventos hoy
            </Badge>
          </div>

          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Sincronizando agenda...</p>
            </div>
          ) : eventsForDay.length > 0 ? (
            <div className="grid gap-4">
              {eventsForDay.map((item) => (
                <Card key={item.id} className={`overflow-hidden border-l-4 ${item.isScheduled ? 'border-l-accent' : 'border-l-primary'} hover:shadow-xl transition-all group`}>
                  <div className="flex flex-col md:flex-row">
                    <div className="p-6 flex-1 space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`h-10 w-10 ${item.isScheduled ? 'bg-accent/10 text-accent' : 'bg-primary/10 text-primary'} rounded-full flex items-center justify-center`}>
                            <CategoryIcon category={item.request.category} className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-primary uppercase tracking-widest leading-none mb-1">{item.request.claimNumber}</p>
                            <h3 className="text-lg font-black leading-tight text-slate-800 uppercase">{item.request.insuredName}</h3>
                          </div>
                        </div>
                        <StatusBadge status={item.request.status} />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock className={`h-4 w-4 ${item.isScheduled ? 'text-accent' : 'text-primary'}`} />
                          <span className="font-black text-slate-700">
                            {new Date(item.date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <Badge variant="outline" className={`text-[9px] font-black uppercase px-2 ${item.isScheduled ? 'border-accent text-accent' : 'border-primary text-primary'}`}>
                            {item.type}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <MapPin className="h-4 w-4 text-primary" />
                          <span className="truncate font-medium">{item.request.address}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <UserIcon className="h-4 w-4 text-primary" />
                          <span className="text-xs font-medium">Técnico: <span className="font-black text-slate-800 uppercase">{getTechName(item.technicianId)}</span></span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Building2 className="h-4 w-4 text-primary" />
                          <span className="text-xs font-medium">Asistencia: <span className="font-black text-slate-800 uppercase">{getCompanyName(item.request.companyId)}</span></span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-slate-50 border-t md:border-t-0 md:border-l flex items-center justify-center p-4">
                      <Link href={`/requests/${item.request.id}`}>
                        <Button variant="ghost" size="sm" className="gap-2 text-primary font-black uppercase text-[10px] group-hover:bg-primary group-hover:text-white transition-all">
                          Ver detalles <ChevronRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-dashed border-2 py-20 flex flex-col items-center justify-center text-center text-muted-foreground bg-slate-50/50">
              <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <Clock className="h-8 w-8 opacity-20" />
              </div>
              <p className="text-lg font-black uppercase tracking-widest text-slate-400">Sin eventos agendados</p>
              <p className="text-xs font-medium max-w-[300px] mt-2">Selecciona otra fecha o programa una nueva visita desde el detalle de un expediente.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
