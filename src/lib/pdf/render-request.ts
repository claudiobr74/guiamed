import type { Db } from "@/lib/db/client";
import { normalizeRequestCids } from "@/lib/cid10/catalog";
import { getTussCodeTable } from "@/lib/db/code-tables";
import { hydrateRequestDirect } from "@/lib/db/request-hydration";
import * as repos from "@/lib/db/repos";
import { fillPdf } from "@/lib/pdf/fill";
import { getObject } from "@/lib/storage";
import type { SessionUser } from "@/types/domain";
import { validateRequestForFinalization } from "@/lib/requests/finalization-validation";
import { buildFinalizedRequestSnapshot, type FinalizedRequestSnapshot } from "@/lib/requests/finalized-snapshot";

export interface RenderedRequestPdf {
  bytes: Uint8Array;
  templateVersionId: string;
  requestUpdatedAt: string;
  requestRevision: number;
  requestSnapshot: FinalizedRequestSnapshot;
}

/**
 * Renderiza sempre a versão exata do template vinculada à solicitação.
 * Não persiste arquivo nem altera o estado da guia.
 */
export async function renderRequestPdf(
  db: Db,
  user: SessionUser,
  requestId: string,
): Promise<RenderedRequestPdf> {
  const request = await hydrateRequestDirect(db, user.organizationId, requestId);
  request.cids = normalizeRequestCids(request.cids, request.id);
  if (!request.templateVersionId) {
    throw new Error("Selecione um template antes de gerar o PDF.");
  }

  const version = await repos.getTemplateVersion(
    db,
    user.organizationId,
    request.templateVersionId,
  );
  if (!version) throw new Error("Versão do template não encontrada.");
  const template = request.templateId
    ? await repos.getTemplate(db, user.organizationId, request.templateId)
    : null;
  if (!template) throw new Error("Template não encontrado nesta organização.");

  const [mappings, repeaters, tussTable] = await Promise.all([
    repos.listMappings(db, user.organizationId, version.id),
    repos.listRepeaters(db, user.organizationId, version.id),
    request.tussTableKey
      ? getTussCodeTable(db, user.organizationId, request.tussTableKey)
      : Promise.resolve(null),
  ]);
  const finalizationIssues = validateRequestForFinalization({
    request,
    template,
    version,
    tussTable,
    mappings,
    repeaters,
  });
  const blockingIssue = finalizationIssues.find((issue) => issue.severity === "error");
  if (blockingIssue) throw new Error(blockingIssue.message);

  const templateBytes = await getObject(version.filePath, user.organizationId);
  let signatureBytes: Uint8Array | null = null;
  if (request.doctor?.signatureFile) {
    signatureBytes = await getObject(
      request.doctor.signatureFile,
      user.organizationId,
    );
  }

  const filled = await fillPdf({
    templateBytes,
    request,
    mappings,
    repeaters,
    signatureBytes,
  });

  return {
    bytes: filled.bytes,
    templateVersionId: version.id,
    requestUpdatedAt: request.updatedAt,
    requestRevision: request.revision,
    requestSnapshot: buildFinalizedRequestSnapshot(request, template, version),
  };
}
