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
    status: 'pending',
    description: 'Fuga de agua en baño principal, goteo constante.',
    notes: 'El cliente reporta que el agua sale por debajo del sanitario.',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'REQ-002',
    category: 'Electricidad',
    companyId: '1',
    accountName: 'HDI',
    status: 'assigned',
    technicianId: 't2',
    description: 'Cortocircuito en tomas de la cocina.',
    notes: 'Se requiere revisión de breakers principales.',
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    updatedAt: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: 'REQ-003',
    category: 'Cerrajería',
    companyId: '2',
    accountName: 'Allianz',
    status: 'in_progress',
    technicianId: 't3',
    description: 'Apertura de puerta de emergencia trabada.',
    notes: 'El técnico ya se encuentra en sitio evaluando el cilindro.',
    createdAt: new Date(Date.now() - 10800000).toISOString(),
    updatedAt: new Date(Date.now() - 5400000).toISOString(),
  },
  {
    id: 'REQ-004',
    category: 'Destaponamiento',
    companyId: '3',
    accountName: 'Davivienda',
    status: 'completed',
    technicianId: 't1',
    description: 'Sifón de patio obstruido por sedimentos.',
    notes: 'Se realizó limpieza profunda con sonda eléctrica. Se verificó drenaje correcto.',
    summary: 'Limpieza de sifón de patio completada exitosamente usando sonda eléctrica.',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 82800000).toISOString(),
  }
];