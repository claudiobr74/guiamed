import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { parseCodeImportBytes } from "@/lib/import-file-parser";

describe("parser de arquivo de importação", () => {
  it("lê somente o intervalo de bytes recebido de uma planilha XLSX", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("TUSS");
    sheet.addRow(["code", "description", "version"]);
    sheet.addRow(["00123456", "Procedimento sintético", "2026.1"]);

    const serialized = await workbook.xlsx.writeBuffer();
    const payload = new Uint8Array(serialized);
    const wrapped = new Uint8Array(payload.byteLength + 8);
    wrapped.set(payload, 4);

    const result = await parseCodeImportBytes(
      "tuss.xlsx",
      wrapped.subarray(4, 4 + payload.byteLength),
    );

    expect(result.format).toBe("xlsx");
    expect(result.rows[0]).toMatchObject({
      code: "00123456",
      description: "Procedimento sintético",
      version: "2026.1",
    });
  });
});
