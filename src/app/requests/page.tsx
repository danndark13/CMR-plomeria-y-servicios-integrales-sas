"use client"

import { useState } from "react"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical,
  ArrowUpDown,
  FileText,
  ClipboardList,
  Phone,
  User,
  Wrench
} from "lucide-react"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { MOCK_REQUESTS, MOCK_COMPANIES, MOCK_TECHNICIANS } from "@/lib/mock-data"
import { StatusBadge } from "@/components/crm/status-badge"
import { CategoryIcon } from "@/components/crm/category-icon"
import Link from "next/link"

export default function RequestsPage() {
  const [searchTerm, setSearchTerm] = useState("")

  const filteredRequests = MOCK_REQUESTS.filter(req => 
    req.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    req.accountName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    req.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    req.insuredName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    req.claimNumber.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Solicitudes de Servicio</h1>
          <p className="text-muted-foreground">Historial y seguimiento de intervenciones técnicas.</p>
        </div>
        <Button className="gap-2 shadow-lg">
          <Plus className="h-4 w-4" /> Nueva Solicitud
        </Button>
      </div>

      <Card>
        <CardHeader className="p-4 border-b">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar Expediente, Asegurado o ID..." 
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-2">
                <Filter className="h-4 w-4" /> Filtros
              </Button>
              <Button variant="outline" size="sm" className="gap-2">
                <ArrowUpDown className="h-4 w-4" /> Ordenar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[120px]">Expediente</TableHead>
                <TableHead>Asegurado</TableHead>
                <TableHead>Categoría / Técnicos</TableHead>
                <TableHead>Compañía</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRequests.map((req) => (
                <TableRow key={req.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-mono text-xs font-bold text-primary">{req.claimNumber}</span>
                      <span className="text-[10px] text-muted-foreground">{req.id}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold">{req.insuredName}</span>
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Phone className="h-2.5 w-2.5" /> {req.phoneNumber}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <CategoryIcon category={req.category} className="h-3 w-3 text-accent" />
                        <span className="text-xs font-medium">{req.category}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Wrench className="h-2.5 w-2.5 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">
                          {req.interventions.length > 0 
                            ? `${req.interventions.length} visitas`
                            : "Sin asignar"}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold">{MOCK_COMPANIES.find(c => c.id === req.companyId)?.name}</span>
                      <span className="text-[10px] text-muted-foreground">{req.accountName}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={req.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/requests/${req.id}`} className="flex items-center gap-2">
                            <FileText className="h-4 w-4" /> Gestionar
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem>Añadir Visita</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">Cancelar</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filteredRequests.length === 0 && (
            <div className="py-20 text-center">
              <ClipboardList className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-lg font-medium text-muted-foreground">No se encontraron solicitudes</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
