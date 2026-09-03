import { describe, expect, it } from "vitest";
import {
  CODE_IMPORT_CHUNK_BYTES,
  MAX_CODE_IMPORT_CHUNKS,
  MAX_CODE_IMPORT_FILE_BYTES,
  codeImportChunkBounds,
  codeImportChunkCount,
  codeImportSessionExpired,
  safeCodeImportFileError,
  validateCodeImportFileMetadata,
} from "@/lib/import-file-validation";

describe("validação de arquivo de importação de códigos", () => {
  it("aceita CSV, XLSX e JSON dentro do limite", () => {
    for (const name of ["tuss.csv", "tuss.xlsx", "ipasgo.json"]) {
      expect(() => validateCodeImportFileMetadata({ name, size: 1024 })).not.toThrow();
    }
  });

  it("rejeita arquivo vazio, extensão inválida e arquivo acima de 20 MB", () => {
    expect(() => validateCodeImportFileMetadata({ name: "tuss.csv", size: 0 })).toThrow(/vazio/i);
    expect(() => validateCodeImportFileMetadata({ name: "tuss.xls", size: 1024 })).toThrow(/CSV, XLSX ou JSON/i);
    expect(() =>
      validateCodeImportFileMetadata({ name: "tuss.xlsx", size: MAX_CODE_IMPORT_FILE_BYTES + 1 }),
    ).toThrow(/20 MB/i);
  });

  it("divide arquivos grandes em partes de no máximo 3 MB", () => {
    const count = codeImportChunkCount(MAX_CODE_IMPORT_FILE_BYTES);
    expect(count).toBe(MAX_CODE_IMPORT_CHUNKS);
    let total = 0;
    for (let index = 0; index < count; index += 1) {
      const chunk = codeImportChunkBounds(MAX_CODE_IMPORT_FILE_BYTES, index);
      expect(chunk.size).toBeGreaterThan(0);
      expect(chunk.size).toBeLessThanOrEqual(CODE_IMPORT_CHUNK_BYTES);
      total += chunk.size;
    }
    expect(total).toBe(MAX_CODE_IMPORT_FILE_BYTES);
  });

  it("expira sessões por timestamp absoluto", () => {
    const now = new Date("2026-09-03T20:00:00.000Z");
    expect(codeImportSessionExpired("2026-09-03T20:00:01.000Z", now)).toBe(false);
    expect(codeImportSessionExpired("2026-09-03T20:00:00.000Z", now)).toBe(true);
    expect(codeImportSessionExpired("invalid", now)).toBe(true);
  });

  it("não expõe erro técnico desconhecido ao usuário", () => {
    expect(safeCodeImportFileError(new Error("FirebaseError: internal stack"))).toBe(
      "Não foi possível processar o arquivo. Confira o formato e tente novamente.",
    );
    expect(safeCodeImportFileError(new Error("Planilha vazia."))).toBe("Planilha vazia.");
  });
});
