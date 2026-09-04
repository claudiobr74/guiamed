import { Buffer } from "node:buffer";
import { FieldPath, type DocumentData } from "firebase-admin/firestore";
import type { Db } from "@/lib/db/client";
import { orgCollection } from "@/lib/db/client";
import type { DocumentTemplate, TemplateVersion } from "@/types/domain";

export interface TemplatePage {
  items: DocumentTemplate[];
  nextCursor: string | null;
}

interface NameCursor {
  name: string;
  id: string;
}

const PAGE_SIZE_MAX = 20;

function encodeCursor(cursor: NameCursor): string {
  return Buffer.from(JSON.stringify([cursor.name, cursor.id]), "utf8").toString("base64url");
}

function decodeCursor(value?: string | null): NameCursor | null {
  if (!value?.trim()) return null;
  try {
    const decoded = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (!Array.isArray(decoded) || decoded.length !== 2) return null;
    const [name, id] = decoded;
    if (typeof name !== "string" || typeof id !== "string" || !id) return null;
    return { name, id };
  } catch {
    return null;
  }
}

function mapVersion(id: string, data: DocumentData): TemplateVersion {
  return {
    id,
    templateId: String(data.templateId ?? ""),
    version: Number(data.version ?? 1),
    filePath: String(data.filePath ?? ""),
    fileHash: String(data.fileHash ?? ""),
    pageCount: Number(data.pageCount ?? 0),
    pageWidth: data.pageWidth === null || data.pageWidth === undefined ? null : Number(data.pageWidth),
    pageHeight: data.pageHeight === null || data.pageHeight === undefined ? null : Number(data.pageHeight),
    hasAcroform: Boolean(data.hasAcroform),
    acroformFields: Array.isArray(data.acroformFields) ? data.acroformFields : [],
    active: Boolean(data.active),
    createdAt: String(data.createdAt ?? ""),
    createdBy: (data.createdBy as string | null) ?? null,
  };
}

export async function listTemplatesPage(
  db: Db,
  orgId: string,
  input: { cursor?: string | null; limit?: number } = {},
): Promise<TemplatePage> {
  const requestedLimit = Math.trunc(input.limit ?? PAGE_SIZE_MAX);
  const limit = Math.min(Math.max(requestedLimit, 1), PAGE_SIZE_MAX);
  const cursor = decodeCursor(input.cursor);

  let query = orgCollection(db, orgId, "templates")
    .orderBy("name")
    .orderBy(FieldPath.documentId())
    .limit(limit + 1);
  if (cursor) query = query.startAfter(cursor.name, cursor.id);

  const templateSnapshot = await query.get();
  const hasNext = templateSnapshot.docs.length > limit;
  const visible = templateSnapshot.docs.slice(0, limit);
  const templateIds = visible.map((doc) => doc.id);

  const versionsByTemplate = new Map<string, TemplateVersion[]>();
  if (templateIds.length > 0) {
    const versionSnapshot = await db.collection("templateVersions")
      .where("templateId", "in", templateIds)
      .get();
    for (const doc of versionSnapshot.docs) {
      const data = doc.data();
      if (data.organizationId !== orgId) continue;
      const version = mapVersion(doc.id, data);
      const list = versionsByTemplate.get(version.templateId) ?? [];
      list.push(version);
      versionsByTemplate.set(version.templateId, list);
    }
  }

  const items = visible.map((doc) => {
    const data = doc.data();
    const versions = (versionsByTemplate.get(doc.id) ?? []).sort((a, b) => b.version - a.version);
    return {
      id: doc.id,
      organizationId: orgId,
      name: String(data.name ?? ""),
      institutionId: (data.institutionId as string | null) ?? null,
      healthInsurerId: (data.healthInsurerId as string | null) ?? null,
      documentType: String(data.documentType ?? "surgical_request"),
      active: data.active !== false,
      currentVersion: versions.find((version) => version.active) ?? null,
      versions,
    } satisfies DocumentTemplate;
  });

  const last = visible.at(-1);
  return {
    items,
    nextCursor: hasNext && last
      ? encodeCursor({ name: String(last.data().name ?? ""), id: last.id })
      : null,
  };
}
