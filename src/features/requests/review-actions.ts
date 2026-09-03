"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/current";
import { normalizeRequestCids } from "@/lib/cid10/catalog";
import { orgCollection, withOrganizationContext } from "@/lib/db/client";
import * as repos from "@/lib/db/repos";
import {
  validateRequestForFinalization,
  type FinalizationIssue,
} from "@/lib/requests/finalization-validation";

export async function reviewRequestAction(requestId: string): Promise<FinalizationIssue[]> {
  const user = await requireUser();
  return withOrganizationContext(user.organizationId, user.id, async (db) => {
    const request = await repos.hydrateRequest(db, user.organizationId, requestId);
    request.cids = normalizeRequestCids(request.cids, request.id);

    const template = request.templateId
      ? await repos.getTemplate(db, user.organizationId, request.templateId)
      : null;
    const version = request.templateVersionId
      ? await repos.getTemplateVersion(db, user.organizationId, request.templateVersionId)
      : null;
    const [mappings, repeaters] = request.templateVersionId
      ? await Promise.all([
          repos.listMappings(db, user.organizationId, request.templateVersionId),
          repos.listRepeaters(db, user.organizationId, request.templateVersionId),
        ])
      : [[], []];

    return validateRequestForFinalization({ request, template, version, mappings, repeaters });
  });
}

export async function cancelRequestAction(requestId: string, reason: string) {
  const user = await requireUser();
  const normalizedReason = reason.trim();
  if (normalizedReason.length < 3) {
    throw new Error("Informe o motivo do cancelamento.");
  }
  if (normalizedReason.length > 500) {
    throw new Error("O motivo do cancelamento deve ter no máximo 500 caracteres.");
  }

  await withOrganizationContext(user.organizationId, user.id, async (db) => {
    const requestRef = orgCollection(db, user.organizationId, "requests").doc(requestId);
    const auditRef = orgCollection(db, user.organizationId, "auditLogs").doc();
    const cancelledAt = new Date().toISOString();

    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(requestRef);
      if (!snapshot.exists) throw new Error("Solicitação não encontrada.");
      if (snapshot.data()?.status !== "finalized") {
        throw new Error("Somente uma guia finalizada pode ser cancelada.");
      }

      transaction.set(
        requestRef,
        {
          status: "cancelled",
          cancelledAt,
          cancelledBy: user.id,
          cancellationReason: normalizedReason,
          updatedAt: cancelledAt,
        },
        { merge: true },
      );
      transaction.set(auditRef, {
        userId: user.id,
        action: "cancel",
        entityType: "surgical_request",
        entityId: requestId,
        metadata: { reason: normalizedReason },
        createdAt: cancelledAt,
      });
    });
  });

  revalidatePath(`/guias/${requestId}`);
  revalidatePath(`/guias/${requestId}/preview`);
  revalidatePath("/guias");
  return { ok: true as const };
}
