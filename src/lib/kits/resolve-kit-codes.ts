import { resolveProcedureCode } from "@/lib/codes";
import type { Procedure, ProcedureCode, ProcedureKitItem } from "@/types/domain";

function preferredForSystem(
  procedure: Procedure,
  item: ProcedureKitItem,
  codeSystem: string,
  at: Date,
  healthInsurerId: string | null,
  tableKey?: string | null,
): ProcedureCode | null {
  if (!item.defaultCodeId) return null;
  const preferred = procedure.codes.find((code) => code.id === item.defaultCodeId) ?? null;
  if (!preferred || preferred.codeSystem.toUpperCase() !== codeSystem.toUpperCase()) return null;
  return resolveProcedureCode([preferred], {
    procedureId: procedure.id,
    codeSystem,
    at,
    healthInsurerId,
    tableKey,
  });
}

/**
 * Resolve o TUSS de um item de kit exclusivamente dentro da tabela escolhida
 * na guia. Uma preferência gravada no kit só é respeitada se continuar válida
 * nessa mesma tabela; caso contrário o resolvedor determinístico escolhe outro
 * TUSS válido da tabela, sem recorrer a IPASGO ou a outro catálogo.
 */
export function resolveKitItemTussCode(input: {
  procedure: Procedure;
  item: ProcedureKitItem;
  healthInsurerId: string | null;
  tableKey: string;
  at?: Date;
}): ProcedureCode | null {
  const at = input.at ?? new Date();
  const preferred = preferredForSystem(
    input.procedure,
    input.item,
    "TUSS",
    at,
    input.healthInsurerId,
    input.tableKey,
  );
  return preferred ?? resolveProcedureCode(input.procedure.codes, {
    procedureId: input.procedure.id,
    codeSystem: "TUSS",
    at,
    healthInsurerId: input.healthInsurerId,
    tableKey: input.tableKey,
  });
}

/**
 * Compatibilidade legada para dados/testes anteriores ao modelo de tabela TUSS
 * escolhida por guia. O fluxo clínico novo usa resolveKitItemTussCode.
 */
export function resolveKitItemCodes(input: {
  procedure: Procedure;
  item: ProcedureKitItem;
  healthInsurerId: string | null;
  at?: Date;
}): { tuss: ProcedureCode | null; ipasgo: ProcedureCode | null } {
  const at = input.at ?? new Date();
  const tussPreferred = preferredForSystem(
    input.procedure,
    input.item,
    "TUSS",
    at,
    input.healthInsurerId,
  );
  const ipasgoPreferred = preferredForSystem(
    input.procedure,
    input.item,
    "IPASGO",
    at,
    input.healthInsurerId,
  );

  return {
    tuss: tussPreferred ?? resolveProcedureCode(input.procedure.codes, {
      procedureId: input.procedure.id,
      codeSystem: "TUSS",
      at,
      healthInsurerId: input.healthInsurerId,
    }),
    ipasgo: ipasgoPreferred ?? resolveProcedureCode(input.procedure.codes, {
      procedureId: input.procedure.id,
      codeSystem: "IPASGO",
      at,
      healthInsurerId: input.healthInsurerId,
    }),
  };
}
