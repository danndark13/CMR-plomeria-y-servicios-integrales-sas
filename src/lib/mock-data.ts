import { AssistanceCompany, Technician, ServiceRequest, Reminder } from './types';

export const MOCK_COMPANIES: AssistanceCompany[] = [
  { 
    id: 'IKE', 
    name: 'IKE Asistencia', 
    accounts: [
      'HDI (AL) COOMEVA', 
      'HDI', 
      'HDI COOMEVA', 
      'NEXUS', 
      'PREVISORA', 
      'HDI (AL) LIVIANOS COOMEVA', 
      'HDI HOGAR DULCE HOGAR', 
      'POPULAR DOWNGRADE', 
      'PREVISORA HOGAR 2024', 
      'HDI (AL) HOGAR COOMEVA', 
      'PREVISORA AREAS COMUNES', 
      'HDI (AL) HOGAR BASICO+PLUS', 
      'HDI (AL) HOGAR BASICO+PLUS+ESPECIALIZADO', 
      'PREVISORA AREAS COMUNES 2024', 
      'BANCO POPULAR CUENTABIENTES 2019', 
      'COLMENA CARTERA BCS', 
      'HDI (AL) GENERALES ADMINISTRATIVOS', 
      'HDI (AL) LIVIANOS', 
      'POPULAR CUENTAHABIENTES PLUS', 
      'BANCO POPULAR VITAL',
      'COOMEVA'
    ] 
  },
  { 
    id: 'IGS', 
    name: 'IGS', 
    accounts: [
      'ALLIANZ', 
      'BANCOLOMBIA', 
      'CLARO', 
      'CONFAMA', 
      'DAVIVIENDA', 
      'SER FINANZAS', 
      'TUYA', 
      'MAPFRE', 
      'BBVA',
      'SURA',
      'SEGUROS BOLIVAR'
    ] 
  },
  { 
    id: 'MAWDY', 
    name: 'MAWDY', 
    accounts: ['DAVIVIENDA', 'SURA', 'BOLIVAR', 'MAPFRE', 'AXA COLPATRIA'] 
  },
  { 
    id: 'ASSISPREX', 
    name: 'ASSISPREX', 
    accounts: ['GENERALI', 'LIBERTY SEGUROS', 'ALLIANZ', 'LA EQUIDAD'] 
  },
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
const getDate = (daysAgo: number) => new Date(today.getTime() - (daysAgo * 86400000)).toISOString();

export const MOCK_REQUESTS: ServiceRequest[] = [
  {
    id: 'REQ-001',
    category: 'Plomería',
    companyId: 'IKE',
    accountName: 'HDI (AL) COOMEVA',
    status: 'in_progress',
    insuredName: 'MARIA FERNANDA ROJAS',
    claimNumber: 'EXP-2025-001',
    address: 'CALLE 127 #45-20, APT 402',
    phoneNumber: '310 456 7890',
    description: 'FUGA EN EL REGISTRO PRINCIPAL DEL APARTAMENTO.',
    billingStatus: 'pending',
    requestedAmount: 150000,
    approvedAmount: 0,
    interventions: [
      {
        id: 'v1',
        technicianId: 'WILMAR',
        type: 'Diagnóstico',
        date: getDate(1),
        notes: 'SE IDENTIFICA ROTURA EN TUBO DE 1/2 PULGADA.',
        laborCost: 45000,
        detailedExpenses: [{ id: 'e1', amount: 15000, description: 'TUBO PVC 1/2', category: 'material', isUnused: false }]
      }
    ],
    createdAt: getDate(2),
    updatedAt: getDate(0),
  },
  {
    id: 'REQ-002',
    category: 'Cerrajería',
    companyId: 'IGS',
    accountName: 'ALLIANZ',
    status: 'assigned',
    insuredName: 'CARLOS ANDRES GOMEZ',
    claimNumber: 'EXP-998877',
    address: 'CRA 15 #100-30',
    phoneNumber: '315 222 3344',
    description: 'APERTURA DE PUERTA PRINCIPAL POR EXTRAVIO DE LLAVES.',
    billingStatus: 'pending',
    scheduledVisit: {
      id: 'sv1',
      technicianId: 'ANDRES',
      date: new Date(today.getTime() + 3600000).toISOString(),
      createdAt: getDate(0)
    },
    interventions: [],
    createdAt: getDate(0),
    updatedAt: getDate(0),
  },
  {
    id: 'REQ-003',
    category: 'Impermeabilización',
    companyId: 'IGS',
    accountName: 'BANCOLOMBIA',
    status: 'pending',
    insuredName: 'JUAN PABLO BELTRAN',
    claimNumber: 'IGS-554433',
    address: 'AV. BOYACA #138-10',
    phoneNumber: '300 111 2233',
    description: 'FILTRACION EN TECHO POR LLUVIAS RECIENTES.',
    billingStatus: 'pending',
    interventions: [],
    createdAt: getDate(1),
    updatedAt: getDate(1),
  },
  {
    id: 'REQ-004',
    category: 'Electricidad',
    companyId: 'IKE',
    accountName: 'PREVISORA',
    status: 'completed',
    insuredName: 'ALICIA MEJIA',
    claimNumber: 'IKE-776655',
    address: 'CALLE 80 #68-40',
    phoneNumber: '320 999 8877',
    description: 'CORTO CIRCUITO EN TOMA CORRIENTE DE LA COCINA.',
    billingStatus: 'validated',
    invoiceNumber: 'FE-1020',
    billingConsecutive: '2025-005',
    requestedAmount: 85000,
    approvedAmount: 85000,
    interventions: [
      {
        id: 'v2',
        technicianId: 'NORVEY',
        type: 'Finalización',
        date: getDate(3),
        notes: 'CAMBIO DE TOMA CORRIENTE Y REVISION DE TACOS.',
        laborCost: 60000,
        detailedExpenses: [{ id: 'e2', amount: 25000, description: 'TOMA CORRIENTE LEVITON', category: 'material', isUnused: false }]
      }
    ],
    createdAt: getDate(5),
    updatedAt: getDate(3),
  },
  {
    id: 'REQ-005',
    category: 'Destaponamiento',
    companyId: 'IKE',
    accountName: 'NEXUS',
    status: 'in_progress',
    insuredName: 'ROBERTO CANO',
    claimNumber: 'EXP-443322',
    address: 'CRA 7 #72-10',
    phoneNumber: '311 444 5566',
    description: 'TAPONAMIENTO DE SIFON EN PATIO DE ROPAS.',
    billingStatus: 'pending',
    interventions: [
      {
        id: 'v3',
        technicianId: 'NEIDER',
        type: 'Diagnóstico',
        date: getDate(0),
        notes: 'SE REQUIERE USO DE SONDA ELECTRICA.',
        laborCost: 55000,
        detailedExpenses: []
      }
    ],
    createdAt: getDate(1),
    updatedAt: getDate(0),
  },
  {
    id: 'REQ-006',
    category: 'Garantía',
    companyId: 'IGS',
    accountName: 'SURA',
    status: 'warranty',
    insuredName: 'SANDRA MILENA PAEZ',
    claimNumber: 'GAR-001',
    address: 'CALLE 134 #19-50',
    phoneNumber: '318 777 6655',
    description: 'REINCIDENCIA DE GOTEO EN LLAVE DE LAVAMANOS REPARADA HACE 1 SEMANA.',
    billingStatus: 'pending',
    interventions: [],
    createdAt: getDate(2),
    updatedAt: getDate(2),
  },
  {
    id: 'REQ-007',
    category: 'Plomería',
    companyId: 'MAWDY',
    accountName: 'DAVIVIENDA',
    status: 'completed',
    insuredName: 'FERNANDO ARANGO',
    claimNumber: 'MAW-112233',
    address: 'CRA 50 #120-15',
    phoneNumber: '301 555 4433',
    description: 'INSTALACION DE CALENTADOR ELECTRICO.',
    billingStatus: 'validated',
    invoiceNumber: 'FE-1021',
    billingConsecutive: '2025-006',
    requestedAmount: 120000,
    approvedAmount: 110000,
    interventions: [
      {
        id: 'v4',
        technicianId: 'URBEY',
        type: 'Finalización',
        date: getDate(4),
        notes: 'INSTALACION EXITOSA Y PRUEBA DE FUNCIONAMIENTO.',
        laborCost: 90000,
        detailedExpenses: [{ id: 'e3', amount: 20000, description: 'ACCESORIOS GALVANIZADOS', category: 'material', isUnused: false }]
      }
    ],
    createdAt: getDate(6),
    updatedAt: getDate(4),
  },
  {
    id: 'REQ-008',
    category: 'Vidriería',
    companyId: 'IGS',
    accountName: 'TUYA',
    status: 'assigned',
    insuredName: 'GLORIA ESTELLA',
    claimNumber: 'IGS-887766',
    address: 'CRA 9 #150-20',
    phoneNumber: '316 333 2211',
    description: 'RUPTURA DE VIDRIO DE VENTANA PRINCIPAL.',
    billingStatus: 'pending',
    scheduledVisit: {
      id: 'sv2',
      technicianId: 'HECTOR',
      date: new Date(today.getTime() + 172800000).toISOString(),
      createdAt: getDate(0)
    },
    interventions: [],
    createdAt: getDate(1),
    updatedAt: getDate(0),
  },
  {
    id: 'REQ-009',
    category: 'Electricidad',
    companyId: 'IKE',
    accountName: 'HDI COOMEVA',
    status: 'pending',
    insuredName: 'DANIEL CASTAÑO',
    claimNumber: 'EXP-556677',
    address: 'CALLE 170 #50-10',
    phoneNumber: '312 888 7766',
    description: 'REVISION DE TABLERO DE BREAKERS POR SOBRECARGA.',
    billingStatus: 'pending',
    interventions: [],
    createdAt: getDate(0),
    updatedAt: getDate(0),
  },
  {
    id: 'REQ-010',
    category: 'Plomería',
    companyId: 'IGS',
    accountName: 'MAPFRE',
    status: 'in_progress',
    insuredName: 'JIMENA SUAREZ',
    claimNumber: 'IGS-332211',
    address: 'CRA 11 #93-40',
    phoneNumber: '314 666 5544',
    description: 'HUMEDAD EN PARED COLINDANTE CON BAÑO SOCIAL.',
    billingStatus: 'pending',
    interventions: [
      {
        id: 'v5',
        technicianId: 'JORGE',
        type: 'Diagnóstico',
        date: getDate(1),
        notes: 'SE REALIZA EXPLORACION, SE DETECTA PORO EN TUBO DE COBRE.',
        laborCost: 50000,
        detailedExpenses: []
      }
    ],
    createdAt: getDate(2),
    updatedAt: getDate(1),
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
  }
];
