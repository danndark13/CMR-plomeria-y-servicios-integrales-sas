"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { ShieldCheck, Lock, User, Loader2, Globe, Mail } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { signInAnonymously } from "firebase/auth"
import { doc, setDoc } from "firebase/firestore"
import { useFirebase } from "@/firebase"
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'

// Componente del Logo RYS (SVG profesional)
function RYSLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* Techo de la casa */}
      <path d="M20 35 L50 15 L80 35" fill="none" stroke="#E53E3E" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M70 28 V20 H75 V31" fill="#E53E3E" />
      
      {/* Llama/Gota central */}
      <path d="M50 85 C30 85 25 65 25 50 C25 35 50 25 50 25 C50 25 75 35 75 50 C75 65 70 85 50 85Z" fill="url(#rys-gradient)" />
      
      {/* Grifo */}
      <path d="M45 45 H55 V52 L60 52 V56 H40 V52 L45 52 Z" fill="white" />
      <circle cx="48" cy="62" r="1.5" fill="white" />
      <circle cx="48" cy="68" r="1.5" fill="white" />
      
      {/* Llave inglesa curva */}
      <path d="M25 60 Q50 85 75 60 L80 65 Q50 95 20 65 Z" fill="black" />
      <circle cx="80" cy="58" r="4" fill="black" />
      <rect x="78" y="55" width="4" height="2" fill="white" />

      <defs>
        <linearGradient id="rys-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#1F5BCC" />
          <stop offset="50%" stopColor="#1F5BCC" />
          <stop offset="50%" stopColor="#F97316" />
          <stop offset="100%" stopColor="#F97316" />
        </linearGradient>
      </defs>
    </svg>
  )
}

export default function LoginPage() {
  const router = useRouter()
  const { auth, firestore } = useFirebase()
  const [isLoading, setIsLoading] = useState(false)
  const [userId, setUserId] = useState("")
  const [password, setPassword] = useState("")

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    const isCorrectPassword = password === "RYS2025"
    const inputId = userId.toUpperCase().trim()
    const isGerente = inputId === "GERENTE"
    const rolePrefix = inputId.substring(0, 3)
    const validPrefixes = ["ADM", "CON", "SER"]
    
    if (!isCorrectPassword || (!isGerente && !validPrefixes.includes(rolePrefix))) {
      toast({
        variant: "destructive",
        title: "Acceso Denegado",
        description: "ID de usuario o contraseña incorrectos.",
      })
      setIsLoading(false)
      return
    }

    try {
      const userCredential = await signInAnonymously(auth)
      const user = userCredential.user

      let roleId = "Servicio al Cliente"
      let firstName = "Daniel"
      let lastName = "Cespedes"
      let email = "danielcorecspds@gmail.com"
      let cedula = "1110564748"

      if (isGerente) {
        roleId = "Administrador"
        firstName = "YULIETH VANESA"
        lastName = "RAMIREZ"
        email = "gerente@rysplomeria.com"
        cedula = "0000000000"
      } else {
        if (rolePrefix === "ADM") roleId = "Administrador"
        if (rolePrefix === "CON") roleId = "Contabilidad"
      }

      const profileRef = doc(firestore, "user_profiles", user.uid)
      const profileData = {
        id: user.uid,
        username: inputId,
        firstName,
        lastName,
        email,
        phoneNumber: "3167533657",
        roleId,
        isActive: true,
        cedula
      }
      
      setDoc(profileRef, profileData, { merge: true })
        .catch(async (error) => {
          const permissionError = new FirestorePermissionError({
            path: profileRef.path,
            operation: "write",
            requestResourceData: profileData,
          })
          errorEmitter.emit('permission-error', permissionError)
        })

      toast({
        title: "Bienvenido a RYS SAS",
        description: `Sesión iniciada como ${firstName} (${roleId}).`,
      })
      
      router.push("/")
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error de Sistema",
        description: "No se pudo validar el perfil en la base de datos.",
      })
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-background to-background">
      <div className="w-full max-w-md space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="text-center space-y-2">
          <div className="inline-flex h-24 w-24 items-center justify-center rounded-3xl bg-white shadow-2xl mb-4 border-2 border-slate-100 p-2">
            <RYSLogo className="h-full w-full" />
          </div>
          <h1 className="text-2xl font-black tracking-tighter text-primary leading-tight uppercase">
            RYS Gestión
          </h1>
          <p className="text-muted-foreground font-bold text-sm tracking-widest uppercase opacity-70">
            Plomería y Servicios Integrales
          </p>
        </div>

        <Card className="border-t-8 border-t-primary shadow-2xl overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b">
            <CardTitle className="text-xl font-bold uppercase tracking-tight">Acceso Corporativo</CardTitle>
            <CardDescription>Gestión de servicios RYS SAS.</CardDescription>
          </CardHeader>
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-6 pt-6">
              <div className="space-y-2">
                <Label htmlFor="userId" className="text-[10px] uppercase font-black tracking-widest">ID de Usuario</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="userId" 
                    placeholder="EJ. ADMIN01" 
                    className="pl-10 h-12 font-mono font-bold uppercase"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    required 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-[10px] uppercase font-black tracking-widest">Contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="password" 
                    type="password" 
                    placeholder="••••••••" 
                    className="pl-10 h-12"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required 
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-slate-50/50 border-t p-6 flex flex-col gap-4">
              <Button className="w-full gap-2 text-lg font-black h-14 shadow-lg hover:shadow-primary/20 transition-all" disabled={isLoading}>
                {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : "ACCEDER AL PANEL"}
              </Button>
              
              <div className="w-full space-y-2 pt-2">
                <div className="flex items-center justify-center gap-2 text-[10px] font-black text-primary uppercase">
                  <Globe className="h-3 w-3" />
                  <a href="https://www.rysplomeria.com" target="_blank" rel="noopener noreferrer" className="hover:underline">www.rysplomeria.com</a>
                </div>
                <div className="flex items-center justify-center gap-2 text-[10px] font-bold text-muted-foreground uppercase">
                  <Mail className="h-3 w-3" />
                  <span>gerente@rysplomeria.com</span>
                </div>
              </div>
            </CardFooter>
          </form>
        </Card>
        
        <div className="text-center space-y-1">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-40">
            © {new Date().getFullYear()} RYS SAS - Sistema de Control Operativo
          </p>
          <p className="text-[9px] font-bold text-muted-foreground uppercase opacity-30">
            Soporte técnico: plomeriasas@gmail.com
          </p>
        </div>
      </div>
    </div>
  )
}
