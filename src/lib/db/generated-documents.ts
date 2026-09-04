import type { Db } from "@/lib/db/client";
import { orgCollection } from "@/lib/db/client";
import type { FinalizedRequestSnapshot } from "@/lib/requests/finalized-snapshot";
import type { GeneratedDocument } from "@/types/domain";

export interface GeneratedDocumentWithSnapshot extends GeneratedDocument {
  requestSnapshot: FinalizedRequestSnapshot | null;
  medicalConfirmation: {
    userId: string;
    statement: string;
    confirmedAt: string;
    requestRevision: number;
  } | null;
}

function parseSnapshot(value: unknown): FinalizedRequestSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<FinalizedRequestSnapshot>;
  if (candidate.schemaVersion !== 1 || !candidate.request || !candidate.template) return null;
  if (!Array.isArray(candidate.items) || !Array.isArray(candidate.cids)) return null;
  return value as FinalizedRequestSnapshot;
}

function parseMedicalConfirmation(value: unknown): GeneratedDocumentWithSnapshot["medicalConfirmation"] {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  const requestRevision = Number(data.requestRevision);
  if (
    typeof data.userId !== "string" ||
    typeof data.statement !== "string" ||
    typeof data.confirmedAt !== "string" ||
    !Number.isInteger(requestRevision)
  ) return null;
  return {
    userId: data.userId,
    statement: data.statement,
    confirmedAt: data.confirmedAt,
    requestRevision,
  };
}

export async function listGeneratedDocuments(
  db: Db,
  orgId: string,
  requestId: string,
): Promise<GeneratedDocumentWithSnapshot[]> {
  const snapshot = await orgCollection(db, orgId, "generatedDocuments")
    .where("requestId", "==", requestId)
    .get();

  return snapshot.docs
    .map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        requestId: String(data.requestId ?? ""),
        templateVersionId: String(data.templateVersionId ?? ""),
        filePath: String(data.filePath ?? ""),
        fileHash: String(data.fileHash ?? ""),
        createdAt: String(data.createdAt ?? ""),
        createdBy: (data.createdBy as string | null) ?? null,
        requestSnapshot: parseSnapshot(data.requestSnapshot),
        medicalConfirmation: parseMedicalConfirmation(data.medicalConfirmation),
      } satisfies GeneratedDocumentWithSnapshot;
    })
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function getLatestGeneratedDocument(
  db: Db,
  orgId: string,
  requestId: string,
): Promise<GeneratedDocumentWithSnapshot | null> {
  return (await listGeneratedDocuments(db, orgId, requestId))[0] ?? null;
}
