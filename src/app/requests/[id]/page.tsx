"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { MOCK_REQUESTS, MOCK_TECHNICIANS, MOCK_COMPANIES } from "@/lib/mock-data"
import { ServiceRequest, Technician, TechnicianIntervention } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { 
  ArrowLeft, 
  Sparkles, 
  User, 
  Building2, 
  Clock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Phone,
  MapPin,
  FileText,
  UserCheck,
  Hash,
  Plus,
  Wrench,
  DollarSign,
  Briefcase
} from "lucide-react"
import { StatusBadge } from "@/components/crm/status-badge"
import { CategoryIcon } from "@/components/crm/category-icon"
import { serviceNoteSummaryGenerator } from "@/ai/flows/service-note-summary-generator"
import { toast } from "@/hooks/use-toast"

export default function RequestDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [request, setRequest] = useState<ServiceRequest | null>(null)
  const [summary, setSummary] = useState("")
  const [report, setReport] = useState("")
  const [isSummarizing, setIsSummarizing] = useState(false)

  useEffect(() => {
    const found = MOCK_REQUESTS.find(r => r.id === id)
    if (found) {
      setRequest(found)
      setSummary(found.summary || "")
      setReport(found.report || "")
    }
  }, [id])

  if (!request) return <div className="p-8 text-center text-muted-foreground italic">Buscando solicitud en el sistema...</div>

  const company = MOCK_COMPANIES.find(c => c.id === request.companyId)

  // Consolidar todas las notas de las intervenciones para la IA
  const allNotes = request.interventions.map(i => `[${i.type} - ${MOCK_TECHNICIANS.find(t => t.id === i.technicianId)?.name}]: ${i.notes}`).join('\n')

  const totalLabor = request.interventions.reduce((sum, i) => sum + i.laborCost, 0)
  const totalExpenses = request.interventions.reduce((sum, i) => sum + i.expenses, 0)

  const handleGenerateSummary = async () => {
    if (!allNotes) {
      toast({
        title: "Error",
        description: "Debe haber intervenciones con notas para generar un resumen.",
        variant: "destructive"
      })
      return
    }

    setIsSummarizing(true)
    try {
      const result = await serviceNoteSummaryGenerator({ notes: allNotes })
      setSummary(result.summary)
      toast({
        title: "Resumen generado",
        description: "La IA ha consolidado las intervenciones exitosamente."
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

  const handleSaveReport = () => {
    toast({
      title: "Guardado",
      description: "El reporte final ha sido actualizado."
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
        {/* Columna Izquierda: Detalles del Servicio e Intervenciones */}
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
                    <div className="flex items-center gap-2 text-primary font-bold">
                      <Hash className="h-4 w-4" />
                      <span>{request.claimNumber}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-l-4 border-l-primary">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Ubicación y Daño
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-1">
                  <Label className="text-xs text-muted-foreground">Dirección</Label>
                  <p className="font-medium">{request.address}</p>
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs text-muted-foreground">Problema Reportado</Label>
                  <p className="text-sm italic text-muted-foreground">"{request.description}"</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex items-center justify-between mb-2">
             <h2 className="text-xl font-bold flex items-center gap-2">
               <Wrench className="h-5 w-5 text-primary" />
               Bitácora de Intervenciones
             </h2>
             <Button size="sm" className="gap-2">
               <Plus className="h-4 w-4" /> Nueva Visita
             </Button>
          </div>

          <div className="space-y-4">
            {request.interventions.map((intervention, index) => {
              const tech = MOCK_TECHNICIANS.find(t => t.id === intervention.technicianId)
              return (
                <Card key={intervention.id} className="overflow-hidden border-l-4 border-l-primary/30">
                  <CardHeader className="bg-muted/30 py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary" className="bg-primary/10 text-primary">{intervention.type}</Badge>
                        <span className="text-xs text-muted-foreground">{new Date(intervention.date).toLocaleDateString()} {new Date(intervention.date).toLocaleTimeString()}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs font-semibold">
                        <span className="text-muted-foreground">Mano de Obra: <span className="text-foreground">${intervention.laborCost.toLocaleString()}</span></span>
                        <span className="text-muted-foreground">Gastos: <span className="text-foreground">${intervention.expenses.toLocaleString()}</span></span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-accent/20 flex items-center justify-center text-accent">
                        <User className="h-4 w-4" />
                      </div>
                      <span className="font-bold text-sm">Técnico: {tech?.name}</span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {intervention.notes}
                    </p>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {summary && (
            <Card className="border-accent/30 bg-accent/5 shadow-md">
              <CardHeader className="py-4">
                <CardTitle className="text-md text-accent font-bold flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Consolidado de IA (Sugerencia de Reporte)
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
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2 text-green-700">
                  <FileText className="h-5 w-5" />
                  Reporte Final Consolidado
                </CardTitle>
                <CardDescription>Resumen formal para la compañía de asistencia.</CardDescription>
              </div>
              <Button size="sm" variant="outline" className="gap-2" onClick={handleGenerateSummary} disabled={isSummarizing}>
                {isSummarizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                IA: Consolidar Intervenciones
              </Button>
            </CardHeader>
            <CardContent>
              <Textarea 
                placeholder="Redacte aquí el reporte formal que se enviará a la compañía..."
                className="min-h-[200px] focus:ring-green-500/50"
                value={report}
                onChange={(e) => setReport(e.target.value)}
              />
            </CardContent>
            <CardFooter className="justify-end border-t pt-4">
              <Button onClick={handleSaveReport}>Guardar Reporte</Button>
            </CardFooter>
          </Card>
        </div>

        {/* Columna Derecha: Resumen Financiero y Administrativo */}
        <div className="flex flex-col gap-6">
          <Card className="bg-primary text-primary-foreground">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold uppercase tracking-widest opacity-80">Resumen de Costos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="opacity-80">Mano de Obra Total:</span>
                  <span className="font-mono font-bold">${totalLabor.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="opacity-80">Gastos / Materiales:</span>
                  <span className="font-mono font-bold">${totalExpenses.toLocaleString()}</span>
                </div>
                <Separator className="bg-white/20" />
                <div className="flex justify-between items-center pt-1">
                  <span className="font-bold">TOTAL OPERATIVO:</span>
                  <span className="text-2xl font-mono font-black">${(totalLabor + totalExpenses).toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-md flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" /> Compañía Solicitante
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-muted/30 rounded-lg border border-dashed border-primary/20">
                <p className="text-sm font-bold text-primary">{company?.name}</p>
                <p className="text-xs text-muted-foreground">Cuenta: {request.accountName}</p>
              </div>
              <div className="grid gap-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Servicio Creado:</span>
                  <span>{new Date(request.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Último Cambio:</span>
                  <span>{new Date(request.updatedAt).toLocaleDateString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-md flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-primary" /> Gestión Operativa
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-start gap-3">
                <Clock className="h-4 w-4" /> Programar Nueva Cita
              </Button>
              <Button variant="outline" className="w-full justify-start gap-3">
                <AlertTriangle className="h-4 w-4" /> Reportar Incidente
              </Button>
              <Button variant="outline" className="w-full justify-start gap-3">
                <DollarSign className="h-4 w-4" /> Autorizar Gastos Extra
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
