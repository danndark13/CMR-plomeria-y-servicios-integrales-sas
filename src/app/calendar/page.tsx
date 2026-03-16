
"use client"

import { useState, useEffect } from "react"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { MOCK_REQUESTS, MOCK_TECHNICIANS, MOCK_COMPANIES } from "@/lib/mock-data"
import { Badge } from "@/components/ui/badge"
import { StatusBadge } from "@/components/crm/status-badge"
import { CategoryIcon } from "@/components/crm/category-icon"
import { Clock, MapPin, User, Building2, ChevronRight } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function CalendarPage() {
  const [date, setDate] = useState<Date | undefined>(new Date())
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  const selectedDateStr = date?.toLocaleDateString() || ""
  
  const interventionsForDay = MOCK_REQUESTS.flatMap(req => 
    req.interventions
      .filter(i => new Date(i.date).toLocaleDateString() === selectedDateStr)
      .map(i => ({ ...i, request: req }))
  ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  const getTechName = (id: string) => MOCK_TECHNICIANS.find(t => t.id === id)?.name || "Sin asignar"
  const getCompanyName = (id: string) => MOCK_COMPANIES.find(c => c.id === id)?.name || "N/A"

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-primary">Calendario Operativo</h1>
        <p className="text-muted-foreground">Gestiona las visitas técnicas programadas y reprogramaciones.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <Card className="lg:col-span-4 h-fit sticky top-8">
          <CardHeader>
            <CardTitle>Seleccionar Fecha</CardTitle>
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
            <h2 className="text-2xl font-bold">
              {date?.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
            </h2>
            <Badge variant="outline" className="text-sm px-3">
              {interventionsForDay.length} Visitas programadas
            </Badge>
          </div>

          {interventionsForDay.length > 0 ? (
            <div className="grid gap-4">
              {interventionsForDay.map((item) => (
                <Card key={item.id} className="overflow-hidden border-l-4 border-l-primary hover:shadow-md transition-all">
                  <div className="flex flex-col md:flex-row">
                    <div className="p-6 flex-1 space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 bg-accent/10 rounded-full flex items-center justify-center text-accent">
                            <CategoryIcon category={item.request.category} className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-primary uppercase tracking-wider">{item.request.claimNumber}</p>
                            <h3 className="text-lg font-bold leading-tight">{item.request.insuredName}</h3>
                          </div>
                        </div>
                        <StatusBadge status={item.request.status} />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="h-4 w-4 text-primary" />
                          <span className="font-medium text-foreground">
                            {new Date(item.date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className="bg-muted px-2 py-0.5 rounded text-[10px] font-bold uppercase">{item.type}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <MapPin className="h-4 w-4 text-primary" />
                          <span className="truncate">{item.request.address}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <User className="h-4 w-4 text-primary" />
                          <span>Técnico: <span className="font-semibold text-foreground">{getTechName(item.technicianId)}</span></span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Building2 className="h-4 w-4 text-primary" />
                          <span>Asistencia: <span className="font-semibold text-foreground">{getCompanyName(item.request.companyId)}</span></span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-muted/30 border-t md:border-t-0 md:border-l flex items-center justify-center p-4">
                      <Link href={`/requests/${item.request.id}`}>
                        <Button variant="ghost" size="sm" className="gap-2 text-primary group">
                          Ver detalles <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-dashed py-20 flex flex-col items-center justify-center text-center text-muted-foreground">
              <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <Clock className="h-8 w-8 opacity-20" />
              </div>
              <p className="text-lg font-medium">No hay servicios programados para este día.</p>
              <p className="text-sm">Selecciona otra fecha o programa una nueva visita desde el detalle del servicio.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
