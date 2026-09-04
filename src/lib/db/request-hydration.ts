import type { DocumentData } from "firebase-admin/firestore";
import type { Db } from "@/lib/db/client";
import { orgCollection } from "@/lib/db/client";
import { getDoctor, getPatient } from "@/lib/db/repos";
import type { HealthInsurer, Institution, InstitutionKind, RequestStatus, SurgicalRequest } from "@/types/domain";

function now() {
  return new Date().toISOString();
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

/** Hidrata uma solicitação lendo apenas os documentos referenciados por ela. */
export async function hydrateRequestDirect(
  db: Db,
  orgId: string,
  id: string,
): Promise<SurgicalRequest> {
  const snap = await orgCollection(db, orgId, "requests").doc(id).get();
  if (!snap.exists) throw new Error("Solicitação não encontrada.");
  const data = snap.data() ?? {};
  const patientId = (data.patientId as string | null) ?? null;
  const doctorId = (data.doctorId as string | null) ?? null;
  const institutionId = (data.institutionId as string | null) ?? null;
  const healthInsurerId = (data.healthInsurerId as string | null) ?? null;

  const [patient, doctor, institutionSnap, insurerSnap] = await Promise.all([
    patientId ? getPatient(db, orgId, patientId) : Promise.resolve(null),
    doctorId ? getDoctor(db, orgId, doctorId) : Promise.resolve(null),
    institutionId
      ? orgCollection(db, orgId, "institutions").doc(institutionId).get()
      : Promise.resolve(null),
    healthInsurerId
      ? orgCollection(db, orgId, "healthInsurers").doc(healthInsurerId).get()
      : Promise.resolve(null),
  ]);

  return {
    id,
    organizationId: orgId,
    patientId,
    doctorId,
    institutionId,
    healthInsurerId,
    templateId: (data.templateId as string | null) ?? null,
    templateVersionId: (data.templateVersionId as string | null) ?? null,
    tussTableKey: (data.tussTableKey as string | null) ?? null,
    tussTableName: (data.tussTableName as string | null) ?? null,
    diagnosis: (data.diagnosis as string | null) ?? null,
    clinicalJustification: (data.clinicalJustification as string | null) ?? null,
    clinicalNotes: (data.clinicalNotes as string | null) ?? null,
    status: (data.status as RequestStatus) ?? "draft",
    revision: Number(data.revision ?? 0),
    createdBy: (data.createdBy as string | null) ?? null,
    createdAt: String(data.createdAt ?? now()),
    updatedAt: String(data.updatedAt ?? now()),
    finalizedAt: data.finalizedAt ? String(data.finalizedAt) : null,
    duplicatedFromId: (data.duplicatedFromId as string | null) ?? null,
    patient,
    doctor,
    institution:
      institutionSnap?.exists && institutionId
        ? mapInstitution(orgId, institutionId, institutionSnap.data() ?? {})
        : null,
    healthInsurer:
      insurerSnap?.exists && healthInsurerId
        ? mapInsurer(orgId, healthInsurerId, insurerSnap.data() ?? {})
        : null,
    items: Array.isArray(data.items) ? data.items : [],
    cids: Array.isArray(data.cids) ? data.cids : [],
  };
}
