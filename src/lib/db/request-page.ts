import { FieldPath, type DocumentData, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import type { Db } from "@/lib/db/client";
import { orgCollection } from "@/lib/db/client";
import { normalizeSearchText } from "@/lib/search-index";
import type {
  Doctor,
  HealthInsurer,
  Institution,
  InstitutionKind,
  Patient,
  RequestStatus,
  SurgicalRequest,
} from "@/types/domain";

const REQUEST_SCAN_BATCH = 100;
const REQUEST_MAX_SCAN = 1000;
const REQUEST_MAX_PAGE = 100;

export interface RequestPageInput {
  q?: string | null;
  status?: RequestStatus | null;
  cursor?: string | null;
  limit?: number;
}

export interface RequestPage {
  items: SurgicalRequest[];
  nextCursor: string | null;
  scanned: number;
  scanLimitReached: boolean;
}

interface DecodedCursor {
  updatedAt: string;
  id: string;
}

function encodeCursor(request: SurgicalRequest): string {
  return Buffer.from(JSON.stringify({ updatedAt: request.updatedAt, id: request.id }), "utf8").toString("base64url");
}

function decodeCursor(value: string | null | undefined): DecodedCursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<DecodedCursor>;
    if (!parsed.updatedAt || !parsed.id) return null;
    return { updatedAt: String(parsed.updatedAt), id: String(parsed.id) };
  } catch {
    return null;
  }
}

function mapPatient(orgId: string, id: string, data: DocumentData, insurerName: string | null): Patient {
  const timestamp = new Date().toISOString();
  return {
    id,
    organizationId: orgId,
    fullName: String(data.fullName ?? ""),
    birthDate: data.birthDate ? String(data.birthDate).slice(0, 10) : null,
    cpf: (data.cpf as string | null) ?? null,
    sex: (data.sex as Patient["sex"]) ?? null,
    phone: (data.phone as string | null) ?? null,
    email: (data.email as string | null) ?? null,
    insuranceCard: (data.insuranceCard as string | null) ?? null,
    healthInsurerId: (data.healthInsurerId as string | null) ?? null,
    healthInsurerName: insurerName,
    createdAt: String(data.createdAt ?? timestamp),
    updatedAt: String(data.updatedAt ?? timestamp),
  };
}

function mapDoctor(orgId: string, id: string, data: DocumentData): Doctor {
  return {
    id,
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
  };
}

function mapInstitution(orgId: string, id: string, data: DocumentData): Institution {
  return {
    id,
    organizationId: orgId,
    kind: (data.kind as InstitutionKind) ?? "hospital",
    name: String(data.name ?? ""),
    cnpj: (data.cnpj as string | null) ?? null,
    city: (data.city as string | null) ?? null,
    state: (data.state as string | null) ?? null,
    phone: (data.phone as string | null) ?? null,
    active: data.active !== false,
  };
}

function mapInsurer(orgId: string, id: string, data: DocumentData): HealthInsurer {
  return {
    id,
    organizationId: orgId,
    name: String(data.name ?? ""),
    code: (data.code as string | null) ?? null,
    active: data.active !== false,
  };
}

async function fetchCollectionDocs(
  db: Db,
  orgId: string,
  collection: "patients" | "doctors" | "institutions" | "healthInsurers",
  ids: string[],
): Promise<Map<string, DocumentData>> {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map();
  const refs = uniqueIds.map((id) => orgCollection(db, orgId, collection).doc(id));
  const snapshots = await db.getAll(...refs);
  return new Map(
    snapshots.flatMap((snapshot) => {
      const data = snapshot.data();
      return snapshot.exists && data ? [[snapshot.id, data] as const] : [];
    }),
  );
}

async function hydrateBatch(
  db: Db,
  orgId: string,
  docs: QueryDocumentSnapshot<DocumentData>[],
): Promise<SurgicalRequest[]> {
  const patientIds = docs.map((doc) => String(doc.data().patientId ?? "")).filter(Boolean);
  const doctorIds = docs.map((doc) => String(doc.data().doctorId ?? "")).filter(Boolean);
  const institutionIds = docs.map((doc) => String(doc.data().institutionId ?? "")).filter(Boolean);
  const insurerIds = docs.map((doc) => String(doc.data().healthInsurerId ?? "")).filter(Boolean);

  const [patients, doctors, institutions, insurers] = await Promise.all([
    fetchCollectionDocs(db, orgId, "patients", patientIds),
    fetchCollectionDocs(db, orgId, "doctors", doctorIds),
    fetchCollectionDocs(db, orgId, "institutions", institutionIds),
    fetchCollectionDocs(db, orgId, "healthInsurers", insurerIds),
  ]);

  return docs.map((doc) => {
    const data = doc.data();
    const patientId = data.patientId ? String(data.patientId) : null;
    const doctorId = data.doctorId ? String(data.doctorId) : null;
    const institutionId = data.institutionId ? String(data.institutionId) : null;
    const healthInsurerId = data.healthInsurerId ? String(data.healthInsurerId) : null;
    const insurer = healthInsurerId && insurers.has(healthInsurerId)
      ? mapInsurer(orgId, healthInsurerId, insurers.get(healthInsurerId)!)
      : null;
    const patient = patientId && patients.has(patientId)
      ? mapPatient(orgId, patientId, patients.get(patientId)!, insurer?.name ?? null)
      : null;

    return {
      id: doc.id,
      organizationId: orgId,
      patientId,
      doctorId,
      institutionId,
      healthInsurerId,
      templateId: (data.templateId as string | null) ?? null,
      templateVersionId: (data.templateVersionId as string | null) ?? null,
      diagnosis: (data.diagnosis as string | null) ?? null,
      clinicalJustification: (data.clinicalJustification as string | null) ?? null,
      clinicalNotes: (data.clinicalNotes as string | null) ?? null,
      status: (data.status as RequestStatus) ?? "draft",
      revision: Number(data.revision ?? 0),
      createdBy: (data.createdBy as string | null) ?? null,
      createdAt: String(data.createdAt ?? ""),
      updatedAt: String(data.updatedAt ?? data.createdAt ?? ""),
      finalizedAt: data.finalizedAt ? String(data.finalizedAt) : null,
      duplicatedFromId: (data.duplicatedFromId as string | null) ?? null,
      patient,
      doctor: doctorId && doctors.has(doctorId) ? mapDoctor(orgId, doctorId, doctors.get(doctorId)!) : null,
      institution: institutionId && institutions.has(institutionId)
        ? mapInstitution(orgId, institutionId, institutions.get(institutionId)!)
        : null,
      healthInsurer: insurer,
      items: Array.isArray(data.items) ? data.items : [],
      cids: Array.isArray(data.cids) ? data.cids : [],
    } satisfies SurgicalRequest;
  });
}

function matchesRequest(request: SurgicalRequest, input: RequestPageInput): boolean {
  if (input.status && request.status !== input.status) return false;
  const query = normalizeSearchText(input.q ?? "");
  if (!query) return true;
  const haystack = normalizeSearchText([
    request.patient?.fullName ?? "",
    request.doctor?.name ?? "",
    request.institution?.name ?? "",
    request.healthInsurer?.name ?? "",
    ...request.items.map((item) => item.procedureName),
  ].join(" "));
  return query.split(" ").filter(Boolean).every((term) => haystack.includes(term));
}

export async function listRequestPage(
  db: Db,
  orgId: string,
  input: RequestPageInput = {},
): Promise<RequestPage> {
  const requestedLimit = Math.trunc(input.limit ?? 50);
  const limit = Math.min(Math.max(requestedLimit, 1), REQUEST_MAX_PAGE);
  let cursor = decodeCursor(input.cursor);
  let scanned = 0;
  let exhausted = false;
  const matched: SurgicalRequest[] = [];

  while (matched.length < limit + 1 && scanned < REQUEST_MAX_SCAN && !exhausted) {
    const batchLimit = Math.min(REQUEST_SCAN_BATCH, REQUEST_MAX_SCAN - scanned);
    let query = orgCollection(db, orgId, "requests")
      .orderBy("updatedAt", "desc")
      .orderBy(FieldPath.documentId(), "desc")
      .limit(batchLimit);
    if (cursor) query = query.startAfter(cursor.updatedAt, cursor.id);
    const snapshot = await query.get();
    if (snapshot.empty) {
      exhausted = true;
      break;
    }

    scanned += snapshot.size;
    const hydrated = await hydrateBatch(db, orgId, snapshot.docs);
    for (const request of hydrated) {
      if (matchesRequest(request, input)) matched.push(request);
      if (matched.length >= limit + 1) break;
    }

    const last = hydrated[hydrated.length - 1];
    if (last) cursor = { updatedAt: last.updatedAt, id: last.id };
    exhausted = snapshot.size < batchLimit;
  }

  const visible = matched.slice(0, limit);
  const hasKnownNext = matched.length > limit || !exhausted;
  const nextCursor = hasKnownNext
    ? (matched.length > limit ? encodeCursor(visible[visible.length - 1]) : cursor ? Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url") : null)
    : null;

  return {
    items: visible,
    nextCursor,
    scanned,
    scanLimitReached: scanned >= REQUEST_MAX_SCAN && matched.length <= limit && !exhausted,
  };
}
