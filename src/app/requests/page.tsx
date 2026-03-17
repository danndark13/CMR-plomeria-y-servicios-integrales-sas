
"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
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
  ClipboardList, 
  ChevronRight,
  Loader2,
  Save,
  Building2,
  User,
  MapPin,
  Phone,
  FileText,
  FileSpreadsheet,
  X
} from "lucide-react"
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
import { MOCK_REQUESTS, MOCK_COMPANIES, MOCK_TECHNICIANS } from "@/lib/mock-data"
import { StatusBadge } from "@/components/crm/status-badge"
import Link from "next/link"
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase'
import { collection, doc, addDoc, setDoc } from 'firebase/firestore'
import { toast } from "@/hooks/use-toast"
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'
import { ServiceRequest } from "@/lib/types"
import { cn } from "@/lib/utils"

export default function RequestsPage() {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>("ALL")
  const [isCreating, setIsCreating] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  
  // States for dynamic account selection
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("")
  const [selectedAccountName, setSelectedAccountName] = useState<string>("")
  const [isAddingNewAccount, setIsAddingNewAccount] = useState(false)
  
  const { user, isUserLoading } = useUser()
  const db = useFirestore()

  // Fetch current user profile
  const profileRef = useMemoFirebase(() => {
    if (!user || !db) return null
    return doc(db, 'user_profiles', user.uid)
  }, [user, db])
  const { data: profile } = useDoc(profileRef)

  // Fetch real requests from Firestore
  const requestsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return collection(db, "service_requests")
  }, [db, user])
  const { data: firestoreRequests, isLoading: isRequestsLoading } = useCollection(requestsQuery)

  // Fetch Companies and Accounts
  const companiesQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return collection(db, "assistance_companies")
  }, [db, user])
  const { data: firestoreCompanies } = useCollection(companiesQuery)

  const clientAccountsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return collection(db, "client_accounts")
  }, [db, user])
  const { data: firestoreAccounts } = useCollection(clientAccountsQuery)

  const isTech = profile?.roleId === 'Técnico'
  const isDev = profile?.roleId === 'Desarrollador'
  const isAdmin = profile?.roleId === 'Administrador' || profile?.roleId === 'Gerente' || isDev

  const allRequests = useMemo(() => {
    const combined = [...(firestoreRequests || [])]
    const seenIds = new Set(combined.map(r => r.id))
    const seenClaims = new Set(combined.map(r => r.claimNumber?.toUpperCase()))
    
    for (const mock of MOCK_REQUESTS) {
      const mockClaim = mock.claimNumber?.toUpperCase()
      if (!seenIds.has(mock.id) && !seenClaims.has(mockClaim)) {
        combined.push(mock)
        seenIds.add(mock.id)
        seenClaims.add(mockClaim)
      }
    }

    if (isTech && profile) {
      return combined.filter(req => 
        req.interventions?.some(i => i.technicianId === profile.username) ||
        req.scheduledVisit?.technicianId === profile.username
      );
    }

    return combined
  }, [firestoreRequests, isTech, profile])

  const filteredRequests = useMemo(() => {
    return allRequests.filter(req => {
      const matchesSearch = (
        (req.claimNumber || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (req.insuredName || "").toLowerCase().includes(searchTerm.toLowerCase())
      )
      const matchesCompany = selectedCompanyFilter === "ALL" || req.companyId === selectedCompanyFilter
      return matchesSearch && matchesCompany
    }).sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
  }, [allRequests, searchTerm, selectedCompanyFilter])

  const allCompanies = useMemo(() => {
    const combined = [...(firestoreCompanies || [])]
    const seenIds = new Set(combined.map(c => c.id))
    MOCK_COMPANIES.forEach(mc => {
      if (!seenIds.has(mc.id)) combined.push(mc)
    })
    return combined
  }, [firestoreCompanies])

  // Dynamic accounts logic
  const currentCompany = allCompanies.find(c => c.id === selectedCompanyId)
  const availableAccounts = useMemo(() => {
    if (!selectedCompanyId) return []
    const mockAccounts = currentCompany?.accounts || []
    const dbAccounts = (firestoreAccounts || [])
      .filter(acc => acc.assistanceCompanyId === selectedCompanyId)
      .map(acc => acc.name)
    return Array.from(new Set([...mockAccounts, ...dbAccounts])).sort()
  }, [selectedCompanyId, currentCompany, firestoreAccounts])

  const handleCreateService = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db || !user) return

    setIsProcessing(true)
    const formData = new FormData(e.currentTarget)
    
    let finalAccountName = selectedAccountName
    if (isAddingNewAccount) {
      finalAccountName = (formData.get("newAccountName") as string || "").toUpperCase().trim()
      
      if (finalAccountName && selectedCompanyId) {
        const newAccId = Math.random().toString(36).substring(7).toUpperCase()
        const newAccRef = doc(db, "client_accounts", newAccId)
        setDoc(newAccRef, {
          id: newAccId,
          name: finalAccountName,
          assistanceCompanyId: selectedCompanyId,
          createdAt: new Date().toISOString()
        }).catch(err => console.error("Error saving new account:", err))
      }
    }

    const newService = {
      claimNumber: (formData.get("claimNumber") as string).toUpperCase(),
      category: formData.get("category") as string,
      companyId: selectedCompanyId,
      accountName: finalAccountName,
      insuredName: (formData.get("insuredName") as string).toUpperCase(),
      address: formData.get("address") as string,
      phoneNumber: formData.get("phoneNumber") as string,
      description: formData.get("description") as string,
      status: 'pending',
      interventions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: user.uid,
      billingStatus: 'pending'
    }

    const colRef = collection(db, "service_requests")
    addDoc(colRef, newService)
      .then((docRef) => {
        toast({ title: "Servicio Creado", description: `El expediente ${newService.claimNumber} ha sido registrado.` })
        setIsCreating(false)
        router.push(`/requests/${docRef.id}`)
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

  const handleExportExcel = () => {
    const headers = [
      "Expediente", "Fecha", "Asistencia", "Cuenta", "Asegurado", "Dirección", "Tipo de Servicio"
    ]

    const csvRows = filteredRequests.map(req => {
      const companyName = allCompanies.find(c => c.id === req.companyId)?.name || "N/A"

      return [
        req.claimNumber,
        new Date(req.createdAt || "").toLocaleDateString(),
        companyName,
        req.accountName,
        req.insuredName,
        (req.address || "").replace(/,/g, " "),
        req.category
      ]
    })

    const csvContent = [
      headers.join(","),
      ...csvRows.map(row => row.join(","))
    ].join("\n")

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.body.appendChild(document.createElement("a"))
    const url = URL.createObjectURL(blob)
    link.href = url
    link.download = `Bitacora_${selectedCompanyFilter === "ALL" ? "Global" : selectedCompanyFilter}_RYS_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    document.body.removeChild(link)

    toast({ title: "Planilla Generada" })
  }

  const canCreate = isAdmin || profile?.roleId === 'Servicio al Cliente'
  const canExport = isAdmin || profile?.roleId === 'Servicio al Cliente' || profile?.roleId === 'Contabilidad'
  const isLoadingTotal = isUserLoading || isRequestsLoading

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-primary uppercase">Bitácora de Servicios</h1>
          <p className="text-muted-foreground font-medium">
            {profile?.roleId === 'Técnico' ? 'Tus servicios registrados y programados.' : 'Listado de expedientes activos e históricos.'}
          </p>
        </div>
        <div className="flex gap-2">
          {canExport && (
            <Button variant="outline" className="gap-2 font-bold border-green-600 text-green-600 hover:bg-green-50" onClick={handleExportExcel}>
              <FileSpreadsheet className="h-4 w-4" /> Exportar Planilla
            </Button>
          )}
          {canCreate && (
            <Button className="gap-2 shadow-lg h-10 font-bold" onClick={() => setIsCreating(true)}>
              <Plus className="h-5 w-5" /> Crear un nuevo servicio
            </Button>
          )}
        </div>
      </div>

      <Card className="shadow-md border-none overflow-hidden">
        <CardHeader className="p-4 border-b bg-slate-50/50">
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            <div className="relative w-full lg:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar por Expediente, Cliente..." 
                className="pl-10 h-10 font-medium"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            {!isTech && (
              <div className="flex items-center gap-3 w-full lg:w-auto">
                <span className="text-[10px] font-black uppercase text-muted-foreground shrink-0"><Filter className="h-3 w-3 inline mr-1" /> Empresa:</span>
                <Select value={selectedCompanyFilter} onValueChange={setSelectedCompanyFilter}>
                  <SelectTrigger className="h-10 w-full lg:w-[220px] font-bold uppercase text-[11px] border-primary/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">TODAS LAS EMPRESAS</SelectItem>
                    {allCompanies.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="font-black uppercase text-[10px] tracking-widest">Expediente / Categoría</TableHead>
                <TableHead className="font-black uppercase text-[10px] tracking-widest">Cliente / Cuenta</TableHead>
                {!isTech && <TableHead className="font-black uppercase text-[10px] tracking-widest text-center">Estado</TableHead>}
                {isTech && <TableHead className="font-black uppercase text-[10px] tracking-widest">Dirección / Ciudad</TableHead>}
                <TableHead className="text-right font-black uppercase text-[10px] tracking-widest">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingTotal ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-40 text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary/20" />
                    <p className="mt-2 text-[10px] font-black uppercase text-muted-foreground tracking-widest">Sincronizando bitácora...</p>
                  </TableCell>
                </TableRow>
              ) : filteredRequests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-40 text-center text-muted-foreground italic">No se encontraron servicios con los filtros aplicados.</TableCell>
                </TableRow>
              ) : filteredRequests.map((req) => {
                return (
                  <TableRow 
                    key={req.id} 
                    className="hover:bg-primary/5 transition-colors group cursor-pointer"
                    onClick={() => router.push(`/requests/${req.id}`)}
                  >
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-mono font-black text-primary text-sm">{req.claimNumber}</span>
                        <span className="text-[10px] text-muted-foreground font-black uppercase tracking-tighter">{req.category}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-700 text-sm truncate max-w-[200px] uppercase">{req.insuredName}</span>
                        <span className="text-[10px] text-muted-foreground font-medium uppercase">{req.accountName}</span>
                      </div>
                    </TableCell>
                    {!isTech && (
                      <TableCell className="text-center">
                        <StatusBadge status={req.status} />
                      </TableCell>
                    )}
                    {isTech && (
                      <TableCell>
                        <span className="text-[10px] font-bold text-slate-500 uppercase">{req.address}</span>
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="sm" className="h-8 gap-1 font-bold text-xs border-primary/20 text-primary hover:bg-primary/5">
                          Ver Detalle <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isCreating} onOpenChange={(open) => {
        setIsCreating(open)
        if (!open) {
          setSelectedCompanyId("")
          setSelectedAccountName("")
          setIsAddingNewAccount(false)
        }
      }}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-primary">Apertura de Expediente</DialogTitle>
            <DialogDescription>Seleccione la asistencia y la cuenta cliente de forma dinámica.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateService} className="space-y-6 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">N° de Expediente / Claim</Label>
                <div className="relative">
                  <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input name="claimNumber" placeholder="EJ: EXP-123456" required className="pl-10 font-mono font-bold uppercase h-12" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">Categoría de Servicio</Label>
                <Select name="category" required>
                  <SelectTrigger className="font-bold h-12">
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
                    <SelectItem value="Taponamiento">Taponamiento</SelectItem>
                    <SelectItem value="Impermeabilización">Impermeabilización</SelectItem>
                    <SelectItem value="Garantía">Garantía</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">Empresa de Asistencia</Label>
                <Select value={selectedCompanyId} onValueChange={(v) => {
                  setSelectedCompanyId(v)
                  setSelectedAccountName("")
                  setIsAddingNewAccount(false)
                }} required>
                  <SelectTrigger className="font-bold h-12">
                    <SelectValue placeholder="Seleccionar aliado" />
                  </SelectTrigger>
                  <SelectContent>
                    {allCompanies.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">Cuenta Cliente</Label>
                <Select 
                  value={isAddingNewAccount ? "NEW" : selectedAccountName} 
                  onValueChange={(v) => {
                    if (v === "NEW") {
                      setIsAddingNewAccount(true)
                      setSelectedAccountName("")
                    } else {
                      setIsAddingNewAccount(false)
                      setSelectedAccountName(v)
                    }
                  }} 
                  disabled={!selectedCompanyId}
                  required={!isAddingNewAccount}
                >
                  <SelectTrigger className="font-bold h-12">
                    <SelectValue placeholder={selectedCompanyId ? "Seleccionar cuenta" : "Primero elija asistencia"} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableAccounts.map(acc => (
                      <SelectItem key={acc} value={acc}>{acc}</SelectItem>
                    ))}
                    <SelectItem value="NEW" className="font-bold text-primary italic">+ OTRA (Agregar nueva...)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isAddingNewAccount && (
              <div className="space-y-2 animate-in slide-in-from-top-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Nombre de la Nueva Cuenta</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                  <Input 
                    name="newAccountName" 
                    placeholder="Escriba el nombre de la cuenta..." 
                    required 
                    className="pl-10 font-black uppercase h-12 border-primary"
                  />
                </div>
              </div>
            )}

            <div className="p-4 bg-slate-50 rounded-xl border-2 border-dashed space-y-4">
               <p className="text-[11px] font-black uppercase text-primary tracking-widest border-b pb-2">Datos del Cliente Final</p>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest">Nombre Completo</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input name="insuredName" placeholder="Juan Perez" required className="pl-10 font-bold uppercase h-10" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest">Teléfono</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input name="phoneNumber" placeholder="310 000 0000" required className="pl-10 font-bold h-10" />
                    </div>
                  </div>
               </div>
               <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest">Dirección de Visita</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input name="address" placeholder="Calle 1 #2-3" required className="pl-10 font-medium h-10" />
                  </div>
               </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Descripción de la Solicitud</Label>
              <Textarea name="description" placeholder="Describa el problema reportado..." className="min-h-[80px]" required />
            </div>

            <DialogFooter className="gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsCreating(false)} disabled={isProcessing} className="font-bold h-12 px-8">CANCELAR</Button>
              <Button type="submit" disabled={isProcessing} className="font-black gap-2 shadow-lg h-12 px-10">
                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} CREAR SERVICIO
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
