import type { CidCode, Patient } from "@/types/domain";

export interface CidInformationalWarning {
  code: "CID_SEX_RESTRICTION" | "CID_EXCLUSION_REFERENCE";
  message: string;
}

export function cidInformationalWarnings(
  cid: CidCode,
  patientSex: Patient["sex"] | null | undefined,
): CidInformationalWarning[] {
  const warnings: CidInformationalWarning[] = [];
  if (
    cid.sexRestriction &&
    (patientSex === "M" || patientSex === "F") &&
    cid.sexRestriction !== patientSex
  ) {
    warnings.push({
      code: "CID_SEX_RESTRICTION",
      message: `O CID ${cid.code} possui restrição de sexo ${cid.sexRestriction} registrada na base oficial. Revise a seleção; o alerta não bloqueia a decisão médica.`,
    });
  }
  if (cid.excluded?.trim()) {
    warnings.push({
      code: "CID_EXCLUSION_REFERENCE",
      message: `O CID ${cid.code} possui nota de exclusão/referência na base oficial. Revise a informação associada ao código antes de finalizar.`,
    });
  }
  return warnings;
}
