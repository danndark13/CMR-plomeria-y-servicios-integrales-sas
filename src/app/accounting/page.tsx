
"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Receipt, Wallet, ArrowRight, DollarSign, Calculator, BarChart3, TrendingUp, FileText } from "lucide-react"
import { useFirestore, useDoc, useMemoFirebase, useUser } from "@/firebase"
import { doc } from "firebase/firestore"
import { Loader2 } from "lucide-react"
import Link from "next/link"

export default function AccountingHubPage() {
  const db = useFirestore()
  const { user, isUserLoading } = useUser()

  const profileRef = useMemoFirebase(() => {
    if (!db || !user) return null
    return doc(db, "user_profiles", user.uid)
  }, [db, user])

  const { data: profile, isLoading: isProfileLoading } = useDoc(profileRef)

  const role = profile?.roleId || "Sin Rol"
  const isAdmin = role === 'Administrador' || role === 'Gerente' || role === 'Desarrollador'
  const isAccounting = role === 'Contabilidad' || isAdmin
  const isService = role === 'Servicio al Cliente'

  const modules = [
    {
      title: "Balance General",
      description: "Análisis financiero profundo: ingresos, egresos, rentabilidad y balance de materiales.",
      icon: BarChart3,
      href: "/accounting/balance",
      color: "text-primary",
      bgColor: "bg-primary/10",
      show: isAccounting
    },
    {
      title: "Facturación y Conciliación",
      description: "Verifica valores cobrados vs. aprobados por las asistencias y prepara la facturación electrónica.",
      icon: Receipt,
      href: "/accounting/billing",
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      show: isAccounting
    },
    {
      title: "Nómina y Liquidación",
      description: "Liquida los pagos a técnicos, gestiona anticipos y audita el inventario de materiales.",
      icon: Wallet,
      href: "/accounting/payroll",
      color: "text-green-600",
      bgColor: "bg-green-50",
      show: isAccounting
    },
    {
      title: "Cotizaciones",
      description: "Genera propuestas comerciales para clientes nuevos o existentes con referencias únicas.",
      icon: Calculator,
      href: "/accounting/quotes",
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      show: isAccounting || isService
    },
    {
      title: "Cuentas de Cobro",
      description: "Crea documentos de cobro para personas naturales o empresas con conversión a letras automática.",
      icon: FileText,
      href: "/accounting/payment-accounts",
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      show: isAccounting || isService
    }
  ]

  const visibleModules = modules.filter(m => m.show)

  if (isUserLoading || isProfileLoading) {
    return (
      <div className="h-60 flex flex-col items-center justify-center gap-4 bg-white rounded-xl border border-dashed">
        <Loader2 className="h-8 w-8 animate-spin text-primary opacity-20" />
        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Verificando permisos...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-black tracking-tighter text-primary uppercase">Centro de Contabilidad</h1>
        <p className="text-muted-foreground font-medium">Gestión financiera centralizada para administradores y contadores.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {visibleModules.map((module) => (
          <Card key={module.href} className="hover:shadow-xl transition-all group overflow-hidden border-l-4 border-l-primary flex flex-col">
            <CardHeader className="pb-4 flex-1">
              <div className="flex items-center gap-4">
                <div className={`h-12 w-12 rounded-xl ${module.bgColor} ${module.color} flex items-center justify-center`}>
                  <module.icon className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle className="text-lg font-black uppercase tracking-tight leading-tight">{module.title}</CardTitle>
                  <CardDescription className="mt-1 text-[10px] font-bold uppercase leading-tight">{module.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <Link href={module.href}>
                <Button className="w-full gap-2 font-black uppercase text-xs h-11">
                  Ingresar al Módulo <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="bg-slate-900 text-white border-none shadow-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 text-primary">
              <Calculator className="h-4 w-4" /> Inteligencia Financiera
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-white/60 leading-relaxed">
              El sistema consolida automáticamente los reportes técnicos en el <strong className="text-white">Balance General</strong>. Cada peso reportado es trazable hasta el expediente original.
            </p>
          </CardContent>
        </Card>
        <Card className="bg-muted/30 border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2 uppercase">
              <TrendingUp className="h-4 w-4 text-green-600" /> Indicadores de Margen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Analiza la rentabilidad bruta de tus servicios en tiempo real filtrando por técnico o periodo.</p>
          </CardContent>
        </Card>
        <Card className="bg-muted/30 border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2 uppercase text-orange-600">
              <DollarSign className="h-4 w-4" /> Control de Anticipos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Recuerda que todos los anticipos registrados en los expedientes se descuentan automáticamente en el módulo de nómina.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
