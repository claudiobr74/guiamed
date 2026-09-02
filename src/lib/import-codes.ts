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

export function parseCsv(text: string): ImportRow[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];
  const headers = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cols = splitCsvLine(line);
    const row: ImportRow = {};
    headers.forEach((header, i) => {
      const value = cols[i] ?? "";
      if (header === "code_system") row.code_system = value;
      else if (header === "code") row.code = value;
      else if (header === "description") row.description = value;
      else if (header === "version") row.version = value;
      else if (header === "valid_from") row.valid_from = value;
      else if (header === "valid_until") row.valid_until = value;
      else if (header === "procedure_name") row.procedure_name = value;
      else if (header === "active") row.active = value;
    });
    return row;
  });
}

function splitCsvLine(line: string): string[] {
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
    } else if (ch === "," && !inQuotes) {
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
