import type { Db } from "@/lib/db/client";
import { orgCollection } from "@/lib/db/client";
import { listProceduresByIds } from "@/lib/db/procedure-lookup";
import { materializeRequestItems } from "@/lib/requests/materialize-items";
import { nextRequestRevision } from "@/lib/requests/revision";
import type { SessionUser, SurgicalRequest } from "@/types/domain";

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, stableValue(entry)]),
    );
  }
  return value;
}

function sameDraftPayload(left: unknown, right: unknown): boolean {
  return JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right));
}

function storedDraftPayload(data: Record<string, unknown>) {
  return {
    patientId: data.patientId ?? null,
    doctorId: data.doctorId ?? null,
    institutionId: data.institutionId ?? null,
    healthInsurerId: data.healthInsurerId ?? null,
    templateId: data.templateId ?? null,
    templateVersionId: data.templateVersionId ?? null,
    diagnosis: data.diagnosis ?? null,
    clinicalJustification: data.clinicalJustification ?? null,
    clinicalNotes: data.clinicalNotes ?? null,
    items: Array.isArray(data.items) ? data.items : [],
    cids: Array.isArray(data.cids) ? data.cids : [],
  };
}

/**
 * Persiste um rascunho carregando somente os procedimentos presentes na guia.
 * O fluxo anterior lia todo o catálogo de procedimentos + todos os códigos em
 * cada autosave, o que cresce de forma desnecessária com TUSS/IPASGO.
 *
 * Saves sem mudança material são idempotentes: não incrementam a revisão nem
 * invalidam uma revisão médica já validada no servidor.
 */
export async function saveDraftWithTargetedCatalog(
  db: Db,
  user: SessionUser,
  request: SurgicalRequest,
): Promise<{
  updatedAt: string;
  revision: number;
  items: SurgicalRequest["items"];
}> {
  const procedureIds = request.items
    .map((item) => item.procedureId)
    .filter((procedureId): procedureId is string => Boolean(procedureId));
  const procedures = await listProceduresByIds(db, user.organizationId, procedureIds);
  const codes = procedures.flatMap((procedure) => procedure.codes);
  const items = materializeRequestItems({
    requestId: request.id,
    items: request.items,
    procedures,
    codes,
    healthInsurerId: request.healthInsurerId,
  });

  const requestRef = orgCollection(db, user.organizationId, "requests").doc(request.id);
  const nextPayload = {
    patientId: request.patientId,
    doctorId: request.doctorId,
    institutionId: request.institutionId,
    healthInsurerId: request.healthInsurerId,
    templateId: request.templateId,
    templateVersionId: request.templateVersionId,
    diagnosis: request.diagnosis,
    clinicalJustification: request.clinicalJustification,
    clinicalNotes: request.clinicalNotes,
    items,
    cids: request.cids,
  };

  const result = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(requestRef);
    if (!snapshot.exists) throw new Error("Solicitação não encontrada.");
    const data = snapshot.data() ?? {};
    if (data.status !== "draft") {
      throw new Error("Documento finalizado não pode ser alterado. Duplique para criar uma nova versão.");
    }

    const currentRevision = Number(data.revision ?? 0);
    if (sameDraftPayload(storedDraftPayload(data), nextPayload)) {
      return {
        revision: currentRevision,
        updatedAt: String(data.updatedAt ?? request.updatedAt),
      };
    }

    const nextRevision = nextRequestRevision(request.revision, currentRevision);
    const updatedAt = new Date().toISOString();
    transaction.set(
      requestRef,
      {
        ...nextPayload,
        revision: nextRevision,
        updatedAt,
        reviewValidationRevision: null,
        reviewValidatedAt: null,
        reviewValidatedBy: null,
      },
      { merge: true },
    );
    return { revision: nextRevision, updatedAt };
  });

  return { ...result, items };
}
