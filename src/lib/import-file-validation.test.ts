import { describe, expect, it } from "vitest";
import {
  MAX_CODE_IMPORT_FILE_BYTES,
  safeCodeImportFileError,
  validateCodeImportFileMetadata,
} from "@/lib/import-file-validation";

describe("validação de arquivo de importação de códigos", () => {
  it("aceita CSV, XLSX e JSON dentro do limite", () => {
    for (const name of ["tuss.csv", "tuss.xlsx", "ipasgo.json"]) {
      expect(() => validateCodeImportFileMetadata({ name, size: 1024 })).not.toThrow();
    }
  });

  it("rejeita arquivo vazio, extensão inválida e arquivo acima de 3 MB", () => {
    expect(() => validateCodeImportFileMetadata({ name: "tuss.csv", size: 0 })).toThrow(/vazio/i);
    expect(() => validateCodeImportFileMetadata({ name: "tuss.xls", size: 1024 })).toThrow(/CSV, XLSX ou JSON/i);
    expect(() =>
      validateCodeImportFileMetadata({ name: "tuss.xlsx", size: MAX_CODE_IMPORT_FILE_BYTES + 1 }),
    ).toThrow(/3 MB/i);
  });

  it("não expõe erro técnico desconhecido ao usuário", () => {
    expect(safeCodeImportFileError(new Error("FirebaseError: internal stack"))).toBe(
      "Não foi possível processar o arquivo. Confira o formato e tente novamente.",
    );
    expect(safeCodeImportFileError(new Error("Planilha vazia."))).toBe("Planilha vazia.");
  });
});
