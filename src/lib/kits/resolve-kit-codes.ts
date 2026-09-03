import { resolveProcedureCode } from "@/lib/codes";
import type { Procedure, ProcedureCode, ProcedureKitItem } from "@/types/domain";

function preferredForSystem(
  procedure: Procedure,
  item: ProcedureKitItem,
  codeSystem: string,
  at: Date,
  healthInsurerId: string | null,
): ProcedureCode | null {
  if (!item.defaultCodeId) return null;
  const preferred = procedure.codes.find((code) => code.id === item.defaultCodeId) ?? null;
  if (!preferred || preferred.codeSystem.toUpperCase() !== codeSystem.toUpperCase()) return null;
  return resolveProcedureCode([preferred], {
    procedureId: procedure.id,
    codeSystem,
    at,
    healthInsurerId,
  });
}

/**
 * Respeita o código preferencial legado do kit somente no seu próprio sistema.
 * Se ele deixou de ser vigente/compatível, usa o resolvedor determinístico do
 * sistema correspondente. Nunca reutiliza TUSS como IPASGO ou vice-versa.
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
