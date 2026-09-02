import { describe, expect, it } from "vitest";
import { CODE_NOT_FOUND } from "@/types/domain";
import { lookupCode, type CodeCatalogItem } from "@/lib/codes";

const catalog: CodeCatalogItem[] = [
  {
    id: "1",
    codeSystem: "TUSS",
    code: "30715016",
    description: "Item de catálogo de teste",
    version: "2026.1",
    active: true,
    validFrom: null,
    validUntil: null,
  },
  {
    id: "2",
    codeSystem: "IPASGO",
    code: "501234",
    description: "Item IPASGO de teste",
    version: "2026.1",
    active: true,
    validFrom: null,
    validUntil: null,
  },
  {
    id: "3",
    codeSystem: "TUSS",
    code: "00000000",
    description: "Inativo",
    version: "2020.1",
    active: false,
    validFrom: null,
    validUntil: null,
  },
];

describe("códigos", () => {
  it("TUSS encontrado", () => {
    const result = lookupCode(catalog, "TUSS", "30715016");
    expect(result.found).toBe(true);
  });

  it("IPASGO encontrado", () => {
    const result = lookupCode(catalog, "IPASGO", "501234");
    expect(result.found).toBe(true);
  });

  it("inexistente", () => {
    const result = lookupCode(catalog, "TUSS", "99999999");
    expect(result).toEqual({ found: false, message: CODE_NOT_FOUND });
  });

  it("código inativo", () => {
    const result = lookupCode(catalog, "TUSS", "00000000");
    expect(result.found).toBe(false);
  });
});
