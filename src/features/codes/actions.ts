"use server";

import ExcelJS from "exceljs";
import { requireAdmin } from "@/lib/auth/current";
import { withOrganizationContext, orgCollection } from "@/lib/db/client";
import * as repos from "@/lib/db/repos";
import { parseQuantity } from "@/lib/quantity";
import { buildImportPreview } from "@/lib/import-preview";
import {
  cellText,
  parseCsv,
  parseSheetMatrix,
  validateImportRows,
  type ImportRow,
} from "@/lib/import-codes";

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
    repos.listCodes(db, user.organizationId),
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

  const result = await withOrganizationContext(user.organizationId, user.id, (db) =>
    repos.insertCodesIdempotent(db, user.organizationId, user.id, {
      codeSystem: defaultSystem,
      version: version || validated.rows[0]?.version || "1",
      sourceFilename: file.name,
      sourceFormat: format,
      rows: validated.rows,
    }),
  );
  return { ok: true as const, ...result };
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

    if (data.procedureId) {
      const procedureSnap = await orgCollection(db, user.organizationId, "procedures").doc(data.procedureId).get();
      if (!procedureSnap.exists) throw new Error("Procedimento canônico não encontrado nesta organização.");
    }

    if (data.healthInsurerId) {
      const insurerSnap = await orgCollection(db, user.organizationId, "healthInsurers").doc(data.healthInsurerId).get();
      if (!insurerSnap.exists) throw new Error("Convênio/operadora não encontrado nesta organização.");
    }

    await codeRef.set(
      {
        procedureId: data.procedureId || null,
        healthInsurerId: data.healthInsurerId || null,
        defaultQuantity: quantity,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );

    return {
      ok: true as const,
      codeId,
      procedureId: data.procedureId || null,
      healthInsurerId: data.healthInsurerId || null,
      defaultQuantity: quantity,
    };
  });
}
