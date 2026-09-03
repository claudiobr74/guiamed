import type { Db } from "@/lib/db/client";
import { orgCollection } from "@/lib/db/client";
import { parseQuantity } from "@/lib/quantity";
import type { Procedure, ProcedureCode } from "@/types/domain";

const IN_QUERY_LIMIT = 30;

function mapCode(id: string, data: FirebaseFirestore.DocumentData): ProcedureCode {
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

/** Carrega somente os procedimentos necessários e os códigos vinculados a eles. */
export async function listProceduresByIds(
  db: Db,
  orgId: string,
  procedureIds: readonly string[],
): Promise<Procedure[]> {
  const ids = [...new Set(procedureIds.filter(Boolean))];
  if (ids.length === 0) return [];

  const refs = ids.map((id) => orgCollection(db, orgId, "procedures").doc(id));
  const procedureSnapshots = await db.getAll(...refs);

  const codes: ProcedureCode[] = [];
  for (let offset = 0; offset < ids.length; offset += IN_QUERY_LIMIT) {
    const chunk = ids.slice(offset, offset + IN_QUERY_LIMIT);
    const snapshot = await orgCollection(db, orgId, "procedureCodes")
      .where("procedureId", "in", chunk)
      .get();
    codes.push(...snapshot.docs.map((doc) => mapCode(doc.id, doc.data())));
  }

  const codesByProcedure = new Map<string, ProcedureCode[]>();
  for (const code of codes) {
    if (!code.procedureId) continue;
    const current = codesByProcedure.get(code.procedureId) ?? [];
    current.push(code);
    codesByProcedure.set(code.procedureId, current);
  }

  return procedureSnapshots.flatMap((snapshot) => {
    if (!snapshot.exists) return [];
    const data = snapshot.data() ?? {};
    if (data.active === false) return [];
    return [{
      id: snapshot.id,
      organizationId: orgId,
      name: String(data.name ?? ""),
      description: (data.description as string | null) ?? null,
      specialty: (data.specialty as string | null) ?? null,
      category: (data.category as string | null) ?? null,
      active: true,
      synonyms: Array.isArray(data.synonyms) ? data.synonyms.map(String) : [],
      codes: (codesByProcedure.get(snapshot.id) ?? []).sort(
        (a, b) => (a.tableName ?? "").localeCompare(b.tableName ?? "", "pt-BR") || a.code.localeCompare(b.code),
      ),
    } satisfies Procedure];
  });
}
