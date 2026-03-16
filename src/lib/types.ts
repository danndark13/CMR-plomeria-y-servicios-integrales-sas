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
  description: string;
  notes: string;
  summary?: string;
  createdAt: string;
  updatedAt: string;
}