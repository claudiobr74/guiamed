"use server";

import { requireUser } from "@/lib/auth/current";
import { isCodeValidOn } from "@/lib/codes";
import { orgCollection, withOrganizationContext } from "@/lib/db/client";
import { getSearchIndexStatus, searchProceduresIndexed } from "@/lib/db/indexed-search";
import { listProceduresByIds } from "@/lib/db/procedure-lookup";
import * as repos from "@/lib/db/repos";
import { matchesIndexedSearch } from "@/lib/search-index";
import type { Procedure } from "@/types/domain";

const MIN_SEARCH_LENGTH = 2;

/**
 * Pesquisa procedimentos no contexto da própria guia.
 * Tabela TUSS e convênio são derivados server-side; o cliente não escolhe
 * o catálogo usado para resolver códigos.
 */
export async function searchRequestProceduresAction(requestId: string, query: string): Promise<Procedure[]> {
  const user = await requireUser();
  const id = requestId.trim();
  const value = query.trim();
  if (!id || value.length < MIN_SEARCH_LENGTH) return [];

  return withOrganizationContext(user.organizationId, user.id, async (db) => {
    const requestSnapshot = await orgCollection(db, user.organizationId, "requests").doc(id).get();
    if (!requestSnapshot.exists) throw new Error("Solicitação não encontrada.");
    const request = requestSnapshot.data() ?? {};
    if (request.status !== "draft") throw new Error("Documento finalizado não pode ser alterado.");

    const tableKey = String(request.tussTableKey ?? "").trim();
    if (!tableKey) return [];
    const healthInsurerId = request.healthInsurerId ? String(request.healthInsurerId) : null;

    const indexStatus = await getSearchIndexStatus(db, user.organizationId);
    const candidates = indexStatus.ready
      ? await searchProceduresIndexed(db, user.organizationId, value)
      : await repos.searchProcedures(db, user.organizationId, value);
    if (candidates.length === 0) return [];

    // Recarrega os códigos de forma direcionada para preservar tableKey/tableName,
    // inclusive quando a busca candidata veio do índice legado.
    const procedures = await listProceduresByIds(
      db,
      user.organizationId,
      candidates.map((procedure) => procedure.id),
    );
    const order = new Map(candidates.map((procedure, index) => [procedure.id, index]));
    const at = new Date();

    return procedures
      .flatMap((procedure) => {
        const eligibleCodes = procedure.codes.filter((code) =>
          code.codeSystem.toUpperCase() === "TUSS" &&
          code.tableKey === tableKey &&
          isCodeValidOn(code, at) &&
          (code.healthInsurerId === null || code.healthInsurerId === healthInsurerId),
        );
        if (eligibleCodes.length === 0) return [];

        const searchText = [
          procedure.name,
          procedure.description,
          procedure.specialty,
          procedure.category,
          ...procedure.synonyms,
          ...eligibleCodes.flatMap((code) => [code.code, code.description]),
        ].filter(Boolean).join(" ");
        if (!matchesIndexedSearch(searchText, value)) return [];

        return [{ ...procedure, codes: eligibleCodes }];
      })
      .sort((left, right) =>
        (order.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(right.id) ?? Number.MAX_SAFE_INTEGER),
      )
      .slice(0, 30);
  });
}
