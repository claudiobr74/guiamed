import type { Db } from "@/lib/db/client";
import { normalizeRequestCids } from "@/lib/cid10/catalog";
import * as repos from "@/lib/db/repos";
import { fillPdf, validateRequestForPdf } from "@/lib/pdf/fill";
import { getObject } from "@/lib/storage";
import type { SessionUser } from "@/types/domain";
import { validateRequestForFinalization } from "@/lib/requests/finalization-validation";

export interface RenderedRequestPdf {
  bytes: Uint8Array;
  templateVersionId: string;
  requestUpdatedAt: string;
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
  const request = await repos.hydrateRequest(db, user.organizationId, requestId);
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
  const templates = await repos.listTemplates(db, user.organizationId);
  const template = templates.find((candidate) => candidate.id === request.templateId) ?? null;

  const [mappings, repeaters] = await Promise.all([
    repos.listMappings(db, user.organizationId, version.id),
    repos.listRepeaters(db, user.organizationId, version.id),
  ]);
  const errors = validateRequestForPdf(request, mappings);
  const finalizationIssues = validateRequestForFinalization({ request, template, version, mappings, repeaters });
  const blockingIssue = finalizationIssues.find((issue) => issue.severity === "error");
  if (blockingIssue) throw new Error(blockingIssue.message);
  if (errors.length > 0) throw new Error(errors[0]);

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
  };
}
