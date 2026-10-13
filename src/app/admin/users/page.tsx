
"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { UserPlus, Mail, Shield, MoreVertical, Key, Power, UserCog, Phone, Fingerprint, Loader2, Save, Search, CreditCard, X, AlertCircle, Trash2 } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { toast } from "@/hooks/use-toast"
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from "@/firebase"
import { collection, doc, updateDoc, setDoc, deleteDoc, writeBatch } from "firebase/firestore"
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'
import { cn } from "@/lib/utils"
import { Checkbox } from "@/components/ui/checkbox"

export default function AdminUsersPage() {
  const db = useFirestore()
  const { user: currentUser } = useUser()
  const [isProcessing, setIsProcessing] = useState(false)
  const [editingUser, setEditingUser] = useState<any>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedMergeIds, setSelectedMergeIds] = useState<string[]>([])
  const [mergeKeepId, setMergeKeepId] = useState("")
  const [mergeProfile, setMergeProfile] = useState({ username: "", firstName: "", lastName: "", email: "", phoneNumber: "", cedula: "" })

  const profileRef = useMemoFirebase(() => {
    if (!db || !currentUser) return null
    return doc(db, "user_profiles", currentUser.uid)
  }, [db, currentUser])
  const { data: myProfile } = useDoc(profileRef)
  const isDev = myProfile?.roleId === 'Desarrollador'
  const canMergeUsers = ["Administrador", "Gerente", "Desarrollador"].includes(myProfile?.roleId || "")

  const usersQuery = useMemoFirebase(() => {
    if (!db || !currentUser) return null
    return collection(db, "user_profiles")
  }, [db, currentUser])

  const { data: users, isLoading } = useCollection(usersQuery)
  const requestsQuery = useMemoFirebase(() => db && currentUser ? collection(db, "service_requests") : null, [db, currentUser])
  const { data: serviceRequests, isLoading: isRequestsLoading } = useCollection(requestsQuery)
  const payrollQuery = useMemoFirebase(() => db && currentUser ? collection(db, "payroll_history") : null, [db, currentUser])
  const { data: payrollRecords, isLoading: isPayrollLoading } = useCollection(payrollQuery)
  const deductionTicketsQuery = useMemoFirebase(() => db && currentUser ? collection(db, "payroll_deduction_tickets") : null, [db, currentUser])
  const { data: deductionTickets, isLoading: isTicketsLoading } = useCollection(deductionTicketsQuery)
  const payrollSettingsQuery = useMemoFirebase(() => db && currentUser ? collection(db, "technician_payroll_settings") : null, [db, currentUser])
  const { data: payrollSettings, isLoading: isSettingsLoading } = useCollection(payrollSettingsQuery)

  const filteredUsers = useMemo(() => {
    if (!users) return []
    return users
      .filter(u => {
        const search = searchTerm.toLowerCase()
        return (
          (u.username?.toLowerCase() || "").includes(search) ||
          (u.firstName?.toLowerCase() || "").includes(search) ||
          (u.lastName?.toLowerCase() || "").includes(search) ||
          (u.cedula || "").includes(search)
        )
      })
      .sort((a, b) => (a.username || "").localeCompare(b.username || "") || a.id.localeCompare(b.id))
  }, [users, searchTerm])

  const selectedMergeUsers = (users || []).filter(person => selectedMergeIds.includes(person.id))
  const mergeTarget = selectedMergeUsers.find(person => person.id === mergeKeepId)
  const normalizedReference = (value?: string) => (value || "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase()
  const mergeAliases = new Set(selectedMergeUsers.flatMap(person => [person.id, person.username].map(normalizedReference)).filter(Boolean))
  const mergeImpact = {
    requests: (serviceRequests || []).filter((request: any) =>
      (request.interventions || []).some((item: any) => mergeAliases.has(normalizedReference(item.technicianId))) ||
      (request.scheduledVisits || []).some((item: any) => mergeAliases.has(normalizedReference(item.technicianId))) ||
      mergeAliases.has(normalizedReference(request.scheduledVisit?.technicianId)) ||
      (request.advances || []).some((item: any) => mergeAliases.has(normalizedReference(item.technicianId)))
    ).length,
    payroll: (payrollRecords || []).filter((record: any) => mergeAliases.has(normalizedReference(record.technicianId))).length,
    tickets: (deductionTickets || []).filter((ticket: any) => mergeAliases.has(normalizedReference(ticket.personId))).length,
  }

  const handleSaveUser = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db) return

    setIsProcessing(true)
    const formData = new FormData(e.currentTarget)
    const username = (formData.get("username") as string || "").toUpperCase().trim()
    
    if (!editingUser && filteredUsers.some(u => u.username === username)) {
      toast({
        variant: "destructive",
        title: "ID Duplicado",
        description: `El usuario ${username} ya existe en el sistema.`
      })
      setIsProcessing(false)
      return
    }

    const userData = {
      username,
      firstName: (formData.get("firstName") as string || "").toUpperCase(),
      lastName: (formData.get("lastName") as string || "").toUpperCase(),
      email: formData.get("email") as string || "",
      phoneNumber: formData.get("phoneNumber") as string || "",
      cedula: formData.get("cedula") as string || "",
      roleId: formData.get("roleId") as string || "Servicio al Cliente",
      isActive: true,
    }

    if (editingUser) {
      const docRef = doc(db, "user_profiles", editingUser.id)
      updateDoc(docRef, userData)
        .then(() => {
          toast({ title: "Cambios Guardados", description: "El perfil ha sido actualizado correctamente." })
          setEditingUser(null)
          setIsCreating(false)
        })
        .catch(async (error) => {
          const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: "update",
            requestResourceData: userData,
          })
          errorEmitter.emit("permission-error", permissionError)
        })
        .finally(() => setIsProcessing(false))
    } else {
      const newId = Math.random().toString(36).substring(7)
      const docRef = doc(db, "user_profiles", newId)
      setDoc(docRef, { ...userData, id: newId })
        .then(() => {
          toast({ title: "Usuario Registrado", description: "Se ha creado el perfil en la base de datos." })
          setEditingUser(null)
          setIsCreating(false)
        })
        .catch(async (error) => {
          const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: "create",
            requestResourceData: { ...userData, id: newId },
          })
          errorEmitter.emit("permission-error", permissionError)
        })
        .finally(() => setIsProcessing(false))
    }
  }

  const toggleUserStatus = (u: any) => {
    if (!db) return
    if (u.username === 'GERENTE' || u.username === 'DESARROLLADOR') {
      toast({
        variant: "destructive",
        title: "Acción Protegida",
        description: "Este usuario no puede ser desactivado por seguridad del sistema."
      })
      return
    }

    setIsProcessing(true)
    const docRef = doc(db, "user_profiles", u.id)
    const update = { isActive: !u.isActive }
    
    updateDoc(docRef, update)
      .then(() => {
        toast({
          title: u.isActive ? "Acceso Suspendido" : "Acceso Reactivado",
          description: `El estado de ${u.firstName} ha sido actualizado.`
        })
      })
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: docRef.path,
          operation: "update",
          requestResourceData: update,
        })
        errorEmitter.emit("permission-error", permissionError)
      })
      .finally(() => setIsProcessing(false))
  }

  const handleDeleteUser = (u: any) => {
    if (!db || !isDev) return
    if (u.username === 'GERENTE' || u.username === 'DESARROLLADOR') {
      toast({ variant: "destructive", title: "Prohibido", description: "No puedes eliminar cuentas maestras." })
      return
    }

    setIsProcessing(true)
    const docRef = doc(db, "user_profiles", u.id)
    deleteDoc(docRef)
      .then(() => {
        toast({ title: "Usuario Eliminado", description: "El perfil ha sido removido de la base de datos." })
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

  const handleMergeUsers = async () => {
    if (!db || !currentUser || !canMergeUsers) return
    const sources = selectedMergeUsers
    const survivor = sources.find(person => person.id === mergeKeepId)
    const username = mergeProfile.username.trim().toUpperCase()
    const roleId = survivor?.roleId
    const protectedUsernames = ["GERENTE", "DESARROLLADOR"]

    if (sources.length < 2 || !survivor || !username || !roleId || !mergeProfile.firstName.trim() || !mergeProfile.lastName.trim()) {
      toast({ variant: "destructive", title: "Faltan datos", description: "Selecciona al menos dos perfiles, el perfil principal y confirma el usuario, nombre y apellido finales." })
      return
    }
    if (sources.some(person => person.roleId !== roleId)) {
      toast({ variant: "destructive", title: "Roles incompatibles", description: "Solo se pueden unificar perfiles que tengan el mismo rol." })
      return
    }
    if (!isDev && sources.some(person => ["Gerente", "Desarrollador"].includes(person.roleId))) {
      toast({ variant: "destructive", title: "Cuenta protegida", description: "Solo el desarrollador puede unificar perfiles de Gerente o Desarrollador." })
      return
    }
    if (sources.some(person => protectedUsernames.includes(normalizedReference(person.username))) &&
        !survivor.username?.trim().match(/^(GERENTE|DESARROLLADOR)$/i)) {
      toast({ variant: "destructive", title: "Cuenta protegida", description: "No se puede eliminar una cuenta maestra durante la unificación." })
      return
    }
    if (sources.some(person => person.id === currentUser.uid) && survivor.id !== currentUser.uid) {
      toast({ variant: "destructive", title: "Perfil de sesión protegido", description: "Debes conservar el perfil con el que iniciaste sesión para no perder tus permisos." })
      return
    }
    if ((users || []).some(person =>
      !sources.some(source => source.id === person.id) && normalizedReference(person.username) === normalizedReference(username)
    )) {
      toast({ variant: "destructive", title: "ID ya utilizado", description: "El ID final ya pertenece a otro perfil fuera de la selección." })
      return
    }
    if (!serviceRequests || !payrollRecords || !deductionTickets || !payrollSettings ||
        isRequestsLoading || isPayrollLoading || isTicketsLoading || isSettingsLoading) {
      toast({ variant: "destructive", title: "Datos aún cargando", description: "Espera a que terminen de cargar los expedientes y la nómina, y vuelve a intentar." })
      return
    }

    setIsProcessing(true)
    const aliases = new Set(sources.flatMap(person => [person.id, person.username].map(normalizedReference)).filter(Boolean))
    const canonicalReference = roleId === "Técnico" ? username : survivor.id
    const finalName = `${mergeProfile.firstName.trim()} ${mergeProfile.lastName.trim()}`.trim().toUpperCase()
    const sameReference = (value?: string) => aliases.has(normalizedReference(value))
    const mapReference = (value?: string) => sameReference(value) ? canonicalReference : value
    const batch = writeBatch(db)
    let writes = 0
    const queueUpdate = (path: string, id: string, data: Record<string, any>) => {
      batch.update(doc(db, path, id), data)
      writes += 1
    }

    try {
      const updatedProfile = {
        username,
        firstName: mergeProfile.firstName.trim().toUpperCase(),
        lastName: mergeProfile.lastName.trim().toUpperCase(),
        email: mergeProfile.email.trim(),
        phoneNumber: mergeProfile.phoneNumber.trim(),
        cedula: mergeProfile.cedula.trim(),
        isActive: sources.some(person => person.isActive === true),
      }
      queueUpdate("user_profiles", survivor.id, updatedProfile)

      for (const request of serviceRequests) {
        let changed = false
        const interventions = (request.interventions || []).map((item: any) => {
          const technicianId = mapReference(item.technicianId)
          if (technicianId === item.technicianId) return item
          changed = true
          return { ...item, technicianId }
        })
        const scheduledVisits = (request.scheduledVisits || []).map((item: any) => {
          const technicianId = mapReference(item.technicianId)
          if (technicianId === item.technicianId) return item
          changed = true
          return { ...item, technicianId }
        })
        const scheduledVisit = request.scheduledVisit
          ? { ...request.scheduledVisit, technicianId: mapReference(request.scheduledVisit.technicianId) }
          : request.scheduledVisit
        if (scheduledVisit?.technicianId !== request.scheduledVisit?.technicianId) changed = true
        const advances = (request.advances || []).map((item: any) => {
          const technicianId = mapReference(item.technicianId)
          if (technicianId === item.technicianId) return item
          changed = true
          return { ...item, technicianId }
        })
        if (changed) {
          queueUpdate("service_requests", request.id, {
            interventions,
            scheduledVisits,
            ...(scheduledVisit ? { scheduledVisit } : {}),
            advances,
            updatedAt: new Date().toISOString(),
          })
        }
      }

      for (const record of payrollRecords) {
        const technicianId = mapReference(record.technicianId)
        if (technicianId !== record.technicianId) {
          queueUpdate("payroll_history", record.id, { technicianId })
        }
      }

      for (const ticket of deductionTickets) {
        if (!sameReference(ticket.personId)) continue
        queueUpdate("payroll_deduction_tickets", ticket.id, {
          personId: canonicalReference,
          personName: finalName || username,
          personType: roleId === "Técnico" ? "technician" : "office",
        })
      }

      const matchingSettings = payrollSettings.filter((setting: any) =>
        sameReference(setting.technicianId || setting.id)
      )
      const destinationSettings = matchingSettings.find((setting: any) =>
        normalizedReference(setting.id) === normalizedReference(canonicalReference)
      )
      const sourceSettings = destinationSettings || matchingSettings.find((setting: any) =>
        normalizedReference(setting.id) === normalizedReference(survivor.username) ||
        normalizedReference(setting.id) === normalizedReference(survivor.id)
      ) || matchingSettings[0]
      if (sourceSettings) {
        const settingsData = Object.fromEntries(
          Object.entries(sourceSettings).filter(([key]) => key !== "id")
        )
        batch.set(doc(db, "technician_payroll_settings", canonicalReference), {
          ...settingsData,
          technicianId: canonicalReference,
        }, { merge: true })
        writes += 1
      }
      for (const setting of matchingSettings) {
        if (normalizedReference(setting.id) !== normalizedReference(canonicalReference)) {
          batch.delete(doc(db, "technician_payroll_settings", setting.id))
          writes += 1
        }
      }
      for (const person of sources) {
        if (person.id !== survivor.id) {
          batch.delete(doc(db, "user_profiles", person.id))
          writes += 1
        }
      }

      if (writes > 450) {
        throw new Error(`La unificación requiere ${writes} cambios, supera el límite seguro de 450. Unifica menos perfiles por operación.`)
      }
      await batch.commit()
      toast({
        title: "Perfiles unificados",
        description: `Se consolidaron ${sources.length} perfiles, ${mergeImpact.requests} expedientes y ${mergeImpact.payroll} registros de nómina.`,
      })
      setSelectedMergeIds([])
      setMergeKeepId("")
      setMergeProfile({ username: "", firstName: "", lastName: "", email: "", phoneNumber: "", cedula: "" })
    } catch (error) {
      console.error("No se pudieron unificar los perfiles:", error)
      toast({
        variant: "destructive",
        title: "No se pudo completar la unificación",
        description: error instanceof Error ? error.message : "Firestore rechazó la operación. Revisa las reglas publicadas y vuelve a intentar.",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleResetPassword = (username: string) => {
    toast({
      title: "Contraseña Restablecida",
      description: `La clave para ${username} ahora es RYS2025.`
    })
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-primary uppercase">Control de Personal</h1>
          <p className="text-muted-foreground font-medium">Gestión de identidades y accesos corporativos.</p>
        </div>
        <Button 
          className="gap-2 shadow-lg h-12 font-bold" 
          onClick={() => { 
            setIsCreating(true); 
            setEditingUser(null); 
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          disabled={isCreating || !!editingUser}
        >
          <UserPlus className="h-5 w-5" /> Vincular Nuevo Colaborador
        </Button>
      </div>

      {(isCreating || editingUser) && (
        <Card className="animate-in fade-in slide-in-from-top-4 shadow-2xl border-primary/20 overflow-hidden">
          <CardHeader className="bg-primary text-primary-foreground flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Fingerprint className="h-5 w-5" />
                {editingUser ? "Configuración de Perfil" : "Vinculación de Personal"}
              </CardTitle>
              <CardDescription className="text-primary-foreground/70">Asignación de roles y credenciales.</CardDescription>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-white hover:bg-white/10" 
              onClick={() => { setIsCreating(false); setEditingUser(null); }}
            >
              <X className="h-5 w-5" />
            </Button>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSaveUser} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">ID Usuario</Label>
                  <Input id="username" name="username" placeholder="Ej. SER01" defaultValue={editingUser?.username} required className="font-mono font-bold uppercase" readOnly={!!editingUser} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cedula" className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Cédula</Label>
                  <Input id="cedula" name="cedula" placeholder="1110564748" defaultValue={editingUser?.cedula} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Nombre(s)</Label>
                  <Input id="firstName" name="firstName" placeholder="Daniel" defaultValue={editingUser?.firstName} required className="uppercase" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName" className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Apellido(s)</Label>
                  <Input id="lastName" name="lastName" placeholder="Cespedes" defaultValue={editingUser?.lastName} required className="uppercase" />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Correo</Label>
                  <Input id="email" name="email" type="email" placeholder="daniel@rys.com" defaultValue={editingUser?.email} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber" className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Teléfono</Label>
                  <Input id="phoneNumber" name="phoneNumber" placeholder="3167533657" defaultValue={editingUser?.phoneNumber} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="roleId" className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Rol</Label>
                  <Select name="roleId" defaultValue={editingUser?.roleId || "Servicio al Cliente"}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Seleccionar rol" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Desarrollador">Desarrollador (Super Acceso)</SelectItem>
                      <SelectItem value="Gerente">Gerente</SelectItem>
                      <SelectItem value="Administrador">Administrador</SelectItem>
                      <SelectItem value="Contabilidad">Contabilidad</SelectItem>
                      <SelectItem value="Servicio al Cliente">Servicio al Cliente</SelectItem>
                      <SelectItem value="Técnico">Técnico</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit" className="flex-1 font-black shadow-lg h-12" disabled={isProcessing}>
                  {isProcessing ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Save className="h-5 w-5 mr-2" /> {editingUser ? "ACTUALIZAR" : "VINCULAR"}</>}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  className="px-8 font-bold h-12" 
                  onClick={() => { setIsCreating(false); setEditingUser(null); }} 
                  disabled={isProcessing}
                >
                  CANCELAR
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-md border-none overflow-hidden">
        <CardHeader className="bg-slate-50 border-b">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Personal Registrado</CardTitle>
              <CardDescription>Se muestran todos los perfiles, incluidos los que comparten nombre de usuario.</CardDescription>
            </div>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar por ID o Cédula..." 
                className="pl-9 h-9 text-xs"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        {canMergeUsers && selectedMergeUsers.length > 0 && (
          <CardContent className="border-b bg-blue-50/50 p-5">
            <div className="space-y-4">
              <div>
                <h2 className="font-black text-sm uppercase tracking-wide text-slate-800">Unificar perfiles seleccionados</h2>
                <p className="mt-1 text-xs text-slate-600">
                  Se conservarán los datos que confirmes y las referencias operativas migrarán al perfil principal.
                  La clave de acceso compartida no cambia.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedMergeUsers.map(person => (
                  <Badge key={person.id} variant="outline" className="bg-white">
                    {person.username || "(sin usuario)"} · {person.firstName} {person.lastName} · UID {person.id.slice(0, 8)}
                  </Badge>
                ))}
              </div>
              {selectedMergeUsers.length >= 2 && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Perfil principal a conservar</Label>
                      <Select
                        value={mergeKeepId}
                        onValueChange={id => {
                          const selected = selectedMergeUsers.find(person => person.id === id)
                          setMergeKeepId(id)
                          if (selected) {
                            setMergeProfile({
                              username: selected.username || "",
                              firstName: selected.firstName || "",
                              lastName: selected.lastName || "",
                              email: selected.email || "",
                              phoneNumber: selected.phoneNumber || "",
                              cedula: selected.cedula || "",
                            })
                          }
                        }}
                      >
                        <SelectTrigger><SelectValue placeholder="Escoger el perfil principal" /></SelectTrigger>
                        <SelectContent>
                          {selectedMergeUsers.map(person => (
                            <SelectItem key={person.id} value={person.id}>
                              {(person.username || "SIN USUARIO")} — {person.firstName} {person.lastName} ({person.roleId})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="merge-username">Usuario final</Label>
                      <Input id="merge-username" value={mergeProfile.username} onChange={event => setMergeProfile({ ...mergeProfile, username: event.target.value })} className="uppercase" />
                    </div>
                    <div className="space-y-2">
                      <Label>Registros que se van a revisar y migrar</Label>
                      <p className="rounded-md border bg-white px-3 py-2 text-xs">
                        {mergeImpact.requests} expedientes · {mergeImpact.payroll} nóminas · {mergeImpact.tickets} tickets
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="merge-first-name">Nombre(s)</Label>
                      <Input id="merge-first-name" value={mergeProfile.firstName} onChange={event => setMergeProfile({ ...mergeProfile, firstName: event.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="merge-last-name">Apellido(s)</Label>
                      <Input id="merge-last-name" value={mergeProfile.lastName} onChange={event => setMergeProfile({ ...mergeProfile, lastName: event.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="merge-cedula">Cédula</Label>
                      <Input id="merge-cedula" value={mergeProfile.cedula} onChange={event => setMergeProfile({ ...mergeProfile, cedula: event.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="merge-email">Correo</Label>
                      <Input id="merge-email" type="email" value={mergeProfile.email} onChange={event => setMergeProfile({ ...mergeProfile, email: event.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="merge-phone">Teléfono</Label>
                      <Input id="merge-phone" value={mergeProfile.phoneNumber} onChange={event => setMergeProfile({ ...mergeProfile, phoneNumber: event.target.value })} />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">Contraseña: se mantiene el acceso actual compartido (RYS2025); no se crea una clave personal.</p>
                    <Button onClick={handleMergeUsers} disabled={isProcessing || !mergeTarget || isRequestsLoading || isPayrollLoading || isTicketsLoading || isSettingsLoading}>
                      {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserCog className="mr-2 h-4 w-4" />}
                      Confirmar unificación
                    </Button>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        )}
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  {canMergeUsers && <TableHead className="w-10" />}
                  <TableHead className="w-[120px] font-black uppercase text-[10px] tracking-widest">ID / Cédula</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest">Colaborador</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest">Rol</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest">Estado</TableHead>
                  <TableHead className="text-right font-black uppercase text-[10px] tracking-widest">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={canMergeUsers ? 6 : 5} className="h-40 text-center">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary opacity-20" />
                      <p className="mt-2 text-xs font-bold text-muted-foreground tracking-tighter uppercase">Conectando con Firestore...</p>
                    </TableCell>
                  </TableRow>
                ) : filteredUsers?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canMergeUsers ? 6 : 5} className="h-60 text-center">
                      <div className="flex flex-col items-center justify-center space-y-4">
                        <div className="p-4 bg-slate-50 rounded-full">
                          <AlertCircle className="h-10 w-10 text-slate-300" />
                        </div>
                        <div className="max-w-[300px] mx-auto">
                          <p className="text-sm font-bold text-slate-800">No hay perfiles activos</p>
                          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                            Vincula personal o inicia sesión para ver los perfiles registrados.
                          </p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredUsers?.map((u) => (
                  <TableRow key={u.id} className="hover:bg-muted/20 group">
                    {canMergeUsers && (
                      <TableCell>
                        <Checkbox
                          checked={selectedMergeIds.includes(u.id)}
                          onCheckedChange={checked => {
                            setSelectedMergeIds(current => checked
                              ? [...current, u.id]
                              : current.filter(id => id !== u.id))
                            setMergeKeepId("")
                            setMergeProfile({ username: "", firstName: "", lastName: "", email: "", phoneNumber: "", cedula: "" })
                          }}
                          aria-label={`Seleccionar ${u.username || u.id} para unificar`}
                        />
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant="outline" className="font-mono font-black text-primary text-[10px] bg-primary/5 py-0.5 px-2 border-primary/20 w-fit">
                          {u.username}
                        </Badge>
                        <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1">
                          <CreditCard className="h-2.5 w-2.5" /> {u.cedula || '---'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800 uppercase">{u.firstName} {u.lastName}</span>
                        <div className="flex items-center gap-3 mt-1 opacity-60">
                          <span className="flex items-center gap-1 text-[10px]"><Mail className="h-3 w-3" /> {u.email}</span>
                          <span className="flex items-center gap-1 text-[10px]"><Phone className="h-3 w-3" /> {u.phoneNumber}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("text-white font-black uppercase text-[9px] tracking-tighter", u.roleId === 'Desarrollador' ? 'bg-red-600' : 'bg-slate-800')}>
                        {u.roleId}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className={cn("h-2 w-2 rounded-full", u.isActive ? "bg-green-500 animate-pulse" : "bg-slate-300")} />
                        <span className={cn("text-[10px] font-bold uppercase", u.isActive ? "text-green-700" : "text-slate-400")}>
                          {u.isActive ? "Activo" : "Inactivo"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity"><MoreVertical className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuItem onClick={() => { setEditingUser(u); setIsCreating(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                              <UserCog className="h-4 w-4 mr-2" /> Editar Perfil
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleResetPassword(u.username)}>
                              <Key className="h-4 w-4 mr-2" /> Reset Clave (RYS2025)
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className={u.isActive ? "text-destructive font-bold" : "text-green-600 font-bold"} 
                              onClick={() => toggleUserStatus(u)}
                              disabled={isProcessing || u.username === 'GERENTE' || u.username === 'DESARROLLADOR'}
                            >
                              <Power className="h-4 w-4 mr-2" /> {u.isActive ? "Suspender Acceso" : "Reactivar"}
                            </DropdownMenuItem>
                            {isDev && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  className="text-red-600 font-black uppercase text-[10px]"
                                  onClick={() => handleDeleteUser(u)}
                                  disabled={isProcessing}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" /> Eliminar Perfil Físico
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
