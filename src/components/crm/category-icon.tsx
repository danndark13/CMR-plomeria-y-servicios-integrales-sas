import { ServiceCategory } from "@/lib/types"
import { 
  Droplets, 
  Zap, 
  Key, 
  Square, 
  Mountain, 
  Wrench, 
  Waves 
} from "lucide-react"

const iconMap: Record<ServiceCategory, any> = {
  'Plomería': Droplets,
  'Electricidad': Zap,
  'Cerrajería': Key,
  'Vidriería': Square,
  'Trabajo en Alturas': Mountain,
  'Instalación': Wrench,
  'Destaponamiento': Waves,
}

export function CategoryIcon({ category, className }: { category: ServiceCategory; className?: string }) {
  const Icon = iconMap[category] || Wrench
  return <Icon className={className} />
}