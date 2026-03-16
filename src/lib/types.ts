export type ServiceStatus = 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';

export type ServiceCategory = 
  | 'Plomería' 
  | 'Electricidad' 
  | 'Cerrajería' 
  | 'Vidriería' 
  | 'Trabajo en Alturas' 
  | 'Instalación' 
  | 'Destaponamiento';

export interface AssistanceCompany {
  id: string;
  name: string;
  accounts: string[];
}

export interface Technician {
  id: string;
  name: string;
  specialties: ServiceCategory[];
  activeTasks: number;
}

export interface ServiceRequest {
  id: string;
  category: ServiceCategory;
  companyId: string;
  accountName: string;
  status: ServiceStatus;
  technicianId?: string;
  
  // Nuevos campos solicitados
  insuredName: string;    // Nombre del asegurado
  claimNumber: string;    // Expediente
  address: string;        // Dirección
  phoneNumber: string;    // Teléfono
  
  description: string;    // Descripción inicial
  notes: string;          // Notas técnicas/bitácora
  summary?: string;       // Resumen generado por IA
  report?: string;        // Reporte final formal
  
  createdAt: string;
  updatedAt: string;
}
