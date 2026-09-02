import type { DocumentTemplate, FieldMapping, PdfRepeater, SurgicalRequest, TemplateVersion } from "@/types/domain";

export type FinalizationIssueSeverity = "error" | "warning";

export interface FinalizationIssue {
  code: string;
  severity: FinalizationIssueSeverity;
  message: string;
  itemId?: string;
}

export function validateRequestForFinalization(input: {
  request: SurgicalRequest;
  template: DocumentTemplate | null;
  version: TemplateVersion | null;
  mappings: FieldMapping[];
  repeaters: PdfRepeater[];
}): FinalizationIssue[] {
  const { request, template, version, mappings, repeaters } = input;
  const issues: FinalizationIssue[] = [];
  const error = (code: string, message: string, itemId?: string) => issues.push({ code, severity: "error", message, ...(itemId ? { itemId } : {}) });
  const warning = (code: string, message: string, itemId?: string) => issues.push({ code, severity: "warning", message, ...(itemId ? { itemId } : {}) });

  if (!request.patientId || !request.patient) error("PATIENT_REQUIRED", "Selecione o paciente.");
  if (!request.doctorId || !request.doctor) error("DOCTOR_REQUIRED", "Selecione o médico solicitante.");
  else if (!request.doctor.crm?.trim()) error("CRM_REQUIRED", "Informe o CRM do médico solicitante.");
  if (!request.institutionId || !request.institution) error("INSTITUTION_REQUIRED", "Selecione a instituição.");
  if (!request.templateId || !request.templateVersionId || !template || !version) error("TEMPLATE_REQUIRED", "Selecione um template oficial válido.");

  if (template && !template.active) error("TEMPLATE_INACTIVE", "O template selecionado está inativo.");
  if (template && request.templateId !== template.id) error("TEMPLATE_INCOMPATIBLE", "O template selecionado não corresponde à guia.");
  if (version && request.templateVersionId !== version.id) error("TEMPLATE_VERSION_INCOMPATIBLE", "A versão do template não corresponde à guia.");
  if (template && version && version.templateId !== template.id) error("TEMPLATE_VERSION_INCOMPATIBLE", "A versão selecionada não pertence ao template.");
  if (version && !version.active) error("TEMPLATE_VERSION_INACTIVE", "A versão selecionada do template está inativa.");
  if (template?.institutionId && template.institutionId !== request.institutionId) error("TEMPLATE_INCOMPATIBLE", "O template não é compatível com a instituição selecionada.");
  if (template?.healthInsurerId && !request.healthInsurerId) error("HEALTH_INSURER_REQUIRED", "Selecione o convênio exigido pelo template.");
  if (template?.healthInsurerId && template.healthInsurerId !== request.healthInsurerId) error("TEMPLATE_INCOMPATIBLE", "O template não é compatível com o convênio selecionado.");

  if (request.items.length === 0) error("PROCEDURE_REQUIRED", "Adicione ao menos um procedimento.");
  const repeaterFields = new Set(repeaters.flatMap((repeater) => repeater.columns.map((column) => column.field.toLowerCase())));
  const tussRequired = [...repeaterFields].some((field) => field.includes("tuss"));
  const ipasgoRequired = [...repeaterFields].some((field) => field.includes("ipasgo"));
  for (const item of request.items) {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) error("INVALID_QUANTITY", `A quantidade de ${item.procedureName} deve ser um inteiro maior que zero.`, item.id);
    if (tussRequired && !item.tussCodeSnapshot) error("TUSS_REQUIRED", `${item.procedureName} está sem código TUSS.`, item.id);
    else if (!item.tussCodeSnapshot) warning("TUSS_NOT_FOUND", `${item.procedureName} está sem código TUSS.`, item.id);
    if (ipasgoRequired && !item.ipasgoCodeSnapshot) error("IPASGO_REQUIRED", `${item.procedureName} está sem código IPASGO.`, item.id);
    else if (!item.ipasgoCodeSnapshot) warning("IPASGO_NOT_FOUND", `${item.procedureName} está sem código IPASGO.`, item.id);
  }

  const requiredFields = new Set(mappings.filter((mapping) => mapping.required).map((mapping) => mapping.semanticField));
  if ([...requiredFields].some((field) => field.startsWith("cid")) && request.cids.length === 0) error("CID_REQUIRED", "Selecione ao menos um CID-10.");
  if ([...requiredFields].some((field) => field.includes("justification")) && !request.clinicalJustification?.trim()) error("JUSTIFICATION_REQUIRED", "Informe a justificativa clínica.");
  return issues;
}
