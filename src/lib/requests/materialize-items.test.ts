import { describe, expect, it } from "vitest";
import { materializeRequestItems } from "@/lib/requests/materialize-items";
import type { Procedure, ProcedureCode, RequestItem } from "@/types/domain";

const TABLE_KEY = "unimed-go";

const code = (id: string, system: string, value: string, quantity: number): ProcedureCode => ({
  id,
  procedureId: "procedure-1",
  codeSystem: system,
  code: value,
  description: `${system} oficial sintético`,
  validFrom: "2026-01-01",
  validUntil: null,
  version: "2026.1",
  active: true,
  tableKey: system === "TUSS" ? TABLE_KEY : null,
  tableName: system === "TUSS" ? "Unimed Goiânia" : null,
  healthInsurerId: null,
  defaultQuantity: quantity,
  metadata: {},
});

const codes = [
  code("tuss-1", "TUSS", "TEST-TUSS", 1),
  code("ipasgo-legacy", "IPASGO", "TEST-IPASGO", 1),
];
const procedures: Procedure[] = [{
  id: "procedure-1",
  organizationId: "org-1",
  name: "Procedimento sintético",
  description: null,
  specialty: null,
  category: null,
  active: true,
  synonyms: [],
  codes,
}];
const item: RequestItem = {
  id: "item-1",
  requestId: "client-value",
  procedureId: "procedure-1",
  procedureName: "Nome adulterado",
  tussCodeId: null,
  ipasgoCodeId: "ipasgo-legacy",
  tussCodeSnapshot: "ADULTERADO",
  ipasgoCodeSnapshot: "ADULTERADO",
  quantity: 2,
  laterality: null,
  notes: null,
  sortOrder: 99,
};

describe("materialização server-side dos procedimentos", () => {
  it("substitui nomes e snapshots pelo catálogo da Tabela TUSS escolhida", () => {
    expect(materializeRequestItems({
      requestId: "request-1",
      items: [item],
      procedures,
      codes,
      healthInsurerId: null,
      tussTableKey: TABLE_KEY,
      at: new Date("2026-09-02T12:00:00Z"),
    })[0]).toMatchObject({
      requestId: "request-1",
      procedureName: "Procedimento sintético",
      tussCodeId: "tuss-1",
      tussCodeSnapshot: "TEST-TUSS",
      ipasgoCodeId: null,
      ipasgoCodeSnapshot: null,
      quantity: 2,
      sortOrder: 0,
    });
  });

  it("exige Tabela TUSS quando há procedimentos", () => {
    expect(() => materializeRequestItems({
      requestId: "request-1",
      items: [item],
      procedures,
      codes,
      healthInsurerId: null,
    })).toThrow("Selecione a Tabela TUSS");
  });

  it("rejeita código solicitado de outro procedimento", () => {
    const malicious = { ...item, tussCodeId: "other-code" };
    const foreign = { ...codes[0], id: "other-code", procedureId: "procedure-2" };
    expect(() => materializeRequestItems({
      requestId: "request-1",
      items: [malicious],
      procedures,
      codes: [...codes, foreign],
      healthInsurerId: null,
      tussTableKey: TABLE_KEY,
      at: new Date("2026-09-02T12:00:00Z"),
    })).toThrow("não está vinculado ao procedimento");
  });

  it("rejeita código de outra Tabela TUSS mesmo quando o cliente envia o id", () => {
    const otherTableCode = { ...codes[0], id: "other-table-code", tableKey: "outra-tabela", code: "OTHER-TUSS" };
    expect(() => materializeRequestItems({
      requestId: "request-1",
      items: [{ ...item, tussCodeId: otherTableCode.id }],
      procedures,
      codes: [...codes, otherTableCode],
      healthInsurerId: null,
      tussTableKey: TABLE_KEY,
      at: new Date("2026-09-02T12:00:00Z"),
    })).toThrow("não pertence à Tabela TUSS escolhida");
  });

  it.each([0, -1, 1.5])("rejeita quantidade inválida %s", (quantity) => {
    expect(() => materializeRequestItems({
      requestId: "request-1",
      items: [{ ...item, quantity }],
      procedures,
      codes,
      healthInsurerId: null,
      tussTableKey: TABLE_KEY,
    })).toThrow("quantidade");
  });

  it("aplica kit com três procedimentos, TUSS da tabela escolhida e quantidades 1, 2 e 4", () => {
    const kitProcedures = [1, 2, 3].map((number) => ({
      ...procedures[0],
      id: `procedure-${number}`,
      name: `Procedimento sintético ${number}`,
      codes: [],
    }));
    const kitCodes = kitProcedures.map((procedure, index) => ({
      ...codes[0],
      id: `tuss-${index + 1}`,
      procedureId: procedure.id,
      code: `TEST-TUSS-${index + 1}`,
    }));
    const kitItems = ([1, 2, 4] as const).map((quantity, index) => ({
      ...item,
      id: `item-${index + 1}`,
      procedureId: kitProcedures[index].id,
      quantity,
    }));

    const result = materializeRequestItems({
      requestId: "request-kit",
      items: kitItems,
      procedures: kitProcedures,
      codes: kitCodes,
      healthInsurerId: null,
      tussTableKey: TABLE_KEY,
      at: new Date("2026-09-02T12:00:00Z"),
    });
    expect(result.map((entry) => entry.quantity)).toEqual([1, 2, 4]);
    expect(result.map((entry) => entry.tussCodeSnapshot)).toEqual(["TEST-TUSS-1", "TEST-TUSS-2", "TEST-TUSS-3"]);
    expect(result.map((entry) => entry.ipasgoCodeSnapshot)).toEqual([null, null, null]);
  });
});
