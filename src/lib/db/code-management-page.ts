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

export interface CodeManagementFilters {
  q?: string | null;
  system?: "ALL" | "TUSS" | "IPASGO" | null;
  linkState?: "all" | "linked" | "unlinked" | null;
  cursor?: string | null;
  limit?: number;
}

export interface CodeManagementPage {
  items: ProcedureCode[];
  nextCursor: string | null;
  scanned: number;
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

function matchesFilters(code: ProcedureCode, data: DocumentData, input: CodeManagementFilters): boolean {
  const system = input.system ?? "ALL";
  const linkState = input.linkState ?? "unlinked";
  if (system !== "ALL" && code.codeSystem !== system) return false;
  if (linkState === "linked" && !code.procedureId) return false;
  if (linkState === "unlinked" && code.procedureId) return false;

  const query = input.q?.trim();
  if (!query) return true;
  const indexedText = String(data.searchText ?? "");
  if (indexedText && matchesIndexedSearch(indexedText, query)) return true;
  const fallback = `${code.code} ${code.description}`.toLowerCase();
  return fallback.includes(query.toLowerCase());
}

/**
 * Página limitada de códigos para o gerenciador administrativo.
 * Com índice pronto, a busca textual usa `searchPrefixes`; sem índice, o
 * fallback continua correto, mas varre no máximo MAX_SCAN_PER_PAGE documentos.
 */
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

  let cursor = input.cursor?.trim() || null;
  let scanned = 0;
  let exhausted = false;
  const matches: Array<{ code: ProcedureCode; id: string }> = [];

  while (matches.length < limit + 1 && scanned < MAX_SCAN_PER_PAGE && !exhausted) {
    let query = orgCollection(db, orgId, "procedureCodes").orderBy(FieldPath.documentId());
    if (queryText && indexStatus?.ready && candidates.length > 0) {
      query = query.where("searchPrefixes", "array-contains-any", candidates);
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
      if (matchesFilters(code, doc.data(), input)) matches.push({ code, id: doc.id });
      if (matches.length >= limit + 1) break;
    }

    const last = snapshot.docs[snapshot.docs.length - 1]?.id ?? null;
    cursor = last;
    exhausted = snapshot.size < Math.min(SCAN_BATCH_SIZE, MAX_SCAN_PER_PAGE - (scanned - snapshot.size));
  }

  const visible = matches.slice(0, limit);
  const hasKnownNext = matches.length > limit || !exhausted;
  const nextCursor = hasKnownNext
    ? (matches.length > limit ? visible[visible.length - 1]?.id ?? cursor : cursor)
    : null;

  return {
    items: visible.map((item) => item.code),
    nextCursor,
    scanned,
    searchIndexed: Boolean(indexStatus?.ready),
    scanLimitReached: scanned >= MAX_SCAN_PER_PAGE && matches.length <= limit && !exhausted,
  };
}

/**
 * Catálogo canônico para a tabela/resolvedor administrativo. Lê todos os
 * procedimentos (bem menor que TUSS) e apenas códigos que já possuem vínculo.
 */
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
