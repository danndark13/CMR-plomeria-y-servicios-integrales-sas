'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore'

// Cache for SDK instances to ensure singletons
let firebaseAppInstance: FirebaseApp | undefined;
let authInstance: any;
let firestoreInstance: any;

export function initializeFirebase() {
  if (!getApps().length) {
    try {
      // Attempt to initialize via Firebase App Hosting environment variables
      firebaseAppInstance = initializeApp();
    } catch (e) {
      firebaseAppInstance = initializeApp(firebaseConfig);
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
      // Use initializeFirestore with auto-detect long polling for maximum stability
      // in cloud environments, avoiding the 'Assertion Failed' low-level error.
      firestoreInstance = initializeFirestore(firebaseApp, {
        experimentalAutoDetectLongPolling: true,
      });
    } catch (e) {
      // If already initialized, fallback to standard getter
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
