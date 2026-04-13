
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { 
  Receipt, 
  Search, 
  FileSpreadsheet,
  Building2,
  ChevronRight,
  ArrowLeft,
  FileText,
  Loader2,
  Calculator,
  Save,
  Clock,
  Briefcase,
  DollarSign,
  CheckCircle2,
  ClipboardCheck
} from "lucide-react"
import { MOCK_REQUESTS, MOCK_COMPANIES } from "@/lib/mock-data"
import { toast } from "@/hooks/use-toast"
import Link from "next/link"
import { useFirestore, useCollection, useMemoFirebase, useUser } from "@/firebase"
import { collection, doc, updateDoc } from "firebase/firestore"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { ServiceRequest, BillingStatus } from "@/lib/types"

export default function BillingReportPage() {
  const db = useFirestore()
  const { user, isUserLoading } = useUser()
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [validatingRequest, setValidatingRequest] = useState<ServiceRequest | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const requestsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return collection(db, "service_requests")
  }, [db, user])

  const { data: firestoreRequests, isLoading: isRequestsLoading } = useCollection(requestsQuery)

  const allRequests = firestoreRequests ? [...firestoreRequests, ...MOCK_REQUESTS.filter(mr => !firestoreRequests.find(fr => fr.claimNumber === mr.claimNumber))] : MOCK_REQUESTS

  const selectedCompany = MOCK_COMPANIES.find(c => c.id === selectedCompanyId)

  const filteredRequests = allRequests.filter(req => {
    const matchesCompany = !selectedCompanyId || req.companyId === selectedCompanyId
    const matchesSearch = (req.claimNumber || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (req.insuredName || "").toLowerCase().includes(searchTerm.toLowerCase())
    const isCompleted = req.status === 'completed'
    return matchesCompany && matchesSearch && isCompleted
  })

  // CATEGORÍAS DE FACTURACIÓN
  const pendingRequests = filteredRequests.filter(r => r.billingStatus === 'pending' || !r.billingStatus)
  const preValidatedRequests = filteredRequests.filter(r => r.billingStatus === 'pre_validated')
  const validatedRequests = filteredRequests.filter(r => r.billingStatus === 'validated' || r.billingStatus === 'paid')

  // Group validated requests by Invoice Number
  const groupedByInvoice = validatedRequests.reduce((acc, req) => {
    const inv = req.invoiceNumber || "SIN_FACTURA"
    if (!acc[inv]) acc[inv] = []
    acc[inv].push(req)
    return acc
  }, {} as Record<string, ServiceRequest[]>)

  const handleSetPreValidated = (requestId: string) => {
    if (!db) return
    setIsProcessing(true)
    const docRef = doc(db, "service_requests", requestId)
    updateDoc(docRef, { billingStatus: 'pre_validated' as BillingStatus, updatedAt: new Date().toISOString() })
      .then(() => toast({ title: "Prevalidado", description: "Expediente listo para facturar." }))
      .finally(() => setIsProcessing(false))
  }

  const handleValidateBilling = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db || !validatingRequest) return

    setIsProcessing(true)
    const formData = new FormData(e.currentTarget)
    const invoiceNumber = (formData.get("invoiceNumber") as string).toUpperCase()
    const billingConsecutive = (formData.get("billingConsecutive") as string).toUpperCase()
    const approvedAmount = Number(formData.get("approvedAmount"))
    const accountingNotes = formData.get("accountingNotes") as string

    const docRef = doc(db, "service_requests", validatingRequest.id)
    const updatedData = {
      billingStatus: 'validated' as BillingStatus,
      invoiceNumber,
      billingConsecutive,
      approvedAmount,
      accountingNotes,
      updatedAt: new Date().toISOString()
    }

    updateDoc(docRef, updatedData)
      .then(() => {
        toast({ title: "Conciliación Exitosa", description: `Expediente ${validatingRequest.claimNumber} validado correctamente.` })
        setValidatingRequest(null)
      })
      .finally(() => setIsProcessing(false))
  }

  const calculateSuggested = (req: ServiceRequest) => {
    return (req.interventions || []).reduce((s, i) => s + (i.reportedValue || 0), 0)
  }

  const handleExportExcel = () => {
    if (!selectedCompany) return
    
    const titleRow = ["PLOMERÍA Y SERVICIOS INTEGRALES RYS SAS", "", "", "", ""]
    const headers = ["EXPEDIENTE", "ASEGURADO", "CUENTA", "TIPO DE SERVICIO", "VALOR SUGERIDO (BRUTO REPORTADO)"]
    
    const rows = preValidatedRequests.map(req => [
      req.claimNumber,
      req.insuredName.toUpperCase(),
      req.accountName.toUpperCase(),
      req.category.toUpperCase(),
      calculateSuggested(req)
    ])

    const csvContent = [
      titleRow.join(","),
      headers.join(","),
      ...rows.map(e => e.join(","))
    ].join("\n")

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `Prevalidado_${selectedCompany.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    
    toast({ title: "Excel Generado", description: "Reporte de prevalidado descargado." })
  }

  const isLoadingTotal = isUserLoading || isRequestsLoading

  if (!selectedCompanyId) {
    return (
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-primary uppercase">Módulo Contable: Facturación</h1>
          <p className="text-muted-foreground font-medium">Seleccione una aseguradora para procesar conciliaciones y facturas de forma independiente.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {MOCK_COMPANIES.map((company) => {
            const companyRequests = allRequests.filter(r => r.companyId === company.id && r.status === 'completed')
            const pendingCount = companyRequests.filter(r => r.billingStatus !== 'validated').length
            
            return (
              <Card 
                key={company.id} 
                className="hover:shadow-xl transition-all cursor-pointer group border-l-4 border-l-primary"
                onClick={() => setSelectedCompanyId(company.id)}
              >
                <CardHeader className="pb-4">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <Building2 className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-lg uppercase font-black">{company.name}</CardTitle>
                  <CardDescription className="flex items-center gap-2">
                    <span className="font-bold text-primary">{pendingCount}</span> por conciliar
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="ghost" className="w-full justify-between text-xs font-bold p-0 group-hover:text-primary">
                    Gestionar Cartera <ChevronRight className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-right-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => setSelectedCompanyId(null)} className="rounded-xl border-primary text-primary">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-black tracking-tighter text-primary uppercase">{selectedCompany?.name || 'Facturación'}</h1>
            <p className="text-muted-foreground font-medium">Gestión de cartera independiente.</p>
          </div>
        </div>
        <Button onClick={handleExportExcel} className="gap-2 bg-green-600 hover:bg-green-700 font-bold shadow-lg h-12">
          <FileSpreadsheet className="h-5 w-5" /> Exportar Excel Prevalidado
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Buscar expediente..." 
          className="pl-10 h-11"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-[600px] mb-6 h-12 bg-slate-100 p-1">
          <TabsTrigger value="pending" className="font-black uppercase tracking-widest text-[10px] data-[state=active]:bg-orange-500 data-[state=active]:text-white transition-all">
            POR PREVALIDAR
          </TabsTrigger>
          <TabsTrigger value="pre_validated" className="font-black uppercase tracking-widest text-[10px] data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all">
            PREVALIDADOS
          </TabsTrigger>
          <TabsTrigger value="facturados" className="font-black uppercase tracking-widest text-[10px] data-[state=active]:bg-green-600 data-[state=active]:text-white transition-all">
            FACTURADOS
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <Card className="overflow-hidden border-t-4 border-t-orange-500 shadow-xl">
            <CardHeader className="bg-slate-50/80 border-b">
              <CardTitle className="text-sm font-black flex items-center gap-2 uppercase tracking-wider">
                <Clock className="h-4 w-4 text-orange-500" /> Expedientes por Revisar
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="font-black uppercase text-[10px]">Expediente</TableHead>
                    <TableHead className="font-black uppercase text-[10px]">Asegurado</TableHead>
                    <TableHead className="text-right font-black uppercase text-[10px]">V. Reportado</TableHead>
                    <TableHead className="text-right font-black uppercase text-[10px]">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingTotal ? (
                    <TableRow><TableCell colSpan={4} className="h-40 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary/20" /></TableCell></TableRow>
                  ) : pendingRequests.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="h-40 text-center text-muted-foreground italic">No hay expedientes pendientes.</TableCell></TableRow>
                  ) : pendingRequests.map((req) => (
                    <TableRow key={req.id} className="hover:bg-primary/5">
                      <TableCell><span className="font-mono font-black text-primary">{req.claimNumber}</span></TableCell>
                      <TableCell><span className="font-bold text-sm uppercase">{req.insuredName}</span></TableCell>
                      <TableCell className="text-right font-mono font-bold text-slate-600">${calculateSuggested(req).toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="font-black text-[9px] uppercase border-orange-200 text-orange-600 hover:bg-orange-50"
                          onClick={() => handleSetPreValidated(req.id)}
                          disabled={isProcessing}
                        >
                          MARCAR PREVALIDADO
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pre_validated">
          <Card className="overflow-hidden border-t-4 border-t-blue-500 shadow-xl">
            <CardHeader className="bg-slate-50/80 border-b">
              <CardTitle className="text-sm font-black flex items-center gap-2 uppercase tracking-wider">
                <ClipboardCheck className="h-4 w-4 text-blue-500" /> Listos para Conciliar y Facturar
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="font-black uppercase text-[10px]">Expediente</TableHead>
                    <TableHead className="font-black uppercase text-[10px]">Asegurado</TableHead>
                    <TableHead className="text-right font-black uppercase text-[10px]">Costo Sugerido</TableHead>
                    <TableHead className="text-right font-black uppercase text-[10px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingTotal ? (
                    <TableRow><TableCell colSpan={4} className="h-40 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary/20" /></TableCell></TableRow>
                  ) : preValidatedRequests.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="h-40 text-center text-muted-foreground italic">No hay expedientes prevalidados.</TableCell></TableRow>
                  ) : preValidatedRequests.map((req) => (
                    <TableRow key={req.id} className="hover:bg-primary/5">
                      <TableCell><span className="font-mono font-black text-primary">{req.claimNumber}</span></TableCell>
                      <TableCell><span className="font-bold text-sm uppercase">{req.insuredName}</span></TableCell>
                      <TableCell className="text-right font-mono font-black text-blue-600">${calculateSuggested(req).toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <Button 
                          className="h-8 font-black text-[10px] uppercase bg-blue-600 hover:bg-blue-700 text-white"
                          onClick={() => setValidatingRequest(req)}
                        >
                          FACTURAR
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="facturados">
          <div className="space-y-8">
            {isLoadingTotal ? (
              <div className="h-60 flex flex-col items-center justify-center gap-4 bg-white rounded-xl border border-dashed">
                <Loader2 className="h-8 w-8 animate-spin text-primary opacity-20" />
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Cargando historial...</p>
              </div>
            ) : Object.keys(groupedByInvoice).length === 0 ? (
              <Card className="border-dashed py-20 flex flex-col items-center justify-center text-center text-muted-foreground">
                <Receipt className="h-12 w-12 opacity-10 mb-4" />
                <p className="text-lg font-bold">Sin facturas generadas para esta empresa</p>
              </Card>
            ) : Object.entries(groupedByInvoice).sort((a,b) => b[0].localeCompare(a[0])).map(([invoiceNum, requests]) => {
              const typedRequests = requests as ServiceRequest[]
              const totalFactura = typedRequests.reduce((sum: number, r: ServiceRequest) => sum + (r.approvedAmount || 0), 0)
              const firstReq = typedRequests[0]
              
              return (
                <Card key={invoiceNum} className="overflow-hidden border-none shadow-lg group">
                  <CardHeader className="bg-slate-900 text-white flex flex-row items-center justify-between p-4">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-white/10 flex items-center justify-center">
                        <Receipt className="h-5 w-5 text-primary-foreground" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black uppercase tracking-widest">Factura: {invoiceNum}</span>
                          <Badge variant="outline" className="border-white/20 text-white text-[9px] font-black">
                            CONS: {firstReq.billingConsecutive || '---'}
                          </Badge>
                        </div>
                        <p className="text-[10px] text-white/60 font-medium uppercase">{typedRequests.length} expedientes asociados</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-black uppercase text-white/40 tracking-widest">Total Facturado</p>
                      <p className="text-xl font-black text-green-400">${totalFactura.toLocaleString()}</p>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader><TableRow className="bg-slate-50">
                        <TableHead className="font-black uppercase text-[10px]">Expediente</TableHead>
                        <TableHead className="font-black uppercase text-[10px]">Asegurado</TableHead>
                        <TableHead className="text-right font-black uppercase text-[10px]">Valor Aprobado</TableHead>
                        <TableHead></TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {typedRequests.map((req: ServiceRequest) => (
                          <TableRow key={req.id} className="hover:bg-primary/5 transition-colors">
                            <TableCell><span className="font-mono font-black text-primary">{req.claimNumber}</span></TableCell>
                            <TableCell><span className="font-bold text-xs uppercase">{req.insuredName}</span></TableCell>
                            <TableCell className="text-right font-mono font-black text-slate-800">${(req.approvedAmount || 0).toLocaleString()}</TableCell>
                            <TableCell className="text-right">
                              <Link href={`/requests/${req.id}`}>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10"><ChevronRight className="h-4 w-4" /></Button>
                              </Link>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog for Validating Billing and Conciliation */}
      <Dialog open={!!validatingRequest} onOpenChange={(v) => !v && setValidatingRequest(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-primary">Facturación Electrónica</DialogTitle>
            <DialogDescription>Asignación de factura para <strong className="text-primary">{validatingRequest?.claimNumber}</strong>.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleValidateBilling} className="space-y-6 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-slate-50 rounded-lg border border-dashed">
                <p className="text-[9px] font-black uppercase text-slate-400">Bruto Reportado</p>
                <p className="text-sm font-black text-blue-600">${validatingRequest ? calculateSuggested(validatingRequest).toLocaleString() : 0}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-blue-600">Valor Aprobado</Label>
                <div className="relative">
                  <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-blue-600" />
                  <Input 
                    name="approvedAmount" 
                    type="number" 
                    defaultValue={validatingRequest?.approvedAmount || (validatingRequest ? calculateSuggested(validatingRequest) : 0)} 
                    className="pl-7 font-black border-blue-200 bg-blue-50/50"
                    required 
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest">N° Factura</Label>
                  <Input name="invoiceNumber" placeholder="FE-1025" required className="font-bold uppercase h-10" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest">Consecutivo RYS</Label>
                  <Input name="billingConsecutive" placeholder="2025-001" required className="font-bold uppercase h-10" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">Notas</Label>
                <Textarea name="accountingNotes" placeholder="Notas de conciliación..." className="text-xs" />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setValidatingRequest(null)} disabled={isProcessing} className="font-bold">CANCELAR</Button>
              <Button type="submit" disabled={isProcessing} className="font-black gap-2 shadow-lg h-12 bg-green-600 hover:bg-green-700">
                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} VALIDAR Y FACTURAR
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
