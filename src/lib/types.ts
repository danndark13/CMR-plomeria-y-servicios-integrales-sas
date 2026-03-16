export type ServiceStatus = 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';

export type ServiceCategory = 
  | 'Plomería' 
  | 'Electricidad' 
  | 'Cerrajería' 
  | 'Vidriería' 
  | 'Trabajo en Alturas' 
  | 'Instalación' 
  | 'Destaponamiento';

export type InterventionType = 'Diagnóstico' | 'Reparación' | 'Seguimiento' | 'Finalización';

export interface TechnicianIntervention {
  id: string;
  technicianId: string;
  type: InterventionType;
  date: string;
  notes: string;
  laborCost: number;     // Costo de mano de obra para este técnico
  expenses: number;      // Gastos (materiales, transporte, etc.)
}

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
  
  // Información del Cliente
  insuredName: string;
  claimNumber: string;
  address: string;
  phoneNumber: string;
  
  description: string;    // Descripción inicial del problema
  
  // Historial de intervenciones (soporta múltiples técnicos)
  interventions: TechnicianIntervention[];
  
  summary?: string;       // Resumen consolidado IA
  report?: string;        // Reporte final formal
  
  createdAt: string;
  updatedAt: string;
}
