
"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useUser, useFirestore, useDoc, useMemoFirebase, useAuth } from "@/firebase"
import { doc } from "firebase/firestore"
import { signOut } from "firebase/auth"
import { Loader2, ShieldAlert } from "lucide-react"
import { toast } from "@/hooks/use-toast"

const INACTIVITY_TIMEOUT = 30 * 60 * 1000 // 30 minutos

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser()
  const db = useFirestore()
  const auth = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)
  const lastActivity = useRef<number>(Date.now())

  useEffect(() => {
    setMounted(true)
  }, [])

  const profileRef = useMemoFirebase(() => {
    if (!user || !db) return null
    return doc(db, "user_profiles", user.uid)
  }, [user, db])
  const { data: profile, isLoading: isProfileLoading } = useDoc(profileRef)

  useEffect(() => {
    if (!mounted || isUserLoading) return

    const isLoginPage = pathname === "/login"

    if (!user && !isLoginPage) {
      router.push("/login")
    } else if (user && isLoginPage) {
      router.push("/")
    } else if (user && !isProfileLoading && !profile && !isLoginPage) {
      // Pequeña espera para asegurar que Firestore haya propagado el perfil recién creado
      const timer = setTimeout(() => {
        if (!profile && auth) {
          console.warn("AuthGuard: Profile not found after wait, signing out.")
          signOut(auth).then(() => {
            router.push("/login")
            window.location.reload()
          })
        }
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [user, isUserLoading, pathname, router, profile, isProfileLoading, auth, mounted])

  const handleActivity = useCallback(() => {
    lastActivity.current = Date.now()
  }, [])

  useEffect(() => {
    if (!user || !auth || !mounted) return

    const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart"]
    events.forEach(name => window.addEventListener(name, handleActivity))

    const interval = setInterval(() => {
      const now = Date.now()
      if (now - lastActivity.current > INACTIVITY_TIMEOUT) {
        toast({ title: "Sesión Expirada", description: "Cierre por inactividad.", variant: "destructive" })
        signOut(auth).then(() => {
          router.push("/login")
          window.location.reload()
        })
      }
    }, 15000)

    return () => {
      events.forEach(name => window.removeEventListener(name, handleActivity))
      clearInterval(interval)
    }
  }, [user, auth, router, handleActivity, mounted])

  if (!mounted || isUserLoading || (user && isProfileLoading && pathname !== "/login")) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
        <div className="h-16 w-16 rounded-2xl bg-white shadow-xl flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary opacity-40" />
        </div>
        <div className="text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Sincronizando Acceso</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
