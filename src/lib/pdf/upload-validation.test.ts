import { describe, expect, it } from "vitest";
import {
  MAX_TEMPLATE_PDF_BYTES,
  MAX_TEMPLATE_PDF_PAGES,
  validateInspectedPdf,
  validatePdfSignature,
  validatePdfUploadMetadata,
} from "@/lib/pdf/upload-validation";

describe("template PDF upload validation", () => {
  it("aceita um PDF dentro dos limites", () => {
    expect(() => validatePdfUploadMetadata({ name: "guia.pdf", type: "application/pdf", size: 1024 })).not.toThrow();
    expect(() => validatePdfSignature(new TextEncoder().encode("%PDF-1.7\nresto"))).not.toThrow();
    expect(() => validateInspectedPdf({ pageCount: 2, pageWidth: 595, pageHeight: 842 })).not.toThrow();
  });

  it("rejeita arquivo vazio, grande demais ou com extensão incompatível", () => {
    expect(() => validatePdfUploadMetadata({ name: "guia.txt", type: "text/plain", size: 10 })).toThrow(/PDF/);
    expect(() => validatePdfUploadMetadata({ name: "guia.pdf", size: 0 })).toThrow(/vazio/);
    expect(() => validatePdfUploadMetadata({ name: "guia.pdf", size: MAX_TEMPLATE_PDF_BYTES + 1 })).toThrow(/20 MB/);
  });

  it("rejeita conteúdo que apenas se chama PDF", () => {
    expect(() => validatePdfSignature(new TextEncoder().encode("arquivo qualquer"))).toThrow(/assinatura PDF/);
  });

  it("rejeita PDFs com páginas inválidas ou acima do limite", () => {
    expect(() => validateInspectedPdf({ pageCount: 0, pageWidth: null, pageHeight: null })).toThrow(/páginas válidas/);
    expect(() => validateInspectedPdf({ pageCount: MAX_TEMPLATE_PDF_PAGES + 1, pageWidth: 595, pageHeight: 842 })).toThrow(/50 páginas/);
  });
});
