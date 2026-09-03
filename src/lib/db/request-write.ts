import type { Db } from "@/lib/db/client";
import { orgCollection } from "@/lib/db/client";
import { listProceduresByIds } from "@/lib/db/procedure-lookup";
import { materializeRequestItems } from "@/lib/requests/materialize-items";
import { nextRequestRevision } from "@/lib/requests/revision";
import type { SessionUser, SurgicalRequest } from "@/types/domain";

/**
 * Persiste um rascunho carregando somente os procedimentos presentes na guia.
 * O fluxo anterior lia todo o catálogo de procedimentos + todos os códigos em
 * cada autosave, o que cresce de forma desnecessária com TUSS/IPASGO.
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
  const updatedAt = new Date().toISOString();
  const revision = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(requestRef);
    if (!snapshot.exists) throw new Error("Solicitação não encontrada.");
    if (snapshot.data()?.status !== "draft") {
      throw new Error("Documento finalizado não pode ser alterado. Duplique para criar uma nova versão.");
    }
    const nextRevision = nextRequestRevision(request.revision, snapshot.data()?.revision);
    transaction.set(
      requestRef,
      {
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
        revision: nextRevision,
        updatedAt,
      },
      { merge: true },
    );
    return nextRevision;
  });

  return { updatedAt, revision, items };
}
