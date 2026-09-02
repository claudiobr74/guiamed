import { describe, expect, it } from "vitest";
import { resolveTemplateSelection } from "@/lib/templates/compatibility";
import type { DocumentTemplate } from "@/types/domain";

const template = (id: string, institutionId: string | null, healthInsurerId: string | null): DocumentTemplate => ({
  id, organizationId: "org-1", name: id, institutionId, healthInsurerId, documentType: "request", active: true,
  currentVersion: { id: `${id}-v1`, templateId: id, version: 1, filePath: `pdf-templates/org-1/${id}.pdf`, fileHash: "hash", pageCount: 1, pageWidth: 1, pageHeight: 1, hasAcroform: false, acroformFields: [], active: true, createdAt: "2026-09-02", createdBy: "user-1" },
});

describe("compatibilidade de templates", () => {
  it("filtra instituição e convênio e seleciona o único resultado", () => {
    const result = resolveTemplateSelection({ templates: [template("a", "hospital-1", "insurer-1"), template("b", "hospital-2", null)], institutionId: "hospital-1", healthInsurerId: "insurer-1", selectedTemplateId: null });
    expect(result.templates.map((entry) => entry.id)).toEqual(["a"]);
    expect(result.templateId).toBe("a");
  });

  it("invalida template após mudança incompatível", () => {
    const result = resolveTemplateSelection({ templates: [template("a", "hospital-1", null)], institutionId: "hospital-2", healthInsurerId: null, selectedTemplateId: "a" });
    expect(result).toMatchObject({ templateId: null, templateVersionId: null, invalidated: true });
  });
});
