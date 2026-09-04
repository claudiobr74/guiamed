import { Buffer } from "node:buffer";
import { FieldPath, type DocumentData } from "firebase-admin/firestore";
import type { Db } from "@/lib/db/client";
import { orgCollection } from "@/lib/db/client";
import { parseQuantity } from "@/lib/quantity";
import type { HealthInsurer, Procedure, ProcedureCode } from "@/types/domain";

export interface ProcedureCatalogPage {
  items: Procedure[];
  nextCursor: string | null;
}

interface NameCursor {
  name: string;
  id: string;
}

const PAGE_SIZE_MAX = 50;
const IN_QUERY_LIMIT = 30;

function encodeCursor(cursor: NameCursor): string {
  return Buffer.from(JSON.stringify([cursor.name, cursor.id]), "utf8").toString("base64url");
}

function decodeCursor(value?: string | null): NameCursor | null {
  if (!value?.trim()) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (!Array.isArray(parsed) || parsed.length !== 2) return null;
    const [name, id] = parsed;
    if (typeof name !== "string" || typeof id !== "string" || !id) return null;
    return { name, id };
  } catch {
    return null;
  }
}

function mapCode(id: string, data: DocumentData): ProcedureCode {
  return {
    id,
    procedureId: (data.procedureId as string | null) ?? null,
    codeSystem: String(data.codeSystem ?? ""),
    code: String(data.code ?? ""),
    description: String(data.description ?? ""),
    validFrom: data.validFrom ? String(data.validFrom).slice(0, 10) : null,
    validUntil: data.validUntil ? String(data.validUntil).slice(0, 10) : null,
    version: String(data.version ?? ""),
    active: data.active !== false,
    healthInsurerId: (data.healthInsurerId as string | null) ?? null,
    defaultQuantity: parseQuantity(data.defaultQuantity),
    metadata: (data.metadata as ProcedureCode["metadata"]) ?? {},
  };
}

function mapProcedure(orgId: string, id: string, data: DocumentData, codes: ProcedureCode[] = []): Procedure {
  return {
    id,
    organizationId: orgId,
    name: String(data.name ?? ""),
    description: (data.description as string | null) ?? null,
    specialty: (data.specialty as string | null) ?? null,
    category: (data.category as string | null) ?? null,
    active: data.active !== false,
    synonyms: Array.isArray(data.synonyms) ? data.synonyms.map(String) : [],
    codes,
  };
}

async function codesForProcedureIds(db: Db, orgId: string, ids: string[]): Promise<ProcedureCode[]> {
  const codes: ProcedureCode[] = [];
  for (let offset = 0; offset < ids.length; offset += IN_QUERY_LIMIT) {
    const chunk = ids.slice(offset, offset + IN_QUERY_LIMIT);
    if (chunk.length === 0) continue;
    const snapshot = await orgCollection(db, orgId, "procedureCodes")
      .where("procedureId", "in", chunk)
      .get();
    codes.push(...snapshot.docs.map((doc) => mapCode(doc.id, doc.data())));
  }
  return codes;
}

export async function listProcedureCatalogPage(
  db: Db,
  orgId: string,
  input: { cursor?: string | null; limit?: number } = {},
): Promise<ProcedureCatalogPage> {
  const requestedLimit = Math.trunc(input.limit ?? PAGE_SIZE_MAX);
  const limit = Math.min(Math.max(requestedLimit, 1), PAGE_SIZE_MAX);
  const cursor = decodeCursor(input.cursor);

  let query = orgCollection(db, orgId, "procedures")
    .orderBy("name")
    .orderBy(FieldPath.documentId())
    .limit(limit + 1);
  if (cursor) query = query.startAfter(cursor.name, cursor.id);

  const snapshot = await query.get();
  const hasNext = snapshot.docs.length > limit;
  const visible = snapshot.docs.slice(0, limit);
  const ids = visible.map((doc) => doc.id);
  const codes = await codesForProcedureIds(db, orgId, ids);
  const codesByProcedure = new Map<string, ProcedureCode[]>();
  for (const code of codes) {
    if (!code.procedureId) continue;
    const current = codesByProcedure.get(code.procedureId) ?? [];
    current.push(code);
    codesByProcedure.set(code.procedureId, current);
  }
  for (const current of codesByProcedure.values()) {
    current.sort((a, b) => a.codeSystem.localeCompare(b.codeSystem) || a.code.localeCompare(b.code));
  }

  const last = visible.at(-1);
  return {
    items: visible.map((doc) => mapProcedure(orgId, doc.id, doc.data(), codesByProcedure.get(doc.id) ?? [])),
    nextCursor: hasNext && last
      ? encodeCursor({ name: String(last.data().name ?? ""), id: last.id })
      : null,
  };
}

export async function listProcedureReferencesByIds(
  db: Db,
  orgId: string,
  ids: string[],
): Promise<Procedure[]> {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) return [];
  const refs = uniqueIds.map((id) => orgCollection(db, orgId, "procedures").doc(id));
  const snapshots = await db.getAll(...refs);
  return snapshots.flatMap((snapshot) => {
    const data = snapshot.data();
    return snapshot.exists && data ? [mapProcedure(orgId, snapshot.id, data)] : [];
  });
}

export async function listInsurerReferencesByIds(
  db: Db,
  orgId: string,
  ids: string[],
): Promise<HealthInsurer[]> {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) return [];
  const refs = uniqueIds.map((id) => orgCollection(db, orgId, "healthInsurers").doc(id));
  const snapshots = await db.getAll(...refs);
  return snapshots.flatMap((snapshot) => {
    const data = snapshot.data();
    if (!snapshot.exists || !data) return [];
    return [{
      id: snapshot.id,
      organizationId: orgId,
      name: String(data.name ?? ""),
      code: (data.code as string | null) ?? null,
      active: data.active !== false,
    } satisfies HealthInsurer];
  });
}
