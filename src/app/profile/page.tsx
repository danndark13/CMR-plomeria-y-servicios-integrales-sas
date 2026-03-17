
"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { User, Mail, Phone, Shield, Fingerprint, Save, Lock, Loader2, Info, Globe, AlertCircle } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase'
import { doc, updateDoc } from 'firebase/firestore'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'

export default function ProfilePage() {
  const { user } = useUser()
  const db = useFirestore()
  const [isProcessing, setIsProcessing] = useState(false)
  
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

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!profileRef) return

    setIsProcessing(true)
    const updateData = {
      firstName: formData.firstName.toUpperCase(),
      lastName: formData.lastName.toUpperCase(),
      email: formData.email.toLowerCase(),
      phoneNumber: formData.phoneNumber,
      updatedAt: new Date().toISOString()
    }

    // Optimistic toast
    toast({
      title: "Guardando cambios...",
      description: "Sincronizando información con el servidor corporativo."
    })

    updateDoc(profileRef, updateData)
      .then(() => {
        toast({
          title: "Perfil Actualizado",
          description: "Tus datos personales han sido guardados exitosamente."
        })
      })
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: profileRef.path,
          operation: "update",
          requestResourceData: updateData,
        })
        errorEmitter.emit("permission-error", permissionError)
      })
      .finally(() => setIsProcessing(false))
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-primary uppercase">Mi Perfil</h1>
          <p className="text-muted-foreground font-medium">Gestiona tu información personal de contacto.</p>
        </div>
        <div className="hidden md:flex flex-col items-end">
           <a href="https://www.rysplomeria.com" target="_blank" rel="noopener noreferrer" className="text-xs font-black text-primary uppercase flex items-center gap-2 hover:underline">
             <Globe className="h-4 w-4" /> Visitar sitio web
           </a>
           <span className="text-[10px] font-bold text-muted-foreground">{profile?.email || '---'}</span>
        </div>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-slate-50 rounded-xl border border-dashed">
                <div className="space-y-2">
                  <Label className="text-[10px] text-muted-foreground uppercase font-black tracking-widest flex items-center gap-1">
                    <Fingerprint className="h-3 w-3" /> ID Corporativo
                  </Label>
                  <div className="flex items-center gap-2 p-3 bg-white rounded-lg border text-sm font-mono font-bold text-slate-500 shadow-sm">
                    {profile?.username || 'CARGANDO...'}
                  </div>
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
                    className="uppercase"
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
                    className="uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <Label htmlFor="phone">Teléfono Móvil</Label>
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
              </div>
            </CardContent>
            <CardFooter className="bg-slate-50/50 border-t p-6">
              <Button type="submit" className="gap-2 w-full md:w-auto font-bold shadow-lg h-11" disabled={isProcessing}>
                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-5 w-5" /> Guardar Cambios</>}
              </Button>
            </CardFooter>
          </form>
        </Card>

        <Card className="bg-slate-900 text-white border-none shadow-xl">
          <CardHeader>
            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-primary" /> Soporte Técnico RYS SAS
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="p-4 bg-white/5 rounded-xl border border-white/10 flex flex-col md:flex-row justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase text-slate-400">Reporte de fallos en app</p>
                  <p className="text-sm font-bold text-primary">plomeriasas@gmail.com</p>
                </div>
                <div className="space-y-1 md:text-right">
                  <p className="text-[10px] font-black uppercase text-slate-400">Contacto Gerencia</p>
                  <p className="text-sm font-bold">gerente@rysplomeria.com</p>
                </div>
             </div>
             <p className="text-[10px] text-slate-400 leading-relaxed italic text-center">
               Para cambios de contraseña, roles o usuarios bloqueados, comuníquese directamente con los correos oficiales arriba mencionados.
             </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
