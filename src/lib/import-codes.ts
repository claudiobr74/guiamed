export interface ImportRow {
  code_system?: string;
  code?: string;
  description?: string;
  version?: string;
  valid_from?: string;
  valid_until?: string;
  procedure_name?: string;
  active?: string | boolean;
}

export interface ImportIssue {
  row: number;
  field: string;
  message: string;
}

export interface NormalizedImportRow {
  codeSystem: string;
  code: string;
  description: string;
  version: string;
  validFrom: string | null;
  validUntil: string | null;
  procedureName: string | null;
  active: boolean;
}

export interface ImportValidation {
  rows: NormalizedImportRow[];
  issues: ImportIssue[];
}

const REQUIRED = ["code", "description", "version"] as const;

export function validateImportRows(
  rows: ImportRow[],
  defaultSystem: string,
): ImportValidation {
  const issues: ImportIssue[] = [];
  const seen = new Map<string, number>();
  const normalized: NormalizedImportRow[] = [];

  rows.forEach((raw, index) => {
    const row = index + 1;
    const codeSystem = String(raw.code_system ?? defaultSystem).trim().toUpperCase();
    const code = String(raw.code ?? "").trim();
    const description = String(raw.description ?? "").trim();
    const version = String(raw.version ?? "").trim();

    if (!code) issues.push({ row, field: "code", message: "Código ausente." });
    if (!description) issues.push({ row, field: "description", message: "Descrição ausente." });
    if (!version) issues.push({ row, field: "version", message: "Versão inválida." });
    if (!codeSystem) issues.push({ row, field: "code_system", message: "Sistema de código ausente." });

    const key = `${codeSystem}|${code}|${version}`;
    if (code && version) {
      const prev = seen.get(key);
      if (prev) {
        issues.push({
          row,
          field: "code",
          message: `Código duplicado na importação (linha ${prev}).`,
        });
      } else {
        seen.set(key, row);
      }
    }

    normalized.push({
      codeSystem,
      code,
      description,
      version,
      validFrom: raw.valid_from ? String(raw.valid_from) : null,
      validUntil: raw.valid_until ? String(raw.valid_until) : null,
      procedureName: raw.procedure_name ? String(raw.procedure_name).trim() : null,
      active: raw.active === false || raw.active === "false" ? false : true,
    });
  });

  return { rows: normalized, issues };
}

const HEADER_TO_FIELD: Record<string, keyof ImportRow> = {
  code: "code",
  codigo: "code",
  tuss: "code",
  cd_tuss: "code",
  cod_tuss: "code",
  cd_procedimento: "code",
  cod_procedimento: "code",
  description: "description",
  descricao: "description",
  desc: "description",
  version: "version",
  versao: "version",
  code_system: "code_system",
  sistema: "code_system",
  valid_from: "valid_from",
  vigencia: "valid_from",
  valid_until: "valid_until",
  procedure_name: "procedure_name",
  active: "active",
};

export function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export function cellText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "object") {
    const obj = value as { richText?: Array<{ text?: string }>; text?: string; result?: unknown };
    if (Array.isArray(obj.richText)) {
      return obj.richText.map((part) => part.text ?? "").join("").trim();
    }
    if (typeof obj.text === "string") return obj.text.trim();
    if ("result" in obj) return cellText(obj.result);
  }
  return "";
}

export function extractVigencia(text: string): string | null {
  const match = text.match(/vig[eê]ncia\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})/i);
  if (!match) return null;
  const day = match[1].padStart(2, "0");
  const month = match[2].padStart(2, "0");
  const year = match[3].length === 2 ? `20${match[3]}` : match[3];
  return `${year}-${month}-${day}`;
}

export function normalizeProcedureCode(raw: string): string {
  const trimmed = raw.trim();
  if (/^\d+\.0+$/.test(trimmed)) return trimmed.replace(/\.0+$/, "");
  if (/^\d{5,10}$/.test(trimmed)) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  if (/^\d{8}$/.test(digits)) return digits;
  return trimmed;
}

function looksLikeProcedureCode(code: string): boolean {
  return /^\d{5,10}$/.test(code);
}

function detectHeader(matrix: string[][]): { index: number; map: Map<number, keyof ImportRow> } | null {
  const limit = Math.min(matrix.length, 40);
  for (let i = 0; i < limit; i += 1) {
    const map = new Map<number, keyof ImportRow>();
    (matrix[i] ?? []).forEach((cell, col) => {
      const field = HEADER_TO_FIELD[normalizeHeader(cell)];
      if (field) map.set(col, field);
    });
    const fields = [...map.values()];
    const hasDesc = fields.includes("description") || (matrix[i] ?? []).some((c) => normalizeHeader(c) === "descricao");
    if (hasDesc && !fields.includes("code")) {
      map.set(0, "code");
    }
    if ([...map.values()].includes("code") && [...map.values()].includes("description")) {
      return { index: i, map };
    }
  }
  return null;
}

function detectTussColumns(matrix: string[][]): { index: number; codeCol: number; descCol: number } | null {
  for (let i = 0; i < matrix.length; i += 1) {
    const row = matrix[i] ?? [];
    for (let col = 0; col < row.length; col += 1) {
      const code = normalizeProcedureCode(row[col] ?? "");
      if (!looksLikeProcedureCode(code)) continue;
      const right = (row[col + 1] ?? "").trim();
      const left = col > 0 ? (row[col - 1] ?? "").trim() : "";
      if (right.length >= 4 && !looksLikeProcedureCode(normalizeProcedureCode(right))) {
        return { index: i, codeCol: col, descCol: col + 1 };
      }
      if (left.length >= 4 && !looksLikeProcedureCode(normalizeProcedureCode(left))) {
        return { index: i, codeCol: col, descCol: col - 1 };
      }
    }
  }
  return null;
}

export function parseSheetMatrix(matrix: string[][]): ImportRow[] {
  if (matrix.length === 0) return [];
  const vigencia = matrix.map((row) => extractVigencia(row.join(" "))).find(Boolean) ?? null;
  const header = detectHeader(matrix);
  const rows: ImportRow[] = [];

  if (header) {
    for (const raw of matrix.slice(header.index + 1)) {
      const obj: ImportRow = {};
      header.map.forEach((field, col) => {
        const value = (raw[col] ?? "").trim();
        if (field === "active") obj.active = value;
        else obj[field] = value;
      });
      if (obj.code) obj.code = normalizeProcedureCode(obj.code);
      if (vigencia && !obj.valid_from) obj.valid_from = vigencia;
      if (!obj.code && !obj.description) continue;
      if (!obj.code && obj.description) continue;
      rows.push(obj);
    }
    return rows;
  }

  const tuss = detectTussColumns(matrix);
  if (!tuss) return [];
  for (const raw of matrix.slice(tuss.index)) {
    const code = normalizeProcedureCode(raw[tuss.codeCol] ?? "");
    const description = (raw[tuss.descCol] ?? "").trim();
    if (!looksLikeProcedureCode(code) || !description) continue;
    rows.push({
      code,
      description,
      valid_from: vigencia ?? undefined,
    });
  }
  return rows;
}

export function parseCsv(text: string): ImportRow[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];
  const commaColumns = splitCsvLine(lines[0], ",").length;
  const semicolonColumns = splitCsvLine(lines[0], ";").length;
  const delimiter = semicolonColumns > commaColumns ? ";" : ",";
  return parseSheetMatrix(lines.map((line) => splitCsvLine(line, delimiter)));
}

function splitCsvLine(line: string, delimiter: "," | ";"): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

export { REQUIRED };
