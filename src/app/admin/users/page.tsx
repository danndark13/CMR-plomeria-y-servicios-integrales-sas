
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { UserPlus, Mail, Shield, MoreVertical, Key, Power, UserCog, Phone, Fingerprint, Loader2, Save, Search } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { toast } from "@/hooks/use-toast"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, doc, updateDoc, setDoc, query, orderBy } from "firebase/firestore"
import { cn } from "@/lib/utils"

export default function AdminUsersPage() {
  const db = useFirestore()
  const [isProcessing, setIsProcessing] = useState(false)
  const [editingUser, setEditingUser] = useState<any>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")

  // Fetch users from Firestore
  const usersQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "user_profiles"), orderBy("username", "asc"))
  }, [db])

  const { data: users, isLoading } = useCollection(usersQuery)

  const filteredUsers = users?.filter(u => 
    u.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.lastName?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleSaveUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db) return

    const formData = new FormData(e.currentTarget)
    const username = (formData.get("username") as string || "").toUpperCase()
    
    const userData = {
      username,
      firstName: formData.get("firstName") as string || "",
      lastName: formData.get("lastName") as string || "",
      email: formData.get("email") as string || "",
      phoneNumber: formData.get("phoneNumber") as string || "",
      roleId: formData.get("roleId") as string || "Servicio al Cliente",
      isActive: true,
    }

    setIsProcessing(true)
    try {
      if (editingUser) {
        await updateDoc(doc(db, "user_profiles", editingUser.id), userData)
        toast({ title: "Cambios Guardados", description: "El perfil del colaborador ha sido actualizado." })
      } else {
        const newId = Math.random().toString(36).substring(7)
        await setDoc(doc(db, "user_profiles", newId), { ...userData, id: newId })
        toast({ title: "Usuario Registrado", description: "Se ha creado el nuevo acceso corporativo." })
      }
      setEditingUser(null)
      setIsCreating(false)
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo procesar la solicitud." })
    } finally {
      setIsProcessing(false)
    }
  }

  const toggleUserStatus = async (user: any) => {
    if (!db) return
    setIsProcessing(true)
    try {
      await updateDoc(doc(db, "user_profiles", user.id), {
        isActive: !user.isActive
      })
      toast({
        title: user.isActive ? "Acceso Suspendido" : "Acceso Reactivado",
        description: `El estado de ${user.firstName} ha sido actualizado correctamente.`
      })
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo cambiar el estado." })
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
          <p className="text-muted-foreground font-medium">Administración de identidades corporativas y permisos de acceso.</p>
        </div>
        <Button className="gap-2 shadow-lg h-12 font-bold" onClick={() => { setIsCreating(true); setEditingUser(null); }}>
          <UserPlus className="h-5 w-5" /> Vincular Nuevo Colaborador
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 shadow-md border-none overflow-hidden">
          <CardHeader className="bg-slate-50 border-b">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg">Nómina de Usuarios</CardTitle>
                <CardDescription>Visualización por ID corporativo.</CardDescription>
              </div>
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar por ID o Nombre..." 
                  className="pl-9 h-9 text-xs"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-[120px] font-black uppercase text-[10px] tracking-widest">ID Corporativo</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest">Colaborador / Contacto</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest">Rol Asignado</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest">Estado</TableHead>
                    <TableHead className="text-right font-black uppercase text-[10px] tracking-widest">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-40 text-center">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary opacity-20" />
                        <p className="mt-2 text-xs font-bold text-muted-foreground">Sincronizando base de datos...</p>
                      </TableCell>
                    </TableRow>
                  ) : filteredUsers?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-40 text-center text-muted-foreground italic">
                        No se encontraron colaboradores con ese criterio.
                      </TableCell>
                    </TableRow>
                  ) : filteredUsers?.map((user) => (
                    <TableRow key={user.id} className="hover:bg-muted/20 group">
                      <TableCell>
                        <Badge variant="outline" className="font-mono font-black text-primary text-xs bg-primary/5 py-1 px-2 border-primary/20">
                          {user.username}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800">{user.firstName} {user.lastName}</span>
                          <div className="flex items-center gap-3 mt-1 opacity-60">
                            <span className="flex items-center gap-1 text-[10px]"><Mail className="h-3 w-3" /> {user.email}</span>
                            <span className="flex items-center gap-1 text-[10px]"><Phone className="h-3 w-3" /> {user.phoneNumber}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-slate-800 text-white font-black uppercase text-[9px] tracking-tighter">
                          {user.roleId}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={cn("h-2 w-2 rounded-full", user.isActive ? "bg-green-500 animate-pulse" : "bg-slate-300")} />
                          <span className={cn("text-[10px] font-bold uppercase", user.isActive ? "text-green-700" : "text-slate-400")}>
                            {user.isActive ? "Activo" : "Inactivo"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity"><MoreVertical className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuItem onClick={() => { setEditingUser(user); setIsCreating(false); }}>
                              <UserCog className="h-4 w-4 mr-2" /> Editar Perfil Completo
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleResetPassword(user.username)}>
                              <Key className="h-4 w-4 mr-2" /> Restablecer Clave (RYS2025)
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className={user.isActive ? "text-destructive font-bold" : "text-green-600 font-bold"} 
                              onClick={() => toggleUserStatus(user)}
                              disabled={isProcessing}
                            >
                              <Power className="h-4 w-4 mr-2" /> {user.isActive ? "Suspender Acceso" : "Reactivar Acceso"}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {(isCreating || editingUser) && (
          <Card className="h-fit animate-in fade-in slide-in-from-right-4 shadow-2xl border-primary/20 sticky top-24">
            <CardHeader className="bg-primary text-primary-foreground">
              <CardTitle className="text-lg flex items-center gap-2">
                <Fingerprint className="h-5 w-5" />
                {editingUser ? "Configuración de Perfil" : "Vinculación de Personal"}
              </CardTitle>
              <CardDescription className="text-primary-foreground/70">Asignación de roles y credenciales corporativas.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleSaveUser} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">ID de Usuario (ADMINxx, SERxx, CONxx)</Label>
                  <Input id="username" name="username" placeholder="Ej. SER05" defaultValue={editingUser?.username} required className="font-mono font-bold uppercase h-11" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Nombre(s)</Label>
                    <Input id="firstName" name="firstName" placeholder="Daniel" defaultValue={editingUser?.firstName} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Apellido(s)</Label>
                    <Input id="lastName" name="lastName" placeholder="Cespedes" defaultValue={editingUser?.lastName} required />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Correo Electrónico</Label>
                  <Input id="email" name="email" type="email" placeholder="daniel@rys.com" defaultValue={editingUser?.email} required />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phoneNumber" className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Teléfono</Label>
                  <Input id="phoneNumber" name="phoneNumber" placeholder="3167533657" defaultValue={editingUser?.phoneNumber} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="roleId" className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Rol Jerárquico</Label>
                  <Select name="roleId" defaultValue={editingUser?.roleId || "Servicio al Cliente"}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Seleccionar rol" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Administrador">Administrador</SelectItem>
                      <SelectItem value="Contabilidad">Contabilidad</SelectItem>
                      <SelectItem value="Servicio al Cliente">Servicio al Cliente</SelectItem>
                      <SelectItem value="Técnico">Técnico</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button type="submit" className="flex-1 font-black shadow-lg h-12" disabled={isProcessing}>
                    {isProcessing ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Save className="h-5 w-5 mr-2" /> {editingUser ? "GUARDAR CAMBIOS" : "CONFIRMAR REGISTRO"}</>}
                  </Button>
                  <Button type="button" variant="ghost" className="h-12 font-bold" onClick={() => { setIsCreating(false); setEditingUser(null); }} disabled={isProcessing}>
                    CANCELAR
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
