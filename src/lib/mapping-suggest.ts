export const SEMANTIC_FIELDS = [
  "patient.full_name",
  "patient.birth_date",
  "patient.cpf",
  "patient.sex",
  "patient.phone",
  "patient.email",
  "patient.insurance_card",
  "doctor.name",
  "doctor.crm",
  "doctor.crm_state",
  "doctor.specialty",
  "doctor.rqe",
  "institution.name",
  "health_insurer.name",
  "request.diagnosis",
  "request.clinical_justification",
  "request.cid",
  "request.created_at",
  "signature.image",
] as const;

export type SemanticField = (typeof SEMANTIC_FIELDS)[number] | `procedures[${number}].${string}`;

const RULES: Array<{ pattern: RegExp; field: string }> = [
  { pattern: /paciente|patient.?name|nome.?pac/i, field: "patient.full_name" },
  { pattern: /nasc|birth|dt.?nasc/i, field: "patient.birth_date" },
  { pattern: /cpf/i, field: "patient.cpf" },
  { pattern: /sexo|sex/i, field: "patient.sex" },
  { pattern: /telefone|phone|celular/i, field: "patient.phone" },
  { pattern: /e-?mail/i, field: "patient.email" },
  { pattern: /carteir|cartao|card/i, field: "patient.insurance_card" },
  { pattern: /medico|doctor|solicitante|profissional/i, field: "doctor.name" },
  { pattern: /crm/i, field: "doctor.crm" },
  { pattern: /rqe/i, field: "doctor.rqe" },
  { pattern: /especialidade|specialty/i, field: "doctor.specialty" },
  { pattern: /institui|hospital|clinica/i, field: "institution.name" },
  { pattern: /convenio|operadora|insurer|ipasgo|unimed/i, field: "health_insurer.name" },
  { pattern: /diagnost/i, field: "request.diagnosis" },
  { pattern: /justific/i, field: "request.clinical_justification" },
  { pattern: /\bcid\b/i, field: "request.cid" },
  { pattern: /assinat|signature/i, field: "signature.image" },
  { pattern: /tuss/i, field: "procedures[0].tuss" },
  { pattern: /ipasgo/i, field: "procedures[0].ipasgo" },
  { pattern: /qtde|quant|qtd/i, field: "procedures[0].quantity" },
  { pattern: /proced/i, field: "procedures[0].name" },
];

export function suggestSemanticField(pdfFieldName: string, label?: string): string | null {
  const haystack = `${pdfFieldName} ${label ?? ""}`;
  for (const rule of RULES) {
    if (rule.pattern.test(haystack)) return rule.field;
  }
  return null;
}

export function procedureSemanticField(
  index: number,
  key: "name" | "tuss" | "ipasgo" | "quantity" | "laterality" | "notes",
): string {
  return `procedures[${index}].${key}`;
}

export function parseProcedureField(semantic: string): { index: number; key: string } | null {
  const match = /^procedures\[(\d+)\]\.([a-zA-Z_]+)$/.exec(semantic);
  if (!match) return null;
  return { index: Number(match[1]), key: match[2] };
}
