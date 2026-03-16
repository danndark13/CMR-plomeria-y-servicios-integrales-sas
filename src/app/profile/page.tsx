
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { User, Mail, Phone, Shield, Fingerprint, Save } from "lucide-react"
import { toast } from "@/hooks/use-toast"

export default function ProfilePage() {
  const [formData, setFormData] = useState({
    email: "danielcorecspds@gmail.com",
    phone: "3167533657",
  })
  const [isLoading, setIsLoading] = useState(false)

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    
    // Simulamos guardado
    setTimeout(() => {
      setIsLoading(false)
      toast({
        title: "Perfil Actualizado",
        description: "Tus datos de contacto han sido guardados exitosamente."
      })
    }, 1000)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-primary">Mi Perfil</h1>
        <p className="text-muted-foreground">Gestiona tu información de contacto y visualiza tu rol en el sistema.</p>
      </div>

      <div className="grid gap-6">
        <Card className="border-t-4 border-t-primary shadow-md">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <User className="h-5 w-5 text-primary" /> Información Personal
            </CardTitle>
            <CardDescription>Estos datos son visibles para el área administrativa.</CardDescription>
          </CardHeader>
          <form onSubmit={handleUpdate}>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase font-bold">ID de Usuario</Label>
                  <div className="flex items-center gap-2 p-2 bg-muted rounded-md border text-sm font-mono">
                    <Fingerprint className="h-4 w-4 text-muted-foreground" />
                    ADMIN01
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase font-bold">Nombre Completo</Label>
                  <div className="flex items-center gap-2 p-2 bg-muted rounded-md border text-sm font-semibold">
                    Daniel Céspedes
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Correo Electrónico</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="email" 
                    type="email" 
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="pl-10" 
                    required 
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono de Contacto</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="phone" 
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="pl-10" 
                    required 
                  />
                </div>
              </div>

              <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="h-4 w-4 text-primary" />
                  <span className="text-sm font-bold text-primary uppercase">Rol Asignado</span>
                </div>
                <p className="text-xs text-muted-foreground">Tu rol actual es <strong>Administrador</strong>. Esto te otorga acceso total a los módulos de Contabilidad y Gestión de Personal.</p>
              </div>
            </CardContent>
            <CardFooter className="bg-muted/30 border-t pt-6">
              <Button type="submit" className="gap-2 w-full md:w-auto" disabled={isLoading}>
                {isLoading ? "Guardando..." : <><Save className="h-4 w-4" /> Guardar Cambios</>}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
