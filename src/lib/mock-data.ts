import { AssistanceCompany, Technician, ServiceRequest } from './types';

export const MOCK_COMPANIES: AssistanceCompany[] = [
  { id: '1', name: 'IKE Asistencia', accounts: ['Coomeva', 'HDI', 'Banco de Bogotá', 'Sura'] },
  { id: '2', name: 'IGS', accounts: ['Allianz', 'Axa Colpatria', 'Mapfre'] },
  { id: '3', name: 'Mawdy', accounts: ['Davivienda', 'BBVA'] },
  { id: '4', name: 'Assisprex', accounts: ['Generali', 'Liberty Seguros'] },
];

export const MOCK_TECHNICIANS: Technician[] = [
  { id: 't1', name: 'Juan Perez', specialties: ['Plomería', 'Destaponamiento'], activeTasks: 2 },
  { id: 't2', name: 'Carlos Ruiz', specialties: ['Electricidad', 'Instalación'], activeTasks: 1 },
  { id: 't3', name: 'Luis Gomez', specialties: ['Cerrajería'], activeTasks: 0 },
  { id: 't4', name: 'Mario Diaz', specialties: ['Trabajo en Alturas', 'Vidriería'], activeTasks: 3 },
];

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
        date: new Date(Date.now() - 86400000).toISOString(),
        notes: 'Se realizó visita técnica inicial. Se identifica que la fuga proviene del sello de la brida. Se requiere cambio de empaque.',
        laborCost: 45000,
        expenses: 5000
      },
      {
        id: 'v2',
        technicianId: 't4',
        type: 'Reparación',
        date: new Date(Date.now() - 3600000).toISOString(),
        notes: 'Se procede con el cambio de brida y sello de cera. Pruebas de descarga sin filtraciones.',
        laborCost: 65000,
        expenses: 12000
      }
    ],
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
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
        type: 'Diagnóstico',
        date: new Date(Date.now() - 3600000).toISOString(),
        notes: 'Se revisa caja de breakers. Hay sobrecarga en el circuito 4 por electrodomésticos.',
        laborCost: 40000,
        expenses: 0
      }
    ],
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    updatedAt: new Date(Date.now() - 7200000).toISOString(),
  }
];
