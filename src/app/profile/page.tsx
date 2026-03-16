
"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { User, Mail, Phone, Shield, Fingerprint, Save, Lock } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase'
import { doc, updateDoc } from 'firebase/firestore'

export default function ProfilePage() {
  const { user } = useUser()
  const db = useFirestore()
  const [isLoading, setIsLoading] = useState(false)
  
  const profileRef = useMemoFirebase(() => {
    if (!user || !db) return null
    return doc(db, 'user_profiles', user.uid)
  }, [user, db])

  const { data: profile } = useDoc(profileRef)

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
  })

  useEffect(() => {
    if (profile) {
      setFormData({
        firstName: profile.firstName || "",
        lastName: profile.lastName || "",
        email: profile.email || "",
        phoneNumber: profile.phoneNumber || "",
      })
    }
  }, [profile])

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profileRef) return

    setIsLoading(true)
    try {
      await updateDoc(profileRef, {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phoneNumber: formData.phoneNumber,
      })
      toast({
        title: "Perfil Actualizado",
        description: "Tus datos personales han sido guardados exitosamente."
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudieron actualizar los datos."
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-primary uppercase">Mi Perfil</h1>
        <p className="text-muted-foreground font-medium">Gestiona tu información personal de contacto.</p>
      </div>

      <div className="grid gap-6">
        <Card className="border-t-4 border-t-primary shadow-xl overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b">
            <CardTitle className="text-xl flex items-center gap-3">
              <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                <User className="h-6 w-6" />
              </div>
              Información del Colaborador
            </CardTitle>
            <CardDescription>Actualiza tu nombre y medios de contacto directos.</CardDescription>
          </CardHeader>
          <form onSubmit={handleUpdate}>
            <CardContent className="space-y-6 pt-6">
              {/* SECCIÓN PROTEGIDA: Solo Admin gestiona esto */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-slate-50 rounded-xl border border-dashed">
                <div className="space-y-2">
                  <Label className="text-[10px] text-muted-foreground uppercase font-black tracking-widest flex items-center gap-1">
                    <Fingerprint className="h-3 w-3" /> ID Corporativo
                  </Label>
                  <div className="flex items-center gap-2 p-3 bg-white rounded-lg border text-sm font-mono font-bold text-slate-500 shadow-sm">
                    {profile?.username || 'CARGANDO...'}
                  </div>
                  <p className="text-[9px] text-muted-foreground italic leading-tight">El ID de acceso es gestionado por el Administrador.</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] text-muted-foreground uppercase font-black tracking-widest flex items-center gap-1">
                    <Shield className="h-3 w-3" /> Rol del Sistema
                  </Label>
                  <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg border border-primary/20 text-sm font-bold text-primary shadow-sm uppercase tracking-wider">
                    {profile?.roleId || 'CARGANDO...'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Nombre(s)</Label>
                  <Input 
                    id="firstName" 
                    value={formData.firstName}
                    onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                    required 
                    placeholder="Ej. Daniel"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Apellido(s)</Label>
                  <Input 
                    id="lastName" 
                    value={formData.lastName}
                    onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                    required 
                    placeholder="Ej. Céspedes"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Correo Electrónico Corporativo</Label>
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
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})}
                    className="pl-10" 
                    required 
                  />
                </div>
              </div>

              <div className="p-4 bg-orange-50 rounded-lg border border-orange-200 flex items-start gap-3">
                <Lock className="h-5 w-5 text-orange-600 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-orange-800 uppercase">Seguridad y Credenciales</p>
                  <p className="text-[10px] text-orange-700 leading-tight">
                    Por políticas de seguridad de <strong>RYS SAS</strong>, el cambio de contraseña y nombre de usuario debe ser solicitado formalmente al Administrador del sistema.
                  </p>
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-slate-50/50 border-t p-6">
              <Button type="submit" className="gap-2 w-full md:w-auto font-bold shadow-lg h-11" disabled={isLoading}>
                {isLoading ? "Guardando..." : <><Save className="h-5 w-5" /> Actualizar Perfil</>}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
