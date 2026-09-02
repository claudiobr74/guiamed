import type { Firestore } from "firebase-admin/firestore";
import { firebaseDb } from "@/lib/firebase/admin";

export type Db = Firestore;

export async function getDb(): Promise<Db> {
  return firebaseDb();
}

/** Executa acesso server-side com identidade organizacional explícita. */
export async function withOrganizationContext<T>(
  organizationId: string,
  userId: string,
  fn: (db: Db) => Promise<T>,
): Promise<T> {
  if (!organizationId || !userId) {
    throw new Error("Contexto da organização inválido.");
  }
  const db = await getDb();
  return fn(db);
}

export function orgCollection(db: Db, orgId: string, name: string) {
  return db.collection("organizations").doc(orgId).collection(name);
}
