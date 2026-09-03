import type { Db } from "@/lib/db/client";
import { orgCollection } from "@/lib/db/client";
import { parseQuantity } from "@/lib/quantity";
import type { ProcedureCode } from "@/types/domain";
import type { NormalizedImportRow } from "@/lib/import-codes";

function now() {
  return new Date().toISOString();
}

export async function insertCodesIdempotentWithStatus(
  db: Db,
  orgId: string,
  userId: string,
  payload: {
    codeSystem: string;
    version: string;
    sourceFilename: string;
    sourceFormat: "csv" | "xlsx" | "json";
    rows: NormalizedImportRow[];
  },
): Promise<{ inserted: number; updated: number; batchId: string }> {
  const batchRef = orgCollection(db, orgId, "importBatches").doc();
  await batchRef.set({
    codeSystem: payload.codeSystem,
    sourceFilename: payload.sourceFilename,
    sourceFormat: payload.sourceFormat,
    version: payload.version,
    createdBy: userId,
    createdAt: now(),
    rowCount: payload.rows.length,
    processedRows: 0,
    status: "processing",
  });

  let inserted = 0;
  let updated = 0;
  let processedRows = 0;
  const chunkSize = 400;

  try {
    for (let offset = 0; offset < payload.rows.length; offset += chunkSize) {
      const rows = payload.rows.slice(offset, offset + chunkSize);
      const refs = rows.map((row) => {
        const docId = `${row.codeSystem}_${row.code}_${row.version}`.replace(/[^\w.-]+/g, "_");
        return orgCollection(db, orgId, "procedureCodes").doc(docId);
      });
      const existingSnapshots = await db.getAll(...refs);
      const writeBatch = db.batch();

      rows.forEach((row, index) => {
        const existing = existingSnapshots[index];
        const existingData = existing.data();
        writeBatch.set(
          refs[index],
          {
            // Reimportação preserva vínculos e quantidades já confirmados pelo administrador.
            procedureId: (existingData?.procedureId as string | null | undefined) ?? null,
            codeSystem: row.codeSystem,
            code: row.code,
            description: row.description,
            validFrom: row.validFrom,
            validUntil: row.validUntil,
            version: row.version,
            active: row.active,
            healthInsurerId: (existingData?.healthInsurerId as string | null | undefined) ?? null,
            defaultQuantity: parseQuantity(existingData?.defaultQuantity),
            metadata: {
              ...((existingData?.metadata as ProcedureCode["metadata"] | undefined) ?? {}),
              importedProcedureName: row.procedureName,
            },
            importBatchId: batchRef.id,
            updatedAt: now(),
          },
          { merge: true },
        );
        if (existing.exists) updated += 1;
        else inserted += 1;
      });

      await writeBatch.commit();
      processedRows = Math.min(offset + rows.length, payload.rows.length);
      await batchRef.set({ processedRows }, { merge: true });
    }

    await batchRef.set(
      { status: "completed", completedAt: now(), inserted, updated, processedRows },
      { merge: true },
    );
    return { inserted, updated, batchId: batchRef.id };
  } catch (error) {
    await batchRef
      .set(
        {
          status: "failed",
          failedAt: now(),
          processedRows,
          inserted,
          updated,
          failureCode: "IMPORT_WRITE_FAILED",
        },
        { merge: true },
      )
      .catch(() => undefined);
    throw error;
  }
}
