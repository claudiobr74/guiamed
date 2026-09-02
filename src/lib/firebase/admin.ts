import { cert, getApps, initializeApp, type App, type ServiceAccount } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { FIREBASE_PROJECT_ID, FIREBASE_STORAGE_BUCKET } from "@/lib/firebase/config";

export function hasFirebaseAdminCredentials(): boolean {
  return Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT ||
      (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS,
  );
}

function serviceAccount(): ServiceAccount | null {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (json) {
    return JSON.parse(json) as ServiceAccount;
  }
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (clientEmail && privateKey) {
    return {
      projectId: FIREBASE_PROJECT_ID,
      clientEmail,
      privateKey,
    };
  }
  return null;
}

function getApp(): App {
  const existing = getApps()[0];
  if (existing) return existing;
  const account = serviceAccount();
  if (account) {
    return initializeApp({
      credential: cert(account),
      projectId: FIREBASE_PROJECT_ID,
      storageBucket: FIREBASE_STORAGE_BUCKET,
    });
  }
  return initializeApp({
    projectId: FIREBASE_PROJECT_ID,
    storageBucket: FIREBASE_STORAGE_BUCKET,
  });
}

export function firebaseAuth() {
  return getAuth(getApp());
}

let firestore: Firestore | null = null;

export function firebaseDb() {
  if (firestore) return firestore;
  firestore = getFirestore(getApp());
  try {
    firestore.settings({ ignoreUndefinedProperties: true });
  } catch {
    // settings só pode ser chamado uma vez por app
  }
  return firestore;
}

export function firebaseBucket() {
  return getStorage(getApp()).bucket(FIREBASE_STORAGE_BUCKET);
}

export function firebaseReadyMessage(): string {
  if (hasFirebaseAdminCredentials()) {
    return "ok";
  }
  return "Sem credencial Admin. Defina FIREBASE_SERVICE_ACCOUNT (JSON) ou FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY do projeto guiamed-918ee.";
}
