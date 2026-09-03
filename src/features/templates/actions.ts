"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/current";
import { searchInstitutionsByName, searchInsurersByName } from "@/lib/db/admin-search";
import { writeAuditLog } from "@/lib/db/audit";
import { orgCollection, withOrganizationContext } from "@/lib/db/client";
import * as repos from "@/lib/db/repos";
import { inspectPdf } from "@/lib/pdf/inspect";
import { validateRepeaterForTemplate } from "@/lib/pdf/mapping-validation";
import { validatePdfUploadMetadata } from "@/lib/pdf/upload-validation";
import { assertRateLimit } from "@/lib/security/rate-limit";
import { deleteObject, putObject } from "@/lib/storage";
import type { PdfRepeater } from "@/types/domain";

const MIN_SEARCH_LENGTH = 2;

export async function searchTemplateInstitutionsAction(query: string) {
  const user = await requireAdmin();
  const value = query.trim();
  if (value.length < MIN_SEARCH_LENGTH) return [];
  return withOrganizationContext(user.organizationId, user.id, (db) =>
    searchInstitutionsByName(db, user.organizationId, value),
  );
}

export async function searchTemplateInsurersAction(query: string) {
  const user = await requireAdmin();
  const value = query.trim();
  if (value.length < MIN_SEARCH_LENGTH) return [];
  return withOrganizationContext(user.organizationId, user.id, (db) =>
    searchInsurersByName(db, user.organizationId, value),
  );
}

export async function uploadTemplateAndRedirectAction(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("Envie um PDF.");

  validatePdfUploadMetadata({ name: file.name, type: file.type, size: file.size });
  await withOrganizationContext(user.organizationId, user.id, (db) =>
    assertRateLimit(db, user.organizationId, {
      actorId: user.id,
      action: "upload_pdf_template",
      limit: 10,
      windowMs: 60_000,
    }),
  );

  const bytes = new Uint8Array(await file.arrayBuffer());
  const meta = await inspectPdf(bytes);
  const stored = await putObject("pdf-templates", user.organizationId, file.name, bytes);
  const name = String(formData.get("name") || file.name).trim() || file.name;
  const templateId = String(formData.get("templateId") || "") || undefined;
  const institutionId = String(formData.get("institutionId") || "") || null;
  const healthInsurerId = String(formData.get("healthInsurerId") || "") || null;

  let created: { templateId: string; versionId: string; version: number };
  try {
    created = await withOrganizationContext(user.organizationId, user.id, async (db) => {
      if (institutionId) {
        const institution = await orgCollection(db, user.organizationId, "institutions").doc(institutionId).get();
        if (!institution.exists) throw new Error("Instituição não encontrada nesta organização.");
        if (institution.data()?.active === false) throw new Error("Instituição inativa não pode ser vinculada a novo template.");
      }
      if (healthInsurerId) {
        const insurer = await orgCollection(db, user.organizationId, "healthInsurers").doc(healthInsurerId).get();
        if (!insurer.exists) throw new Error("Convênio/operadora não encontrado nesta organização.");
        if (insurer.data()?.active === false) throw new Error("Convênio/operadora inativo não pode ser vinculado a novo template.");
      }

      const result = await repos.createTemplateVersion(db, user.organizationId, user.id, {
        templateId,
        name,
        institutionId,
        healthInsurerId,
        filePath: stored.filePath,
        fileHash: stored.fileHash,
        pageCount: meta.pageCount,
        pageWidth: meta.pageWidth,
        pageHeight: meta.pageHeight,
        hasAcroform: meta.hasAcroform,
        acroformFields: meta.acroformFields,
      });
      await writeAuditLog(db, user.organizationId, {
        userId: user.id,
        action: "create_template_version",
        entityType: "template_version",
        entityId: result.versionId,
        metadata: {
          templateId: result.templateId,
          version: result.version,
          name,
          institutionId,
          healthInsurerId,
          fileName: file.name,
          fileHash: stored.fileHash,
          pageCount: meta.pageCount,
          hasAcroform: meta.hasAcroform,
          acroformFieldCount: meta.acroformFields.length,
        },
      });
      return result;
    });
  } catch (error) {
    await deleteObject(stored.filePath, user.organizationId).catch((cleanupError) => {
      console.error("Falha ao remover template órfão", cleanupError);
    });
    throw error;
  }

  redirect(`/templates/${created.versionId}/mapper`);
}

export async function saveRepeatersAction(
  versionId: string,
  repeaters: Array<Omit<PdfRepeater, "templateVersionId">>,
) {
  const user = await requireAdmin();
  await withOrganizationContext(user.organizationId, user.id, async (db) => {
    const version = await repos.getTemplateVersion(db, user.organizationId, versionId);
    if (!version) throw new Error("Versão do template não encontrada nesta organização.");
    const previous = await repos.listRepeaters(db, user.organizationId, versionId);

    const validated = repeaters.map((repeater) =>
      validateRepeaterForTemplate(
        {
          ...repeater,
          templateVersionId: versionId,
        },
        version,
      ),
    );

    const normalized = validated.map((repeater, index) => ({
      ...repeater,
      id: repeater.id ?? `rep_${index}`,
      templateVersionId: versionId,
    }));

    await db.collection("templateVersions").doc(versionId).set(
      {
        repeaters: normalized,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );

    await writeAuditLog(db, user.organizationId, {
      userId: user.id,
      action: "update_pdf_repeaters",
      entityType: "template_version",
      entityId: versionId,
      metadata: {
        beforeCount: previous.length,
        afterCount: normalized.length,
        pages: [...new Set(normalized.map((repeater) => repeater.page))],
      },
    });
  });
}
