import { Badge } from "@/components/ui/badge"
import { ServiceStatus } from "@/lib/types"

const statusConfig: Record<ServiceStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className: string }> = {
  pending: { label: "Pendiente", variant: "outline", className: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  assigned: { label: "Programado", variant: "secondary", className: "bg-blue-50 text-blue-700 border-blue-200" },
  in_progress: { label: "En Proceso", variant: "default", className: "bg-primary/10 text-primary border-primary/20" },
  completed: { label: "Finalizado", variant: "default", className: "bg-green-600 text-white border-green-700 font-black" },
  cancelled: { label: "Cancelado", variant: "destructive", className: "" },
  warranty: { label: "Garantía", variant: "default", className: "bg-orange-500 text-white border-orange-600 animate-pulse" },
}

export function StatusBadge({ status }: { status: ServiceStatus }) {
  const config = statusConfig[status] || { label: status, variant: "outline", className: "" }
  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  )
}
