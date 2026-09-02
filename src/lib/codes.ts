import { CODE_NOT_FOUND, type ProcedureCode } from "@/types/domain";

export interface CodeCatalogItem {
  id: string;
  codeSystem: string;
  code: string;
  description: string;
  version: string;
  active: boolean;
  validFrom: string | null;
  validUntil: string | null;
}

export type CodeLookupResult =
  | { found: true; code: CodeCatalogItem }
  | { found: false; message: typeof CODE_NOT_FOUND };

export function isCodeValidOn(item: CodeCatalogItem, at: Date): boolean {
  if (!item.active) return false;
  if (item.validFrom && new Date(item.validFrom) > at) return false;
  if (item.validUntil && new Date(item.validUntil) < at) return false;
  return true;
}

export function lookupCode(
  catalog: CodeCatalogItem[],
  codeSystem: string,
  code: string,
  at: Date = new Date(),
): CodeLookupResult {
  const needle = code.trim();
  const match = catalog.find(
    (item) =>
      item.codeSystem.toUpperCase() === codeSystem.toUpperCase() &&
      item.code === needle &&
      isCodeValidOn(item, at),
  );
  if (!match) {
    return { found: false, message: CODE_NOT_FOUND };
  }
  return { found: true, code: match };
}

export function snapshotCode(code: ProcedureCode | null | undefined): string | null {
  if (!code) return null;
  return code.code;
}

export function displayCode(code: string | null | undefined): string {
  if (!code) return CODE_NOT_FOUND;
  return code;
}

export function searchCatalog(
  catalog: CodeCatalogItem[],
  query: string,
  codeSystem?: string,
): CodeCatalogItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return catalog.filter((item) => {
    if (codeSystem && item.codeSystem.toUpperCase() !== codeSystem.toUpperCase()) {
      return false;
    }
    if (!item.active) return false;
    return (
      item.code.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q)
    );
  });
}
