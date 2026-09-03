"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireUser } from "@/lib/auth/current";
import { normalizeRequestCids, searchCid10 } from "@/lib/cid10/catalog";
import { withOrganizationContext } from "@/lib/db/client";
import {
  getSearchIndexStatus,
  rebuildSearchIndexChunk,
  searchPatientsIndexed,
  searchProceduresIndexed,
  upsertPatientIndexed,
} from "@/lib/db/indexed-search";
import { saveDraftWithTargetedCatalog } from "@/lib/db/request-write";
import * as repos from "@/lib/db/repos";
import { buildJustificationDraft, type JustificationFacts } from "@/lib/justification";
import { renderRequestPdf } from "@/lib/pdf/render-request";
import { parseQuantity } from "@/lib/quantity";
import { MEDICAL_REVIEW_STATEMENT } from "@/lib/requests/finalized-snapshot";
import { deleteObject, putObject } from "@/lib/storage";
import { parsePatientInput } from "@/lib/validation/domain";
import type {
  Patient,
  RequestStatus,
  SurgicalRequest,
} from "@/types/domain";

export async function savePatientAction(data: Partial<Patient> & { fullName: string; id?: string }) {
  const user = await requireUser();
  const parsed = parsePatientInput(data);
  const saved = await withOrganizationContext(user.organizationId, user.id, (db) =>
    upsertPatientIndexed(db, user.organizationId, user.id, parsed),
  );
  revalidatePath("/pacientes");
  return saved;
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
