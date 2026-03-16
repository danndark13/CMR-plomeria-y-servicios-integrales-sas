"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { MOCK_REQUESTS, MOCK_TECHNICIANS, MOCK_COMPANIES } from "@/lib/mock-data"
import { ServiceRequest, Technician } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  Loader2,
  Phone,
  MapPin,
  FileText,
  UserCheck,
  Hash
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
  const [report, setReport] = useState("")
  const [isSummarizing, setIsSummarizing] = useState(false)

  useEffect(() => {
    const found = MOCK_REQUESTS.find(r => r.id === id)
    if (found) {
      setRequest(found)
      setNotes(found.notes)
      setSummary(found.summary || "")
      setReport(found.report || "")
    }
  }, [id])

  if (!request) return <div className="p-8 text-center text-muted-foreground italic">Buscando solicitud en el sistema...</div>

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
      description: "La información de la solicitud ha sido actualizada correctamente."
    })
  }

  const copyToReport = () => {
    setReport(summary)
    toast({
      title: "Copiado",
      description: "El resumen de IA ha sido transferido al reporte final."
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{request.id}</h1>
              <StatusBadge status={request.status} />
            </div>
            <p className="text-muted-foreground flex items-center gap-2">
              <CategoryIcon category={request.category} className="h-4 w-4" />
              {request.category} • Expediente: {request.claimNumber}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2">
            <FileText className="h-4 w-4" /> Exportar PDF
          </Button>
          <Button className="gap-2 bg-green-600 hover:bg-green-700">
            <CheckCircle2 className="h-4 w-4" /> Finalizar Servicio
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Columna Izquierda: Información del Asegurado y Ubicación */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="shadow-sm border-l-4 border-l-accent">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <UserCheck className="h-4 w-4" /> Información del Asegurado
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-1">
                  <Label className="text-xs text-muted-foreground">Nombre Completo</Label>
                  <p className="font-medium text-lg">{request.insuredName}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-1">
                    <Label className="text-xs text-muted-foreground">Teléfono</Label>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-accent" />
                      <span className="font-medium">{request.phoneNumber}</span>
                    </div>
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs text-muted-foreground">N° Expediente</Label>
                    <div className="flex items-center gap-2">
                      <Hash className="h-4 w-4 text-accent" />
                      <span className="font-medium">{request.claimNumber}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-l-4 border-l-primary">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Ubicación del Servicio
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-1">
                  <Label className="text-xs text-muted-foreground">Dirección de Atención</Label>
                  <p className="font-medium">{request.address}</p>
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs text-muted-foreground">Descripción del Problema</Label>
                  <p className="text-sm italic text-muted-foreground">"{request.description}"</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-accent" />
                Bitácora de Intervención (Notas)
              </CardTitle>
              <CardDescription>Registro de acciones tomadas por el técnico en sitio.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea 
                placeholder="Ej: Se localizó la fuga en la unión del tubo de 1/2. Se procedió a..."
                className="min-h-[150px] resize-none focus:ring-primary/50"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <div className="flex justify-between items-center">
                <p className="text-xs text-muted-foreground">Ultima edición: {new Date(request.updatedAt).toLocaleString()}</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleSaveNotes}>
                    Guardar Notas
                  </Button>
                  <Button size="sm" className="gap-2" onClick={handleGenerateSummary} disabled={isSummarizing}>
                    {isSummarizing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    IA: Generar Resumen
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {summary && (
            <Card className="border-accent/30 bg-accent/5 shadow-md">
              <CardHeader className="py-4">
                <CardTitle className="text-md text-accent font-bold flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Sugerencia de Reporte (IA)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-white/80 p-4 rounded-md border border-accent/20 text-sm leading-relaxed shadow-inner mb-4">
                  {summary}
                </div>
                <div className="flex justify-end">
                  <Button size="sm" variant="outline" className="text-accent border-accent/30 hover:bg-accent/10" onClick={copyToReport}>
                    Usar como Reporte Final
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="shadow-sm border-t-4 border-t-green-500">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-green-700">
                <FileText className="h-5 w-5" />
                Reporte Final de Servicio
              </CardTitle>
              <CardDescription>Este es el texto que se enviará a la compañía de asistencia.</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea 
                placeholder="Escribe el reporte formal aquí..."
                className="min-h-[180px] focus:ring-green-500/50"
                value={report}
                onChange={(e) => setReport(e.target.value)}
              />
            </CardContent>
            <CardFooter className="justify-end border-t pt-4">
              <Button onClick={handleSaveNotes}>Guardar Reporte</Button>
            </CardFooter>
          </Card>
        </div>

        {/* Columna Derecha: Detalles Administrativos */}
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-md flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" /> Entidad Solicitante
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-muted/30 rounded-lg border border-dashed border-primary/20">
                <p className="text-sm font-bold text-primary">{company?.name}</p>
                <p className="text-xs text-muted-foreground">Cuenta: {request.accountName}</p>
              </div>
              <div className="grid gap-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Creado:</span>
                  <span>{new Date(request.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Hora:</span>
                  <span>{new Date(request.createdAt).toLocaleTimeString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-md flex items-center gap-2">
                <User className="h-4 w-4 text-primary" /> Técnico Asignado
              </CardTitle>
            </CardHeader>
            <CardContent>
              {technician ? (
                <div className="flex items-center gap-4 p-2 bg-primary/5 rounded-lg border border-primary/10">
                  <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                    <User className="h-6 w-6" />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-sm font-bold truncate">{technician.name}</p>
                    <div className="flex gap-1 mt-1 overflow-x-auto pb-1">
                      {technician.specialties.slice(0, 1).map(s => (
                        <Badge key={s} variant="secondary" className="text-[10px] py-0">{s}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 bg-muted/50 rounded-lg border border-dashed">
                  <p className="text-sm text-muted-foreground mb-3">Sin técnico asignado</p>
                  <Button size="sm" className="w-full">Asignar Operativo</Button>
                </div>
              )}
            </CardContent>
            <CardFooter className="pt-0">
               <Button variant="ghost" size="sm" className="w-full text-xs gap-2">
                 <Clock className="h-3.5 w-3.5" /> Ver Disponibilidad
               </Button>
            </CardFooter>
          </Card>
          
          <Card className="bg-primary text-primary-foreground">
            <CardHeader>
              <CardTitle className="text-sm font-bold uppercase tracking-widest opacity-80">Estado Operativo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="secondary" className="w-full justify-start gap-3 bg-white/10 hover:bg-white/20 text-white border-white/10">
                <Clock className="h-4 w-4" /> Notificar: En Camino
              </Button>
              <Button variant="secondary" className="w-full justify-start gap-3 bg-white/10 hover:bg-white/20 text-white border-white/10">
                <MapPin className="h-4 w-4" /> Confirmar Llegada
              </Button>
              <Button variant="secondary" className="w-full justify-start gap-3 bg-white/10 hover:bg-white/20 text-white border-white/10">
                <Send className="h-4 w-4" /> Enviar Aviso a Cliente
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
