
"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useUser, useFirestore, useDoc, useMemoFirebase } from "@/firebase"
import { doc } from "firebase/firestore"
import { getAuth, signOut } from "firebase/auth"
import { Loader2, ShieldAlert } from "lucide-react"
import { toast } from "@/hooks/use-toast"

const INACTIVITY_TIMEOUT = 30 * 60 * 1000 // 30 minutos en milisegundos

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser()
  const db = useFirestore()
  const router = useRouter()
  const pathname = usePathname()
  const [isChecking, setIsChecking] = useState(true)
  const lastActivity = useRef<number>(Date.now())
  const auth = getAuth()

  // 1. Fetch profile to ensure user is fully authorized
  const profileRef = useMemoFirebase(() => {
    if (!user || !db) return null
    return doc(db, "user_profiles", user.uid)
  }, [user, db])
  const { data: profile, isLoading: isProfileLoading } = useDoc(profileRef)

  // 2. Handle Redirection logic
  useEffect(() => {
    if (isUserLoading) return

    const isLoginPage = pathname === "/login"

    if (!user && !isLoginPage) {
      // No hay usuario y no está en login -> Redirigir a login
      router.push("/login")
    } else if (user && isLoginPage) {
      // Hay usuario pero está en login -> Redirigir al inicio
      router.push("/")
    } else if (user && !isProfileLoading && !profile && !isLoginPage) {
      // Usuario autenticado pero sin perfil en Firestore (sesión huérfana)
      // Forzar cierre de sesión para limpiar el estado
      signOut(auth).then(() => router.push("/login"))
    } else {
      setIsChecking(false)
    }
  }, [user, isUserLoading, pathname, router, profile, isProfileLoading, auth])

  // 3. Inactivity Timer logic
  const handleActivity = useCallback(() => {
    lastActivity.current = Date.now()
  }, [])

  useEffect(() => {
    if (!user) return

    const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart"]
    events.forEach(name => window.addEventListener(name, handleActivity))

    const interval = setInterval(() => {
      const now = Date.now()
      if (now - lastActivity.current > INACTIVITY_TIMEOUT) {
        toast({
          title: "Sesión Expirada",
          description: "Se ha cerrado la sesión por 30 minutos de inactividad.",
          variant: "destructive"
        })
        signOut(auth).then(() => {
          router.push("/login")
          window.location.reload() // Asegurar limpieza total de estado
        })
      }
    }, 10000) // Revisar cada 10 segundos

    return () => {
      events.forEach(name => window.removeEventListener(name, handleActivity))
      clearInterval(interval)
    }
  }, [user, auth, router, handleActivity])

  // 4. Loading state screen
  if (isUserLoading || (isChecking && pathname !== "/login")) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
        <div className="h-16 w-16 rounded-2xl bg-white shadow-xl flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary opacity-40" />
        </div>
        <div className="text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Autenticando Acceso</p>
          <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">RYS Gestión Operativa</p>
        </div>
      </div>
    )
  }

  // 5. Unauthorized access prevention (even if checking is false)
  if (!user && pathname !== "/login") {
    return null // Evitar flash de contenido protegido
  }

  return <>{children}</>
}
