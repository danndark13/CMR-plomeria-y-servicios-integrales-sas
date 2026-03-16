
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
  ClipboardList,
  ChevronRight,
  Loader2,
  Save,
  Building2,
  User,
  MapPin,
  Phone,
  FileText
} from "lucide-react"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { MOCK_REQUESTS, MOCK_COMPANIES } from "@/lib/mock-data"
import { StatusBadge } from "@/components/crm/status-badge"
import Link from "next/link"
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase'
import { collection, doc, addDoc, serverTimestamp } from 'firebase/firestore'
import { toast } from "@/hooks/use-toast"
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'

export default function RequestsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  
  const { user } = useUser()
  const db = useFirestore()

  // Fetch current user profile
  const profileRef = useMemoFirebase(() => {
    if (!user || !db) return null
    return doc(db, 'user_profiles', user.uid)
  }, [user, db])
  const { data: profile } = useDoc(profileRef)

  // Fetch real requests from Firestore
  const requestsQuery = useMemoFirebase(() => {
    if (!db) return null
    return collection(db, "service_requests")
  }, [db])
  const { data: firestoreRequests, isLoading } = useCollection(requestsQuery)

  // Combined requests (Firestore + Mocks for demo)
  const allRequests = firestoreRequests 
    ? [...firestoreRequests, ...MOCK_REQUESTS.filter(mr => !firestoreRequests.find(fr => fr.claimNumber === mr.claimNumber))]
    : MOCK_REQUESTS

  const filteredRequests = allRequests.filter(req => 
    (req.claimNumber || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (req.id || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (req.insuredName || "").toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())

  // Fetch Companies for the form
  const companiesQuery = useMemoFirebase(() => db ? collection(db, "assistance_companies") : null, [db])
  const { data: companies } = useCollection(companiesQuery)
  const allCompanies = companies || MOCK_COMPANIES

  const handleCreateService = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db) return

    setIsProcessing(true)
    const formData = new FormData(e.currentTarget)
    
    const newService = {
      claimNumber: (formData.get("claimNumber") as string).toUpperCase(),
      category: formData.get("category") as string,
      companyId: formData.get("companyId") as string,
      accountName: formData.get("accountName") as string,
      insuredName: formData.get("insuredName") as string,
      address: formData.get("address") as string,
      phoneNumber: formData.get("phoneNumber") as string,
      description: formData.get("description") as string,
      status: 'pending',
      interventions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: user?.uid
    }

    const colRef = collection(db, "service_requests")
    addDoc(colRef, newService)
      .then(() => {
        toast({ title: "Servicio Creado", description: `El expediente ${newService.claimNumber} ha sido registrado.` })
        setIsCreating(false)
      })
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: colRef.path,
          operation: "create",
          requestResourceData: newService,
        })
        errorEmitter.emit("permission-error", permissionError)
      })
      .finally(() => setIsProcessing(false))
  }

  const role = profile?.roleId
  const canCreate = role === 'Administrador' || role === 'Servicio al Cliente'

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-primary uppercase">Bitácora de Servicios</h1>
          <p className="text-muted-foreground font-medium">Listado de expedientes activos e históricos de la operación.</p>
        </div>
        {canCreate && (
          <Button className="gap-2 shadow-lg h-12 font-bold" onClick={() => setIsCreating(true)}>
            <Plus className="h-5 w-5" /> Crear un nuevo servicio
          </Button>
        )}
      </div>

      <Card className="shadow-md border-none overflow-hidden">
        <CardHeader className="p-4 border-b bg-slate-50/50">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar por Expediente, Cliente..." 
                className="pl-10 h-10 font-medium"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-2 h-10 font-bold">
                <Filter className="h-4 w-4" /> Filtros
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="font-black uppercase text-[10px] tracking-widest">Expediente / Categoría</TableHead>
                <TableHead className="font-black uppercase text-[10px] tracking-widest">Asistencia / Cliente</TableHead>
                <TableHead className="font-black uppercase text-[10px] tracking-widest text-center">Estado</TableHead>
                <TableHead className="text-right font-black uppercase text-[10px] tracking-widest">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-40 text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary/20" />
                    <p className="mt-2 text-[10px] font-black uppercase text-muted-foreground tracking-widest">Sincronizando bitácora...</p>
                  </TableCell>
                </TableRow>
              ) : filteredRequests.map((req) => {
                const companyName = allCompanies.find(c => c.id === req.companyId)?.name || "N/A"
                return (
                  <TableRow key={req.id} className="hover:bg-primary/5 transition-colors group">
                    <TableCell>
                      <Link href={`/requests/${req.id}`} className="flex flex-col">
                        <span className="font-mono font-black text-primary text-sm">{req.claimNumber}</span>
                        <span className="text-[10px] text-muted-foreground font-black uppercase tracking-tighter">{req.category}</span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-700 text-sm truncate max-w-[200px]">{req.insuredName}</span>
                        <span className="text-[10px] text-muted-foreground font-medium uppercase">{companyName} • {req.accountName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <StatusBadge status={req.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/requests/${req.id}`}>
                          <Button variant="outline" size="sm" className="h-8 gap-1 font-bold text-xs border-primary/20 text-primary hover:bg-primary/5">
                            Ver Detalle <ChevronRight className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          {!isLoading && filteredRequests.length === 0 && (
            <div className="py-20 text-center flex flex-col items-center justify-center">
              <ClipboardList className="h-12 w-12 text-slate-200 mb-4" />
              <p className="text-lg font-bold text-slate-400">No se encontraron servicios</p>
              <p className="text-sm text-slate-400 font-medium">Prueba con otro número de expediente o nombre de cliente.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog for Creating New Service */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-primary">Apertura de Expediente</DialogTitle>
            <DialogDescription>Ingrese la información del nuevo servicio solicitado por la asistencia.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateService} className="space-y-6 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">N° de Expediente / Claim</Label>
                <div className="relative">
                  <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input name="claimNumber" placeholder="EJ: EXP-123456" required className="pl-10 font-mono font-bold uppercase" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">Categoría de Servicio</Label>
                <Select name="category" required>
                  <SelectTrigger className="font-bold">
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Plomería">Plomería</SelectItem>
                    <SelectItem value="Electricidad">Electricidad</SelectItem>
                    <SelectItem value="Cerrajería">Cerrajería</SelectItem>
                    <SelectItem value="Vidriería">Vidriería</SelectItem>
                    <SelectItem value="Trabajo en Alturas">Trabajo en Alturas</SelectItem>
                    <SelectItem value="Instalación">Instalación</SelectItem>
                    <SelectItem value="Destaponamiento">Destaponamiento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">Empresa de Asistencia</Label>
                <Select name="companyId" required>
                  <SelectTrigger className="font-bold">
                    <SelectValue placeholder="Seleccionar aliando" />
                  </SelectTrigger>
                  <SelectContent>
                    {allCompanies.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">Cuenta / Asegurado</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input name="accountName" placeholder="EJ: COOMEVA" required className="pl-10 font-bold uppercase" />
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border-2 border-dashed space-y-4">
               <p className="text-[11px] font-black uppercase text-primary tracking-widest border-b pb-2">Datos del Cliente Final</p>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest">Nombre Completo</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input name="insuredName" placeholder="Juan Perez" required className="pl-10 font-bold" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest">Teléfono</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input name="phoneNumber" placeholder="310 000 0000" required className="pl-10 font-bold" />
                    </div>
                  </div>
               </div>
               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest">Dirección de Visita</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input name="address" placeholder="Calle 1 #2-3" required className="pl-10 font-medium" />
                  </div>
               </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest">Descripción de la Solicitud</Label>
              <Textarea name="description" placeholder="Describa el problema reportado..." className="min-h-[80px]" required />
            </div>

            <DialogFooter className="gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsCreating(false)} disabled={isProcessing} className="font-bold">CANCELAR</Button>
              <Button type="submit" disabled={isProcessing} className="font-black gap-2 shadow-lg h-12">
                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} CREAR SERVICIO
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
