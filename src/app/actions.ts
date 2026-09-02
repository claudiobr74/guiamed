"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { encodeSession, SESSION_COOKIE } from "@/lib/auth/session";
import { loginWithPassword, registerOrganization } from "@/lib/db/auth";
import { requireAdmin, requireUser } from "@/lib/auth/current";
import { withRls } from "@/lib/db/client";
import * as repos from "@/lib/db/repos";
import { parseQuantity } from "@/lib/quantity";
import { validateImportRows, parseCsv, type ImportRow } from "@/lib/import-codes";
import { buildJustificationDraft, type JustificationFacts } from "@/lib/justification";
import { inspectPdf } from "@/lib/pdf/inspect";
import { fillPdf, validateRequestForPdf } from "@/lib/pdf/fill";
import { putObject, getObject } from "@/lib/storage";
import { suggestSemanticField } from "@/lib/mapping-suggest";
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

async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 14,
  });
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const user = await loginWithPassword(email, password);
  await setSessionCookie(encodeSession(user));
  redirect("/");
}

export async function registerAction(formData: FormData) {
  const user = await registerOrganization({
    organizationName: String(formData.get("organizationName") ?? "Clínica"),
    fullName: String(formData.get("fullName") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });
  await setSessionCookie(encodeSession(user));
  redirect("/");
}

export async function logoutAction() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/login");
}

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
  const user = await requireUser();
  if (!q.trim()) return [];
  return withRls(user.organizationId, user.id, (db) => repos.searchCids(db, q));
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
  await withRls(user.organizationId, user.id, (db) => repos.saveDraft(db, user, request));
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

export async function importCodesAction(formData: FormData) {
  const user = await requireAdmin();
  const file = formData.get("file");
  const defaultSystem = String(formData.get("codeSystem") ?? "TUSS");
  const version = String(formData.get("version") ?? "");
  if (!(file instanceof File)) throw new Error("Arquivo ausente.");
  const name = file.name.toLowerCase();
  let rows: ImportRow[] = [];
  let format: "csv" | "xlsx" | "json" = "csv";
  if (name.endsWith(".json")) {
    format = "json";
    const parsed = JSON.parse(await file.text()) as ImportRow[];
    rows = parsed;
  } else if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    format = "xlsx";
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await file.arrayBuffer());
    const sheet = wb.worksheets[0];
    if (!sheet) throw new Error("Planilha vazia.");
    const header: string[] = [];
    sheet.getRow(1).eachCell((cell, col) => {
      header[col] = String(cell.value ?? "").toLowerCase();
    });
    sheet.eachRow((row, index) => {
      if (index === 1) return;
      const obj: ImportRow = {};
      row.eachCell((cell, col) => {
        const key = header[col];
        const value = String(cell.value ?? "");
        if (key === "code_system") obj.code_system = value;
        if (key === "code") obj.code = value;
        if (key === "description") obj.description = value;
        if (key === "version") obj.version = value;
        if (key === "valid_from") obj.valid_from = value;
        if (key === "valid_until") obj.valid_until = value;
        if (key === "procedure_name") obj.procedure_name = value;
      });
      rows.push(obj);
    });
  } else {
    rows = parseCsv(await file.text());
  }
  const validated = validateImportRows(
    rows.map((r) => ({ ...r, version: r.version || version, code_system: r.code_system || defaultSystem })),
    defaultSystem,
  );
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

export async function generatePdfAction(requestId: string, options?: { finalize?: boolean }) {
  const user = await requireUser();
  const shouldFinalize = options?.finalize ?? true;
  return withRls(user.organizationId, user.id, async (db) => {
    const request = await repos.hydrateRequest(db, user.organizationId, requestId);
    if (!request.templateVersionId) {
      throw new Error("Selecione um template antes de gerar o PDF.");
    }
    const version = await repos.getTemplateVersion(db, user.organizationId, request.templateVersionId);
    if (!version) throw new Error("Versão do template não encontrada.");
    const mappings = await repos.listMappings(db, user.organizationId, version.id);
    const repeaters = await repos.listRepeaters(db, user.organizationId, version.id);
    const errors = validateRequestForPdf(request, mappings);
    if (errors.length > 0) throw new Error(errors[0]);
    const templateBytes = await getObject(version.filePath);
    let signatureBytes: Uint8Array | null = null;
    if (request.doctor?.signatureFile) {
      signatureBytes = await getObject(request.doctor.signatureFile);
    }
    const filled = await fillPdf({
      templateBytes,
      request,
      mappings,
      repeaters,
      signatureBytes,
    });
    const stored = await putObject(
      "generated-documents",
      user.organizationId,
      `${requestId}.pdf`,
      filled.bytes,
    );
    if (shouldFinalize && request.status === "draft") {
      await repos.finalizeRequest(db, user, requestId);
    }
    const doc = await repos.saveGeneratedDocument(db, user, {
      requestId,
      templateVersionId: version.id,
      filePath: stored.filePath,
      fileHash: stored.fileHash,
    });
    return doc;
  });
}

export async function previewPdfAction(requestId: string) {
  return generatePdfAction(requestId, { finalize: false });
}

export async function listRequestsAction(filters: { q?: string; status?: RequestStatus; from?: string; to?: string }) {
  const user = await requireUser();
  return withRls(user.organizationId, user.id, (db) =>
    repos.listRequests(db, user.organizationId, filters),
  );
}
