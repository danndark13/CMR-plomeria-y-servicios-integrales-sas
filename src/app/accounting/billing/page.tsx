"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Receipt, 
  Search, 
  FileSpreadsheet,
  Building2,
  ChevronRight,
  ArrowLeft,
  CheckCircle2,
  Calculator,
  Download
} from "lucide-react"
import { MOCK_REQUESTS, MOCK_COMPANIES } from "@/lib/mock-data"
import { CategoryIcon } from "@/components/crm/category-icon"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import Link from "next/link"

export default function BillingReportPage() {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")

  const selectedCompany = MOCK_COMPANIES.find(c => c.id === selectedCompanyId)

  const filteredRequests = MOCK_REQUESTS.filter(req => {
    const matchesCompany = !selectedCompanyId || req.companyId === selectedCompanyId
    const matchesSearch = req.claimNumber.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          req.insuredName.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesCompany && matchesSearch
  })

  const handleExportExcel = () => {
    if (!selectedCompany) return

    // Preparar encabezados y datos para el CSV (Excel compatible)
    const headers = ["Expediente", "Asegurado", "Tipo de Servicio", "Cuenta", "Valor Solicitado", "Valor Aprobado"]
    const rows = filteredRequests.map(req => [
      req.claimNumber,
      req.insuredName,
      req.category,
      req.accountName,
      req.requestedAmount || 0,
      req.approvedAmount || 0
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
                <CardDescription>{MOCK_REQUESTS.filter(r => r.companyId === company.id).length} expedientes listos</CardDescription>
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
            <p className="text-muted-foreground font-medium">Gestión de conciliación y valores a cobrar.</p>
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
            <Receipt className="h-4 w-4 text-primary" /> Expedientes Pendientes de Conciliación
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="font-black uppercase text-[10px]">Expediente</TableHead>
                <TableHead className="font-black uppercase text-[10px]">Asegurado / Cuenta</TableHead>
                <TableHead className="font-black uppercase text-[10px]">Servicio</TableHead>
                <TableHead className="text-right font-black uppercase text-[10px]">Valor Solicitado</TableHead>
                <TableHead className="text-right font-black uppercase text-[10px]">Valor Aprobado</TableHead>
                <TableHead className="text-right font-black uppercase text-[10px]">Margen</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRequests.map((req) => {
                const totalLabor = req.interventions.reduce((sum, i) => sum + i.laborCost, 0)
                const totalUsedExpenses = req.interventions.reduce((sum, i) => 
                  sum + i.detailedExpenses.filter(e => !e.isUnused).reduce((s, e) => s + e.amount, 0), 0
                )
                const totalCost = totalLabor + totalUsedExpenses
                const margin = (req.approvedAmount || 0) - totalCost

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
                      <Badge variant="outline" className="flex items-center gap-1 w-fit bg-slate-50 border-slate-200">
                        <CategoryIcon category={req.category} className="h-3 w-3 text-primary" />
                        <span className="text-[9px] font-black uppercase">{req.category}</span>
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-mono font-bold text-blue-600">${(req.requestedAmount || 0).toLocaleString()}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-mono font-bold text-green-600">${(req.approvedAmount || 0).toLocaleString()}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge className={cn(
                        "font-mono font-black",
                        margin >= 0 ? "bg-green-100 text-green-700" : "bg-destructive/10 text-destructive"
                      )}>
                        ${margin.toLocaleString()}
                      </Badge>
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
          {filteredRequests.length === 0 && (
            <div className="py-20 text-center flex flex-col items-center justify-center text-muted-foreground">
              <Calculator className="h-12 w-12 opacity-10 mb-2" />
              <p className="font-bold uppercase text-xs tracking-widest">No hay expedientes bajo este criterio</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-3">
         <Card className="bg-primary/5 border-primary/20 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-black text-primary uppercase tracking-widest">Total a Cobrar (Aprobado)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black text-primary">
                ${filteredRequests.reduce((sum, r) => sum + (r.approvedAmount || 0), 0).toLocaleString()}
              </div>
            </CardContent>
         </Card>
         <Card className="bg-slate-50 border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Diferencia Solicitada</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black text-slate-700">
                ${filteredRequests.reduce((sum, r) => sum + ((r.requestedAmount || 0) - (r.approvedAmount || 0)), 0).toLocaleString()}
              </div>
            </CardContent>
         </Card>
         <Card className="bg-green-50 border-green-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-black text-green-700 uppercase tracking-widest">Utilidad Estimada</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black text-green-700">
                ${filteredRequests.reduce((sum, r) => {
                   const labor = r.interventions.reduce((s, i) => s + i.laborCost, 0)
                   const expenses = r.interventions.reduce((s, i) => s + i.detailedExpenses.filter(e => !e.isUnused).reduce((se, e) => se + e.amount, 0), 0)
                   return sum + ((r.approvedAmount || 0) - (labor + expenses))
                }, 0).toLocaleString()}
              </div>
            </CardContent>
         </Card>
      </div>
    </div>
  )
}
