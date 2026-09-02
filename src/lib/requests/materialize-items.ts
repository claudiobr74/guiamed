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
  codeSystem: string;
  at: Date;
  healthInsurerId: string | null;
}): ProcedureCode | null {
  const resolved = resolveProcedureCode(input.codes, input);
  if (!input.requestedId) return resolved;

  const requested = input.codes.find((code) => code.id === input.requestedId) ?? null;
  if (!requested) throw new RequestItemError("Código não localizado na base.");
  const validRequested = resolveProcedureCode([requested], input);
  if (!validRequested) {
    throw new RequestItemError(
      `O código ${requested.code} não está vigente ou não pertence ao procedimento, sistema ou convênio selecionado.`,
    );
  }
  return validRequested;
}

/** Reconstrói snapshots exclusivamente a partir do catálogo confiável do tenant. */
export function materializeRequestItems(input: {
  requestId: string;
  items: RequestItem[];
  procedures: Procedure[];
  codes: ProcedureCode[];
  healthInsurerId: string | null;
  at?: Date;
}): RequestItem[] {
  const at = input.at ?? new Date();
  const procedures = new Map(input.procedures.map((procedure) => [procedure.id, procedure]));
  const seen = new Set<string>();

  return input.items.map((item, index) => {
    if (!item.procedureId) throw new RequestItemError("Selecione um procedimento cadastrado.");
    const procedure = procedures.get(item.procedureId);
    if (!procedure?.active) throw new RequestItemError("Procedimento não localizado ou inativo.");
    if (seen.has(item.id)) throw new RequestItemError("Item de procedimento duplicado na guia.");
    seen.add(item.id);

    const tuss = resolveRequestedOrDefault({ codes: input.codes, requestedId: item.tussCodeId, procedureId: procedure.id, codeSystem: "TUSS", at, healthInsurerId: input.healthInsurerId });
    const ipasgo = resolveRequestedOrDefault({ codes: input.codes, requestedId: item.ipasgoCodeId, procedureId: procedure.id, codeSystem: "IPASGO", at, healthInsurerId: input.healthInsurerId });

    return {
      ...item,
      requestId: input.requestId,
      procedureName: procedure.name,
      tussCodeId: tuss?.id ?? null,
      ipasgoCodeId: ipasgo?.id ?? null,
      tussCodeSnapshot: tuss?.code ?? null,
      ipasgoCodeSnapshot: ipasgo?.code ?? null,
      tussDescriptionSnapshot: tuss?.description ?? null,
      ipasgoDescriptionSnapshot: ipasgo?.description ?? null,
      tussVersionSnapshot: tuss?.version ?? null,
      ipasgoVersionSnapshot: ipasgo?.version ?? null,
      quantity: parseQuantity(item.quantity),
      sortOrder: index,
    };
  });
}
