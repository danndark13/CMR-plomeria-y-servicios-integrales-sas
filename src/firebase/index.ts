'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { 
  getFirestore, 
  initializeFirestore, 
  Firestore,
  memoryLocalCache
} from 'firebase/firestore'

// Cache for SDK instances to ensure singletons
let firebaseAppInstance: FirebaseApp | undefined;
let authInstance: Auth | undefined;
let firestoreInstance: Firestore | undefined;

export function initializeFirebase() {
  // Guarantee this only runs on the client side (Browser)
  if (typeof window === 'undefined') return { 
    firebaseApp: null as any, 
    auth: null as any, 
    firestore: null as any 
  };

  if (!getApps().length) {
    try {
      firebaseAppInstance = initializeApp(firebaseConfig);
    } catch (e) {
      console.error("Critical failure in Firebase App initialization:", e);
      firebaseAppInstance = getApp();
    }
  } else {
    firebaseAppInstance = getApp();
  }

  return getSdks(firebaseAppInstance);
}

export function getSdks(firebaseApp: FirebaseApp) {
  if (!authInstance) {
    authInstance = getAuth(firebaseApp);
  }

  if (!firestoreInstance) {
    try {
      /**
       * EXTREME STABILITY CONFIGURATION FOR CLOUD WORKSTATIONS
       * 1. experimentalForceLongPolling: Uses standard HTTP instead of WebSockets.
       * 2. localCache: memoryLocalCache(): Disables disk persistence (IndexedDB).
       * This avoids "INTERNAL ASSERTION FAILED" errors caused by network interruptions.
       */
      firestoreInstance = initializeFirestore(firebaseApp, {
        experimentalForceLongPolling: true,
        localCache: memoryLocalCache(),
      });
    } catch (e) {
      firestoreInstance = getFirestore(firebaseApp);
    }
  }

  return {
    firebaseApp,
    auth: authInstance,
    firestore: firestoreInstance
  };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
