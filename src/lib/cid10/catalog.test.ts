import { describe, expect, it } from "vitest";
import {
  CID10_METADATA,
  getCid10ByCode,
  normalizeRequestCids,
  searchCid10,
} from "@/lib/cid10/catalog";

describe("catálogo CID-10 DATASUS", () => {
  it("carrega exatamente as 12.451 categorias e subcategorias codificáveis", () => {
    expect(CID10_METADATA.version).toBe("DATASUS V2008");
    expect(CID10_METADATA.recordCount).toBe(12_451);
    expect(CID10_METADATA.sourceFileSha256).toBe(
      "1a85bef8f2065ad3e95ab07b6441e6f03404c54ab35849ebd4edccc3ba234e60",
    );
  });

  it("resolve códigos com ou sem ponto sem inventar correspondências", () => {
    expect(getCid10ByCode("M54.5")).toMatchObject({
      id: "M545",
      code: "M54.5",
      description: "Dor lombar baixa",
      version: "DATASUS V2008",
    });
    expect(getCid10ByCode("m545")?.code).toBe("M54.5");
    expect(getCid10ByCode("ZZZ9")).toBeNull();
  });

  it("busca por código e descrição sem depender de acentos", () => {
    expect(searchCid10("A000", 1)[0]).toMatchObject({
      code: "A00.0",
      description: "Cólera devida a Vibrio cholerae 01, biótipo cholerae",
    });
    expect(searchCid10("colera vibrio El Tor").some((cid) => cid.code === "A00.1")).toBe(true);
    expect(searchCid10("dor lombar").some((cid) => cid.code === "M54.5")).toBe(true);
  });

  it("normaliza o snapshot e rejeita código ausente ou duplicado", () => {
    const normalized = normalizeRequestCids([
      {
        id: "selection-1",
        requestId: "outro",
        cidCodeId: null,
        codeSnapshot: "m545",
        descriptionSnapshot: "texto adulterado",
        sortOrder: 7,
      },
    ], "request-1");

    expect(normalized[0]).toMatchObject({
      requestId: "request-1",
      cidCodeId: "M545",
      codeSnapshot: "M54.5",
      descriptionSnapshot: "Dor lombar baixa",
      sortOrder: 0,
    });
    expect(() => normalizeRequestCids([
      { ...normalized[0], codeSnapshot: "Z99.999" },
    ], "request-1")).toThrow("não localizado");
    expect(() => normalizeRequestCids([normalized[0], normalized[0]], "request-1")).toThrow(
      "selecionado mais de uma vez",
    );
  });
});
