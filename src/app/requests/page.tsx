
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
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical,
  ArrowUpDown,
  FileText,
  ClipboardList,
  Loader2
} from "lucide-react"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { MOCK_REQUESTS, MOCK_COMPANIES } from "@/lib/mock-data"
import { StatusBadge } from "@/components/crm/status-badge"
import Link from "next/link"
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase'
import { doc } from 'firebase/firestore'

export default function RequestsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const { user } = useUser()
  const db = useFirestore()

  const profileRef = useMemoFirebase(() => {
    if (!user || !db) return null
    return doc(db, 'user_profiles', user.uid)
  }, [user, db])

  const { data: profile, isLoading: isProfileLoading } = useDoc(profileRef)

  const filteredRequests = MOCK_REQUESTS.filter(req => 
    req.claimNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    req.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    MOCK_COMPANIES.find(c => c.id === req.companyId)?.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const role = profile?.roleId
  const canCreate = role === 'Administrador' || role === 'Servicio al Cliente'

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Bitácora de Servicios</h1>
          <p className="text-muted-foreground">Listado de expedientes activos e históricos de la operación.</p>
        </div>
        {canCreate && (
          <Button className="gap-2 shadow-lg h-11 font-bold">
            <Plus className="h-4 w-4" /> Nueva Solicitud
          </Button>
        )}
      </div>

      <Card className="shadow-md border-none overflow-hidden">
        <CardHeader className="p-4 border-b bg-slate-50/50">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar por Expediente o Asistencia..." 
                className="pl-10 h-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-2 h-10">
                <Filter className="h-4 w-4" /> Filtros
              </Button>
              <Button variant="outline" size="sm" className="gap-2 h-10">
                <ArrowUpDown className="h-4 w-4" /> Ordenar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="font-black uppercase text-[10px] tracking-widest">Expediente</TableHead>
                <TableHead className="font-black uppercase text-[10px] tracking-widest">Asistencia / Cuenta</TableHead>
                <TableHead className="font-black uppercase text-[10px] tracking-widest text-center">Estado</TableHead>
                <TableHead className="text-right font-black uppercase text-[10px] tracking-widest">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRequests.map((req) => {
                const companyName = MOCK_COMPANIES.find(c => c.id === req.companyId)?.name || "N/A"
                return (
                  <TableRow key={req.id} className="hover:bg-muted/20 transition-colors group">
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-mono font-black text-primary text-sm">{req.claimNumber}</span>
                        <span className="text-[10px] text-muted-foreground font-bold uppercase">{req.category}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-700 text-sm">{companyName}</span>
                        <span className="text-[10px] text-muted-foreground">{req.accountName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <StatusBadge status={req.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem asChild>
                            <Link href={`/requests/${req.id}`} className="flex items-center gap-2 cursor-pointer">
                              <FileText className="h-4 w-4" /> Ver Expediente
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive font-bold">Cancelar Servicio</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          {filteredRequests.length === 0 && (
            <div className="py-20 text-center flex flex-col items-center justify-center">
              <ClipboardList className="h-12 w-12 text-slate-200 mb-4" />
              <p className="text-lg font-bold text-slate-400">No se encontraron servicios</p>
              <p className="text-sm text-slate-400">Prueba con otro número de expediente o nombre de asistencia.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
