import { describe, expect, it } from "vitest";
import { buildFinalizedRequestSnapshot } from "@/lib/requests/finalized-snapshot";
import type { DocumentTemplate, SurgicalRequest, TemplateVersion } from "@/types/domain";

describe("snapshot finalizado", () => {
  it("preserva códigos, quantidades e versão do template por valor", () => {
    const request = {
      id: "request-1", organizationId: "org-1", revision: 3, patientId: "patient-1", doctorId: "doctor-1", institutionId: "institution-1", healthInsurerId: null, templateId: "template-1", templateVersionId: "version-1", diagnosis: "Diagnóstico sintético", clinicalJustification: "Justificativa sintética", clinicalNotes: null, status: "draft", createdBy: "user-1", createdAt: "2026-09-02", updatedAt: "2026-09-02", finalizedAt: null, duplicatedFromId: null,
      items: [{ id: "item-1", requestId: "request-1", procedureId: "procedure-1", procedureName: "Procedimento sintético", tussCodeId: "tuss-1", ipasgoCodeId: null, tussCodeSnapshot: "TEST-TUSS", ipasgoCodeSnapshot: null, tussDescriptionSnapshot: "Descrição sintética", tussVersionSnapshot: "2026.1", quantity: 4, laterality: null, notes: null, sortOrder: 0 }],
      cids: [{ id: "cid-1", requestId: "request-1", cidCodeId: "CID-TEST", codeSnapshot: "Z00.0", descriptionSnapshot: "CID sintético", sortOrder: 0 }],
    } satisfies SurgicalRequest;
    const template = { id: "template-1", organizationId: "org-1", name: "Template oficial", institutionId: null, healthInsurerId: null, documentType: "request", active: true } satisfies DocumentTemplate;
    const version = { id: "version-1", templateId: template.id, version: 7, filePath: "pdf-templates/org-1/test.pdf", fileHash: "template-hash", pageCount: 1, pageWidth: 1, pageHeight: 1, hasAcroform: false, acroformFields: [], active: true, createdAt: "2026-09-02", createdBy: "user-1" } satisfies TemplateVersion;

    const snapshot = buildFinalizedRequestSnapshot(request, template, version);
    request.items[0].quantity = 1;
    expect(snapshot.items[0]).toMatchObject({ tussCode: "TEST-TUSS", tussVersion: "2026.1", quantity: 4 });
    expect(snapshot.template).toMatchObject({ version: 7, fileHash: "template-hash" });
  });
});
