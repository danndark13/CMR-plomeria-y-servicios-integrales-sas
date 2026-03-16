"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Receipt, 
  Search, 
  Filter, 
  DollarSign, 
  TrendingDown, 
  FileCheck,
  Building2,
  ChevronRight
} from "lucide-react"
import { MOCK_REQUESTS, MOCK_COMPANIES } from "@/lib/mock-data"
import { CategoryIcon } from "@/components/crm/category-icon"
import Link from "next/link"

export default function BillingReportPage() {
  const [filterCompany, setFilterCompany] = useState<string>("all")
  const [searchTerm, setSearchTerm] = useState("")

  const filteredRequests = MOCK_REQUESTS.filter(req => {
    const matchesCompany = filterCompany === "all" || req.companyId === filterCompany
    const matchesSearch = req.claimNumber.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          req.insuredName.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesCompany && matchesSearch
  })

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-primary">Facturación y Conciliación</h1>
        <p className="text-muted-foreground">Control de valores cobrados vs. gastos operativos por asistencia.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex flex-1 gap-4 w-full md:max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar expediente o asegurado..." 
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={filterCompany} onValueChange={setFilterCompany}>
            <SelectTrigger className="w-[200px]">
              <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Asistencia" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las Asistencias</SelectItem>
              {MOCK_COMPANIES.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button className="gap-2 bg-green-600 hover:bg-green-700 shadow-md">
          <FileCheck className="h-4 w-4" /> Exportar para Factura Electrónica
        </Button>
      </div>

      <Card className="overflow-hidden border-t-4 border-t-primary">
        <CardHeader className="bg-muted/30">
          <CardTitle className="text-lg flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            Servicios Listos para Facturar
          </CardTitle>
          <CardDescription>Consolidado de expedientes con intervenciones cerradas.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-bold">Expediente / Asegurado</TableHead>
                <TableHead className="font-bold">Asistencia / Cuenta</TableHead>
                <TableHead className="font-bold">Servicio</TableHead>
                <TableHead className="text-right font-bold">Valor Cobrado</TableHead>
                <TableHead className="text-right font-bold">Gastos (Costo)</TableHead>
                <TableHead className="text-right font-bold">Margen</TableHead>
                <TableHead className="text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRequests.map((req) => {
                const company = MOCK_COMPANIES.find(c => c.id === req.companyId)
                const totalLabor = req.interventions.reduce((sum, i) => sum + i.laborCost, 0)
                const totalExpenses = req.interventions.reduce((sum, i) => sum + i.expenses, 0)
                const totalCost = totalLabor + totalExpenses
                const margin = (req.requestedAmount || 0) - totalCost

                return (
                  <TableRow key={req.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-mono font-bold text-primary">{req.claimNumber}</span>
                        <span className="text-xs font-medium text-muted-foreground truncate max-w-[150px]">{req.insuredName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-semibold text-sm">{company?.name}</span>
                        <span className="text-[10px] text-muted-foreground">{req.accountName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="flex items-center gap-1 w-fit border-primary/20 bg-primary/5">
                        <CategoryIcon category={req.category} className="h-3 w-3" />
                        <span className="text-[10px]">{req.category}</span>
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-blue-600">
                      ${(req.requestedAmount || 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      ${totalCost.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`font-mono font-bold ${margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ${margin.toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/requests/${req.id}`}>
                        <Button variant="ghost" size="icon">
                          <ChevronRight className="h-4 w-4" />
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
              <TrendingDown className="h-12 w-12 opacity-10 mb-2" />
              <p>No hay servicios pendientes bajo estos criterios.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-3">
         <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase">Total Proyectado Facturación</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                ${filteredRequests.reduce((sum, r) => sum + (r.requestedAmount || 0), 0).toLocaleString()}
              </div>
            </CardContent>
         </Card>
         <Card className="bg-destructive/5 border-destructive/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase">Costo Operativo Acumulado</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                ${filteredRequests.reduce((sum, r) => {
                  const cost = r.interventions.reduce((s, i) => s + i.laborCost + i.expenses, 0)
                  return sum + cost
                }, 0).toLocaleString()}
              </div>
            </CardContent>
         </Card>
         <Card className="bg-green-50 border-green-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase">Utilidad Bruta Estimada</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-700">
                ${filteredRequests.reduce((sum, r) => {
                  const cost = r.interventions.reduce((s, i) => s + i.laborCost + i.expenses, 0)
                  return sum + ((r.requestedAmount || 0) - cost)
                }, 0).toLocaleString()}
              </div>
            </CardContent>
         </Card>
      </div>
    </div>
  )
}
