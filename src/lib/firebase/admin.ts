import { cert, getApps, initializeApp, type App, type ServiceAccount } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import {
  FIREBASE_PROJECT_ID,
  FIREBASE_STORAGE_BUCKET,
  firebaseStorageBucketNames,
  firestoreDatabaseId,
} from "@/lib/firebase/config";

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
    try {
      return JSON.parse(json) as ServiceAccount;
    } catch {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT não é um JSON válido. Cole o arquivo inteiro da conta de serviço em uma linha.",
      );
    }
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
  firestore = getFirestore(getApp(), firestoreDatabaseId());
  try {
    firestore.settings({ ignoreUndefinedProperties: true });
  } catch {
    // settings só pode ser chamado uma vez por app
  }
  return firestore;
}

export function firebaseBucket(bucketName = FIREBASE_STORAGE_BUCKET) {
  return getStorage(getApp()).bucket(bucketName);
}

function isMissingBucketError(error: unknown): boolean {
  const code =
    typeof error === "object" && error && "code" in error
      ? Number((error as { code?: unknown }).code)
      : NaN;
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    code === 404 &&
    (message.includes("specified bucket does not exist") ||
      message.includes("bucket does not exist") ||
      message.includes("bucket not found"))
  );
}

/**
 * Executa uma operação no bucket configurado e, somente quando o bucket em si
 * não existe, tenta os formatos moderno e legado do Firebase. Não faz fallback
 * para erros de objeto ausente/permissão, evitando esconder falhas reais.
 */
export async function withFirebaseBucket<T>(
  operation: (bucket: ReturnType<typeof firebaseBucket>) => Promise<T>,
): Promise<T> {
  const names = firebaseStorageBucketNames();
  let lastError: unknown = null;
  for (let index = 0; index < names.length; index += 1) {
    try {
      return await operation(firebaseBucket(names[index]));
    } catch (error) {
      lastError = error;
      if (!isMissingBucketError(error) || index === names.length - 1) throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Firebase Storage indisponível.");
}

export function firebaseReadyMessage(): string {
  if (hasFirebaseAdminCredentials()) {
    return "ok";
  }
  return "Sem credencial Admin. Defina FIREBASE_SERVICE_ACCOUNT (JSON) ou FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY do projeto guiamed-918ee.";
}
