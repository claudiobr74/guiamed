import { describe, expect, it } from "vitest";
import { validateRequestForFinalization } from "@/lib/requests/finalization-validation";
import type { DocumentTemplate, SurgicalRequest, TemplateVersion } from "@/types/domain";

const request = {
  id: "request-1", organizationId: "org-1", patientId: "patient-1", doctorId: "doctor-1", institutionId: "institution-1", healthInsurerId: "insurer-1", templateId: "template-1", templateVersionId: "version-1", diagnosis: null, clinicalJustification: "Justificativa revisada.", clinicalNotes: null, status: "draft", revision: 0, createdBy: "user-1", createdAt: "2026-09-02T00:00:00Z", updatedAt: "2026-09-02T00:00:00Z", finalizedAt: null, duplicatedFromId: null,
  patient: { id: "patient-1", organizationId: "org-1", fullName: "Paciente Sintético", cpf: null, birthDate: null, sex: null, phone: null, email: null, healthInsurerId: "insurer-1", healthInsurerName: null, insuranceCard: null, createdAt: "2026-09-02T00:00:00Z", updatedAt: "2026-09-02T00:00:00Z" },
  doctor: { id: "doctor-1", organizationId: "org-1", name: "Médico Teste", crm: "12345", crmState: "GO", cpf: null, rqe: null, specialty: null, phone: null, email: null, signatureFile: null, signatureKind: "image", isDefault: true, active: true },
  institution: { id: "institution-1", organizationId: "org-1", kind: "hospital", name: "Hospital Teste", cnpj: null, city: null, state: "GO", phone: null, active: true },
  items: [{ id: "item-1", requestId: "request-1", procedureId: "procedure-1", procedureName: "Procedimento sintético", tussCodeId: "tuss-1", ipasgoCodeId: "ipasgo-1", tussCodeSnapshot: "TEST-TUSS", ipasgoCodeSnapshot: "TEST-IPASGO", quantity: 2, laterality: null, notes: null, sortOrder: 0 }], cids: [],
} satisfies SurgicalRequest;

const template = { id: "template-1", organizationId: "org-1", name: "Template", institutionId: "institution-1", healthInsurerId: "insurer-1", documentType: "request", active: true } satisfies DocumentTemplate;
const version = { id: "version-1", templateId: "template-1", version: 1, filePath: "pdf-templates/org-1/template.pdf", fileHash: "hash", pageCount: 1, pageWidth: 1, pageHeight: 1, hasAcroform: false, acroformFields: [], active: true, createdAt: request.createdAt, createdBy: "user-1" } satisfies TemplateVersion;

describe("validação de finalização", () => {
  it("aceita uma guia coerente", () => expect(validateRequestForFinalization({ request, template, version, mappings: [], repeaters: [] }).filter((issue) => issue.severity === "error")).toEqual([]));
  it("bloqueia template de outra instituição", () => expect(validateRequestForFinalization({ request, template: { ...template, institutionId: "other" }, version, mappings: [], repeaters: [] }).some((issue) => issue.code === "TEMPLATE_INCOMPATIBLE")).toBe(true));
  it("bloqueia quantidade inválida e códigos exigidos ausentes", () => {
    const invalid = { ...request, items: [{ ...request.items[0], quantity: 0, tussCodeSnapshot: null, ipasgoCodeSnapshot: null }] };
    const issues = validateRequestForFinalization({ request: invalid, template, version, mappings: [], repeaters: [{ id: "r", templateVersionId: version.id, source: "procedures", page: 1, startX: 0, startY: 0, rowHeight: 10, maxRows: 5, columns: [{ field: "tussCode", x: 0, width: 50 }, { field: "ipasgoCode", x: 50, width: 50 }] }] });
    expect(issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(["INVALID_QUANTITY", "TUSS_REQUIRED", "IPASGO_REQUIRED"]));
  });

  it("soma a capacidade dos repeaters configurados para continuação", () => {
    const continuedRequest = {
      ...request,
      items: Array.from({ length: 7 }, (_, index) => ({
        ...request.items[0],
        id: `item-${index}`,
        sortOrder: index,
      })),
    };
    const issues = validateRequestForFinalization({
      request: continuedRequest,
      template,
      version,
      mappings: [],
      repeaters: [
        { id: "r1", templateVersionId: version.id, source: "procedures", page: 1, startX: 0, startY: 0, rowHeight: 10, maxRows: 5, columns: [] },
        { id: "r2", templateVersionId: version.id, source: "procedures", page: 2, startX: 0, startY: 0, rowHeight: 10, maxRows: 5, columns: [] },
      ],
    });
    expect(issues.some((issue) => issue.code === "PROCEDURE_OVERFLOW")).toBe(false);
  });

  it("retorna erro estruturado quando procedimentos excedem todos os repeaters", () => {
    const overflowRequest = {
      ...request,
      items: Array.from({ length: 11 }, (_, index) => ({
        ...request.items[0],
        id: `item-${index}`,
        sortOrder: index,
      })),
    };
    const issues = validateRequestForFinalization({
      request: overflowRequest,
      template,
      version,
      mappings: [],
      repeaters: [
        { id: "r1", templateVersionId: version.id, source: "procedures", page: 1, startX: 0, startY: 0, rowHeight: 10, maxRows: 5, columns: [] },
        { id: "r2", templateVersionId: version.id, source: "procedures", page: 2, startX: 0, startY: 0, rowHeight: 10, maxRows: 5, columns: [] },
      ],
    });
    expect(issues).toContainEqual(expect.objectContaining({ code: "PROCEDURE_OVERFLOW", severity: "error" }));
  });
});
