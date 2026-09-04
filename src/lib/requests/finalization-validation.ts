import type { DocumentTemplate, FieldMapping, PdfRepeater, SurgicalRequest, TemplateVersion, TussCodeTable } from "@/types/domain";
import { getCid10ByCode } from "@/lib/cid10/catalog";
import { cidInformationalWarnings } from "@/lib/cid10/warnings";
import { maxRowsFromRepeaters } from "@/lib/overflow";
import { validateRequestForPdf } from "@/lib/pdf/fill";

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
  tussTable: TussCodeTable | null;
  mappings: FieldMapping[];
  repeaters: PdfRepeater[];
}): FinalizationIssue[] {
  const { request, template, version, tussTable, mappings, repeaters } = input;
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
  const selectedTussTableKey = request.tussTableKey?.trim() ?? "";
  if (request.items.length > 0 && !selectedTussTableKey) {
    error("TUSS_TABLE_REQUIRED", "Selecione a Tabela TUSS utilizada nesta guia.");
  } else if (request.items.length > 0 && selectedTussTableKey) {
    if (!tussTable || !tussTable.active || tussTable.key !== selectedTussTableKey) {
      error(
        "TUSS_TABLE_UNAVAILABLE",
        "A Tabela TUSS selecionada não está mais disponível. Escolha uma tabela ativa e revise os procedimentos.",
      );
    }
  }

  const procedureCapacity = maxRowsFromRepeaters(repeaters);
  if (procedureCapacity !== null && request.items.length > procedureCapacity) {
    error("PROCEDURE_OVERFLOW", `Este template suporta até ${procedureCapacity} procedimentos. Foram selecionados ${request.items.length}.`);
  }

  for (const item of request.items) {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      error("INVALID_QUANTITY", `A quantidade de ${item.procedureName} deve ser um inteiro maior que zero.`, item.id);
    }
    if (!item.tussCodeSnapshot) {
      error("TUSS_REQUIRED", `${item.procedureName} não possui código válido na Tabela TUSS escolhida.`, item.id);
    }
  }

  const requiredMappings = mappings.filter((mapping) => mapping.required);
  const seenRequiredSemantics = new Set<string>();
  for (const mapping of requiredMappings) {
    const semantic = mapping.semanticField;
    if (seenRequiredSemantics.has(semantic)) continue;
    seenRequiredSemantics.add(semantic);

    if (semantic === "request.cid") {
      if (request.cids.length === 0) error("CID_REQUIRED", "Selecione ao menos um CID-10.");
      continue;
    }
    if (semantic === "request.clinical_justification") {
      if (!request.clinicalJustification?.trim()) error("JUSTIFICATION_REQUIRED", "Informe a justificativa clínica.");
      continue;
    }
    if (semantic === "doctor.crm") continue;
    if (semantic === "signature.image") {
      if (!request.doctor?.signatureFile) error("SIGNATURE_REQUIRED", "O template exige a imagem de assinatura do médico.");
      continue;
    }

    const procedure = /^procedures\[(\d+)\]\.([a-zA-Z_]+)$/.exec(semantic);
    const item = procedure ? request.items[Number(procedure[1])] : undefined;
    const field = procedure?.[2]?.toLowerCase();
    if (field === "ipasgo") {
      error("LEGACY_IPASGO_MAPPING", "Este template contém um campo IPASGO do modelo antigo. Refaça o mapping usando a Tabela TUSS atual.", item?.id);
      continue;
    }

    const mappingErrors = validateRequestForPdf(request, [mapping]).filter(
      (message) => !message.includes("campo CRM do médico"),
    );
    if (mappingErrors.length === 0) continue;

    if (field === "tuss") {
      error("TUSS_REQUIRED", `${item?.procedureName ?? "Procedimento"} está sem código TUSS exigido pelo template.`, item?.id);
    } else {
      error("REQUIRED_MAPPING_EMPTY", mappingErrors[0], item?.id);
    }
  }

  for (const selected of request.cids) {
    const cid = getCid10ByCode(selected.codeSnapshot);
    if (!cid) continue;
    for (const informational of cidInformationalWarnings(cid, request.patient?.sex)) {
      warning(informational.code, informational.message, selected.id);
    }
  }

  return issues;
}
