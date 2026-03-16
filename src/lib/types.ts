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

export type ExpenseCategory = 'material' | 'transporte' | 'otros';

export interface AuditEntry {
  id: string;
  userId: string;
  userName: string;
  action: string;
  timestamp: string;
  details: string;
}

export interface Expense {
  id: string;
  amount: number;
  description: string;
  category: ExpenseCategory;
  isUnused: boolean; // Si es true, queda en inventario y no suma al costo del servicio
  isApprovedExtra?: boolean; // Si es true, permite duplicar material que ya está en inventario
  approvedByUserId?: string; // ID del usuario que aprobó el gasto extra
  approvedAt?: string;      // Fecha de la aprobación
}

export interface InventoryItem {
  id: string;
  description: string;
  quantity: string;
  addedAt: string;
}

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
  detailedExpenses: Expense[]; // Lista de gastos detallados
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
  inventory?: InventoryItem[]; // Inventario activo del técnico
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
  
  // Auditoría
  auditLogs?: AuditEntry[];
  
  createdAt: string;
  updatedAt: string;
}
