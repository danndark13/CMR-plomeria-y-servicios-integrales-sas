import { AssistanceCompany, Technician, ServiceRequest, Reminder } from './types';

export const MOCK_COMPANIES: AssistanceCompany[] = [
  { id: '1', name: 'IKE Asistencia', accounts: ['Coomeva', 'HDI', 'Banco de Bogotá', 'Sura'] },
  { id: '2', name: 'IGS', accounts: ['Allianz', 'Axa Colpatria', 'Mapfre'] },
  { id: '3', name: 'Mawdy', accounts: ['Davivienda', 'BBVA'] },
  { id: '4', name: 'Assisprex', accounts: ['Generali', 'Liberty Seguros'] },
];

export const MOCK_TECHNICIANS: Technician[] = [
  { id: 't1', name: 'Juan Perez', specialties: ['Plomería', 'Destaponamiento'], activeTasks: 4 },
  { id: 't2', name: 'Carlos Ruiz', specialties: ['Electricidad', 'Instalación'], activeTasks: 1 },
  { id: 't3', name: 'Luis Gomez', specialties: ['Cerrajería'], activeTasks: 0 },
  { id: 't4', name: 'Mario Diaz', specialties: ['Trabajo en Alturas', 'Vidriería'], activeTasks: 3 },
];

const today = new Date();
const tomorrow = new Date(today);
tomorrow.setDate(today.getDate() + 1);
const nextWeek = new Date(today);
nextWeek.setDate(today.getDate() + 7);

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
    interventions: [
      {
        id: 'v1',
        technicianId: 't1',
        type: 'Diagnóstico',
        date: new Date(today.getTime() - 86400000).toISOString(),
        notes: 'Se realizó visita técnica inicial. Se identifica que la fuga proviene del sello de la brida.',
        laborCost: 45000,
        expenses: 5000
      },
      {
        id: 'v2',
        technicianId: 't4',
        type: 'Reparación',
        date: today.toISOString(),
        notes: 'Programado para cambio de sellos hoy.',
        laborCost: 65000,
        expenses: 12000
      }
    ],
    billingStatus: 'pending',
    requestedAmount: 180000,
    approvedAmount: 165000,
    createdAt: new Date(today.getTime() - 172800000).toISOString(),
    updatedAt: today.toISOString(),
  },
  {
    id: 'REQ-002',
    category: 'Electricidad',
    companyId: '1',
    accountName: 'HDI',
    status: 'assigned',
    insuredName: 'Roberto Gomez',
    claimNumber: 'EXP-774411',
    address: 'Carrera 7 #127-10, Casa 4',
    phoneNumber: '315 222 9876',
    description: 'Cortocircuito en tomas de la cocina.',
    interventions: [
      {
        id: 'v3',
        technicianId: 't2',
        type: 'Reparación',
        date: tomorrow.toISOString(),
        notes: 'Visita programada para revisión de cableado.',
        laborCost: 40000,
        expenses: 0
      }
    ],
    billingStatus: 'pending',
    createdAt: new Date(today.getTime() - 7200000).toISOString(),
    updatedAt: new Date(today.getTime() - 7200000).toISOString(),
  },
  {
    id: 'REQ-003',
    category: 'Cerrajería',
    companyId: '3',
    accountName: 'Davivienda',
    status: 'pending',
    insuredName: 'Marta Lucia',
    claimNumber: 'EXP-552233',
    address: 'Av. Jimenez #4-12',
    phoneNumber: '320 444 5566',
    description: 'Apertura de puerta principal por olvido de llaves.',
    interventions: [
      {
        id: 'v4',
        technicianId: 't3',
        type: 'Diagnóstico',
        date: nextWeek.toISOString(),
        notes: 'Programado para mantenimiento preventivo de cerraduras.',
        laborCost: 35000,
        expenses: 0
      }
    ],
    billingStatus: 'pending',
    createdAt: today.toISOString(),
    updatedAt: today.toISOString(),
  }
];

export const MOCK_REMINDERS: Reminder[] = [
  {
    id: 'r1',
    type: 'critical',
    title: 'Alta Carga de Trabajo',
    description: 'Juan Perez tiene 4 servicios activos. Considerar reasignación.',
    technicianId: 't1',
    createdAt: today.toISOString(),
  },
  {
    id: 'r2',
    type: 'warning',
    title: 'Reporte Pendiente',
    description: 'Expediente EXP-998822 lleva 2 días sin reporte final.',
    requestId: 'REQ-001',
    createdAt: today.toISOString(),
  },
  {
    id: 'r3',
    type: 'info',
    title: 'Próxima Visita',
    description: 'Visita técnica de Carlos Ruiz inicia en 30 minutos.',
    technicianId: 't2',
    createdAt: today.toISOString(),
  }
];
