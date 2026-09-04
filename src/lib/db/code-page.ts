import { FieldPath } from "firebase-admin/firestore";
import type { Db } from "@/lib/db/client";
import { orgCollection } from "@/lib/db/client";

export interface CatalogCodeRow {
  id: string;
  codeSystem: string;
  code: string;
  description: string;
  version: string;
  active: boolean;
}

export interface CatalogCodePage {
  items: CatalogCodeRow[];
  nextCursor: string | null;
}

const MAX_PAGE_SIZE = 200;

export async function listCodePage(
  db: Db,
  orgId: string,
  input: { cursor?: string | null; limit?: number } = {},
): Promise<CatalogCodePage> {
  const requestedLimit = Math.trunc(input.limit ?? 100);
  const limit = Math.min(Math.max(requestedLimit, 1), MAX_PAGE_SIZE);
  let query = orgCollection(db, orgId, "procedureCodes")
    .orderBy(FieldPath.documentId())
    .limit(limit + 1);

  const cursor = input.cursor?.trim();
  if (cursor) query = query.startAfter(cursor);

  const snapshot = await query.get();
  const hasNext = snapshot.docs.length > limit;
  const visible = snapshot.docs.slice(0, limit);

  return {
    items: visible.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        codeSystem: String(data.codeSystem ?? ""),
        code: String(data.code ?? ""),
        description: String(data.description ?? ""),
        version: String(data.version ?? ""),
        active: data.active !== false,
      };
    }),
    nextCursor: hasNext ? visible.at(-1)?.id ?? null : null,
  };
}
