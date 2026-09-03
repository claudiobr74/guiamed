import ExcelJS from "exceljs";
import {
  cellText,
  parseCsv,
  parseSheetMatrix,
  validateImportRows,
  type ImportRow,
} from "@/lib/import-codes";

export type CodeImportFormat = "csv" | "xlsx" | "json";

export async function parseCodeImportBytes(
  fileName: string,
  bytes: Uint8Array,
): Promise<{ rows: ImportRow[]; format: CodeImportFormat }> {
  const name = fileName.toLowerCase();
  if (name.endsWith(".json")) {
    const parsed = JSON.parse(new TextDecoder("utf-8").decode(bytes)) as unknown;
    if (!Array.isArray(parsed)) throw new Error("O arquivo JSON deve conter uma lista de códigos.");
    return { rows: parsed as ImportRow[], format: "json" };
  }

  if (name.endsWith(".xlsx")) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(bytes));
    if (workbook.worksheets.length === 0) throw new Error("Planilha vazia.");
    let best: ImportRow[] = [];
    for (const sheet of workbook.worksheets) {
      const matrix: string[][] = [];
      sheet.eachRow({ includeEmpty: true }, (row, index) => {
        const cells: string[] = [];
        row.eachCell({ includeEmpty: true }, (cell, column) => {
          cells[column - 1] = cellText(cell.value);
        });
        matrix[index - 1] = cells;
      });
      const rows = parseSheetMatrix(matrix);
      if (rows.length > best.length) best = rows;
    }
    return { rows: best, format: "xlsx" };
  }

  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    text = new TextDecoder("windows-1252").decode(bytes);
  }
  return { rows: parseCsv(text), format: "csv" };
}

export function normalizeCodeImportRows(
  rows: ImportRow[],
  version: string,
  defaultSystem: string,
) {
  return validateImportRows(
    rows.map((row) => ({
      ...row,
      version: row.version || version,
      code_system: row.code_system || defaultSystem,
    })),
    defaultSystem,
  );
}
