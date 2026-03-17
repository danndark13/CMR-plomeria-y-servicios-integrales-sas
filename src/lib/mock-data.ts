
import { AssistanceCompany, Technician, ServiceRequest, Reminder } from './types';

/**
 * LISTADO DE EMPRESAS Y CUENTAS
 * Mantenemos este listado como base estructural para facilitar la migración,
 * pero se recomienda ir registrándolas en el módulo de "Empresas" para que sean 100% reales en Firestore.
 */
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

/**
 * LISTADO DE TÉCNICOS INICIALES
 */
export const MOCK_TECHNICIANS: Technician[] = [
  { id: 'TEC01', name: 'OPERARIO TEC01', specialties: ['Plomería', 'Electricidad'], activeTasks: 0 },
  { id: 'WILMAR', name: 'WILMAR BUITRAGO', specialties: ['Plomería', 'Destaponamiento'], activeTasks: 0 },
  { id: 'JAIVER', name: 'JAIVER OCAMPO', specialties: ['Plomería', 'Instalación'], activeTasks: 0 },
  { id: 'NORVEY', name: 'NORVEY MARIN', specialties: ['Electricidad', 'Plomería'], activeTasks: 0 },
  { id: 'ANDRES', name: 'ANDRES CARRASCAL', specialties: ['Cerrajería', 'Instalación'], activeTasks: 0 },
  { id: 'NEIDER', name: 'NEIDER VANEGAS', specialties: ['Plomería', 'Destaponamiento'], activeTasks: 0 },
  { id: 'JHOAN', name: 'JHOAN BUITRAGO', specialties: ['Plomería', 'Reparación'], activeTasks: 0 },
  { id: 'HECTOR', name: 'HECTOR', specialties: ['Vidriería', 'Cerrajería'], activeTasks: 0 },
  { id: 'URBEY', name: 'URBEY OCAMPO', specialties: ['Plomería', 'Trabajo en Alturas'], activeTasks: 0 },
  { id: 'JORGE', name: 'JORGE LOPEZ', specialties: ['Plomería', 'Instalación'], activeTasks: 0 },
];

/**
 * EXPEDIENTES DE PRUEBA (LIMPIOS PARA DATOS REALES)
 */
export const MOCK_REQUESTS: ServiceRequest[] = [];

/**
 * ALERTAS DE PRUEBA
 */
export const MOCK_REMINDERS: Reminder[] = [];
