import { CODE_NOT_FOUND, type ProcedureCode } from "@/types/domain";
import { parseQuantity } from "@/lib/quantity";

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

export const DEFAULT_CLINICAL_TIME_ZONE = "America/Sao_Paulo";

function calendarDate(at: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
}

/** Vigência é inclusiva e comparada por data clínica, nunca por meia-noite UTC. */
export function isCodeValidOn(
  item: CodeCatalogItem,
  at: Date,
  timeZone: string = DEFAULT_CLINICAL_TIME_ZONE,
): boolean {
  if (!item.active) return false;
  const clinicalDate = calendarDate(at, timeZone);
  if (item.validFrom && item.validFrom > clinicalDate) return false;
  if (item.validUntil && item.validUntil < clinicalDate) return false;
  return true;
}

function versionParts(version: string): Array<string | number> {
  return version.split(/([0-9]+)/).filter(Boolean).map((part) => /^\d+$/.test(part) ? Number(part) : part.toLocaleLowerCase("pt-BR"));
}

function compareVersionsDesc(a: string, b: string): number {
  const left = versionParts(a);
  const right = versionParts(b);
  const size = Math.max(left.length, right.length);
  for (let index = 0; index < size; index += 1) {
    const av = left[index];
    const bv = right[index];
    if (av === bv) continue;
    if (av === undefined) return 1;
    if (bv === undefined) return -1;
    if (typeof av === "number" && typeof bv === "number") return bv - av;
    return String(bv).localeCompare(String(av), "pt-BR", { numeric: true });
  }
  return 0;
}

/** Resolve somente vínculos explícitos; nunca substitui um sistema por outro. */
export function resolveProcedureCode(
  codes: ProcedureCode[],
  input: { procedureId: string; codeSystem: string; at?: Date; healthInsurerId?: string | null; timeZone?: string },
): ProcedureCode | null {
  const at = input.at ?? new Date();
  const system = input.codeSystem.toUpperCase();
  const candidates = codes.filter((code) =>
    code.procedureId === input.procedureId &&
    code.codeSystem.toUpperCase() === system &&
    isCodeValidOn(code, at, input.timeZone) &&
    (code.healthInsurerId === null || code.healthInsurerId === input.healthInsurerId),
  );

  return candidates.toSorted((a, b) => {
    const insurerPriority = Number(b.healthInsurerId !== null) - Number(a.healthInsurerId !== null);
    if (insurerPriority !== 0) return insurerPriority;
    const versionOrder = compareVersionsDesc(a.version, b.version);
    if (versionOrder !== 0) return versionOrder;
    const fromOrder = (b.validFrom ?? "").localeCompare(a.validFrom ?? "");
    if (fromOrder !== 0) return fromOrder;
    return a.id.localeCompare(b.id);
  })[0] ?? null;
}

export function quantityForCodes(...codes: Array<ProcedureCode | null | undefined>): number {
  const configured = codes.find((code) => code?.defaultQuantity !== undefined)?.defaultQuantity;
  return parseQuantity(configured);
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
