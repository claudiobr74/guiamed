import { describe, expect, it } from "vitest";
import { parseCsv, validateImportRows } from "@/lib/import-codes";
import { suggestSemanticField } from "@/lib/mapping-suggest";
import { buildJustificationDraft } from "@/lib/justification";

describe("importação", () => {
  it("detecta duplicata e código ausente", () => {
    const result = validateImportRows(
      [
        { code: "1", description: "A", version: "1" },
        { code: "1", description: "A", version: "1" },
        { code: "", description: "", version: "" },
      ],
      "TUSS",
    );
    expect(result.issues.some((i) => i.message.includes("duplicado"))).toBe(true);
    expect(result.issues.some((i) => i.message.includes("ausente"))).toBe(true);
  });

  it("csv", () => {
    const rows = parseCsv("code,description,version\n1,Teste,2026.1");
    expect(rows[0]?.code).toBe("1");
  });
});

describe("mapeamento", () => {
  it("sugere paciente", () => {
    expect(suggestSemanticField("nome_paciente")).toBe("patient.full_name");
  });
});

describe("justificativa", () => {
  it("não inventa fatos", () => {
    const text = buildJustificationDraft({ diagnosis: "hérnia de disco" });
    expect(text).toContain("hérnia de disco");
    expect(text.toLowerCase()).not.toContain("provavelmente");
  });
});
