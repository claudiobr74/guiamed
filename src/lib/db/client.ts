import type { Firestore } from "firebase-admin/firestore";
import { firebaseDb, hasFirebaseAdminCredentials } from "@/lib/firebase/admin";
import { seedCidCodes } from "@/lib/db/seed";

export type Db = Firestore;

let seeded = false;

export async function getDb(): Promise<Db> {
  const db = firebaseDb();
  if (!seeded) {
    seeded = true;
    if (hasFirebaseAdminCredentials()) {
      await seedCidCodes(db);
    }
  }
  return db;
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
