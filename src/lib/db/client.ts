import type { Firestore } from "firebase-admin/firestore";
import { firebaseDb } from "@/lib/firebase/admin";

export type Db = Firestore;

export async function getDb(): Promise<Db> {
  return firebaseDb();
}

/** Acesso por organização é aplicado nas consultas (não é RLS do Postgres). */
export async function withRls<T>(
  _orgId: string | null,
  _userId: string | null,
  fn: (db: Db) => Promise<T>,
): Promise<T> {
  const db = await getDb();
  return fn(db);
}

export function orgCollection(db: Db, orgId: string, name: string) {
  return db.collection("organizations").doc(orgId).collection(name);
}
