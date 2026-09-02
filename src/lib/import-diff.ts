import type { NormalizedImportRow } from "@/lib/import-codes";

export interface ExistingCodeRef {
  codeSystem: string;
  code: string;
  version: string;
  description: string;
  active: boolean;
}

export interface ImportDiffCounts {
  inserted: number;
  descriptionChanged: number;
  discontinued: number;
  unchanged: number;
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
    unchanged: 0,
  };
  for (const row of rows) {
    const prev = map.get(`${row.codeSystem}|${row.code}|${row.version}`);
    if (!prev) {
      counts.inserted += 1;
      continue;
    }
    if (row.active === false && prev.active) {
      counts.discontinued += 1;
    } else if (prev.description !== row.description) {
      counts.descriptionChanged += 1;
    } else {
      counts.unchanged += 1;
    }
  }
  return counts;
}
