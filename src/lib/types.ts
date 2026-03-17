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
  isUnused: boolean; // Si es true, queda en inventario y no suma al costo del servicio en nómina
}

export interface Advance {
  id: string;
  amount: number;
  reason: string;
  date: string;
  createdByUserId: string;
  technicianId: string;
  isPaidInPayroll?: boolean;
  payrollId?: string;
}

export interface ScheduledVisit {
  id: string;
  technicianId: string;
  date: string;
  notes?: string;
  createdAt: string;
}

export interface TechnicianIntervention {
  id: string;
  technicianId: string;
  type: InterventionType;
  date: string;
  notes: string;
  reportedValue: number; // Valor a cobrar a la aseguradora por esta tarea
  laborCost: number;     // Mantenemos por compatibilidad
  usedRotomartillo: boolean; // Alquiler $80.000
  usedGeofono: boolean;      // Alquiler $120.000
  detailedExpenses: Expense[];
  authorName?: string;
  payrollStatus?: 'pending' | 'processed';
  payrollId?: string;
  isReadyForPayroll?: boolean; 
  isSimpleVisit?: boolean; // Identificar visitas de $20.000
}

export interface AssistanceCompany {
  id: string;
  name: string;
  accounts: string[];
  contactPerson?: string;
  contactEmail?: string;
  contactPhone?: string;
}

export interface Technician {
  id: string;
  name: string;
  specialties: ServiceCategory[];
  activeTasks: number;
}

export interface PayrollRecord {
  id: string;
  technicianId: string;
  date: string;
  totalGross: number;      // Total cobrado a aseguradoras
  feeAmount: number;       // El 10% descontado
  totalRentals: number;    // Rotomartillo + Geofono
  totalExpenses: number;   // Facturas de materiales UTILIZADOS
  totalAdvances: number;   // Adelantos
  amountToSplit: number;   // Valor que queda para dividir en 2
  netPaid: number;         // El 50% + ajuste
  adjustmentAmount: number;
  adjustmentReason?: string;
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
  insuredName: string;
  claimNumber: string;
  address: string;
  phoneNumber: string;
  description: string;
  interventions: TechnicianIntervention[];
  scheduledVisit?: ScheduledVisit;
  advances?: Advance[];
  summary?: string;
  report?: string;
  accountingNotes?: string;
  requestedAmount?: number;
  approvedAmount?: number;
  billingStatus: BillingStatus;
  invoiceNumber?: string;
  billingConsecutive?: string;
  createdAt: string;
  updatedAt: string;
}
