import type { ImportIssue, NormalizedImportRow } from "@/lib/import-codes";
import { summarizeImportDiff, type ExistingCodeRef } from "@/lib/import-diff";

export interface ImportPreviewAnalysis {
  duplicateIssues: ImportIssue[];
  invalidIssues: ImportIssue[];
  duplicateCount: number;
  invalidCount: number;
  canImport: boolean;
  validRowCount: number;
  inserted: number;
  descriptionChanged: number;
  discontinued: number;
  reactivated: number;
  unchanged: number;
  conflictCount: number;
  conflicts: ReturnType<typeof summarizeImportDiff>["conflicts"];
}

export function buildImportPreview(
  rows: NormalizedImportRow[],
  issues: ImportIssue[],
  existing: ExistingCodeRef[],
): ImportPreviewAnalysis {
  const duplicateIssues = issues.filter((issue) => issue.message.toLowerCase().includes("duplicado"));
  const invalidIssues = issues.filter((issue) => !duplicateIssues.includes(issue));
  const blockedRows = new Set(issues.map((issue) => issue.row));
  const validRows = rows.filter((_, index) => !blockedRows.has(index + 1));
  const diff = summarizeImportDiff(validRows, existing);

  return {
    duplicateIssues,
    invalidIssues,
    duplicateCount: duplicateIssues.length,
    invalidCount: invalidIssues.length,
    canImport: issues.length === 0 && validRows.length > 0,
    validRowCount: validRows.length,
    ...diff,
  };
}
