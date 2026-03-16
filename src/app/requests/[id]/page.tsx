"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { MOCK_REQUESTS, MOCK_TECHNICIANS, MOCK_COMPANIES } from "@/lib/mock-data"
import { ServiceRequest, Technician } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { 
  ArrowLeft, 
  Sparkles, 
  Calendar, 
  User, 
  Building2, 
  Clock,
  CheckCircle2,
  AlertTriangle,
  Send,
  Loader2
} from "lucide-react"
import { StatusBadge } from "@/components/crm/status-badge"
import { CategoryIcon } from "@/components/crm/category-icon"
import { serviceNoteSummaryGenerator } from "@/ai/flows/service-note-summary-generator"
import { toast } from "@/hooks/use-toast"

export default function RequestDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [request, setRequest] = useState<ServiceRequest | null>(null)
  const [notes, setNotes] = useState("")
  const [summary, setSummary] = useState("")
  const [isSummarizing, setIsSummarizing] = useState(false)

  useEffect(() => {
    const found = MOCK_REQUESTS.find(r => r.id === id)
    if (found) {
      setRequest(found)
      setNotes(found.notes)
      setSummary(found.summary || "")
    }
  }, [id])

  if (!request) return <div className="p-8 text-center">Cargando solicitud...</div>

  const company = MOCK_COMPANIES.find(c => c.id === request.companyId)
  const technician = MOCK_TECHNICIANS.find(t => t.id === request.technicianId)

  const handleGenerateSummary = async () => {
    if (!notes) {
      toast({
        title: "Error",
        description: "Debe haber notas para generar un resumen.",
        variant: "destructive"
      })
      return
    }

    setIsSummarizing(true)
    try {
      const result = await serviceNoteSummaryGenerator({ notes })
      setSummary(result.summary)
      toast({
        title: "Resumen generado",
        description: "La IA ha procesado las notas exitosamente."
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo generar el resumen con IA.",
        variant: "destructive"
      })
    } finally {
      setIsSummarizing(false)
    }
  }

  const handleSaveNotes = () => {
    toast({
      title: "Guardado",
      description: "Las notas han sido actualizadas correctamente."
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex flex-col">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{request.id}</h1>
            <StatusBadge status={request.status} />
          </div>
          <p className="text-muted-foreground">Detalle de intervención de {request.category}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 flex flex-col gap-6">
          <Card className="border-primary/10 shadow-sm">
            <CardHeader className="bg-primary/5">
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-primary" />
                Descripción del Problema
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <p className="text-base text-foreground bg-muted/30 p-4 rounded-lg border italic">
                "{request.description}"
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-accent" />
                Bitácora de Intervención (Notas)
              </CardTitle>
              <CardDescription>Registro detallado de acciones tomadas en sitio.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea 
                placeholder="Escribe aquí los detalles del servicio prestado..."
                className="min-h-[200px] resize-none focus:ring-primary/50"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleSaveNotes}>
                  Guardar Borrador
                </Button>
                <Button className="gap-2" onClick={handleGenerateSummary} disabled={isSummarizing}>
                  {isSummarizing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Generar Resumen con IA
                </Button>
              </div>
            </CardContent>
          </Card>

          {summary && (
            <Card className="border-accent/30 bg-accent/5 shadow-md animate-in fade-in slide-in-from-top-4 duration-500">
              <CardHeader>
                <CardTitle className="text-lg text-accent font-bold flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Resumen IA para Reporte
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-white/80 p-4 rounded-md border border-accent/20 text-sm leading-relaxed shadow-inner">
                  {summary}
                </div>
              </CardContent>
              <CardFooter className="justify-end">
                <Button size="sm" variant="outline" className="text-accent border-accent/30 hover:bg-accent/10">
                  Copiar al Reporte Final
                </Button>
              </CardFooter>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-md">Información de Cuenta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-semibold">{request.accountName}</p>
                  <p className="text-xs text-muted-foreground">{company?.name}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm">Creado el</p>
                  <p className="text-xs text-muted-foreground">{new Date(request.createdAt).toLocaleString()}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm">Última actualización</p>
                  <p className="text-xs text-muted-foreground">{new Date(request.updatedAt).toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-md">Técnico Asignado</CardTitle>
            </CardHeader>
            <CardContent>
              {technician ? (
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <User className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">{technician.name}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {technician.specialties.slice(0, 2).map(s => (
                        <Badge key={s} variant="secondary" className="text-[10px] py-0">{s}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 bg-muted/50 rounded-lg border border-dashed">
                  <p className="text-sm text-muted-foreground mb-2">Sin técnico asignado</p>
                  <Button size="sm" className="w-full">Asignar Ahora</Button>
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-md">Acciones de Estado</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-2">
              <Button variant="outline" className="justify-start gap-2">
                <Clock className="h-4 w-4" /> Marcar En Camino
              </Button>
              <Button variant="outline" className="justify-start gap-2">
                <Send className="h-4 w-4" /> Notificar a {company?.name}
              </Button>
              <Button className="justify-start gap-2 bg-green-600 hover:bg-green-700">
                <CheckCircle2 className="h-4 w-4" /> Finalizar Servicio
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}