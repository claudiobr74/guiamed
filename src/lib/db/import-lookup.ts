import type { Db } from "@/lib/db/client";
import { orgCollection } from "@/lib/db/client";
import type { ExistingCodeRef } from "@/lib/import-diff";
import type { NormalizedImportRow } from "@/lib/import-codes";

const READ_CHUNK_SIZE = 400;

function importedCodeDocumentId(row: Pick<NormalizedImportRow, "codeSystem" | "code" | "version">): string {
  return `${row.codeSystem}_${row.code}_${row.version}`.replace(/[^\w.-]+/g, "_");
}

/**
 * O preview só precisa comparar os códigos presentes no arquivo recebido.
 * Buscar essas chaves determinísticas evita ler todo o catálogo TUSS/IPASGO.
 */
export async function getExistingCodesForImportRows(
  db: Db,
  orgId: string,
  rows: readonly NormalizedImportRow[],
): Promise<ExistingCodeRef[]> {
  const ids = [...new Set(rows.map(importedCodeDocumentId))];
  const existing: ExistingCodeRef[] = [];

  for (let offset = 0; offset < ids.length; offset += READ_CHUNK_SIZE) {
    const chunk = ids.slice(offset, offset + READ_CHUNK_SIZE);
    const refs = chunk.map((id) => orgCollection(db, orgId, "procedureCodes").doc(id));
    const snapshots = await db.getAll(...refs);
    for (const snapshot of snapshots) {
      if (!snapshot.exists) continue;
      const data = snapshot.data() ?? {};
      existing.push({
        codeSystem: String(data.codeSystem ?? ""),
        code: String(data.code ?? ""),
        version: String(data.version ?? ""),
        description: String(data.description ?? ""),
        active: data.active !== false,
      });
    }
  }

  return existing;
}
