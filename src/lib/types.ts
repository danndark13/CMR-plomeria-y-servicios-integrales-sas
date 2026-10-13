
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
  | 'Garantía'
  | (string & {});

export type InterventionType = 'Diagnóstico' | 'Reparación' | 'Seguimiento' | 'Finalización' | 'Garantía' | 'Visita Programada';

export type BillingStatus = 'pending' | 'pre_validated' | 'validated' | 'paid';

export type ExpenseCategory = 'material' | 'transporte' | 'otros';

export type UnitOfMeasure = 'UND' | 'KG' | 'MTS' | 'GL' | 'PAR' | 'LB' | 'PQ' | 'VIAJE' | 'GAL' | 'BASE' | 'LT' | 'CM' | 'M2' | 'M3' | 'ROLLO' | 'CAJA' | 'BOLSA';

export type VisitType = 'Diurna' | 'Nocturna' | 'Festivo' | 'Fallido' | 'Intervención';

export interface TicketCostLine {
  id: string;
  costCode?: string;
  description: string;
  kind: 'service' | 'material';
  unit: string;
  quantity: number;
  unitValue: number;
  total: number;
  authorizationStatus: 'approved' | 'pending';
  costSheetItemId?: string;
  isOutOfTariff?: boolean;
}

export interface CostSheetItem {
  id: string;
  code?: string;
  kind: 'service' | 'material';
  description: string;
  unit: string;
  value: number;
  assistanceCompanyId?: string;
  createdAt: string;
  updatedAt: string;
}

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
  isReturned?: boolean; // Si es true, el material fue devuelto a la bodega central
  technicianId?: string;
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
  technicianId?: string;
  date: string;
  notes?: string;
  createdAt: string;
  subservice?: string;
  snoozedUntil?: string;
  arrivedAt?: string;
}

export interface TechnicianIntervention {
  id: string;
  title?: string;
  technicianId: string;
  type: InterventionType;
  visitType?: VisitType;
  subservice?: string;
  scheduledVisitId?: string;
  date: string;
  notes: string;
  reportedValue: number; // Valor a cobrar a la aseguradora por esta tarea
  laborCost: number;     // Mantenemos por compatibilidad
  usedRotomartillo: boolean; // Alquiler $80.000
  usedGeofono: boolean;      // Alquiler $120.000
  usedPlanchaTermofusion: boolean; // Alquiler $70.000
  detailedExpenses: Expense[];
  costLines?: TicketCostLine[];
  manualPayrollAmount?: number;
  payrollDeductionAmount?: number;
  payrollDeductionDescription?: string;
  authorName?: string;
  payrollStatus?: 'pending' | 'processed';
  payrollId?: string;
  isReadyForPayroll?: boolean; 
  isPayrollExcluded?: boolean;
  isSimpleVisit?: boolean; // Identificar visitas de $20.000
  authorizedByAdvisor?: string; // Nombre del asesor de cabina que autorizó
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
  employeeType?: 'technician' | 'office';
  date: string;
  totalGross: number;      // Total cobrado a aseguradoras
  feeAmount: number;       // El 10% descontado
  totalRentals: number;    // Rotomartillo + Geofono + Plancha
  totalExpenses: number;   // Facturas de materiales UTILIZADOS
  totalAdvances: number;   // Adelantos
  totalPreSplitDeductions?: number;
  amountToSplit: number;   // Valor que queda para dividir en 2
  netPaid: number;         // El 50% + ajuste
  adjustmentAmount: number;
  adjustmentReason?: string;
  notes?: string;          // Novedades o notas sobre la nómina
  paymentMethod?: string;
  paymentReference?: string;
  itemsCount: number;
  processedInterventionIds: string[];
  processedAdvanceIds: string[];
  serviceSubtotal?: number;
  processedItems?: {
    interventionId: string;
    claimNumber: string;
    service: string;
    subservice: string;
    visitType?: VisitType;
    grossValue: number;
    technicianAmount: number;
    materialsAmount?: number;
    preSplitDeductionAmount?: number;
    preSplitDeductionDescription?: string;
    splitBase?: number;
  }[];
  deductions?: {
    advanceId: string;
    date: string;
    claimNumber: string;
    description: string;
    amount: number;
  }[];
  servicePercentage?: number;
  visitPercentage?: number;
  isPaid?: boolean;        // Si la nómina ya fue pagada al técnico
  paidAt?: string;         // Fecha en que se marcó como pagada
  hoursWorked?: number;
  hourlyRate?: number;
  grossSalary?: number;
  pendingPaymentAmount?: number;
  deductionTicketIds?: string[];
  outstandingDeductionBalance?: number;
  carriedToPayrollId?: string;
  carriedPayments?: { payrollId: string; amount: number }[];
}

export interface PayrollDeductionTicket {
  id: string;
  personId: string;
  personName: string;
  personType: 'technician' | 'office';
  date: string;
  description: string;
  amount: number;
  remainingAmount: number;
  createdAt: string;
  updatedAt?: string;
}

export interface TechnicianPayrollSettings {
  id: string;
  technicianId: string;
  servicePercentage: number;
  visitPercentage: number;
  updatedAt: string;
}

export interface ServiceRequest {
  id: string;
  category: ServiceCategory;
  companyId: string;
  accountName: string;
  status: ServiceStatus;
  insuredName: string;
  claimNumber: string;
  folio?: number;
  address: string;
  city: string;
  phoneNumber: string;
  description: string;
  interventions: TechnicianIntervention[];
  scheduledVisit?: ScheduledVisit;
  scheduledVisits?: ScheduledVisit[];
  statusHistory?: { status: ServiceStatus; date: string; userName?: string }[];
  serviceSubservice?: string;
  advances?: Advance[];
  summary?: string;
  report?: string;
  accountingNotes?: string;
  requestedAmount?: number;
  approvedAmount?: number;
  billingStatus: BillingStatus;
  invoiceNumber?: string;
  billingConsecutive?: string;
  purchaseOrder?: string;
  invoiceServices?: string;
  invoiceAmount?: number;
  invoiceDate?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface QuoteItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Quote {
  id: string;
  reference: string;
  clientName: string;
  clientId?: string; // Optional reference to AssistanceCompany
  clientEmail?: string;
  clientPhone?: string;
  date: string;
  items: QuoteItem[];
  subtotal: number;
  tax: number; // IVA
  total: number;
  notes?: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  createdAt: string;
  updatedAt: string;
}

export interface PaymentAccount {
  id: string;
  type: 'natural' | 'company';
  issuerName: string;
  issuerId: string; // NIT or CC
  issuerPhone?: string;
  issuerAddress?: string;
  bankName?: string;
  accountType?: 'ahorros' | 'corriente';
  accountNumber?: string;
  clientName: string;
  clientDetails?: string;
  date: string;
  items: QuoteItem[];
  total: number;
  totalInWords: string;
  reference?: string;
  createdAt: string;
  updatedAt: string;
}
