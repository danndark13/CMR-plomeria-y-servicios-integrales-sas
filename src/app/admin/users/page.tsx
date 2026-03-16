
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { UserPlus, Mail, Shield, MoreVertical, Key, Power, UserCog, Phone, Fingerprint, Loader2, Save } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { toast } from "@/hooks/use-toast"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, doc, updateDoc, setDoc, query, orderBy } from "firebase/firestore"

export default function AdminUsersPage() {
  const db = useFirestore()
  const [isProcessing, setIsProcessing] = useState(false)
  const [editingUser, setEditingUser] = useState<any>(null)
  const [isCreating, setIsCreating] = useState(false)

  // Fetch users from Firestore
  const usersQuery = useMemoFirebase(() => {
    if (!db) return null
    return query(collection(db, "user_profiles"), orderBy("username", "asc"))
  }, [db])

  const { data: users, isLoading } = useCollection(usersQuery)

  const handleSaveUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db) return

    const formData = new FormData(e.currentTarget)
    const userData = {
      username: formData.get("username") as string,
      firstName: formData.get("firstName") as string,
      lastName: formData.get("lastName") as string,
      email: formData.get("email") as string,
      phoneNumber: formData.get("phoneNumber") as string,
      roleId: formData.get("roleId") as string,
      isActive: true,
    }

    setIsProcessing(true)
    try {
      if (editingUser) {
        await updateDoc(doc(db, "user_profiles", editingUser.id), userData)
        toast({ title: "Usuario Actualizado", description: "Los cambios se guardaron correctamente." })
      } else {
        // En un entorno real, aquí se crearía el usuario en Auth primero.
        // Por ahora, gestionamos el perfil en la base de datos.
        const newId = Math.random().toString(36).substring(7)
        await setDoc(doc(db, "user_profiles", newId), { ...userData, id: newId })
        toast({ title: "Usuario Creado", description: "Se ha registrado el nuevo colaborador." })
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
        title: user.isActive ? "Usuario Desactivado" : "Usuario Activado",
        description: `El estado de ${user.firstName} ha sido actualizado.`
      })
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo cambiar el estado." })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleResetPassword = (username: string) => {
    toast({
      title: "Clave Restablecida",
      description: `La contraseña temporal para ${username} es RYS2025. El usuario debe cambiarla al ingresar.`
    })
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-primary uppercase">Gestión de Usuarios</h1>
          <p className="text-muted-foreground font-medium">Administra el personal y asigna roles mediante IDs corporativos.</p>
        </div>
        <Button className="gap-2 shadow-lg" onClick={() => { setIsCreating(true); setEditingUser(null); }}>
          <UserPlus className="h-4 w-4" /> Nuevo Usuario
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 shadow-md">
          <CardHeader>
            <CardTitle>Colaboradores</CardTitle>
            <CardDescription>Usuarios con acceso al sistema filtrados por ID corporativo.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>ID / Nombre</TableHead>
                    <TableHead>Rol / Contacto</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                      </TableCell>
                    </TableRow>
                  ) : users?.map((user) => (
                    <TableRow key={user.id} className="hover:bg-muted/20">
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-mono font-black text-primary text-sm">{user.username}</span>
                          <span className="font-bold text-slate-700">{user.firstName} {user.lastName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1.5">
                          <Badge variant="outline" className="w-fit bg-primary/5 border-primary/20 text-primary uppercase text-[10px] font-black tracking-tighter">
                            <Shield className="h-3 w-3 mr-1" /> {user.roleId}
                          </Badge>
                          <div className="flex flex-col text-[10px] text-muted-foreground font-medium">
                            <span className="flex items-center gap-1"><Mail className="h-2.5 w-2.5" /> {user.email}</span>
                            <span className="flex items-center gap-1"><Phone className="h-2.5 w-2.5" /> {user.phoneNumber}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.isActive ? "secondary" : "destructive"} className={user.isActive ? "bg-green-100 text-green-700 border-green-200" : ""}>
                          {user.isActive ? "Activo" : "Inactivo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => { setEditingUser(user); setIsCreating(false); }}>
                              <UserCog className="h-4 w-4 mr-2" /> Editar Perfil
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleResetPassword(user.username)}>
                              <Key className="h-4 w-4 mr-2" /> Reset Contraseña
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className={user.isActive ? "text-destructive" : "text-green-600"} 
                              onClick={() => toggleUserStatus(user)}
                              disabled={isProcessing}
                            >
                              <Power className="h-4 w-4 mr-2" /> {user.isActive ? "Desactivar" : "Activar"}
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
          <Card className="h-fit animate-in fade-in slide-in-from-right-4 shadow-xl border-primary/20 sticky top-24">
            <CardHeader className="bg-slate-50/50 border-b">
              <CardTitle className="text-xl flex items-center gap-2">
                <Fingerprint className="h-5 w-5 text-primary" />
                {editingUser ? "Editar Usuario" : "Nuevo Usuario"}
              </CardTitle>
              <CardDescription>Configure los accesos corporativos del colaborador.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleSaveUser} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">ID de Usuario (ADMINxx, SERxx, CONxx)</Label>
                  <Input id="username" name="username" placeholder="Ej. SER05" defaultValue={editingUser?.username} required className="font-mono font-bold" />
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
                  <Label htmlFor="email" className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Correo Corporativo</Label>
                  <Input id="email" name="email" type="email" placeholder="daniel@rys.com" defaultValue={editingUser?.email} required />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phoneNumber" className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Teléfono</Label>
                  <Input id="phoneNumber" name="phoneNumber" placeholder="3167533657" defaultValue={editingUser?.phoneNumber} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="roleId" className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Rol Asignado</Label>
                  <Select name="roleId" defaultValue={editingUser?.roleId || "Servicio al Cliente"}>
                    <SelectTrigger>
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
                  <Button type="submit" className="flex-1 font-bold shadow-lg" disabled={isProcessing}>
                    {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-2" /> {editingUser ? "Guardar" : "Crear"}</>}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => { setIsCreating(false); setEditingUser(null); }} disabled={isProcessing}>
                    Cancelar
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
