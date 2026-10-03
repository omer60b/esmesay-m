import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  getDocFromServer 
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { AppDatabase } from '../types';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
      emailVerified: auth?.currentUser?.emailVerified || null,
      isAnonymous: auth?.currentUser?.isAnonymous || null,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return errInfo;
}

// Test connection on boot per requirements
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Firestore client is offline or network disconnected.");
    }
  }
}
testConnection();

const APP_DATA_DOC = doc(db, 'appData', 'central_db');

/**
 * Save state directly to Firestore in real time
 */
export async function syncToFirestore(data: AppDatabase): Promise<boolean> {
  const pathForWrite = 'appData/central_db';
  try {
    // Safely strip undefined values to prevent Firestore setDoc invalid data errors
    const cleanData = JSON.parse(JSON.stringify(data));
    const payload = {
      ...cleanData,
      updatedAt: new Date().toISOString()
    };
    await setDoc(APP_DATA_DOC, payload, { merge: true });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, pathForWrite);
    return false;
  }
}

/**
 * Subscribe to real-time Firestore database updates
 */
export function subscribeToFirestore(onDataUpdated: (data: AppDatabase) => void): () => void {
  const pathForOnSnapshot = 'appData/central_db';
  
  const unsubscribe = onSnapshot(
    APP_DATA_DOC,
    (snapshot) => {
      if (snapshot.exists()) {
        const remoteData = snapshot.data() as AppDatabase;
        if (remoteData && Array.isArray(remoteData.branches) && Array.isArray(remoteData.users)) {
          onDataUpdated(remoteData);
        }
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, pathForOnSnapshot);
    }
  );

  return unsubscribe;
}

/**
 * Fetch remote state once from Firestore
 */
export async function fetchFirestoreData(): Promise<AppDatabase | null> {
  const pathForGetDoc = 'appData/central_db';
  try {
    const snap = await getDoc(APP_DATA_DOC);
    if (snap.exists()) {
      const data = snap.data() as AppDatabase;
      if (data && Array.isArray(data.branches) && Array.isArray(data.users)) {
        return data;
      }
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, pathForGetDoc);
    return null;
  }
}
