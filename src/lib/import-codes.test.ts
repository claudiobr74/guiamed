import { describe, expect, it } from "vitest";
import { parseCsv, parseSheetMatrix, validateImportRows } from "@/lib/import-codes";
import { summarizeImportDiff } from "@/lib/import-diff";
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

  it("lê tabela Unimed/Aurum com título, vigência e DESCRIÇÃO", () => {
    const rows = parseSheetMatrix([
      ["Tabela Referência para Reembolso"],
      ["Vigência 01/02/2022"],
      [],
      ["", "", "0,65", "1"],
      ["", "DESCRIÇÃO", "HM", "CO", "Valor Referência Reembolso"],
      ["40301320", "AMONIA, DOSAGEM, SANGUE", "R$ 3,90", "R$ 4,00"],
      ["40301338", "FERRO SERICO, DOSAGEM", "R$ 4,10", "-"],
      ["", "GRUPO EXAMES"],
      ["40302000.0", "GLICOSE, DOSAGEM", "R$ 2,00"],
    ]);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      code: "40301320",
      description: "AMONIA, DOSAGEM, SANGUE",
      valid_from: "2022-02-01",
    });
    expect(rows[2]?.code).toBe("40302000");
  });

  it("resume a diferença sem inventar conflitos", () => {
    const diff = summarizeImportDiff(
      [
        { codeSystem: "TUSS", code: "1", description: "Novo", version: "2026.1", validFrom: null, validUntil: null, procedureName: null, active: true },
        { codeSystem: "TUSS", code: "2", description: "Alterado", version: "2026.1", validFrom: null, validUntil: null, procedureName: null, active: true },
        { codeSystem: "TUSS", code: "3", description: "Igual", version: "2026.1", validFrom: null, validUntil: null, procedureName: null, active: true },
        { codeSystem: "TUSS", code: "4", description: "Velho", version: "2026.1", validFrom: null, validUntil: null, procedureName: null, active: false },
      ],
      [
        { codeSystem: "TUSS", code: "2", version: "2026.1", description: "Antigo", active: true },
        { codeSystem: "TUSS", code: "3", version: "2026.1", description: "Igual", active: true },
        { codeSystem: "TUSS", code: "4", version: "2026.1", description: "Velho", active: true },
      ],
    );
    expect(diff.inserted).toBe(1);
    expect(diff.descriptionChanged).toBe(1);
    expect(diff.unchanged).toBe(1);
    expect(diff.discontinued).toBe(1);
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

  it("inclui apenas sintomas informados", () => {
    const text = buildJustificationDraft({ symptoms: "cervicalgia irradiada" });
    expect(text).toContain("cervicalgia irradiada");
    expect(text.toLowerCase()).not.toContain("provavelmente");
  });
});
