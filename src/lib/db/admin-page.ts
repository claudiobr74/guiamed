import { Buffer } from "node:buffer";
import { FieldPath, type DocumentData, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import type { Db } from "@/lib/db/client";
import { orgCollection } from "@/lib/db/client";
import type { Doctor, HealthInsurer, Institution, InstitutionKind } from "@/types/domain";

export interface AdminPage<T> {
  items: T[];
  nextCursor: string | null;
}

interface NameCursor {
  name: string;
  id: string;
}

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

function encodeCursor(cursor: NameCursor): string {
  return Buffer.from(JSON.stringify([cursor.name, cursor.id]), "utf8").toString("base64url");
}

function decodeCursor(value?: string | null): NameCursor | null {
  if (!value?.trim()) return null;
  try {
    const decoded = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (!Array.isArray(decoded) || decoded.length !== 2) return null;
    const [name, id] = decoded;
    if (typeof name !== "string" || typeof id !== "string" || !id) return null;
    return { name, id };
  } catch {
    return null;
  }
}

async function listNamedPage<T>(
  db: Db,
  orgId: string,
  collectionName: string,
  mapper: (doc: QueryDocumentSnapshot<DocumentData>) => T,
  input: { cursor?: string | null; limit?: number } = {},
): Promise<AdminPage<T>> {
  const requestedLimit = Math.trunc(input.limit ?? DEFAULT_PAGE_SIZE);
  const limit = Math.min(Math.max(requestedLimit, 1), MAX_PAGE_SIZE);
  const cursor = decodeCursor(input.cursor);

  let query = orgCollection(db, orgId, collectionName)
    .orderBy("name")
    .orderBy(FieldPath.documentId())
    .limit(limit + 1);

  if (cursor) query = query.startAfter(cursor.name, cursor.id);

  const snapshot = await query.get();
  const hasNext = snapshot.docs.length > limit;
  const visible = snapshot.docs.slice(0, limit);
  const last = visible.at(-1);

  return {
    items: visible.map(mapper),
    nextCursor: hasNext && last
      ? encodeCursor({ name: String(last.data().name ?? ""), id: last.id })
      : null,
  };
}

export async function listDoctorsPage(
  db: Db,
  orgId: string,
  input: { cursor?: string | null; limit?: number } = {},
): Promise<AdminPage<Doctor>> {
  return listNamedPage(db, orgId, "doctors", (doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      organizationId: orgId,
      name: String(data.name ?? ""),
      crm: String(data.crm ?? ""),
      crmState: String(data.crmState ?? ""),
      cpf: (data.cpf as string | null) ?? null,
      specialty: (data.specialty as string | null) ?? null,
      rqe: (data.rqe as string | null) ?? null,
      phone: (data.phone as string | null) ?? null,
      email: (data.email as string | null) ?? null,
      signatureFile: (data.signatureFile as string | null) ?? null,
      signatureKind: (data.signatureKind as Doctor["signatureKind"]) ?? "image",
      isDefault: Boolean(data.isDefault),
      active: data.active !== false,
    } satisfies Doctor;
  }, input);
}

export async function listInstitutionsPage(
  db: Db,
  orgId: string,
  input: { cursor?: string | null; limit?: number } = {},
): Promise<AdminPage<Institution>> {
  return listNamedPage(db, orgId, "institutions", (doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      organizationId: orgId,
      kind: data.kind as InstitutionKind,
      name: String(data.name ?? ""),
      cnpj: (data.cnpj as string | null) ?? null,
      city: (data.city as string | null) ?? null,
      state: (data.state as string | null) ?? null,
      phone: (data.phone as string | null) ?? null,
      active: data.active !== false,
    } satisfies Institution;
  }, input);
}

export async function listInsurersPage(
  db: Db,
  orgId: string,
  input: { cursor?: string | null; limit?: number } = {},
): Promise<AdminPage<HealthInsurer>> {
  return listNamedPage(db, orgId, "healthInsurers", (doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      organizationId: orgId,
      name: String(data.name ?? ""),
      code: (data.code as string | null) ?? null,
      active: data.active !== false,
    } satisfies HealthInsurer;
  }, input);
}
