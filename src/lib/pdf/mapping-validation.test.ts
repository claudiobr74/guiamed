import { describe, expect, it } from "vitest";
import {
  validateMappingsForTemplate,
  validateRepeaterForTemplate,
} from "@/lib/pdf/mapping-validation";
import type { TemplateVersion } from "@/types/domain";

const version: TemplateVersion = {
  id: "version-1",
  templateId: "template-1",
  version: 1,
  filePath: "pdf-templates/org-1/template.pdf",
  fileHash: "hash",
  pageCount: 2,
  pageWidth: 595,
  pageHeight: 842,
  hasAcroform: true,
  acroformFields: [{ name: "patient_name", type: "PDFTextField", page: 1 }],
  active: true,
  createdAt: "2026-09-03T00:00:00Z",
  createdBy: "user-1",
};

const mapping = {
  semanticField: "patient.full_name",
  pdfFieldName: null,
  mappingKind: "overlay" as const,
  page: 1,
  x: 40,
  y: 40,
  width: 200,
  height: 18,
  fontSize: 10,
  alignment: "left" as const,
  multiline: false,
  autoShrink: true,
  maxCharacters: null,
  required: true,
};

describe("validação de mapeamentos PDF", () => {
  it("aceita mapping dentro da página", () => {
    expect(validateMappingsForTemplate([mapping], version)).toEqual([mapping]);
  });

  it("rejeita página inexistente e geometria fora do PDF", () => {
    expect(() => validateMappingsForTemplate([{ ...mapping, page: 3 }], version)).toThrow(/página 3/);
    expect(() => validateMappingsForTemplate([{ ...mapping, x: 500, width: 200 }], version)).toThrow(/largura/);
  });

  it("exige nome para mapping AcroForm", () => {
    expect(() => validateMappingsForTemplate([{ ...mapping, mappingKind: "acroform" }], version)).toThrow(/AcroForm/);
  });

  it("rejeita campo AcroForm ausente ou de tipo não suportado", () => {
    expect(() => validateMappingsForTemplate([{
      ...mapping,
      mappingKind: "acroform",
      pdfFieldName: "ausente",
    }], version)).toThrow(/não existe/);
    expect(() => validateMappingsForTemplate([{
      ...mapping,
      mappingKind: "acroform",
      pdfFieldName: "assinatura",
    }], {
      ...version,
      acroformFields: [{ name: "assinatura", type: "PDFSignature", page: 1 }],
    })).toThrow(/não é suportado/);
  });

  it("valida capacidade e colunas da região repetidora", () => {
    const repeater = {
      templateVersionId: version.id,
      source: "procedures" as const,
      page: 2,
      startX: 40,
      startY: 100,
      rowHeight: 18,
      maxRows: 5,
      columns: [{ field: "name" as const, x: 40, width: 200 }],
    };
    expect(validateRepeaterForTemplate(repeater, version)).toEqual(repeater);
    expect(() => validateRepeaterForTemplate({ ...repeater, startY: 800 }, version)).toThrow(/altura/);
    expect(() => validateRepeaterForTemplate({ ...repeater, columns: [] }, version)).toThrow(/coluna/);
  });
});
