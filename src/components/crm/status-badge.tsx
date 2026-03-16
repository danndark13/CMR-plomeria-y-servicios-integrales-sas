import { Badge } from "@/components/ui/badge"
import { ServiceStatus } from "@/lib/types"

const statusConfig: Record<ServiceStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className: string }> = {
  pending: { label: "Pendiente", variant: "outline", className: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  assigned: { label: "Asignado", variant: "secondary", className: "bg-blue-50 text-blue-700 border-blue-200" },
  in_progress: { label: "En Progreso", variant: "default", className: "bg-primary/10 text-primary border-primary/20" },
  completed: { label: "Completado", variant: "default", className: "bg-green-50 text-green-700 border-green-200" },
  cancelled: { label: "Cancelado", variant: "destructive", className: "" },
}

export function StatusBadge({ status }: { status: ServiceStatus }) {
  const config = statusConfig[status]
  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  )
}