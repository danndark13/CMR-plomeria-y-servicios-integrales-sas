"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Plus, UserPlus, Mail, Shield, UserCheck, MoreVertical } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { toast } from "@/hooks/use-toast"

const MOCK_USERS = [
  { id: '1', name: 'Admin Principal', email: 'admin@asistenciapro.com', role: 'Admin', status: 'active' },
  { id: '2', name: 'Andrés Castro', email: 'acastro@asistenciapro.com', role: 'Atención al Cliente', status: 'active' },
  { id: '3', name: 'Maria Lopez', email: 'mlopez@asistenciapro.com', role: 'Contabilidad', status: 'active' },
  { id: '4', name: 'Laura Martinez', email: 'lmartinez@asistenciapro.com', role: 'Atención al Cliente', status: 'inactive' },
]

export default function AdminUsersPage() {
  const [isCreating, setIsCreating] = useState(false)

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault()
    toast({
      title: "Usuario Creado",
      description: "Se ha enviado un correo de invitación al nuevo colaborador."
    })
    setIsCreating(false)
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Gestión de Usuarios</h1>
          <p className="text-muted-foreground">Administra el personal y asigna permisos de acceso.</p>
        </div>
        <Button className="gap-2" onClick={() => setIsCreating(true)}>
          <UserPlus className="h-4 w-4" /> Nuevo Usuario
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Lista de Usuarios */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Colaboradores</CardTitle>
            <CardDescription>Usuarios con acceso al CRM.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre / Email</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {MOCK_USERS.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold">{user.name}</span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Mail className="h-3 w-3" /> {user.email}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="flex w-fit gap-1 items-center">
                        <Shield className="h-3 w-3" /> {user.role}
                      </Badge>
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
                          <DropdownMenuItem>Editar Permisos</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">Desactivar</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Formulario Creación (Lateral o Modal) */}
        {isCreating && (
          <Card className="h-fit animate-in fade-in slide-in-from-right-4">
            <CardHeader>
              <CardTitle>Registrar Personal</CardTitle>
              <CardDescription>Crea un nuevo perfil de acceso.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre Completo</Label>
                  <Input id="name" placeholder="Ej. Andrés Castro" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Corporativo</Label>
                  <Input id="email" type="email" placeholder="andres@empresa.com" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Rol en el Sistema</Label>
                  <Select defaultValue="Atención al Cliente">
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar rol" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Admin">Administrador</SelectItem>
                      <SelectItem value="Contabilidad">Contabilidad</SelectItem>
                      <SelectItem value="Atención al Cliente">Atención al Cliente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button type="submit" className="flex-1">Crear</Button>
                  <Button type="button" variant="ghost" onClick={() => setIsCreating(false)}>Cancelar</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
