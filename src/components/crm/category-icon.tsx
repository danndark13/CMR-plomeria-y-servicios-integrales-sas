import { ServiceCategory } from "@/lib/types"
import { 
  Droplets, 
  Zap, 
  Key, 
  Square, 
  Mountain, 
  Wrench, 
  Waves,
  ShieldAlert,
  Paintbrush,
  Hammer
} from "lucide-react"

const iconMap: Record<ServiceCategory, any> = {
  'Plomería': Droplets,
  'Electricidad': Zap,
  'Cerrajería': Key,
  'Vidriería': Square,
  'Trabajo en Alturas': Mountain,
  'Instalación': Hammer,
  'Destaponamiento': Waves,
  'Taponamiento': Waves,
  'Impermeabilización': Paintbrush,
  'Garantía': ShieldAlert,
}

export function CategoryIcon({ category, className }: { category: ServiceCategory; className?: string }) {
  const Icon = iconMap[category] || Wrench
  return <Icon className={className} />
}
