import { FieldPath, type DocumentData } from "firebase-admin/firestore";
import type { Db } from "@/lib/db/client";
import { orgCollection } from "@/lib/db/client";
import { parseQuantity } from "@/lib/quantity";
import {
  SEARCH_INDEX_VERSION,
  buildSearchIndex,
  matchesIndexedSearch,
  searchCandidatePrefixes,
  searchRank,
  type SearchIndexFields,
} from "@/lib/search-index";
import type { Patient, Procedure, ProcedureCode } from "@/types/domain";

const SEARCH_CANDIDATE_LIMIT = 80;
const SEARCH_RESULT_LIMIT = 30;
const IN_QUERY_LIMIT = 30;
const REINDEX_BATCH_SIZE = 350;
const REINDEX_COLLECTIONS = ["patients", "procedures", "procedureCodes"] as const;
type ReindexCollection = (typeof REINDEX_COLLECTIONS)[number];

interface ReindexState {
  version: number;
  collection: ReindexCollection | "done";
  cursor: string | null;
  processed: Record<ReindexCollection, number>;
  startedAt: string;
  updatedAt: string;
}

export interface SearchIndexStatus {
  ready: boolean;
  version: number | null;
  collection: ReindexCollection | "done" | null;
  processed: Record<ReindexCollection, number>;
  indexedAt: string | null;
}

function now() {
  return new Date().toISOString();
}

function digitsOnly(value: string | null | undefined): string {
  return String(value ?? "").replace(/\D+/g, "");
}

function patientIndex(data: DocumentData): SearchIndexFields & { cpfDigits: string } {
  return {
    ...buildSearchIndex([
      String(data.fullName ?? ""),
      String(data.cpf ?? ""),
      String(data.insuranceCard ?? ""),
    ]),
    cpfDigits: digitsOnly(data.cpf as string | null | undefined),
  };
}

function procedureIndex(data: DocumentData): SearchIndexFields {
  return buildSearchIndex([
    String(data.name ?? ""),
    String(data.description ?? ""),
    String(data.specialty ?? ""),
    String(data.category ?? ""),
    ...(Array.isArray(data.synonyms) ? data.synonyms.map(String) : []),
  ]);
}

function procedureCodeIndex(data: DocumentData): SearchIndexFields {
  const metadata = (data.metadata as Record<string, unknown> | undefined) ?? {};
  return buildSearchIndex([
    String(data.code ?? ""),
    String(data.description ?? ""),
    String(data.codeSystem ?? ""),
    typeof metadata.importedProcedureName === "string" ? metadata.importedProcedureName : "",
  ]);
}

function indexPayload(collection: ReindexCollection, data: DocumentData): SearchIndexFields & { cpfDigits?: string } {
  if (collection === "patients") return patientIndex(data);
  if (collection === "procedures") return procedureIndex(data);
  return procedureCodeIndex(data);
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

function mapProcedure(orgId: string, id: string, data: DocumentData, codes: ProcedureCode[]): Procedure {
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

function mapPatient(orgId: string, id: string, data: DocumentData, insurerName: string | null): Patient {
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
    createdAt: String(data.createdAt ?? now()),
    updatedAt: String(data.updatedAt ?? now()),
  };
}

export async function getSearchIndexStatus(db: Db, orgId: string): Promise<SearchIndexStatus> {
  const snap = await db.collection("organizations").doc(orgId).get();
  const data = snap.data() ?? {};
  const rawState = data.searchIndexState as Partial<ReindexState> | undefined;
  const processed = {
    patients: Number(rawState?.processed?.patients ?? 0),
    procedures: Number(rawState?.processed?.procedures ?? 0),
    procedureCodes: Number(rawState?.processed?.procedureCodes ?? 0),
  };
  return {
    ready: Number(data.searchIndexVersion ?? 0) >= SEARCH_INDEX_VERSION,
    version: data.searchIndexVersion == null ? null : Number(data.searchIndexVersion),
    collection: rawState?.collection ?? null,
    processed,
    indexedAt: data.searchIndexedAt ? String(data.searchIndexedAt) : null,
  };
}

export async function searchPatientsIndexed(db: Db, orgId: string, query: string): Promise<Patient[]> {
  const candidates = searchCandidatePrefixes(query);
  if (candidates.length === 0) return [];

  const snapshot = await orgCollection(db, orgId, "patients")
    .where("searchPrefixes", "array-contains-any", candidates)
    .limit(SEARCH_CANDIDATE_LIMIT)
    .get();

  const matched = snapshot.docs
    .filter((doc) => matchesIndexedSearch(String(doc.data().searchText ?? ""), query))
    .sort((a, b) => {
      const left = searchRank(String(a.data().fullName ?? ""), String(a.data().searchText ?? ""), query);
      const right = searchRank(String(b.data().fullName ?? ""), String(b.data().searchText ?? ""), query);
      return left - right || String(a.data().fullName ?? "").localeCompare(String(b.data().fullName ?? ""), "pt-BR");
    })
    .slice(0, SEARCH_RESULT_LIMIT);

  const insurerIds = [...new Set(matched.map((doc) => String(doc.data().healthInsurerId ?? "")).filter(Boolean))];
  const insurerNames = new Map<string, string>();
  if (insurerIds.length > 0) {
    const refs = insurerIds.map((id) => orgCollection(db, orgId, "healthInsurers").doc(id));
    const insurers = await db.getAll(...refs);
    for (const insurer of insurers) {
      if (insurer.exists) insurerNames.set(insurer.id, String(insurer.data()?.name ?? ""));
    }
  }

  return matched.map((doc) =>
    mapPatient(
      orgId,
      doc.id,
      doc.data(),
      insurerNames.get(String(doc.data().healthInsurerId ?? "")) ?? null,
    ),
  );
}

async function codesForProcedureIds(db: Db, orgId: string, procedureIds: string[]): Promise<ProcedureCode[]> {
  const codes: ProcedureCode[] = [];
  for (let offset = 0; offset < procedureIds.length; offset += IN_QUERY_LIMIT) {
    const chunk = procedureIds.slice(offset, offset + IN_QUERY_LIMIT);
    if (chunk.length === 0) continue;
    const snapshot = await orgCollection(db, orgId, "procedureCodes")
      .where("procedureId", "in", chunk)
      .get();
    codes.push(...snapshot.docs.map((doc) => mapCode(doc.id, doc.data())));
  }
  return codes;
}

export async function searchProceduresIndexed(db: Db, orgId: string, query: string): Promise<Procedure[]> {
  const candidates = searchCandidatePrefixes(query);
  if (candidates.length === 0) return [];

  const [procedureSnapshot, codeSnapshot] = await Promise.all([
    orgCollection(db, orgId, "procedures")
      .where("searchPrefixes", "array-contains-any", candidates)
      .limit(SEARCH_CANDIDATE_LIMIT)
      .get(),
    orgCollection(db, orgId, "procedureCodes")
      .where("searchPrefixes", "array-contains-any", candidates)
      .limit(SEARCH_CANDIDATE_LIMIT)
      .get(),
  ]);

  const directMatches = procedureSnapshot.docs.filter(
    (doc) => doc.data().active !== false && matchesIndexedSearch(String(doc.data().searchText ?? ""), query),
  );
  const matchingCodes = codeSnapshot.docs.filter(
    (doc) => doc.data().active !== false && matchesIndexedSearch(String(doc.data().searchText ?? ""), query),
  );

  const directById = new Map(directMatches.map((doc) => [doc.id, doc]));
  const codeMatchedIds = matchingCodes
    .map((doc) => String(doc.data().procedureId ?? ""))
    .filter(Boolean);
  const orderedIds = [...new Set([...directById.keys(), ...codeMatchedIds])].slice(0, SEARCH_RESULT_LIMIT);
  if (orderedIds.length === 0) return [];

  const missingIds = orderedIds.filter((id) => !directById.has(id));
  if (missingIds.length > 0) {
    const refs = missingIds.map((id) => orgCollection(db, orgId, "procedures").doc(id));
    const snapshots = await db.getAll(...refs);
    for (const snapshot of snapshots) {
      if (snapshot.exists && snapshot.data()?.active !== false) directById.set(snapshot.id, snapshot);
    }
  }

  const validIds = orderedIds.filter((id) => directById.has(id));
  const codes = await codesForProcedureIds(db, orgId, validIds);
  const codesByProcedure = new Map<string, ProcedureCode[]>();
  for (const code of codes) {
    if (!code.procedureId) continue;
    const current = codesByProcedure.get(code.procedureId) ?? [];
    current.push(code);
    codesByProcedure.set(code.procedureId, current);
  }

  const codeRankByProcedure = new Map<string, number>();
  for (const doc of matchingCodes) {
    const procedureId = String(doc.data().procedureId ?? "");
    if (!procedureId) continue;
    const rank = searchRank(String(doc.data().code ?? ""), String(doc.data().searchText ?? ""), query) + 2;
    codeRankByProcedure.set(procedureId, Math.min(codeRankByProcedure.get(procedureId) ?? 9, rank));
  }

  return validIds
    .map((id) => {
      const doc = directById.get(id)!;
      return mapProcedure(
        orgId,
        id,
        doc.data(),
        (codesByProcedure.get(id) ?? []).sort(
          (a, b) => a.codeSystem.localeCompare(b.codeSystem) || a.code.localeCompare(b.code),
        ),
      );
    })
    .sort((a, b) => {
      const aDoc = directById.get(a.id)!;
      const bDoc = directById.get(b.id)!;
      const aDirect = directMatches.some((doc) => doc.id === a.id)
        ? searchRank(a.name, String(aDoc.data().searchText ?? ""), query)
        : 9;
      const bDirect = directMatches.some((doc) => doc.id === b.id)
        ? searchRank(b.name, String(bDoc.data().searchText ?? ""), query)
        : 9;
      const aRank = Math.min(aDirect, codeRankByProcedure.get(a.id) ?? 9);
      const bRank = Math.min(bDirect, codeRankByProcedure.get(b.id) ?? 9);
      return aRank - bRank || a.name.localeCompare(b.name, "pt-BR");
    })
    .slice(0, SEARCH_RESULT_LIMIT);
}

export async function upsertPatientIndexed(
  db: Db,
  orgId: string,
  userId: string,
  data: Partial<Patient> & { fullName: string; id?: string },
): Promise<Patient> {
  const cpfDigits = digitsOnly(data.cpf);
  if (cpfDigits) {
    const indexedDuplicates = await orgCollection(db, orgId, "patients")
      .where("cpfDigits", "==", cpfDigits)
      .limit(2)
      .get();
    const duplicate = indexedDuplicates.docs.find((doc) => doc.id !== data.id);
    if (duplicate) throw new Error("Já existe um paciente com este CPF nesta organização.");

    const status = await getSearchIndexStatus(db, orgId);
    if (!status.ready) {
      const legacy = await orgCollection(db, orgId, "patients").get();
      const legacyDuplicate = legacy.docs.find(
        (doc) => doc.id !== data.id && digitsOnly(doc.data().cpf as string | null | undefined) === cpfDigits,
      );
      if (legacyDuplicate) throw new Error("Já existe um paciente com este CPF nesta organização.");
    }
  }

  const ref = data.id
    ? orgCollection(db, orgId, "patients").doc(data.id)
    : orgCollection(db, orgId, "patients").doc();
  const existing = data.id ? await ref.get() : null;
  if (data.id && !existing?.exists) throw new Error("Paciente não encontrado.");
  const existingData = existing?.data() ?? {};
  const updatedAt = now();
  const record = {
    fullName: data.fullName,
    birthDate: data.birthDate ?? null,
    cpf: data.cpf ?? null,
    sex: data.sex ?? null,
    phone: data.phone ?? null,
    email: data.email ?? null,
    insuranceCard: data.insuranceCard ?? null,
    healthInsurerId: data.healthInsurerId ?? null,
    createdBy: existing?.exists ? existingData.createdBy ?? null : userId,
    createdAt: existing?.exists ? String(existingData.createdAt ?? updatedAt) : updatedAt,
    updatedAt,
  };
  await ref.set({ ...record, ...patientIndex(record) }, { merge: true });

  let insurerName: string | null = null;
  if (record.healthInsurerId) {
    const insurer = await orgCollection(db, orgId, "healthInsurers").doc(String(record.healthInsurerId)).get();
    insurerName = insurer.exists ? String(insurer.data()?.name ?? "") : null;
  }
  return mapPatient(orgId, ref.id, { ...existingData, ...record }, insurerName);
}

export async function upsertProcedureIndexed(
  db: Db,
  orgId: string,
  data: {
    id?: string;
    name: string;
    description?: string;
    specialty?: string;
    category?: string;
    synonyms?: string[];
    active?: boolean;
  },
): Promise<Procedure> {
  const ref = data.id
    ? orgCollection(db, orgId, "procedures").doc(data.id)
    : orgCollection(db, orgId, "procedures").doc();
  if (data.id) {
    const existing = await ref.get();
    if (!existing.exists) throw new Error("Procedimento não encontrado.");
  }
  const record = {
    name: data.name,
    description: data.description ?? null,
    specialty: data.specialty ?? null,
    category: data.category ?? null,
    synonyms: data.synonyms ?? [],
    active: data.active ?? true,
    updatedAt: now(),
  };
  await ref.set({ ...record, ...procedureIndex(record) }, { merge: true });
  const codes = await codesForProcedureIds(db, orgId, [ref.id]);
  return mapProcedure(orgId, ref.id, record, codes);
}

export async function indexImportedProcedureCodes(
  db: Db,
  orgId: string,
  rows: readonly {
    codeSystem: string;
    code: string;
    description: string;
    version: string;
    procedureName: string | null;
  }[],
): Promise<void> {
  const chunkSize = 400;
  for (let offset = 0; offset < rows.length; offset += chunkSize) {
    const chunk = rows.slice(offset, offset + chunkSize);
    const batch = db.batch();
    for (const row of chunk) {
      const docId = `${row.codeSystem}_${row.code}_${row.version}`.replace(/[^\w.-]+/g, "_");
      const ref = orgCollection(db, orgId, "procedureCodes").doc(docId);
      batch.set(
        ref,
        procedureCodeIndex({
          codeSystem: row.codeSystem,
          code: row.code,
          description: row.description,
          metadata: { importedProcedureName: row.procedureName },
        }),
        { merge: true },
      );
    }
    await batch.commit();
  }
}

function initialReindexState(): ReindexState {
  const timestamp = now();
  return {
    version: SEARCH_INDEX_VERSION,
    collection: "patients",
    cursor: null,
    processed: { patients: 0, procedures: 0, procedureCodes: 0 },
    startedAt: timestamp,
    updatedAt: timestamp,
  };
}

function nextCollection(collection: ReindexCollection): ReindexCollection | "done" {
  const index = REINDEX_COLLECTIONS.indexOf(collection);
  return REINDEX_COLLECTIONS[index + 1] ?? "done";
}

export async function rebuildSearchIndexChunk(
  db: Db,
  orgId: string,
): Promise<SearchIndexStatus> {
  const orgRef = db.collection("organizations").doc(orgId);
  const orgSnap = await orgRef.get();
  if (!orgSnap.exists) throw new Error("Organização não encontrada.");
  const data = orgSnap.data() ?? {};
  const stored = data.searchIndexState as ReindexState | undefined;
  const state: ReindexState =
    stored?.version === SEARCH_INDEX_VERSION && stored.collection !== "done"
      ? {
          ...stored,
          processed: {
            patients: Number(stored.processed?.patients ?? 0),
            procedures: Number(stored.processed?.procedures ?? 0),
            procedureCodes: Number(stored.processed?.procedureCodes ?? 0),
          },
        }
      : initialReindexState();

  if (Number(data.searchIndexVersion ?? 0) >= SEARCH_INDEX_VERSION && stored?.collection === "done") {
    return getSearchIndexStatus(db, orgId);
  }

  const collection = state.collection;
  if (collection === "done") return getSearchIndexStatus(db, orgId);

  let query = orgCollection(db, orgId, collection)
    .orderBy(FieldPath.documentId())
    .limit(REINDEX_BATCH_SIZE);
  if (state.cursor) query = query.startAfter(state.cursor);
  const snapshot = await query.get();
  const batch = db.batch();
  for (const doc of snapshot.docs) {
    batch.set(doc.ref, indexPayload(collection, doc.data()), { merge: true });
  }
  if (!snapshot.empty) await batch.commit();

  const processed = {
    ...state.processed,
    [collection]: state.processed[collection] + snapshot.size,
  };
  const completedCollection = snapshot.size < REINDEX_BATCH_SIZE;
  const next = completedCollection ? nextCollection(collection) : collection;
  const nextState: ReindexState = {
    ...state,
    collection: next,
    cursor: completedCollection ? null : snapshot.docs.at(-1)?.id ?? null,
    processed,
    updatedAt: now(),
  };

  if (next === "done") {
    const indexedAt = now();
    await orgRef.set(
      {
        searchIndexVersion: SEARCH_INDEX_VERSION,
        searchIndexedAt: indexedAt,
        searchIndexState: nextState,
      },
      { merge: true },
    );
  } else {
    await orgRef.set({ searchIndexState: nextState }, { merge: true });
  }
  return getSearchIndexStatus(db, orgId);
}
