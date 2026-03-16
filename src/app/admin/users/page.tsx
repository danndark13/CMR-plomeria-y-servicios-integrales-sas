
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { UserPlus, Mail, Shield, MoreVertical, Key, Power, UserCog, Phone, Fingerprint } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { toast } from "@/hooks/use-toast"

const MOCK_USERS = [
  { 
    id: 'ADMIN01', 
    name: 'Daniel Cespedes', 
    email: 'danielcorecspds@gmail.com', 
    role: 'Administrador', 
    status: 'active',
    cedula: '1110564748',
    phone: '3167533657'
  },
  { 
    id: 'CON01', 
    name: 'Daniel Cespedes', 
    email: 'danielcorecspds@gmail.com', 
    role: 'Contabilidad', 
    status: 'active',
    cedula: '1110564748',
    phone: '3167533657'
  },
  { 
    id: 'SER01', 
    name: 'Daniel Cespedes', 
    email: 'danielcorecspds@gmail.com', 
    role: 'Servicio al Cliente', 
    status: 'active',
    cedula: '1110564748',
    phone: '3167533657'
  }
]

export default function AdminUsersPage() {
  const [isCreating, setIsCreating] = useState(false)
  const [editingUser, setEditingUser] = useState<any>(null)

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault()
    toast({
      title: "Usuario Creado",
      description: "Se ha registrado el nuevo colaborador exitosamente."
    })
    setIsCreating(false)
  }

  const handleChangeStatus = (userName: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'Inactivo' : 'Activo'
    toast({
      title: `Estado Actualizado`,
      description: `${userName} ahora está ${newStatus}.`
    })
  }

  const handleChangePassword = (userId: string) => {
    toast({
      title: "Cambio de Contraseña",
      description: `Se ha solicitado el cambio de clave para el ID: ${userId}. La nueva clave temporal es RYS2025.`
    })
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Gestión de Usuarios</h1>
          <p className="text-muted-foreground">Administra el personal y asigna roles mediante IDs corporativos.</p>
        </div>
        <Button className="gap-2 shadow-md" onClick={() => setIsCreating(true)}>
          <UserPlus className="h-4 w-4" /> Nuevo Usuario
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Colaboradores</CardTitle>
            <CardDescription>Usuarios con acceso al CRM filtrados por ID.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID / Nombre</TableHead>
                  <TableHead>Rol / Información</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {MOCK_USERS.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-mono font-bold text-primary">{user.id}</span>
                        <span className="font-medium text-sm">{user.name}</span>
                        {user.cedula && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Fingerprint className="h-2.5 w-2.5" /> CC: {user.cedula}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1.5">
                        <Badge variant="outline" className="flex w-fit gap-1 items-center bg-primary/5 border-primary/20">
                          <Shield className="h-3 w-3" /> {user.role}
                        </Badge>
                        <div className="flex flex-col text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-1"><Mail className="h-2.5 w-2.5" /> {user.email}</span>
                          {user.phone && <span className="flex items-center gap-1"><Phone className="h-2.5 w-2.5" /> {user.phone}</span>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.status === 'active' ? 'secondary' : 'destructive'} className={user.status === 'active' ? "bg-green-50 text-green-700" : ""}>
                        {user.status === 'active' ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditingUser(user)}>
                            <UserCog className="h-4 w-4 mr-2" /> Editar Información
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleChangePassword(user.id)}>
                            <Key className="h-4 w-4 mr-2" /> Cambiar Contraseña
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className={user.status === 'active' ? "text-destructive" : "text-green-600"} onClick={() => handleChangeStatus(user.name, user.status)}>
                            <Power className="h-4 w-4 mr-2" /> {user.status === 'active' ? 'Desactivar Usuario' : 'Activar Usuario'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {(isCreating || editingUser) && (
          <Card className="h-fit animate-in fade-in slide-in-from-right-4 shadow-lg border-primary/20">
            <CardHeader>
              <CardTitle>{editingUser ? "Editar Colaborador" : "Registrar Personal"}</CardTitle>
              <CardDescription>Asigna el ID correspondiente (ADMIN, CON, SER).</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="id">ID de Usuario</Label>
                    <Input id="id" placeholder="Ej. SER05" defaultValue={editingUser?.id} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cedula">Cédula</Label>
                    <Input id="cedula" placeholder="1110564748" defaultValue={editingUser?.cedula} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre Completo</Label>
                  <Input id="name" placeholder="Ej. Daniel Cespedes" defaultValue={editingUser?.name} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" placeholder="usuario@gmail.com" defaultValue={editingUser?.email} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Teléfono</Label>
                    <Input id="phone" placeholder="3167533657" defaultValue={editingUser?.phone} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Rol en el Sistema</Label>
                  <Select defaultValue={editingUser?.role || "Servicio al Cliente"}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar rol" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Administrador">Administrador</SelectItem>
                      <SelectItem value="Contabilidad">Contabilidad</SelectItem>
                      <SelectItem value="Servicio al Cliente">Servicio al Cliente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button type="submit" className="flex-1 font-bold">{editingUser ? "Guardar" : "Crear"}</Button>
                  <Button type="button" variant="ghost" onClick={() => { setIsCreating(false); setEditingUser(null); }}>Cancelar</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
