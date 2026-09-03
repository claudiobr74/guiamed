"use server";

import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireUser } from "@/lib/auth/current";
import { normalizeRequestCids, searchCid10 } from "@/lib/cid10/catalog";
import { withOrganizationContext } from "@/lib/db/client";
import { getExistingCodesForImportRows } from "@/lib/db/import-lookup";
import {
  getSearchIndexStatus,
  indexImportedProcedureCodes,
  rebuildSearchIndexChunk,
  searchPatientsIndexed,
  searchProceduresIndexed,
  upsertPatientIndexed,
  upsertProcedureIndexed,
} from "@/lib/db/indexed-search";
import { saveDraftWithTargetedCatalog } from "@/lib/db/request-write";
import * as repos from "@/lib/db/repos";
import { summarizeImportDiff } from "@/lib/import-diff";
import { validateImportRows, parseCsv, parseSheetMatrix, cellText, type ImportRow } from "@/lib/import-codes";
import { buildJustificationDraft, type JustificationFacts } from "@/lib/justification";
import { suggestSemanticField } from "@/lib/mapping-suggest";
import { inspectPdf } from "@/lib/pdf/inspect";
import { validateMappingsForTemplate, validateRepeaterForTemplate } from "@/lib/pdf/mapping-validation";
import { renderRequestPdf } from "@/lib/pdf/render-request";
import { validatePdfUploadMetadata } from "@/lib/pdf/upload-validation";
import { parseQuantity } from "@/lib/quantity";
import { MEDICAL_REVIEW_STATEMENT } from "@/lib/requests/finalized-snapshot";
import { assertRateLimit } from "@/lib/security/rate-limit";
import { deleteObject, putObject } from "@/lib/storage";
import type {
  Doctor,
  FieldMapping,
  InstitutionKind,
  Patient,
  PdfRepeater,
  RequestStatus,
  SurgicalRequest,
} from "@/types/domain";

export async function savePatientAction(data: Partial<Patient> & { fullName: string; id?: string }) {
  const user = await requireUser();
  return withOrganizationContext(user.organizationId, user.id, (db) =>
    upsertPatientIndexed(db, user.organizationId, user.id, data),
  );
}

export async function saveDoctorAction(
  data: Partial<Doctor> & { name: string; crm: string; crmState: string; id?: string },
) {
  const user = await requireUser();
  return withOrganizationContext(user.organizationId, user.id, (db) => repos.upsertDoctor(db, user.organizationId, data));
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
  return withOrganizationContext(user.organizationId, user.id, (db) =>
    repos.upsertInstitution(db, user.organizationId, data),
  );
}

export async function saveInsurerAction(data: { id?: string; name: string; code?: string }) {
  const user = await requireAdmin();
  return withOrganizationContext(user.organizationId, user.id, (db) =>
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
  return withOrganizationContext(user.organizationId, user.id, (db) =>
    upsertProcedureIndexed(db, user.organizationId, data),
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
  return withOrganizationContext(user.organizationId, user.id, (db) => repos.upsertKit(db, user.organizationId, data));
}

export async function searchProceduresAction(q: string) {
  const user = await requireUser();
  const query = q.trim();
  if (query.length < 2) return [];
  return withOrganizationContext(user.organizationId, user.id, async (db) => {
    const status = await getSearchIndexStatus(db, user.organizationId);
    if (!status.ready) {
      return repos.searchProcedures(db, user.organizationId, query);
    }
    return searchProceduresIndexed(db, user.organizationId, query);
  });
}

export async function searchCidsAction(q: string) {
  await requireUser();
  if (q.trim().length < 2) return [];
  return searchCid10(q);
}

export async function searchPatientsAction(q: string) {
  const user = await requireUser();
  const query = q.trim();
  if (query.length < 2) return [];
  return withOrganizationContext(user.organizationId, user.id, async (db) => {
    const status = await getSearchIndexStatus(db, user.organizationId);
    if (!status.ready) {
      return repos.listPatients(db, user.organizationId, query);
    }
    return searchPatientsIndexed(db, user.organizationId, query);
  });
}

export async function rebuildSearchIndexesAction() {
  const user = await requireAdmin();
  await withOrganizationContext(user.organizationId, user.id, (db) =>
    rebuildSearchIndexChunk(db, user.organizationId),
  );
  revalidatePath("/configuracoes");
}

export async function createRequestAction() {
  const user = await requireUser();
  const id = await withOrganizationContext(user.organizationId, user.id, (db) => repos.createDraft(db, user));
  redirect(`/guias/${id}`);
}

export async function saveRequestAction(request: SurgicalRequest) {
  const user = await requireUser();
  for (const item of request.items) parseQuantity(item.quantity);
  const normalizedRequest = {
    ...request,
    cids: normalizeRequestCids(request.cids, request.id),
  };
  const saved = await withOrganizationContext(user.organizationId, user.id, (db) =>
    saveDraftWithTargetedCatalog(db, user, normalizedRequest),
  );
  return { ok: true as const, ...saved };
}

export async function duplicateRequestAction(id: string) {
  const user = await requireUser();
  const newId = await withOrganizationContext(user.organizationId, user.id, (db) =>
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
  const existing = await withOrganizationContext(user.organizationId, user.id, (db) =>
    getExistingCodesForImportRows(db, user.organizationId, validated.rows),
  );
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
  const result = await withOrganizationContext(user.organizationId, user.id, async (db) => {
    const imported = await repos.insertCodesIdempotent(db, user.organizationId, user.id, {
      codeSystem: defaultSystem,
      version: version || validated.rows[0]?.version || "1",
      sourceFilename: file.name,
      sourceFormat: format,
      rows: validated.rows,
    });
    await indexImportedProcedureCodes(db, user.organizationId, validated.rows);
    return imported;
  });
  return { ok: true as const, ...result };
}

export async function uploadTemplateAction(formData: FormData) {
  const user = await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("Envie um PDF.");

  // Valide metadados antes de alocar o arquivo inteiro em memória.
  validatePdfUploadMetadata({ name: file.name, type: file.type, size: file.size });
  await withOrganizationContext(user.organizationId, user.id, (db) =>
    assertRateLimit(db, user.organizationId, {
      actorId: user.id,
      action: "upload_pdf_template",
      limit: 10,
      windowMs: 60_000,
    }),
  );

  const bytes = new Uint8Array(await file.arrayBuffer());
  const meta = await inspectPdf(bytes);
  const stored = await putObject("pdf-templates", user.organizationId, file.name, bytes);
  let created;
  try {
    created = await withOrganizationContext(user.organizationId, user.id, (db) =>
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
  } catch (error) {
    await deleteObject(stored.filePath, user.organizationId).catch((cleanupError) => {
      console.error("Falha ao remover template órfão", cleanupError);
    });
    throw error;
  }
  const suggestions = meta.acroformFields.map((field) => ({
    pdfFieldName: field.name,
    suggested: suggestSemanticField(field.name),
  }));
  return { ...created, meta, suggestions };
}

export async function saveMappingsAction(versionId: string, mappings: Omit<FieldMapping, "id" | "templateVersionId">[]) {
  const user = await requireAdmin();
  await withOrganizationContext(user.organizationId, user.id, async (db) => {
    const version = await repos.getTemplateVersion(db, user.organizationId, versionId);
    if (!version) throw new Error("Versão do template não encontrada nesta organização.");
    const validated = validateMappingsForTemplate(mappings, version);
    await repos.saveMappings(db, user.organizationId, versionId, validated);
  });
}

export async function saveRepeaterAction(repeater: Omit<PdfRepeater, "id"> & { id?: string }) {
  const user = await requireAdmin();
  await withOrganizationContext(user.organizationId, user.id, async (db) => {
    const version = await repos.getTemplateVersion(db, user.organizationId, repeater.templateVersionId);
    if (!version) throw new Error("Versão do template não encontrada nesta organização.");
    const validated = validateRepeaterForTemplate(repeater, version);
    await repos.saveRepeater(db, user.organizationId, validated);
  });
}

export async function generatePdfAction(requestId: string, confirmation: { accepted: boolean; statement: string }) {
  const user = await requireUser();
  if (!confirmation.accepted || confirmation.statement !== MEDICAL_REVIEW_STATEMENT) {
    throw new Error("Confirme a revisão médica antes de finalizar a guia.");
  }
  return withOrganizationContext(user.organizationId, user.id, async (db) => {
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
        expectedRequestRevision: rendered.requestRevision,
        filePath: stored.filePath,
        fileHash: stored.fileHash,
        requestSnapshot: rendered.requestSnapshot,
        confirmationStatement: confirmation.statement,
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
  return withOrganizationContext(user.organizationId, user.id, (db) =>
    repos.listRequests(db, user.organizationId, filters),
  );
}
