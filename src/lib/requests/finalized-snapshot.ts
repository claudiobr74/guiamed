import type { DocumentTemplate, SurgicalRequest, TemplateVersion } from "@/types/domain";

export const MEDICAL_REVIEW_STATEMENT = "Revisei os dados clínicos, códigos e quantidades.";

export function buildFinalizedRequestSnapshot(
  request: SurgicalRequest,
  template: DocumentTemplate,
  version: TemplateVersion,
) {
  return {
    schemaVersion: 1,
    request: {
      id: request.id,
      organizationId: request.organizationId,
      revision: request.revision,
      diagnosis: request.diagnosis,
      clinicalJustification: request.clinicalJustification,
      clinicalNotes: request.clinicalNotes,
      createdAt: request.createdAt,
    },
    patient: request.patient ? {
      id: request.patient.id,
      fullName: request.patient.fullName,
      birthDate: request.patient.birthDate,
      cpf: request.patient.cpf,
      sex: request.patient.sex,
      insuranceCard: request.patient.insuranceCard,
    } : null,
    doctor: request.doctor ? {
      id: request.doctor.id,
      name: request.doctor.name,
      crm: request.doctor.crm,
      crmState: request.doctor.crmState,
      rqe: request.doctor.rqe,
      specialty: request.doctor.specialty,
    } : null,
    institution: request.institution ? {
      id: request.institution.id,
      name: request.institution.name,
      kind: request.institution.kind,
      cnpj: request.institution.cnpj,
    } : null,
    healthInsurer: request.healthInsurer ? {
      id: request.healthInsurer.id,
      name: request.healthInsurer.name,
      code: request.healthInsurer.code,
    } : null,
    template: {
      id: template.id,
      name: template.name,
      versionId: version.id,
      version: version.version,
      fileHash: version.fileHash,
    },
    items: request.items.map((item) => ({
      procedureId: item.procedureId,
      procedureName: item.procedureName,
      tussCodeId: item.tussCodeId,
      tussCode: item.tussCodeSnapshot,
      tussDescription: item.tussDescriptionSnapshot ?? null,
      tussVersion: item.tussVersionSnapshot ?? null,
      ipasgoCodeId: item.ipasgoCodeId,
      ipasgoCode: item.ipasgoCodeSnapshot,
      ipasgoDescription: item.ipasgoDescriptionSnapshot ?? null,
      ipasgoVersion: item.ipasgoVersionSnapshot ?? null,
      quantity: item.quantity,
      laterality: item.laterality,
      notes: item.notes,
      sortOrder: item.sortOrder,
    })),
    cids: request.cids.map((cid) => ({
      cidCodeId: cid.cidCodeId,
      code: cid.codeSnapshot,
      description: cid.descriptionSnapshot,
      sortOrder: cid.sortOrder,
    })),
  };
}

export type FinalizedRequestSnapshot = ReturnType<typeof buildFinalizedRequestSnapshot>;
