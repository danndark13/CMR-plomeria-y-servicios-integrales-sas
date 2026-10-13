"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MOCK_TECHNICIANS } from "@/lib/mock-data"
import { 
  Users, 
  Plus, 
  Settings, 
  Phone, 
  MapPin, 
  CheckCircle2, 
  Clock,
  Star
} from "lucide-react"

export default function TechniciansPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Técnicos de Campo</h1>
          <p className="text-muted-foreground">Administración de personal operativo y disponibilidad.</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> Registrar Técnico
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {MOCK_TECHNICIANS.map((tech) => (
          <Card key={tech.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <Avatar className="h-14 w-14 border-2 border-primary/10 shadow-sm">
                    <AvatarImage src={`https://picsum.photos/seed/tech-${tech.id}/100/100`} />
                    <AvatarFallback>{tech.name.substring(0,2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-lg">{tech.name}</CardTitle>
                    <div className="flex items-center gap-1 text-yellow-500 mt-1">
                      <Star className="h-3 w-3 fill-current" />
                      <Star className="h-3 w-3 fill-current" />
                      <Star className="h-3 w-3 fill-current" />
                      <Star className="h-3 w-3 fill-current" />
                      <Star className="h-3 w-3 fill-current" />
                      <span className="text-xs text-muted-foreground ml-1">(4.9)</span>
                    </div>
                  </div>
                </div>
                <Badge variant={tech.activeTasks > 2 ? "destructive" : "secondary"} className="animate-pulse">
                  {tech.activeTasks} servicios activos
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Especialidades</p>
                  <div className="flex flex-wrap gap-1">
                    {tech.specialties.map(s => (
                      <Badge key={s} variant="outline" className="text-[10px] border-primary/20 text-primary">{s}</Badge>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Contacto</p>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-3 w-3 text-muted-foreground" />
                    <span>+57 300 000 0000</span>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 gap-1">
                  <Clock className="h-3.5 w-3.5" /> Disponibilidad
                </Button>
                <Button variant="outline" size="sm" className="flex-1 gap-1">
                  <Settings className="h-3.5 w-3.5" /> Perfil
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}