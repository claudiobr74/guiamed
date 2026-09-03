import { FieldPath } from "firebase-admin/firestore";
import type { Db } from "@/lib/db/client";
import { orgCollection } from "@/lib/db/client";
import { mapPatientRecord } from "@/lib/db/repos";
import type { Patient } from "@/types/domain";

const MAX_PAGE_SIZE = 100;

export interface PatientPage {
  items: Patient[];
  nextCursor: string | null;
}

export async function listPatientPage(
  db: Db,
  orgId: string,
  input: { cursor?: string | null; limit?: number } = {},
): Promise<PatientPage> {
  const requestedLimit = Math.trunc(input.limit ?? 50);
  const limit = Math.min(Math.max(requestedLimit, 1), MAX_PAGE_SIZE);
  let query = orgCollection(db, orgId, "patients")
    .orderBy(FieldPath.documentId())
    .limit(limit + 1);
  const cursor = input.cursor?.trim();
  if (cursor) query = query.startAfter(cursor);

  const snapshot = await query.get();
  const visible = snapshot.docs.slice(0, limit);
  const insurerIds = [...new Set(
    visible.map((doc) => String(doc.data().healthInsurerId ?? "")).filter(Boolean),
  )];
  const insurerNames = new Map<string, string>();
  if (insurerIds.length > 0) {
    const refs = insurerIds.map((id) => orgCollection(db, orgId, "healthInsurers").doc(id));
    const insurers = await db.getAll(...refs);
    for (const insurer of insurers) {
      if (insurer.exists) insurerNames.set(insurer.id, String(insurer.data()?.name ?? ""));
    }
  }

  return {
    items: visible.map((doc) => mapPatientRecord(
      orgId,
      doc.id,
      doc.data(),
      insurerNames.get(String(doc.data().healthInsurerId ?? "")) ?? null,
    )),
    nextCursor: snapshot.docs.length > limit ? visible.at(-1)?.id ?? null : null,
  };
}
