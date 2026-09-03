"use server";

import ExcelJS from "exceljs";
import { requireAdmin } from "@/lib/auth/current";
import { searchInsurersByName, searchProceduresByName } from "@/lib/db/admin-search";
import { buildAuditLogDocument, writeAuditLog } from "@/lib/db/audit";
import { withOrganizationContext, orgCollection } from "@/lib/db/client";
import * as repos from "@/lib/db/repos";
import { getExistingCodesForImportRows } from "@/lib/db/import-lookup";
import {
  getSearchIndexStatus,
  indexImportedProcedureCodes,
  searchProceduresIndexed,
} from "@/lib/db/indexed-search";
import { parseQuantity } from "@/lib/quantity";
import { buildImportPreview } from "@/lib/import-preview";
import {
  cellText,
  parseCsv,
  parseSheetMatrix,
  validateImportRows,
  type ImportRow,
} from "@/lib/import-codes";

const MIN_SEARCH_LENGTH = 2;

async function parseImportFile(file: File): Promise<{ rows: ImportRow[]; format: "csv" | "xlsx" | "json" }> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".json")) {
    const parsed = JSON.parse(await file.text()) as ImportRow[];
    return { rows: parsed, format: "json" };
  }
  if (name.endsWith(".xlsx")) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await file.arrayBuffer());
    if (wb.worksheets.length === 0) throw new Error("Planilha vazia.");
    let best: ImportRow[] = [];
    for (const sheet of wb.worksheets) {
      const matrix: string[][] = [];
      sheet.eachRow({ includeEmpty: true }, (row, index) => {
        const cells: string[] = [];
        row.eachCell({ includeEmpty: true }, (cell, col) => {
          cells[col - 1] = cellText(cell.value);
        });
        matrix[index - 1] = cells;
      });
      const parsed = parseSheetMatrix(matrix);
      if (parsed.length > best.length) best = parsed;
    }
    return { rows: best, format: "xlsx" };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    text = new TextDecoder("windows-1252").decode(bytes);
  }
  return { rows: parseCsv(text), format: "csv" };
}

function normalizeRows(rows: ImportRow[], version: string, defaultSystem: string) {
  return validateImportRows(
    rows.map((row) => ({
      ...row,
      version: row.version || version,
      code_system: row.code_system || defaultSystem,
    })),
    defaultSystem,
  );
}

export async function previewImportCodesDetailedAction(formData: FormData) {
  const user = await requireAdmin();
  const file = formData.get("file");
  const defaultSystem = String(formData.get("codeSystem") ?? "TUSS").trim().toUpperCase();
  const version = String(formData.get("version") ?? "").trim();
  if (!(file instanceof File)) throw new Error("Arquivo ausente.");

  const { rows } = await parseImportFile(file);
  const validated = normalizeRows(rows, version, defaultSystem);
  if (validated.rows.length === 0) {
    return {
      ok: false as const,
      issues: [
        {
          row: 1,
          field: "file",
          message: "Não encontramos códigos TUSS/IPASGO nesta planilha. Confira se há uma coluna de código e outra de descrição.",
        },
      ],
    };
  }

  const existing = await withOrganizationContext(user.organizationId, user.id, (db) =>
    getExistingCodesForImportRows(db, user.organizationId, validated.rows),
  );
  const analysis = buildImportPreview(validated.rows, validated.issues, existing);

  return {
    ok: true as const,
    filename: file.name,
    sizeBytes: file.size,
    codeSystem: defaultSystem,
    version: version || validated.rows[0]?.version || "1",
    ...analysis,
  };
}

export async function importCodesDetailedAction(formData: FormData) {
  const user = await requireAdmin();
  const file = formData.get("file");
  const defaultSystem = String(formData.get("codeSystem") ?? "TUSS").trim().toUpperCase();
  const version = String(formData.get("version") ?? "").trim();
  if (!(file instanceof File)) throw new Error("Arquivo ausente.");

  const { rows, format } = await parseImportFile(file);
  const validated = normalizeRows(rows, version, defaultSystem);
  if (validated.rows.length === 0) {
    return {
      ok: false as const,
      issues: [
        {
          row: 1,
          field: "file",
          message: "Não encontramos códigos TUSS/IPASGO nesta planilha. Confira se há uma coluna de código e outra de descrição.",
        },
      ],
    };
  }
  if (validated.issues.length > 0) {
    return { ok: false as const, issues: validated.issues };
  }

  const result = await withOrganizationContext(user.organizationId, user.id, async (db) => {
    const importedVersion = version || validated.rows[0]?.version || "1";
    const imported = await repos.insertCodesIdempotent(db, user.organizationId, user.id, {
      codeSystem: defaultSystem,
      version: importedVersion,
      sourceFilename: file.name,
      sourceFormat: format,
      rows: validated.rows,
    });
    await indexImportedProcedureCodes(db, user.organizationId, validated.rows);
    await writeAuditLog(db, user.organizationId, {
      userId: user.id,
      action: "import_procedure_codes",
      entityType: "import_batch",
      entityId: imported.batchId,
      metadata: {
        codeSystem: defaultSystem,
        version: importedVersion,
        sourceFilename: file.name,
        sourceFormat: format,
        rowCount: validated.rows.length,
        inserted: imported.inserted,
        updated: imported.updated,
      },
    });
    return imported;
  });
  return { ok: true as const, ...result };
}

export async function searchCodeProceduresAction(query: string) {
  const user = await requireAdmin();
  const value = query.trim();
  if (value.length < MIN_SEARCH_LENGTH) return [];
  return withOrganizationContext(user.organizationId, user.id, async (db) => {
    const status = await getSearchIndexStatus(db, user.organizationId);
    return status.ready
      ? searchProceduresIndexed(db, user.organizationId, value)
      : searchProceduresByName(db, user.organizationId, value);
  });
}

export async function searchCodeInsurersAction(query: string) {
  const user = await requireAdmin();
  const value = query.trim();
  if (value.length < MIN_SEARCH_LENGTH) return [];
  return withOrganizationContext(user.organizationId, user.id, (db) =>
    searchInsurersByName(db, user.organizationId, value),
  );
}

export async function saveProcedureCodeLinkAction(data: {
  codeId: string;
  procedureId: string | null;
  healthInsurerId: string | null;
  defaultQuantity: number;
}) {
  const user = await requireAdmin();
  const codeId = data.codeId.trim();
  if (!codeId) throw new Error("Código inválido.");
  const quantity = parseQuantity(data.defaultQuantity);

  return withOrganizationContext(user.organizationId, user.id, async (db) => {
    const codeRef = orgCollection(db, user.organizationId, "procedureCodes").doc(codeId);
    const codeSnap = await codeRef.get();
    if (!codeSnap.exists) throw new Error("Código não encontrado nesta organização.");
    const previous = codeSnap.data() ?? {};

    if (data.procedureId) {
      const procedureSnap = await orgCollection(db, user.organizationId, "procedures").doc(data.procedureId).get();
      if (!procedureSnap.exists) throw new Error("Procedimento canônico não encontrado nesta organização.");
      if (procedureSnap.data()?.active === false) {
        throw new Error("Procedimento canônico inativo não pode receber novos vínculos.");
      }
    }

    if (data.healthInsurerId) {
      const insurerSnap = await orgCollection(db, user.organizationId, "healthInsurers").doc(data.healthInsurerId).get();
      if (!insurerSnap.exists) throw new Error("Convênio/operadora não encontrado nesta organização.");
      if (insurerSnap.data()?.active === false) {
        throw new Error("Convênio/operadora inativo não pode receber novos vínculos.");
      }
    }

    const next = {
      procedureId: data.procedureId || null,
      healthInsurerId: data.healthInsurerId || null,
      defaultQuantity: quantity,
      updatedAt: new Date().toISOString(),
    };
    const auditRef = orgCollection(db, user.organizationId, "auditLogs").doc();
    const batch = db.batch();
    batch.set(codeRef, next, { merge: true });
    batch.set(auditRef, buildAuditLogDocument({
      userId: user.id,
      action: "update_procedure_code_link",
      entityType: "procedure_code",
      entityId: codeId,
      metadata: {
        before: {
          procedureId: (previous.procedureId as string | null | undefined) ?? null,
          healthInsurerId: (previous.healthInsurerId as string | null | undefined) ?? null,
          defaultQuantity: parseQuantity(previous.defaultQuantity),
        },
        after: {
          procedureId: next.procedureId,
          healthInsurerId: next.healthInsurerId,
          defaultQuantity: next.defaultQuantity,
        },
      },
    }));
    await batch.commit();

    return {
      ok: true as const,
      codeId,
      procedureId: next.procedureId,
      healthInsurerId: next.healthInsurerId,
      defaultQuantity: next.defaultQuantity,
    };
  });
}
