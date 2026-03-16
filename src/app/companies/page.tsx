"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Building2, ChevronRight, Briefcase } from "lucide-react"
import { MOCK_COMPANIES } from "@/lib/mock-data"

export default function CompaniesPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Gestión de Empresas</h1>
          <p className="text-muted-foreground">Administra tus aliados de asistencia y sus cuentas asociadas.</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> Registrar Empresa
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {MOCK_COMPANIES.map((company) => (
          <Card key={company.id} className="overflow-hidden hover:shadow-lg transition-all border-l-4 border-l-primary">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                  <Building2 className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle className="text-xl">{company.name}</CardTitle>
                  <CardDescription>{company.accounts.length} Cuentas activas</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 mt-2">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Cuentas Cliente</p>
                  <div className="flex flex-wrap gap-2">
                    {company.accounts.map((account) => (
                      <Badge key={account} variant="secondary" className="px-3 py-1 font-medium bg-accent/10 text-accent border-accent/20">
                        {account}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="w-full justify-between mt-2 text-primary hover:bg-primary/5">
                  Gestionar cuentas <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        
        <button className="flex flex-col items-center justify-center p-8 rounded-xl border-2 border-dashed border-muted hover:border-primary/50 hover:bg-primary/5 transition-all group min-h-[250px]">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-4 group-hover:scale-110 group-hover:bg-primary/20 group-hover:text-primary transition-all">
            <Plus className="h-6 w-6" />
          </div>
          <span className="text-lg font-semibold text-muted-foreground group-hover:text-primary">Añadir nueva asistencia</span>
          <span className="text-sm text-muted-foreground/60 text-center mt-1">Registra IGS, Mawdy u otros aliados</span>
        </button>
      </div>
    </div>
  )
}