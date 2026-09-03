import { FieldPath, type DocumentData } from "firebase-admin/firestore";
import type { Db } from "@/lib/db/client";
import { orgCollection } from "@/lib/db/client";
import { getSearchIndexStatus } from "@/lib/db/indexed-search";
import { parseQuantity } from "@/lib/quantity";
import { matchesIndexedSearch, searchCandidatePrefixes } from "@/lib/search-index";
import type { Procedure, ProcedureCode } from "@/types/domain";

const PAGE_LIMIT_MAX = 100;
const SCAN_BATCH_SIZE = 200;
const MAX_SCAN_PER_PAGE = 2000;
const IN_QUERY_LIMIT = 30;
const CLINICAL_TIME_ZONE = "America/Sao_Paulo";

export interface CodeManagementFilters {
  q?: string | null;
  system?: "ALL" | "TUSS" | "IPASGO" | null;
  tableKey?: string | null;
  linkState?: "all" | "linked" | "unlinked" | null;
  activeState?: "all" | "active" | "inactive" | null;
  validity?: "all" | "current" | "future" | "expired" | null;
  version?: string | null;
  cursor?: string | null;
  limit?: number;
}

export interface CodeManagementPage {
  items: ProcedureCode[];
  nextCursor: string | null;
  scanned: number;
  totalCatalog: number;
  searchIndexed: boolean;
  scanLimitReached: boolean;
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
    tableKey: (data.tableKey as string | null | undefined) ?? null,
    tableName: (data.tableName as string | null | undefined) ?? null,
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

function clinicalDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CLINICAL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
}

function matchesValidity(code: ProcedureCode, state: CodeManagementFilters["validity"], today: string): boolean {
  if (!state || state === "all") return true;
  if (state === "future") return Boolean(code.validFrom && code.validFrom > today);
  if (state === "expired") return Boolean(code.validUntil && code.validUntil < today);
  return (!code.validFrom || code.validFrom <= today) && (!code.validUntil || code.validUntil >= today);
}

function matchesFilters(
  code: ProcedureCode,
  data: DocumentData,
  input: CodeManagementFilters,
  today: string,
): boolean {
  const system = input.system ?? "ALL";
  const tableKey = input.tableKey?.trim() ?? "";
  const linkState = input.linkState ?? "all";
  const activeState = input.activeState ?? "all";
  const version = input.version?.trim() ?? "";

  if (system !== "ALL" && code.codeSystem !== system) return false;
  if (tableKey && code.tableKey !== tableKey) return false;
  if (linkState === "linked" && !code.procedureId) return false;
  if (linkState === "unlinked" && code.procedureId) return false;
  if (activeState === "active" && !code.active) return false;
  if (activeState === "inactive" && code.active) return false;
  if (version && code.version.toLocaleLowerCase("pt-BR") !== version.toLocaleLowerCase("pt-BR")) return false;
  if (!matchesValidity(code, input.validity, today)) return false;

  const query = input.q?.trim();
  if (!query) return true;
  const indexedText = String(data.searchText ?? "");
  if (indexedText && matchesIndexedSearch(indexedText, query)) return true;
  const fallback = `${code.code} ${code.description} ${code.tableName ?? ""}`.toLocaleLowerCase("pt-BR");
  return fallback.includes(query.toLocaleLowerCase("pt-BR"));
}

/** Página limitada do catálogo administrativo. Novas Tabelas TUSS são isoladas por tableKey. */
export async function listCodeManagementPage(
  db: Db,
  orgId: string,
  input: CodeManagementFilters = {},
): Promise<CodeManagementPage> {
  const requestedLimit = Math.trunc(input.limit ?? 50);
  const limit = Math.min(Math.max(requestedLimit, 1), PAGE_LIMIT_MAX);
  const queryText = input.q?.trim() ?? "";
  const indexStatus = queryText ? await getSearchIndexStatus(db, orgId) : null;
  const candidates = indexStatus?.ready ? searchCandidatePrefixes(queryText) : [];
  const today = clinicalDate();
  const totalCatalogPromise = input.tableKey?.trim()
    ? orgCollection(db, orgId, "procedureCodes").where("tableKey", "==", input.tableKey.trim()).count().get()
    : orgCollection(db, orgId, "procedureCodes").count().get();

  let cursor = input.cursor?.trim() || null;
  let scanned = 0;
  let exhausted = false;
  const matches: Array<{ code: ProcedureCode; id: string }> = [];

  while (matches.length < limit + 1 && scanned < MAX_SCAN_PER_PAGE && !exhausted) {
    let query = orgCollection(db, orgId, "procedureCodes").orderBy(FieldPath.documentId());
    if (input.tableKey?.trim()) query = query.where("tableKey", "==", input.tableKey.trim());
    if (queryText && indexStatus?.ready && candidates.length > 0) {
      query = query.where("searchPrefixes", "array-contains-any", candidates);
    } else if (!queryText) {
      if (input.system && input.system !== "ALL") query = query.where("codeSystem", "==", input.system);
      if (input.activeState === "active") query = query.where("active", "==", true);
      if (input.activeState === "inactive") query = query.where("active", "==", false);
      if (input.version?.trim()) query = query.where("version", "==", input.version.trim());
      if (input.linkState === "unlinked") query = query.where("procedureId", "==", null);
    }
    query = query.limit(Math.min(SCAN_BATCH_SIZE, MAX_SCAN_PER_PAGE - scanned));
    if (cursor) query = query.startAfter(cursor);

    const snapshot = await query.get();
    if (snapshot.empty) {
      exhausted = true;
      break;
    }

    scanned += snapshot.size;
    for (const doc of snapshot.docs) {
      const code = mapCode(doc.id, doc.data());
      if (matchesFilters(code, doc.data(), input, today)) matches.push({ code, id: doc.id });
      if (matches.length >= limit + 1) break;
    }

    const last = snapshot.docs[snapshot.docs.length - 1]?.id ?? null;
    cursor = last;
    const requestedBatchSize = Math.min(SCAN_BATCH_SIZE, MAX_SCAN_PER_PAGE - (scanned - snapshot.size));
    exhausted = snapshot.size < requestedBatchSize;
  }

  const visible = matches.slice(0, limit);
  const hasKnownNext = matches.length > limit || !exhausted;
  const nextCursor = hasKnownNext
    ? (matches.length > limit ? visible[visible.length - 1]?.id ?? cursor : cursor)
    : null;
  const totalCatalog = (await totalCatalogPromise).data().count;

  return {
    items: visible.map((item) => item.code),
    nextCursor,
    scanned,
    totalCatalog,
    searchIndexed: Boolean(indexStatus?.ready),
    scanLimitReached: scanned >= MAX_SCAN_PER_PAGE && matches.length <= limit && !exhausted,
  };
}

export async function listProcedureAdminCatalog(db: Db, orgId: string): Promise<Procedure[]> {
  const procedureSnapshot = await orgCollection(db, orgId, "procedures").get();
  const ids = procedureSnapshot.docs.map((doc) => doc.id);
  const codes: ProcedureCode[] = [];

  for (let offset = 0; offset < ids.length; offset += IN_QUERY_LIMIT) {
    const chunk = ids.slice(offset, offset + IN_QUERY_LIMIT);
    if (chunk.length === 0) continue;
    const snapshot = await orgCollection(db, orgId, "procedureCodes")
      .where("procedureId", "in", chunk)
      .get();
    codes.push(...snapshot.docs.map((doc) => mapCode(doc.id, doc.data())));
  }

  const byProcedure = new Map<string, ProcedureCode[]>();
  for (const code of codes) {
    if (!code.procedureId) continue;
    const current = byProcedure.get(code.procedureId) ?? [];
    current.push(code);
    byProcedure.set(code.procedureId, current);
  }

  return procedureSnapshot.docs
    .map((doc) => mapProcedure(orgId, doc.id, doc.data(), byProcedure.get(doc.id) ?? []))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}
