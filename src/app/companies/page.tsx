
"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Plus, 
  Building2, 
  ChevronRight, 
  Briefcase, 
  Loader2, 
  Save, 
  X, 
  Mail, 
  Phone, 
  User as UserIcon,
  MoreVertical,
  Edit2,
  Trash2,
  AlertTriangle
} from "lucide-react"
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from "@/firebase"
import { collection, doc, setDoc, updateDoc, deleteDoc } from "firebase/firestore"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/hooks/use-toast"
import { errorEmitter } from "@/firebase/error-emitter"
import { FirestorePermissionError } from "@/firebase/errors"
import { MOCK_COMPANIES } from "@/lib/mock-data"

export default function CompaniesPage() {
  const db = useFirestore()
  const { user } = useUser()
  
  const [isCompanyDialogOpen, setIsCompanyDialogOpen] = useState(false)
  const [editingCompany, setEditingCompany] = useState<any>(null)
  const [companyToDelete, setCompanyToDelete] = useState<any>(null)
  
  const [isAddingAccount, setIsAddingAccount] = useState(false)
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  // Fetch current user profile for role check
  const profileRef = useMemoFirebase(() => {
    if (!user || !db) return null
    return doc(db, "user_profiles", user.uid)
  }, [user, db])
  const { data: profile } = useDoc(profileRef)
  
  // BOTH Administrador and Gerente are admins
  const isAdmin = profile?.roleId === "Administrador" || profile?.roleId === "Gerente"

  // Fetch companies and accounts from Firestore
  const companiesQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return collection(db, "assistance_companies")
  }, [db, user])
  const { data: firestoreCompanies, isLoading: loadingCompanies } = useCollection(companiesQuery)

  const accountsQuery = useMemoFirebase(() => {
    if (!db || !user) return null
    return collection(db, "client_accounts")
  }, [db, user])
  const { data: firestoreAccounts, isLoading: loadingAccounts } = useCollection(accountsQuery)

  // Combine Firestore and Mock Data
  const allCompanies = useMemo(() => {
    const combined = [...(firestoreCompanies || [])]
    const seenIds = new Set(combined.map(c => c.id))
    
    MOCK_COMPANIES.forEach(mock => {
      if (!seenIds.has(mock.id)) {
        combined.push(mock)
        seenIds.add(mock.id)
      }
    })
    return combined
  }, [firestoreCompanies])

  const handleSaveCompany = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db) return

    setIsProcessing(true)
    const formData = new FormData(e.currentTarget)
    
    const companyData = {
      name: (formData.get("name") as string).toUpperCase(),
      contactPerson: formData.get("contactPerson") as string,
      contactEmail: formData.get("contactEmail") as string,
      contactPhone: formData.get("contactPhone") as string,
    }

    if (editingCompany) {
      const docRef = doc(db, "assistance_companies", editingCompany.id)
      updateDoc(docRef, companyData)
        .then(() => {
          toast({ title: "Empresa Actualizada", description: `${companyData.name} ha sido modificada.` })
          setIsCompanyDialogOpen(false)
          setEditingCompany(null)
        })
        .catch(async (error) => {
          const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: "update",
            requestResourceData: companyData,
          })
          errorEmitter.emit("permission-error", permissionError)
        })
        .finally(() => setIsProcessing(false))
    } else {
      const companyId = Math.random().toString(36).substring(7).toUpperCase()
      const docRef = doc(db, "assistance_companies", companyId)
      setDoc(docRef, { ...companyData, id: companyId })
        .then(() => {
          toast({ title: "Empresa Registrada", description: `${companyData.name} ha sido añadida exitosamente.` })
          setIsCompanyDialogOpen(false)
        })
        .catch(async (error) => {
          const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: "create",
            requestResourceData: { ...companyData, id: companyId },
          })
          errorEmitter.emit("permission-error", permissionError)
        })
        .finally(() => setIsProcessing(false))
    }
  }

  const handleDeleteCompany = async () => {
    if (!db || !companyToDelete) return

    setIsProcessing(true)
    const docRef = doc(db, "assistance_companies", companyToDelete.id)
    
    deleteDoc(docRef)
      .then(() => {
        toast({ title: "Empresa Eliminada", description: "El registro ha sido removido de la base de datos." })
        setCompanyToDelete(null)
      })
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: docRef.path,
          operation: "delete",
        })
        errorEmitter.emit("permission-error", permissionError)
      })
      .finally(() => setIsProcessing(false))
  }

  const handleCreateAccount = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db || !selectedCompanyId) return

    setIsProcessing(true)
    const formData = new FormData(e.currentTarget)
    const accountId = Math.random().toString(36).substring(7).toUpperCase()
    
    const accountData = {
      id: accountId,
      name: (formData.get("name") as string).toUpperCase(),
      assistanceCompanyId: selectedCompanyId,
      contactPerson: formData.get("contactPerson") as string,
      contactEmail: formData.get("contactEmail") as string,
      contactPhone: formData.get("contactPhone") as string,
    }

    const docRef = doc(db, "client_accounts", accountId)
    setDoc(docRef, accountData)
      .then(() => {
        toast({ title: "Cuenta Vinculada", description: `La cuenta ${accountData.name} ha sido añadida.` })
        setIsAddingAccount(false)
        setSelectedCompanyId(null)
      })
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: docRef.path,
          operation: "create",
          requestResourceData: accountData,
        })
        errorEmitter.emit("permission-error", permissionError)
      })
      .finally(() => setIsProcessing(false))
  }

  if (loadingCompanies || loadingAccounts) {
    return (
      <div className="flex flex-col items-center justify-center p-20 gap-4">
        <div className="h-16 w-16 rounded-2xl bg-white shadow-xl flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary opacity-40" />
        </div>
        <p className="text-xs font-black uppercase text-muted-foreground tracking-tighter">Sincronizando entidades...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-primary uppercase">Gestión de Empresas</h1>
          <p className="text-muted-foreground font-medium">Administra tus aliados de asistencia y sus cuentas asociadas.</p>
        </div>
        {isAdmin && (
          <Button className="gap-2 shadow-lg h-12 font-bold" onClick={() => { setEditingCompany(null); setIsCompanyDialogOpen(true); }}>
            <Plus className="h-5 w-5" /> Registrar Empresa
          </Button>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {allCompanies.map((company) => {
          const dbAccounts = (firestoreAccounts || [])
            .filter(acc => acc.assistanceCompanyId === company.id)
            .map(acc => acc.name)
          
          const uniqueAccounts = Array.from(new Set([...(company.accounts || []), ...dbAccounts])).sort()
          
          return (
            <Card key={company.id} className="overflow-hidden hover:shadow-xl transition-all border-l-4 border-l-primary group">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                      <Building2 className="h-6 w-6" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-black uppercase tracking-tight">{company.name}</CardTitle>
                      <CardDescription className="text-[10px] font-bold uppercase">{uniqueAccounts.length} Cuentas activas</CardDescription>
                    </div>
                  </div>
                  {isAdmin && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem onClick={() => { setEditingCompany(company); setIsCompanyDialogOpen(true); }}>
                          <Edit2 className="h-4 w-4 mr-2" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive font-bold" onClick={() => setCompanyToDelete(company)}>
                          <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 mt-2">
                  <div className="grid grid-cols-1 gap-2 text-[10px] font-bold text-slate-500 uppercase">
                    {company.contactPerson && (
                      <div className="flex items-center gap-2"><UserIcon className="h-3 w-3" /> {company.contactPerson}</div>
                    )}
                    {company.contactPhone && (
                      <div className="flex items-center gap-2"><Phone className="h-3 w-3" /> {company.contactPhone}</div>
                    )}
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-2">Cuentas Cliente</p>
                    <div className="flex flex-wrap gap-2 max-h-[150px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200">
                      {uniqueAccounts.map((accName, idx) => (
                        <Badge key={`${company.id}-${idx}`} variant="secondary" className="px-2 py-0.5 font-bold bg-accent/10 text-accent border-accent/20 text-[10px] uppercase">
                          {accName}
                        </Badge>
                      ))}
                      {uniqueAccounts.length === 0 && <span className="text-[10px] italic text-muted-foreground">Sin cuentas vinculadas</span>}
                    </div>
                  </div>
                  {isAdmin && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-full justify-between mt-2 text-primary font-bold text-xs hover:bg-primary/5"
                      onClick={() => {
                        setSelectedCompanyId(company.id)
                        setIsAddingAccount(true)
                      }}
                    >
                      Añadir cuenta cliente <Plus className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
        
        {isAdmin && (
          <button 
            onClick={() => { setEditingCompany(null); setIsCompanyDialogOpen(true); }}
            className="flex flex-col items-center justify-center p-8 rounded-xl border-2 border-dashed border-muted hover:border-primary/50 hover:bg-primary/5 transition-all group min-h-[220px]"
          >
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-4 group-hover:scale-110 group-hover:bg-primary/20 group-hover:text-primary transition-all shadow-inner">
              <Plus className="h-6 w-6" />
            </div>
            <span className="text-sm font-black text-muted-foreground group-hover:text-primary uppercase tracking-widest">Añadir nueva asistencia</span>
            <span className="text-[10px] text-muted-foreground/60 text-center mt-2 font-medium">Registra IGS, Mawdy u otros aliados</span>
          </button>
        )}
      </div>

      <Dialog open={isCompanyDialogOpen} onOpenChange={setIsCompanyDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-primary">
              {editingCompany ? "Editar Asistencia" : "Registrar Nueva Asistencia"}
            </DialogTitle>
            <DialogDescription>Ingrese los datos de la empresa de asistencia aliada.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveCompany} className="space-y-6 pt-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-[10px] font-black uppercase tracking-widest">Nombre de la Empresa</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="name" name="name" defaultValue={editingCompany?.name} placeholder="Ej. IKE ASISTENCIA" className="pl-10 font-bold uppercase" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactPerson" className="text-[10px] font-black uppercase tracking-widest">Persona de Contacto</Label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="contactPerson" name="contactPerson" defaultValue={editingCompany?.contactPerson} placeholder="Nombre del coordinador" className="pl-10" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contactEmail" className="text-[10px] font-black uppercase tracking-widest">Correo</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="contactEmail" name="contactEmail" type="email" defaultValue={editingCompany?.contactEmail} placeholder="email@asistencia.com" className="pl-10 text-xs" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactPhone" className="text-[10px] font-black uppercase tracking-widest">Teléfono</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="contactPhone" name="contactPhone" defaultValue={editingCompany?.contactPhone} placeholder="3000000000" className="pl-10 text-xs" />
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setIsCompanyDialogOpen(false)} disabled={isProcessing} className="font-bold">CANCELAR</Button>
              <Button type="submit" disabled={isProcessing} className="font-black gap-2">
                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {editingCompany ? "ACTUALIZAR" : "REGISTRAR"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddingAccount} onOpenChange={(v) => { if(!v) setSelectedCompanyId(null); setIsAddingAccount(v); }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-accent">Nueva Cuenta de Cliente</DialogTitle>
            <DialogDescription>Vincule una cuenta específica a esta asistencia.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateAccount} className="space-y-6 pt-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="accountName" className="text-[10px] font-black uppercase tracking-widest">Nombre de la Cuenta / Asegurado</Label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="accountName" name="name" placeholder="Ej. COOMEVA MEDICINA PREPAGADA" className="pl-10 font-bold uppercase" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="accContactPerson" className="text-[10px] font-black uppercase tracking-widest">Persona de Contacto (Opcional)</Label>
                <Input id="accContactPerson" name="contactPerson" placeholder="Nombre del enlace" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="accContactEmail" className="text-[10px] font-black uppercase tracking-widest">Correo</Label>
                  <Input id="accContactEmail" name="contactEmail" type="email" placeholder="enlace@cuenta.com" className="text-xs" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accContactPhone" className="text-[10px] font-black uppercase tracking-widest">Teléfono</Label>
                  <Input id="accContactPhone" name="contactPhone" placeholder="3000000000" className="text-xs" />
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setIsAddingAccount(false)} disabled={isProcessing} className="font-bold">CANCELAR</Button>
              <Button type="submit" disabled={isProcessing} className="font-black gap-2 bg-accent hover:bg-accent/90">
                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} VINCULAR CUENTA
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!companyToDelete} onOpenChange={(v) => !v && setCompanyToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> ¿Eliminar esta asistencia?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará a <strong className="text-slate-900">{companyToDelete?.name}</strong> de la base de datos.
              Esta acción no se puede deshacer y podría afectar el historial de servicios vinculados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-bold">CANCELAR</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCompany} className="bg-destructive hover:bg-destructive/90 font-black">
              ELIMINAR PERMANENTEMENTE
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
