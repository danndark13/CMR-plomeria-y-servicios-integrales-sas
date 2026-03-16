
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { 
  Receipt, 
  Search, 
  FileSpreadsheet,
  Building2,
  ChevronRight,
  ArrowLeft,
  FileText,
  Loader2,
  AlertCircle
} from "lucide-react"
import { MOCK_REQUESTS, MOCK_COMPANIES } from "@/lib/mock-data"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection } from "firebase/firestore"

export default function BillingReportPage() {
  const db = useFirestore()
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")

  const requestsQuery = useMemoFirebase(() => {
    if (!db) return null
    return collection(db, "service_requests")
  }, [db])

  const { data: firestoreRequests, isLoading } = useCollection(requestsQuery)

  const allRequests = firestoreRequests ? [...firestoreRequests, ...MOCK_REQUESTS.filter(mr => !firestoreRequests.find(fr => fr.claimNumber === mr.claimNumber))] : MOCK_REQUESTS

  const selectedCompany = MOCK_COMPANIES.find(c => c.id === selectedCompanyId)

  const filteredRequests = allRequests.filter(req => {
    const matchesCompany = !selectedCompanyId || req.companyId === selectedCompanyId
    const matchesSearch = (req.claimNumber || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (req.insuredName || "").toLowerCase().includes(searchTerm.toLowerCase())
    return matchesCompany && matchesSearch
  })

  const handleExportExcel = () => {
    if (!selectedCompany) return

    const headers = ["Expediente", "Asegurado", "Tipo de Servicio", "Cuenta", "Valor Final a Cobrar"]
    const rows = filteredRequests.map(req => [
      req.claimNumber,
      req.insuredName,
      req.category,
      req.accountName,
      req.approvedAmount || req.requestedAmount || 0
    ])

    const csvContent = [
      headers.join(","),
      ...rows.map(e => e.join(","))
    ].join("\n")

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `Cobros_${selectedCompany.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast({
      title: "Reporte Generado",
      description: `Se ha descargado el archivo de cobros para ${selectedCompany.name}.`
    })
  }

  if (!selectedCompanyId) {
    return (
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-primary uppercase">Facturación por Asistencia</h1>
          <p className="text-muted-foreground font-medium">Seleccione una aseguradora para gestionar sus cobros y descargar reportes.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {MOCK_COMPANIES.map((company) => (
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
                <CardDescription>{allRequests.filter(r => r.companyId === company.id).length} expedientes listos</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="ghost" className="w-full justify-between text-xs font-bold p-0 group-hover:text-primary">
                  Ingresar a Cobros <ChevronRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
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
            <p className="text-muted-foreground font-medium">Gestión financiera y desglose de cobros por expediente.</p>
          </div>
        </div>
        <Button onClick={handleExportExcel} className="gap-2 bg-green-600 hover:bg-green-700 font-bold shadow-lg h-12">
          <FileSpreadsheet className="h-5 w-5" /> Descargar Excel de Cobros
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por expediente o asegurado..." 
            className="pl-10 h-11"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Card className="overflow-hidden border-t-4 border-t-primary shadow-xl">
        <CardHeader className="bg-slate-50/80 border-b">
          <CardTitle className="text-sm font-black flex items-center gap-2 uppercase tracking-wider">
            <Receipt className="h-4 w-4 text-primary" /> Historial de Conciliación Financiera
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="font-black uppercase text-[10px]">Expediente</TableHead>
                <TableHead className="font-black uppercase text-[10px]">Asegurado / Cuenta</TableHead>
                <TableHead className="font-black uppercase text-[10px]">Reporte Técnico</TableHead>
                <TableHead className="font-black uppercase text-[10px]">Desglose Sugerido</TableHead>
                <TableHead className="text-right font-black uppercase text-[10px]">Conciliación</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-40 text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary/20" />
                  </TableCell>
                </TableRow>
              ) : filteredRequests.map((req) => {
                const totalLabor = (req.interventions || []).reduce((sum, i) => sum + i.laborCost, 0)
                const expensesBreakdown = (req.interventions || []).flatMap(i => (i.detailedExpenses || []).filter(e => !e.isUnused))
                const totalExpenses = expensesBreakdown.reduce((s, e) => s + e.amount, 0)
                
                const initialSuggested = req.requestedAmount || (totalLabor + totalExpenses)
                const finalAmount = req.approvedAmount || 0
                const isConciliated = finalAmount > 0

                return (
                  <TableRow key={req.id} className="hover:bg-primary/5 transition-colors">
                    <TableCell>
                      <span className="font-mono font-black text-primary">{req.claimNumber}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800 text-sm">{req.insuredName}</span>
                        <span className="text-[10px] text-muted-foreground uppercase">{req.accountName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 cursor-help bg-slate-100 px-2 py-1 rounded max-w-[150px] truncate">
                              <FileText className="h-3 w-3 text-primary shrink-0" />
                              {req.report || req.summary || "Sin reporte"}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[300px] p-4 text-xs">
                            <p className="font-black uppercase mb-2 border-b pb-1">Reporte Consolidado</p>
                            <p>{req.report || req.summary || "No hay un reporte final cargado todavía."}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <div className="flex justify-between items-center text-[9px] gap-4">
                          <span className="text-muted-foreground uppercase">M. Obra:</span>
                          <span className="font-bold text-slate-700">${totalLabor.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-[9px] gap-4">
                          <span className="text-muted-foreground uppercase">Gastos:</span>
                          <span className="font-bold text-slate-700">${totalExpenses.toLocaleString()}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end">
                        {isConciliated ? (
                          <>
                            <span className="text-xs font-mono text-slate-400 line-through decoration-red-500/50 decoration-2">
                              ${initialSuggested.toLocaleString()}
                            </span>
                            <span className="font-mono font-black text-base text-green-600">
                              ${finalAmount.toLocaleString()}
                            </span>
                          </>
                        ) : (
                          <div className="flex flex-col items-end gap-1">
                             <span className="text-[10px] font-mono font-bold text-primary opacity-60">Sugerido: ${initialSuggested.toLocaleString()}</span>
                             <Badge variant="outline" className="text-[9px] font-black uppercase text-red-500 border-red-200 bg-red-50 py-0.5">
                                <AlertCircle className="h-2 w-2 mr-1" /> Definir valor a cobrar
                             </Badge>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/requests/${req.id}`}>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary">
                          <ChevronRight className="h-5 w-5" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
