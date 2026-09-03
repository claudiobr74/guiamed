import { resolveProcedureCode } from "@/lib/codes";
import { parseQuantity } from "@/lib/quantity";
import type { Procedure, ProcedureCode, RequestItem } from "@/types/domain";

export class RequestItemError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RequestItemError";
  }
}

function resolveRequestedOrDefault(input: {
  codes: ProcedureCode[];
  requestedId: string | null;
  procedureId: string;
  at: Date;
  healthInsurerId: string | null;
  tableKey: string;
}): ProcedureCode | null {
  const resolveInput = {
    procedureId: input.procedureId,
    codeSystem: "TUSS",
    at: input.at,
    healthInsurerId: input.healthInsurerId,
    tableKey: input.tableKey,
  };
  const resolved = resolveProcedureCode(input.codes, resolveInput);
  if (!input.requestedId) return resolved;

  const requested = input.codes.find((code) => code.id === input.requestedId) ?? null;
  if (!requested) throw new RequestItemError("Código não localizado na base.");
  const validRequested = resolveProcedureCode([requested], resolveInput);
  if (!validRequested) {
    throw new RequestItemError(
      `O código ${requested.code} não pertence à Tabela TUSS escolhida, não está vigente ou não está vinculado ao procedimento.`,
    );
  }
  return validRequested;
}

/**
 * Reconstrói snapshots exclusivamente a partir da Tabela TUSS escolhida manualmente.
 * Não existe fallback para outra tabela e o fluxo novo não materializa IPASGO em paralelo.
 */
export function materializeRequestItems(input: {
  requestId: string;
  items: RequestItem[];
  procedures: Procedure[];
  codes: ProcedureCode[];
  healthInsurerId: string | null;
  tussTableKey?: string | null;
  at?: Date;
}): RequestItem[] {
  if (input.items.length > 0 && !input.tussTableKey?.trim()) {
    throw new RequestItemError("Selecione a Tabela TUSS antes de adicionar procedimentos.");
  }
  const tableKey = input.tussTableKey?.trim() ?? "";
  const at = input.at ?? new Date();
  const procedures = new Map(input.procedures.map((procedure) => [procedure.id, procedure]));
  const seen = new Set<string>();

  return input.items.map((item, index) => {
    if (!item.procedureId) throw new RequestItemError("Selecione um procedimento cadastrado.");
    const procedure = procedures.get(item.procedureId);
    if (!procedure?.active) throw new RequestItemError("Procedimento não localizado ou inativo.");
    if (seen.has(item.id)) throw new RequestItemError("Item de procedimento duplicado na guia.");
    seen.add(item.id);

    const tuss = resolveRequestedOrDefault({
      codes: input.codes,
      requestedId: item.tussCodeId,
      procedureId: procedure.id,
      at,
      healthInsurerId: input.healthInsurerId,
      tableKey,
    });

    return {
      ...item,
      requestId: input.requestId,
      procedureName: procedure.name,
      tussCodeId: tuss?.id ?? null,
      tussCodeSnapshot: tuss?.code ?? null,
      tussDescriptionSnapshot: tuss?.description ?? null,
      tussVersionSnapshot: tuss?.version ?? null,
      // O fluxo novo usa uma Tabela TUSS escolhida. Campos IPASGO ficam vazios.
      ipasgoCodeId: null,
      ipasgoCodeSnapshot: null,
      ipasgoDescriptionSnapshot: null,
      ipasgoVersionSnapshot: null,
      quantity: parseQuantity(item.quantity),
      sortOrder: index,
    };
  });
}
