import { AssistanceCompany, Technician, ServiceRequest, Reminder } from './types';

export const MOCK_COMPANIES: AssistanceCompany[] = [
  { id: '1', name: 'IKE Asistencia', accounts: ['Coomeva', 'HDI', 'Banco de Bogotá', 'Sura', 'Axa Colpatria'] },
  { id: '2', name: 'IGS', accounts: ['Allianz', 'Bancolombia', 'Claro', 'Confama', 'Davivienda', 'Ser Finanzas', 'Tuya', 'Mapfre', 'BBVA'] },
  { id: '3', name: 'Mawdy', accounts: ['Davivienda', 'Sura', 'Bolivar', 'Mapfre'] },
  { id: '4', name: 'Assisprex', accounts: ['Generali', 'Liberty Seguros', 'Allianz'] },
];

export const MOCK_TECHNICIANS: Technician[] = [
  { id: 'WILMAR', name: 'WILMAR BUITRAGO', specialties: ['Plomería', 'Destaponamiento'], activeTasks: 4 },
  { id: 'JAIVER', name: 'JAIVER OCAMPO', specialties: ['Plomería', 'Instalación'], activeTasks: 1 },
  { id: 'NORVEY', name: 'NORVEY MARIN', specialties: ['Electricidad', 'Plomería'], activeTasks: 0 },
  { id: 'ANDRES', name: 'ANDRES CARRASCAL', specialties: ['Cerrajería', 'Instalación'], activeTasks: 0 },
  { id: 'NEIDER', name: 'NEIDER VANEGAS', specialties: ['Plomería', 'Destaponamiento'], activeTasks: 0 },
  { id: 'JHOAN', name: 'JHOAN BUITRAGO', specialties: ['Plomería', 'Reparación'], activeTasks: 3 },
  { id: 'HECTOR', name: 'HECTOR', specialties: ['Vidriería', 'Cerrajería'], activeTasks: 0 },
  { id: 'URBEY', name: 'URBEY OCAMPO', specialties: ['Plomería', 'Trabajo en Alturas'], activeTasks: 0 },
  { id: 'JORGE', name: 'JORGE LOPEZ', specialties: ['Plomería', 'Instalación'], activeTasks: 0 },
];

const today = new Date();

export const MOCK_REQUESTS: ServiceRequest[] = [
  {
    id: 'REQ-001',
    category: 'Plomería',
    companyId: '1',
    accountName: 'Coomeva',
    status: 'in_progress',
    insuredName: 'Ana Maria Restrepo',
    claimNumber: 'EXP-998822',
    address: 'Calle 100 #15-30, Apt 502, Bogotá',
    phoneNumber: '310 555 1234',
    description: 'Fuga de agua en baño principal, goteo constante.',
    accountingNotes: 'Pendiente descontar $5.000 de transporte por no presentar recibo.',
    interventions: [
      {
        id: 'v1',
        technicianId: 'WILMAR',
        type: 'Diagnóstico',
        date: new Date(today.getTime() - 86400000).toISOString(),
        notes: 'Se realizó visita técnica inicial. Se identifica que la fuga proviene del sello de la brida.',
        laborCost: 45000,
        detailedExpenses: [
          { id: 'e1', amount: 5000, description: 'Transporte Urbano', category: 'transporte', isUnused: false }
        ]
      },
      {
        id: 'v2',
        technicianId: 'WILMAR',
        type: 'Reparación',
        date: today.toISOString(),
        notes: 'Programado para cambio de sellos hoy.',
        laborCost: 65000,
        detailedExpenses: [
          { 
            id: 'e2', 
            amount: 12000, 
            description: 'Kit de Sellos Brida', 
            category: 'material', 
            isUnused: false,
            isApprovedExtra: true,
            approvedByUserId: 'Andrés Castro (Admin)',
            approvedAt: new Date(today.getTime() - 3600000).toISOString()
          },
          { id: 'e3', amount: 8000, description: 'Pegante PVC', category: 'material', isUnused: true }
        ]
      }
    ],
    advances: [
      {
        id: 'adv1',
        amount: 20000,
        reason: 'Anticipo para transporte y materiales menores',
        date: today.toISOString(),
        createdByUserId: 'user-admin'
      }
    ],
    billingStatus: 'pending',
    requestedAmount: 180000,
    approvedAmount: 165000,
    auditLogs: [
      {
        id: 'log1',
        userId: 'admin-1',
        userName: 'Andrés Castro',
        action: 'Actualización Financiera',
        timestamp: new Date(today.getTime() - 3600000).toISOString(),
        details: 'Cambio de Valor Solicitado: $150k -> $180k. Valor Aprobado: $165k.'
      }
    ],
    createdAt: new Date(today.getTime() - 172800000).toISOString(),
    updatedAt: today.toISOString(),
  },
  {
    id: 'REQ-002',
    category: 'Electricidad',
    companyId: '2',
    accountName: 'Allianz',
    status: 'assigned',
    insuredName: 'Roberto Gomez',
    claimNumber: 'EXP-774411',
    address: 'Carrera 7 #127-10, Casa 4',
    phoneNumber: '315 222 9876',
    description: 'Cortocircuito en tomas de la cocina.',
    interventions: [
      {
        id: 'v3',
        technicianId: 'JAIVER',
        type: 'Reparación',
        date: new Date(today.getTime() + 86400000).toISOString(),
        notes: 'Visita programada para revisión de cableado.',
        laborCost: 40000,
        detailedExpenses: []
      }
    ],
    billingStatus: 'pending',
    createdAt: new Date(today.getTime() - 7200000).toISOString(),
    updatedAt: new Date(today.getTime() - 7200000).toISOString(),
  }
];

export const MOCK_REMINDERS: Reminder[] = [
  {
    id: 'r1',
    type: 'critical',
    title: 'Alta Carga de Trabajo',
    description: 'Wilmar Buitrago tiene 4 servicios activos. Considerar reasignación.',
    technicianId: 'WILMAR',
    createdAt: today.toISOString(),
  },
  {
    id: 'r2',
    type: 'warning',
    title: 'Reporte Pendiente',
    description: 'Expediente EXP-998822 lleva 2 días sin reporte final.',
    requestId: 'REQ-001',
    createdAt: today.toISOString(),
  }
];
