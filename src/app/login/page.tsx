
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { ShieldCheck, Lock, User, Loader2 } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { signInAnonymously } from "firebase/auth"
import { doc, getDoc, setDoc } from "firebase/firestore"
import { useFirebase } from "@/firebase"

export default function LoginPage() {
  const router = useRouter()
  const { auth, firestore } = useFirebase()
  const [isLoading, setIsLoading] = useState(false)
  const [userId, setUserId] = useState("")
  const [password, setPassword] = useState("")

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    // Validación de contraseña corporativa RYS2025
    const isCorrectPassword = password === "RYS2025"
    const inputId = userId.toUpperCase().trim()
    const rolePrefix = inputId.substring(0, 3)
    const validPrefixes = ["ADM", "CON", "SER"]
    
    if (!validPrefixes.includes(rolePrefix) || !isCorrectPassword) {
      toast({
        variant: "destructive",
        title: "Acceso Denegado",
        description: "ID de usuario o contraseña incorrectos. Use RYS2025.",
      })
      setIsLoading(false)
      return
    }

    try {
      // 1. Iniciamos sesión en Firebase Auth (Anónimo para el prototipo)
      const userCredential = await signInAnonymously(auth)
      const user = userCredential.user

      // 2. Determinamos el rol basado en el prefijo del ID ingresado
      let roleId = "Servicio al Cliente"
      if (rolePrefix === "ADM") roleId = "Administrador"
      if (rolePrefix === "CON") roleId = "Contabilidad"

      // 3. Sincronizamos el perfil de Daniel Céspedes con el rol actual
      const profileRef = doc(firestore, "user_profiles", user.uid)
      
      await setDoc(profileRef, {
        id: user.uid,
        username: inputId,
        firstName: "Daniel",
        lastName: "Cespedes",
        email: "danielcorecspds@gmail.com",
        phoneNumber: "3167533657",
        roleId: roleId,
        isActive: true,
        cedula: "1110564748"
      }, { merge: true })

      toast({
        title: "Bienvenido a RYS SAS",
        description: `Sesión iniciada como Daniel Céspedes (${roleId}).`,
      })
      
      router.push("/")
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error de Sistema",
        description: "No se pudo validar el perfil en la base de datos.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-background to-background">
      <div className="w-full max-w-md space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="text-center space-y-2">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-primary text-primary-foreground shadow-2xl mb-4 border-4 border-white">
            <ShieldCheck className="h-12 w-12" />
          </div>
          <h1 className="text-2xl font-black tracking-tighter text-primary leading-tight uppercase">
            Plomería y Servicios Integrales RYS SAS
          </h1>
          <p className="text-muted-foreground font-bold text-sm tracking-widest uppercase opacity-70">
            Portal de Gestión Profesional
          </p>
        </div>

        <Card className="border-t-8 border-t-primary shadow-2xl overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b">
            <CardTitle className="text-xl font-bold">Identificación Corporativa</CardTitle>
            <CardDescription>Ingrese su ID (ADMINxx, CONxx, SERxx) para continuar.</CardDescription>
          </CardHeader>
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-6 pt-6">
              <div className="space-y-2">
                <Label htmlFor="userId" className="text-[10px] uppercase font-black tracking-widest">Usuario o ID</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="userId" 
                    placeholder="Ej. ADMIN01, SER01..." 
                    className="pl-10 h-12 font-mono font-bold uppercase"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    required 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" title="Contraseña corporativa: RYS2025" className="text-[10px] uppercase font-black tracking-widest">Contraseña</Label>
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
              <div className="flex items-center space-x-2 pt-2">
                <Checkbox id="remember" />
                <label
                  htmlFor="remember"
                  className="text-sm font-bold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer text-slate-600"
                >
                  Recordar mi sesión
                </label>
              </div>
            </CardContent>
            <CardFooter className="bg-slate-50/50 border-t p-6">
              <Button className="w-full gap-2 text-lg font-black h-14 shadow-lg hover:shadow-primary/20 transition-all" disabled={isLoading}>
                {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : "ACCEDER AL PANEL"}
              </Button>
            </CardFooter>
          </form>
        </Card>
        <p className="text-center text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-40">
          © {new Date().getFullYear()} AsistenciaPro RYS - Sistema de Control Operativo
        </p>
      </div>
    </div>
  )
}
