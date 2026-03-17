
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { ShieldCheck, Lock, User, Loader2, Globe, Mail, Smartphone, Download, Share, PlusSquare, HelpCircle, RefreshCw, AlertCircle, Trash2 } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { signInAnonymously } from "firebase/auth"
import { doc, setDoc } from "firebase/firestore"
import { useFirebase } from "@/firebase"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

function RYSLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M20 35 L50 15 L80 35" fill="none" stroke="#E53E3E" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M70 28 V20 H75 V31" fill="#E53E3E" />
      <path d="M50 85 C30 85 25 65 25 50 C25 35 50 25 50 25 C50 25 75 35 75 50 C75 65 70 85 50 85Z" fill="url(#rys-gradient)" />
      <path d="M45 45 H55 V52 L60 52 V56 H40 V52 L45 52 Z" fill="white" />
      <circle cx="48" cy="62" r="1.5" fill="white" />
      <circle cx="48" cy="68" r="1.5" fill="white" />
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
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isIos, setIsIos] = useState(false)
  const [showInstallHelp, setShowInstallHelp] = useState(false)

  useEffect(() => {
    const isIosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
    setIsIos(isIosDevice)

    const handler = (e: any) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      setShowInstallHelp(true)
      toast({
        title: "Instalación Manual",
        description: "El navegador no detecta el botón. Sigue los pasos de ayuda.",
      })
      return
    }
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setDeferredPrompt(null)
      toast({ title: "¡Instalación Iniciada!", description: "La app se está añadiendo a tu dispositivo." })
    }
  }

  const clearAppCache = async () => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
      }
      const cacheNames = await caches.keys();
      for (const name of cacheNames) {
        await caches.delete(name);
      }
      toast({ title: "Sistema Reseteado", description: "Caché borrada. Recargando la página..." });
      setTimeout(() => window.location.reload(), 1000);
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo limpiar la caché." });
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    const isCorrectPassword = password === "RYS2025"
    const inputId = userId.toUpperCase().trim()
    const isGerente = inputId === "GERENTE"
    const rolePrefix = inputId.substring(0, 3)
    const validPrefixes = ["ADM", "CON", "SER", "TEC"]
    
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
        roleId = "Gerente"
        firstName = "YULIETH VANESA"
        lastName = "RAMIREZ"
        email = "gerente@rysplomeria.com"
        cedula = "0000000000"
      } else {
        if (rolePrefix === "ADM") roleId = "Administrador"
        if (rolePrefix === "CON") roleId = "Contabilidad"
        if (rolePrefix === "TEC") {
          roleId = "Técnico"
          firstName = "OPERARIO"
          lastName = inputId
          email = `${inputId.toLowerCase()}@rysplomeria.com`
        }
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
      
      await setDoc(profileRef, profileData, { merge: true })

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
      <div className="w-full max-w-md space-y-6 animate-in fade-in zoom-in duration-500">
        
        <Card className="bg-primary text-primary-foreground border-none shadow-xl overflow-hidden ring-4 ring-white/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                <Smartphone className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-black uppercase tracking-tight">Instalar RYS Gestión</p>
                <p className="text-[10px] font-medium opacity-90 leading-tight">
                  {isIos 
                    ? "Pulsa compartir y luego 'Añadir a pantalla de inicio'" 
                    : "Accede rápido desde tu pantalla principal."}
                </p>
              </div>
              {isIos ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-white/10 rounded-lg">
                  <Share className="h-4 w-4" />
                  <PlusSquare className="h-4 w-4" />
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <Button 
                    size="sm" 
                    variant="secondary" 
                    className="font-bold shadow-sm h-8 px-4 rounded-xl text-primary"
                    onClick={handleInstallClick}
                  >
                    INSTALAR
                  </Button>
                  <Button 
                    variant="link" 
                    className="text-[9px] text-white/60 h-auto p-0 font-bold uppercase"
                    onClick={() => setShowInstallHelp(!showInstallHelp)}
                  >
                    {showInstallHelp ? "Cerrar ayuda" : "¿Problemas?"}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {showInstallHelp && !isIos && (
          <div className="space-y-4 animate-in slide-in-from-top-2">
            <Alert className="bg-white border-primary/20">
              <HelpCircle className="h-4 w-4 text-primary" />
              <AlertTitle className="text-[10px] font-black uppercase text-primary">Solución Manual Definitiva</AlertTitle>
              <AlertDescription className="text-[10px] text-slate-600 font-medium space-y-3">
                <p>Si el botón azul no responde, es un bloqueo de tu navegador. Sigue estos pasos:</p>
                <ol className="list-decimal pl-4 space-y-2 font-bold">
                  <li>Pulsa los <strong className="text-primary">TRES PUNTOS (⋮)</strong> arriba a la derecha en Chrome.</li>
                  <li>Busca y pulsa la option <strong className="text-primary">"Instalar aplicación"</strong> o "Añadir a pantalla de inicio".</li>
                </ol>
                <p className="text-destructive font-black">IMPORTANTE: Si no ves la opción, pulsa el botón de abajo para resetear la app y vuelve a intentar.</p>
              </AlertDescription>
            </Alert>
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full h-10 gap-2 text-destructive border-destructive/20 hover:bg-destructive/5 font-bold uppercase text-[10px]"
              onClick={clearAppCache}
            >
              <Trash2 className="h-4 w-4" /> Limpiar App y Reintentar
            </Button>
          </div>
        )}

        <div className="text-center space-y-2">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-white shadow-2xl mb-2 border-2 border-slate-100 p-2">
            <RYSLogo className="h-full w-full" />
          </div>
          <h1 className="text-xl font-black tracking-tighter text-primary leading-tight uppercase">
            RYS Gestión
          </h1>
          <p className="text-muted-foreground font-bold text-[10px] tracking-[0.3em] uppercase opacity-60">
            SISTEMA DE CONTROL OPERATIVO
          </p>
        </div>

        <Card className="border-t-8 border-t-primary shadow-2xl overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b">
            <CardTitle className="text-lg font-bold uppercase tracking-tight">Acceso Corporativo</CardTitle>
          </CardHeader>
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-5 pt-6">
              <div className="space-y-2">
                <Label htmlFor="userId" className="text-[10px] uppercase font-black tracking-widest">ID de Usuario</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="userId" 
                    placeholder="EJ. TEC01" 
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
              <Button className="w-full gap-2 text-lg font-black h-14 shadow-lg" disabled={isLoading}>
                {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : "ACCEDER AL PANEL"}
              </Button>
            </CardFooter>
          </form>
        </Card>
        
        <div className="text-center space-y-1 pb-4">
          <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-30">
            © {new Date().getFullYear()} RYS SAS - Soporte: plomeriasas@gmail.com
          </p>
        </div>
      </div>
    </div>
  )
}
