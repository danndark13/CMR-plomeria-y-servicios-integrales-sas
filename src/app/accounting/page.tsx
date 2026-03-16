
"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Receipt, Wallet, ArrowRight, DollarSign, Calculator } from "lucide-react"
import Link from "next/link"

export default function AccountingHubPage() {
  const modules = [
    {
      title: "Facturación y Conciliación",
      description: "Verifica valores cobrados vs. aprobados por las asistencias y prepara la facturación electrónica.",
      icon: Receipt,
      href: "/accounting/billing",
      color: "text-blue-600",
      bgColor: "bg-blue-50"
    },
    {
      title: "Nómina y Liquidación",
      description: "Liquida los pagos a técnicos, gestiona anticipos y audita el inventario de materiales.",
      icon: Wallet,
      href: "/accounting/payroll",
      color: "text-green-600",
      bgColor: "bg-green-50"
    }
  ]

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-primary">Centro de Contabilidad</h1>
        <p className="text-muted-foreground">Gestión financiera centralizada para administradores y contadores.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {modules.map((module) => (
          <Card key={module.href} className="hover:shadow-lg transition-all group overflow-hidden border-l-4 border-l-primary">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-4">
                <div className={`h-12 w-12 rounded-xl ${module.bgColor} ${module.color} flex items-center justify-center`}>
                  <module.icon className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle className="text-xl">{module.title}</CardTitle>
                  <CardDescription className="mt-1">{module.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Link href={module.href}>
                <Button className="w-full gap-2 group-hover:bg-primary/90">
                  Ingresar al Módulo <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="bg-muted/30 border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Calculator className="h-4 w-4 text-muted-foreground" /> Calculadora de Margen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Analiza la rentabilidad bruta de tus servicios en tiempo real desde los módulos superiores.</p>
          </CardContent>
        </Card>
        <Card className="bg-muted/30 border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" /> Control de Anticipos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Recuerda que todos los anticipos registrados se descuentan automáticamente de la nómina.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
