import type { DocumentData } from "firebase-admin/firestore";
import type { Db } from "@/lib/db/client";
import { orgCollection } from "@/lib/db/client";
import { parseQuantity } from "@/lib/quantity";
import type { Procedure, ProcedureCode } from "@/types/domain";

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

export async function getProcedureAdmin(
  db: Db,
  orgId: string,
  procedureId: string,
): Promise<Procedure | null> {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(procedureId)) return null;
  const procedure = await orgCollection(db, orgId, "procedures").doc(procedureId).get();
  if (!procedure.exists) return null;
  const codes = await orgCollection(db, orgId, "procedureCodes")
    .where("procedureId", "==", procedureId)
    .get();
  const data = procedure.data() ?? {};
  return {
    id: procedure.id,
    organizationId: orgId,
    name: String(data.name ?? ""),
    description: (data.description as string | null) ?? null,
    specialty: (data.specialty as string | null) ?? null,
    category: (data.category as string | null) ?? null,
    active: data.active !== false,
    synonyms: Array.isArray(data.synonyms) ? data.synonyms.map(String) : [],
    codes: codes.docs.map((doc) => mapCode(doc.id, doc.data())).sort(
      (a, b) => a.codeSystem.localeCompare(b.codeSystem) || a.code.localeCompare(b.code),
    ),
  };
}
