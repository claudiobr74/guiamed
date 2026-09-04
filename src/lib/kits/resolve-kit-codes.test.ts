import { describe, expect, it } from "vitest";
import { resolveKitItemCodes, resolveKitItemTussCode } from "@/lib/kits/resolve-kit-codes";
import type { Procedure, ProcedureKitItem } from "@/types/domain";

const procedure: Procedure = {
  id: "procedure-1",
  organizationId: "org-1",
  name: "Procedimento sintético",
  description: null,
  specialty: null,
  category: null,
  active: true,
  synonyms: [],
  codes: [
    {
      id: "tuss-general-new",
      procedureId: "procedure-1",
      codeSystem: "TUSS",
      code: "10000003",
      description: "TUSS geral mais novo",
      version: "2026.2",
      validFrom: "2026-07-01",
      validUntil: null,
      active: true,
      tableKey: "unimed-go",
      tableName: "Unimed Goiânia",
      healthInsurerId: null,
      defaultQuantity: 1,
      metadata: {},
    },
    {
      id: "tuss-preferred",
      procedureId: "procedure-1",
      codeSystem: "TUSS",
      code: "10000002",
      description: "TUSS preferencial do kit",
      version: "2026.1",
      validFrom: "2026-01-01",
      validUntil: null,
      active: true,
      tableKey: "unimed-go",
      tableName: "Unimed Goiânia",
      healthInsurerId: null,
      defaultQuantity: 2,
      metadata: {},
    },
    {
      id: "tuss-other-table",
      procedureId: "procedure-1",
      codeSystem: "TUSS",
      code: "90000001",
      description: "TUSS preferencial de outra tabela",
      version: "2026.9",
      validFrom: "2026-01-01",
      validUntil: null,
      active: true,
      tableKey: "outra-tabela",
      tableName: "Outra Tabela",
      healthInsurerId: null,
      defaultQuantity: 9,
      metadata: {},
    },
    {
      id: "ipasgo-general",
      procedureId: "procedure-1",
      codeSystem: "IPASGO",
      code: "500001",
      description: "IPASGO geral",
      version: "2026.2",
      validFrom: "2026-01-01",
      validUntil: null,
      active: true,
      healthInsurerId: null,
      defaultQuantity: 1,
      metadata: {},
    },
    {
      id: "ipasgo-inactive",
      procedureId: "procedure-1",
      codeSystem: "IPASGO",
      code: "500000",
      description: "IPASGO antigo",
      version: "2025.1",
      validFrom: "2025-01-01",
      validUntil: "2025-12-31",
      active: true,
      healthInsurerId: null,
      defaultQuantity: 4,
      metadata: {},
    },
  ],
};

function item(defaultCodeId: string | null): ProcedureKitItem {
  return {
    id: "item-1",
    kitId: "kit-1",
    procedureId: procedure.id,
    procedureName: procedure.name,
    defaultQuantity: 2,
    defaultCodeId,
    notes: null,
    sortOrder: 0,
  };
}

describe("resolveKitItemCodes", () => {
  it("preserva TUSS preferencial do kit e resolve IPASGO separadamente no modo legado", () => {
    const result = resolveKitItemCodes({
      procedure,
      item: item("tuss-preferred"),
      healthInsurerId: null,
      at: new Date("2026-09-03T15:00:00-03:00"),
    });
    expect(result.tuss?.id).toBe("tuss-preferred");
    expect(result.ipasgo?.id).toBe("ipasgo-general");
  });

  it("preserva IPASGO preferencial sem reutilizá-lo como TUSS no modo legado", () => {
    const result = resolveKitItemCodes({
      procedure,
      item: item("ipasgo-general"),
      healthInsurerId: null,
      at: new Date("2026-09-03T15:00:00-03:00"),
    });
    expect(result.ipasgo?.id).toBe("ipasgo-general");
    expect(result.tuss?.id).toBe("tuss-other-table");
  });

  it("abandona preferência expirada e usa o resolvedor do mesmo sistema no modo legado", () => {
    const result = resolveKitItemCodes({
      procedure,
      item: item("ipasgo-inactive"),
      healthInsurerId: null,
      at: new Date("2026-09-03T15:00:00-03:00"),
    });
    expect(result.ipasgo?.id).toBe("ipasgo-general");
    expect(result.tuss?.id).toBe("tuss-other-table");
  });

  it("sem preferência usa somente a resolução determinística no modo legado", () => {
    const result = resolveKitItemCodes({
      procedure,
      item: item(null),
      healthInsurerId: null,
      at: new Date("2026-09-03T15:00:00-03:00"),
    });
    expect(result.tuss?.id).toBe("tuss-other-table");
    expect(result.ipasgo?.id).toBe("ipasgo-general");
  });
});

describe("resolveKitItemTussCode", () => {
  it("preserva preferência quando ela pertence à tabela escolhida", () => {
    const result = resolveKitItemTussCode({
      procedure,
      item: item("tuss-preferred"),
      healthInsurerId: null,
      tableKey: "unimed-go",
      at: new Date("2026-09-03T15:00:00-03:00"),
    });
    expect(result?.id).toBe("tuss-preferred");
  });

  it("ignora preferência de outra tabela e resolve dentro da tabela escolhida", () => {
    const result = resolveKitItemTussCode({
      procedure,
      item: item("tuss-other-table"),
      healthInsurerId: null,
      tableKey: "unimed-go",
      at: new Date("2026-09-03T15:00:00-03:00"),
    });
    expect(result?.id).toBe("tuss-general-new");
  });
});
