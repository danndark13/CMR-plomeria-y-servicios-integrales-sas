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

export type BillingStatus = 'pending' | 'ready_to_bill' | 'billed' | 'paid';

export interface Advance {
  id: string;
  amount: number;
  reason: string;
  date: string;
  createdByUserId: string;
}

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

export interface Reminder {
  id: string;
  type: 'warning' | 'info' | 'critical';
  title: string;
  description: string;
  technicianId?: string;
  requestId?: string;
  createdAt: string;
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
  
  // Anticipos entregados al técnico
  advances?: Advance[];
  
  summary?: string;       // Resumen consolidado IA
  report?: string;        // Reporte final formal
  
  // Facturación
  requestedAmount?: number; // Lo que pretendemos cobrar
  approvedAmount?: number;  // Lo que la asistencia aprueba pagar
  billingStatus: BillingStatus;
  invoiceNumber?: string;
  
  createdAt: string;
  updatedAt: string;
}
