export type ServiceStatus = 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled' | 'warranty';

export type ServiceCategory = 
  | 'Plomería' 
  | 'Electricidad' 
  | 'Cerrajería' 
  | 'Vidriería' 
  | 'Trabajo en Alturas' 
  | 'Instalación' 
  | 'Destaponamiento'
  | 'Taponamiento'
  | 'Impermeabilización'
  | 'Garantía';

export type InterventionType = 'Diagnóstico' | 'Reparación' | 'Seguimiento' | 'Finalización' | 'Garantía' | 'Visita Programada';

export type BillingStatus = 'pending' | 'pre_validated' | 'validated' | 'paid';

export type ExpenseCategory = 'material' | 'transporte' | 'otros';

export type UnitOfMeasure = 'UND' | 'KG' | 'MTS' | 'GL' | 'PAR' | 'LB' | 'PQ' | 'VIAJE';

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
  amount: number; // Valor total (cantidad * valorUnitario)
  description: string;
  category: ExpenseCategory;
  unit?: UnitOfMeasure;
  quantity?: number;
  unitValue?: number;
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
  isPaidInPayroll?: boolean; // Nuevo: indica si ya se descontó en una nómina
  payrollId?: string;        // ID de la nómina donde se descontó
}

export interface ScheduledVisit {
  id: string;
  technicianId: string;
  date: string; // ISO String
  notes?: string;
  createdAt: string;
}

export interface TechnicianIntervention {
  id: string;
  technicianId: string;
  type: InterventionType;
  date: string;
  notes: string;
  laborCost: number;     // Costo de mano de obra para este técnico
  detailedExpenses: Expense[]; // Lista de gastos detallados
  authorName?: string;   // Nombre de quien hizo el reporte
  payrollStatus?: 'pending' | 'processed'; // Nuevo: estado de pago en nómina
  payrollId?: string;                      // ID de la nómina vinculada
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

export interface PayrollRecord {
  id: string;
  technicianId: string;
  date: string;
  totalLabor: number;
  totalExpenses: number;
  totalAdvances: number;
  netPaid: number;
  itemsCount: number;
  processedInterventionIds: string[];
  processedAdvanceIds: string[];
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
  
  // Visita programada actual (opcional)
  scheduledVisit?: ScheduledVisit;
  
  // Anticipos entregados al técnico
  advances?: Advance[];
  
  summary?: string;       // Resumen consolidado IA
  report?: string;        // Reporte final formal
  accountingNotes?: string; // Notas de contabilidad para liquidación
  
  // Facturación
  requestedAmount?: number; // Lo que pretendemos cobrar
  approvedAmount?: number;  // Lo que la asistencia aprueba pagar
  billingStatus: BillingStatus;
  invoiceNumber?: string;
  billingConsecutive?: string; // Consecutivo interno contable
  
  // Auditoría
  auditLogs?: AuditEntry[];
  
  createdAt: string;
  updatedAt: string;
}
