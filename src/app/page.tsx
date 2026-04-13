
"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { 
  ClipboardList, 
  Clock, 
  CheckCircle2, 
  CalendarDays,
  ArrowUpRight,
  MapPin,
  User,
  AlertCircle,
  BellRing,
  AlertTriangle,
  Calculator,
  ArrowRight,
  History,
  Plus,
  Loader2,
  Save,
  Building2,
  Phone,
  FileText
} from "lucide-react"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { MOCK_REQUESTS, MOCK_COMPANIES, MOCK_TECHNICIANS, MOCK_REMINDERS } from "@/lib/mock-data"
import { StatusBadge } from "@/components/crm/status-badge"
import { CategoryIcon } from "@/components/crm/category-icon"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase'
import { collection, doc, addDoc, setDoc } from 'firebase/firestore'
import { toast } from "@/hooks/use-toast"
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'
import { cn } from "@/lib/utils"
import { ServiceRequest } from "@/lib/types"

export default function DashboardPage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  
  // States for dynamic account selection
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("")
  const [selectedAccountName, setSelectedAccountName] = useState<string>("")
  const [isAddingNewAccount, setIsAddingNewAccount] = useState(false)
  
  const { user, isUserLoading } = useUser()
  const db = useFirestore()

  const profileRef = useMemoFirebase(() => {
    if (!user || !db) return null
    return doc(db, 'user_profiles', user.uid)
  }, [user, db])
  const { data: profile } = useDoc(profileRef)

  const requestsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return collection(db, "service_requests")
  }, [db, user])
  const { data: firestoreRequests } = useCollection(requestsQuery)

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

  useEffect(() => {
    setMounted(true)
  }, [])

  const isTech = profile?.roleId === 'Técnico'
  const isAdmin = profile?.roleId === 'Administrador' || profile?.roleId === 'Gerente'

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
        req.interventions?.some((i: any) => i.technicianId === profile.username) ||
        req.scheduledVisit?.technicianId === profile.username
      );
    }

    return combined
  }, [firestoreRequests, isTech, profile])

  const allCompanies = useMemo(() => {
    return (firestoreCompanies && firestoreCompanies.length > 0) ? firestoreCompanies : MOCK_COMPANIES
  }, [firestoreCompanies])

  const currentCompany = useMemo(() => {
    return allCompanies.find(c => c.id === selectedCompanyId)
  }, [allCompanies, selectedCompanyId])

  const availableAccounts = useMemo(() => {
    if (!selectedCompanyId) return []
    
    const mockAccounts = currentCompany?.accounts || []
    const dbAccounts = (firestoreAccounts || [])
      .filter(acc => acc.assistanceCompanyId === selectedCompanyId)
      .map(acc => acc.name)
    
    return Array.from(new Set([...mockAccounts, ...dbAccounts])).sort()
  }, [selectedCompanyId, currentCompany, firestoreAccounts])

  if (!mounted || isUserLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="h-16 w-16 rounded-2xl bg-white shadow-xl flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary opacity-40" />
        </div>
        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Cargando Panel Operativo...</p>
      </div>
    )
  }

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
      address: (formData.get("address") as string).toUpperCase(),
      city: (formData.get("city") as string).toUpperCase(),
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

  const todayStr = new Date().toLocaleDateString()
  const todayVisits = allRequests.flatMap((req: ServiceRequest) => 
    (req.interventions || [])
      .filter((i: any) => new Date(i.date).toLocaleDateString() === todayStr && (isTech ? i.technicianId === profile?.username : true))
      .map((i: any) => ({ ...i, request: req }))
  ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  const canCreate = isAdmin || profile?.roleId === 'Servicio al Cliente'

  if (isTech) {
    return (
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-primary uppercase">Mi Panel Técnico</h1>
          <p className="text-muted-foreground font-medium">Gestiona tus servicios asignados y agenda diaria.</p>
        </div>

        <div className="grid gap-8 lg:grid-cols-12">
          <Card className="lg:col-span-7 border-accent/20 bg-accent/5 shadow-sm overflow-hidden">
            <CardHeader className="bg-accent/10 border-b">
              <CardTitle className="text-lg flex items-center gap-2 text-accent-foreground font-black uppercase">
                <CalendarDays className="h-5 w-5 text-accent" /> Mi Agenda Hoy
              </CardTitle>
              <CardDescription className="text-accent-foreground/70 font-bold uppercase text-[10px]">Visitas programadas para el día de hoy.</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                {todayVisits.length > 0 ? (
                  todayVisits.map((visit) => (
                    <div key={`${visit.id}-${visit.request.id}`} className="p-4 bg-white rounded-xl border border-accent/20 shadow-sm space-y-3 group hover:border-accent transition-all">
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded uppercase">{visit.request.claimNumber}</span>
                        <span className="text-xs font-mono font-black text-accent">
                          {new Date(visit.date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-black uppercase text-slate-700">{visit.request.insuredName}</p>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1 mt-1">
                          <MapPin className="h-3 w-3" /> {visit.request.address} • {visit.request.city}
                        </p>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-dashed">
                         <StatusBadge status={visit.request.status} />
                         <Link href={`/requests/${visit.request.id}`}>
                           <Button size="sm" className="h-8 text-[10px] bg-accent hover:bg-accent/90 font-black uppercase">Iniciar Reporte</Button>
                         </Link>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-20 text-center text-muted-foreground">
                    <CalendarDays className="h-12 w-12 mx-auto opacity-10 mb-4" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Sin servicios para hoy</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-5 shadow-sm border-l-4 border-l-primary">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2 font-black uppercase">
                <History className="h-5 w-5 text-primary" /> Mis Últimos 4 Servicios
              </CardTitle>
              <CardDescription className="font-bold uppercase text-[10px]">Historial reciente de intervenciones.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {allRequests.slice(0, 4).map((req) => (
                  <Link href={`/requests/${req.id}`} key={req.id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-muted/50 transition-colors group border border-transparent hover:border-primary/10">
                    <div className="h-10 w-10 shrink-0 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                      <CategoryIcon category={req.category} className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black truncate text-primary uppercase">{req.claimNumber}</p>
                      <p className="text-[9px] text-muted-foreground font-bold uppercase truncate">{req.insuredName}</p>
                    </div>
                    <StatusBadge status={req.status} />
                  </Link>
                ))}
                <Link href="/requests">
                  <Button variant="ghost" className="w-full mt-4 text-[10px] font-black uppercase gap-2 hover:text-primary">
                    Ver Bitácora Completa <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-primary uppercase">Panel Principal</h1>
          <p className="text-muted-foreground font-medium">Control de servicios, alertas técnicas y agenda diaria.</p>
        </div>
        <div className="flex gap-2">
          {canCreate && (
            <Button className="gap-2 shadow-lg h-12 font-black bg-primary hover:bg-primary/90" onClick={() => setIsCreating(true)}>
              <Plus className="h-5 w-5" /> APERTURA DE EXPEDIENTE
            </Button>
          )}
          <Link href="/calendar">
            <Button variant="outline" className="gap-2 border-primary text-primary hover:bg-primary/5 h-12 font-bold">
              <CalendarDays className="h-4 w-4" /> Calendario
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-destructive/20 bg-destructive/5 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-destructive font-black uppercase">
              <AlertTriangle className="h-5 w-5" /> Sobrecarga Técnica
            </CardTitle>
            <CardDescription className="text-destructive/70 font-bold uppercase text-[10px]">Técnicos con exceso de tareas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {MOCK_TECHNICIANS.filter(t => t.activeTasks > 3).map((tech) => (
              <div key={tech.id} className="p-3 bg-white rounded-lg border border-destructive/20 flex justify-between items-center shadow-sm">
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-slate-800 uppercase">{tech.name}</span>
                  <span className="text-[9px] text-muted-foreground font-black uppercase">{tech.specialties.slice(0,2).join(" • ")}</span>
                </div>
                <Badge variant="destructive" className="h-6 px-2 animate-pulse font-black text-[10px]">
                  {tech.activeTasks} ACTIVOS
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-accent/20 bg-accent/5 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-accent-foreground font-black uppercase">
              <CalendarDays className="h-5 w-5 text-accent" /> Servicios Hoy
            </CardTitle>
            <CardDescription className="text-accent-foreground/70 font-bold uppercase text-[10px]">Visitas técnicas agendadas.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {todayVisits.length > 0 ? (
                todayVisits.slice(0, 4).map((visit) => {
                  const tech = MOCK_TECHNICIANS.find(t => t.id === visit.technicianId)
                  return (
                    <div key={`${visit.id}-${visit.request.id}`} className="p-3 bg-white rounded-lg border border-accent/20 shadow-sm space-y-2 group hover:border-accent transition-colors">
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded uppercase">{visit.request.claimNumber}</span>
                        <span className="text-xs font-mono font-black text-accent">
                          {new Date(visit.date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-sm font-black truncate uppercase text-slate-700">{visit.request.insuredName}</p>
                      <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground uppercase">
                         <div className="flex items-center gap-1"><User className="h-3 w-3" /> {tech?.name}</div>
                         <Link href={`/requests/${visit.request.id}`}>
                           <Button variant="ghost" size="sm" className="h-6 text-[9px] text-accent font-black hover:bg-accent/10 uppercase">Ver Detalle</Button>
                         </Link>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="py-12 text-center text-muted-foreground text-[10px] font-bold uppercase italic">
                  Sin visitas agendadas para hoy.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-l-4 border-l-primary">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 font-black uppercase">
              <History className="h-5 w-5 text-primary" /> Últimos Ingresos
            </CardTitle>
            <CardDescription className="font-bold uppercase text-[10px]">Expedientes recientes.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {allRequests.slice(0, 5).map((req) => {
                const companyName = allCompanies.find(c => c.id === req.companyId)?.name || "Asistencia"
                return (
                  <Link href={`/requests/${req.id}`} key={req.id} className="flex items-center gap-4 p-2 rounded-lg hover:bg-muted/50 transition-colors group">
                    <div className="h-9 w-9 shrink-0 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                      <CategoryIcon category={req.category} className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black truncate text-primary uppercase">{req.claimNumber}</p>
                      <p className="text-[9px] text-muted-foreground font-bold uppercase truncate">{companyName} • {req.accountName}</p>
                    </div>
                    <StatusBadge status={req.status} />
                  </Link>
                )
              })}
              <Link href="/requests">
                <Button variant="ghost" size="sm" className="w-full mt-2 text-[10px] font-black uppercase gap-2 hover:text-primary">
                  Ver Bitácora Completa <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

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
            <DialogDescription className="font-bold">Registro de nuevo servicio con selección dinámica de cuentas.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateService} className="space-y-6 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">N° de Expediente / Claim</Label>
                <div className="relative">
                  <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input name="claimNumber" placeholder="EJ: EXP-123456" required className="pl-10 font-mono font-black uppercase h-12 border-primary/20" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Categoría de Servicio</Label>
                <Select name="category" required>
                  <SelectTrigger className="font-black uppercase h-12 border-primary/20">
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
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Empresa de Asistencia</Label>
                <Select value={selectedCompanyId} onValueChange={(v) => {
                  setSelectedCompanyId(v)
                  setSelectedAccountName("")
                  setIsAddingNewAccount(false)
                }} required>
                  <SelectTrigger className="font-black uppercase h-12 border-primary/20">
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
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cuenta Cliente</Label>
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
                  <SelectTrigger className="font-black uppercase h-12 border-primary/20">
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
                    className="pl-10 font-black uppercase h-12 border-primary ring-offset-background"
                  />
                </div>
              </div>
            )}

            <div className="p-4 bg-slate-50 rounded-xl border-2 border-dashed border-primary/10 space-y-4">
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
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest">Dirección de Visita</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input name="address" placeholder="Calle 1 #2-3" required className="pl-10 font-medium h-10 uppercase" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest">Ciudad</Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input name="city" placeholder="Ej. Bogota" required className="pl-10 font-bold uppercase h-10" />
                    </div>
                  </div>
               </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Descripción de la Solicitud</Label>
              <Textarea name="description" placeholder="Describa el problema reportado..." className="min-h-[80px] font-medium" required />
            </div>

            <DialogFooter className="gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsCreating(false)} disabled={isProcessing} className="font-bold h-12 px-8">CANCELAR</Button>
              <Button type="submit" disabled={isProcessing} className="font-black gap-2 shadow-lg h-12 px-10 bg-primary hover:bg-primary/90 uppercase tracking-widest">
                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} CREAR SERVICIO
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
