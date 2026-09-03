"use server";

import { redirect } from "next/navigation";
import { uploadTemplateAction } from "@/app/actions";
import { requireAdmin } from "@/lib/auth/current";
import { searchInstitutionsByName, searchInsurersByName } from "@/lib/db/admin-search";
import { withOrganizationContext } from "@/lib/db/client";
import * as repos from "@/lib/db/repos";
import { validateRepeaterForTemplate } from "@/lib/pdf/mapping-validation";
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
  const result = await uploadTemplateAction(formData);
  redirect(`/templates/${result.versionId}/mapper`);
}

export async function saveRepeatersAction(
  versionId: string,
  repeaters: Array<Omit<PdfRepeater, "templateVersionId">>,
) {
  const user = await requireAdmin();
  await withOrganizationContext(user.organizationId, user.id, async (db) => {
    const version = await repos.getTemplateVersion(db, user.organizationId, versionId);
    if (!version) throw new Error("Versão do template não encontrada nesta organização.");

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

    const auditRef = db
      .collection("organizations")
      .doc(user.organizationId)
      .collection("auditLogs")
      .doc();
    await auditRef.set({
      userId: user.id,
      action: "update_pdf_repeaters",
      entityType: "template_version",
      entityId: versionId,
      metadata: { count: normalized.length },
      createdAt: new Date().toISOString(),
    });
  });
}
