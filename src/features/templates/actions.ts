"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/current";
import { searchInstitutionsByName, searchInsurersByName } from "@/lib/db/admin-search";
import { writeAuditLog } from "@/lib/db/audit";
import { withOrganizationContext } from "@/lib/db/client";
import * as repos from "@/lib/db/repos";
import {
  createTemplateVersionTransactional,
  validateTemplateVersionTargets,
} from "@/lib/db/template-version-write";
import { inspectPdf } from "@/lib/pdf/inspect";
import { validateMappingsForTemplate, validateRepeaterForTemplate } from "@/lib/pdf/mapping-validation";
import { validatePdfUploadMetadata } from "@/lib/pdf/upload-validation";
import { assertRateLimit } from "@/lib/security/rate-limit";
import { deleteObject, putObject } from "@/lib/storage";
import type { FieldMapping, PdfRepeater } from "@/types/domain";

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

  const name = String(formData.get("name") || file.name).trim() || file.name;
  const templateId = String(formData.get("templateId") || "") || undefined;
  const institutionId = String(formData.get("institutionId") || "") || null;
  const healthInsurerId = String(formData.get("healthInsurerId") || "") || null;

  await withOrganizationContext(user.organizationId, user.id, async (db) => {
    await Promise.all([
      assertRateLimit(db, user.organizationId, {
        actorId: user.id,
        action: "upload_pdf_template",
        limit: 10,
        windowMs: 60_000,
      }),
      validateTemplateVersionTargets(db, user.organizationId, {
        templateId,
        institutionId,
        healthInsurerId,
      }),
    ]);
  });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const meta = await inspectPdf(bytes);
  const stored = await putObject("pdf-templates", user.organizationId, file.name, bytes);

  let created: { templateId: string; versionId: string; version: number };
  try {
    created = await withOrganizationContext(user.organizationId, user.id, (db) =>
      createTemplateVersionTransactional(db, user.organizationId, user.id, {
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
        auditMetadata: {
          fileName: file.name,
          acroformFieldCount: meta.acroformFields.length,
        },
      }),
    );
  } catch (error) {
    // Nenhuma mutação Firestore é parcialmente confirmada: versão + audit são uma única transação.
    await deleteObject(stored.filePath, user.organizationId).catch((cleanupError) => {
      console.error("Falha ao remover template órfão", cleanupError);
    });
    throw error;
  }

  redirect(`/templates/${created.versionId}/mapper`);
}

export async function saveMappingsAction(
  versionId: string,
  mappings: Omit<FieldMapping, "id" | "templateVersionId">[],
) {
  const user = await requireAdmin();
  await withOrganizationContext(user.organizationId, user.id, async (db) => {
    const version = await repos.getTemplateVersion(db, user.organizationId, versionId);
    if (!version) throw new Error("Versão do template não encontrada nesta organização.");
    const previous = await repos.listMappings(db, user.organizationId, versionId);
    const validated = validateMappingsForTemplate(mappings, version);
    await repos.saveMappings(db, user.organizationId, versionId, validated);
    await writeAuditLog(db, user.organizationId, {
      userId: user.id,
      action: "update_pdf_mappings",
      entityType: "template_version",
      entityId: versionId,
      metadata: {
        beforeCount: previous.length,
        afterCount: validated.length,
        overlayCount: validated.filter((mapping) => mapping.mappingKind === "overlay").length,
        acroformCount: validated.filter((mapping) => mapping.mappingKind === "acroform").length,
        requiredCount: validated.filter((mapping) => mapping.required).length,
        semanticFields: [...new Set(validated.map((mapping) => mapping.semanticField))].sort(),
      },
    });
  });
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
