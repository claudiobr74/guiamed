import { describe, expect, it } from "vitest";
import { codeTableKey, normalizeCodeTableName, procedureCodeDocumentId } from "@/lib/code-table";

describe("TUSS table identity", () => {
  it("normalizes display names without losing accents", () => {
    expect(normalizeCodeTableName("  Unimed   Goiânia  ")).toBe("Unimed Goiânia");
    expect(codeTableKey("Unimed Goiânia")).toBe("unimed-goiania");
  });

  it("keeps equal codes from different tables isolated", () => {
    const unimed = procedureCodeDocumentId({
      codeSystem: "TUSS",
      tableKey: "unimed-goiania",
      code: "30715016",
      version: "2026.1",
    });
    const ipasgo = procedureCodeDocumentId({
      codeSystem: "TUSS",
      tableKey: "ipasgo",
      code: "30715016",
      version: "2026.1",
    });
    expect(unimed).not.toBe(ipasgo);
  });

  it("preserves the legacy document id shape when no table is informed", () => {
    expect(procedureCodeDocumentId({ codeSystem: "IPASGO", code: "123", version: "1" }))
      .toBe("IPASGO_123_1");
  });
});
