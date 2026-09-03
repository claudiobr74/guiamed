import type { NormalizedImportRow } from "@/lib/import-codes";

export interface ExistingCodeRef {
  codeSystem: string;
  code: string;
  version: string;
  description: string;
  active: boolean;
}

export type ImportConflictKind = "description_changed" | "discontinued" | "reactivated";

export interface ImportConflict {
  codeSystem: string;
  code: string;
  version: string;
  kind: ImportConflictKind;
  previousDescription: string;
  incomingDescription: string;
}

export interface ImportDiffCounts {
  inserted: number;
  descriptionChanged: number;
  discontinued: number;
  reactivated: number;
  unchanged: number;
  conflictCount: number;
  conflicts: ImportConflict[];
}

export function summarizeImportDiff(
  rows: NormalizedImportRow[],
  existing: ExistingCodeRef[],
): ImportDiffCounts {
  const map = new Map(
    existing.map((item) => [`${item.codeSystem}|${item.code}|${item.version}`, item] as const),
  );
  const counts: ImportDiffCounts = {
    inserted: 0,
    descriptionChanged: 0,
    discontinued: 0,
    reactivated: 0,
    unchanged: 0,
    conflictCount: 0,
    conflicts: [],
  };

  for (const row of rows) {
    const prev = map.get(`${row.codeSystem}|${row.code}|${row.version}`);
    if (!prev) {
      counts.inserted += 1;
      continue;
    }

    let kind: ImportConflictKind | null = null;
    if (row.active === false && prev.active) {
      counts.discontinued += 1;
      kind = "discontinued";
    } else if (row.active === true && prev.active === false) {
      counts.reactivated += 1;
      kind = "reactivated";
    } else if (prev.description !== row.description) {
      counts.descriptionChanged += 1;
      kind = "description_changed";
    } else {
      counts.unchanged += 1;
    }

    if (kind) {
      counts.conflicts.push({
        codeSystem: row.codeSystem,
        code: row.code,
        version: row.version,
        kind,
        previousDescription: prev.description,
        incomingDescription: row.description,
      });
    }
  }

  counts.conflictCount = counts.conflicts.length;
  return counts;
}
