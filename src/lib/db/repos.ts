import type { DocumentData } from "firebase-admin/firestore";
import type { Db } from "@/lib/db/client";
import { orgCollection } from "@/lib/db/client";
import type {
  Doctor,
  DocumentTemplate,
  FieldMapping,
  GeneratedDocument,
  HealthInsurer,
  Institution,
  InstitutionKind,
  Patient,
  PdfRepeater,
  Procedure,
  ProcedureCode,
  ProcedureKit,
  RequestStatus,
  SessionUser,
  SurgicalRequest,
  TemplateVersion,
} from "@/types/domain";

function now() {
  return new Date().toISOString();
}

function matchesQuery(haystack: string, q?: string) {
  if (!q?.trim()) return true;
  return haystack.toLowerCase().includes(q.trim().toLowerCase());
}

export async function getOrganization(db: Db, orgId: string) {
  const snap = await db.collection("organizations").doc(orgId).get();
  const data = snap.data();
  if (!data) return null;
  return {
    name: String(data.name ?? ""),
    cnpj: (data.cnpj as string | null) ?? null,
  };
}

export async function listPatients(db: Db, orgId: string, q?: string): Promise<Patient[]> {
  const snap = await orgCollection(db, orgId, "patients").get();
  const insurers = await listInsurers(db, orgId);
  const insurerName = new Map(insurers.map((i) => [i.id, i.name]));
  return snap.docs
    .map((doc) => mapPatient(orgId, doc.id, doc.data(), insurerName.get(String(doc.data().healthInsurerId ?? "")) ?? null))
    .filter((p) => matchesQuery(`${p.fullName} ${p.cpf ?? ""}`, q))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "pt-BR"));
}

export async function getPatient(db: Db, orgId: string, id: string): Promise<Patient | null> {
  const snap = await orgCollection(db, orgId, "patients").doc(id).get();
  if (!snap.exists) return null;
  const data = snap.data() ?? {};
  let insurerName: string | null = null;
  if (data.healthInsurerId) {
    const insurer = await orgCollection(db, orgId, "healthInsurers").doc(String(data.healthInsurerId)).get();
    insurerName = (insurer.data()?.name as string | null) ?? null;
  }
  return mapPatient(orgId, snap.id, data, insurerName);
}

export async function upsertPatient(
  db: Db,
  orgId: string,
  userId: string,
  data: Partial<Patient> & { fullName: string; id?: string },
): Promise<Patient> {
  if (data.cpf) {
    const all = await listPatients(db, orgId);
    const dup = all.find((p) => p.cpf === data.cpf && p.id !== data.id);
    if (dup) throw new Error("Já existe um paciente com este CPF nesta organização.");
  }
  const id = data.id ?? orgCollection(db, orgId, "patients").doc().id;
  const current = data.id ? await getPatient(db, orgId, data.id) : null;
  await orgCollection(db, orgId, "patients").doc(id).set({
    fullName: data.fullName,
    birthDate: data.birthDate ?? null,
    cpf: data.cpf ?? null,
    sex: data.sex ?? null,
    phone: data.phone ?? null,
    email: data.email ?? null,
    insuranceCard: data.insuranceCard ?? null,
    healthInsurerId: data.healthInsurerId ?? null,
    createdBy: current?.id ? undefined : userId,
    createdAt: current?.createdAt ?? now(),
    updatedAt: now(),
  }, { merge: true });
  const saved = await getPatient(db, orgId, id);
  if (!saved) throw new Error("Paciente não encontrado após cadastro.");
  return saved;
}

export async function listDoctors(db: Db, orgId: string, q?: string): Promise<Doctor[]> {
  const snap = await orgCollection(db, orgId, "doctors").get();
  return snap.docs
    .map((doc) => mapDoctor(orgId, doc.id, doc.data()))
    .filter((d) => matchesQuery(`${d.name} ${d.crm}`, q))
    .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.name.localeCompare(b.name, "pt-BR"));
}

export async function getDoctor(db: Db, orgId: string, id: string): Promise<Doctor | null> {
  const snap = await orgCollection(db, orgId, "doctors").doc(id).get();
  if (!snap.exists) return null;
  return mapDoctor(orgId, snap.id, snap.data() ?? {});
}

export async function upsertDoctor(
  db: Db,
  orgId: string,
  data: Partial<Doctor> & { name: string; crm: string; crmState: string; id?: string },
): Promise<Doctor> {
  if (data.isDefault) {
    const doctors = await listDoctors(db, orgId);
    await Promise.all(
      doctors.filter((d) => d.isDefault).map((d) =>
        orgCollection(db, orgId, "doctors").doc(d.id).set({ isDefault: false }, { merge: true }),
      ),
    );
  }
  const id = data.id ?? orgCollection(db, orgId, "doctors").doc().id;
  await orgCollection(db, orgId, "doctors").doc(id).set({
    name: data.name,
    crm: data.crm,
    crmState: data.crmState,
    cpf: data.cpf ?? null,
    specialty: data.specialty ?? null,
    rqe: data.rqe ?? null,
    phone: data.phone ?? null,
    email: data.email ?? null,
    signatureFile: data.signatureFile ?? null,
    signatureKind: data.signatureKind ?? "image",
    isDefault: data.isDefault ?? false,
    active: data.active ?? true,
    updatedAt: now(),
  }, { merge: true });
  const saved = await getDoctor(db, orgId, id);
  if (!saved) throw new Error("Médico não encontrado.");
  return saved;
}

export async function listInstitutions(db: Db, orgId: string): Promise<Institution[]> {
  const snap = await orgCollection(db, orgId, "institutions").get();
  return snap.docs
    .map((doc) => mapInstitution(orgId, doc.id, doc.data()))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export async function upsertInstitution(
  db: Db,
  orgId: string,
  data: { id?: string; name: string; kind: InstitutionKind; city?: string; state?: string; cnpj?: string; phone?: string; active?: boolean },
): Promise<Institution> {
  const id = data.id ?? orgCollection(db, orgId, "institutions").doc().id;
  await orgCollection(db, orgId, "institutions").doc(id).set({
    kind: data.kind,
    name: data.name,
    city: data.city ?? null,
    state: data.state ?? null,
    cnpj: data.cnpj ?? null,
    phone: data.phone ?? null,
    active: data.active ?? true,
    updatedAt: now(),
  }, { merge: true });
  const saved = await orgCollection(db, orgId, "institutions").doc(id).get();
  return mapInstitution(orgId, id, saved.data() ?? {});
}

export async function listInsurers(db: Db, orgId: string): Promise<HealthInsurer[]> {
  const snap = await orgCollection(db, orgId, "healthInsurers").get();
  return snap.docs
    .map((doc) => mapInsurer(orgId, doc.id, doc.data()))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export async function upsertInsurer(
  db: Db,
  orgId: string,
  data: { id?: string; name: string; code?: string; active?: boolean },
): Promise<HealthInsurer> {
  const id = data.id ?? orgCollection(db, orgId, "healthInsurers").doc().id;
  await orgCollection(db, orgId, "healthInsurers").doc(id).set({
    name: data.name,
    code: data.code ?? null,
    active: data.active ?? true,
    updatedAt: now(),
  }, { merge: true });
  const saved = await orgCollection(db, orgId, "healthInsurers").doc(id).get();
  return mapInsurer(orgId, id, saved.data() ?? {});
}

export async function listProcedures(db: Db, orgId: string): Promise<Procedure[]> {
  const snap = await orgCollection(db, orgId, "procedures").get();
  const codes = await listCodes(db, orgId);
  return snap.docs
    .map((doc) => mapProcedure(orgId, doc.id, doc.data(), codes.filter((c) => c.procedureId === doc.id)))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export async function searchProcedures(db: Db, orgId: string, q: string): Promise<Procedure[]> {
  const needle = q.trim().toLowerCase();
  const all = await listProcedures(db, orgId);
  return all
    .filter((p) => p.active && matchesQuery(
      `${p.name} ${p.description ?? ""} ${p.specialty ?? ""} ${p.synonyms.join(" ")} ${p.codes.map((c) => `${c.code} ${c.description}`).join(" ")}`,
      needle,
    ))
    .slice(0, 30);
}

export async function upsertProcedure(
  db: Db,
  orgId: string,
  data: { id?: string; name: string; description?: string; specialty?: string; category?: string; synonyms?: string[]; active?: boolean },
): Promise<Procedure> {
  const id = data.id ?? orgCollection(db, orgId, "procedures").doc().id;
  await orgCollection(db, orgId, "procedures").doc(id).set({
    name: data.name,
    description: data.description ?? null,
    specialty: data.specialty ?? null,
    category: data.category ?? null,
    synonyms: data.synonyms ?? [],
    active: data.active ?? true,
    updatedAt: now(),
  }, { merge: true });
  const all = await listProcedures(db, orgId);
  const saved = all.find((p) => p.id === id);
  if (!saved) throw new Error("Procedimento não encontrado.");
  return saved;
}

export async function listCodes(db: Db, orgId: string, system?: string): Promise<ProcedureCode[]> {
  const snap = await orgCollection(db, orgId, "procedureCodes").get();
  return snap.docs
    .map((doc) => mapCode(doc.id, doc.data()))
    .filter((c) => !system || c.codeSystem === system)
    .sort((a, b) => a.codeSystem.localeCompare(b.codeSystem) || a.code.localeCompare(b.code));
}

export async function insertCodesIdempotent(
  db: Db,
  orgId: string,
  userId: string,
  payload: {
    codeSystem: string;
    version: string;
    sourceFilename: string;
    sourceFormat: "csv" | "xlsx" | "json";
    rows: Array<{
      codeSystem: string;
      code: string;
      description: string;
      version: string;
      validFrom: string | null;
      validUntil: string | null;
      procedureName: string | null;
      active: boolean;
    }>;
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
  });
  const procedures = await listProcedures(db, orgId);
  let inserted = 0;
  let updated = 0;
  for (const row of payload.rows) {
    let procedureId: string | null = null;
    if (row.procedureName) {
      procedureId = procedures.find((p) => p.name.toLowerCase() === row.procedureName?.toLowerCase())?.id ?? null;
    }
    const docId = `${row.codeSystem}_${row.code}_${row.version}`.replace(/[^\w.-]+/g, "_");
    const ref = orgCollection(db, orgId, "procedureCodes").doc(docId);
    const existing = await ref.get();
    await ref.set({
      procedureId,
      codeSystem: row.codeSystem,
      code: row.code,
      description: row.description,
      validFrom: row.validFrom,
      validUntil: row.validUntil,
      version: row.version,
      active: row.active,
      metadata: {},
      importBatchId: batchRef.id,
      updatedAt: now(),
    }, { merge: true });
    if (existing.exists) updated += 1;
    else inserted += 1;
  }
  return { inserted, updated, batchId: batchRef.id };
}

export async function listKits(db: Db, orgId: string): Promise<ProcedureKit[]> {
  const snap = await orgCollection(db, orgId, "kits").get();
  return snap.docs
    .map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        organizationId: orgId,
        name: String(data.name ?? ""),
        description: (data.description as string | null) ?? null,
        specialty: (data.specialty as string | null) ?? null,
        active: Boolean(data.active ?? true),
        items: Array.isArray(data.items) ? data.items : [],
      } satisfies ProcedureKit;
    })
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export async function upsertKit(
  db: Db,
  orgId: string,
  data: {
    id?: string;
    name: string;
    description?: string;
    specialty?: string;
    items: Array<{ procedureId: string; defaultQuantity: number; defaultCodeId?: string | null; notes?: string }>;
  },
): Promise<void> {
  const procedures = await listProcedures(db, orgId);
  const id = data.id ?? orgCollection(db, orgId, "kits").doc().id;
  await orgCollection(db, orgId, "kits").doc(id).set({
    name: data.name,
    description: data.description ?? null,
    specialty: data.specialty ?? null,
    active: true,
    items: data.items.map((item, index) => ({
      id: `${id}_${index}`,
      kitId: id,
      procedureId: item.procedureId,
      procedureName: procedures.find((p) => p.id === item.procedureId)?.name ?? "",
      defaultQuantity: item.defaultQuantity,
      defaultCodeId: item.defaultCodeId ?? null,
      notes: item.notes ?? null,
      sortOrder: index,
    })),
    updatedAt: now(),
  }, { merge: true });
}

export async function listTemplates(db: Db, orgId: string): Promise<DocumentTemplate[]> {
  const snap = await orgCollection(db, orgId, "templates").get();
  const versions = await db.collection("templateVersions").where("organizationId", "==", orgId).get();
  const byTemplate = new Map<string, TemplateVersion>();
  const versionsByTemplate = new Map<string, TemplateVersion[]>();
  for (const doc of versions.docs) {
    const version = mapVersion(doc.id, doc.data());
    const current = byTemplate.get(version.templateId);
    if (!current || (version.active && version.version >= current.version)) {
      byTemplate.set(version.templateId, version);
    }
    const list = versionsByTemplate.get(version.templateId) ?? [];
    list.push(version);
    versionsByTemplate.set(version.templateId, list);
  }
  return snap.docs
    .map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        organizationId: orgId,
        name: String(data.name ?? ""),
        institutionId: (data.institutionId as string | null) ?? null,
        healthInsurerId: (data.healthInsurerId as string | null) ?? null,
        documentType: String(data.documentType ?? "surgical_request"),
        active: Boolean(data.active ?? true),
        currentVersion: byTemplate.get(doc.id) ?? null,
        versions: (versionsByTemplate.get(doc.id) ?? []).sort((a, b) => b.version - a.version),
      } satisfies DocumentTemplate;
    })
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export async function getTemplateVersion(db: Db, orgId: string, id: string): Promise<TemplateVersion | null> {
  const snap = await db.collection("templateVersions").doc(id).get();
  if (!snap.exists) return null;
  if (snap.data()?.organizationId !== orgId) return null;
  return mapVersion(snap.id, snap.data() ?? {});
}

export async function createTemplateVersion(
  db: Db,
  orgId: string,
  userId: string,
  data: {
    templateId?: string;
    name: string;
    institutionId?: string | null;
    healthInsurerId?: string | null;
    filePath: string;
    fileHash: string;
    pageCount: number;
    pageWidth: number | null;
    pageHeight: number | null;
    hasAcroform: boolean;
    acroformFields: unknown;
  },
): Promise<{ templateId: string; versionId: string; version: number }> {
  const templateId = data.templateId ?? orgCollection(db, orgId, "templates").doc().id;
  await orgCollection(db, orgId, "templates").doc(templateId).set({
    name: data.name,
    institutionId: data.institutionId ?? null,
    healthInsurerId: data.healthInsurerId ?? null,
    documentType: "surgical_request",
    active: true,
    updatedAt: now(),
  }, { merge: true });
  const existing = await db.collection("templateVersions").where("templateId", "==", templateId).get();
  const version = existing.docs.reduce((max, doc) => Math.max(max, Number(doc.data().version ?? 0)), 0) + 1;
  await Promise.all(
    existing.docs.map((doc) => doc.ref.set({ active: false }, { merge: true })),
  );
  const versionRef = db.collection("templateVersions").doc();
  await versionRef.set({
    organizationId: orgId,
    templateId,
    version,
    filePath: data.filePath,
    fileHash: data.fileHash,
    pageCount: data.pageCount,
    pageWidth: data.pageWidth,
    pageHeight: data.pageHeight,
    hasAcroform: data.hasAcroform,
    acroformFields: data.acroformFields,
    mappings: [],
    repeaters: [],
    active: true,
    createdAt: now(),
    createdBy: userId,
  });
  return { templateId, versionId: versionRef.id, version };
}

async function ownedVersion(db: Db, orgId: string, versionId: string) {
  const snap = await db.collection("templateVersions").doc(versionId).get();
  if (!snap.exists || snap.data()?.organizationId !== orgId) {
    throw new Error("Template não encontrado nesta organização.");
  }
  return snap;
}

export async function listMappings(db: Db, orgId: string, versionId: string): Promise<FieldMapping[]> {
  const snap = await ownedVersion(db, orgId, versionId);
  const data = snap.data();
  return Array.isArray(data?.mappings) ? (data.mappings as FieldMapping[]) : [];
}

export async function saveMappings(
  db: Db,
  orgId: string,
  versionId: string,
  mappings: Omit<FieldMapping, "id" | "templateVersionId">[],
): Promise<void> {
  await ownedVersion(db, orgId, versionId);
  await db.collection("templateVersions").doc(versionId).set({
    mappings: mappings.map((m, index) => ({
      ...m,
      id: `map_${index}`,
      templateVersionId: versionId,
    })),
    updatedAt: now(),
  }, { merge: true });
}

export async function listRepeaters(db: Db, orgId: string, versionId: string): Promise<PdfRepeater[]> {
  const snap = await ownedVersion(db, orgId, versionId);
  const data = snap.data();
  return Array.isArray(data?.repeaters) ? (data.repeaters as PdfRepeater[]) : [];
}

export async function saveRepeater(db: Db, orgId: string, repeater: Omit<PdfRepeater, "id"> & { id?: string }): Promise<void> {
  const current = await listRepeaters(db, orgId, repeater.templateVersionId);
  const id = repeater.id ?? `rep_${current.length}`;
  const next = repeater.id
    ? current.map((item) => (item.id === repeater.id ? { ...repeater, id } : item))
    : [...current, { ...repeater, id }];
  await db.collection("templateVersions").doc(repeater.templateVersionId).set({
    repeaters: next,
    updatedAt: now(),
  }, { merge: true });
}

export async function listRequests(
  db: Db,
  orgId: string,
  filters: { q?: string; status?: RequestStatus; from?: string; to?: string },
): Promise<SurgicalRequest[]> {
  const snap = await orgCollection(db, orgId, "requests").get();
  const result: SurgicalRequest[] = [];
  for (const doc of snap.docs) {
    const request = await hydrateRequest(db, orgId, doc.id);
    if (filters.status && request.status !== filters.status) continue;
    const created = request.createdAt.slice(0, 10);
    if (filters.from && created < filters.from) continue;
    if (filters.to && created > filters.to) continue;
    const blob = `${request.patient?.fullName ?? ""} ${request.doctor?.name ?? ""} ${request.institution?.name ?? ""} ${request.items.map((i) => i.procedureName).join(" ")}`;
    if (!matchesQuery(blob, filters.q)) continue;
    result.push(request);
  }
  return result.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function hydrateRequest(db: Db, orgId: string, id: string): Promise<SurgicalRequest> {
  const snap = await orgCollection(db, orgId, "requests").doc(id).get();
  if (!snap.exists) throw new Error("Solicitação não encontrada.");
  const data = snap.data() ?? {};
  const patient = data.patientId ? await getPatient(db, orgId, String(data.patientId)) : null;
  const doctor = data.doctorId ? await getDoctor(db, orgId, String(data.doctorId)) : null;
  const institutions = data.institutionId ? await listInstitutions(db, orgId) : [];
  const insurers = data.healthInsurerId ? await listInsurers(db, orgId) : [];
  return {
    id,
    organizationId: orgId,
    patientId: (data.patientId as string | null) ?? null,
    doctorId: (data.doctorId as string | null) ?? null,
    institutionId: (data.institutionId as string | null) ?? null,
    healthInsurerId: (data.healthInsurerId as string | null) ?? null,
    templateId: (data.templateId as string | null) ?? null,
    templateVersionId: (data.templateVersionId as string | null) ?? null,
    diagnosis: (data.diagnosis as string | null) ?? null,
    clinicalJustification: (data.clinicalJustification as string | null) ?? null,
    clinicalNotes: (data.clinicalNotes as string | null) ?? null,
    status: (data.status as RequestStatus) ?? "draft",
    createdBy: (data.createdBy as string | null) ?? null,
    createdAt: String(data.createdAt ?? now()),
    updatedAt: String(data.updatedAt ?? now()),
    finalizedAt: data.finalizedAt ? String(data.finalizedAt) : null,
    duplicatedFromId: (data.duplicatedFromId as string | null) ?? null,
    patient,
    doctor,
    institution: institutions.find((i) => i.id === data.institutionId) ?? null,
    healthInsurer: insurers.find((i) => i.id === data.healthInsurerId) ?? null,
    items: Array.isArray(data.items) ? data.items : [],
    cids: Array.isArray(data.cids) ? data.cids : [],
  };
}

export async function createDraft(db: Db, user: SessionUser): Promise<string> {
  const doctors = await listDoctors(db, user.organizationId);
  const defaultDoctor = doctors.find((d) => d.isDefault && d.active);
  const ref = orgCollection(db, user.organizationId, "requests").doc();
  await ref.set({
    patientId: null,
    doctorId: defaultDoctor?.id ?? null,
    institutionId: null,
    healthInsurerId: null,
    templateId: null,
    templateVersionId: null,
    diagnosis: null,
    clinicalJustification: null,
    clinicalNotes: null,
    status: "draft",
    createdBy: user.id,
    createdAt: now(),
    updatedAt: now(),
    finalizedAt: null,
    duplicatedFromId: null,
    items: [],
    cids: [],
  });
  await audit(db, user, "create", "surgical_request", ref.id, { status: "draft" });
  return ref.id;
}

export async function saveDraft(db: Db, user: SessionUser, request: SurgicalRequest): Promise<void> {
  const snap = await orgCollection(db, user.organizationId, "requests").doc(request.id).get();
  if (!snap.exists) throw new Error("Solicitação não encontrada.");
  if (snap.data()?.status !== "draft") {
    throw new Error("Documento finalizado não pode ser alterado. Duplique para criar uma nova versão.");
  }
  await orgCollection(db, user.organizationId, "requests").doc(request.id).set({
    patientId: request.patientId,
    doctorId: request.doctorId,
    institutionId: request.institutionId,
    healthInsurerId: request.healthInsurerId,
    templateId: request.templateId,
    templateVersionId: request.templateVersionId,
    diagnosis: request.diagnosis,
    clinicalJustification: request.clinicalJustification,
    clinicalNotes: request.clinicalNotes,
    items: request.items,
    cids: request.cids,
    updatedAt: now(),
  }, { merge: true });
}

export async function cancelRequest(db: Db, user: SessionUser, requestId: string): Promise<void> {
  await orgCollection(db, user.organizationId, "requests").doc(requestId).set(
    { status: "cancelled", updatedAt: now() },
    { merge: true },
  );
  await audit(db, user, "cancel", "surgical_request", requestId, {});
}

export async function duplicateRequest(db: Db, user: SessionUser, requestId: string): Promise<string> {
  const source = await hydrateRequest(db, user.organizationId, requestId);
  const id = await createDraft(db, user);
  source.id = id;
  source.status = "draft";
  source.duplicatedFromId = requestId;
  source.finalizedAt = null;
  await saveDraft(db, user, source);
  await orgCollection(db, user.organizationId, "requests").doc(id).set({
    duplicatedFromId: requestId,
    status: "draft",
    finalizedAt: null,
  }, { merge: true });
  await audit(db, user, "duplicate", "surgical_request", id, { from: requestId });
  return id;
}

export async function finalizeWithGeneratedDocument(
  db: Db,
  user: SessionUser,
  data: {
    requestId: string;
    templateVersionId: string;
    expectedRequestUpdatedAt: string;
    filePath: string;
    fileHash: string;
  },
): Promise<GeneratedDocument> {
  const requestRef = orgCollection(db, user.organizationId, "requests").doc(data.requestId);
  const documentRef = orgCollection(db, user.organizationId, "generatedDocuments").doc();
  const finalizeAuditRef = orgCollection(db, user.organizationId, "auditLogs").doc();
  const generateAuditRef = orgCollection(db, user.organizationId, "auditLogs").doc();
  const createdAt = now();

  await db.runTransaction(async (transaction) => {
    const request = await transaction.get(requestRef);
    if (!request.exists) throw new Error("Solicitação não encontrada.");
    if (request.data()?.status !== "draft") {
      throw new Error("Somente rascunhos podem ser finalizados.");
    }
    if (String(request.data()?.updatedAt ?? "") !== data.expectedRequestUpdatedAt) {
      throw new Error(
        "A solicitação foi alterada durante a geração. Revise os dados e tente novamente.",
      );
    }

    transaction.set(documentRef, {
      requestId: data.requestId,
      templateVersionId: data.templateVersionId,
      filePath: data.filePath,
      fileHash: data.fileHash,
      createdAt,
      createdBy: user.id,
    });
    transaction.set(
      requestRef,
      { status: "finalized", finalizedAt: createdAt, updatedAt: createdAt },
      { merge: true },
    );
    transaction.set(finalizeAuditRef, {
      userId: user.id,
      action: "finalize",
      entityType: "surgical_request",
      entityId: data.requestId,
      metadata: {},
      createdAt,
    });
    transaction.set(generateAuditRef, {
      userId: user.id,
      action: "generate_pdf",
      entityType: "generated_document",
      entityId: documentRef.id,
      metadata: { requestId: data.requestId },
      createdAt,
    });
  });

  return {
    id: documentRef.id,
    requestId: data.requestId,
    templateVersionId: data.templateVersionId,
    filePath: data.filePath,
    fileHash: data.fileHash,
    createdAt,
    createdBy: user.id,
  };
}

export async function listGenerated(db: Db, orgId: string, requestId: string): Promise<GeneratedDocument[]> {
  const snap = await orgCollection(db, orgId, "generatedDocuments")
    .where("requestId", "==", requestId)
    .get();
  return snap.docs
    .map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        requestId: String(data.requestId),
        templateVersionId: String(data.templateVersionId),
        filePath: String(data.filePath),
        fileHash: String(data.fileHash),
        createdAt: String(data.createdAt),
        createdBy: (data.createdBy as string | null) ?? null,
      } satisfies GeneratedDocument;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function dashboardStats(db: Db, orgId: string) {
  const snap = await orgCollection(db, orgId, "requests").get();
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  let todayCount = 0;
  let monthCount = 0;
  let drafts = 0;
  let generated = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    const created = String(data.createdAt ?? "").slice(0, 10);
    if (created === today) todayCount += 1;
    if (created.startsWith(month)) monthCount += 1;
    if (data.status === "draft") drafts += 1;
    if (data.status === "finalized") generated += 1;
  }
  return { today: todayCount, month: monthCount, drafts, generated };
}

export async function audit(
  db: Db,
  user: SessionUser,
  action: string,
  entityType: string,
  entityId: string | null,
  metadata: Record<string, string | number | boolean | null>,
): Promise<void> {
  await orgCollection(db, user.organizationId, "auditLogs").add({
    userId: user.id,
    action,
    entityType,
    entityId,
    metadata,
    createdAt: now(),
  });
}

function mapPatient(orgId: string, id: string, data: DocumentData, insurerName: string | null): Patient {
  return {
    id,
    organizationId: orgId,
    fullName: String(data.fullName ?? ""),
    birthDate: data.birthDate ? String(data.birthDate).slice(0, 10) : null,
    cpf: (data.cpf as string | null) ?? null,
    sex: (data.sex as Patient["sex"]) ?? null,
    phone: (data.phone as string | null) ?? null,
    email: (data.email as string | null) ?? null,
    insuranceCard: (data.insuranceCard as string | null) ?? null,
    healthInsurerId: (data.healthInsurerId as string | null) ?? null,
    healthInsurerName: insurerName,
    createdAt: String(data.createdAt ?? now()),
    updatedAt: String(data.updatedAt ?? now()),
  };
}

function mapDoctor(orgId: string, id: string, data: DocumentData): Doctor {
  return {
    id,
    organizationId: orgId,
    name: String(data.name ?? ""),
    crm: String(data.crm ?? ""),
    crmState: String(data.crmState ?? ""),
    cpf: (data.cpf as string | null) ?? null,
    specialty: (data.specialty as string | null) ?? null,
    rqe: (data.rqe as string | null) ?? null,
    phone: (data.phone as string | null) ?? null,
    email: (data.email as string | null) ?? null,
    signatureFile: (data.signatureFile as string | null) ?? null,
    signatureKind: (data.signatureKind as Doctor["signatureKind"]) ?? "image",
    isDefault: Boolean(data.isDefault),
    active: data.active !== false,
  };
}

function mapInstitution(orgId: string, id: string, data: DocumentData): Institution {
  return {
    id,
    organizationId: orgId,
    kind: data.kind as InstitutionKind,
    name: String(data.name ?? ""),
    cnpj: (data.cnpj as string | null) ?? null,
    city: (data.city as string | null) ?? null,
    state: (data.state as string | null) ?? null,
    phone: (data.phone as string | null) ?? null,
    active: data.active !== false,
  };
}

function mapInsurer(orgId: string, id: string, data: DocumentData): HealthInsurer {
  return {
    id,
    organizationId: orgId,
    name: String(data.name ?? ""),
    code: (data.code as string | null) ?? null,
    active: data.active !== false,
  };
}

function mapProcedure(orgId: string, id: string, data: DocumentData, codes: ProcedureCode[]): Procedure {
  return {
    id,
    organizationId: orgId,
    name: String(data.name ?? ""),
    description: (data.description as string | null) ?? null,
    specialty: (data.specialty as string | null) ?? null,
    category: (data.category as string | null) ?? null,
    active: data.active !== false,
    synonyms: Array.isArray(data.synonyms) ? data.synonyms.map(String) : [],
    codes,
  };
}

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
    metadata: (data.metadata as ProcedureCode["metadata"]) ?? {},
  };
}

function mapVersion(id: string, data: DocumentData): TemplateVersion {
  return {
    id,
    templateId: String(data.templateId ?? ""),
    version: Number(data.version ?? 1),
    filePath: String(data.filePath ?? ""),
    fileHash: String(data.fileHash ?? ""),
    pageCount: Number(data.pageCount ?? 0),
    pageWidth: data.pageWidth === null || data.pageWidth === undefined ? null : Number(data.pageWidth),
    pageHeight: data.pageHeight === null || data.pageHeight === undefined ? null : Number(data.pageHeight),
    hasAcroform: Boolean(data.hasAcroform),
    acroformFields: Array.isArray(data.acroformFields) ? data.acroformFields : [],
    active: Boolean(data.active),
    createdAt: String(data.createdAt ?? now()),
    createdBy: (data.createdBy as string | null) ?? null,
  };
}
