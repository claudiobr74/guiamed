import type { DocumentData } from "firebase-admin/firestore";
import type { Db } from "@/lib/db/client";
import { orgCollection } from "@/lib/db/client";
import type { TussCodeTable } from "@/types/domain";

function mapTable(id: string, data: DocumentData): TussCodeTable {
  return {
    id,
    key: String(data.key ?? id),
    name: String(data.name ?? id),
    currentVersion: String(data.currentVersion ?? ""),
    sourceFilename: (data.sourceFilename as string | null | undefined) ?? null,
    active: data.active !== false,
    createdAt: String(data.createdAt ?? data.updatedAt ?? ""),
    updatedAt: String(data.updatedAt ?? data.createdAt ?? ""),
  };
}

export async function listTussCodeTables(db: Db, orgId: string): Promise<TussCodeTable[]> {
  const snapshot = await orgCollection(db, orgId, "codeTables").get();
  return snapshot.docs
    .map((doc) => mapTable(doc.id, doc.data()))
    .filter((table) => table.active)
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export async function getTussCodeTable(db: Db, orgId: string, key: string): Promise<TussCodeTable | null> {
  const normalized = key.trim();
  if (!normalized) return null;
  const snapshot = await orgCollection(db, orgId, "codeTables").doc(normalized).get();
  if (!snapshot.exists) return null;
  const table = mapTable(snapshot.id, snapshot.data() ?? {});
  return table.active ? table : null;
}
