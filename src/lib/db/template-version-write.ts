import type { DocumentData } from "firebase-admin/firestore";
import type { Db } from "@/lib/db/client";
import { orgCollection } from "@/lib/db/client";
import { buildAuditLogDocument } from "@/lib/db/audit";

export interface TemplateVersionWriteInput {
  templateId?: string;
  name: string;
  institutionId: string | null;
  healthInsurerId: string | null;
  filePath: string;
  fileHash: string;
  pageCount: number;
  pageWidth: number | null;
  pageHeight: number | null;
  hasAcroform: boolean;
  acroformFields: unknown;
  auditMetadata?: Record<string, unknown>;
}

function normalizedVersion(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

/** Combina o contador novo com versões legadas para uma migração backward-compatible. */
export function nextTemplateVersionNumber(
  currentVersionNumber: unknown,
  versions: Array<{ version?: unknown }>,
): number {
  const legacyMax = versions.reduce(
    (maximum, item) => Math.max(maximum, normalizedVersion(item.version)),
    0,
  );
  return Math.max(normalizedVersion(currentVersionNumber), legacyMax) + 1;
}

export async function validateTemplateVersionTargets(
  db: Db,
  organizationId: string,
  input: Pick<TemplateVersionWriteInput, "templateId" | "institutionId" | "healthInsurerId">,
): Promise<void> {
  const reads: Array<Promise<FirebaseFirestore.DocumentSnapshot<DocumentData>>> = [];
  const labels: Array<"template" | "institution" | "insurer"> = [];

  if (input.templateId) {
    reads.push(orgCollection(db, organizationId, "templates").doc(input.templateId).get());
    labels.push("template");
  }
  if (input.institutionId) {
    reads.push(orgCollection(db, organizationId, "institutions").doc(input.institutionId).get());
    labels.push("institution");
  }
  if (input.healthInsurerId) {
    reads.push(orgCollection(db, organizationId, "healthInsurers").doc(input.healthInsurerId).get());
    labels.push("insurer");
  }

  const snapshots = await Promise.all(reads);
  snapshots.forEach((snapshot, index) => {
    const label = labels[index];
    if (!snapshot.exists) {
      if (label === "template") throw new Error("Template não encontrado nesta organização.");
      if (label === "institution") throw new Error("Instituição não encontrada nesta organização.");
      throw new Error("Convênio/operadora não encontrado nesta organização.");
    }
    if (snapshot.data()?.active === false) {
      if (label === "institution") throw new Error("Instituição inativa não pode ser vinculada a novo template.");
      if (label === "insurer") throw new Error("Convênio/operadora inativo não pode ser vinculado a novo template.");
    }
  });
}

/**
 * Cria uma versão e seu audit log em uma única transação.
 * O documento do template funciona também como lock otimista/counter, fazendo
 * uploads concorrentes do mesmo template serem serializados pelo Firestore.
 */
export async function createTemplateVersionTransactional(
  db: Db,
  organizationId: string,
  userId: string,
  input: TemplateVersionWriteInput,
): Promise<{ templateId: string; versionId: string; version: number }> {
  const templateId = input.templateId ?? orgCollection(db, organizationId, "templates").doc().id;
  const templateRef = orgCollection(db, organizationId, "templates").doc(templateId);
  const versionRef = db.collection("templateVersions").doc();
  const auditRef = orgCollection(db, organizationId, "auditLogs").doc();
  const versionsQuery = db.collection("templateVersions")
    .where("organizationId", "==", organizationId)
    .where("templateId", "==", templateId);
  const createdAt = new Date().toISOString();

  const version = await db.runTransaction(async (transaction) => {
    // Firestore exige todas as leituras antes das gravações.
    const templateSnapshot = await transaction.get(templateRef);
    const institutionSnapshot = input.institutionId
      ? await transaction.get(orgCollection(db, organizationId, "institutions").doc(input.institutionId))
      : null;
    const insurerSnapshot = input.healthInsurerId
      ? await transaction.get(orgCollection(db, organizationId, "healthInsurers").doc(input.healthInsurerId))
      : null;
    const existingVersions = await transaction.get(versionsQuery);

    if (input.templateId && !templateSnapshot.exists) {
      throw new Error("Template não encontrado nesta organização.");
    }
    if (institutionSnapshot && !institutionSnapshot.exists) {
      throw new Error("Instituição não encontrada nesta organização.");
    }
    if (institutionSnapshot?.data()?.active === false) {
      throw new Error("Instituição inativa não pode ser vinculada a novo template.");
    }
    if (insurerSnapshot && !insurerSnapshot.exists) {
      throw new Error("Convênio/operadora não encontrado nesta organização.");
    }
    if (insurerSnapshot?.data()?.active === false) {
      throw new Error("Convênio/operadora inativo não pode ser vinculado a novo template.");
    }

    const nextVersion = nextTemplateVersionNumber(
      templateSnapshot.data()?.currentVersionNumber,
      existingVersions.docs.map((document) => ({ version: document.data().version })),
    );

    transaction.set(
      templateRef,
      {
        name: input.name,
        institutionId: input.institutionId,
        healthInsurerId: input.healthInsurerId,
        documentType: "surgical_request",
        active: true,
        currentVersionNumber: nextVersion,
        currentVersionId: versionRef.id,
        updatedAt: createdAt,
      },
      { merge: true },
    );

    for (const document of existingVersions.docs) {
      if (document.data().active !== false) {
        transaction.set(document.ref, { active: false }, { merge: true });
      }
    }

    transaction.set(versionRef, {
      organizationId,
      templateId,
      version: nextVersion,
      filePath: input.filePath,
      fileHash: input.fileHash,
      pageCount: input.pageCount,
      pageWidth: input.pageWidth,
      pageHeight: input.pageHeight,
      hasAcroform: input.hasAcroform,
      acroformFields: input.acroformFields,
      mappings: [],
      repeaters: [],
      active: true,
      createdAt,
      createdBy: userId,
    });

    transaction.set(
      auditRef,
      {
        ...buildAuditLogDocument({
          userId,
          action: "create_template_version",
          entityType: "template_version",
          entityId: versionRef.id,
          metadata: {
            templateId,
            version: nextVersion,
            name: input.name,
            institutionId: input.institutionId,
            healthInsurerId: input.healthInsurerId,
            fileHash: input.fileHash,
            pageCount: input.pageCount,
            hasAcroform: input.hasAcroform,
            ...input.auditMetadata,
          },
        }),
        createdAt,
      },
    );

    return nextVersion;
  });

  return { templateId, versionId: versionRef.id, version };
}
