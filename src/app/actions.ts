"use server";

import { redirect } from "next/navigation";
import { requireAdmin, requireUser } from "@/lib/auth/current";
import { normalizeRequestCids, searchCid10 } from "@/lib/cid10/catalog";
import { withRls } from "@/lib/db/client";
import * as repos from "@/lib/db/repos";
import { parseQuantity } from "@/lib/quantity";
import { validateImportRows, parseCsv, parseSheetMatrix, cellText, type ImportRow } from "@/lib/import-codes";
import { summarizeImportDiff } from "@/lib/import-diff";
import { buildJustificationDraft, type JustificationFacts } from "@/lib/justification";
import { inspectPdf } from "@/lib/pdf/inspect";
import { renderRequestPdf } from "@/lib/pdf/render-request";
import { deleteObject, putObject } from "@/lib/storage";
import { suggestSemanticField } from "@/lib/mapping-suggest";
import { randomUUID } from "node:crypto";
import type {
  Doctor,
  FieldMapping,
  InstitutionKind,
  Patient,
  PdfRepeater,
  RequestStatus,
  SurgicalRequest,
} from "@/types/domain";
import ExcelJS from "exceljs";

export async function savePatientAction(data: Partial<Patient> & { fullName: string; id?: string }) {
  const user = await requireUser();
  return withRls(user.organizationId, user.id, (db) =>
    repos.upsertPatient(db, user.organizationId, user.id, data),
  );
}

export async function saveDoctorAction(
  data: Partial<Doctor> & { name: string; crm: string; crmState: string; id?: string },
) {
  const user = await requireUser();
  return withRls(user.organizationId, user.id, (db) => repos.upsertDoctor(db, user.organizationId, data));
}

export async function saveInstitutionAction(data: {
  id?: string;
  name: string;
  kind: InstitutionKind;
  city?: string;
  state?: string;
  cnpj?: string;
  phone?: string;
}) {
  const user = await requireAdmin();
  return withRls(user.organizationId, user.id, (db) =>
    repos.upsertInstitution(db, user.organizationId, data),
  );
}

export async function saveInsurerAction(data: { id?: string; name: string; code?: string }) {
  const user = await requireAdmin();
  return withRls(user.organizationId, user.id, (db) =>
    repos.upsertInsurer(db, user.organizationId, data),
  );
}

export async function saveProcedureAction(data: {
  id?: string;
  name: string;
  description?: string;
  specialty?: string;
  synonyms?: string[];
}) {
  const user = await requireAdmin();
  return withRls(user.organizationId, user.id, (db) =>
    repos.upsertProcedure(db, user.organizationId, data),
  );
}

export async function saveKitAction(data: {
  id?: string;
  name: string;
  description?: string;
  specialty?: string;
  items: Array<{ procedureId: string; defaultQuantity: number; notes?: string }>;
}) {
  const user = await requireAdmin();
  for (const item of data.items) parseQuantity(item.defaultQuantity);
  return withRls(user.organizationId, user.id, (db) => repos.upsertKit(db, user.organizationId, data));
}

export async function searchProceduresAction(q: string) {
  const user = await requireUser();
  if (!q.trim()) return [];
  return withRls(user.organizationId, user.id, (db) =>
    repos.searchProcedures(db, user.organizationId, q),
  );
}

export async function searchCidsAction(q: string) {
  await requireUser();
  if (!q.trim()) return [];
  return searchCid10(q);
}

export async function searchPatientsAction(q: string) {
  const user = await requireUser();
  return withRls(user.organizationId, user.id, (db) =>
    repos.listPatients(db, user.organizationId, q),
  );
}

export async function createRequestAction() {
  const user = await requireUser();
  const id = await withRls(user.organizationId, user.id, (db) => repos.createDraft(db, user));
  redirect(`/guias/${id}`);
}

export async function saveRequestAction(request: SurgicalRequest) {
  const user = await requireUser();
  for (const item of request.items) parseQuantity(item.quantity);
  const normalizedRequest = {
    ...request,
    cids: normalizeRequestCids(request.cids, request.id),
  };
  await withRls(user.organizationId, user.id, (db) => repos.saveDraft(db, user, normalizedRequest));
  return { ok: true as const };
}

export async function duplicateRequestAction(id: string) {
  const user = await requireUser();
  const newId = await withRls(user.organizationId, user.id, (db) =>
    repos.duplicateRequest(db, user, id),
  );
  redirect(`/guias/${newId}`);
}

export async function draftJustificationAction(facts: JustificationFacts) {
  await requireUser();
  return buildJustificationDraft(facts);
}

async function parseImportFile(file: File): Promise<{ rows: ImportRow[]; format: "csv" | "xlsx" | "json" }> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".json")) {
    const parsed = JSON.parse(await file.text()) as ImportRow[];
    return { rows: parsed, format: "json" };
  }
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
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
  return { rows: parseCsv(await file.text()), format: "csv" };
}

export async function previewImportCodesAction(formData: FormData) {
  const user = await requireAdmin();
  const file = formData.get("file");
  const defaultSystem = String(formData.get("codeSystem") ?? "TUSS");
  const version = String(formData.get("version") ?? "");
  if (!(file instanceof File)) throw new Error("Arquivo ausente.");
  const { rows } = await parseImportFile(file);
  const validated = validateImportRows(
    rows.map((r) => ({ ...r, version: r.version || version, code_system: r.code_system || defaultSystem })),
    defaultSystem,
  );
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
  const existing = await withRls(user.organizationId, user.id, (db) => repos.listCodes(db, user.organizationId));
  const diff = summarizeImportDiff(validated.rows, existing);
  return {
    ok: true as const,
    filename: file.name,
    sizeBytes: file.size,
    codeSystem: defaultSystem,
    version: version || validated.rows[0]?.version || "1",
    ...diff,
  };
}

export async function importCodesAction(formData: FormData) {
  const user = await requireAdmin();
  const file = formData.get("file");
  const defaultSystem = String(formData.get("codeSystem") ?? "TUSS");
  const version = String(formData.get("version") ?? "");
  if (!(file instanceof File)) throw new Error("Arquivo ausente.");
  const { rows, format } = await parseImportFile(file);
  const validated = validateImportRows(
    rows.map((r) => ({ ...r, version: r.version || version, code_system: r.code_system || defaultSystem })),
    defaultSystem,
  );
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
  const result = await withRls(user.organizationId, user.id, (db) =>
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

export async function uploadTemplateAction(formData: FormData) {
  const user = await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("Envie um PDF.");
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    throw new Error("O arquivo deve ser um PDF.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const meta = await inspectPdf(bytes);
  const stored = await putObject("pdf-templates", user.organizationId, file.name, bytes);
  const created = await withRls(user.organizationId, user.id, (db) =>
    repos.createTemplateVersion(db, user.organizationId, user.id, {
      templateId: String(formData.get("templateId") || "") || undefined,
      name: String(formData.get("name") || file.name),
      institutionId: String(formData.get("institutionId") || "") || null,
      healthInsurerId: String(formData.get("healthInsurerId") || "") || null,
      filePath: stored.filePath,
      fileHash: stored.fileHash,
      pageCount: meta.pageCount,
      pageWidth: meta.pageWidth,
      pageHeight: meta.pageHeight,
      hasAcroform: meta.hasAcroform,
      acroformFields: meta.acroformFields,
    }),
  );
  const suggestions = meta.acroformFields.map((field) => ({
    pdfFieldName: field.name,
    suggested: suggestSemanticField(field.name),
  }));
  return { ...created, meta, suggestions };
}

export async function saveMappingsAction(versionId: string, mappings: Omit<FieldMapping, "id" | "templateVersionId">[]) {
  const user = await requireAdmin();
  await withRls(user.organizationId, user.id, (db) =>
    repos.saveMappings(db, user.organizationId, versionId, mappings),
  );
}

export async function saveRepeaterAction(repeater: Omit<PdfRepeater, "id"> & { id?: string }) {
  const user = await requireAdmin();
  await withRls(user.organizationId, user.id, (db) =>
    repos.saveRepeater(db, user.organizationId, repeater),
  );
}

export async function generatePdfAction(requestId: string) {
  const user = await requireUser();
  return withRls(user.organizationId, user.id, async (db) => {
    const rendered = await renderRequestPdf(db, user, requestId);
    const stored = await putObject(
      "generated-documents",
      user.organizationId,
      `${requestId}-${randomUUID()}.pdf`,
      rendered.bytes,
    );
    try {
      return await repos.finalizeWithGeneratedDocument(db, user, {
        requestId,
        templateVersionId: rendered.templateVersionId,
        expectedRequestUpdatedAt: rendered.requestUpdatedAt,
        filePath: stored.filePath,
        fileHash: stored.fileHash,
      });
    } catch (error) {
      try {
        await deleteObject(stored.filePath, user.organizationId);
      } catch (cleanupError) {
        console.error("Falha ao remover PDF órfão após erro de finalização", cleanupError);
      }
      throw error;
    }
  });
}

export async function listRequestsAction(filters: { q?: string; status?: RequestStatus; from?: string; to?: string }) {
  const user = await requireUser();
  return withRls(user.organizationId, user.id, (db) =>
    repos.listRequests(db, user.organizationId, filters),
  );
}
