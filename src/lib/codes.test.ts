import { describe, expect, it } from "vitest";
import { CODE_NOT_FOUND } from "@/types/domain";
import { isCodeValidOn, lookupCode, quantityForCodes, resolveProcedureCode, type CodeCatalogItem } from "@/lib/codes";
import type { ProcedureCode } from "@/types/domain";

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

const linkedCodes: ProcedureCode[] = [
  { id: "general-new", procedureId: "procedure-1", codeSystem: "TUSS", code: "00000003", description: "Versão geral nova", version: "2026.2", validFrom: "2026-07-01", validUntil: null, active: true, healthInsurerId: null, defaultQuantity: 2, metadata: {} },
  { id: "general-old", procedureId: "procedure-1", codeSystem: "TUSS", code: "00000002", description: "Versão geral antiga", version: "2026.1", validFrom: "2026-01-01", validUntil: "2026-06-30", active: true, healthInsurerId: null, defaultQuantity: 1, metadata: {} },
  { id: "insurer", procedureId: "procedure-1", codeSystem: "TUSS", code: "00000004", description: "Código específico", version: "2026.1", validFrom: "2026-01-01", validUntil: null, active: true, healthInsurerId: "insurer-1", defaultQuantity: 4, metadata: {} },
  { id: "other-system", procedureId: "procedure-1", codeSystem: "IPASGO", code: "900001", description: "Outro sistema", version: "2026.1", validFrom: null, validUntil: null, active: true, healthInsurerId: null, defaultQuantity: 3, metadata: {} },
];

describe("resolvedor determinístico de códigos", () => {
  it("seleciona a versão vigente mais recente", () => {
    expect(resolveProcedureCode(linkedCodes, { procedureId: "procedure-1", codeSystem: "TUSS", at: new Date("2026-08-01") })?.id).toBe("general-new");
  });

  it("prioriza código específico da operadora sem vazar para outra operadora", () => {
    expect(resolveProcedureCode(linkedCodes, { procedureId: "procedure-1", codeSystem: "TUSS", at: new Date("2026-08-01"), healthInsurerId: "insurer-1" })?.id).toBe("insurer");
    expect(resolveProcedureCode(linkedCodes, { procedureId: "procedure-1", codeSystem: "TUSS", at: new Date("2026-08-01"), healthInsurerId: "insurer-2" })?.id).toBe("general-new");
  });

  it("não reutiliza código de outro sistema", () => {
    expect(resolveProcedureCode(linkedCodes, { procedureId: "procedure-1", codeSystem: "CBHPM", at: new Date("2026-08-01") })).toBeNull();
  });

  it("usa a quantidade positiva configurada no código", () => {
    expect(quantityForCodes(linkedCodes[2])).toBe(4);
    expect(quantityForCodes()).toBe(1);
  });

  it("mantém validUntil inclusivo durante todo o dia clínico mesmo após a virada UTC", () => {
    const oldCode = linkedCodes.find((code) => code.id === "general-old")!;
    const instant = new Date("2026-07-01T01:30:00.000Z"); // 30/06 22:30 em São Paulo
    expect(isCodeValidOn(oldCode, instant)).toBe(true);
  });

  it("não antecipa validFrom por causa da meia-noite UTC", () => {
    const newCode = linkedCodes.find((code) => code.id === "general-new")!;
    const instant = new Date("2026-07-01T01:30:00.000Z"); // ainda 30/06 em São Paulo
    expect(isCodeValidOn(newCode, instant)).toBe(false);
  });

  it("troca para a nova vigência quando o dia clínico realmente começa", () => {
    const instant = new Date("2026-07-01T03:30:00.000Z"); // 01/07 00:30 em São Paulo
    expect(resolveProcedureCode(linkedCodes, { procedureId: "procedure-1", codeSystem: "TUSS", at: instant })?.id).toBe("general-new");
  });
});
