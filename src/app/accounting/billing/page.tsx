"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { 
  Receipt, 
  Search, 
  FileSpreadsheet,
  Building2,
  ChevronRight,
  ArrowLeft,
  FileText,
  Loader2,
  CheckCircle2,
  Calculator,
  Save,
  Clock,
  Briefcase,
  Layers
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

  const preValidatedRequests = filteredRequests.filter(r => r.billingStatus !== 'validated' && r.billingStatus !== 'paid')
  const validatedRequests = filteredRequests.filter(r => r.billingStatus === 'validated' || r.billingStatus === 'paid')

  // Group validated requests by Invoice Number
  const groupedByInvoice = validatedRequests.reduce((acc, req) => {
    const inv = req.invoiceNumber || "SIN_FACTURA"
    if (!acc[inv]) acc[inv] = []
    acc[inv].push(req)
    return acc
  }, {} as Record<string, ServiceRequest[]>)

  const handleValidateBilling = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db || !validatingRequest) return

    setIsProcessing(true)
    const formData = new FormData(e.currentTarget)
    const invoiceNumber = (formData.get("invoiceNumber") as string).toUpperCase()
    const billingConsecutive = (formData.get("billingConsecutive") as string).toUpperCase()

    const docRef = doc(db, "service_requests", validatingRequest.id)
    const updatedData = {
      billingStatus: 'validated' as BillingStatus,
      invoiceNumber,
      billingConsecutive,
      updatedAt: new Date().toISOString()
    }

    updateDoc(docRef, updatedData)
      .then(() => {
        toast({ title: "Factura Registrada", description: `Expediente ${validatingRequest.claimNumber} validado correctamente.` })
        setValidatingRequest(null)
      })
      .catch((error) => {
        console.error("Error validando factura:", error)
        toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar el estado de facturación." })
      })
      .finally(() => setIsProcessing(false))
  }

  const handleExportExcel = () => {
    if (!selectedCompany) return
    
    // Header based on user provided Excel image
    const titleRow = ["PLOMERÍA Y SERVICIOS INTEGRALES RYS SAS", "", "", "", ""]
    const headers = ["EXPEDIENTE", "ASEGURADO", "CUENTA", "TIPO DE SERVICIO", "VALOR"]
    
    // We export pre-validated requests (the ones pending conciliation)
    const rows = preValidatedRequests.map(req => [
      req.claimNumber,
      req.insuredName.toUpperCase(),
      req.accountName.toUpperCase(),
      req.category.toUpperCase(),
      req.approvedAmount || 0
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
    
    toast({ title: "Excel Generado", description: "El reporte de prevalidado se ha descargado correctamente." })
  }

  const isLoadingTotal = isUserLoading || isRequestsLoading

  if (!selectedCompanyId) {
    return (
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-primary uppercase">Módulo Contable: Facturación</h1>
          <p className="text-muted-foreground font-medium">Seleccione una aseguradora para procesar conciliaciones y facturas.</p>
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
            <h1 className="text-3xl font-black tracking-tighter text-primary uppercase">{selectedCompany.name}</h1>
            <p className="text-muted-foreground font-medium">Gestión de cartera y expedientes finalizados.</p>
          </div>
        </div>
        <Button onClick={handleExportExcel} className="gap-2 bg-green-600 hover:bg-green-700 font-bold shadow-lg h-12">
          <FileSpreadsheet className="h-5 w-5" /> Exportar Excel Prevalidado
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Buscar por expediente o asegurado..." 
          className="pl-10 h-11"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <Tabs defaultValue="conciliation" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-[500px] mb-6 h-12 bg-slate-100 p-1">
          <TabsTrigger 
            value="conciliation" 
            className="font-black uppercase tracking-widest text-[11px] data-[state=active]:bg-blue-600 data-[state=active]:text-white h-full transition-all"
          >
            PREVALIDADO
          </TabsTrigger>
          <TabsTrigger 
            value="validated" 
            className="font-black uppercase tracking-widest text-[11px] data-[state=active]:bg-green-600 data-[state=active]:text-white h-full transition-all"
          >
            VALIDADO
          </TabsTrigger>
        </TabsList>

        <TabsContent value="conciliation">
          <Card className="overflow-hidden border-t-4 border-t-blue-500 shadow-xl">
            <CardHeader className="bg-slate-50/80 border-b">
              <CardTitle className="text-sm font-black flex items-center gap-2 uppercase tracking-wider">
                <Clock className="h-4 w-4 text-blue-500" /> Expedientes en Conciliación
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="font-black uppercase text-[10px]">Expediente</TableHead>
                    <TableHead className="font-black uppercase text-[10px]">Asegurado</TableHead>
                    <TableHead className="text-right font-black uppercase text-[10px]">Costo Sugerido</TableHead>
                    <TableHead className="text-right font-black uppercase text-[10px]">V. Aprobado</TableHead>
                    <TableHead className="text-right font-black uppercase text-[10px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingTotal ? (
                    <TableRow><TableCell colSpan={5} className="h-40 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary/20" /></TableCell></TableRow>
                  ) : preValidatedRequests.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="h-40 text-center text-muted-foreground italic">No hay expedientes pendientes por conciliar.</TableCell></TableRow>
                  ) : preValidatedRequests.map((req) => (
                    <TableRow key={req.id} className="hover:bg-primary/5">
                      <TableCell><span className="font-mono font-black text-primary">{req.claimNumber}</span></TableCell>
                      <TableCell><span className="font-bold text-sm">{req.insuredName}</span></TableCell>
                      <TableCell className="text-right font-mono text-xs text-slate-400">
                        ${(req.requestedAmount || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-mono font-black text-orange-600">
                          ${(req.approvedAmount || 0).toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Link href={`/requests/${req.id}`}>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary"><FileText className="h-4 w-4" /></Button>
                          </Link>
                          <Button 
                            className="h-8 font-black text-[10px] uppercase tracking-tighter bg-blue-600 hover:bg-blue-700 text-white"
                            onClick={() => setValidatingRequest(req)}
                          >
                            VALIDAR CARGO
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="validated">
          <div className="space-y-8">
            {isLoadingTotal ? (
              <div className="h-60 flex flex-col items-center justify-center gap-4 bg-white rounded-xl border border-dashed">
                <Loader2 className="h-8 w-8 animate-spin text-primary opacity-20" />
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Organizando facturas...</p>
              </div>
            ) : Object.keys(groupedByInvoice).length === 0 ? (
              <Card className="border-dashed py-20 flex flex-col items-center justify-center text-center text-muted-foreground">
                <Receipt className="h-12 w-12 opacity-10 mb-4" />
                <p className="text-lg font-bold">Sin facturas generadas</p>
                <p className="text-xs uppercase font-black tracking-tighter">Valida servicios en la pestaña de conciliación</p>
              </Card>
            ) : Object.entries(groupedByInvoice).sort((a,b) => b[0].localeCompare(a[0])).map(([invoiceNum, requests]) => {
              const totalFactura = requests.reduce((sum, r) => sum + (r.approvedAmount || 0), 0)
              const firstReq = requests[0]
              
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
                        <p className="text-[10px] text-white/60 font-medium uppercase">{requests.length} expedientes asociados</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-black uppercase text-white/40 tracking-widest">Total Facturado</p>
                      <p className="text-xl font-black text-green-400">${totalFactura.toLocaleString()}</p>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead className="font-black uppercase text-[10px]">Expediente</TableHead>
                          <TableHead className="font-black uppercase text-[10px]">Asegurado</TableHead>
                          <TableHead className="font-black uppercase text-[10px]">Cuenta Cliente</TableHead>
                          <TableHead className="text-right font-black uppercase text-[10px]">Valor Aprobado</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {requests.map((req) => (
                          <TableRow key={req.id} className="hover:bg-primary/5 border-b-slate-100 last:border-0 transition-colors">
                            <TableCell><span className="font-mono font-black text-primary">{req.claimNumber}</span></TableCell>
                            <TableCell><span className="font-bold text-sm">{req.insuredName}</span></TableCell>
                            <TableCell><span className="text-[10px] font-black uppercase text-muted-foreground">{req.accountName}</span></TableCell>
                            <TableCell className="text-right font-mono font-black text-slate-800">
                              ${(req.approvedAmount || 0).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right">
                              <Link href={`/requests/${req.id}`}>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10">
                                  <ChevronRight className="h-4 w-4" />
                                </Button>
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

      {/* Dialog for Validating Billing */}
      <Dialog open={!!validatingRequest} onOpenChange={(v) => !v && setValidatingRequest(null)}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-primary">Validar y Generar Factura</DialogTitle>
            <DialogDescription>
              Confirme los datos de facturación para el expediente <strong className="text-primary">{validatingRequest?.claimNumber}</strong>.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleValidateBilling} className="space-y-6 pt-4">
            <div className="p-4 bg-slate-50 rounded-lg border border-dashed mb-4">
              <div className="flex justify-between items-center text-sm">
                <span className="font-bold text-slate-600">Valor Final Acordado:</span>
                <span className="font-black text-lg text-primary">${(validatingRequest?.approvedAmount || 0).toLocaleString()}</span>
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">N° Factura Electrónica</Label>
                <div className="relative">
                  <Receipt className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input name="invoiceNumber" placeholder="Ej. FE-1025" required className="pl-10 font-bold uppercase" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">Consecutivo Interno RYS</Label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input name="billingConsecutive" placeholder="Ej. 2025-001" required className="pl-10 font-bold uppercase" />
                </div>
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
