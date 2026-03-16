
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

export default function LoginPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [userId, setUserId] = useState("")
  const [password, setPassword] = useState("")

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    // Simulación de autenticación con contraseña asignada: RYS2025
    setTimeout(() => {
      setIsLoading(false)
      const validIds = userId.startsWith("ADMIN") || userId.startsWith("CON") || userId.startsWith("SER")
      const isCorrectPassword = password === "RYS2025"

      if (validIds && isCorrectPassword) {
        toast({
          title: "Sesión Iniciada",
          description: `Bienvenido al sistema, Daniel Céspedes (${userId}).`,
        })
        router.push("/")
      } else {
        toast({
          variant: "destructive",
          title: "Error de Acceso",
          description: !isCorrectPassword && validIds 
            ? "Contraseña incorrecta para este ID." 
            : "ID de usuario o contraseña incorrectos.",
        })
      }
    }, 1500)
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-background to-background">
      <div className="w-full max-w-md space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="text-center space-y-2">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-2xl mb-4">
            <ShieldCheck className="h-10 w-10" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-primary leading-tight uppercase">
            Plomería y Servicios Integrales RYS SAS
          </h1>
          <p className="text-muted-foreground font-medium">Gestión Profesional de Asistencias</p>
        </div>

        <Card className="border-t-4 border-t-primary shadow-2xl">
          <CardHeader>
            <CardTitle className="text-xl font-bold">Bienvenido</CardTitle>
            <CardDescription>Ingrese sus credenciales para acceder al panel.</CardDescription>
          </CardHeader>
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="userId">Usuario o ID</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="userId" 
                    placeholder="Ej. ADMIN01, SER01..." 
                    className="pl-10"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value.toUpperCase())}
                    required 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="password" 
                    type="password" 
                    placeholder="••••••••" 
                    className="pl-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required 
                  />
                </div>
                <p className="text-[10px] text-muted-foreground italic">Pista para pruebas: RYS2025</p>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="remember" />
                <label
                  htmlFor="remember"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Recordar contraseña
                </label>
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full gap-2 text-lg font-bold h-12" disabled={isLoading}>
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Iniciar Sesión"}
              </Button>
            </CardFooter>
          </form>
        </Card>
        <p className="text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} AsistenciaPro - Todos los derechos reservados
        </p>
      </div>
    </div>
  )
}
